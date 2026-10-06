// P9.30 regression copy of P9.28 suite; ONLY release-label expectation updated.
// Runs without npm packages on Node 22+ (uses the built-in SQLite test adapter).
// No network calls, real credentials, or production records are used.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const workerPath=new URL('../src/index.js',import.meta.url);
const source=fs.readFileSync(workerPath,'utf8');

class D1Fixture {
  constructor(){this.sqlite=new DatabaseSync(':memory:');}
  prepare(sql){
    const db=this;
    function bound(values=[]){
      function execute(method){
        const params=[];
        const text=sql.replace(/\?(\d+)/g,(_m,i)=>{params.push(values[Number(i)-1]);return '?';});
        const statement=db.sqlite.prepare(text);
        return statement[method](...(params.length?params:values));
      }
      return {
        bind:(...values)=>bound(values),
        all:async()=>({results:execute('all')}),
        first:async()=>execute('get')||null,
        run:async()=>{const r=execute('run');return {success:true,meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};}
      };
    }
    return bound();
  }
  async batch(statements){return Promise.all(statements.map(s=>s.all()));}
}
function fixture({input=source,full=false}={}){
  const db=new D1Fixture();
  db.sqlite.exec(`
    CREATE TABLE clients(id INTEGER PRIMARY KEY,name TEXT,code TEXT);
    CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,name TEXT,status TEXT,line_user_id TEXT,line_provider_scope TEXT);
    CREATE TABLE company_members(id INTEGER PRIMARY KEY,client_id INTEGER,user_id INTEGER,role TEXT,status TEXT);
    CREATE TABLE employees(id INTEGER PRIMARY KEY,client_id INTEGER,first_name TEXT,last_name TEXT,nickname TEXT,email TEXT,line_user_id TEXT,line_provider_scope TEXT,department_id INTEGER,position_id INTEGER,status TEXT);
    CREATE TABLE departments(id INTEGER PRIMARY KEY,client_id INTEGER,name TEXT,code TEXT);
    CREATE TABLE positions(id INTEGER PRIMARY KEY,client_id INTEGER,name TEXT);
    CREATE TABLE employee_permissions(client_id INTEGER,employee_id INTEGER,permission_key TEXT);
    CREATE TABLE attendance(id INTEGER PRIMARY KEY);
    INSERT INTO clients VALUES(1,'บริษัทตัวอย่าง A','A'),(2,'บริษัทตัวอย่าง B','B');
    INSERT INTO users VALUES(1,'owner@example.test','Owner A','active','U1','default'),(2,'coowner@example.test','Co-Owner A','active','U2','default');
    INSERT INTO company_members VALUES(1,1,1,'owner','active'),(2,1,2,'co_owner','active');
  `);
  if(full)db.sqlite.exec(`
    INSERT INTO users VALUES
      (3,'hr@example.test','HR','active','U3','default'),(4,'manager@example.test','Manager','active','U4','default'),
      (5,'payroll@example.test','Payroll','active','U5','default'),(6,'staff@example.test','Staff','active','U6','default'),
      (7,'inactive@example.test','Inactive','inactive','U7','default'),(8,'former@example.test','Former','active','U8','default'),
      (9,'other@example.test','Other Company','active','U9','default'),(10,'canonical@example.test','Canonical Owner','active',NULL,'default'),
      (15,'other-scope@example.test','HR Other Scope','active','U3','integration:77');
    INSERT INTO company_members VALUES
      (3,1,3,'hr_admin','active'),(4,1,4,'manager','active'),(5,1,5,'payroll_admin','active'),(6,1,6,'employee','active'),
      (7,1,7,'hr','active'),(8,1,8,'hr','inactive'),(9,2,9,'hr_admin','active'),(10,1,10,'co_owner','active'),(15,1,15,'hr','active');
    INSERT INTO departments VALUES(1,1,'HR','HR'),(2,1,'Sales','SALES');
    INSERT INTO positions VALUES(1,1,'HR'),(2,1,'Christian Relations');
    INSERT INTO employees VALUES
      (3,1,'HR','Staff','HR','hr@example.test','U3','default',1,1,'active'),
      (6,1,'Employee','Staff','Staff','staff@example.test','U6','default',2,NULL,'active'),
      (10,1,'Canonical','Owner','Canonical','canonical@example.test','U10','default',2,NULL,'active'),
      (11,1,'Legacy','HR','Legacy',NULL,'U11','default',1,NULL,'active'),
      (12,1,'Delegate','HR','Delegate',NULL,'U12','default',2,NULL,'active'),
      (13,1,'Inactive','HR','Inactive',NULL,'U13','default',1,NULL,'inactive'),
      (14,1,'Blank','HR','Blank',NULL,'  ','default',1,NULL,'active'),
      (16,1,'Title','Staff','Title',NULL,'U16','default',2,2,'active');
    INSERT INTO employee_permissions VALUES(1,12,'hr_request.approve');
  `);
  let now=Date.parse('2026-10-05T06:21:00Z');
  class FixedDate extends Date{
    constructor(...args){super(...(args.length?args:[now]));}
    static now(){return now;}
  }
  const calls=[],logs=[];
  const f={db,calls,logs,setNow(value){now=Date.parse(value);},fetch:async()=>new Response('{}',{status:200})};
  const context=vm.createContext({
    Date:FixedDate,crypto:webcrypto,URL,URLSearchParams,TextEncoder,TextDecoder,Response,Request,Headers,AbortController,
    setTimeout,clearTimeout,structuredClone,Buffer,atob,btoa,
    console:{log:(...x)=>logs.push(x.join(' ')),warn:(...x)=>logs.push(x.join(' ')),error:(...x)=>logs.push(x.join(' '))},
    fetch:async(url,options)=>{const call={url,options,body:JSON.parse(options.body||'{}')};calls.push(call);return f.fetch(call);}
  });
  let script=input.replace(/^import .*;\r?\n/gm,'').replace('export default {','globalThis.worker = {');
  vm.runInContext(script,context,{filename:'worker-under-test.js'});
  vm.runInContext(`
    getDashboard=async(_db,cid)=>({client:{id:cid},today:bangkokClock().date,
      summary:{employees:4,scheduled_today:4,scheduled_present:2,missing:1,leave:1,late:1},
      attention:[{key:'leave_pending',count:2},{key:'request',count:1}],
      missing_employees:[{name:'พนักงานตัวอย่าง'}],hr_cases_open:7,
      documents:{pending_hr_sign:1,pending_employee_sign:2}});
    runWellnessReminderAutomation=async()=>({});
    runWellnessTestAutomation=async()=>({});
  `,context);
  f.context=context;
  f.env={DB:db,LINE_CHANNEL_ACCESS_TOKEN:'TEST-ONLY-NOT-A-REAL-TOKEN'};
  f.run=(name,...args)=>context[name](...args);
  f.pushes=()=>calls.filter(c=>c.url.endsWith('/push'));
  f.replies=()=>calls.filter(c=>c.url.endsWith('/reply'));
  f.rows=()=>db.sqlite.prepare('SELECT * FROM hr_daily_status_deliveries ORDER BY client_id,line_user_id').all();
  return f;
}
function event(text='สรุป HR วันนี้',id='U2',type='user'){
  return {type:'message',source:{type,userId:id},replyToken:'FAKE-REPLY-TOKEN',message:{type:'text',text}};
}
const lineCtx={accessToken:'TEST-ONLY',providerScope:'default',clientId:null};

test('original P9.27 reproduces the undefined helper runtime failure',{
  skip:!process.env.P927_SOURCE||!fs.existsSync(process.env.P927_SOURCE)
},async()=>{
  const f=fixture({input:fs.readFileSync(process.env.P927_SOURCE,'utf8')});
  f.setNow('2026-10-05T06:00:00Z');
  await assert.rejects(()=>f.run('sendDailyHrStatusSummary',f.env),/ensureAttendanceRetroRequestsReady is not defined/);
  assert.equal(f.calls.length,0);
});

test('role recipients include account-only Owner/Co-Owner, canonical accounts and deduplicate HR',async()=>{
  const f=fixture({full:true});
  const r=await f.run('getDailyHrLineRecipients',f.db,1);
  assert.deepEqual(Array.from(r,x=>`${x.line_provider_scope}:${x.line_user_id}`).sort(),
    ['default:U1','default:U2','default:U3','default:U10','default:U11','default:U12','integration:77:U3'].sort());
  assert.equal(r.find(x=>x.line_user_id==='U10').role,'co_owner');
  assert.equal(r.find(x=>x.line_user_id==='U11').can_private,false);
  assert.equal(r.find(x=>x.line_user_id==='U3'&&x.line_provider_scope==='default').can_private,true);
});

test('window uses Bangkok time, includes 13:00/13:21/17:59 and excludes 12:59/18:00',()=>{
  const f=fixture();
  for(const time of ['13:00','13:21','17:59'])assert.equal(f.run('isDailyHrSummaryDue',{time}),true);
  for(const time of ['00:00','12:59','18:00','23:59'])assert.equal(f.run('isDailyHrSummaryDue',{time}),false);
  assert.equal(f.run('bangkokClock',new Date('2026-10-05T06:00:00Z')).time,'13:00');
});

test('real scheduler path at 13:21 creates real SQLite tables and sends once per recipient',async()=>{
  const f=fixture();
  await f.context.worker.scheduled({cron:'* * * * *',scheduledTime:Date.parse('2026-10-05T06:20:00Z')},f.env,{});
  assert.equal(f.pushes().length,2);
  assert.equal(f.rows().every(r=>r.status==='accepted'),true);
  assert.match(JSON.stringify(f.pushes()[0].body),/ข้อมูล ณ 13:21/);
  const runtime=f.db.sqlite.prepare("SELECT value_json FROM hr_daily_status_runtime WHERE runtime_key='scheduler'").get();
  assert.equal(JSON.parse(runtime.value_json).scheduled_at,'2026-10-05T06:20:00.000Z');
  await f.context.worker.scheduled({cron:'* * * * *'},f.env,{});
  assert.equal(f.pushes().length,2);
  assert.equal(f.logs.some(s=>s.includes('is not defined')),false);
});

test('cron heartbeat before send time has no outgoing message',async()=>{
  const f=fixture();f.setNow('2026-10-05T05:59:00Z');
  await f.run('runDailyHrStatusTick',f.env,{cron:'* * * * *'});
  assert.equal(f.calls.length,0);
  const d=await f.run('getDailyHrSummaryDiagnostics',f.env,1);
  assert.ok(d.scheduler.last_seen_at);assert.equal(d.accepted,0);
});

test('concurrent invocations claim each recipient only once',async()=>{
  const f=fixture();
  // Ensure schema once, just as a deployed database after the first request.
  await f.run('ensureDailyHrStatusReady',f.db);
  await Promise.all([f.run('sendDailyHrStatusSummary',f.env),f.run('sendDailyHrStatusSummary',f.env)]);
  assert.equal(f.pushes().length,2);assert.equal(f.rows().length,2);
});

test('partial failure retries only failed recipient with SAME retry key and SAME payload',async()=>{
  const f=fixture();let first=true;
  f.fetch=async c=>{
    if(c.body.to==='U2'&&first){first=false;return new Response('{}',{status:503});}
    return new Response('{}',{status:200});
  };
  await f.run('sendDailyHrStatusSummary',f.env);
  assert.deepEqual(f.rows().map(x=>x.status),['accepted','retry']);
  const original=f.pushes().find(c=>c.body.to==='U2');
  await f.run('sendDailyHrStatusSummary',f.env);
  assert.equal(f.pushes().length,2);
  f.setNow('2026-10-05T06:22:01Z');
  await f.run('sendDailyHrStatusSummary',f.env);
  assert.equal(f.pushes().length,3);
  assert.equal(f.pushes()[2].options.headers['X-Line-Retry-Key'],original.options.headers['X-Line-Retry-Key']);
  assert.equal(f.pushes()[2].options.body,original.options.body);
  assert.equal(f.rows().every(r=>r.status==='accepted'),true);
});

test('HTTP 401 is not recorded as accepted and is not automatically retried',async()=>{
  const f=fixture();f.fetch=async()=>new Response('{}',{status:401});
  await f.run('sendDailyHrStatusSummary',f.env);
  assert.equal(f.rows().every(r=>r.status==='failed'&&r.http_status===401),true);
  f.setNow('2026-10-05T06:40:00Z');await f.run('sendDailyHrStatusSummary',f.env);
  assert.equal(f.pushes().length,2);
  const r=(await f.run('getDailyHrLineRecipients',f.db,1))[1];
  const d=await f.run('getDailyHrSummaryDiagnostics',f.env,1,r);
  assert.equal(d.me.error,'LINE_HTTP_401');assert.equal(d.accepted,0);
  assert.equal(JSON.stringify(d).includes('U2'),false);
  assert.equal(f.logs.some(x=>x.includes('TEST-ONLY-NOT-A-REAL-TOKEN')),false);
});

test('409 with accepted-request-id means accepted, plain 409 does not',async()=>{
  for(const hasAcceptedId of [true,false]){
    const f=fixture();
    f.fetch=async()=>new Response('{}',{status:409,headers:hasAcceptedId?{'x-line-accepted-request-id':'fake-accepted-id'}:{}});
    await f.run('sendDailyHrStatusSummary',f.env);
    assert.equal(f.rows().every(r=>r.status===(hasAcceptedId?'accepted':'failed')),true);
  }
});

test('network timeout path retains retries; no actual outbound network is used',async()=>{
  const f=fixture();f.fetch=async()=>{throw new Error('network down');};
  await f.run('sendDailyHrStatusSummary',f.env);
  assert.equal(f.rows().every(r=>r.status==='retry'&&r.last_error==='LINE_NETWORK_ERROR'),true);
});

test('missing token is visible without an HTTP request or a false success',async()=>{
  const f=fixture();delete f.env.LINE_CHANNEL_ACCESS_TOKEN;
  await f.run('sendDailyHrStatusSummary',f.env);
  assert.equal(f.calls.length,0);
  assert.equal(f.rows().every(r=>r.status==='retry'&&r.last_error==='LINE_TOKEN_MISSING'),true);
});

test('lease expiry recovers worker crashes with the same stored retry key',async()=>{
  const f=fixture();f.fetch=async()=>new Response('{}',{status:500});
  await f.run('sendDailyHrStatusSummary',f.env);
  const key=f.rows()[0].retry_key;
  f.db.sqlite.exec("UPDATE hr_daily_status_deliveries SET status='sending',lease_until=0,next_attempt_at=0 WHERE line_user_id='U1'");
  f.fetch=async()=>new Response('{}',{status:200});
  await f.run('sendDailyHrStatusSummary',f.env);
  assert.equal(f.pushes().filter(c=>c.body.to==='U1').length,2);
  assert.equal(f.pushes().at(-1).options.headers['X-Line-Retry-Key'],key);
});

test('permission revocation prevents pending retry; ordinary employees get no summary access',async()=>{
  const f=fixture({full:true});
  assert.equal((await f.run('resolveDailyHrLineAccess',f.db,lineCtx,'U6')).length,0);
  assert.equal((await f.run('resolveDailyHrLineAccess',f.db,lineCtx,'U4')).length,0);
  assert.equal((await f.run('resolveDailyHrLineAccess',f.db,lineCtx,'U2',2)).length,0);
  assert.equal((await f.run('resolveDailyHrLineAccess',f.db,{...lineCtx,clientId:2},'U2',1)).length,0);
  assert.equal((await f.run('resolveDailyHrLineAccess',f.db,{...lineCtx,providerScope:'integration:99'},'U2')).length,0);
  f.db.sqlite.exec("UPDATE company_members SET status='inactive' WHERE user_id=2");
  assert.equal((await f.run('resolveDailyHrLineAccess',f.db,lineCtx,'U2')).length,0);
});

test('manual Thai command replies only to authorized user and does not mark cron success',async()=>{
  const f=fixture();
  await f.context.processLineEvent(event(),f.env,lineCtx);
  assert.equal(f.replies().length,1);assert.equal(f.pushes().length,0);
  assert.match(JSON.stringify(f.replies()[0].body),/สรุปทีมวันนี้/);
  assert.match(JSON.stringify(f.replies()[0].body),/ไม่ใช่การยืนยันว่ารอบส่งอัตโนมัติทำงานแล้ว/);
  const d=await f.run('getDailyHrSummaryDiagnostics',f.env,1);
  assert.equal(d.accepted,0);assert.equal(f.rows().length,0);
});

test('manual command in group chat never reveals employee summary',async()=>{
  const f=fixture();await f.context.processLineEvent(event('สรุป HR วันนี้','U2','group'),f.env,lineCtx);
  assert.equal(f.replies().length,1);
  assert.match(JSON.stringify(f.replies()[0].body),/เปิดในแชตส่วนตัว/);
  assert.equal(JSON.stringify(f.replies()[0].body).includes('พนักงานตัวอย่าง'),false);
});

test('daily status command displays missing heartbeat and actual runtime version',async()=>{
  const f=fixture();await f.context.processLineEvent(event('สถานะสรุป HR'),f.env,lineCtx);
  const text=JSON.stringify(f.replies()[0].body);
  assert.match(text,/ยังไม่พบการทำงานของ Cron/);
  assert.ok(text.includes(source.match(/const NAKNA_RUNTIME_RELEASE = '([^']+)'/)[1]));
});

test('forged postback cannot select an unrelated company',async()=>{
  const f=fixture();
  await f.context.processLineEvent({type:'postback',source:{type:'user',userId:'U2'},replyToken:'fake',
    postback:{data:'action=hr_daily_summary&client_id=2'}},f.env,lineCtx);
  assert.match(JSON.stringify(f.replies().at(-1).body),/ยังไม่มีสิทธิ์รับสรุป HR/);
  assert.equal(JSON.stringify(f.replies().at(-1).body).includes('พนักงานตัวอย่าง'),false);
});

test('multiple authorized companies require selection rather than guessing',async()=>{
  const f=fixture();f.db.sqlite.exec("INSERT INTO company_members VALUES(3,2,2,'hr','active')");
  await f.context.processLineEvent(event(),f.env,lineCtx);
  assert.match(JSON.stringify(f.replies().at(-1).body),/ต้องการดูบริษัทไหน/);
  assert.equal(f.pushes().length,0);
});

test('private HR case counts are hidden from department-only delegate',async()=>{
  const f=fixture({full:true});await f.context.processLineEvent(event('สรุป HR วันนี้','U11'),f.env,lineCtx);
  const text=JSON.stringify(f.replies().at(-1).body);
  assert.equal(text.includes('แจ้งเรื่องส่วนตัวถึง HR'),false);
  assert.match(text,/ไม่รวมเรื่องส่วนตัวที่ต้องใช้สิทธิ์ผู้ดูแล HR/);
});

test('failed company does not stop another company from receiving its own summary',async()=>{
  const f=fixture();f.db.sqlite.exec("INSERT INTO users VALUES(3,'b@example.test','HR B','active','U3','default');INSERT INTO company_members VALUES(3,2,3,'hr','active')");
  vm.runInContext('const savedDashboard=getDashboard;getDashboard=async(db,id,options)=>{if(id===1)throw new Error("fixture fail");return savedDashboard(db,id,options)};',f.context);
  const result=await f.run('sendDailyHrStatusSummary',f.env);
  assert.equal(result.sent,1);assert.equal(f.pushes()[0].body.to,'U3');
  const d=await f.run('getDailyHrSummaryDiagnostics',f.env,1);assert.equal(d.last_run.error,'SUMMARY_BUILD_FAILED');
});

test('new calendar day sends a new round; prior P9.27 aggregate does not exclude new Owner recipients',async()=>{
  const f=fixture();await f.run('ensureDailyHrStatusReady',f.db);
  f.db.sqlite.exec("INSERT INTO hr_daily_status_logs(client_id,summary_date,summary_time,recipient_count) VALUES(1,'2026-10-05','13:00',1)");
  await f.run('sendDailyHrStatusSummary',f.env);assert.equal(f.pushes().length,2);
  f.setNow('2026-10-06T06:00:00Z');await f.run('sendDailyHrStatusSummary',f.env);
  assert.equal(f.pushes().length,4);assert.equal(f.rows().length,4);
});

test('authenticated diagnostics API rejects employee role; HR response contains no raw identities',async()=>{
  const f=fixture();const url=new URL('https://example.test/api/hr/daily-summary/status'),request=new Request(url);
  const denied=await f.context.handleApi(request,f.env,url,{clientId:1,role:'employee'},{});
  assert.equal(denied.status,403);
  const allowed=await f.context.handleApi(request,f.env,url,{clientId:1,role:'co_owner'},{});
  assert.equal(allowed.status,200);
  const data=await allowed.json();assert.equal(data.eligible,2);assert.equal(JSON.stringify(data).includes('U1'),false);
});


test('revoked Co-Owner is not retried using a queued snapshot',async()=>{
  const f=fixture();f.fetch=async c=>new Response('{}',{status:c.body.to==='U2'?503:200});
  await f.run('sendDailyHrStatusSummary',f.env);
  assert.equal(f.rows().find(r=>r.line_user_id==='U2').status,'retry');
  f.db.sqlite.exec("UPDATE company_members SET role='employee' WHERE user_id=2");
  f.setNow('2026-10-05T06:30:00Z');await f.run('sendDailyHrStatusSummary',f.env);
  assert.equal(f.pushes().length,2);
});

test('HTTP 429 is a visible failure and does not keep consuming requests',async()=>{
  const f=fixture();f.fetch=async()=>new Response('{}',{status:429});
  await f.run('sendDailyHrStatusSummary',f.env);
  f.setNow('2026-10-05T06:45:00Z');await f.run('sendDailyHrStatusSummary',f.env);
  assert.equal(f.pushes().length,2);
  assert.equal(f.rows().every(r=>r.status==='failed'&&r.http_status===429),true);
  assert.match(f.run('dailyHrErrorHint','LINE_HTTP_429'),/โควตา/);
});

test('retry limit bounds repeated server failures and marks them failed',async()=>{
  const f=fixture();f.fetch=async()=>new Response('{}',{status:503});
  for(const time of ['06:21','06:22','06:24','06:28','06:36','06:52','07:30']){
    f.setNow(`2026-10-05T${time}:01Z`);await f.run('sendDailyHrStatusSummary',f.env);
  }
  assert.equal(f.pushes().length,12);
  assert.equal(f.rows().every(r=>r.status==='failed'&&r.attempts===6),true);
});

test('no eligible recipients is reported, not silently recorded as sent',async()=>{
  const f=fixture();f.db.sqlite.exec("UPDATE company_members SET status='inactive'");
  const r=await f.run('sendDailyHrStatusSummary',f.env);
  assert.equal(r.sent,0);assert.equal(r.no_recipients,2);assert.equal(f.calls.length,0);
  const d=await f.run('getDailyHrSummaryDiagnostics',f.env,1);
  assert.equal(d.last_run.error,'NO_HR_RECIPIENTS');
});
