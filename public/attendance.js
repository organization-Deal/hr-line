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
  const current=payload.current_position||null;
  $('#stateIcon').className='state-icon success';
  $('#stateIcon').textContent='✓';
  $('#title').textContent=already
    ? (action==='checkin'?'วันนี้มีเช็กอินแล้ว':'วันนี้มีเช็กเอาต์แล้ว')
    : (action==='checkin'?'เช็กอินสำเร็จ':'เช็กเอาต์สำเร็จ');
  if(already){
    $('#message').textContent=action==='checkin'
      ? 'ระบบไม่ได้บันทึกซ้ำ รายละเอียดด้านล่างคือรายการเช็กอินเดิมของวันนี้'
      : 'ระบบไม่ได้บันทึกซ้ำ รายละเอียดด้านล่างคือรายการเช็กเอาต์เดิมของวันนี้';
  }else{
    $('#message').textContent=sent
      ? 'บันทึกเข้าระบบ HR แล้ว และส่งรายละเอียดกลับไปที่ LINE เรียบร้อย'
      : 'บันทึกเข้าระบบ HR แล้ว แต่ LINE ยังส่งข้อความยืนยันไม่สำเร็จ';
  }
  $('#timeText').textContent=formatTime(action==='checkin'?result.check_in_at:result.check_out_at);
  $('#locationLabel').textContent=already
    ? (action==='checkin'?'จุดที่เช็กอินเดิม':'จุดที่เช็กเอาต์เดิม')
    : (action==='checkin'?'จุดที่เช็กอินจริง':'จุดที่เช็กเอาต์จริง');
  $('#locationText').textContent=result.source_title||result.source_address||((result.lat!=null&&result.lng!=null)?`${Number(result.lat).toFixed(5)}, ${Number(result.lng).toFixed(5)}`:'—');
  $('#workLocationText').textContent=result.location_name||'—';
  $('#distanceText').textContent=formatDistance(result.distance_m);
  const acc=Number(position?.coords?.accuracy??payload.accuracy_m??result.accuracy_m); $('#accuracyText').textContent=Number.isFinite(acc)?`±${Math.round(acc)} ม.`:'—';
  if(already&&current){
    const currentText=current.source_title||current.source_address||((current.lat!=null&&current.lng!=null)?`${Number(current.lat).toFixed(5)}, ${Number(current.lng).toFixed(5)}`:'—');
    $('#currentPositionText').textContent=currentText;
    $('#currentPositionRow').classList.remove('hidden');
  }else{
    $('#currentPositionRow').classList.add('hidden');
  }
  $('#systemText').textContent=already?'มีรายการเดิมอยู่แล้ว':'บันทึกแล้ว';
  $('#lineText').textContent=sent?(already?'ส่งแจ้งเตือนรายการเดิมแล้ว':'ส่งข้อความแล้ว'):'ยังส่งไม่สำเร็จ';
  $('#lineText').className=sent?'status-ok':'status-warn';
  $('#detailCard').classList.remove('hidden');
  $('#retryBtn').classList.toggle('hidden',sent);
  if(!sent)$('#retryBtn').textContent='ส่งสถานะเข้า LINE อีกครั้ง';
  $('#permissionHint').classList.add('hidden');
}
function locate(){
  return new Promise((resolve,reject)=>{
    if(!navigator.geolocation)return reject(Object.assign(new Error('อุปกรณ์นี้ไม่รองรับการอ่านตำแหน่ง'),{code:0}));
    let best=null, settled=false;
    const started=Date.now();
    const finish=(value,error)=>{
      if(settled)return; settled=true;
      try{navigator.geolocation.clearWatch(watchId);}catch{}
      clearTimeout(timer);
      error?reject(error):resolve(value);
    };
    const watchId=navigator.geolocation.watchPosition(position=>{
      const age=Math.max(0,Date.now()-Number(position.timestamp||0));
      if(age>30000)return; // never accept a stale cached fix
      if(!best||Number(position.coords.accuracy)<Number(best.coords.accuracy))best=position;
      const accuracy=Number(position.coords.accuracy||99999);
      if(accuracy<=80&&Date.now()-started>700)finish(best||position,null);
    },error=>finish(null,error),{enableHighAccuracy:true,timeout:14000,maximumAge:0});
    const timer=setTimeout(()=>{
      if(best)finish(best,null);
      else finish(null,Object.assign(new Error('อ่านตำแหน่งนานเกินไป'),{code:3}));
    },11000);
  });
}
async function submit(){
  if(busy)return; busy=true;
  try{
    if(!token){setError('ลิงก์ไม่ถูกต้อง กรุณากดเมนูใน LINE ใหม่อีกครั้ง');return;}
    setLoading('กำลังอ่านตำแหน่งปัจจุบัน…');
    const position=await locate();
    const positionAge=Math.max(0,Date.now()-Number(position.timestamp||0));
    if(positionAge>30000) throw new Error('ตำแหน่งจากมือถือเก่าเกินไป กรุณาเปิด Location แล้วลองใหม่');
    setLoading('ได้ตำแหน่งแล้ว กำลังตรวจ Work Location และบันทึกเวลา…');
    const endpoint=action==='checkin'?'check-in':'check-out';
    const response=await fetch(`/api/public/attendance/${encodeURIComponent(token)}/${endpoint}`,{
      method:'POST',headers:{'content-type':'application/json','accept':'application/json'},cache:'no-store',
      body:JSON.stringify({latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy,position_timestamp:new Date(position.timestamp||Date.now()).toISOString()})
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
