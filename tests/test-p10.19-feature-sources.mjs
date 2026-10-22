import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {webcrypto} from 'node:crypto';
import {notificationFeatureData} from '../src/notification-data.js';
import {ensureNotificationCenter,runNotificationCenter,ncNormalize,ncAllowedRecipients} from '../src/notification-center.js';
import {NOTIFICATION_TYPES as types,fieldsForKind} from '../public/notification-catalog.js';
import {loadHrCardBuilder} from './hr-card-fixture.mjs';
globalThis.crypto ||= webcrypto;
const dir=mkdtempSync(join(tmpdir(),'nakna-features-')),file=join(dir,'test.db');let checks=0;const check=(v,n)=>{assert.ok(v,n);checks++;};
const py=`import sqlite3,json,sys\np=json.load(sys.stdin);c=sqlite3.connect(p['file']);c.row_factory=sqlite3.Row\nx=c.execute(p['sql'],p['args']);rows=[dict(r) for r in x.fetchall()];changes=c.execute('SELECT changes()').fetchone()[0];c.commit();print(json.dumps({'results':rows,'meta':{'changes':changes}}))`;
const db={prepare(sql){let args=[];const q={bind(...v){args=v;return q;},async run(){const r=spawnSync('python3',['-c',py],{input:JSON.stringify({file,sql,args}),encoding:'utf8'});if(r.status)throw Error(r.stderr);return JSON.parse(r.stdout);},async first(){return (await q.run()).results[0]||null;},async all(){return q.run();}};return q;}};
const run=(sql,...args)=>db.prepare(sql).bind(...args).run();
try{
for(const sql of [
'CREATE TABLE clients(id INTEGER PRIMARY KEY,name TEXT,attendance_reminder_enabled INTEGER,attendance_reminder_message TEXT)',
'CREATE TABLE employees(id INTEGER PRIMARY KEY,client_id INTEGER,status TEXT,people_status TEXT,contract_end_date TEXT,probation_end_date TEXT,confirmed_at TEXT,birth_date TEXT)',
'CREATE TABLE employee_documents(client_id INTEGER,status TEXT,expires_at TEXT)',
'CREATE TABLE learning_courses(id INTEGER,client_id INTEGER,status TEXT)',
'CREATE TABLE learning_assignments(client_id INTEGER,course_id INTEGER,employee_id INTEGER,required INTEGER,status TEXT,due_date TEXT)',
'CREATE TABLE kpi_goals(id INTEGER,client_id INTEGER,employee_id INTEGER,status TEXT,update_frequency TEXT,created_at TEXT)',
'CREATE TABLE kpi_updates(client_id INTEGER,goal_id INTEGER,update_date TEXT)',
'CREATE TABLE candidates(client_id INTEGER,stage TEXT)',
'CREATE TABLE payroll_periods(client_id INTEGER,status TEXT,pay_date TEXT)',
'CREATE TABLE company_holidays(id INTEGER,client_id INTEGER,holiday_date TEXT)'])await run(sql);
await run("INSERT INTO clients VALUES(1,'บริษัท ก',0,NULL),(2,'บริษัท ข',0,NULL)");
await run("INSERT INTO employees VALUES(1,1,'active','probation','2026-11-01','2026-10-23',NULL,'1990-10-23'),(2,1,'active','employee',NULL,NULL,NULL,'1990-10-22'),(3,1,'inactive','probation','2026-10-23','2026-10-23',NULL,'1990-10-22'),(4,2,'active','probation','2026-10-23','2026-10-23',NULL,'1990-10-22')");
await run("INSERT INTO employee_documents VALUES(1,'active','2026-10-23'),(1,'archived','2026-10-23'),(1,'active','2026-12-01'),(2,'active','2026-10-23'),(1,'active','2026-10-21')");
await run("INSERT INTO learning_courses VALUES(1,1,'published'),(2,1,'archived'),(3,2,'published')");
await run("INSERT INTO learning_assignments VALUES(1,1,1,1,'assigned','2026-10-23'),(1,1,2,1,'completed','2026-10-23'),(1,1,2,0,'assigned','2026-10-23'),(1,2,2,1,'assigned','2026-10-23'),(2,3,4,1,'assigned','2026-10-23'),(1,1,3,1,'assigned','2026-10-23')");
await run("INSERT INTO kpi_goals VALUES(1,1,1,'active','weekly','2026-10-01'),(2,1,2,'active','daily','2026-10-01'),(3,1,1,'cancelled','weekly','2026-10-01'),(4,2,4,'active','weekly','2026-10-01'),(5,1,3,'active','weekly','2026-10-01')");
await run("INSERT INTO kpi_updates VALUES(1,1,'2026-10-14'),(1,2,'2026-10-22')");
await run("INSERT INTO candidates VALUES(1,'new'),(1,'screening'),(1,'hired'),(2,'new')");
await run("INSERT INTO payroll_periods VALUES(1,'draft','2026-10-23'),(1,'published','2026-10-23'),(1,'void','2026-10-23'),(1,'draft','2026-11-30'),(2,'draft','2026-10-23')");
const expected={documents_expiring:1,contracts_expiring:1,probation_due:1,learning_due:1,kpi_stale:1,recruitment_pending:2,payroll_due:1,birthdays:1};
for(const [kind,count] of Object.entries(expected)){
 const facts=await notificationFeatureData(db,1,kind,'2026-10-22');check(facts.count===count,kind+' real count');
 check((await notificationFeatureData(db,999,kind,'2026-10-22')).count===0,kind+' tenant isolation');
 check(!types[kind].enabled&&types[kind].feature,kind+' opt-in');
 const fields=fieldsForKind(kind);check(Object.keys(facts.values).every(key=>fields.some(f=>f.key===key)),kind+' field catalog matches source');
 check(ncAllowedRecipients(kind,[{role:'hr'},{role:'manager'},{role:'hr_delegate'}]).length===1,kind+' private recipients restricted');
 const setting={enabled:true,send_time:'10:00',weekdays:[4],message_text:types[kind].text,recipient_keys:null};check(ncNormalize(kind,setting).message_text===types[kind].text,kind+' recommended template validates');
}
assert.throws(()=>ncNormalize('checkin',{enabled:true,send_time:'10:00',weekdays:[4],message_text:'{รอบเงินเดือนรอดำเนินการ}',recipient_keys:null}));checks++;
await ensureNotificationCenter(db);
for(const [kind,def] of Object.entries(types))await run('INSERT INTO notification_center_settings(client_id,kind,enabled,send_time,weekdays,message_text,recipient_keys) VALUES(1,?1,?2,?3,?4,?5,?6)',kind,def.feature?1:0,'10:00','4',def.text,'null');
const sent=[],builder=loadHrCardBuilder();
const helpers={ensureMissingCheckinReminderReady:async()=>{},ensureDailyHrStatusReady:async()=>{},ensureAttendanceRetroReady:async()=>{},getDailyHrLineRecipients:async(db,cid)=>cid===1?[{user_id:1,role:'hr',can_private:true,recipient_name:'HR',line_user_id:'U1',line_provider_scope:'default'}]:[],getAccessTokenForProviderScope:async()=> 'mock',buildFeatureNotificationFlex:builder.feature,fetcher:async(url,options)=>{sent.push(JSON.parse(options.body));return new Response('',{status:200});}};
await runNotificationCenter({DB:db},{cron:'* * * * *'},helpers,{now:new Date('2026-10-22T03:05:00Z')});check(sent.length===8,'8 sources connected to scheduled sender');
check(sent.every(x=>x.to==='U1'&&x.messages[0].contents.header),'branded cards to authorized recipient');
check(sent.every(x=>Object.keys(types).flatMap(fieldsForKind).every(f=>!JSON.stringify(x.messages).includes('{'+f.key+'}'))),'all dynamic fields replaced');
await runNotificationCenter({DB:db},{},helpers,{now:new Date('2026-10-22T03:06:00Z')});check(sent.length===8,'all new sources deduplicate');
await run('DELETE FROM employee_documents WHERE client_id=1');
await runNotificationCenter({DB:db},{},helpers,{now:new Date('2026-10-29T03:05:00Z')});
const runtime=await db.prepare("SELECT value_json FROM notification_center_runtime WHERE client_id=1 AND runtime_key='documents_expiring'").first();check(JSON.parse(runtime.value_json).reason==='NO_PENDING_TASKS','no matching facts means no notification');
await run('DROP TABLE candidates');const saved=console.error;console.error=()=>{};try{await runNotificationCenter({DB:db},{},helpers,{now:new Date('2026-10-29T03:06:00Z')});}finally{console.error=saved;}
const err=await db.prepare("SELECT value_json FROM notification_center_runtime WHERE client_id=1 AND runtime_key='recruitment_pending'").first();check(Boolean(JSON.parse(err.value_json).error),'missing source reported instead of fake zero');
console.log(`P10.19 feature notifications: ${checks} checks PASS (8 real SQLite sources; scheduler + mock LINE)`);
}finally{rmSync(dir,{recursive:true,force:true});}
