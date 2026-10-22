// Notification Center P10.17. Refresh only reads; test sends exclusively to the signed-in HR user.
export function createNotificationCenter({api,escapeHtml:e,escapeAttr:a,toast,openForm,companyId,role}){
 let data=null,tenant=0,sequence=0,busy=false,error='';
 const days=['จ.','อ.','พ.','พฤ.','ศ.','ส.','อา.'];
 const status={accepted:'LINE รับข้อความแล้ว',retry:'รอลองส่งใหม่',failed:'ส่งไม่สำเร็จ',sending:'กำลังส่ง',pending:'รอส่ง',cancelled:'ยกเลิก'};
 const errorLabels={LINE_TOKEN_MISSING:'ยังไม่ได้ตั้งค่า LINE ของบริษัท',LINE_PROVIDER_UNAVAILABLE:'อ่านการเชื่อมต่อ LINE ไม่สำเร็จ',LINE_HTTP_401:'Token LINE ไม่ถูกต้องหรือหมดอายุ',LINE_HTTP_403:'LINE ปฏิเสธสิทธิ์การส่ง',LINE_HTTP_429:'LINE จำกัดการส่งหรือโควตาเต็ม',LINE_NETWORK_ERROR:'เชื่อมต่อ LINE ไม่สำเร็จ',LINE_TIMEOUT:'LINE ตอบกลับช้าเกินกำหนด',RETRY_LIMIT_AFTER_INTERRUPTION:'งานส่งถูกขัดจังหวะและครบจำนวนลองใหม่',RECIPIENT_IDENTITY_CHANGED:'ผู้รับเปลี่ยนบัญชี LINE แล้ว'};
 const reasons={COMPANY_HOLIDAY:'วันหยุดบริษัท',NO_ELIGIBLE_EMPLOYEES:'ไม่มีพนักงานที่เข้าเงื่อนไข',NO_AUTHORIZED_LINE_RECIPIENTS:'ยังไม่มีผู้รับที่เชื่อม LINE และมีสิทธิ์',NO_PENDING_TASKS:'ไม่มีงานรออนุมัติ',BATCH_CONTINUES_NEXT_TICK:'ส่งต่อในรอบถัดไป'};
 const descriptions={checkin:'เฉพาะคนที่มีตารางงานและยังไม่เช็กอิน ข้ามคนลาและวันหยุด',checkout:'เฉพาะคนที่เช็กอินแล้ว ยังไม่เช็กเอาต์ และถึงเวลาเลิกกะ',hr_summary:'ภาพรวมการเข้างาน การลา และงานรอตรวจสอบ ส่งให้ HR ที่เลือก',executive_summary:'สรุปตัวเลขภาพรวม ส่งให้เจ้าของและผู้บริหารที่เลือก',pending_approvals:'เตือนเมื่อมีใบลา เช็กอินย้อนหลัง หรือคำขอรอตรวจสอบ'};
 const root=()=>document.querySelector('#notificationCenter');
 const allowed=()=>['owner','primary_owner','co_owner','hr_admin','hr'].includes(role());
 const current=()=>data&&tenant===companyId();
 const recipientList=s=>(data.recipients||[]).filter(r=>s.kind!=='executive_summary'||['owner','co_owner'].includes(r.role));
 async function load(){
  const cid=companyId(),ticket=++sequence;error='';if(!allowed()){data=null;render();return;}
  if(tenant!==cid)data=null;render('กำลังโหลดการแจ้งเตือน…');
  try{const result=await api('/api/notification-center',{timeoutMs:20000});if(cid!==companyId()||ticket!==sequence)return;data=result;tenant=cid;}
  catch(err){if(cid!==companyId()||ticket!==sequence)return;error=(err.message||'โหลดไม่สำเร็จ')+' · หากเพิ่งอัปเดต กรุณา Deploy โค้ด Worker พร้อมหน้าเว็บ P10.17';data=null;}
  render();
 }
 function render(loading=''){
  const r=root();if(!r)return;
  if(!allowed()){r.innerHTML='<div class="nc-note">เฉพาะ HR และผู้ดูแลบริษัทเท่านั้น</div>';return;}
  if(!current()){r.innerHTML=`<div class="nc-note">${e(error||loading||'กำลังโหลด…')}${error?'<button class="secondary-btn" data-nc-refresh>ลองใหม่</button>':''}</div>`;bind();return;}
  const heartbeat=data.heartbeat,age=heartbeat?Date.now()-Date.parse(heartbeat.at):Infinity,healthy=age>=-60000&&age<300000;
  const latest=heartbeat?.at?new Date(heartbeat.at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}):'ยังไม่พบการทำงาน';
  r.innerHTML=`<div class="nc-head"><div><p class="kicker">LINE NOTIFICATIONS · ${e(data.release)}</p><h2>เรื่องสำคัญ ส่งให้ถูกคน</h2><p>ตั้งเวลา ข้อความ และผู้รับได้จากที่เดียว · เวลาไทย</p></div><div class="nc-actions"><button class="secondary-btn" data-nc-refresh>รีเฟรชสถานะ</button><button class="primary-btn" data-nc-test ${busy?'disabled':''}>ทดสอบส่งถึงฉัน</button></div></div>
  <div class="nc-health ${healthy?'nc-good':'nc-warn'}"><span class="nc-dot"></span><div><strong>${healthy?'ระบบตั้งเวลาทำงานอยู่':'ยังยืนยันระบบตั้งเวลาไม่ได้'}</strong><p>ทำงานล่าสุด ${e(latest)}${healthy?'':' · ตรวจว่า Deploy Worker รุ่นนี้และเปิด Cron ทุกนาทีแล้ว'}</p></div><span>${Number(data.missing_employee_line||0)} คนยังไม่เชื่อม LINE</span></div>
  <div class="nc-list">${data.settings.map(s=>{const run=data.runs[s.kind],recipients=recipientList(s),count=s.recipient_keys===null?recipients.length:recipients.filter(x=>s.recipient_keys.includes(x.key)).length;const logs=data.logs.filter(l=>l.kind===s.kind&&l.send_date===data.today);const log=logs[0],counts=logs.reduce((r,l)=>(r[l.status]=(r[l.status]||0)+1,r),{});const delivery=Object.entries(counts).map(([key,n])=>(status[key]||key)+' '+n).join(' · ');const detail=run?.error?'ทำงานผิดพลาด: '+run.error:reasons[run?.reason]||'';return `<article class="nc-row ${s.enabled?'':'nc-off'}"><div class="nc-time">${e(s.send_time)}<small>เวลาไทย</small></div><div class="nc-copy"><h3>${e(s.title)}</h3><p>${e(descriptions[s.kind])}</p><small>${s.weekdays.map(d=>days[d-1]).join(' · ')}${['checkin','checkout'].includes(s.kind)?'':` · ผู้รับ ${count} คน`}</small>${detail||log?`<div class="nc-result">${e(detail||delivery)}</div>`:''}</div><div class="nc-row-actions"><label class="switch"><input type="checkbox" data-nc-toggle="${a(s.kind)}" aria-label="เปิด ${a(s.title)}" ${s.enabled?'checked':''} ${busy?'disabled':''}><span></span></label><button class="secondary-btn" data-nc-edit="${a(s.kind)}" ${busy?'disabled':''}>ตั้งค่า</button></div></article>`;}).join('')}</div>
  <details class="nc-history"><summary>ประวัติการส่ง <span>${data.logs.length} รายการล่าสุด</span></summary><p>“LINE รับข้อความแล้ว” คือ LINE ยอมรับคำขอส่ง ยังไม่ใช่สถานะผู้รับอ่าน ข้อความจะไม่เข้าแชตหากผู้รับบล็อก OA</p><div class="nc-table"><table><thead><tr><th>วันที่</th><th>การแจ้งเตือน / ผู้รับ</th><th>สถานะ</th><th>ครั้ง / สาเหตุ</th></tr></thead><tbody>${data.logs.length?data.logs.map(l=>`<tr><td>${e(l.send_date)}</td><td>${e(data.settings.find(s=>s.kind===l.kind)?.title||'ข้อความทดสอบ')}<small>${e(l.recipient_label)}</small></td><td>${e(status[l.status]||l.status)}</td><td>${Number(l.attempts)}${l.error_code?' · '+e(errorLabels[l.error_code]||l.error_code):''}</td></tr>`).join(''):'<tr><td colspan="4">ยังไม่มีประวัติ รอถึงเวลาที่ตั้งไว้ หรือกดทดสอบส่งถึงฉัน</td></tr>'}</tbody></table></div></details>`;
  bind();
 }
 function bind(){const r=root();r.querySelector('[data-nc-refresh]')?.addEventListener('click',load);r.querySelector('[data-nc-test]')?.addEventListener('click',test);
  r.querySelectorAll('[data-nc-edit]').forEach(b=>b.addEventListener('click',()=>edit(b.dataset.ncEdit)));
  r.querySelectorAll('[data-nc-toggle]').forEach(b=>b.addEventListener('change',()=>save({...data.settings.find(s=>s.kind===b.dataset.ncToggle),enabled:b.checked}).catch(()=>{})));
 }
 async function save(setting,cid=companyId()){
  if(cid!==companyId()||!current())throw new Error('บริษัทเปลี่ยนแล้ว กรุณาเปิดตั้งค่าใหม่');busy=true;render();
  try{await api('/api/notification-center',{method:'PATCH',body:JSON.stringify(setting)});if(cid===companyId()){toast('บันทึกการแจ้งเตือนแล้ว');await load();}}
  catch(err){if(cid===companyId())toast(err.message,true);throw err;}
  finally{busy=false;render();}
 }
 function edit(kind){
  if(!current())return;const s=data.settings.find(x=>x.kind===kind),cid=companyId(),employees=['checkin','checkout'].includes(kind),recipients=recipientList(s);
  openForm({eyebrow:'การแจ้งเตือน · เวลาไทย',title:s.title,subtitle:descriptions[kind],saveText:'บันทึกการแจ้งเตือน',html:`
   <div class="field"><label for="ncTime">เวลาส่ง</label><input type="time" id="ncTime" value="${a(s.send_time)}" required></div><div class="field"><label class="toggle-line"><input type="checkbox" id="ncEnabled" ${s.enabled?'checked':''}>เปิดใช้งาน</label></div>
   <div class="field full"><label>วันที่ส่ง</label><div class="nc-days">${days.map((d,i)=>`<label><input type="checkbox" name="ncDay" value="${i+1}" ${s.weekdays.includes(i+1)?'checked':''}>${d}</label>`).join('')}</div></div>
   <div class="field full"><label for="ncMessage">ข้อความแจ้งเตือน</label><textarea id="ncMessage" rows="4" maxlength="300">${e(s.message_text)}</textarea><small>ใช้ {ชื่อ} {บริษัท} {วันที่} {เวลา} ได้ · สรุป HR แนบตัวเลขจริงให้อัตโนมัติ</small></div>
   ${employees?'<div class="nc-note field full">ผู้รับถูกเลือกจากตารางงานและสถานะการเช็กอินจริง ระบบข้ามพนักงานที่ลาและวันหยุดบริษัท</div>':`<div class="field full"><label>ผู้รับที่เชื่อม LINE และมีสิทธิ์</label><label class="toggle-line"><input id="ncAll" type="checkbox" ${s.recipient_keys===null?'checked':''}>ผู้มีสิทธิ์ทั้งหมด รวมบัญชีที่เพิ่มภายหลัง</label><div id="ncRecipients" class="nc-recipients">${recipients.length?recipients.map(r=>`<label><input type="checkbox" name="ncRecipient" value="${a(r.key)}" ${s.recipient_keys===null||s.recipient_keys.includes(r.key)?'checked':''}>${e(r.name)} <small>${e(r.role)}</small></label>`).join(''):'ยังไม่มีผู้รับที่เชื่อม LINE'}</div></div>`}`,
   onSave:async()=>{const modal=document.querySelector('#modal');await save({...s,enabled:modal.querySelector('#ncEnabled').checked,send_time:modal.querySelector('#ncTime').value,message_text:modal.querySelector('#ncMessage').value,weekdays:[...modal.querySelectorAll('[name=ncDay]:checked')].map(x=>Number(x.value)),recipient_keys:employees||modal.querySelector('#ncAll')?.checked?null:[...modal.querySelectorAll('[name=ncRecipient]:checked')].map(x=>x.value)},cid);}});
  const all=document.querySelector('#ncAll'),box=document.querySelector('#ncRecipients');if(all){const sync=()=>{box.querySelectorAll('input').forEach(x=>x.disabled=all.checked);box.style.opacity=all.checked?'.55':'1';};all.addEventListener('change',sync);sync();}
 }
 async function test(){if(busy||!current())return;const cid=companyId();busy=true;render();try{const result=await api('/api/notification-center/test',{method:'POST',body:'{}',timeoutMs:20000});if(cid!==companyId())return;if(!result.ok)throw new Error(errorLabels[result.error]||result.error||'ส่งไม่สำเร็จ');toast(result.status==='already_attempted'?'รอบทดสอบนี้ถูกส่งไปแล้ว ตรวจประวัติการส่ง':'LINE รับข้อความทดสอบแล้ว');await load();}catch(err){if(cid===companyId())toast(err.message,true);}finally{busy=false;render();}}
 return {load,render};
}
