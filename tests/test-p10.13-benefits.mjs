import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const app=fs.readFileSync('public/app.js','utf8');
const code=app.slice(app.indexOf('let nkBenefitSelectedId='),app.indexOf('\nfunction renderAttendance()',app.indexOf('let nkBenefitSelectedId=')));
class Element{
 constructor(){this.handlers={};this.dataset={};this.innerHTML='';this.value='';this.textContent='';this.classList={toggle(){}};}
 addEventListener(t,fn){this.handlers[t]=fn;}
 removeEventListener(){}
 close(){this.closed=true;}
}
const nodes=new Map();const $=s=>{if(!nodes.has(s))nodes.set(s,new Element());return nodes.get(s);};
let role='hr',form;
let failedOnce=false;const writes=[],toasts=[];
const state={employees:[{id:1,status:'active',nickname:'A',employee_code:'E1',department_name:'Sales'},{id:2,status:'active',nickname:'B',employee_code:'E2',department_name:'HR'},{id:3,status:'inactive',nickname:'C'}],benefits:{data:[{id:10,name:'Medical <script>',status:'active',benefit_type:'medical',employer_amount:0,employee_amount:0},{id:11,name:'Insurance',status:'active'},{id:12,name:'Old',status:'inactive'}],enrollments:[{benefit_id:10,employee_id:1,status:'active',start_date:'2026-10-01'},{benefit_id:10,employee_id:2,status:'active',start_date:'2026-11-01'},{benefit_id:11,employee_id:1,status:'active',start_date:'2026-10-22',end_date:'2026-10-22'},{benefit_id:12,employee_id:3,status:'active'}]}};
const ctx={window:{},$,state,activeCompanyRole:()=>role,currentBangkokDateKey:()=> '2026-10-22',escapeHtml:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),money:v=>String(v),formatDate:v=>v,iconSvg:()=>'<svg></svg>',toast:(...args)=>toasts.push(args),openPhase5Form:f=>{form=f;$('#p7BenefitStart').value='2026-10-22';$('#p7BenefitEnd').value='';$('#p7BenefitEnrollStatus').value='active';$('#p7BenefitNote').value='';},api:async(url,args)=>{if(!args)return state.benefits;const p=JSON.parse(args.body);writes.push(p.employee_id);if(p.employee_id===2&&!failedOnce){failedOnce=true;throw new Error('Temporary failure');}return {ok:true};}};
vm.createContext(ctx);vm.runInContext(code,ctx);
assert.equal(ctx.nkBenefitCurrent({status:'active',start_date:'2026-11-01'}),false);
assert.equal(ctx.nkBenefitCurrent({status:'active',end_date:'2026-10-21'}),false);
assert.equal(ctx.nkBenefitCurrent({status:'paused'}),false);
assert.equal(ctx.nkBenefitCurrent({status:'active',start_date:'2026-10-22',end_date:'2026-10-22'}),true);
ctx.renderBenefits();
assert.ok($('#benefitSummary').innerHTML.includes('พนักงานที่มีสิทธิ์วันนี้</span><strong>1<small>คน'));
assert.ok($('#benefitProgramList').innerHTML.includes('Medical &lt;script&gt;'));
assert.ok(!$('#benefitProgramList').innerHTML.includes('Medical <script>'));
ctx.window.enrollBenefit(10);assert.equal(writes.length,0);assert.ok(form.html.includes('nkBenefitDepartment'));
$('#nkBenefitSelectVisible').onclick();assert.ok($('#nkBenefitSelectionCount').textContent.startsWith('เลือก 2 คน'));
$('#modalSave').onclick();assert.equal(writes.length,0);assert.ok($('#nkBenefitReview').innerHTML.includes('ตรวจทานก่อนบันทึก 2 คน'));
await $('#modalSave').onclick();assert.deepEqual(writes,[1,2]);assert.equal($('#modal').closed,undefined);assert.equal($('#nkBenefitBack').disabled,true);
await $('#modalSave').onclick();assert.deepEqual(writes,[1,2,2]);assert.equal($('#modal').closed,true);
role='manager';ctx.renderBenefits();assert.ok(!$('#benefitProgramList').innerHTML.includes('data-benefit-enroll'));
const before=writes.length;ctx.window.enrollBenefit(10);assert.equal(writes.length,before);assert.ok(toasts.at(-1)[0].includes('ไม่มีสิทธิ์'));
console.log('PASS benefits: date-aware counts, unique people, HTML escaping, role guard, review before save, inactive exclusion, partial failure and retry without duplicate successful writes');

role='hr';state.employees=Array.from({length:60},(_,i)=>({id:i+1,status:'active',nickname:'Staff '+i}));ctx.window.enrollBenefit(10);$('#nkBenefitSelectVisible').onclick();assert.ok($('#nkBenefitSelectionCount').textContent.startsWith('เลือก 50 คน'));console.log('PASS selection capped at 50 employees');
