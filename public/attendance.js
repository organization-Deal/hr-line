const $=s=>document.querySelector(s);
const params=new URLSearchParams(location.search);
const token=String(params.get('token')||'').trim();
const action=params.get('action')==='checkout'?'checkout':'checkin';
const facePageMode=['enroll','test','manage'].includes(String(params.get('face')||'').toLowerCase())?String(params.get('face')).toLowerCase():'attendance';
const standaloneFaceFlow=facePageMode!=='attendance';
let busy=false;
let facePreparing=false;
let faceFlowBusy=false;
let faceStatus=null;
let faceVerificationToken=null;
let faceStream=null;
let faceModelsReady=false;
const FACE_MODEL_VERSION='face-api-0.22.2';
const FACE_MODEL_URL='https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';
if(standaloneFaceFlow){
  document.title='นากนะ · ยืนยันตัวตน';
  const eyebrow=document.querySelector('.brand-row .eyebrow');
  if(eyebrow)eyebrow.textContent='NAKNA · FACE VERIFICATION';
}

const GPS={
  freshMs:30000,
  goodAccuracyM:100,
  usableAccuracyM:250,
};

function setLoading(message){
  $('#stateIcon').className='state-icon loading';
  $('#stateIcon').innerHTML='<span class="spinner"></span>';
  $('#title').textContent=standaloneFaceFlow?'กำลังเตรียม Face Verification…':(action==='checkin'?'กำลังเช็กอิน…':'กำลังเช็กเอาต์…');
  $('#message').textContent=message||(standaloneFaceFlow?'กำลังตรวจสถานะใบหน้าของคุณ':'กำลังอ่าน GPS จากมือถือของคุณ');
  $('#retryBtn').classList.add('hidden');
  $('#permissionHint').classList.add('hidden');
  $('#detailCard').classList.add('hidden');
  if(!faceFlowBusy)$('#facePanel')?.classList.add('hidden');
  const d=$('#diagnosticText'); if(d){d.textContent='';d.classList.add('hidden');}
}
function setError(message,{permission=false,code='',detail=''}={}){
  $('#stateIcon').className='state-icon error';
  $('#stateIcon').textContent='!';
  $('#title').textContent=standaloneFaceFlow?'Face Verification ไม่สำเร็จ':(action==='checkin'?'เช็กอินไม่สำเร็จ':'เช็กเอาต์ไม่สำเร็จ');
  $('#message').textContent=message||'กรุณาลองใหม่อีกครั้ง';
  $('#retryBtn').classList.remove('hidden');
  $('#retryBtn').textContent='ลองใหม่';
  $('#permissionHint').classList.toggle('hidden',!permission);
  $('#facePanel')?.classList.add('hidden');
  stopFaceCamera();
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
  const faceResult=payload.face_verification||{};
  $('#faceResultRow')?.classList.toggle('hidden',!faceResult.required&&!faceResult.verified);
  if($('#faceResultText')) $('#faceResultText').textContent=faceResult.verified?'ผ่าน':'ไม่บังคับ';
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


function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function setFaceStep(step,state='active'){
  const map={camera:'#faceStepCamera',live:'#faceStepLive',match:'#faceStepMatch'};
  for(const [name,selector] of Object.entries(map)){
    const el=$(selector);if(!el)continue;
    if(name===step){el.classList.add(state);if(state==='done')el.classList.remove('active');}
    else if(state==='active'&&name!==step&&!el.classList.contains('done'))el.classList.remove('active');
  }
}
function resetFaceSteps(){for(const id of ['#faceStepCamera','#faceStepLive','#faceStepMatch']){$(id)?.classList.remove('active','done');}}
function showFacePanel({title,instruction,allowSkip=false,startLabel='เริ่มสแกนใบหน้า'}={}){
  const panel=$('#facePanel');panel?.classList.remove('hidden','is-error','is-success');
  $('#detailCard')?.classList.add('hidden');$('#retryBtn')?.classList.add('hidden');$('#permissionHint')?.classList.add('hidden');
  $('#stateIcon').className='state-icon';$('#stateIcon').textContent='◎';
  $('#title').textContent=title||'ยืนยันตัวตนด้วยใบหน้า';
  $('#message').textContent=instruction||'ระบบจะตรวจว่าเป็นเจ้าของบัญชีจริงก่อนบันทึกเวลา';
  $('#faceTitle').textContent=title||'Face Verification';
  $('#faceInstruction').textContent='มองตรงเข้ากล้อง และทำตามคำแนะนำบนหน้าจอ';
  $('#faceStartBtn').textContent=startLabel;
  $('#faceStartBtn').disabled=false;
  $('#faceSkipBtn').classList.toggle('hidden',!allowSkip);
  $('#faceCameraState').textContent='กล้องยังไม่เปิด';
  resetFaceSteps();
}
async function waitForFaceApi(timeoutMs=10000){
  const started=Date.now();
  while(Date.now()-started<timeoutMs){if(window.faceapi?.nets?.tinyFaceDetector)return window.faceapi;await sleep(100);}
  throw Object.assign(new Error('โหลดระบบตรวจใบหน้าไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่'),{faceCode:'FACE_ENGINE_LOAD_FAILED'});
}
async function loadFaceModels(){
  if(faceModelsReady)return;
  $('#faceCameraState').textContent='กำลังโหลดโมเดลตรวจใบหน้า…';
  const api=await waitForFaceApi();
  await Promise.all([
    api.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL),
    api.nets.faceLandmark68TinyNet.loadFromUri(FACE_MODEL_URL),
    api.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_URL),
  ]);
  faceModelsReady=true;
}
async function startFaceCamera(){
  if(!navigator.mediaDevices?.getUserMedia)throw Object.assign(new Error('Browser นี้ไม่รองรับกล้องสำหรับ Face Verification'),{faceCode:'CAMERA_UNSUPPORTED'});
  stopFaceCamera();
  try{
    faceStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false});
  }catch(error){
    const denied=String(error?.name||'').includes('NotAllowed');
    throw Object.assign(new Error(denied?'ยังไม่ได้อนุญาต Camera กรุณาเปิดสิทธิ์กล้องแล้วลองใหม่':'เปิดกล้องไม่สำเร็จ กรุณาลองใหม่'),{faceCode:denied?'CAMERA_DENIED':'CAMERA_FAILED'});
  }
  const video=$('#faceVideo');video.srcObject=faceStream;await video.play();
  await new Promise(resolve=>{if(video.readyState>=2)return resolve();video.onloadeddata=()=>resolve();setTimeout(resolve,1500);});
  $('#faceCameraState').textContent='กล้องพร้อม · ให้ใบหน้าอยู่ในกรอบ';
  setFaceStep('camera','done');
}
function stopFaceCamera(){
  if(faceStream){for(const track of faceStream.getTracks())try{track.stop()}catch{};faceStream=null;}
  const video=$('#faceVideo');if(video){try{video.pause()}catch{};video.srcObject=null;}
}
function tinyOptions(){return new faceapi.TinyFaceDetectorOptions({inputSize:224,scoreThreshold:0.5});}
async function detectFaces({withDescriptor=false}={}){
  const video=$('#faceVideo');if(!video?.videoWidth)throw Object.assign(new Error('กล้องยังไม่พร้อม'),{faceCode:'CAMERA_NOT_READY'});
  let result=faceapi.detectAllFaces(video,tinyOptions()).withFaceLandmarks(true);
  if(withDescriptor)result=result.withFaceDescriptors();
  const faces=await result;
  if(faces.length===0)throw Object.assign(new Error('ยังไม่พบใบหน้า กรุณามองตรงเข้ากล้อง'),{faceCode:'FACE_NOT_FOUND'});
  if(faces.length>1)throw Object.assign(new Error('พบมากกว่า 1 ใบหน้า กรุณาให้มีคนเดียวในกล้อง'),{faceCode:'MULTIPLE_FACES'});
  const face=faces[0];
  const box=face.detection?.box;const ratio=box&&video.videoWidth?box.width/video.videoWidth:0;
  if(ratio<0.24)throw Object.assign(new Error('ใบหน้าอยู่ไกลเกินไป กรุณาขยับเข้าใกล้กล้อง'),{faceCode:'FACE_TOO_FAR'});
  return face;
}
function dist2d(a,b){return Math.hypot(Number(a.x)-Number(b.x),Number(a.y)-Number(b.y));}
function eyeAspect(points,idx){
  const p=idx.map(i=>points[i]);
  return (dist2d(p[1],p[5])+dist2d(p[2],p[4]))/(2*Math.max(1,dist2d(p[0],p[3])));
}
function faceMotionMetrics(face){
  const points=face.landmarks.positions;
  const left=[36,37,38,39,40,41],right=[42,43,44,45,46,47];
  const ear=(eyeAspect(points,left)+eyeAspect(points,right))/2;
  const leftCenter={x:(points[36].x+points[39].x)/2,y:(points[36].y+points[39].y)/2};
  const rightCenter={x:(points[42].x+points[45].x)/2,y:(points[42].y+points[45].y)/2};
  const eyeDistance=Math.max(1,dist2d(leftCenter,rightCenter));
  const eyeMidX=(leftCenter.x+rightCenter.x)/2;
  const noseOffset=(points[30].x-eyeMidX)/eyeDistance;
  return {ear,noseOffset};
}
async function waitForLivenessAction(action,timeoutMs=10000){
  const started=Date.now();let seenOpen=false,seenClosed=false,seenNeutral=false,lastMessage='';
  while(Date.now()-started<timeoutMs){
    try{
      const face=await detectFaces();const m=faceMotionMetrics(face);
      if(action==='blink'){
        if(m.ear>0.20)seenOpen=true;
        if(seenOpen&&m.ear<0.16)seenClosed=true;
        if(seenClosed&&m.ear>0.19)return true;
        lastMessage='กระพริบตา 1 ครั้ง';
      }else{
        if(Math.abs(m.noseOffset)<0.11)seenNeutral=true;
        if(seenNeutral&&Math.abs(m.noseOffset)>0.19)return true;
        lastMessage='หันหน้าไปด้านข้างเล็กน้อย';
      }
      $('#faceCameraState').textContent=lastMessage;
    }catch(error){$('#faceCameraState').textContent=error.message||'จัดใบหน้าให้อยู่ในกรอบ';}
    await sleep(170);
  }
  throw Object.assign(new Error(action==='blink'?'ยังตรวจการกระพริบตาไม่สำเร็จ กรุณาลองใหม่':'ยังตรวจการหันหน้าไม่สำเร็จ กรุณาลองใหม่'),{faceCode:'LIVENESS_FAILED'});
}
async function runLiveness(actions){
  setFaceStep('live','active');
  const result={blink:false,turn:false};
  for(const action of actions||[]){
    $('#faceInstruction').textContent=action==='blink'?'กระพริบตา 1 ครั้ง':'มองตรงก่อน แล้วหันหน้าไปด้านข้างเล็กน้อย';
    $('#faceCameraState').textContent=$('#faceInstruction').textContent;
    await waitForLivenessAction(action);
    result[action]=true;
    $('#faceCameraState').textContent=action==='blink'?'ตรวจการกระพริบตาแล้ว ✓':'ตรวจการหันหน้าแล้ว ✓';
    await sleep(450);
  }
  setFaceStep('live','done');
  return result;
}
function normalizeDescriptor(values){
  const arr=Array.from(values||[],Number);let norm=Math.sqrt(arr.reduce((sum,v)=>sum+v*v,0))||1;
  return arr.map(v=>Number((v/norm).toFixed(8)));
}
async function captureFaceDescriptor(samples=3){
  setFaceStep('match','active');$('#faceInstruction').textContent='มองตรงเข้ากล้อง ระบบกำลังอ่าน Face Template';
  const descriptors=[];
  for(let i=0;i<samples;i++){
    let face=null;
    for(let retry=0;retry<8&&!face;retry++){
      try{face=await detectFaces({withDescriptor:true});}catch(error){$('#faceCameraState').textContent=error.message||'จัดใบหน้าให้อยู่ในกรอบ';await sleep(220);}
    }
    if(!face?.descriptor)throw Object.assign(new Error('อ่าน Face Template ไม่สำเร็จ กรุณาลองใหม่'),{faceCode:'FACE_DESCRIPTOR_FAILED'});
    descriptors.push(Array.from(face.descriptor,Number));$('#faceCameraState').textContent=`อ่านใบหน้า ${i+1}/${samples}`;await sleep(280);
  }
  const avg=new Array(128).fill(0);for(const d of descriptors)for(let i=0;i<128;i++)avg[i]+=d[i]/descriptors.length;
  setFaceStep('match','done');return normalizeDescriptor(avg);
}
async function facePost(path,body){
  const response=await fetch(`/api/public/attendance/${encodeURIComponent(token)}/${path}`,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},cache:'no-store',body:JSON.stringify(body||{})});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(new Error(data.error||'Face Verification ไม่สำเร็จ'),{faceCode:data.code||'FACE_API_FAILED',status:response.status});return data;
}
async function fetchFaceStatus(){
  const response=await fetch(`/api/public/attendance/${encodeURIComponent(token)}/face-status?action=${encodeURIComponent(action)}`,{headers:{accept:'application/json'},cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    const routeMissing=response.status===404&&String(data.error||'').toLowerCase().includes('route not found');
    if(routeMissing)throw Object.assign(new Error('Worker ฝั่งเซิร์ฟเวอร์ยังไม่ได้อัปเดต Face Verification กรุณา Deploy src/index.js เวอร์ชัน P9.15.3 แล้วเปิดจาก LINE ใหม่'),{faceCode:'FACE_BACKEND_ROUTE_MISSING',status:404});
    throw Object.assign(new Error(data.error||'ตรวจ Face Verification ไม่สำเร็จ'),{faceCode:data.code||'FACE_STATUS_FAILED',status:response.status});
  }
  return data;
}
function setStandaloneFaceDone(title,message){
  stopFaceCamera();
  $('#facePanel')?.classList.add('hidden');
  $('#detailCard')?.classList.add('hidden');
  $('#stateIcon').className='state-icon success';
  $('#stateIcon').textContent='✓';
  $('#title').textContent=title;
  $('#message').textContent=message;
  $('#retryBtn').classList.add('hidden');
  $('#permissionHint').classList.add('hidden');
  const d=$('#diagnosticText');if(d){d.textContent='';d.classList.add('hidden');}
}
async function performFaceFlow(){
  if(faceFlowBusy)return;faceFlowBusy=true;
  const button=$('#faceStartBtn');button.disabled=true;$('#facePanel')?.classList.remove('is-error');
  try{
    await loadFaceModels();await startFaceCamera();
    const enrollment=standaloneFaceFlow?!Boolean(faceStatus?.enrolled):Boolean(faceStatus?.enrollment_required||faceStatus?.enrollment_recommended);
    const testOnly=standaloneFaceFlow&&!enrollment;
    const purpose=enrollment?'enroll':(testOnly?'verify_test':(action==='checkout'?'verify_checkout':'verify_checkin'));
    const challenge=await facePost('face-challenge',{purpose});
    const liveness=await runLiveness(challenge.actions||[]);
    const descriptor=await captureFaceDescriptor(enrollment?3:2);
    $('#faceCameraState').textContent=enrollment?'กำลังบันทึก Face Template แบบเข้ารหัส…':'กำลังเทียบกับ Face Template ที่ลงทะเบียน…';
    const data=enrollment
      ? await facePost('face-enroll',{challenge_token:challenge.challenge_token,liveness,descriptor,model_version:FACE_MODEL_VERSION,action,face_only:standaloneFaceFlow})
      : await facePost('face-verify',{challenge_token:challenge.challenge_token,liveness,descriptor,model_version:FACE_MODEL_VERSION,action,test_mode:testOnly});
    faceVerificationToken=data.verification_token||null;
    if(faceStatus){faceStatus.enrolled=true;faceStatus.enrollment_required=false;faceStatus.enrollment_recommended=false;}
    $('#facePanel')?.classList.add('is-success');$('#faceCameraState').textContent=enrollment?'ลงทะเบียนใบหน้าแล้ว ✓':'ยืนยันใบหน้าแล้ว ✓';

    if(standaloneFaceFlow){
      $('#faceInstruction').textContent=enrollment?'Face Template ถูกบันทึกแบบเข้ารหัสแล้ว · ไม่มีการบันทึกรูปภาพ':'ทดสอบผ่าน · ใบหน้าตรงกับ Face Template ที่ลงทะเบียน';
      await sleep(650);
      if(enrollment){
        setStandaloneFaceDone('ลงทะเบียนใบหน้าสำเร็จ','พร้อมใช้ Face Verification ในการลงเวลาครั้งถัดไป · ระบบไม่ได้สร้างหรือแก้ไขรายการเช็กอินวันนี้');
      }else{
        setStandaloneFaceDone('ทดสอบ Face Verification ผ่าน','ยืนยันได้ว่าใบหน้าปัจจุบันตรงกับ Face Template ของบัญชีนี้ · ไม่มีการบันทึกเวลาและไม่มีการเก็บรูปภาพ');
      }
      return;
    }

    if(enrollment&&faceStatus?.already_recorded){
      $('#faceInstruction').textContent=action==='checkin'?'ลงทะเบียนเรียบร้อย · วันนี้มีเช็กอินอยู่แล้ว':'ลงทะเบียนเรียบร้อย · วันนี้มีเช็กเอาต์อยู่แล้ว';
      await sleep(850);stopFaceCamera();$('#facePanel')?.classList.add('hidden');
      $('#stateIcon').className='state-icon success';$('#stateIcon').textContent='✓';
      $('#title').textContent='ลงทะเบียนใบหน้าสำเร็จ';
      $('#message').textContent=action==='checkin'?'Face Template พร้อมใช้ตั้งแต่การเช็กอินครั้งถัดไป · วันนี้ระบบพบรายการเช็กอินเดิมแล้ว':'Face Template พร้อมใช้ตั้งแต่การเช็กเอาต์ครั้งถัดไป · วันนี้ระบบพบรายการเช็กเอาต์เดิมแล้ว';
      $('#retryBtn').classList.add('hidden');$('#permissionHint').classList.add('hidden');
      return;
    }
    $('#faceInstruction').textContent='ไม่บันทึกรูปภาพ · กำลังไปอ่านตำแหน่ง GPS';
    await sleep(650);stopFaceCamera();$('#facePanel')?.classList.add('hidden');
    await submit();
  }catch(error){
    $('#facePanel')?.classList.add('is-error');$('#faceCameraState').textContent=error.message||'สแกนใบหน้าไม่สำเร็จ';$('#faceInstruction').textContent='จัดใบหน้าให้อยู่ในกรอบ แล้วกดลองใหม่';button.disabled=false;
  }finally{faceFlowBusy=false;}
}
async function prepareAttendanceFlow(){
  if(facePreparing||busy||faceFlowBusy)return;facePreparing=true;
  try{
    if(!token){setError('ลิงก์ไม่ถูกต้อง กรุณาเปิดจาก LINE ใหม่อีกครั้ง',{code:'INVALID_TOKEN'});return;}
    setLoading(standaloneFaceFlow?'กำลังตรวจสถานะ Face Verification…':'กำลังตรวจเงื่อนไขการยืนยันตัวตน…');
    faceStatus=await fetchFaceStatus();

    if(standaloneFaceFlow){
      if(faceStatus.mode==='off'){setError('บริษัทนี้ยังไม่ได้เปิด Face Verification',{code:'FACE_DISABLED'});return;}
      if(!faceStatus.system_ready){setError('ระบบ Face Verification ของบริษัทยังตั้งค่าไม่ครบ กรุณาแจ้ง HR',{code:'FACE_SYSTEM_NOT_READY'});return;}
      if(facePageMode==='enroll'){
        if(faceStatus.enrolled){setStandaloneFaceDone('ลงทะเบียนใบหน้าแล้ว','บัญชีนี้มี Face Template พร้อมใช้งานอยู่แล้ว · ไม่ต้องลงทะเบียนซ้ำ');return;}
        showFacePanel({title:'ลงทะเบียนใบหน้า',instruction:'ใช้เวลาประมาณ 30 วินาที ระบบจะสร้าง Face Template แบบตัวเลขและไม่บันทึกรูปภาพ',allowSkip:false,startLabel:'เริ่มลงทะเบียนใบหน้า'});return;
      }
      if(facePageMode==='test'){
        if(!faceStatus.enrolled){setError('บัญชีนี้ยังไม่ได้ลงทะเบียนใบหน้า กรุณาลงทะเบียนก่อนทดสอบ',{code:'FACE_ENROLLMENT_REQUIRED'});return;}
        showFacePanel({title:'ทดสอบ Face Verification',instruction:'ทดสอบการจับคู่ใบหน้าโดยไม่บันทึกเวลาและไม่แก้ไข Attendance',allowSkip:false,startLabel:'เริ่มทดสอบใบหน้า'});return;
      }
      // manage: ถ้ายังไม่มี Template ให้ลงทะเบียน ถ้ามีแล้วให้ทดสอบได้ทันที
      if(!faceStatus.enrolled){
        showFacePanel({title:'ลงทะเบียนใบหน้า',instruction:'ตั้งค่า Face Template ของคุณก่อน หลังจากนี้เมนูนี้ใช้ทดสอบ Face Verification ได้ตลอด',allowSkip:false,startLabel:'เริ่มลงทะเบียนใบหน้า'});return;
      }
      showFacePanel({title:'ใบหน้า & การยืนยันตัวตน',instruction:'บัญชีนี้ลงทะเบียนแล้ว คุณสามารถทดสอบการยืนยันใบหน้าได้โดยไม่กระทบ Attendance',allowSkip:false,startLabel:'ทดสอบ Face Verification'});return;
    }

    if(faceStatus.mode!=='off'&&!faceStatus.system_ready){setError('ระบบ Face Verification ของบริษัทยังตั้งค่าไม่ครบ กรุณาแจ้ง HR',{code:'FACE_SYSTEM_NOT_READY'});return;}
    if(faceStatus.enrollment_required){showFacePanel({title:'ลงทะเบียนใบหน้าก่อนเช็กอิน',instruction:'ครั้งแรกระบบต้องจดจำ Face Template ของคุณก่อน หลังจากนี้จะใช้เทียบทุกครั้งที่บริษัทกำหนด',allowSkip:false,startLabel:'ลงทะเบียนใบหน้า'});return;}
    if(faceStatus.verify_required){showFacePanel({title:'ยืนยันใบหน้าก่อนลงเวลา',instruction:'ตรวจว่าเป็นเจ้าของบัญชีจริงก่อนบันทึกเวลา',allowSkip:false,startLabel:'สแกนหน้าและยืนยัน'});return;}
    if(faceStatus.enrollment_recommended){showFacePanel({title:'ตั้งค่าใบหน้าให้พร้อมใช้งาน',instruction:'บริษัทอยู่ในช่วงลงทะเบียน คุณสามารถตั้งค่าตอนนี้ หรือข้ามและเช็กอินตามปกติได้',allowSkip:true,startLabel:'ลงทะเบียนใบหน้าตอนนี้'});return;}
    await submit();
  }catch(error){setError(error.message||(standaloneFaceFlow?'เตรียม Face Verification ไม่สำเร็จ':'เตรียมการเช็กอินไม่สำเร็จ'),{code:error.faceCode||'FACE_STATUS_FAILED'});}finally{facePreparing=false;}
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
        face_verification_token:faceVerificationToken||null,
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
    if(String(error?.gpsCode||'').startsWith('FACE_')||String(error?.message||'').includes('ยืนยันใบหน้า')){
      faceVerificationToken=null;busy=false;await prepareAttendanceFlow();return;
    }
    const ui=errorUi(error);
    postGpsLog('attendance_failed',{outcome:'error',error_code:ui.code,error_message:String(error?.message||ui.message),accuracy_m:Number.isFinite(Number(error?.accuracy))?Math.round(Number(error.accuracy)):null,elapsed_ms:Math.round(performance.now()-totalStarted),permission_state:await permissionState()});
    setError(ui.message,{permission:ui.permission,code:ui.code,detail:ui.detail});
  }finally{busy=false;}
}

$('#retryBtn').addEventListener('click',()=>{faceVerificationToken=null;prepareAttendanceFlow();});
$('#faceStartBtn').addEventListener('click',performFaceFlow);
$('#faceSkipBtn').addEventListener('click',()=>{stopFaceCamera();$('#facePanel').classList.add('hidden');submit();});
window.addEventListener('pagehide',stopFaceCamera);
window.addEventListener('pageshow',()=>{if(!busy)prepareAttendanceFlow();},{once:true});
