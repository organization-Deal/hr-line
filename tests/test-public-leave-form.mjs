import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import vm from 'node:vm';

const input=process.argv[2] || 'src/index.js';
const source=readFileSync(input,'utf8');
const slice=(begin,end)=>{
  const start=source.indexOf(begin),finish=source.indexOf(end,start+begin.length);
  assert.ok(start>=0&&finish>start,`Missing function between ${begin} and ${end}`);
  return source.slice(start,finish);
};

const db=new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE clients(id INTEGER PRIMARY KEY,name TEXT,lock_leave_during_probation INTEGER);
  CREATE TABLE employees(id INTEGER PRIMARY KEY,client_id INTEGER,status TEXT,people_status TEXT,first_name TEXT,last_name TEXT,nickname TEXT,employee_code TEXT,leave_approver_employee_id INTEGER,leave_access_override INTEGER,probation_end_date TEXT,confirmed_at TEXT);
  CREATE TABLE leave_policies(id INTEGER PRIMARY KEY,client_id INTEGER,is_active INTEGER,sort_order INTEGER,name TEXT,code TEXT,is_unlimited INTEGER,default_entitlement_days REAL,requires_reason INTEGER,evidence_required_after_days REAL,notice_days INTEGER,allow_negative INTEGER,available_during_probation INTEGER);
  CREATE TABLE employee_leave_entitlements(employee_id INTEGER,leave_policy_id INTEGER,year INTEGER,entitlement_days REAL,adjustment_days REAL,note TEXT);
  CREATE TABLE leave_requests(id INTEGER PRIMARY KEY,employee_id INTEGER,policy_id INTEGER,status TEXT,duration_days REAL,start_date TEXT);
  CREATE TABLE leave_approval_events(id INTEGER PRIMARY KEY,leave_request_id INTEGER,action TEXT,created_at TEXT);
  INSERT INTO clients VALUES(5,'NAKNA Test',1);
  INSERT INTO employees VALUES(1,5,'active','employee','Anna','Demo','A','EMP-001',2,NULL,NULL,NULL);
  INSERT INTO employees VALUES(2,5,'active','employee','Manager','Demo','M','EMP-002',NULL,NULL,NULL,NULL);
  INSERT INTO leave_policies VALUES(11,5,1,10,'ลาป่วย','sick',0,30,1,3,0,0,1);
  INSERT INTO leave_policies VALUES(12,5,1,20,'ลาพักร้อน','annual',0,6,1,NULL,0,0,0);
  INSERT INTO leave_requests VALUES(100,1,11,'approved',2,'2026-10-05');
  INSERT INTO leave_requests VALUES(101,1,11,'pending',0.5,'2026-10-14');
  INSERT INTO leave_requests VALUES(102,1,11,'rejected',3,'2026-10-01');
  INSERT INTO employee_leave_entitlements VALUES(1,12,2026,7,1,'manual leave quota');
`);
const d1={prepare(sql){const st=db.prepare(sql);return {bind(...params){return {all:async()=>({results:st.all(Object.fromEntries(params.map((v,i)=>[String(i+1),v])))}),first:async()=>st.get(Object.fromEntries(params.map((v,i)=>[String(i+1),v]))),run:async()=>st.run(Object.fromEntries(params.map((v,i)=>[String(i+1),v])))}}}}};

// Reproduce the original source bug, rather than just testing a synthetic typo.
const legacySql=readFileSync(new URL('./legacy-profile-sql.txt',import.meta.url),'utf8');
assert.throws(()=>db.prepare(legacySql).get({'1':1,'2':5}),/no such column: (?:dec|du|l)\./);
console.log('PASS 1 original P9.40 SQL reproduces undefined alias error');

const sandbox={
  leaveChannel:async()=>({hr_only:false}),
  getClient:async(db,id)=>({id,lock_leave_during_probation:1}),
  ensureDefaultLeavePolicies:async()=>{},
  ensureLeaveRetroSchemaReady:async()=>({ok:true}),
  getEmployeePortalAccess:async()=>({client_id:5,employee_id:1,first_name:'Anna',last_name:'Demo',nickname:'A',employee_code:'EMP-001',company_name:'NAKNA Test'}),
  dateInBangkok:()=> '2026-10-14',
  httpError:(message,status)=>Object.assign(new Error(message),{status}),
  num:v=>Number(v||0),
  json:(result,status=200)=>({status,result}),
  Boolean,Number,String,Promise
};
vm.createContext(sandbox);
vm.runInContext([
  slice('async function leaveEligibility(', 'async function getEmployeeLeaveProfile('),
  slice('async function getEmployeeLeaveProfile(', 'async function resolveLeavePolicy('),
  slice('async function getPublicLeaveForm(', 'async function submitPublicLeaveForm('),
].join('\n'), sandbox);
const profile=await sandbox.getEmployeeLeaveProfile(d1,1,5,2026);
assert.equal(profile.employee.id,1);
assert.equal(profile.employee.approver_nickname,'M');
assert.equal(profile.balances.length,2);
const sick=profile.balances.find(x=>x.code==='sick');
assert.equal(sick.used_days,2);
assert.equal(sick.pending_days,0.5);
assert.equal(sick.remaining_days,27.5);
assert.equal(sick.available_now,true);
console.log('PASS 2 employee profile/approver name and approved-pending leave balances');
const annual=profile.balances.find(x=>x.code==='annual');
assert.equal(annual.entitlement_days,7);
assert.equal(annual.adjustment_days,1);
assert.equal(annual.remaining_days,8);
console.log('PASS 3 override entitlement and adjustment unaffected');
const response=await sandbox.getPublicLeaveForm({DB:d1},'test-token-without-real-credentials');
assert.equal(response.status,200);
assert.equal(response.result.ok,true);
assert.equal(response.result.employee.employee_code,'EMP-001');
assert.equal(response.result.policies.length,2);
assert.equal(response.result.policies.find(x=>x.code==='sick').remaining_days,27.5);
console.log('PASS 4 GET public leave form with live SELECT, mocked token, no 500');
db.exec('UPDATE employees SET leave_approver_employee_id=NULL WHERE id=1');
const withoutApprover=await sandbox.getEmployeeLeaveProfile(d1,1,5,2026);
assert.equal(withoutApprover.employee.approver_nickname,null);
console.log('PASS 5 employee without preselected leave approver is supported');
db.exec("UPDATE employees SET people_status='probation', leave_access_override=NULL WHERE id=1");
const probation=await sandbox.getEmployeeLeaveProfile(d1,1,5,2026);
assert.equal(probation.balances.find(x=>x.code==='annual').available_now,false);
assert.equal(probation.balances.find(x=>x.code==='sick').available_now,true);
console.log('PASS 6 probation restrictions and sick leave exception remain');
db.exec('UPDATE employees SET leave_access_override=1 WHERE id=1');
const override=await sandbox.getEmployeeLeaveProfile(d1,1,5,2026);
assert.equal(override.balances.every(x=>x.available_now),true);
console.log('PASS 7 HR-granted individual leave access override remains');
db.exec('UPDATE employees SET leave_access_override=0 WHERE id=1');
const explicitlyLocked=await sandbox.getEmployeeLeaveProfile(d1,1,5,2026);
assert.equal(explicitlyLocked.balances.every(x=>!x.available_now),true);
assert.match(explicitlyLocked.balances[0].locked_reason,/ล็อกสิทธิ์/);
const blockedForm=await sandbox.getPublicLeaveForm({DB:d1},'test-token-without-real-credentials');
assert.equal(blockedForm.result.policies.find(x=>x.code==='sick').available_now,false);
assert.match(blockedForm.result.policies.find(x=>x.code==='sick').lock_reason,/ล็อกสิทธิ์/);
console.log('PASS 8 explicit HR lock 0 still blocks and displays correct reason');
sandbox.getEmployeePortalAccess=async()=>null;
const expired=await sandbox.getPublicLeaveForm({DB:d1},'expired-token');
assert.equal(expired.status,401);
console.log('PASS 9 expired token receives 401 instead of revealing employee data');
console.log('ALL 9 CASES PASS');
