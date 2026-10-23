import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {mkdtempSync,rmSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import vm from 'node:vm';
import {companyProfileApi} from '../src/company-profile.js';
const dir=mkdtempSync(join(tmpdir(),'nk38-')),file=join(dir,'db');
const py=`import sqlite3,json,sys
p=json.load(sys.stdin);c=sqlite3.connect(p['file']);c.row_factory=sqlite3.Row
with c:
 if 'batch' in p:
  for q in p['batch']:c.execute(q['sql'],q['args'])
  result=[]
 else:result=[dict(r) for r in c.execute(p['sql'],p.get('args',[])).fetchall()]
print(json.dumps(result))`;
function execute(payload){const r=spawnSync('python3',['-c',py],{input:JSON.stringify({file,...payload}),encoding:'utf8'});if(r.status)throw Error(r.stderr);return JSON.parse(r.stdout)}
const db={prepare(sql){let args=[];return {get sql(){return sql},get args(){return args},bind(...a){args=a;return this},async first(){return execute({sql,args})[0]||null},async all(){return {results:execute({sql,args})}},async run(){return execute({sql,args})}}},async batch(q){return execute({batch:q.map(x=>({sql:x.sql,args:x.args}))})}};
const run=(sql,...args)=>db.prepare(sql).bind(...args).run(),auth={clientId:1,role:'co_owner',user:{id:9}},audits=[];
const h={ensure:async()=>{},getClient:(d,id)=>d.prepare('SELECT * FROM clients WHERE id=?1').bind(id).first(),publicProfile:c=>c,normalizeTime:x=>/^\d{2}:\d{2}$/.test(x||'')?x:null,audit:async(...x)=>audits.push(x)};
const call=(method='GET',body={},who=auth)=>companyProfileApi(new Request('https://example.test/api/company-profile',{method,...(method==='PATCH'?{body:JSON.stringify(body)}:{})}),db,who,h);
let n=0;const check=(v,msg)=>{assert(v,msg);n++};
try{
await run('CREATE TABLE clients(id INTEGER PRIMARY KEY,name TEXT,timezone TEXT,work_start TEXT,work_end TEXT,late_grace_minutes INTEGER)');await run("INSERT INTO clients VALUES(1,'Display','Asia/Bangkok','11:00','20:00',30),(2,'Other','Asia/Bangkok','09:00','18:00',10),(3,'Legacy','Asia/Bangkok','09:00','18:00',10)");
await run('CREATE TABLE company_onboarding(client_id INTEGER PRIMARY KEY,owner_user_id INTEGER,legal_name TEXT,tax_id TEXT,address TEXT,phone TEXT,province TEXT,current_step TEXT,completed_at TEXT,updated_at TEXT)');await run("INSERT INTO company_onboarding VALUES(1,8,'Old legal','1000000000009','Old address','123','Bangkok','complete','2020-01-01','2020-01-01')");
await run('CREATE TABLE company_document_settings(client_id INTEGER PRIMARY KEY,legal_name TEXT,tax_id TEXT,address TEXT,phone TEXT,signer_name TEXT,signer_signature_data_url TEXT,document_footer TEXT,updated_at TEXT)');await run("INSERT INTO company_document_settings VALUES(1,'Cached legal','1000000000009','Cached address','456','Signer','SIGNATURE','Footer','2020-01-01')");await run('CREATE TABLE company_assets(client_id INTEGER PRIMARY KEY,logo_data_url TEXT)');
let d=await (await call()).json();check(d.company.legal_name==='Cached legal'&&d.company.address==='Cached address','edit form loads same identity as document center');
const body={name:'ชื่อในระบบ',legal_name:'บริษัท ใหม่ จำกัด',tax_id:'1000000000017',address:'123 ถนนทดสอบ\nกรุงเทพมหานคร 10210',phone:'021234567',province:'กรุงเทพมหานคร',expected_company_id:1};
check((await call('PATCH',body,{...auth,role:'employee'})).status===403,'employee write denied');check((await call('PATCH',{...body,expected_company_id:2})).status===409,'wrong company request rejected');check((await call('PATCH',{...body,tax_id:'123'})).status===400,'invalid tax ID rejected');check((await call('PATCH',{...body,address:'x'.repeat(2001)})).status===400,'oversized address rejected');check((await call('PATCH',body)).status===200,'co-owner saves identity');
d=await (await call()).json();check(d.company.address===body.address&&d.company.legal_name===body.legal_name&&d.company.name===body.name,'reload returns new values');
const o=await db.prepare('SELECT * FROM company_onboarding WHERE client_id=1').first(),s=await db.prepare('SELECT * FROM company_document_settings WHERE client_id=1').first();check(o.address===s.address&&o.legal_name===s.legal_name&&o.tax_id===s.tax_id,'legacy PDF and filing readers synchronized');check(o.owner_user_id===8&&o.current_step==='complete'&&o.completed_at==='2020-01-01','onboarding progress and owner preserved');check(s.signer_signature_data_url==='SIGNATURE'&&s.signer_name==='Signer'&&s.document_footer==='Footer','signature and footer preserved');check((await db.prepare('SELECT name FROM clients WHERE id=2').first()).name==='Other','other company unchanged');
check((await call('PATCH',{name:'Rename only'})).status===200,'old partial clients supported');d=await (await call()).json();check(d.company.address===body.address&&d.company.tax_id===body.tax_id,'omitted fields preserved');
check((await call('PATCH',{address:'',tax_id:''})).status===200,'explicit optional fields can clear');d=await (await call()).json();check(d.company.address===''&&d.company.tax_id==='','old values do not reappear on clear');
check((await call('PATCH',{name:'Legacy updated',legal_name:'Legacy legal',address:'New address'},{...auth,clientId:3})).status===200,'legacy company without profile rows can save');check((await db.prepare('SELECT current_step FROM company_onboarding WHERE client_id=3').first()).current_step==='complete','legacy company not sent back to setup');check(audits.length===4,'successful updates audited');
await run("CREATE TRIGGER reject_identity BEFORE UPDATE ON company_document_settings BEGIN SELECT RAISE(ABORT,'forced write failure'); END");let failed=false;try{await call('PATCH',{name:'Must roll back'})}catch{failed=true}check(failed,'database failure propagated');check((await db.prepare('SELECT name FROM clients WHERE id=1').first()).name==='Rename only','batch rolls back earlier writes if identity update fails');await run('DROP TRIGGER reject_identity');
// Exercise actual front-end fill/save functions with a minimal DOM.
const app=readFileSync('public/app.js','utf8'),html=readFileSync('public/index.html','utf8');const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,{value:'',dataset:{},disabled:false,textContent:''});return nodes.get(id)};
const state={me:{active_company_id:1},companyProfile:{id:1,name:'ชื่อในระบบ',...body,work_start:'11:00',work_end:'20:00',late_grace_minutes:30,timezone:'Asia/Bangkok'}};let payload,toastCount=0;
const ctx={state,$,activeCompany:()=>({}),renderCompanyLogoEditor(){},renderIdentity(){},renderSettings(){},toast(){toastCount++},api:async(url,opts)=>{payload=JSON.parse(opts.body);return {company:{...state.companyProfile,...payload}}}};vm.createContext(ctx);
vm.runInContext(app.slice(app.indexOf('function fillCompanyProfileForm()'),app.indexOf('function openCompanyProfileModal()'))+app.slice(app.indexOf('async function saveCompanyProfile()'),app.indexOf('async function connectGoogleWorkspace()')),ctx);
ctx.fillCompanyProfileForm();check($('#companyProfileAddress').value===body.address&&$('#companyProfileLegalName').value===body.legal_name,'form populated with legal identity');$('#companyProfileAddress').value='456 ที่อยู่ใหม่';await ctx.saveCompanyProfile();check(payload.address==='456 ที่อยู่ใหม่'&&payload.expected_company_id===1,'UI sends edited address and company guard');check(state.documentSettings===null,'document settings cache refreshed');
state.me.active_company_id=2;payload=null;await ctx.saveCompanyProfile();check(!payload&&toastCount>=2,'stale UI cannot save to newly switched company');
check(['LegalName','TaxId','Address','Phone','Province'].every(k=>html.includes('id="companyProfile'+k+'"')),'all identity inputs visible in company page');
console.log(`PASS P10.38 ${n} checks: SQLite save/reload, atomic sync, tenant/role guards, validation, preserved signatures/setup, legacy/partial updates, actual UI fill/save`);
}finally{rmSync(dir,{recursive:true,force:true})}
