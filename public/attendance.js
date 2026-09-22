const $=s=>document.querySelector(s);
const params=new URLSearchParams(location.search);
const token=String(params.get('token')||'').trim();
const action=params.get('action')==='checkout'?'checkout':'checkin';
let busy=false;

const GPS={
  freshMs:30000,
  goodAccuracyM:100,
  usableAccuracyM:250,
};

function setLoading(message){
  $('#stateIcon').className='state-icon loading';
  $('#stateIcon').innerHTML='<span class="spinner"></span>';
  $('#title').textContent=action==='checkin'?'กำลังเช็กอิน…':'กำลังเช็กเอาต์…';
  $('#message').textContent=message||'กำลังอ่าน GPS จากมือถือของคุณ';
  $('#retryBtn').classList.add('hidden');
  $('#permissionHint').classList.add('hidden');
  $('#detailCard').classList.add('hidden');
  const d=$('#diagnosticText'); if(d){d.textContent='';d.classList.add('hidden');}
}
function setError(message,{permission=false,code='',detail=''}={}){
  $('#stateIcon').className='state-icon error';
  $('#stateIcon').textContent='!';
  $('#title').textContent=action==='checkin'?'เช็กอินไม่สำเร็จ':'เช็กเอาต์ไม่สำเร็จ';
  $('#message').textContent=message||'กรุณาลองใหม่อีกครั้ง';
  $('#retryBtn').classList.remove('hidden');
  $('#retryBtn').textContent='ลองใหม่';
  $('#permissionHint').classList.toggle('hidden',!permission);
  const d=$('#diagnosticText');
  if(d){
    const parts=[];
    if(code)parts.push(`รหัส ${code}`);
    if(detail)parts.push(detail);
    d.textContent=parts.join(' · ');
    d.classList.toggle('hidden',!parts.length);
  }
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
  const inside=result.location_status==='inside_work_location'||Boolean(result.matched_work_location);
  $('#locationLabel').textContent=already
    ? (action==='checkin'?'จุดที่เช็กอินเดิม':'จุดที่เช็กเอาต์เดิม')
    : (inside?'สถานที่ที่ลงเวลา':(action==='checkin'?'จุดที่เช็กอินจริง':'จุดที่เช็กเอาต์จริง'));
  $('#locationText').textContent=inside
    ? (result.location_name||result.source_title||'—')
    : (result.nearby_name
      ? `${result.nearby_relation||'ใกล้'} ${result.nearby_name}${result.nearby_distance_text?` · ${result.nearby_distance_text}`:''}`
      : (result.source_title||result.source_address||((result.lat!=null&&result.lng!=null)?`${Number(result.lat).toFixed(5)}, ${Number(result.lng).toFixed(5)}`:'—')));
  $('#areaStatusText').textContent=inside?'อยู่ในพื้นที่บริษัท':(result.outside_geofence?'นอกพื้นที่บริษัท':'ตรวจสอบจาก GPS');
  $('#areaStatusText').className=inside?'status-ok':(result.outside_geofence?'status-warn':'');
  $('#workLocationText').textContent=result.location_name||'—';
  $('#workLocationRow').classList.toggle('hidden',inside);
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
  const d=$('#diagnosticText'); if(d){d.textContent='';d.classList.add('hidden');}
}

function runtimeInfo(){
  const ua=String(navigator.userAgent||'');
  const line=ua.match(/Line\/([\d.]+)/i);
  const ios=ua.match(/(?:CPU (?:iPhone )?OS|iPhone OS)\s*([\d_]+)/i);
  const android=ua.match(/Android\s+([\d.]+)/i);
  const crios=ua.match(/CriOS\/([\d.]+)/i);
  const fxios=ua.match(/FxiOS\/([\d.]+)/i);
  const safari=ua.match(/Version\/([\d.]+).*Safari/i);
  let browserName='WebView',browserVersion='';
  if(line){browserName='LINE In-App Browser';browserVersion=line[1]||'';}
  else if(crios){browserName='Chrome iOS';browserVersion=crios[1]||'';}
  else if(fxios){browserName='Firefox iOS';browserVersion=fxios[1]||'';}
  else if(safari){browserName='Safari';browserVersion=safari[1]||'';}
  else if(/Chrome\/([\d.]+)/i.test(ua)){browserName='Chrome';browserVersion=(ua.match(/Chrome\/([\d.]+)/i)||[])[1]||'';}
  return {
    user_agent:ua.slice(0,500),
    browser_name:browserName,
    browser_version:browserVersion,
    os_name:ios?'iOS':(android?'Android':String(navigator.platform||'Unknown')),
    os_version:ios?String(ios[1]||'').replaceAll('_','.'):(android?.[1]||''),
    line_version:line?.[1]||'',
    visibility_state:String(document.visibilityState||''),
    is_secure_context:Boolean(window.isSecureContext),
  };
}

async function permissionState(){
  if(!navigator.permissions?.query)return 'unsupported';
  try{
    const status=await navigator.permissions.query({name:'geolocation'});
    return String(status?.state||'unknown');
  }catch{return 'unsupported';}
}

function postGpsLog(stage,data={}){
  if(!token)return;
  const payload={action,stage,...runtimeInfo(),...data};
  fetch(`/api/public/attendance/${encodeURIComponent(token)}/gps-log`,{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),
    cache:'no-store',keepalive:true,
  }).catch(()=>{});
}

function gpsError(code,message,extra={}){
  const e=new Error(message||code);
  e.gpsCode=code;
  e.code=extra.nativeCode??0;
  Object.assign(e,extra);
  return e;
}

function nativeCodeName(code){
  if(Number(code)===1)return 'PERMISSION_DENIED';
  if(Number(code)===2)return 'POSITION_UNAVAILABLE';
  if(Number(code)===3)return 'TIMEOUT';
  return 'UNKNOWN';
}

function positionAge(position){return Math.max(0,Date.now()-Number(position?.timestamp||0));}
function isFresh(position){return Boolean(position)&&positionAge(position)<=GPS.freshMs;}
function accuracyOf(position){const n=Number(position?.coords?.accuracy);return Number.isFinite(n)?n:Infinity;}
function better(a,b){if(!a)return b;if(!b)return a;return accuracyOf(b)<accuracyOf(a)?b:a;}

async function waitUntilVisible(){
  if(document.visibilityState==='visible')return true;
  postGpsLog('page_hidden',{outcome:'waiting'});
  return new Promise(resolve=>{
    let done=false;
    const finish=v=>{if(done)return;done=true;document.removeEventListener('visibilitychange',onChange);clearTimeout(timer);resolve(v);};
    const onChange=()=>{if(document.visibilityState==='visible')finish(true);};
    const timer=setTimeout(()=>finish(document.visibilityState==='visible'),4000);
    document.addEventListener('visibilitychange',onChange);
  });
}

function oneShotPosition({attempt,label,enableHighAccuracy,timeout,maximumAge}){
  return new Promise((resolve,reject)=>{
    const started=performance.now();
    postGpsLog('gps_attempt_start',{attempt,outcome:'start',error_message:label,permission_state:'pending'});
    try{navigator.geolocation.getCurrentPosition(position=>{
      const elapsed=Math.round(performance.now()-started);
      const acc=accuracyOf(position);
      if(!isFresh(position)){
        const err=gpsError('STALE_LOCATION_FIX','ตำแหน่งที่ได้รับเก่าเกินไป',{accuracy:acc,elapsed});
        postGpsLog('gps_attempt_result',{attempt,outcome:'error',error_code:err.gpsCode,error_message:err.message,accuracy_m:Number.isFinite(acc)?Math.round(acc):null,elapsed_ms:elapsed});
        reject(err);return;
      }
      postGpsLog('gps_attempt_result',{attempt,outcome:'success',accuracy_m:Number.isFinite(acc)?Math.round(acc):null,elapsed_ms:elapsed,error_message:label});
      resolve(position);
    },error=>{
      const elapsed=Math.round(performance.now()-started);
      const code=nativeCodeName(error?.code);
      const err=gpsError(code,String(error?.message||code),{nativeCode:Number(error?.code||0),elapsed});
      postGpsLog('gps_attempt_result',{attempt,outcome:'error',error_code:code,error_message:String(error?.message||code),elapsed_ms:elapsed});
      reject(err);
    },{enableHighAccuracy,timeout,maximumAge});}
    catch(error){
      const elapsed=Math.round(performance.now()-started);
      const err=gpsError('POSITION_UNAVAILABLE',String(error?.message||'เรียก Geolocation API ไม่สำเร็จ'),{nativeCode:2,elapsed});
      postGpsLog('gps_attempt_result',{attempt,outcome:'error',error_code:err.gpsCode,error_message:err.message,elapsed_ms:elapsed});
      reject(err);
    }
  });
}

function watchForBestPosition({attempt=3,timeoutMs=9000,seed=null}={}){
  return new Promise((resolve,reject)=>{
    const started=performance.now();
    let best=seed||null,lastNativeError=null,settled=false,watchId=null;
    const finish=(position,error)=>{
      if(settled)return;settled=true;
      if(watchId!=null){try{navigator.geolocation.clearWatch(watchId);}catch{}}
      clearTimeout(timer);
      const elapsed=Math.round(performance.now()-started);
      if(error){
        postGpsLog('gps_attempt_result',{attempt,outcome:'error',error_code:error.gpsCode||'UNKNOWN',error_message:error.message||'',accuracy_m:Number.isFinite(accuracyOf(best))?Math.round(accuracyOf(best)):null,elapsed_ms:elapsed});
        reject(error);
      }else{
        postGpsLog('gps_attempt_result',{attempt,outcome:'success',accuracy_m:Math.round(accuracyOf(position)),elapsed_ms:elapsed,error_message:'watchPosition refinement'});
        resolve(position);
      }
    };
    postGpsLog('gps_attempt_start',{attempt,outcome:'start',error_message:'watchPosition high-accuracy refinement'});
    try{watchId=navigator.geolocation.watchPosition(position=>{
      if(!isFresh(position))return;
      best=better(best,position);
      const acc=accuracyOf(best);
      if(acc<=GPS.goodAccuracyM && performance.now()-started>500)finish(best,null);
    },error=>{
      const code=nativeCodeName(error?.code);
      lastNativeError=gpsError(code,String(error?.message||code),{nativeCode:Number(error?.code||0)});
      if(code==='PERMISSION_DENIED')finish(null,lastNativeError);
    },{enableHighAccuracy:true,timeout:timeoutMs+1500,maximumAge:0});}
    catch(error){
      lastNativeError=gpsError('POSITION_UNAVAILABLE',String(error?.message||'เรียก watchPosition ไม่สำเร็จ'),{nativeCode:2});
    }
    const timer=setTimeout(()=>{
      const acc=accuracyOf(best);
      if(best&&isFresh(best)&&acc<=GPS.usableAccuracyM){finish(best,null);return;}
      if(best&&Number.isFinite(acc)){
        finish(null,gpsError('LOW_ACCURACY',`ตำแหน่งยังไม่แม่นพอ (±${Math.round(acc)} ม.)`,{accuracy:acc}));return;
      }
      finish(null,lastNativeError||gpsError('TIMEOUT','Geolocation API ไม่คืนพิกัดภายในเวลาที่กำหนด',{nativeCode:3}));
    },timeoutMs);
  });
}

async function locate(){
  const info=runtimeInfo();
  if(!window.isSecureContext){
    const e=gpsError('INSECURE_CONTEXT','หน้านี้ไม่ได้เปิดผ่านการเชื่อมต่อที่ปลอดภัย');
    postGpsLog('preflight',{outcome:'error',error_code:e.gpsCode,error_message:e.message});
    throw e;
  }
  if(!navigator.geolocation){
    const e=gpsError('GEOLOCATION_UNSUPPORTED','Browser นี้ไม่รองรับ Location');
    postGpsLog('preflight',{outcome:'error',error_code:e.gpsCode,error_message:e.message});
    throw e;
  }

  const visible=await waitUntilVisible();
  if(!visible){
    const e=gpsError('PAGE_NOT_VISIBLE','หน้าเช็กอินยังไม่ได้อยู่ด้านหน้า กรุณากลับมาที่หน้านี้แล้วลองใหม่');
    postGpsLog('preflight',{outcome:'error',error_code:e.gpsCode,error_message:e.message});
    throw e;
  }

  const perm=await permissionState();
  postGpsLog('preflight',{outcome:'ok',permission_state:perm,error_message:`${info.browser_name}${info.line_version?` LINE ${info.line_version}`:''}`});
  if(perm==='denied')throw gpsError('PERMISSION_DENIED','Browser ปฏิเสธสิทธิ์ Location',{nativeCode:1});

  let best=null,lastError=null;
  const attempts=[
    {attempt:1,label:'high accuracy fresh fix',enableHighAccuracy:true,timeout:6500,maximumAge:0},
    {attempt:2,label:'automatic retry / balanced fallback',enableHighAccuracy:false,timeout:5500,maximumAge:10000},
  ];

  for(const spec of attempts){
    setLoading(spec.attempt===1?'กำลังอ่านตำแหน่งปัจจุบัน…':'ยังไม่ได้พิกัด กำลังลองอ่านตำแหน่งให้อีกครั้งอัตโนมัติ…');
    try{
      const position=await oneShotPosition(spec);
      best=better(best,position);
      if(accuracyOf(position)<=GPS.goodAccuracyM)return position;
      if(spec.attempt===2&&accuracyOf(best)<=GPS.usableAccuracyM)return best;
    }catch(error){
      lastError=error;
      if(error?.gpsCode==='PERMISSION_DENIED')throw error;
      await new Promise(r=>setTimeout(r,350));
    }
  }

  setLoading('กำลังปรับความแม่นยำ GPS รอบสุดท้าย…');
  try{return await watchForBestPosition({attempt:3,timeoutMs:9000,seed:best});}
  catch(error){
    if(best&&isFresh(best)&&accuracyOf(best)<=GPS.usableAccuracyM)return best;
    throw error||lastError||gpsError('POSITION_UNAVAILABLE','ยังไม่สามารถอ่านตำแหน่งปัจจุบันได้',{nativeCode:2});
  }
}

function errorUi(error){
  const code=String(error?.gpsCode||nativeCodeName(error?.code)||'UNKNOWN');
  const rt=runtimeInfo();
  const context=rt.browser_name==='LINE In-App Browser'?(rt.os_name==='iOS'?'LINE บน iPhone':'LINE Browser'):(rt.browser_name||'Browser');
  const acc=Number(error?.accuracy);
  if(code==='PERMISSION_DENIED')return {message:'ไม่ได้รับสิทธิ์ตำแหน่งจาก Browser กรุณาอนุญาต Location แล้วกด “ลองใหม่”',permission:true,code,detail:context};
  if(code==='POSITION_UNAVAILABLE')return {message:'ระบบ Location ของเครื่องยังหาพิกัดปัจจุบันไม่ได้ กรุณาเปิด Location/Wi‑Fi แล้วลองใหม่',code,detail:context};
  if(code==='TIMEOUT')return {message:'Geolocation API ไม่คืนพิกัดในรอบนี้ ระบบได้ลองให้อัตโนมัติแล้ว กรุณากด “ลองใหม่”',code,detail:context};
  if(code==='LOW_ACCURACY')return {message:`ตำแหน่งที่อ่านได้ยังไม่แม่นพอ${Number.isFinite(acc)?` (ประมาณ ±${Math.round(acc)} ม.)`:''} กรุณารอสักครู่หรือย้ายไปจุดที่รับสัญญาณได้ดีขึ้น`,code,detail:context};
  if(code==='PAGE_NOT_VISIBLE')return {message:'หน้าเช็กอินไม่ได้อยู่ด้านหน้า กรุณากลับมาที่หน้านี้แล้วกด “ลองใหม่”',code,detail:context};
  if(code==='INSECURE_CONTEXT')return {message:'Browser ไม่อนุญาต Location เพราะหน้าเว็บไม่ได้อยู่ใน Secure Context',code,detail:context};
  if(code==='GEOLOCATION_UNSUPPORTED')return {message:'Browser นี้ไม่รองรับการอ่านตำแหน่ง',code,detail:context};
  if(code==='STALE_LOCATION_FIX')return {message:'พิกัดที่เครื่องส่งมาเป็นตำแหน่งเก่า ระบบไม่ได้นำไปเช็กอิน กรุณาลองใหม่',code,detail:context};
  return {message:error?.message||'เกิดข้อผิดพลาด กรุณาลองใหม่',code,detail:context};
}

async function submit(){
  if(busy)return; busy=true;
  const totalStarted=performance.now();
  try{
    if(!token){setError('ลิงก์ไม่ถูกต้อง กรุณากดเมนูใน LINE ใหม่อีกครั้ง',{code:'INVALID_TOKEN'});return;}
    setLoading('กำลังตรวจสิทธิ์และอ่านตำแหน่งปัจจุบัน…');
    const position=await locate();
    const positionAgeMs=positionAge(position);
    const accuracy=accuracyOf(position);
    if(positionAgeMs>GPS.freshMs)throw gpsError('STALE_LOCATION_FIX','ตำแหน่งจากมือถือเก่าเกินไป กรุณาเปิด Location แล้วลองใหม่',{accuracy});
    if(accuracy>GPS.usableAccuracyM)throw gpsError('LOW_ACCURACY',`ตำแหน่งยังไม่แม่นพอ (±${Math.round(accuracy)} ม.)`,{accuracy});

    postGpsLog('gps_acquired',{outcome:'success',accuracy_m:Math.round(accuracy),elapsed_ms:Math.round(performance.now()-totalStarted),permission_state:await permissionState()});
    setLoading(`ได้ตำแหน่งแล้ว (±${Math.round(accuracy)} ม.) กำลังตรวจ Work Location และบันทึกเวลา…`);
    const endpoint=action==='checkin'?'check-in':'check-out';
    const response=await fetch(`/api/public/attendance/${encodeURIComponent(token)}/${endpoint}`,{
      method:'POST',headers:{'content-type':'application/json','accept':'application/json'},cache:'no-store',
      body:JSON.stringify({
        latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy,
        position_timestamp:new Date(position.timestamp||Date.now()).toISOString(),
        gps_meta:{...runtimeInfo(),acquisition_ms:Math.round(performance.now()-totalStarted),permission_state:await permissionState()}
      })
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
      const serverError=gpsError(String(data.code||'ATTENDANCE_FAILED'),data.error||'ระบบบันทึกเวลาไม่สำเร็จ',{accuracy});
      throw serverError;
    }
    postGpsLog('attendance_saved',{outcome:'success',accuracy_m:Math.round(accuracy),elapsed_ms:Math.round(performance.now()-totalStarted)});
    setSuccess(data,position);
  }catch(error){
    const ui=errorUi(error);
    postGpsLog('attendance_failed',{outcome:'error',error_code:ui.code,error_message:String(error?.message||ui.message),accuracy_m:Number.isFinite(Number(error?.accuracy))?Math.round(Number(error.accuracy)):null,elapsed_ms:Math.round(performance.now()-totalStarted),permission_state:await permissionState()});
    setError(ui.message,{permission:ui.permission,code:ui.code,detail:ui.detail});
  }finally{busy=false;}
}

$('#retryBtn').addEventListener('click',submit);
window.addEventListener('pageshow',()=>{if(!busy)submit();},{once:true});
