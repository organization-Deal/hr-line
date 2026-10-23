const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={pending:'ยังไม่ส่ง',accepted:'LINE รับคำขอแล้ว',failed:'ส่งไม่สำเร็จ',no_line:'ยังไม่เชื่อม LINE',sending:'กำลังส่ง'};
const reasons={DOCUMENT_NOT_READY:'สลิปยังไม่พร้อม ตรวจการเชื่อม Google Drive',LINE_SEND_FAILED:'ยังไม่ทราบสาเหตุ ลองส่งใหม่หลังอัปเดตระบบ',LINE_PAYLOAD_INVALID:'รูปแบบการ์ดสลิปไม่ถูกต้อง กรุณาอัปเดตระบบ',LINE_TOKEN_INVALID:'Token LINE ไม่ถูกต้องหรือหมดอายุ ให้ผู้ดูแลตรวจการเชื่อมต่อ',LINE_FORBIDDEN:'LINE ปฏิเสธสิทธิ์ ให้ผู้ดูแลตรวจช่องทางส่ง',LINE_RECIPIENT_INVALID:'บัญชี LINE ผู้รับไม่ตรงช่องทางหรือรหัสไม่ถูกต้อง กรุณาตรวจการเชื่อมบัญชี',LINE_MONTHLY_LIMIT:'โควตาข้อความ LINE รายเดือนหมด กรุณาตรวจแพ็กเกจ',LINE_RATE_LIMIT:'ส่งถี่เกินไป กรุณารอสักครู่แล้วลองใหม่',LINE_UNAVAILABLE:'LINE ขัดข้องชั่วคราว กรุณาลองใหม่',LINE_TIMEOUT:'LINE ตอบช้าเกินกำหนด กรุณาลองใหม่',LINE_NETWORK_ERROR:'เชื่อมต่อ LINE ไม่สำเร็จ กรุณาลองใหม่',LINE_REQUEST_INVALID:'LINE ปฏิเสธคำขอ กรุณาให้ผู้ดูแลตรวจสอบ'};
export const canSelectPayslip=row=>row.line_connected&&!['accepted','sending','no_line'].includes(row.status);
export function payslipRowsHtml(rows,selected=new Set()){
 return rows.map(row=>`<div class="nk-slip-row"><label><input type="checkbox" data-slip-id="${row.employee_id}" ${selected.has(row.employee_id)?'checked':''} ${canSelectPayslip(row)?'':'disabled'}><span><strong>${esc(row.name||row.employee_code)}</strong><small>${esc(row.employee_code)}</small>${reasons[row.error_code]?`<small>${esc(reasons[row.error_code])}</small>`:''}</span></label><div><span class="nk-slip-status ${row.status==='accepted'?'is-sent':''}">${esc(labels[row.status]||'ยังไม่ส่ง')}</span>${canSelectPayslip(row)?`<button type="button" class="text-btn" data-slip-single="${row.employee_id}">ส่งรายคน</button>`:''}</div></div>`).join('');
}
export async function openPayslipDelivery({periodId,companyId,api,toast,onUpdated}){
 const cid=companyId();let data,busy=false,selected=new Set();
 let modal=document.getElementById('nkPayslipDelivery');if(modal?.open){modal.focus();return;}
 try{data=await api(`/api/payroll/periods/${periodId}/payslip-delivery`);}catch(error){toast(error.message,true);return;}
 if(cid!==companyId())return;
 modal?.remove();modal=document.createElement('dialog');modal.id='nkPayslipDelivery';modal.className='nk-payslip-delivery';modal.setAttribute('aria-labelledby','nkSlipTitle');
 modal.innerHTML=`<div class="nk-slip-head"><div><h2 id="nkSlipTitle">ส่งสลิปเงินเดือน</h2><p>เลือกผู้รับ ส่งเฉพาะสลิปทาง LINE ส่วนตัว</p></div><button type="button" class="secondary-btn" data-slip-close aria-label="ปิดรายการส่งสลิป">ปิด</button></div><p class="nk-slip-note" id="nkSlipNotice"></p><div class="nk-slip-tools"><button type="button" class="text-btn" data-slip-all>เลือกที่ยังไม่ส่งทั้งหมด</button><button type="button" class="text-btn" data-slip-none>ล้างที่เลือก</button></div><div class="nk-slip-list" id="nkSlipList"></div><div class="nk-slip-footer"><span id="nkSlipProgress" role="status" aria-live="polite"></span><button type="button" class="primary-btn" id="nkSlipSend">ส่งที่เลือก</button></div><small class="nk-slip-disclaimer">ไม่ส่งซ้ำคนที่ LINE รับคำขอแล้ว สถานะนี้ไม่ได้ยืนยันการเปิดอ่าน และขั้นตอนนี้ไม่โอนเงิน</small>`;
 document.body.append(modal);
 const find=s=>modal.querySelector(s),ready=()=>data.paid&&data.line_ready&&['locked','published'].includes(data.period.status);
 function render(){
  selected=new Set([...selected].filter(id=>data.recipients.some(r=>r.employee_id===id&&canSelectPayslip(r))));
  find('#nkSlipList').innerHTML=payslipRowsHtml(data.recipients,selected)||'<p>ไม่มีพนักงานในรอบนี้</p>';
  find('#nkSlipNotice').textContent=!data.paid?'กรุณาบันทึกว่าจ่ายเงินจริงแล้วก่อนส่งสลิป':!data.line_ready?'ช่องทาง LINE ยังไม่พร้อม กรุณาตรวจการเชื่อมต่อ':`LINE รับคำขอแล้ว ${data.recipients.filter(r=>r.status==='accepted').length}/${data.recipients.length} คน`;
  find('#nkSlipSend').textContent=`ส่งที่เลือก ${selected.size} คน`;find('#nkSlipSend').disabled=busy||!ready()||!selected.size;
  modal.querySelectorAll('button[data-slip-all],button[data-slip-none],button[data-slip-close],button[data-slip-single],input[data-slip-id]').forEach(el=>{el.disabled=busy||(!ready()&&!el.hasAttribute('data-slip-close'))||(el.matches('input')&&!canSelectPayslip(data.recipients.find(r=>r.employee_id===Number(el.dataset.slipId))));});
 }
 async function send(ids){
  if(busy||!ready()||!ids.length)return;
  if(cid!==companyId()){toast('บริษัทเปลี่ยนแล้ว กรุณาเปิดรายการใหม่',true);modal.close();return;}
  const names=data.recipients.filter(r=>ids.includes(r.employee_id)).slice(0,4).map(r=>r.name).join(', ');
  if(!window.confirm(`ส่งสลิปทาง LINE ให้ ${ids.length} คน?\n${names}${ids.length>4?' และคนอื่นที่เลือก':''}\nไม่โอนเงินและไม่แนบหลักฐานโอน`))return;
  busy=true;render();let attempted=0,failed=0;
  try{
   for(let offset=0;offset<ids.length;offset+=5){
    if(cid!==companyId())throw Error('บริษัทเปลี่ยนแล้ว หยุดส่งชุดถัดไป');
    find('#nkSlipProgress').textContent=`กำลังดำเนินการ ${attempted}/${ids.length} คน…`;
    const result=await api(`/api/payroll/periods/${periodId}/send-payslips`,{method:'POST',body:JSON.stringify({confirmed:true,employee_ids:ids.slice(offset,offset+5),expected_updated_at:data.period.updated_at,expected_net_total:data.period.net_total}),timeoutMs:120000});
    for(const row of result.results||[]){const target=data.recipients.find(r=>r.employee_id===row.employee_id);if(target)Object.assign(target,row);if(!['accepted','sending'].includes(row.status))failed++;}
    attempted+=Math.min(5,ids.length-offset);render();
   }
   find('#nkSlipProgress').textContent=`ดำเนินการครบ ${attempted} คน${failed?` · ไม่สำเร็จ/ยังไม่พร้อม ${failed} คน`:''}`;
  }catch(error){find('#nkSlipProgress').textContent=error.message;toast(error.message,true);}
  finally{
   if(cid===companyId()){
    try{data=await api(`/api/payroll/periods/${periodId}/payslip-delivery`);}catch{/* Keep known per-person results; never infer success. */}
    try{await onUpdated?.();}catch{}
   }
   busy=false;if(cid!==companyId()){modal.close();return;}render();
  }
 }
 modal.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 modal.addEventListener('change',event=>{const id=Number(event.target.dataset.slipId);if(!id)return;event.target.checked?selected.add(id):selected.delete(id);render();});
 modal.addEventListener('click',event=>{const b=event.target.closest('button');if(!b||busy)return;if(b.hasAttribute('data-slip-close'))modal.close();else if(b.hasAttribute('data-slip-all')){selected=new Set(data.recipients.filter(canSelectPayslip).map(r=>r.employee_id));render();}else if(b.hasAttribute('data-slip-none')){selected.clear();render();}else if(b.dataset.slipSingle)send([Number(b.dataset.slipSingle)]);else if(b.id==='nkSlipSend')send([...selected]);});
 render();modal.showModal();
}
