from pathlib import Path
import os,shutil
from bs4 import BeautifulSoup
import base64,json
ROOT=Path(os.environ.get('NAKNA_PROJECT_DIR', '.')).resolve()/'public';QA=Path(__file__).resolve().parent
EXPOSE='''
// QA-only instrumentation, never delivered in app.js.
loadViewData=async()=>{}; scheduleDeferredLoad=()=>{}; refreshDashboardSoon=()=>{};
acknowledgeAttentionForView=()=>{};
window.__NKQA={state,bindEvents,renderAll,renderIdentity,renderLeaves,renderLeaveUnified,
 renderDashboard,renderEmployees,renderPayroll,renderDocuments,renderHrInbox,renderBroadcastPage,
 renderWellness,showView,initMobileDialogSystem,openSettingsCategory,fillCompanyProfileForm,
 renderGrowth,renderEngagement,renderAnalytics,renderSubscription,renderSaasAdmin,renderTeamWorkLog,
 loadLeaveUnified,showSettingsHome,renderSettingsSidebar};
bindEvents();initMobileDialogSystem();
'''
MOCK='''
for (const name of ['localStorage','sessionStorage']) {
 const mem=new Map();Object.defineProperty(window,name,{configurable:true,value:{
 getItem:k=>mem.has(k)?mem.get(k):null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k),clear:()=>mem.clear(),key:i=>Array.from(mem.keys())[i],get length(){return mem.size}}});
}
window.__apiCalls=[];
window.fetch=async (url,opts={})=>{
 window.__apiCalls.push({url:String(url),method:opts.method||'GET',body:typeof opts.body==='string'?opts.body:'multipart'});
 let data={ok:true,data:[]}; const path=String(url);
 if(path.includes('/report') || path.includes('/leave-analytics'))data=window.__NKFixture?.report||{};
 else if(path.match(/\\/api\\/leaves\\/\\d+$/))data={leave:window.__NKFixture?.leaves?.[2],data:window.__NKFixture?.leaves?.[2],evidence:[],history:[]};
 else if(path==='/api/payroll/overview')data=window.__NKFixture?.payroll||{};
 else if((path==='/api/payroll/periods/1'||path==='/api/payroll/periods/1/cell'))data=window.__NKFixture?.payrollDetail||{};
 else if(path==='/api/employees')data={ok:true,data:window.__NKFixture?.emp||[]};
 else if(path.includes('/employee-documents'))data={ok:true,data:[]};
 return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
};
'''
def html():
 s=BeautifulSoup((ROOT/'index.html').read_text(),'html.parser')
 for n in s.select('script,link,noscript,meta[http-equiv]'):n.decompose()
 # Local font fallback is for offline QA only; no font bytes distributed.
 s.head.append(BeautifulSoup('<style>'+ (ROOT/'styles.css').read_text()+'</style>','html.parser'))
 s.head.append(BeautifulSoup('<style>'+ (ROOT/'ui/p10.css').read_text()+'</style>','html.parser'))
 s.head.append(BeautifulSoup('<style>:root{--font-th:"Noto Sans Thai",sans-serif;--font-en:"Noto Sans","Noto Sans Thai",sans-serif}</style>','html.parser'))
 for im in s.select('img[src="/ui/nakna-mark.webp"]'):im['src']='data:image/webp;base64,'+base64.b64encode((ROOT/'ui/nakna-mark.webp').read_bytes()).decode()
 return str(s)
async def setup(page):
 await page.set_content(html(),wait_until='domcontentloaded')
 await page.evaluate(MOCK)
 await page.add_script_tag(content=(ROOT/'ui/p10.js').read_text())
 app=(ROOT/'app.js').read_text().replace('\nboot();','\n// QA: boot disabled\n')
 await page.add_script_tag(content=app+EXPOSE)
 await page.evaluate((QA/'fixtures.js').read_text())
 await page.wait_for_timeout(200)
