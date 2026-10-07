// Local-only integration tests: real SQLite + production Worker functions.
// No deployed database, credentials, network requests, messages or payment writes.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const root=new URL('../',import.meta.url);
const source=fs.readFileSync(new URL('src/index.js',root),'utf8');
const migrations=fs.readdirSync(new URL('migrations/',root)).filter(x=>x.endsWith('.sql')).sort();
class D1Fixture{
  constructor(){this.sqlite=new DatabaseSync(':memory:');this.calls=[];this.hook=null;this.beforeBatch=null;}
  prepare(sql){
    const db=this;
    function bound(values=[]){
      async function execute(method){
        db.calls.push({sql,values,method});if(db.hook)await db.hook(sql,values,method);
        const params=[];const text=sql.replace(/\?(\d+)/g,(_m,i)=>{params.push(values[Number(i)-1]);return '?';});
        try{return db.sqlite.prepare(text)[method](...(params.length?params:values));}catch(e){throw new Error(`D1_ERROR: ${e.message}: SQLITE_ERROR`);}
      }
      return {bind:(...values)=>bound(values),all:async()=>{
        const results=await execute('all');const m=db.sqlite.prepare('SELECT changes() AS changes,last_insert_rowid() AS last_row_id').get();return {success:true,results,meta:m};},
        first:async()=>await execute('get')||null,
        run:async()=>{const m=await execute('run');return {success:true,meta:{changes:Number(m.changes),last_row_id:Number(m.lastInsertRowid)}};}};
    }
    return bound();
  }
  async batch(statements){
    if(this.beforeBatch){const hook=this.beforeBatch;this.beforeBatch=null;await hook();}
    this.sqlite.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.all());this.sqlite.exec('COMMIT');return result;}catch(e){this.sqlite.exec('ROLLBACK');throw e;}
  }
  sub(cid=1){return {...this.sqlite.prepare('SELECT * FROM company_subscriptions WHERE client_id=?').get(cid)};}
  count(table){return Number(this.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n);}
}
function runtime(db,input=source){
  let clock=Date.parse('2026-10-07T04:23:00Z');const logs=[];
  class FixedDate extends Date{constructor(...a){super(...(a.length?a:[clock]));}static now(){return clock;}}
  const ctx=vm.createContext({Date:FixedDate,crypto:webcrypto,URL,URLSearchParams,TextEncoder,TextDecoder,Request,Response,Headers,FormData,Blob,AbortController,setTimeout,clearTimeout,Buffer,atob,btoa,structuredClone,
    console:{log:(...x)=>logs.push(x),warn:(...x)=>logs.push(x),error:(...x)=>logs.push(x)},fetch:async()=>{throw new Error('External request prohibited');}});
  vm.runInContext(input.replace(/^import .*;\r?\n/gm,'').replace('export default {','globalThis.worker = {'),ctx);
  return {ctx,logs,run:(name,...args)=>ctx[name](...args),tick(ms){clock+=ms;}};
}
async function fixture({input=source}={}){
  const db=new D1Fixture();for(const name of migrations)db.sqlite.exec(fs.readFileSync(new URL(`migrations/${name}`,root),'utf8'));
  const f=runtime(db,input);f.db=db;f.env={DB:db,NAKNA_ADMIN_EMAILS:'operator@example.invalid'};
  for(const name of ['ensureV050Schema','ensureCoreSchema','ensureV100P1Ready','ensureV100P2Ready','ensureV100P4Ready','ensureV100P5Ready'])await f.run(name,db);
  db.sqlite.exec(`
    INSERT INTO clients(id,name,code) VALUES(1,'บริษัททดสอบ A','TEST-A'),(2,'บริษัททดสอบ B','TEST-B');
    INSERT INTO users(id,google_sub,email,name) VALUES(1,'operator-test','operator@example.invalid','ผู้ดูแลทดสอบ'),(2,'hr-test','hr@example.invalid','HR ทดสอบ');
    INSERT INTO company_members(client_id,user_id,role,status) VALUES(1,1,'owner','active'),(2,1,'owner','active'),(1,2,'hr','active');
  `);
  await f.run('ensurePhase5Defaults',db,1);await f.run('ensurePhase5Defaults',db,2);
  db.sqlite.exec(`UPDATE company_subscriptions SET status='trialing',trial_started_at='2026-08-21T00:00:00.000Z',trial_ends_at='2026-09-20T00:00:00.000Z',current_period_end='2026-09-20T00:00:00.000Z';`);
  f.auth={ok:true,clientId:1,role:'owner',user:{id:1,email:'operator@example.invalid'}};
  f.body={end_date:'2026-10-21',reason:'ต่อเวลาทดลองให้บริษัททดสอบตามคำขอ'};
  f.token='p931-safe-test-invite-token-12345678';const hash=await f.run('sha256Hex',f.token);
  db.sqlite.prepare(`INSERT INTO employee_invites(id,client_id,token_hash,max_uses,used_count,status,expires_at,start_date) VALUES(1,1,?,10,0,'active','2027-12-31T23:59:59.000Z','2026-10-07')`).run(hash);
  f.inviteRequest=(method='GET',body={first_name:'ทดสอบ',last_name:'พนักงาน',phone:'0000000000'})=>new Request(`https://test.invalid/api/public/invites/${f.token}`,{method,...(method==='GET'?{}:{headers:{'content-type':'application/json'},body:JSON.stringify(body)})});
  f.http=async(request,auth=f.auth)=>{try{return await f.run('handleApi',request,f.env,new URL(request.url),auth,{});}catch(e){return new Response(JSON.stringify({error:e.message}),{status:e.status||500,headers:{'content-type':'application/json'}});}};
  f.extend=(body=f.body,auth=f.auth,cid=1)=>f.http(new Request(`https://test.invalid/api/admin/saas/subscriptions/${cid}/extend-trial`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),auth);
  return f;
}

test('P9.30 reproduces screenshot: invite POST returns expired-trial error and HR gate rejects',{
  skip:!process.env.P930_SOURCE||!fs.existsSync(process.env.P930_SOURCE)
},async()=>{const f=await fixture({input:fs.readFileSync(process.env.P930_SOURCE,'utf8')});const r=await f.ctx.worker.fetch(f.inviteRequest('POST'),f.env,{});assert.equal(r.status,402);assert.match((await r.json()).error,/ช่วงทดลองใช้หมดแล้ว/);await assert.rejects(f.run('assertSeatCapacity',f.db,1),e=>e.status===402);assert.equal(f.db.count('employees'),0);});

test('P9.31 deployment alone never silently renews expired trials',async()=>{const f=await fixture();const status=await f.run('getEmployeeEnrollmentStatus',f.db,1);assert.equal(status.code,'TRIAL_EXPIRED');assert.equal(f.db.sub().status,'expired');assert.equal(f.db.sub().trial_ends_at,'2026-09-20T00:00:00.000Z');assert.equal(f.db.count('billing_payments'),0);});

test('valid public invite GET warns BEFORE form submission without leaking billing details',async()=>{const f=await fixture();const r=await f.ctx.worker.fetch(f.inviteRequest(),f.env,{});const d=await r.json();assert.equal(r.status,200);assert.equal(d.invite.company_name,'บริษัททดสอบ A');assert.equal(d.enrollment.allowed,false);assert.equal(d.enrollment.code,'TRIAL_EXPIRED');assert.match(d.enrollment.message,/ไม่ต้องชำระเงินเอง/);assert.deepEqual(Object.keys(d.enrollment).sort(),['allowed','code','message']);assert.equal(f.db.count('employees'),0);assert.equal(f.db.sqlite.prepare('SELECT used_count FROM employee_invites').get().used_count,0);});

test('public POST still enforces gate even when browser preflight is bypassed',async()=>{const f=await fixture();const r=await f.ctx.worker.fetch(f.inviteRequest('POST'),f.env,{});const d=await r.json();assert.equal(r.status,402);assert.equal(d.code,'TRIAL_EXPIRED');assert.equal(d.enrollment.allowed,false);assert.equal(f.db.count('employees'),0);assert.equal(f.db.count('line_join_tokens'),0);assert.equal(f.db.sqlite.prepare('SELECT used_count FROM employee_invites').get().used_count,0);});

test('operator extends chosen company; preserves trial start and OTHER company byte-for-byte',async()=>{const f=await fixture();const before=f.db.sub(),other=f.db.sub(2);const r=await f.extend();const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));assert.equal(d.enrollment.allowed,true);assert.equal(f.db.sub().status,'trialing');assert.equal(f.db.sub().trial_ends_at,'2026-10-21T16:59:59.000Z');assert.equal(f.db.sub().trial_started_at,before.trial_started_at);assert.equal(f.db.sub().plan_id,before.plan_id);assert.deepEqual(f.db.sub(2),other);assert.equal(f.db.count('billing_payments'),0);assert.equal(f.db.count('billing_invoices'),0);const a=f.db.sqlite.prepare("SELECT * FROM audit_logs WHERE action='subscription.trial_extended'").get();assert.equal(a.actor_id,'1');assert.equal(a.client_id,1);assert.equal(JSON.parse(a.detail_json).reason,f.body.reason);});

test('same invite works after extension; POST creates ONE employee and consumes ONE use',async()=>{const f=await fixture();assert.equal((await f.extend()).status,200);const g=await f.ctx.worker.fetch(f.inviteRequest(),f.env,{});assert.equal((await g.json()).enrollment.allowed,true);const r=await f.ctx.worker.fetch(f.inviteRequest('POST'),f.env,{});const d=await r.json();assert.equal(r.status,201,JSON.stringify(d));assert.equal(d.ok,true);assert.equal(f.db.count('employees'),1);assert.equal(f.db.count('line_join_tokens'),1);assert.equal(f.db.sqlite.prepare('SELECT used_count FROM employee_invites').get().used_count,1);});

test('HR manual employee creation rejects before extension, succeeds after extension',async()=>{const f=await fixture();const request=()=>new Request('https://test.invalid/api/employees',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({first_name:'ทดสอบ',last_name:'HR เพิ่มเอง',start_date:'2026-10-07'})});assert.equal((await f.http(request())).status,402);assert.equal(f.db.count('employees'),0);await f.extend();const r=await f.http(request());assert.equal(r.status,201,JSON.stringify(await r.json()));assert.equal(f.db.count('employees'),1);});

for(const [label,role,email] of [['HR','hr','hr@example.invalid'],['Owner','owner','owner@example.invalid'],['Co-owner','co_owner','coowner@example.invalid'],['employee','employee','employee@example.invalid'],['forged-body-admin','hr','hr@example.invalid']])test(`${label} cannot grant its own free extension without operator allowlist`,async()=>{const f=await fixture();const before=f.db.sub();const r=await f.extend({...f.body,saas_admin:true,email:'operator@example.invalid',user_id:1},{ok:true,clientId:1,role,user:{id:2,email}});assert.equal(r.status,403);assert.deepEqual(f.db.sub(),before);assert.equal(f.db.count('audit_logs'),0);});

test('no configured admin emails means DENY, not wildcard access',async()=>{const f=await fixture();delete f.env.NAKNA_ADMIN_EMAILS;assert.equal((await f.extend()).status,403);});
test('unauthenticated HTTP request cannot reach trial-extension endpoint',async()=>{const f=await fixture();const r=await f.ctx.worker.fetch(new Request('https://test.invalid/api/admin/saas/subscriptions/1/extend-trial',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(f.body)}),f.env,{});assert.equal(r.status,401);});

for(const end_date of ['2026-10-07','2026-10-06','2026-11-07','2026-02-30','nonsense','2026-10-21T00:00:00Z',''])test(`invalid/past/overlong date ${JSON.stringify(end_date)} rejected without change`,async()=>{const f=await fixture();const before=f.db.sub();assert.equal((await f.extend({...f.body,end_date})).status,400);assert.deepEqual(f.db.sub(),before);});
for(const reason of ['', 'abc', 'x'.repeat(501)])test(`reason length ${reason.length} rejected`,async()=>{const f=await fixture();assert.equal((await f.extend({...f.body,reason})).status,400);});
test('unknown company rejected; no default subscription created for made-up tenant',async()=>{const f=await fixture();assert.equal((await f.extend(f.body,f.auth,999)).status,404);assert.equal(f.db.count('company_subscriptions'),2);});
test('second click cannot replay the same extension or slide expiry again',async()=>{const f=await fixture();await f.extend();const before=f.db.sub();assert.equal((await f.extend()).status,409);assert.deepEqual(f.db.sub(),before);assert.equal(f.db.sqlite.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE action='subscription.trial_extended'").get().n,1);});
test('later daily refresh does not undo valid extension; expiry re-applies after new date',async()=>{const f=await fixture();await f.extend();await f.run('refreshSubscriptionState',f.db,1);assert.equal(f.db.sub().status,'trialing');f.tick(16*86400000);assert.equal((await f.run('getEmployeeEnrollmentStatus',f.db,1)).code,'TRIAL_EXPIRED');});
for(const status of ['active','cancelled','past_due'])test(`trial status ${status} cannot be revived/converted by extension`,async()=>{const f=await fixture();f.db.sqlite.prepare('UPDATE company_subscriptions SET status=? WHERE client_id=1').run(status);const before=f.db.sub();assert.equal((await f.extend()).status,409);assert.deepEqual(f.db.sub(),before);});
test('paid-plan subscription cannot be converted to free trial',async()=>{const f=await fixture();f.db.sqlite.exec("UPDATE company_subscriptions SET plan_id=(SELECT id FROM subscription_plans WHERE code='business'),status='expired' WHERE client_id=1");const before=f.db.sub();assert.equal((await f.extend()).status,409);assert.deepEqual(f.db.sub(),before);assert.equal((await f.run('getEmployeeEnrollmentStatus',f.db,1)).code,'SUBSCRIPTION_EXPIRED');});
test('cancelled company has accurate message, never trial-expired wording',async()=>{const f=await fixture();f.db.sqlite.exec("UPDATE company_subscriptions SET status='cancelled' WHERE client_id=1");const d=await f.run('getEmployeeEnrollmentStatus',f.db,1);assert.equal(d.code,'SUBSCRIPTION_CANCELLED');assert.doesNotMatch(d.message,/ช่วงทดลอง/);});
test('existing invoice blocks extension and leaves billing untouched',async()=>{const f=await fixture();f.db.sqlite.exec("INSERT INTO billing_invoices(client_id,invoice_no,period_start,period_end,total,status) VALUES(1,'TEST-INV','2026-10-01','2026-10-31',100,'open')");const before=f.db.sub();assert.equal((await f.extend()).status,409);assert.deepEqual(f.db.sub(),before);assert.equal(f.db.sqlite.prepare('SELECT status FROM billing_invoices').get().status,'open');});
test('existing payment blocks extension without marking anything paid',async()=>{const f=await fixture();f.db.sqlite.exec("INSERT INTO billing_invoices(id,client_id,invoice_no,period_start,period_end,total,status) VALUES(1,1,'TEST-INV','2026-10-01','2026-10-31',100,'void');INSERT INTO billing_payments(client_id,invoice_id,amount) VALUES(1,1,100)");assert.equal((await f.extend()).status,409);assert.equal(f.db.count('billing_payments'),1);});
test('seat cap survives extension and public/manual paths still reject',async()=>{const f=await fixture();f.db.sqlite.exec("UPDATE subscription_plans SET max_seats=1 WHERE code='trial';INSERT INTO employees(client_id,employee_code,first_name,last_name,start_date,status,people_status) VALUES(1,'ONE','พนักงาน','เดิม','2025-01-01','active','employee')");const r=await f.extend();assert.equal(r.status,200);assert.equal((await r.json()).enrollment.code,'SEAT_LIMIT_REACHED');await assert.rejects(f.run('assertSeatCapacity',f.db,1),e=>e.status===409);const post=await f.ctx.worker.fetch(f.inviteRequest('POST'),f.env,{});assert.equal(post.status,409);assert.equal((await post.json()).code,'SEAT_LIMIT_REACHED');assert.equal(f.db.count('employees'),1);});
test('audit failure rolls back trial update',async()=>{const f=await fixture();const before=f.db.sub();f.db.hook=async sql=>{if(sql.startsWith('INSERT INTO audit_logs(client_id'))throw new Error('simulated audit failure');};assert.equal((await f.extend()).status,500);assert.deepEqual(f.db.sub(),before);assert.equal(f.db.count('audit_logs'),0);});
test('UPDATE failure rolls back preceding audit too',async()=>{const f=await fixture();const before=f.db.sub();f.db.hook=async sql=>{if(sql.startsWith("UPDATE company_subscriptions SET status='trialing',trial_ends_at="))throw new Error('simulated update failure');};assert.equal((await f.extend()).status,500);assert.deepEqual(f.db.sub(),before);assert.equal(f.db.count('audit_logs'),0);});
test('concurrent cancellation is not overwritten; no spurious audit recorded',async()=>{const f=await fixture();f.db.beforeBatch=()=>f.db.sqlite.exec("UPDATE company_subscriptions SET status='cancelled' WHERE client_id=1");assert.equal((await f.extend()).status,409);assert.equal(f.db.sub().status,'cancelled');assert.equal(f.db.count('audit_logs'),0);});
test('legacy admin status=trialing with expired end date now explains correct recovery action',async()=>{const f=await fixture();const r=await f.http(new Request('https://test.invalid/api/admin/saas/subscriptions/1/status',{method:'POST',headers:{'content-type':'application/json'},body:'{"status":"trialing"}'}));assert.equal(r.status,409);assert.match((await r.json()).error,/ต่อทดลองใช้/);});
test('expired INVITE remains expired even after subscription extension',async()=>{const f=await fixture();await f.extend();f.db.sqlite.exec("UPDATE employee_invites SET expires_at='2026-10-01T00:00:00Z'");const r=await f.ctx.worker.fetch(f.inviteRequest(),f.env,{});assert.equal(r.status,410);const p=await f.ctx.worker.fetch(f.inviteRequest('POST'),f.env,{});assert.equal(p.status,410);assert.equal(f.db.count('employees'),0);});
test('invalid token does not expose subscription or create any employee',async()=>{const f=await fixture();const r=await f.ctx.worker.fetch(new Request('https://test.invalid/api/public/invites/'+'z'.repeat(36)),f.env,{});const d=await r.json();assert.equal(r.status,404);assert.equal(d.enrollment,undefined);assert.equal(f.db.count('employees'),0);});
test('active paid plan remains unaffected despite old trial expiry',async()=>{const f=await fixture();f.db.sqlite.exec("UPDATE company_subscriptions SET plan_id=(SELECT id FROM subscription_plans WHERE code='business'),status='active' WHERE client_id=1");const before=f.db.sub();assert.equal((await f.run('getEmployeeEnrollmentStatus',f.db,1)).allowed,true);assert.deepEqual(f.db.sub(),before);});
