const $=s=>document.querySelector(s);
const token=new URLSearchParams(location.search).get('token')||'';
const state={data:null,category:null,files:[]};
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function fileSize(bytes){const n=Number(bytes||0);return n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(1)} MB`}
function showError(message){$('#loadingState').classList.add('hidden');$('#caseForm').classList.add('hidden');$('#errorState').classList.remove('hidden');$('#errorText').textContent=message||'เกิดข้อผิดพลาด'}
async function load(){if(!token)return showError('ลิงก์ไม่ถูกต้อง กรุณากลับไปที่ LINE แล้วกด “แจ้ง HR” ใหม่');try{const r=await fetch(`/api/public/hr-case/${encodeURIComponent(token)}`,{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'เปิดแบบฟอร์มไม่ได้');state.data=d;render(d);$('#loadingState').classList.add('hidden');$('#errorState').classList.add('hidden');$('#caseForm').classList.remove('hidden')}catch(e){showError(e.message)}}
function render(d){$('#employeeName').textContent=d.employee.name||d.employee.full_name||'พนักงาน';$('#employeeCompany').textContent=`${d.employee.company_name}${d.employee.employee_code?` · ${d.employee.employee_code}`:''}`;$('#employeeAvatar').textContent=(d.employee.name||d.employee.full_name||'น').trim().charAt(0);$('#categoryList').innerHTML=(d.categories||[]).map(c=>`<button class="category-option" type="button" data-category="${esc(c.code)}">${esc(c.name)}</button>`).join('');document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>selectCategory(b.dataset.category));if(d.categories?.[0])selectCategory(d.categories[0].code)}
function selectCategory(code){state.category=code;$('#category').value=code;document.querySelectorAll('[data-category]').forEach(b=>b.classList.toggle('selected',b.dataset.category===code))}
function renderFiles(){$('#fileList').innerHTML=state.files.map((f,i)=>`<div class="file-row"><span class="file-kind">${String(f.type||'').startsWith('image/')?'🖼':'📎'}</span><span><strong>${esc(f.name)}</strong><small>${fileSize(f.size)}</small></span><button class="file-remove" type="button" data-remove="${i}">×</button></div>`).join('');document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{state.files.splice(Number(b.dataset.remove),1);renderFiles()})}
$('#attachmentInput').addEventListener('change',e=>{for(const f of [...(e.target.files||[])]){if(state.files.length>=3)break;if(f.size>10*1024*1024){alert(`${f.name} ใหญ่เกิน 10 MB`);continue}state.files.push(f)}e.target.value='';renderFiles()});
$('#detail').addEventListener('input',()=>$('#detailCount').textContent=$('#detail').value.length);
function setSubmitError(message=''){
  const box=$('#submitError');
  if(!box)return;
  if(!message){box.classList.add('hidden');box.textContent='';return;}
  box.classList.remove('hidden');
  box.innerHTML=`<strong>ส่งข้อมูลติดขัด</strong>${esc(message)}`;
  box.scrollIntoView({behavior:'smooth',block:'center'});
}
async function requestJson(url,options={},timeoutMs=18000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(url,{...options,signal:controller.signal,cache:'no-store'});
    let data={};
    try{data=await response.json()}catch{}
    if(!response.ok)throw new Error(data.error||`ระบบตอบกลับ ${response.status}`);
    return data;
  }catch(error){
    if(error?.name==='AbortError')throw new Error('ระบบตอบช้ากว่าปกติ กรุณาลองอีกครั้ง');
    if(String(error?.message||'').toLowerCase()==='load failed')throw new Error('การเชื่อมต่อใน LINE สะดุด กรุณาลองอีกครั้ง ระบบจะไม่สร้างเรื่องซ้ำถ้าส่งสำเร็จแล้ว');
    throw error;
  }finally{clearTimeout(timer)}
}
async function uploadAttachment(caseId,file,index,total){
  const form=new FormData();
  form.append('case_id',String(caseId));
  form.append('attachment',file,file.name);
  let lastError=null;
  for(let attempt=1;attempt<=2;attempt++){
    try{return await requestJson(`/api/public/hr-case/${encodeURIComponent(token)}/attachments`,{method:'POST',body:form},30000)}
    catch(error){lastError=error;if(attempt<2)await new Promise(r=>setTimeout(r,700));}
  }
  throw lastError||new Error(`อัปโหลด ${file.name} ไม่สำเร็จ`);
}
$('#caseForm').addEventListener('submit',async e=>{
  e.preventDefault();
  setSubmitError('');
  const subject=$('#subject').value.trim(),detail=$('#detail').value.trim();
  if(!state.category)return setSubmitError('กรุณาเลือกหมวดเรื่อง');
  if(subject.length<3)return setSubmitError('กรุณาใส่หัวข้ออย่างน้อย 3 ตัวอักษร');
  if(detail.length<5)return setSubmitError('กรุณาเล่ารายละเอียดเพิ่มอีกนิด');
  const btn=$('#submitBtn');
  btn.disabled=true;
  btn.querySelector('.btn-label').textContent='กำลังส่งเรื่องให้ HR…';
  btn.querySelector('.btn-spinner').classList.remove('hidden');
  try{
    const payload={
      category:state.category,
      subject,
      detail,
      urgency:document.querySelector('input[name="urgency"]:checked')?.value||'normal',
      contact_preference:$('#contactPreference').value
    };
    const created=await requestJson(`/api/public/hr-case/${encodeURIComponent(token)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)},18000);
    const caseItem=created.case;
    let uploaded=0;
    const failed=[];
    for(let i=0;i<state.files.length;i++){
      const file=state.files[i];
      btn.querySelector('.btn-label').textContent=`กำลังอัปโหลดไฟล์ ${i+1}/${state.files.length}…`;
      try{await uploadAttachment(caseItem.id,file,i+1,state.files.length);uploaded++;}
      catch(error){failed.push(`${file.name}: ${error.message}`)}
    }
    showSuccess({...caseItem,attachments:uploaded,attachment_failures:failed});
  }catch(err){
    setSubmitError(err.message||'ส่งเรื่องไม่สำเร็จ กรุณาลองอีกครั้ง');
  }finally{
    btn.disabled=false;
    btn.querySelector('.btn-label').textContent='ส่งเรื่องให้ HR';
    btn.querySelector('.btn-spinner').classList.add('hidden');
  }
});
function showSuccess(item){$('#caseForm').classList.add('hidden');$('#successState').classList.remove('hidden');const failed=item.attachment_failures||[];$('#successSummary').textContent=failed.length?'ส่งเรื่องถึง HR สำเร็จแล้ว แต่มีไฟล์บางรายการอัปโหลดไม่สำเร็จ สามารถแจ้ง HR เพิ่มเติมได้':'นากนะส่งเลขเรื่องกลับไปใน LINE และแจ้ง Owner / HR ที่มีสิทธิ์แล้ว';$('#successMeta').innerHTML=`<div><span>เลขที่</span><strong>#${esc(item.code)}</strong></div><div><span>หัวข้อ</span><strong>${esc(item.subject)}</strong></div><div><span>สถานะ</span><strong>HR รับเรื่องแล้ว</strong></div><div><span>ไฟล์แนบ</span><strong>${Number(item.attachments||0)} ไฟล์</strong></div>${failed.length?`<div><span>หมายเหตุ</span><strong>${esc(failed.length+' ไฟล์อัปโหลดไม่สำเร็จ')}</strong></div>`:''}`;window.scrollTo({top:0,behavior:'smooth'})}
$('#retryBtn').onclick=()=>location.reload();$('#backLineBtn').onclick=()=>{try{window.close()}catch{}setTimeout(()=>{if(history.length>1)history.back();else location.href='https://line.me/'},120)};load();
