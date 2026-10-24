import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import fs from 'node:fs';
import {invitePayrollFields} from '../public/invite-payroll-fields.js';
assert.equal(invitePayrollFields({}).hasBank,false);
assert.throws(()=>invitePayrollFields({national_id:'123'}),/13/);
assert.throws(()=>invitePayrollFields({bank_name:'ธนาคาร'}),/ให้ครบ/);
assert.throws(()=>invitePayrollFields({bank_name:'ธนาคาร',bank_account_name:'ทดสอบ',bank_account_no:'abc123'}),/6–20/);
const fields=invitePayrollFields({national_id:'0-1234-56789-01-2',bank_name:' ธนาคารทดสอบ ',bank_account_name:'สมชาย ทดสอบ',bank_account_no:'001-234-5678',base_salary:999999});assert.equal(fields.national_id,'0123456789012');assert.equal(fields.bank_account_no,'0012345678');assert.ok(!('base_salary'in fields));
const dbsql=new DatabaseSync(':memory:');dbsql.exec(`CREATE TABLE employees(id INTEGER PRIMARY KEY,client_id,employee_code,first_name,last_name,nickname,email,phone,birth_date,start_date,department_id,position_id,employment_type,status,people_status,onboarding_source,emergency_contact_name,emergency_contact_phone,national_id,UNIQUE(client_id,employee_code));CREATE TABLE employee_payroll_profiles(client_id,employee_id UNIQUE,bank_name,bank_account_name,bank_account_no,effective_from,base_salary DEFAULT 0);`);
let fail=false;const db={prepare(sql){let args=[];return{bind(...a){args=a;return this},run(){if(fail&&sql.includes('INSERT INTO employee_payroll_profiles'))throw Error('bank save failed');const r=dbsql.prepare(sql).run(...args);return{meta:{last_row_id:Number(r.lastInsertRowid)}}}}},async batch(writes){dbsql.exec('BEGIN');try{const results=writes.map(w=>w.run());dbsql.exec('COMMIT');return results;}catch(e){dbsql.exec('ROLLBACK');throw e;}}};
const src=fs.readFileSync('src/index.js','utf8');const start=src.indexOf('    const employeeInsert =',src.indexOf('async function acceptPublicInvite'));const end=src.indexOf('\n  } catch (error)',start);const code=src.slice(start,end);
async function save(employeeCode,payrollFields){const ctx=vm.createContext({env:{DB:db},invite:{client_id:1},employeeCode,payrollFields,firstName:'สมชาย',lastName:'ทดสอบ',nickname:'',email:'',phone:'0812345678',birthDate:null,startDate:'2026-10-24',body:{},result:null});await vm.runInContext('(async()=>{'+code+'})()',ctx);return ctx.result;}
assert.equal((await save('E1',fields)).meta.last_row_id,1);assert.equal(dbsql.prepare('SELECT national_id FROM employees WHERE id=1').get().national_id,'0123456789012');const profile=dbsql.prepare('SELECT * FROM employee_payroll_profiles').get();assert.equal(profile.bank_account_no,'0012345678');assert.equal(profile.base_salary,0);await save('E2',invitePayrollFields({}));assert.equal(dbsql.prepare('SELECT COUNT(*) n FROM employee_payroll_profiles').get().n,1);fail=true;await assert.rejects(save('E3',fields),/bank save failed/);assert.equal(dbsql.prepare("SELECT COUNT(*) n FROM employees WHERE employee_code='E3'").get().n,0);
const html=fs.readFileSync('public/invite.html','utf8');for(const name of ['national_id','bank_name','bank_account_name','bank_account_no'])assert.ok(html.includes(`name="${name}"`));assert.ok(!html.includes('name="base_salary"'));
console.log('PASS invite fields: optional/partial/invalid, leading zero, salary excluded, actual SQLite insert+profile, atomic rollback and form bindings');
