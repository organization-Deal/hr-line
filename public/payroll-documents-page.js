// Sidebar entry and period selection. Uses the existing document workflow.
export function createPayrollDocumentsPage({api,state,escapeHtml:esc,toast,role,createCenter,onBack}){
 let sequence=0,center=null,detail=null,selectedId=0,lastCompany=0;
 const root=()=>document.getElementById('payrollDocumentsPage');
 const company=()=>Number(state.me?.active_company_id||0);
 const allowed=()=>['owner','primary_owner','co_owner','hr_admin','hr','payroll_admin'].includes(String(role()||''));
 const current=(token,cid)=>token===sequence&&cid===company()&&state.currentView==='payroll-documents'&&allowed();
 const localState={get me(){return state.me;},get payrollDetail(){return detail;},get currentView(){return state.currentView;}};
 function leave(){sequence++;center?.invalidate();center=null;detail=null;root()?.replaceChildren();}
 function message(text,retry=false){const node=root();if(!node)return;node.innerHTML=`<div class="page-intro"><div><p class="kicker">PAYROLL DOCUMENTS</p><h1>เอกสารหลังเงินเดือน</h1><p>${esc(text)}</p></div></div><div class="page-actions">${retry?'<button type="button" class="secondary-btn" data-doc-page-retry>ลองโหลดอีกครั้ง</button>':''}<button type="button" class="secondary-btn" data-doc-page-back>กลับ Payroll</button></div>`;node.querySelector('[data-doc-page-back]').onclick=onBack;node.querySelector('[data-doc-page-retry]')?.addEventListener('click',open);}
 async function choose(id){
  const cid=company(),token=++sequence,node=root();center?.invalidate();center=null;detail=null;selectedId=Number(id);
  const host=node.querySelector('#nkPayrollDocumentCenter');host.replaceChildren();
  host.innerHTML='<p class="nk-doc-page-loading" role="status">กำลังโหลดเอกสารของรอบนี้…</p>';
  try{
   const result=await api(`/api/payroll/periods/${selectedId}`,{timeoutMs:18000,silentStatus:true});
   if(!current(token,cid))return;
   if(Number(result?.period?.id)!==selectedId)throw Error('รอบเงินเดือนไม่ตรง กรุณาเลือกรอบใหม่');
   detail=result;
   center=createCenter({api,state:localState,escapeHtml:esc,toast,host,onClose:onBack});
   await center.open();
  }catch(e){if(!current(token,cid))return;host.innerHTML=`<div class="nk-doc-page-loading"><p role="alert">${esc(e.message)}</p><button type="button" class="secondary-btn" data-doc-period-retry>ลองโหลดรอบนี้อีกครั้ง</button></div>`;host.querySelector('button').onclick=()=>choose(selectedId);}
 }
 async function open(){
  const cid=company(),token=++sequence;center?.invalidate();center=null;detail=null;
  if(!allowed()){message('เฉพาะผู้มีสิทธิ์จัดการ Payroll ที่เข้าถึงเอกสารเงินเดือนได้');return;}
  message('กำลังโหลดรอบเงินเดือน…');
  try{
   const data=await api('/api/payroll/overview',{timeoutMs:18000,silentStatus:true});
   if(!current(token,cid))return;
   const periods=data?.periods||[];
   if(!periods.length){message('ยังไม่มีรอบเงินเดือน ไปที่ Payroll เพื่อสร้างรอบก่อน');return;}
   const preferred=lastCompany===cid?selectedId:Number(state.activePayrollPeriodId||0);
   selectedId=periods.some(p=>Number(p.id)===preferred)?preferred:Number(periods[0].id);lastCompany=cid;
   root().innerHTML=`<div class="page-intro"><div><p class="kicker">PAYROLL DOCUMENTS</p><h1>เอกสารหลังเงินเดือน</h1><p>เลือกรอบเพื่อจัดไฟล์ประกันสังคม ภาษี และเอกสารส่งบัญชี</p></div><button type="button" class="secondary-btn" data-doc-page-back>กลับ Payroll</button></div><div class="nk-doc-page-toolbar"><label for="payrollDocumentsPeriod">รอบเงินเดือน<select id="payrollDocumentsPeriod">${periods.map(p=>`<option value="${Number(p.id)}" ${Number(p.id)===selectedId?'selected':''}>${esc(p.period_key)}${p.name?' · '+esc(p.name):''}</option>`).join('')}</select></label><button type="button" class="secondary-btn" data-doc-page-retry>โหลดรอบล่าสุด</button></div><div id="nkPayrollDocumentCenter" class="nk-payroll-document-center nk-doc-page-center"></div>`;
   root().querySelector('[data-doc-page-back]').onclick=onBack;
   root().querySelector('[data-doc-page-retry]').onclick=open;
   root().querySelector('select').onchange=e=>choose(Number(e.target.value));
   await choose(selectedId);
  }catch(e){if(current(token,cid))message(e.message,true);}
 }
 return {open,leave};
}
