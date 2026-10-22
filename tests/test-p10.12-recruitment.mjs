import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const app=fs.readFileSync('public/app.js','utf8');
const start=app.indexOf('function nkScreeningGroup('),end=app.indexOf('function refreshRecruitmentScreeningBulkControls(',start);
const ctx={};vm.createContext(ctx);vm.runInContext(app.slice(start,end),ctx);
const rows=[
 {id:1,kind:'likely',subject:'สมัครงาน',source_email:'hr@test.com'},
 {id:2,kind:'noise',subject:'Google security alert',source_email:'hr@test.com'},
 {id:3,kind:'review',subject:'Canva news',source_email:'hr@test.com'},
 {id:4,kind:'likely',decision:'review',subject:'HR marked for review',source_email:'hr@test.com'},
 {id:5,kind:'likely',decision:'accepted',source_email:'hr@test.com'},
 {id:6,kind:'likely',archived_at:'2026-10-22',source_email:'hr@test.com'},
 {id:7,kind:'likely',source_email:'other@test.com'},
 {id:8,kind:'noise',decision:'rejected',source_email:'hr@test.com'},
];
const ids=(filter,source='hr@test.com')=>Array.from(ctx.nkScreeningRowsVisible(rows,filter,'',source),r=>r.id);
assert.deepEqual(ids('likely'),[1]);assert.deepEqual(ids('review'),[3,4]);assert.deepEqual(ids('noise'),[2]);
assert.deepEqual(ids('accepted'),[5]);assert.deepEqual(ids('archived'),[6]);assert.deepEqual(ids('rejected'),[8]);assert.deepEqual(ids('pending'),[1,2,3,4]);
assert.equal(ctx.nkApplicationMailQuery(90).startsWith('newer_than:90d'),true);
assert.equal(ctx.nkApplicationMailQuery(-1).startsWith('newer_than:30d'),true);
// Execute real settings handler with DOM/API doubles: no read/save without user action.
const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',checked:false,hidden:false,handlers:{},addEventListener(t,fn){this.handlers[t]=fn;},dispatchEvent(){},closest(){return {hidden:false};},focus(){this.focused=true;}});return nodes.get(id);};
node('mgmailScopeDays').value='90';node('mgmailEnabled').checked=true;node('mgmailAuto').checked=false;
const calls=[];let form;
const sandbox={$:s=>node(s.slice(1)),state:{recruitmentGmail:{accounts:[{id:1,email:'hr@test.com',scope_mode:'recipient',source_configured:true,enabled:true}]}},canManageGoogleWorkspace:()=>true,escapeHtml:s=>s||'',openPhase5Form:args=>{form=args;},Event:class{constructor(type){this.type=type;}},api:async(...a)=>{calls.push(a);return {};},refreshRecruitmentGmail:async()=>{},toast:()=>{},confirm:()=>true};
vm.createContext(sandbox);vm.runInContext(app.slice(app.indexOf('function nkApplicationMailQuery('),app.indexOf('function nkScreeningRowsVisible(')),sandbox);
const a=app.indexOf('async function handleRecruitmentGmailAccountAction('),b=app.indexOf('\nasync function ',a+10); // End is not required: declaration below handles additional helpers if present.
const next=app.indexOf('\nfunction ',a+10);const last=[b,next].filter(x=>x>a).sort((x,y)=>x-y)[0];
vm.runInContext(app.slice(a,last),sandbox);
await sandbox.handleRecruitmentGmailAccountAction({target:{closest:()=>({dataset:{id:'1',action:'settings'},disabled:false})}});
assert.ok(form.html.includes('mgmailPresetApplications'));assert.equal(calls.length,0);
node('mgmailPresetApplications').handlers.click();assert.equal(node('mgmailScopeMode').value,'query');assert.ok(node('mgmailQuery').value.includes('newer_than:90d'));assert.equal(calls.length,0);
node('mgmailPresetLabel').handlers.click();assert.equal(node('mgmailScopeMode').value,'label');assert.equal(node('mgmailScopeValue').value,'สมัครงาน');assert.equal(calls.length,0);
await form.onSave();assert.equal(calls.length,1);const payload=JSON.parse(calls[0][1].body);assert.equal(payload.scope_mode,'label');assert.equal(payload.scope_value,'สมัครงาน');assert.equal(payload.auto_sync,false);
const html=fs.readFileSync('public/index.html','utf8');assert.ok(html.includes('<option value="likely">น่าจะเป็นใบสมัคร</option>'));assert.ok(!html.includes('src="/ui/p10-8-'));assert.ok(!html.includes('src="/ui/p10-9-'));
console.log('PASS: separated queues, HR review override, source scoping, archive/accepted preservation, explicit presets and save-only PATCH');
