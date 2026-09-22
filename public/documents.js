const q=new URLSearchParams(location.search),token=q.get('token')||'';
let current=0,currentDoc=null,documentRows=[];
const list=document.querySelector('#list'),dlg=document.querySelector('#ack');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function stateCard(title,body,action=''){return `<div class="empty"><strong>${esc(title)}</strong>${body?`<p>${esc(body)}</p>`:''}${action}</div>`}
async function requestJson(url,options={},timeoutMs=18000){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeoutMs);try{const r=await fetch(url,{...options,signal:c.signal,cache:'no-store'});let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error||`ระบบตอบกลับ ${r.status}`);return d}catch(e){if(e?.name==='AbortError')throw Error('ระบบตอบช้ากว่าปกติ กรุณาลองอีกครั้ง');if(String(e?.message||'').toLowerCase()==='load failed')throw Error('การเชื่อมต่อสะดุด กรุณาลองอีกครั้ง');throw e}finally{clearTimeout(t)}}
function fmt(v){if(!v)return'';try{return new Date(v).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'})}catch{return String(v)}}
function isReceiptType(x){return ['employment_certificate','salary_certificate'].includes(String(x?.document_type||''));}
function isSensitiveAckType(x){return ['warning','acknowledgement'].includes(String(x?.document_type||''));}
function isSigned(x){return String(x?.employee_signature_status||'')==='signed'||Boolean(Number(x?.has_signed_copy))||['acknowledged','responded'].includes(String(x?.ack_status||''));}
async function load(){if(!token){list.innerHTML=stateCard('ลิงก์ไม่ถูกต้อง','กรุณาเปิด “เอกสารของฉัน” จาก LINE นากนะ');return}list.innerHTML=stateCard('กำลังโหลดเอกสาร…','กรุณารอสักครู่');try{const d=await requestJson(`/api/public/documents/${encodeURIComponent(token)}`,{},18000);document.querySelector('#who').textContent=`${d.employee.name} · ${d.employee.company_name}`;documentRows=d.documents||[];render(documentRows)}catch(e){list.innerHTML=stateCard('เปิดเอกสารไม่ได้',e.message,'<button class="retry" type="button" onclick="load()">ลองอีกครั้ง</button>')}}
function render(rows){list.innerHTML=rows.length?rows.map(x=>{
  const awaiting=String(x.workflow_status||'')==='awaiting_employee_signature';
  const signed=isSigned(x),final=String(x.workflow_status||'')==='final';
  const needs=awaiting&&!signed;
  let statusText='พร้อมเปิดดู',statusClass='';
  if(needs){statusText=x.ack_status==='viewed'?'เปิดแล้ว · รอลายเซ็น':'HR เซ็นแล้ว · รอลายเซ็นคุณ';statusClass='wait';}
  else if(final&&signed){statusText='✓ Final · ลงนามครบแล้ว';statusClass='done';}
  else if(final){statusText='✓ Final';statusClass='done';}
  const openLabel=signed?'เปิด Final PDF':awaiting?'ตรวจ PDF ที่ HR เซ็นแล้ว':'เปิดเอกสาร';
  const signLabel=isReceiptType(x)?'ลงลายเซ็นรับเอกสาร':'ลงลายเซ็นรับทราบ';
  return `<article class="card"><div class="top"><div class="icon">PDF</div><div class="copy"><b>${esc(x.title)}</b><small>${esc(x.document_number||'')} · v${Number(x.version||1)} · ${esc(x.document_date||'')}</small>${x.hr_signed_at?`<small class="hr-signed-line">HR ลงนามแล้ว ${esc(fmt(x.hr_signed_at))}${x.hr_signer_name?` · ${esc(x.hr_signer_name)}`:''}</small>`:''}</div><span class="status ${statusClass}">${statusText}</span></div><div class="buttons"><a class="open" target="_blank" rel="noopener" href="/api/public/documents/${encodeURIComponent(token)}/${Number(x.id)}/file">${openLabel}</a>${needs?`<button class="accept" onclick="openAck(${Number(x.id)})">${signLabel}</button>`:''}</div>${signed?`<div class="signed-proof"><strong>เอกสารลงนามครบแล้ว</strong><span>${esc(x.signer_name||'พนักงาน')} · ${esc(fmt(x.signed_at||x.employee_signed_at||x.acknowledged_at))}</span></div>`:''}${x.response_text?`<small class="response">คำชี้แจงของคุณ: ${esc(x.response_text)}</small>`:''}</article>`
}).join(''):stateCard('ยังไม่มีเอกสารสำหรับคุณ','เมื่อบริษัทออกและลงนามเอกสารให้ เอกสารจะปรากฏที่นี่')}

const canvas=document.querySelector('#signaturePad'),ctx=canvas.getContext('2d');let drawing=false,hasSignature=false,lastPoint=null;
function resizeSignaturePad(){const rect=canvas.getBoundingClientRect(),ratio=Math.max(1,Math.min(3,window.devicePixelRatio||1));canvas.width=Math.max(1,Math.round(rect.width*ratio));canvas.height=Math.max(1,Math.round(170*ratio));ctx.setTransform(ratio,0,0,ratio,0,0);ctx.lineWidth=2.2;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#173c43';ctx.fillStyle='#fff';ctx.fillRect(0,0,rect.width,170);hasSignature=false;lastPoint=null}
function clearSignature(){const rect=canvas.getBoundingClientRect();ctx.clearRect(0,0,rect.width,170);ctx.fillStyle='#fff';ctx.fillRect(0,0,rect.width,170);hasSignature=false;lastPoint=null}
function canvasPoint(ev){const r=canvas.getBoundingClientRect();return{x:ev.clientX-r.left,y:ev.clientY-r.top}}
function startDraw(ev){ev.preventDefault();drawing=true;lastPoint=canvasPoint(ev);hasSignature=true;canvas.setPointerCapture?.(ev.pointerId)}
function draw(ev){if(!drawing)return;ev.preventDefault();const p=canvasPoint(ev);ctx.beginPath();ctx.moveTo(lastPoint.x,lastPoint.y);ctx.lineTo(p.x,p.y);ctx.stroke();lastPoint=p}
function endDraw(ev){if(!drawing)return;ev.preventDefault();drawing=false;lastPoint=null}
canvas.addEventListener('pointerdown',startDraw);canvas.addEventListener('pointermove',draw);canvas.addEventListener('pointerup',endDraw);canvas.addEventListener('pointercancel',endDraw);canvas.addEventListener('contextmenu',e=>e.preventDefault());
document.querySelector('#clearSignature').addEventListener('click',clearSignature);window.addEventListener('resize',()=>{if(dlg.open)resizeSignaturePad()});

window.load=load;
window.openAck=id=>{
  current=id;currentDoc=documentRows.find(x=>Number(x.id)===Number(id))||null;
  if(!currentDoc)return;
  const receipt=isReceiptType(currentDoc),sensitive=isSensitiveAckType(currentDoc);
  document.querySelector('#response').value='';document.querySelector('#ackError').textContent='';document.querySelector('#ackConfirm').checked=false;
  document.querySelector('#ackEyebrow').textContent=receipt?'DOCUMENT RECEIPT':'DOCUMENT ACKNOWLEDGEMENT';
  document.querySelector('#ackTitle').textContent=receipt?'ลงลายเซ็นรับเอกสาร':'ลงลายเซ็นรับทราบเอกสาร';
  document.querySelector('#ackIntro').textContent=receipt
    ? 'กรุณาเปิดตรวจสอบ PDF ที่ฝ่ายบริษัทลงนามแล้วก่อน จากนั้นลงลายเซ็นเพื่อยืนยันว่าคุณได้รับเอกสารฉบับนี้'
    : sensitive
      ? 'กรุณาอ่านเอกสารที่ HR ลงนามแล้วก่อน การลงลายเซ็นเป็นหลักฐานว่าได้รับและเห็นเอกสาร ไม่ได้หมายถึงยอมรับข้อกล่าวหาหรือสละสิทธิ์ในการชี้แจง'
      : 'กรุณาอ่านเอกสารที่ HR ลงนามแล้วก่อน จากนั้นลงลายเซ็นเพื่อยืนยันการรับทราบ';
  document.querySelector('#ackSignatureLabel').textContent=receipt?'ลายเซ็นผู้รับเอกสาร':'ลายเซ็นผู้รับทราบ';
  document.querySelector('#ackConfirmText').textContent=receipt?'ข้าพเจ้าได้รับและตรวจสอบเอกสารฉบับนี้แล้ว':'ข้าพเจ้าได้รับ อ่าน และรับทราบเอกสารฉบับนี้แล้ว';
  document.querySelector('#ackBtn').textContent=receipt?'ลงนามรับเอกสารและสร้าง Final PDF':'ลงนามรับทราบและสร้าง Final PDF';
  document.querySelector('#ackDocumentMeta').innerHTML=`<strong>${esc(currentDoc.title||'เอกสาร')}</strong><span>${esc(currentDoc.document_number||'')} · HR ลงนาม ${esc(fmt(currentDoc.hr_signed_at))}</span><a target="_blank" rel="noopener" href="/api/public/documents/${encodeURIComponent(token)}/${Number(currentDoc.id)}/file">เปิด PDF ที่ HR ลงนามแล้ว</a>`;
  dlg.showModal();requestAnimationFrame(()=>resizeSignaturePad());
};

document.querySelector('#ackBtn').onclick=async()=>{const b=document.querySelector('#ackBtn'),err=document.querySelector('#ackError');err.textContent='';if(!document.querySelector('#ackConfirm').checked){err.textContent='กรุณาติ๊กยืนยันก่อนลงนาม';return}if(!hasSignature){err.textContent='กรุณาลงลายเซ็นในกรอบก่อนยืนยัน';return}b.disabled=true;const old=b.textContent;b.textContent='กำลังสร้าง Final PDF…';try{const signature=canvas.toDataURL('image/png');const r=await requestJson(`/api/public/documents/${encodeURIComponent(token)}/${current}/acknowledge`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({response_text:document.querySelector('#response').value,signature_data_url:signature})},45000);dlg.close();await sleep(150);await load();if(r?.signed_copy_url)setTimeout(()=>{location.hash=`document-${current}`},0)}catch(e){err.textContent=e.message||'บันทึกลายเซ็นไม่ได้ กรุณาลองอีกครั้ง'}finally{b.disabled=false;b.textContent=old}};
load();
