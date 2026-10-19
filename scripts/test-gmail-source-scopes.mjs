import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync('src/index.js','utf8');
const start=source.indexOf('const RECRUITMENT_SCOPE_MODES=');
const end=source.indexOf('function publicRecruitmentInboxAccount(',start);
assert.ok(start>0&&end>start,'Gmail scope helpers must exist');
const sourceFns=source.slice(start,end);
const sandbox={SCHEMA_READY:new Set(),RECRUITMENT_MULTI_DEFAULT_QUERY:'newer_than:30d {สมัครงาน resume}',ensureRecruitmentMultiGmailReady:async()=>{},parseEmailIdentity(s){return {email:String(s).match(/<([^>]+)>/)?.[1]||String(s)};},gmailHeader(msg,key){return msg.headers?.[key]||'';}};
vm.createContext(sandbox);
vm.runInContext(sourceFns,sandbox);
function norm(payload){return vm.runInContext('normalizeRecruitmentSourceScope',sandbox)(payload)}
function q(payload){return vm.runInContext('recruitmentAccountSearchQuery',sandbox)(payload)}
function allow(payload,msg){return vm.runInContext('recruitmentSourceAcceptsMessage',sandbox)(payload,msg)}
assert.equal(q({scope_mode:'recipient',scope_value:'jobs@company.com',scope_days:30}),'newer_than:30d -category:promotions -category:social to:jobs@company.com');
assert.ok(q({scope_mode:'sender',scope_value:'@jobthai.com,jobs@example.com',scope_days:90}).includes('{from:@jobthai.com from:jobs@example.com}'));
assert.ok(q({scope_mode:'label',scope_value:'Hiring',scope_days:7}).includes('label:"Hiring"'));
assert.equal(q({scope_mode:'query',query:'after:2026/01/01 to:jobs@company.com'}),'after:2026/01/01 to:jobs@company.com');
assert.equal(allow({scope_mode:'recipient',scope_value:'jobs@company.com'},{headers:{To:'John <jobs@company.com>',From:'newsletter@example.com'}}),true);
assert.equal(allow({scope_mode:'recipient',scope_value:'jobs@company.com'},{headers:{To:'private@company.com',From:'newsletter@example.com'}}),false);
assert.equal(allow({scope_mode:'sender',scope_value:'@jobthai.com'},{headers:{From:'Jobs <jobs@mail.jobthai.com>'}}),true);
assert.equal(allow({scope_mode:'sender',scope_value:'@jobthai.com'},{headers:{From:'Jobs <spam@other.com>'}}),false);
assert.equal(norm({mode:'recipient',value:'Jobs@Company.com, hr@company.com',days:30}).value,'jobs@company.com,hr@company.com');
for(const payload of [{mode:'recipient',value:'bad',days:30},{mode:'sender',value:'evil OR from:anything',days:30},{mode:'label',value:'"bad"',days:30},{mode:'all',days:30},{mode:'recipient',value:'jobs@company.com',days:666}]){
  assert.throws(()=>norm(payload));
}
assert.equal(norm({mode:'all',days:30,confirm_all:true}).mode,'all');
console.log('✅ Gmail source scope logic: 14 cases passed');
