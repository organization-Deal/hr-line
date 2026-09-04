const $=s=>document.querySelector(s);
const params=new URLSearchParams(location.search);
const token=String(params.get('token')||'').trim();
const action=params.get('action')==='checkout'?'checkout':'checkin';
let busy=false;

function setLoading(message){
  $('#stateIcon').className='state-icon loading';
  $('#stateIcon').innerHTML='<span class="spinner"></span>';
  $('#title').textContent=action==='checkin'?'กำลังเช็กอิน…':'กำลังเช็กเอาต์…';
  $('#message').textContent=message||'กำลังอ่าน GPS จากมือถือของคุณ';
  $('#retryBtn').classList.add('hidden');
  $('#permissionHint').classList.add('hidden');
  $('#detailCard').classList.add('hidden');
}
function setError(message,{permission=false}={}){
  $('#stateIcon').className='state-icon error';
  $('#stateIcon').textContent='!';
  $('#title').textContent=action==='checkin'?'เช็กอินไม่สำเร็จ':'เช็กเอาต์ไม่สำเร็จ';
  $('#message').textContent=message||'กรุณาลองใหม่อีกครั้ง';
  $('#retryBtn').classList.remove('hidden');
  $('#permissionHint').classList.toggle('hidden',!permission);
}
function formatDistance(value){
  const d=Number(value); if(!Number.isFinite(d))return '—';
  return d>=1000?`${(d/1000).toFixed(d>=10000?0:1)} กม.`:`${Math.round(d)} ม.`;
}
function formatTime(iso){
  if(!iso)return '—';
  try{return new Intl.DateTimeFormat('th-TH',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Bangkok'}).format(new Date(iso));}catch{return '—';}
}
function setSuccess(payload,position){
  const result=payload.result||{};
  const sent=Boolean(payload.notification?.sent);
  const already=Boolean(payload.already_recorded);
  $('#stateIcon').className='state-icon success';
  $('#stateIcon').textContent='✓';
  $('#title').textContent=already?(action==='checkin'?'ยืนยันว่าเช็กอินแล้ว':'ยืนยันว่าเช็กเอาต์แล้ว'):(action==='checkin'?'เช็กอินสำเร็จ':'เช็กเอาต์สำเร็จ');
  $('#message').textContent=sent
    ? `บันทึกเข้าระบบ HR แล้ว และส่งรายละเอียดกลับไปที่ LINE เรียบร้อย`
    : `บันทึกเข้าระบบ HR แล้ว แต่ LINE ยังส่งข้อความยืนยันไม่สำเร็จ`;
  $('#timeText').textContent=formatTime(action==='checkin'?result.check_in_at:result.check_out_at);
  $('#locationText').textContent=result.source_title||result.source_address||result.location_name||(result.outside_geofence?'นอก Work Location':'ตำแหน่งปัจจุบัน');
  $('#distanceText').textContent=formatDistance(result.distance_m);
  const acc=Number(result.accuracy_m??position?.coords?.accuracy??payload.accuracy_m); $('#accuracyText').textContent=Number.isFinite(acc)?`±${Math.round(acc)} ม.`:'—';
  $('#systemText').textContent='บันทึกแล้ว';
  $('#lineText').textContent=sent?'ส่งข้อความแล้ว':'ยังส่งไม่สำเร็จ';
  $('#lineText').className=sent?'status-ok':'status-warn';
  $('#detailCard').classList.remove('hidden');
  $('#retryBtn').classList.toggle('hidden',sent);
  if(!sent)$('#retryBtn').textContent='ส่งสถานะเข้า LINE อีกครั้ง';
  $('#permissionHint').classList.add('hidden');
}
function locate(){
  return new Promise((resolve,reject)=>{
    if(!navigator.geolocation)return reject(Object.assign(new Error('อุปกรณ์นี้ไม่รองรับการอ่านตำแหน่ง'),{code:0}));
    navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:12000,maximumAge:15000});
  });
}
async function submit(){
  if(busy)return; busy=true;
  try{
    if(!token){setError('ลิงก์ไม่ถูกต้อง กรุณากดเมนูใน LINE ใหม่อีกครั้ง');return;}
    setLoading('กำลังอ่านตำแหน่งปัจจุบัน…');
    let position=await locate();
    // If the first fix is weak, give GPS one quick chance to improve without asking the user to tap again.
    if(Number(position.coords.accuracy)>350){
      setLoading(`GPS ยังคลาดเคลื่อนประมาณ ${Math.round(position.coords.accuracy)} ม. กำลังปรับความแม่นยำ…`);
      try{
        const better=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:5500,maximumAge:0}));
        if(Number(better.coords.accuracy)<Number(position.coords.accuracy))position=better;
      }catch{}
    }
    setLoading('ได้ตำแหน่งแล้ว กำลังตรวจ Work Location และบันทึกเวลา…');
    const endpoint=action==='checkin'?'check-in':'check-out';
    const response=await fetch(`/api/public/attendance/${encodeURIComponent(token)}/${endpoint}`,{
      method:'POST',headers:{'content-type':'application/json','accept':'application/json'},cache:'no-store',
      body:JSON.stringify({latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      if(response.status===409){
        $('#stateIcon').className='state-icon success'; $('#stateIcon').textContent='✓';
        $('#title').textContent=action==='checkin'?'วันนี้เช็กอินแล้ว':'วันนี้เช็กเอาต์แล้ว';
        $('#message').textContent='พบรายการในระบบแล้ว กำลังลองส่งสถานะกลับ LINE อีกครั้ง';
        $('#retryBtn').classList.remove('hidden');
        $('#retryBtn').textContent='ส่งสถานะเข้า LINE อีกครั้ง';
        return;
      }
      throw new Error(data.error||'ระบบบันทึกเวลาไม่สำเร็จ');
    }
    setSuccess(data,position);
  }catch(error){
    const code=Number(error?.code||0);
    if(code===1)setError('มือถือยังไม่อนุญาตให้ใช้ตำแหน่ง กรุณาเปิดสิทธิ์ Location แล้วลองใหม่',{permission:true});
    else if(code===2)setError('ยังหาตำแหน่งปัจจุบันไม่ได้ กรุณาเปิด GPS แล้วลองใหม่');
    else if(code===3)setError('อ่านตำแหน่งนานเกินไป กรุณาอยู่ในจุดที่สัญญาณ GPS ชัดขึ้นแล้วลองใหม่');
    else setError(error?.message||'เกิดข้อผิดพลาด กรุณาลองใหม่');
  }finally{busy=false;}
}

$('#retryBtn').addEventListener('click',submit);
window.addEventListener('pageshow',()=>{if(!busy)submit();},{once:true});
