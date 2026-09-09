const $=s=>document.querySelector(s);
const qs=new URLSearchParams(location.search);
const token=qs.get('token')||'';
const lineTestMode=qs.get('test')==='1';
const previewMode=qs.get('preview')==='1';
const testMode=lineTestMode||previewMode;
const MP_VERSION='1.0.1';
const MP_MODULE=`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/vision_bundle.mjs`;
const MP_WASM=`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const MP_MODEL='https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

let data=null,step=0,remaining=0,timerId=null,startedAt=0,stream=null;
let poseLandmarker=null,poseConnections=[],trackingActive=false,trackingReady=false,trackingSupported=true,lastDetectAt=0,lastVideoTime=-1,rafId=0;
let currentState=null,stepPassed=false,stepResults=[],manualFallback=false,poseModule=null;
const symbols={shoulders:'↻',neck:'↔',chest:'↗',wrists:'✋',twist:'⟳',reach:'↑'};
const ESSENTIAL={
  shoulders:[11,12,23,24],neck:[0,7,8,11,12],chest:[11,12,13,14,15,16],wrists:[11,12,13,14,15,16],twist:[0,11,12,23,24],reach:[11,12,13,14,15,16]
};

function show(id){['intro','routine','done','error'].forEach(x=>$('#'+x).classList.toggle('hidden',x!==id));}
function error(msg){$('#errorText').textContent=msg||'กรุณาลองใหม่';show('error');}
async function api(path,opt={}){
  let url;
  if(previewMode){if(path!=='')return {ok:true,points_awarded:0};url='/api/wellness/preview';}
  else{if(!token)throw new Error('ไม่พบลิงก์จาก LINE');const suffix=lineTestMode?'?test=1':'';url=`/api/public/wellness/${encodeURIComponent(token)}${path}${suffix}`;}
  const r=await fetch(url,{headers:{'content-type':'application/json'},credentials:'same-origin',...opt});
  const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||`HTTP ${r.status}`);return j;
}

function setSupport(mode,title,detail){const root=$('#aiSupport');if(!root)return;root.className=`ai-support ${mode||''}`;root.querySelector('b').textContent=title;root.querySelector('small').textContent=detail||'';}
function setTrackingBadge(mode,text){const el=$('#trackingBadge');if(!el)return;el.className=`tracking-badge ${mode||''}`;el.querySelector('b').textContent=text;}
function setCoach(label,feedback,detail){$('#poseCoachLabel').textContent=label||'';$('#poseFeedback').textContent=feedback||'';$('#poseDetail').textContent=detail||'';}
function clamp(n,min=0,max=1){return Math.max(min,Math.min(max,n));}
function dist(a,b){if(!a||!b)return 999;return Math.hypot((a.x||0)-(b.x||0),(a.y||0)-(b.y||0));}
function midpoint(a,b){return{x:((a?.x||0)+(b?.x||0))/2,y:((a?.y||0)+(b?.y||0))/2,z:((a?.z||0)+(b?.z||0))/2};}
function angle(a,b,c){if(!a||!b||!c)return 0;const v1={x:a.x-b.x,y:a.y-b.y},v2={x:c.x-b.x,y:c.y-b.y};const d1=Math.hypot(v1.x,v1.y),d2=Math.hypot(v2.x,v2.y);if(!d1||!d2)return 0;const cos=clamp((v1.x*v2.x+v1.y*v2.y)/(d1*d2),-1,1);return Math.acos(cos)*180/Math.PI;}
function visible(lm,i,threshold=.45){const p=lm?.[i];return Boolean(p)&&Number(p.visibility??1)>=threshold&&Number(p.presence??1)>=.35;}
function essentialVisible(lm,id){return (ESSENTIAL[id]||[]).every(i=>visible(lm,i));}
function avgVisibility(lm,id){const ids=ESSENTIAL[id]||[];return ids.length?ids.reduce((s,i)=>s+Number(lm?.[i]?.visibility??0),0)/ids.length:0;}
function fmtSeconds(n){return `${Math.max(0,Math.ceil(n))} วิ`;}

async function boot(){
  if(!previewMode&&!token)return error('ไม่พบลิงก์จาก LINE');
  try{
    data=await api('');
    if(testMode){$('#testBanner').classList.remove('hidden');const b=$('#testBanner b'),sp=$('#testBanner span');if(previewMode){if(b)b.textContent='🧪 PREVIEW MODE';if(sp)sp.textContent='เปิดตรงจาก HR · ไม่ส่ง LINE · ไม่บันทึก Activity · ไม่ให้แต้ม';}$('#skipBtn').classList.add('hidden');}
    $('#employeeText').textContent=`${data.employee.name} · ${data.employee.company_name}`;
    const aiOn=data.settings.pose_tracking_enabled!==false&&data.settings.camera_enabled!==false;
    $('#cameraBtn').classList.toggle('hidden',!data.settings.camera_enabled);
    $('#startBtn').textContent=aiOn?(previewMode?'เปิดลอง AI Stretch':lineTestMode?'เริ่มทดสอบ AI Stretch':'เริ่ม AI Stretch'):(previewMode?'เปิดลอง Routine':'เริ่มยืด');
    if(aiOn){setSupport('', 'พร้อมใช้ AI Pose Tracking','ตอนเริ่ม ระบบจะเปิดกล้องและโหลดโมเดลตรวจโครงร่างบนเครื่อง');prewarmPose().catch(()=>{});}else setSupport('warn','โหมดทำตามคำแนะนำ','บริษัทปิด AI Pose Tracking ไว้ ระบบจะใช้กล้องเป็นกระจกและให้กดผ่านเอง');
    if(!testMode&&data.session?.status==='completed'){renderDone(data.session.points_awarded||0,data.session);return;}
    show('intro');
  }catch(e){error(e.message);}
}

async function prewarmPose(){
  if(poseLandmarker||!trackingSupported)return poseLandmarker;
  try{
    poseModule=await import(MP_MODULE);
    const vision=await poseModule.FilesetResolver.forVisionTasks(MP_WASM);
    poseLandmarker=await poseModule.PoseLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:MP_MODEL},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.55,minPosePresenceConfidence:.5,minTrackingConfidence:.5,outputSegmentationMasks:false});
    poseConnections=poseModule.PoseLandmarker.POSE_CONNECTIONS||[];
    trackingReady=true;setSupport('ready','AI Pose Tracking พร้อมแล้ว','ตรวจจุดข้อต่อและประเมินท่าบนเครื่องแบบเรียลไทม์');
    return poseLandmarker;
  }catch(e){trackingSupported=false;manualFallback=true;setSupport('error','AI โหลดไม่สำเร็จ','ยังใช้กล้องเป็นกระจกและทำ Routine แบบกดผ่านเองได้');throw e;}
}

async function openCamera({forRoutine=false}={}){
  try{
    if(!stream)stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:720},height:{ideal:960}},audio:false});
    $('#camera').srcObject=stream;
    await new Promise(resolve=>{const v=$('#camera');if(v.readyState>=2)return resolve();const done=()=>{v.removeEventListener('loadeddata',done);resolve();};v.addEventListener('loadeddata',done);setTimeout(done,1600);});
    if(!forRoutine){$('#cameraBtn').textContent='กล้องพร้อมแล้ว ✓';setSupport('ready','กล้องพร้อมแล้ว','กดเริ่ม AI Stretch เพื่อให้ระบบตรวจโครงร่าง');}
    return true;
  }catch(e){if(!forRoutine)$('#cameraBtn').textContent='เปิดกล้องไม่ได้';manualFallback=true;setSupport('error','เปิดกล้องไม่ได้','ตรวจสิทธิ์กล้องใน LINE/Browser หรือทำ Routine แบบกดผ่านเอง');return false;}
}
function stopCamera(){trackingActive=false;cancelAnimationFrame(rafId);stream?.getTracks?.().forEach(t=>t.stop());stream=null;const v=$('#camera');if(v)v.srcObject=null;clearCanvas();}

async function start(){
  try{
    if(!previewMode)await api('/start',{method:'POST',body:'{}'});
    startedAt=Date.now();step=0;stepResults=[];show('routine');
    const wantsAI=data.settings.pose_tracking_enabled!==false&&data.settings.camera_enabled!==false;
    if(wantsAI){
      setTrackingBadge('loading','กำลังเปิดกล้อง');setCoach('เตรียมตัว','กำลังเปิดกล้อง…','ให้มือถืออยู่มั่นคงและเห็นช่วงตัวส่วนบนชัดเจน');
      const [cameraOk]=await Promise.all([openCamera({forRoutine:true}),prewarmPose().catch(()=>null)]);
      manualFallback=!cameraOk||!poseLandmarker;
    }else manualFallback=true;
    renderStep();
    if(!manualFallback){trackingActive=true;setTrackingBadge('warn','กำลังหาโครงร่าง');startTrackingLoop();}
    else{setTrackingBadge('bad','โหมด Manual');setCoach('ทำตามคำแนะนำ','AI ไม่พร้อมบนอุปกรณ์นี้','ทำท่าตามคำแนะนำ แล้วกด “ทำเองแล้ว” เพื่อไปท่าถัดไป');}
  }catch(e){error(e.message);}
}

function resetExerciseState(){currentState={started:performance.now(),lastTick:performance.now(),maxScore:0,baselineSamples:[],baselineShoulderY:null,phase:'down',reps:0,leftHold:0,rightHold:0,hold:0,lastSide:null};stepPassed=false;}
function renderStep(){
  clearInterval(timerId);const s=data.routine[step];if(!s)return finish();resetExerciseState();remaining=Number(s.seconds||30);
  $('#stepCount').textContent=`${step+1}/${data.routine.length}`;$('#progressBar').style.width=`${step/data.routine.length*100}%`;
  const total=data.routine.reduce((a,x)=>a+Number(x.seconds||0),0);$('#totalTime').textContent=`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
  $('#stepVisual').textContent=symbols[s.id]||'•';$('#stepCue').textContent=s.cue||`ท่าที่ ${step+1}`;$('#stepTitle').textContent=s.title;$('#stepInstruction').textContent=s.instruction;$('#timer').textContent=remaining;$('#prevBtn').disabled=step===0;
  $('#validationState').className='validation-state waiting';$('#validationState').textContent=manualFallback?'Manual':'รอท่าที่ถูกต้อง';$('#validationMeter').style.width='0%';$('#poseScore').textContent='0%';
  $('#nextBtn').disabled=!manualFallback;$('#nextBtn').textContent=manualFallback?(step===data.routine.length-1?'ทำเองแล้ว · เสร็จ':'ทำเองแล้ว · ท่าถัดไป'):'ทำให้ผ่านก่อน';
  $('#skipStepBtn').textContent=manualFallback?'ข้ามท่านี้':'กล้องจับท่านี้ไม่ถนัด · ข้ามท่านี้';
  updateCounter({detail:targetLabel(s),progress:0});setCoach(s.camera_hint||'ทำตามตัวอย่าง',manualFallback?'ทำท่าตามคำแนะนำ':'จัดตัวให้อยู่กลางเฟรม',manualFallback?'เมื่อทำแล้วกดปุ่มด้านล่าง':'AI จะตรวจและนับให้อัตโนมัติ');
  timerId=setInterval(()=>{remaining--;$('#timer').textContent=Math.max(0,remaining);if(remaining<=0){clearInterval(timerId);if(!stepPassed&&!manualFallback){$('#validationHint').textContent='ครบเวลาแนะนำแล้ว · ลองทำให้ผ่านอีกครั้ง หรือกดข้ามท่านี้หากกล้องจับไม่ถนัด';}}},1000);
}

function targetLabel(s){if(s.target_type==='reps')return `0 / ${Number(s.target_value||1)} รอบ`;if(s.target_type==='bilateral_hold')return `ซ้าย 0 / ${s.target_value||3} วิ · ขวา 0 / ${s.target_value||3} วิ`;if(s.target_type==='hold')return `0 / ${s.target_value||5} วิ`;return s.cue||'กำลังตรวจ';}
function updateCounter(r){$('#repCounter').textContent=r.detail||'';$('#validationMeter').style.width=`${clamp(Number(r.progress||0))*100}%`;$('#poseScore').textContent=`${Math.round(clamp(Number(r.score||r.progress||0))*100)}%`;}
function markPassed(result){
  if(stepPassed)return;stepPassed=true;clearInterval(timerId);const s=data.routine[step];const score=Math.round(clamp(result.score||1)*100);stepResults[step]={id:s.id,status:'passed',score,detail:result.detail||'',seconds_used:Math.max(1,Math.round((performance.now()-currentState.started)/1000))};
  $('#validationState').className='validation-state passed';$('#validationState').textContent='ผ่านแล้ว ✓';$('#validationMeter').style.width='100%';$('#poseScore').textContent=`${Math.max(90,score)}%`;$('#validationHint').textContent='ทำครบเงื่อนไขแล้ว ไปท่าถัดไปได้';$('#nextBtn').disabled=false;$('#nextBtn').textContent=step===data.routine.length-1?'เสร็จแล้ว ✓':'ท่าถัดไป';setTrackingBadge('good','ท่าผ่านแล้ว');
}
function skipCurrentStep(){const s=data.routine[step];if(!stepResults[step])stepResults[step]={id:s.id,status:manualFallback?'manual':'skipped',score:Math.round((currentState?.maxScore||0)*100),detail:'ข้ามท่า',seconds_used:Math.max(1,Math.round((performance.now()-(currentState?.started||performance.now()))/1000))};if(step<data.routine.length-1){step++;renderStep();}else finish();}
function advance(){if(!manualFallback&&!stepPassed)return;if(manualFallback&&!stepResults[step]){const s=data.routine[step];stepResults[step]={id:s.id,status:'manual',score:0,detail:'ทำด้วยตนเอง',seconds_used:Math.max(1,Math.round((performance.now()-currentState.started)/1000))};}if(step<data.routine.length-1){step++;renderStep();}else finish();}

function startTrackingLoop(){cancelAnimationFrame(rafId);lastDetectAt=0;lastVideoTime=-1;const loop=()=>{if(!trackingActive||!poseLandmarker)return;const video=$('#camera');const now=performance.now();if(video?.readyState>=2&&video.currentTime!==lastVideoTime&&now-lastDetectAt>=65){lastVideoTime=video.currentTime;lastDetectAt=now;try{const result=poseLandmarker.detectForVideo(video,now);handlePoseResult(result,now);}catch(e){console.warn('pose detect',e);}}rafId=requestAnimationFrame(loop);};rafId=requestAnimationFrame(loop);}

function handlePoseResult(result,now){
  const lm=result?.landmarks?.[0],world=result?.worldLandmarks?.[0];resizeCanvas();clearCanvas();drawGuide(data.routine[step]?.id);
  if(!lm){setTrackingBadge('bad','ไม่พบร่างกาย');setCoach('จัดตำแหน่งกล้อง','ถอยหรือขยับให้เห็นร่างกาย','ควรเห็นศีรษะ ไหล่ แขน และสะโพก');updateCounter({detail:targetLabel(data.routine[step]),progress:0,score:0});return;}
  drawPose(lm);const id=data.routine[step]?.id;if(!essentialVisible(lm,id)){const q=avgVisibility(lm,id);setTrackingBadge('warn','เห็นร่างกายไม่ครบ');setCoach('จัดตำแหน่งกล้อง','ขยับให้เห็นส่วนที่ใช้ในท่านี้','ถอยห่างเล็กน้อยและอย่าให้แขนหลุดเฟรม');updateCounter({detail:targetLabel(data.routine[step]),progress:q*.3,score:q*.3});return;}
  const dt=Math.min(.12,Math.max(.01,(now-(currentState.lastTick||now))/1000));currentState.lastTick=now;const r=evaluateExercise(id,lm,world,dt);currentState.maxScore=Math.max(currentState.maxScore||0,Number(r.score||0));
  setTrackingBadge(r.passed?'good':r.score>.65?'good':r.score>.35?'warn':'bad',r.passed?'ท่าถูกต้อง':r.score>.65?'เกือบผ่านแล้ว':r.score>.35?'กำลังปรับท่า':'กำลังติดตาม');setCoach(data.routine[step]?.camera_hint||'AI COACH',r.feedback,r.hint);updateCounter(r);if(r.passed)markPassed(r);
}

function evaluateExercise(id,lm,world,dt){const fn=validators[id]||(()=>({score:.2,progress:0,detail:'กำลังตรวจ',feedback:'ทำตามคำแนะนำ',hint:'',passed:false}));return fn(lm,world,dt);}
const validators={
  shoulders(lm,world,dt){const ls=lm[11],rs=lm[12],lh=lm[23],rh=lm[24],sm=midpoint(ls,rs),hm=midpoint(lh,rh),torso=Math.max(.08,dist(sm,hm));if(currentState.baselineSamples.length<18){currentState.baselineSamples.push(sm.y);currentState.baselineShoulderY=currentState.baselineSamples.reduce((a,b)=>a+b,0)/currentState.baselineSamples.length;return{score:.3,progress:0,detail:`0 / ${data.routine[step].target_value} รอบ`,feedback:'ผ่อนหัวไหล่ก่อน',hint:'ยืน/นั่งหลังตรง แล้วเริ่มยกไหล่ขึ้น',passed:false};}const delta=(currentState.baselineShoulderY-sm.y)/torso;if(currentState.phase==='down'&&delta>.045)currentState.phase='up';if(currentState.phase==='up'&&delta<.018){currentState.phase='down';currentState.reps++;}const target=Number(data.routine[step].target_value||6),prog=clamp(currentState.reps/target);return{score:clamp(.35+Math.max(0,delta)*5+prog*.45),progress:prog,detail:`${Math.min(currentState.reps,target)} / ${target} รอบ`,feedback:currentState.phase==='up'?'ดีมาก · ปล่อยไหล่ลงช้า ๆ':'ยกไหล่ขึ้น แล้วหมุนไปด้านหลัง',hint:'ขยับช้า ๆ ให้ไหล่ขึ้น–ลงชัดเจน',passed:currentState.reps>=target};},
  neck(lm,world,dt){const nose=lm[0],ls=lm[11],rs=lm[12],sm=midpoint(ls,rs),sw=Math.max(.08,dist(ls,rs)),offset=(nose.x-sm.x)/sw,goal=Number(data.routine[step].target_value||3);if(offset<-.10)currentState.leftHold+=dt;else if(offset>.10)currentState.rightHold+=dt;const lp=clamp(currentState.leftHold/goal),rp=clamp(currentState.rightHold/goal),prog=(lp+rp)/2;const side=offset<-.10?'ซ้าย':offset>.10?'ขวา':'กลาง';return{score:clamp(.3+Math.abs(offset)*3+prog*.5),progress:prog,detail:`ซ้าย ${Math.min(goal,Math.floor(currentState.leftHold))}/${goal} วิ · ขวา ${Math.min(goal,Math.floor(currentState.rightHold))}/${goal} วิ`,feedback:side==='กลาง'?'เอียงศีรษะเข้าหาไหล่เบา ๆ':`ค้างด้าน${side}ไว้`,hint:'ไหล่ไม่ต้องยก และไม่ใช้มือกดศีรษะ',passed:currentState.leftHold>=goal&&currentState.rightHold>=goal};},
  chest(lm,world,dt){const ls=lm[11],rs=lm[12],le=lm[13],re=lm[14],lw=lm[15],rw=lm[16],sw=Math.max(.08,dist(ls,rs)),torso=Math.max(.08,dist(midpoint(ls,rs),midpoint(lm[23],lm[24]))),spread=Math.abs(lw.x-rw.x)/sw,ly=Math.abs(lw.y-ls.y)/torso,ry=Math.abs(rw.y-rs.y)/torso,la=angle(ls,le,lw),ra=angle(rs,re,rw),good=spread>2.05&&ly<.45&&ry<.45&&la>135&&ra>135,goal=Number(data.routine[step].target_value||4);if(good)currentState.hold+=dt;else currentState.hold=Math.max(0,currentState.hold-dt*.3);const prog=clamp(currentState.hold/goal);return{score:clamp(.15+(Math.min(spread,2.2)/2.2)*.45+Math.min(la,ra)/180*.25+prog*.25),progress:prog,detail:`ค้าง ${Math.min(goal,Math.floor(currentState.hold))} / ${goal} วิ`,feedback:good?'ดีมาก · เปิดอกและค้างไว้':'กางแขนออกข้างให้ใกล้ระดับไหล่',hint:'ยืดแขนออกกว้างโดยไม่ยกไหล่',passed:currentState.hold>=goal};},
  wrists(lm,world,dt){const ls=lm[11],rs=lm[12],le=lm[13],re=lm[14],lw=lm[15],rw=lm[16],sw=Math.max(.08,dist(ls,rs)),la=angle(ls,le,lw),ra=angle(rs,re,rw),hands=dist(lw,rw)/sw,goal=Number(data.routine[step].target_value||3),leftPose=la>150&&hands<.85,rightPose=ra>150&&hands<.85;if(leftPose&&currentState.leftHold<goal)currentState.leftHold+=dt;if(rightPose&&currentState.leftHold>=goal*.7)currentState.rightHold+=dt;const lp=clamp(currentState.leftHold/goal),rp=clamp(currentState.rightHold/goal),prog=(lp+rp)/2;return{score:clamp(.2+Math.max(la,ra)/180*.35+Math.max(0,1-hands)*.2+prog*.4),progress:prog,detail:`ข้างแรก ${Math.min(goal,Math.floor(currentState.leftHold))}/${goal} วิ · อีกข้าง ${Math.min(goal,Math.floor(currentState.rightHold))}/${goal} วิ`,feedback:currentState.leftHold<goal?'เหยียดแขนหนึ่งข้าง แล้วใช้อีกมือจับใกล้ฝ่ามือ':'สลับแขนอีกข้าง',hint:'เหยียดศอกให้ตรงและดึงเบา ๆ ไม่ฝืนข้อมือ',passed:currentState.leftHold>=goal&&currentState.rightHold>=goal};},
  twist(lm,world,dt){const goal=Number(data.routine[step].target_value||3);let v=0;if(world?.[11]&&world?.[12]){v=(world[11].z-world[12].z)-((world[23]?.z||0)-(world[24]?.z||0))*.25;}else{const sm=midpoint(lm[11],lm[12]),hm=midpoint(lm[23],lm[24]),sw=Math.max(.08,dist(lm[11],lm[12]));v=(sm.x-hm.x)/sw;}if(v>.065)currentState.rightHold+=dt;else if(v<-.065)currentState.leftHold+=dt;const lp=clamp(currentState.leftHold/goal),rp=clamp(currentState.rightHold/goal),prog=(lp+rp)/2,side=v>.065?'ขวา':v<-.065?'ซ้าย':'กลาง';return{score:clamp(.25+Math.abs(v)*4+prog*.5),progress:prog,detail:`ซ้าย ${Math.min(goal,Math.floor(currentState.leftHold))}/${goal} วิ · ขวา ${Math.min(goal,Math.floor(currentState.rightHold))}/${goal} วิ`,feedback:side==='กลาง'?'บิดลำตัวช้า ๆ ไปด้านหนึ่ง':'ดี · ค้างแล้วสลับอีกด้าน',hint:'สะโพกอยู่ค่อนข้างนิ่ง หลังตรง ไม่กระชาก',passed:currentState.leftHold>=goal&&currentState.rightHold>=goal};},
  reach(lm,world,dt){const ls=lm[11],rs=lm[12],le=lm[13],re=lm[14],lw=lm[15],rw=lm[16],la=angle(ls,le,lw),ra=angle(rs,re,rw),up=lw.y<ls.y-.10&&rw.y<rs.y-.10&&la>145&&ra>145,goal=Number(data.routine[step].target_value||5);if(up)currentState.hold+=dt;else currentState.hold=Math.max(0,currentState.hold-dt*.25);const prog=clamp(currentState.hold/goal);return{score:clamp(.2+(up?.45:.1)+Math.min(la,ra)/180*.2+prog*.35),progress:prog,detail:`ค้าง ${Math.min(goal,Math.floor(currentState.hold))} / ${goal} วิ`,feedback:up?'ดีมาก · ยืดขึ้นและหายใจสบาย ๆ':'ยกแขนทั้งสองขึ้นเหนือศีรษะ',hint:'เหยียดศอกเกือบตรงและอย่าแอ่นหลังมาก',passed:currentState.hold>=goal};}
};

function resizeCanvas(){const v=$('#camera'),c=$('#poseCanvas');if(!v||!c||!v.videoWidth)return;if(c.width!==v.videoWidth||c.height!==v.videoHeight){c.width=v.videoWidth;c.height=v.videoHeight;}}
function clearCanvas(){const c=$('#poseCanvas');if(c?.width)c.getContext('2d').clearRect(0,0,c.width,c.height);}
function drawPose(lm){const c=$('#poseCanvas');if(!c?.width)return;const ctx=c.getContext('2d'),w=c.width,h=c.height;ctx.save();ctx.lineWidth=Math.max(3,w/180);ctx.lineCap='round';ctx.strokeStyle=stepPassed?'#43e199':'#35d5ca';ctx.fillStyle=stepPassed?'#43e199':'#e9fffb';for(const conn of poseConnections){const a=lm[conn.start],b=lm[conn.end];if(!a||!b||Number(a.visibility??1)<.35||Number(b.visibility??1)<.35)continue;ctx.beginPath();ctx.moveTo(a.x*w,a.y*h);ctx.lineTo(b.x*w,b.y*h);ctx.stroke();}for(let i=0;i<lm.length;i++){const p=lm[i];if(Number(p.visibility??1)<.45)continue;ctx.beginPath();ctx.arc(p.x*w,p.y*h,Math.max(3,w/140),0,Math.PI*2);ctx.fill();}ctx.restore();}
function drawGuide(id){const c=$('#poseCanvas');if(!c?.width)return;const ctx=c.getContext('2d'),w=c.width,h=c.height;ctx.save();ctx.strokeStyle='rgba(255,211,88,.92)';ctx.fillStyle='rgba(255,211,88,.92)';ctx.lineWidth=Math.max(3,w/180);ctx.setLineDash([10,8]);ctx.lineCap='round';const line=(x1,y1,x2,y2)=>{ctx.beginPath();ctx.moveTo(x1*w,y1*h);ctx.lineTo(x2*w,y2*h);ctx.stroke();};const arrow=(x1,y1,x2,y2)=>{line(x1,y1,x2,y2);const a=Math.atan2((y2-y1)*h,(x2-x1)*w),s=12;ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(x2*w,y2*h);ctx.lineTo(x2*w-Math.cos(a-.55)*s,y2*h-Math.sin(a-.55)*s);ctx.lineTo(x2*w-Math.cos(a+.55)*s,y2*h-Math.sin(a+.55)*s);ctx.closePath();ctx.fill();ctx.setLineDash([10,8]);};if(id==='shoulders'){arrow(.34,.35,.34,.28);arrow(.66,.35,.66,.28);}else if(id==='neck'){arrow(.46,.20,.39,.26);arrow(.54,.20,.61,.26);}else if(id==='chest'){line(.18,.36,.82,.36);arrow(.36,.36,.18,.36);arrow(.64,.36,.82,.36);}else if(id==='wrists'){line(.28,.42,.72,.42);ctx.beginPath();ctx.arc(.5*w,.42*h,24,0,Math.PI*2);ctx.stroke();}else if(id==='twist'){arrow(.36,.48,.24,.48);arrow(.64,.48,.76,.48);}else if(id==='reach'){arrow(.38,.36,.38,.16);arrow(.62,.36,.62,.16);}ctx.restore();}

async function finish(){
  clearInterval(timerId);trackingActive=false;cancelAnimationFrame(rafId);
  try{
    const elapsed=Math.max(1,Math.round((Date.now()-(startedAt||Date.now()))/1000));
    const passed=stepResults.filter(x=>x?.status==='passed').length,skipped=stepResults.filter(x=>x?.status==='skipped').length,total=data.routine.length;
    const scored=stepResults.filter(Boolean),avgScore=scored.length?Math.round(scored.reduce((s,x)=>s+Number(x.score||0),0)/scored.length):0;
    const payload={duration_seconds:elapsed,ai_tracking_used:!manualFallback,ai_score:avgScore,ai_passed_steps:passed,ai_total_steps:total,ai_skipped_steps:skipped,ai_summary:stepResults.filter(Boolean)};
    let r={points_awarded:0};if(!previewMode)r=await api('/complete',{method:'POST',body:JSON.stringify(payload)});stopCamera();renderDone(r.points_awarded||0,{...payload,...(r.session||{})});
  }catch(e){error(e.message);}
}
function renderDone(points,session={}){show('done');const passed=Number(session.ai_passed_steps||0),total=Number(session.ai_total_steps||data?.routine?.length||0),score=Number(session.ai_score||0),skipped=Number(session.ai_skipped_steps||0);if(previewMode){$('#done h1').textContent='ทดสอบ AI Stretch ครบแล้ว ✓';$('#done p').textContent='Flow ทำงานครบ โดยไม่ได้ส่ง LINE ไม่บันทึก Activity จริง และไม่ให้แต้ม';}else if(lineTestMode){$('#done h1').textContent='ทดสอบ AI Stretch ครบแล้ว ✓';$('#done p').textContent='Flow ทำงานครบ โดยไม่บันทึก Activity จริงและไม่ให้แต้ม';}if(total){$('#aiResult').innerHTML=`<article><strong>${score}%</strong><span>คะแนนการทำท่า</span></article><article><strong>${passed}/${total}</strong><span>AI ผ่าน</span></article><article><strong>${skipped}</strong><span>ข้ามท่า</span></article>`;$('#aiResult').classList.remove('hidden');}if(!testMode&&Number(points)>0){$('#pointsText').textContent=`🎁 ได้รับ +${Number(points)} แต้ม`;$('#pointsText').classList.remove('hidden');}}
async function skip(){try{await api('/skip',{method:'POST',body:'{}'});stopCamera();$('#done h1').textContent='ข้ามวันนี้แล้ว';$('#done p').textContent='ไม่เป็นไร ไว้วันทำงานถัดไปค่อยขยับไปด้วยกัน';show('done');}catch(e){error(e.message);}}

$('#cameraBtn').onclick=()=>openCamera();$('#startBtn').onclick=start;$('#skipBtn').onclick=skip;$('#prevBtn').onclick=()=>{if(step>0){step--;renderStep();}};$('#nextBtn').onclick=advance;$('#skipStepBtn').onclick=skipCurrentStep;$('#closeBtn').onclick=()=>{stopCamera();try{if(history.length>1){history.back();return;}window.close();}catch{}};window.addEventListener('pagehide',stopCamera);boot();
