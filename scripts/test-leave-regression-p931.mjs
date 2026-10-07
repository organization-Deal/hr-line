// P9.31: unchanged P9.30 regression assertions except runtime release label.
// Node 22+ regression tests. Real SQLite and the production leave functions;
// no credentials, external requests or production data.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const root=new URL('../',import.meta.url);
const source=fs.readFileSync(new URL('src/index.js',root),'utf8');
const migrationName='0037_leave_retroactive.sql';
const migrations=fs.readdirSync(new URL('migrations/',root)).filter(x=>x.endsWith('.sql')&&x<migrationName).sort();
class D1Fixture{
  constructor(sqlite=new DatabaseSync(':memory:')){this.sqlite=sqlite;this.calls=[];this.hook=null;}
  prepare(sql){
    const db=this;
    function bound(values=[]){
      async function execute(method){
        db.calls.push({sql,values,method});
        if(db.hook)await db.hook(sql,values,method);
        const params=[];
        const text=sql.replace(/\?(\d+)/g,(_m,i)=>{params.push(values[Number(i)-1]);return '?';});
        try{return db.sqlite.prepare(text)[method](...(params.length?params:values));}
        catch(e){throw new Error(`D1_ERROR: ${e.message}: SQLITE_ERROR`);}
      }
      return {bind:(...values)=>bound(values),
        all:async()=>({success:true,results:await execute('all')}),
        first:async()=>await execute('get')||null,
        run:async()=>{const r=await execute('run');return {success:true,meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};}};
    }
    return bound();
  }
  async batch(statements){
    this.sqlite.exec('BEGIN');
    try{const rows=[];for(const s of statements)rows.push(await s.all());this.sqlite.exec('COMMIT');return rows;}
    catch(e){this.sqlite.exec('ROLLBACK');throw e;}
  }
  columns(){return this.sqlite.prepare('PRAGMA table_info(leave_requests)').all().map(x=>x.name);}
  leaves(){return this.sqlite.prepare('SELECT * FROM leave_requests ORDER BY id').all();}
  alters(){return this.calls.filter(x=>/^ALTER TABLE leave_requests ADD COLUMN (is_retroactive|retro_reason)/.test(x.sql));}
}
function runtime(db,input=source){
  const logs=[];
  let clock=Date.parse('2026-10-06T10:19:00Z');
  class FixedDate extends Date{constructor(...a){super(...(a.length?a:[clock]));}static now(){return clock;}}
  const ctx=vm.createContext({Date:FixedDate,crypto:webcrypto,URL,URLSearchParams,TextEncoder,TextDecoder,Request,Response,Headers,FormData,Blob,
    AbortController,setTimeout,clearTimeout,Buffer,atob,btoa,structuredClone,
    console:{log:(...x)=>logs.push(x.join(' ')),warn:(...x)=>logs.push(x.join(' ')),error:(...x)=>logs.push(x.join(' '))},
    fetch:async()=>{throw new Error('External request forbidden in regression test');}});
  vm.runInContext(input.replace(/^import .*;\r?\n/gm,'').replace('export default {','globalThis.worker = {'),ctx);
  return {ctx,logs,db,env:{DB:db},run:(name,...args)=>ctx[name](...args),tick(ms){clock+=ms;}};
}
async function fixture({input=source,journal=true,extraColumns=[]}={}){
  const db=new D1Fixture();
  for(const name of migrations)db.sqlite.exec(fs.readFileSync(new URL(`migrations/${name}`,root),'utf8'));
  const f=runtime(db,input);
  // Old versions explicitly used this bootstrap to add V0.5 columns (not in SQL migrations).
  await f.run('ensureV050Schema',db);
  await f.run('ensureCoreSchema',db);
  await f.run('ensureV100P1Ready',db);
  await f.run('ensureV100P2Ready',db);
  await f.run('ensureV100P4Ready',db);
  db.sqlite.exec(`
    INSERT INTO clients(id,name,code,lock_leave_during_probation) VALUES(1,'บริษัททดสอบ A','TEST-A',0),(2,'บริษัททดสอบ B','TEST-B',0);
    INSERT INTO employees(id,client_id,employee_code,first_name,last_name,start_date,status,people_status,leave_access_override)
      VALUES(1,1,'TEST-001','พนักงาน','ตัวอย่าง','2025-01-01','active','employee',1),(2,2,'TEST-002','พนักงาน','บริษัทอื่น','2025-01-01','active','employee',1);
  `);
  if(journal){
    db.sqlite.exec(`CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE NOT NULL,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL);`);
    const ins=db.sqlite.prepare('INSERT INTO d1_migrations(name) VALUES(?)');
    for(const name of migrations)ins.run(name);
  }
  for(const name of extraColumns)db.sqlite.exec(`ALTER TABLE leave_requests ADD COLUMN ${name==='is_retroactive'?'is_retroactive INTEGER NOT NULL DEFAULT 0':'retro_reason TEXT'}`);
  await f.run('ensureDefaultLeavePolicies',db,1);
  f.policy=Number(db.sqlite.prepare("SELECT id FROM leave_policies WHERE client_id=1 AND code='annual'").get().id);
  f.token='p930-test-token-'.padEnd(40,'x');
  const hash=await f.run('sha256Hex',f.token);
  db.sqlite.prepare('INSERT INTO learning_access_tokens(token_hash,client_id,employee_id,expires_at) VALUES(?,1,1,?)').run(hash,'2099-12-31T23:59:59Z');
  f.payload=(overrides={})=>({clientId:1,employeeId:1,policyId:f.policy,startDate:'2026-10-07',endDate:'2026-10-07',reason:'ไปทำธุระตามนัดหมาย',...overrides});
  f.request=(overrides={})=>{
    const d={policy_id:String(f.policy),start_date:'2026-10-07',end_date:'2026-10-07',day_part:'full',reason:'ไปทำธุระตามนัดหมาย',...overrides};
    const form=new FormData();for(const [k,v] of Object.entries(d))form.append(k,String(v));
    return new Request(`https://test.invalid/api/public/leave/${f.token}`,{method:'POST',body:form});
  };
  db.calls=[];
  return f;
}
function assertRepaired(f){assert.ok(f.db.columns().includes('is_retroactive'));assert.ok(f.db.columns().includes('retro_reason'));}

test('P9.29 reproduces screenshot: normal leave POST fails on missing is_retroactive',{
  skip:!process.env.P929_SOURCE||!fs.existsSync(process.env.P929_SOURCE)
},async()=>{
  const f=await fixture({input:fs.readFileSync(process.env.P929_SOURCE,'utf8')});
  const r=await f.ctx.worker.fetch(f.request(),f.env,{});const d=await r.json();
  assert.notEqual(r.status,201);assert.match(d.error,/no column named is_retroactive/);assert.equal(f.db.leaves().length,0);
});

test('P9.30 real public POST: legacy DB repairs automatically and normal leave is pending',async()=>{
  const f=await fixture();const r=await f.ctx.worker.fetch(f.request(),f.env,{});const d=await r.json();
  assert.equal(r.status,201,JSON.stringify(d));assert.equal(d.ok,true);assert.equal(d.request.is_retroactive,false);
  assert.equal(d.request.status,'pending');assertRepaired(f);assert.equal(f.db.leaves().length,1);
  assert.equal(f.db.leaves()[0].retro_reason,null);
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM leave_approval_events').get().n,1);
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM leave_ledger').get().n,1);
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM attendance').get().n,0);
});

test('real public GET repairs before showing the form; fields need not be resubmitted elsewhere',async()=>{
  const f=await fixture();const req=new Request(`https://test.invalid/api/public/leave/${f.token}`);
  const r=await f.ctx.worker.fetch(req,f.env,{});const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));
  assert.ok(d.policies.length);assertRepaired(f);
});

test('expired/invalid portal token remains 401 and never repairs schema or creates leave',async()=>{
  const f=await fixture();const r=await f.ctx.worker.fetch(new Request('https://test.invalid/api/public/leave/'+'z'.repeat(40)),f.env,{});
  assert.equal(r.status,401);assert.equal(f.db.columns().includes('is_retroactive'),false);assert.equal(f.db.leaves().length,0);
});

test('retroactive public POST stores BOTH reasons and requires approval; no immediate attendance change',async()=>{
  const f=await fixture();const r=await f.ctx.worker.fetch(f.request({start_date:'2026-10-05',end_date:'2026-10-05',retro_reason:'ลืมยื่นใบลาในวันนั้น'}),f.env,{});
  const d=await r.json();assert.equal(r.status,201,JSON.stringify(d));assert.equal(d.request.is_retroactive,true);
  assert.equal(d.request.retro_reason,'ลืมยื่นใบลาในวันนั้น');assert.equal(d.request.status,'pending');
  assert.equal(f.db.leaves()[0].reason,'ไปทำธุระตามนัดหมาย');assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM attendance').get().n,0);
});

test('retroactive leave without explanation is still rejected before INSERT',async()=>{
  const f=await fixture();const r=await f.ctx.worker.fetch(f.request({start_date:'2026-10-05',end_date:'2026-10-05'}),f.env,{});
  assert.equal(r.status,400);assert.match((await r.json()).error,/สาเหตุ/);assert.equal(f.db.leaves().length,0);
});

test('mixed retrospective and future date range remains invalid',async()=>{
  const f=await fixture();const r=await f.ctx.worker.fetch(f.request({start_date:'2026-10-05',end_date:'2026-10-07',retro_reason:'ลืมส่ง'}),f.env,{});
  assert.equal(r.status,400);assert.equal(f.db.leaves().length,0);
});

test('half-day leave still calculates 0.5 days',async()=>{
  const f=await fixture();const row=await f.run('createLeaveRequest',f.env,f.payload({dayPart:'am'}));assert.equal(row.duration_days,0.5);
});

test('old leaves, evidence links and approval events are untouched by additive repair',async()=>{
  const f=await fixture();
  f.db.sqlite.prepare(`INSERT INTO leave_requests(id,client_id,employee_id,leave_type,start_date,end_date,reason,status,policy_id,duration_days) VALUES(50,1,1,'annual','2026-09-21','2026-09-21','เหตุผลเดิม','approved',?,1)`).run(f.policy);
  f.db.sqlite.exec(`INSERT INTO leave_approval_events(client_id,leave_request_id,action,actor_type,reason) VALUES(1,50,'approved','user','อนุมัติเดิม');INSERT INTO leave_request_evidence(client_id,leave_request_id,r2_key,file_name) VALUES(1,50,'old/key','เอกสารเดิม.pdf');`);
  const before=f.db.leaves()[0];await f.run('ensureLeaveRetroSchemaReady',f.db);const after=f.db.leaves()[0];
  for(const [k,v] of Object.entries(before))assert.equal(after[k],v,k);
  assert.equal(after.is_retroactive,0);assert.equal(after.retro_reason,null);
  assert.equal(f.db.sqlite.prepare('SELECT r2_key FROM leave_request_evidence').get().r2_key,'old/key');
  assert.equal(f.db.sqlite.prepare('SELECT reason FROM leave_approval_events').get().reason,'อนุมัติเดิม');
});

for(const col of ['is_retroactive','retro_reason'])test(`partial migration with ${col} already present adds only the other column`,async()=>{
  const f=await fixture({extraColumns:[col]});await f.run('ensureLeaveRetroSchemaReady',f.db);assertRepaired(f);
  assert.equal(f.db.alters().length,1);assert.doesNotMatch(f.db.alters()[0].sql,new RegExp(`ADD COLUMN ${col} `));
});

test('already migrated DB is not ALTERed and values are preserved',async()=>{
  const f=await fixture({extraColumns:['is_retroactive','retro_reason']});
  const row=await f.run('createLeaveRequest',f.env,f.payload({startDate:'2026-10-05',endDate:'2026-10-05',retroReason:'เหตุผลย้อนหลังเดิม'}));
  await f.run('ensureLeaveRetroSchemaReady',f.db);assert.equal(f.db.alters().length,0);assert.equal(row.retro_reason,'เหตุผลย้อนหลังเดิม');
});

test('20 simultaneous schema requests share a single repair task',async()=>{
  const f=await fixture();await Promise.all(Array.from({length:20},()=>f.run('ensureLeaveRetroSchemaReady',f.db)));
  assert.equal(f.db.alters().length,2);assertRepaired(f);
});

test('separate Worker isolates tolerate a real duplicate-column race on the same database',async()=>{
  const f=await fixture();const otherDb=new D1Fixture(f.db.sqlite);const other=runtime(otherDb);
  await Promise.all([f.run('ensureLeaveRetroSchemaReady',f.db),other.run('ensureLeaveRetroSchemaReady',otherDb)]);
  assertRepaired(f);assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM d1_migrations WHERE name=?').get(migrationName).n,1);
});

test('a real D1/ALTER failure fails closed without INSERT, clears failed cache, and succeeds on retry',async()=>{
  const f=await fixture();let fail=true;
  f.db.hook=async sql=>{if(fail&&/^ALTER TABLE leave_requests ADD COLUMN retro_reason/.test(sql))throw new Error('D1_ERROR: simulated service unavailable');};
  await assert.rejects(f.run('createLeaveRequest',f.env,f.payload()),e=>e.status===503&&e.code==='LEAVE_SCHEMA_NOT_READY');
  assert.equal(f.db.leaves().length,0);assert.equal(f.db.columns().includes('is_retroactive'),true);
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM d1_migrations WHERE name=?').get(migrationName).n,0);
  fail=false;const row=await f.run('createLeaveRequest',f.env,f.payload());assert.equal(row.status,'pending');assertRepaired(f);
});

test('a fake duplicate error is not swallowed unless the column actually exists',async()=>{
  const f=await fixture();f.db.hook=async sql=>{if(/^ALTER TABLE leave_requests ADD COLUMN/.test(sql))throw new Error('duplicate column name: is_retroactive');};
  await assert.rejects(f.run('ensureLeaveRetroSchemaReady',f.db),e=>e.status===503);assert.equal(f.db.columns().includes('is_retroactive'),false);
});

test('migration journal records only verified 0037 once; other migrations remain unchanged',async()=>{
  const f=await fixture();const before=f.db.sqlite.prepare('SELECT * FROM d1_migrations').all();
  await f.run('ensureLeaveRetroSchemaReady',f.db);f.tick(61000);await f.run('ensureLeaveRetroSchemaReady',f.db);
  const after=f.db.sqlite.prepare('SELECT * FROM d1_migrations WHERE name<>?').all(migrationName);assert.deepEqual(after,before);
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM d1_migrations WHERE name=?').get(migrationName).n,1);
  assert.equal(f.db.alters().length,2);
});

test('journal-only failure does not lose leave or lie about migration completion; next call retries',async()=>{
  const f=await fixture();let fail=true;f.db.hook=async sql=>{if(fail&&sql.startsWith('INSERT INTO d1_migrations'))throw new Error('journal temporarily unavailable');};
  const row=await f.run('createLeaveRequest',f.env,f.payload());assert.equal(row.status,'pending');
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM d1_migrations WHERE name=?').get(migrationName).n,0);
  fail=false;await f.run('ensureLeaveRetroSchemaReady',f.db);
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM d1_migrations WHERE name=?').get(migrationName).n,1);
});

test('legacy installation without Wrangler journal is repaired without creating a second journal',async()=>{
  const f=await fixture({journal:false});await f.run('ensureLeaveRetroSchemaReady',f.db);assertRepaired(f);
  assert.equal(f.db.sqlite.prepare("SELECT name FROM sqlite_master WHERE name='d1_migrations'").get(),undefined);
});

test('cache is scoped per database; a second independent database is repaired too',async()=>{
  const f=await fixture();const g=await fixture();await f.run('ensureLeaveRetroSchemaReady',f.db);await f.run('ensureLeaveRetroSchemaReady',g.db);
  assertRepaired(f);assertRepaired(g);
});

test('employee leave-history query also works before opening/submitting the leave form',async()=>{
  const f=await fixture();const history=await f.run('getEmployeeServiceHistory',f.db,{id:1});assert.equal(history.leaves.length,0);assertRepaired(f);
});

test('duplicate leave is still rejected; there is no auto-resubmission/double reservation',async()=>{
  const f=await fixture();await f.run('createLeaveRequest',f.env,f.payload());
  await assert.rejects(f.run('createLeaveRequest',f.env,f.payload()),e=>e.status===409);
  assert.equal(f.db.leaves().length,1);assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM leave_ledger').get().n,1);
});

test('cross-company employee access remains rejected',async()=>{
  const f=await fixture();await assert.rejects(f.run('createLeaveRequest',f.env,f.payload({employeeId:2})),e=>e.status===404);
  assert.equal(f.db.leaves().length,0);
});

test('insufficient entitlement remains rejected and does not bypass HR policy',async()=>{
  const f=await fixture();f.db.sqlite.prepare('UPDATE leave_policies SET default_entitlement_days=0 WHERE id=?').run(f.policy);
  await assert.rejects(f.run('createLeaveRequest',f.env,f.payload()),e=>e.status===409&&/สิทธิ์/.test(e.message));assert.equal(f.db.leaves().length,0);
});

test('retro leave approval still needs an authorized approver and then updates attendance',async()=>{
  const f=await fixture();const row=await f.run('createLeaveRequest',f.env,f.payload({startDate:'2026-10-05',endDate:'2026-10-05',retroReason:'ลืมส่งใบลา'}));
  await assert.rejects(f.run('decideLeaveRequest',f.env,row.id,'approved',{clientId:1,actorEmployeeId:1,enforceApprover:true}),e=>e.status===403);
  assert.equal(f.db.leaves()[0].status,'pending');
  // Simulates the existing authorized HR route; its role guard is unchanged.
  await f.run('decideLeaveRequest',f.env,row.id,'approved',{clientId:1,actorType:'user'});
  assert.equal(f.db.leaves()[0].status,'approved');assert.equal(f.db.leaves()[0].is_retroactive,1);
  assert.equal(f.db.sqlite.prepare("SELECT status FROM attendance WHERE work_date='2026-10-05'").get().status,'leave');
});

test('required evidence remains required in public form',async()=>{
  const f=await fixture();f.db.sqlite.prepare('UPDATE leave_policies SET evidence_required_after_days=1 WHERE id=?').run(f.policy);
  const r=await f.ctx.worker.fetch(f.request(),f.env,{});assert.equal(r.status,400);assert.match((await r.json()).error,/หลักฐาน/);assert.equal(f.db.leaves().length,0);
});

test('health reports the new runtime release',async()=>{
  const f=await fixture();const r=await f.ctx.worker.fetch(new Request('https://test.invalid/api/health'),f.env,{});
  assert.equal((await r.json()).release,'P9.31-ENROLLMENT-TRIAL-RECOVERY');
});

test('all concurrent callers receive safe 503 on schema failure and a later call retries',async()=>{
  const f=await fixture();f.db.hook=async sql=>{if(/^ALTER TABLE leave_requests ADD COLUMN/.test(sql))throw new Error('D1_ERROR: temporary failure');};
  const results=await Promise.allSettled(Array.from({length:10},()=>f.run('ensureLeaveRetroSchemaReady',f.db)));
  for(const r of results){assert.equal(r.status,'rejected');assert.equal(r.reason.status,503);assert.equal(r.reason.code,'LEAVE_SCHEMA_NOT_READY');assert.doesNotMatch(r.reason.message,/D1_ERROR|SQLITE/);}
  f.db.hook=null;await f.run('ensureLeaveRetroSchemaReady',f.db);assertRepaired(f);
});

test('an index-creation failure does not record 0037 complete and is recoverable',async()=>{
  const f=await fixture();f.db.hook=async sql=>{if(sql.startsWith('CREATE INDEX IF NOT EXISTS idx_leave_retroactive_status'))throw new Error('simulated index failure');};
  await assert.rejects(f.run('ensureLeaveRetroSchemaReady',f.db),e=>e.status===503);assertRepaired(f);
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM d1_migrations WHERE name=?').get(migrationName).n,0);
  f.db.hook=null;await f.run('ensureLeaveRetroSchemaReady',f.db);
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM d1_migrations WHERE name=?').get(migrationName).n,1);
});

test('already-applied migration keeps its timestamp and does not gain a duplicate history record',async()=>{
  const f=await fixture({extraColumns:['is_retroactive','retro_reason']});
  f.db.sqlite.prepare("INSERT INTO d1_migrations(name,applied_at) VALUES(?,'2026-10-05 12:00:00')").run(migrationName);
  const before=f.db.sqlite.prepare('SELECT * FROM d1_migrations WHERE name=?').get(migrationName);
  await f.run('ensureLeaveRetroSchemaReady',f.db);
  assert.deepEqual(f.db.sqlite.prepare('SELECT * FROM d1_migrations WHERE name=?').get(migrationName),before);
});
