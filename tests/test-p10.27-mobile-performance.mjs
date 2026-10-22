import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createReadGate,shouldPreloadPeople,resetRoutePosition} from '../public/ux-runtime.js';
let checks=0;const check=(v,msg)=>{assert.ok(v,msg);checks++;};
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};};
const gate=createReadGate();let calls=0;let wait=defer();
const request=()=>{calls++;return wait.promise;};
const first=gate.run('/api/employees',{},'u1:c1',request),second=gate.run('/api/employees',{},'u1:c1',request);
await Promise.resolve();check(calls===1,'simultaneous identical reads use one network request');wait.resolve({data:[{id:1,name:'เดิม'}]});
const [a,b]=await Promise.all([first,second]);a.data[0].name='เปลี่ยน';check(b.data[0].name==='เดิม','callers receive independent objects');
wait=defer();const next=gate.run('/api/employees',{},'u1:c1',request);await Promise.resolve();check(calls===2,'completed responses are not cached');wait.resolve({data:[]});await next;
const failure=defer();const p=gate.run('/api/dashboard',{},'u1:c1',()=>failure.promise);const rejected=p.catch(e=>e.message);failure.reject(new Error('timeout'));check(await rejected==='timeout','network errors propagate');check((await gate.run('/api/dashboard',{},'u1:c1',()=>Promise.resolve({retry:true}))).retry,'failed request can retry immediately');
let tenants=0;await Promise.all(['u1:c1','u1:c2','u2:c1'].map(scope=>gate.run('/api/employees',{},scope,async()=>{tenants++;return {};})));check(tenants===3,'company and user scopes never share reads');
let options=0;await Promise.all([{}, {timeoutMs:12000}, {silentStatus:true}, {headers:{test:'x'}}].map(o=>gate.run('/api/dashboard',o,'u1:c1',async()=>{options++;return {};})));check(options===4,'different timeout/status/header options never merge');
let writes=0;await Promise.all([1,2].map(()=>gate.run('/api/employees',{method:'POST'},'u1:c1',async()=>{writes++;return {};})));check(writes===2,'mutations always execute independently');
let freshCalls=0;const old=defer(),fresh=defer();const oldRead=gate.run('/api/employees',{},'u1:c1',()=>old.promise);await Promise.resolve();
await gate.run('/api/employees',{method:'PATCH'},'u1:c1',async()=>({}));
const newRead=gate.run('/api/employees',{},'u1:c1',()=>{freshCalls++;return fresh.promise;});await Promise.resolve();old.resolve({old:true});await oldRead;
const joined=gate.run('/api/employees',{},'u1:c1',()=>{freshCalls++;return fresh.promise;});await Promise.resolve();check(freshCalls===1,'old request completion cannot evict post-mutation request');fresh.resolve({new:true});check((await newRead).new&&(await joined).new,'post-mutation read never reuses older data');
let unshared=0;await Promise.all([1,2].map(()=>gate.run('/api/session/company',{},'u1:c1',async()=>{unshared++;return {};})));check(unshared===2,'unlisted endpoints preserve original request behavior');
const base={hidden:false,mobile:false,connection:{effectiveType:'4g'},currentView:'dashboard',busy:false};
check(shouldPreloadPeople(base),'idle desktop dashboard may warm people data');
for(const patch of [{hidden:true},{mobile:true},{connection:{saveData:true}},{connection:{effectiveType:'2g'}},{connection:{effectiveType:'slow-2g'}},{currentView:'payroll'},{busy:true}])check(!shouldPreloadPeople({...base,...patch}),'optional preload yields to foreground/limited connections');
const scrolls=[];const root={scrollTop:500},main={scrollTop:300},nested={scrollLeft:80};resetRoutePosition({scrollTo:x=>scrolls.push(x)},{scrollingElement:root,getElementById:id=>id==='nkMain'?main:null});
check(scrolls[0].behavior==='instant'&&scrolls[0].top===0,'route navigation resets immediately');check(root.scrollTop===0&&main.scrollTop===0,'root and main scrollers reset');check(nested.scrollLeft===80,'nested table scroll remains independent');
const app=readFileSync('public/app.js','utf8'),server=readFileSync('src/index.js','utf8'),html=readFileSync('public/index.html','utf8');
const dashboard=server.slice(server.indexOf('async function getDashboard('),server.indexOf('\nasync function handleLineWebhook',server.indexOf('async function getDashboard(')));
check(!dashboard.includes('SELECT e.*')&&!dashboard.includes('SELECT * FROM candidates'),'dashboard avoids full employee and resume rows');
check(dashboard.includes('requestsRes, approvedLeaveToday, scheduleRows, holidayRows] = await db.batch'),'independent schedule/leave queries share initial database batch');
check(!dashboard.includes('const approvedLeaveToday = await')&&!dashboard.includes('const [scheduleRows,holidayToday]=await'),'schedule queries no longer wait on sequential network stages');
const batch=dashboard.slice(dashboard.indexOf('await db.batch(['),dashboard.indexOf('\n  ]);'));
const queries=[...batch.matchAll(/db\.prepare\((?:`([^`]+)`|'([^']+)')\)/g)].map(m=>m[1]||m[2]);
const sql=spawnSync('python3',['-c',`import json,sqlite3,sys,re
db=sqlite3.connect(':memory:')
for path in ['migrations/0001_init.sql','migrations/0008_phase1_people_core.sql']:
 db.executescript(open(path).read())
queries=json.load(sys.stdin)
for query in queries:
 count=max(map(int,re.findall(r'\\?(\\d+)',query)),default=0)
 db.execute(query,tuple([1,'2026-10-22'][:count])).fetchall()
print(len(queries))`],{input:JSON.stringify(queries),encoding:'utf8'});
check(sql.status===0&&sql.stdout.trim()==='8','all eight dashboard batch queries execute against real migrated SQLite schema: '+sql.stderr);
check(app.includes('resetRoutePosition(window,document)')&&app.includes('apiReadGate.run(path, options, scope'),'production route and API use tested helpers');
check(app.includes('if(companyId!==Number(state.me?.active_company_id||0))return false;'),'deferred dashboard/people results guarded on workspace change');
const preload=app.slice(app.indexOf('function scheduleDeferredLoad('),app.indexOf('const VIEW_CACHE_TTL_MS'));
check(!preload.includes("markViewLoaded('employees')"),'partial people preload cannot skip employee invitations/location data');
check(html.includes('/ui/mobile-ux.css?v=P10.27')&&html.includes('/ux-runtime.js?v=P10.27'),'new assets referenced with release version');
console.log(`P10.27 mobile/performance: ${checks} checks PASS`);
