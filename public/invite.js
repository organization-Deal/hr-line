const $ = selector => document.querySelector(selector);
const params = new URLSearchParams(location.search);
const token = params.get('token') || '';
let invite = null;
let joinResult = null;
let faceStream = null;
let faceModelsReady = false;
let faceBusy = false;
const FACE_MODEL_VERSION = 'face-api-0.22.2';
const FACE_MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';
const resumeKey = token ? `nakna.invite.completed.${token.slice(0,18)}` : '';

function show(id) {
  ['loadingState','errorState','formState','faceState','successState'].forEach(key => $(`#${key}`)?.classList.toggle('hidden', key !== id));
}

function cacheJoinResult(result) {
  if (!resumeKey) return;
  try { sessionStorage.setItem(resumeKey, JSON.stringify(result)); } catch {}
}
function readCachedJoinResult() {
  if (!resumeKey) return null;
  try {
    const value = JSON.parse(sessionStorage.getItem(resumeKey) || 'null');
    if (!value?.employee || !value?.line_token_expires_at) return null;
    if (new Date(value.line_token_expires_at).getTime() <= Date.now()) { sessionStorage.removeItem(resumeKey); return null; }
    return value;
  } catch { return null; }
}

async function loadInvite() {
  if (!token) return fail('ไม่พบรหัสลิงก์เชิญ');
  const cached = readCachedJoinResult();
  if (cached) {
    joinResult = cached;
    preparePostCreateFlow();
    return;
  }
  try {
    const res = await fetch(`/api/public/invites/${encodeURIComponent(token)}`, { cache:'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return fail(data.error === 'INVITE_EXPIRED' ? 'ลิงก์นี้หมดอายุหรือถูกใช้ครบแล้ว กรุณาขอลิงก์ใหม่จาก HR' : 'ไม่พบลิงก์เชิญนี้');
    invite = data.invite;
    $('#companyName').textContent = invite.company_name;
    $('#contextCompany').textContent = invite.company_name;
    $('#contextPosition').textContent = invite.position_name || 'ไม่ระบุ';
    $('#contextDepartment').textContent = invite.department_name || 'ไม่ระบุ';
    $('#contextStart').textContent = invite.start_date ? formatDate(invite.start_date) : 'ตามที่ HR กำหนด';
    $('#contextLocations').textContent = invite.locations?.length ? invite.locations.map(item => item.name).join(', ') : 'ทุก Location ของบริษัท';
    show('formState');
  } catch { fail('เปิดลิงก์เชิญไม่สำเร็จ กรุณาลองใหม่'); }
}

function fail(message) { $('#errorText').textContent = message; show('errorState'); }

$('#employeeForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!$('#confirmCheck').checked) return;
  const button = $('#submitBtn');
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  button.disabled = true;
  button.textContent = 'กำลังสร้างโปรไฟล์…';
  try {
    const res = await fetch(`/api/public/invites/${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'สร้างโปรไฟล์ไม่สำเร็จ');
    joinResult = result;
    cacheJoinResult(result);
    preparePostCreateFlow();
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
    button.textContent = 'ยืนยันและสร้างโปรไฟล์พนักงาน';
  }
});

function preparePostCreateFlow() {
  if (!joinResult) return;
  populateSuccess(joinResult);
  const face = joinResult.face_enrollment || {};
  if (face.enrolled || face.deferred) {
    $('#faceDoneNote')?.classList.toggle('hidden', !face.enrolled);
    show('successState');
  } else if (face.enabled && face.system_ready && face.token) {
    $('#faceLead').textContent = face.required
      ? 'บริษัทเปิดใช้การยืนยันใบหน้า คุณตั้งค่าได้ตอนนี้ หรือระบบจะบังคับก่อนเช็กอินครั้งแรก'
      : 'บริษัทอยู่ในช่วงลงทะเบียนใบหน้า ตั้งค่าตอนนี้เพื่อให้พร้อมก่อนวันใช้งานจริง';
    $('#faceLaterBtn').textContent = face.required
      ? 'ทำภายหลัง — ต้องลงทะเบียนก่อนเช็กอินครั้งแรก'
      : 'ทำภายหลังตอนเช็กอินครั้งแรก';
    show('faceState');
  } else {
    show('successState');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function populateSuccess(result) {
  $('#resultName').textContent = result.employee.name;
  $('#resultCompany').textContent = `${result.employee.company_name} · ${result.employee.employee_code}`;
  $('#lineCommand').textContent = result.line_command;
  if (result.line_connect_url) {
    $('#lineConnectBtn').href = result.line_connect_url;
  } else {
    $('#lineConnectBtn').href = '#';
    $('#lineConnectBtn').onclick = event => {
      event.preventDefault();
      $('#fallbackBox').open = true;
    };
    $('#lineConnectBtn').textContent = 'ดูวิธีเชื่อม LINE';
  }
}

function finishFaceStep({ enrolled = false } = {}) {
  stopFaceCamera();
  $('#faceDoneNote')?.classList.toggle('hidden', !enrolled);
  if (joinResult?.face_enrollment) {
    joinResult.face_enrollment.enrolled = enrolled;
    joinResult.face_enrollment.deferred = !enrolled;
  }
  cacheJoinResult(joinResult);
  show('successState');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

$('#faceLaterBtn')?.addEventListener('click', () => finishFaceStep({ enrolled:false }));
$('#copyCommandBtn').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('#lineCommand').textContent);
    $('#copyCommandBtn').textContent = 'คัดลอกแล้ว';
  } catch {}
});

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function resetFaceSteps() {
  ['faceStepCamera','faceStepLive','faceStepMatch'].forEach(id => $(`#${id}`)?.classList.remove('active','done'));
}
function faceStep(id, state = 'active') {
  const el = $(`#faceStep${id}`);
  if (!el) return;
  el.classList.remove('active','done');
  el.classList.add(state);
}
async function waitForFaceApi(timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (window.faceapi?.nets?.tinyFaceDetector) return window.faceapi;
    await sleep(100);
  }
  throw new Error('โหลดระบบตรวจใบหน้าไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่');
}
async function loadFaceModels() {
  if (faceModelsReady) return;
  $('#faceCameraState').textContent = 'กำลังโหลดโมเดลตรวจใบหน้า…';
  const api = await waitForFaceApi();
  await Promise.all([
    api.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL),
    api.nets.faceLandmark68TinyNet.loadFromUri(FACE_MODEL_URL),
    api.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_URL),
  ]);
  faceModelsReady = true;
}
async function startFaceCamera() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Browser นี้ไม่รองรับกล้องสำหรับ Face Verification');
  stopFaceCamera();
  try {
    faceStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user', width:{ideal:640}, height:{ideal:480} }, audio:false });
  } catch (error) {
    const denied = String(error?.name || '').includes('NotAllowed');
    throw new Error(denied ? 'ยังไม่ได้อนุญาต Camera กรุณาเปิดสิทธิ์กล้องแล้วลองใหม่' : 'เปิดกล้องไม่สำเร็จ กรุณาลองใหม่');
  }
  const video = $('#faceVideo');
  video.srcObject = faceStream;
  await video.play();
  await new Promise(resolve => {
    if (video.readyState >= 2) return resolve();
    video.onloadeddata = () => resolve();
    setTimeout(resolve, 1500);
  });
  $('#faceCameraState').textContent = 'กล้องพร้อม · ให้ใบหน้าอยู่ในกรอบ';
  faceStep('Camera','done');
}
function stopFaceCamera() {
  if (faceStream) {
    for (const track of faceStream.getTracks()) { try { track.stop(); } catch {} }
    faceStream = null;
  }
  const video = $('#faceVideo');
  if (video) video.srcObject = null;
}
async function detectFace({ withDescriptor = false } = {}) {
  const api = await waitForFaceApi();
  const video = $('#faceVideo');
  const opts = new api.TinyFaceDetectorOptions({ inputSize:224, scoreThreshold:0.5 });
  let result = api.detectSingleFace(video, opts).withFaceLandmarks(true);
  if (withDescriptor) result = result.withFaceDescriptor();
  const face = await result;
  if (!face) throw new Error('ยังไม่พบใบหน้า กรุณาให้ใบหน้าอยู่ในกรอบ');
  const box = face.detection?.box;
  if (box && Math.min(box.width, box.height) < 105) throw new Error('ขยับใบหน้าเข้าใกล้กล้องอีกเล็กน้อย');
  return face;
}
function dist2d(a,b) { return Math.hypot(Number(a.x)-Number(b.x), Number(a.y)-Number(b.y)); }
function eyeAspect(points, idx) {
  const p = idx.map(i => points[i]);
  return (dist2d(p[1],p[5]) + dist2d(p[2],p[4])) / (2 * Math.max(1, dist2d(p[0],p[3])));
}
function faceMotionMetrics(face) {
  const points = face.landmarks.positions;
  const left = [36,37,38,39,40,41], right = [42,43,44,45,46,47];
  const ear = (eyeAspect(points,left) + eyeAspect(points,right)) / 2;
  const leftCenter = {x:(points[36].x+points[39].x)/2, y:(points[36].y+points[39].y)/2};
  const rightCenter = {x:(points[42].x+points[45].x)/2, y:(points[42].y+points[45].y)/2};
  const eyeDistance = Math.max(1,dist2d(leftCenter,rightCenter));
  const eyeMidX = (leftCenter.x+rightCenter.x)/2;
  return { ear, noseOffset:(points[30].x-eyeMidX)/eyeDistance };
}
async function waitForLivenessAction(action, timeoutMs = 10000) {
  const started = Date.now();
  let seenOpen = false, seenClosed = false, seenNeutral = false;
  while (Date.now() - started < timeoutMs) {
    try {
      const face = await detectFace();
      const m = faceMotionMetrics(face);
      if (action === 'blink') {
        if (m.ear > 0.20) seenOpen = true;
        if (seenOpen && m.ear < 0.16) seenClosed = true;
        if (seenClosed && m.ear > 0.19) return true;
        $('#faceCameraState').textContent = 'กระพริบตา 1 ครั้ง';
      } else {
        if (Math.abs(m.noseOffset) < 0.11) seenNeutral = true;
        if (seenNeutral && Math.abs(m.noseOffset) > 0.19) return true;
        $('#faceCameraState').textContent = 'มองตรงก่อน แล้วหันหน้าไปด้านข้างเล็กน้อย';
      }
    } catch (error) {
      $('#faceCameraState').textContent = error.message || 'จัดใบหน้าให้อยู่ในกรอบ';
    }
    await sleep(170);
  }
  throw new Error(action === 'blink' ? 'ยังตรวจการกระพริบตาไม่สำเร็จ กรุณาลองใหม่' : 'ยังตรวจการหันหน้าไม่สำเร็จ กรุณาลองใหม่');
}
async function runLiveness(actions) {
  faceStep('Live','active');
  const result = { blink:false, turn:false };
  for (const action of actions || []) {
    $('#faceInstruction').textContent = action === 'blink' ? 'กระพริบตา 1 ครั้ง' : 'มองตรงก่อน แล้วหันหน้าไปด้านข้างเล็กน้อย';
    await waitForLivenessAction(action);
    result[action] = true;
    $('#faceCameraState').textContent = action === 'blink' ? 'ตรวจการกระพริบตาแล้ว ✓' : 'ตรวจการหันหน้าแล้ว ✓';
    await sleep(400);
  }
  faceStep('Live','done');
  return result;
}
function normalizeDescriptor(values) {
  const arr = Array.from(values || [], Number);
  const norm = Math.sqrt(arr.reduce((sum,v) => sum + v*v, 0)) || 1;
  return arr.map(v => Number((v/norm).toFixed(8)));
}
async function captureDescriptor(samples = 3) {
  faceStep('Match','active');
  $('#faceInstruction').textContent = 'มองตรงเข้ากล้อง ระบบกำลังสร้าง Face Template';
  const descriptors = [];
  for (let i=0; i<samples; i++) {
    let face = null;
    for (let retry=0; retry<8 && !face; retry++) {
      try { face = await detectFace({withDescriptor:true}); }
      catch (error) { $('#faceCameraState').textContent = error.message || 'จัดใบหน้าให้อยู่ในกรอบ'; await sleep(220); }
    }
    if (!face?.descriptor) throw new Error('อ่าน Face Template ไม่สำเร็จ กรุณาลองใหม่');
    descriptors.push(Array.from(face.descriptor, Number));
    $('#faceCameraState').textContent = `อ่านใบหน้า ${i+1}/${samples}`;
    await sleep(260);
  }
  const avg = new Array(128).fill(0);
  for (const d of descriptors) for (let i=0; i<128; i++) avg[i] += d[i] / descriptors.length;
  faceStep('Match','done');
  return normalizeDescriptor(avg);
}
async function onboardingFacePost(path, body = {}) {
  const faceToken = joinResult?.face_enrollment?.token;
  if (!faceToken) throw new Error('ไม่พบรหัสตั้งค่าใบหน้า กรุณาทำต่อในขั้นตอนเช็กอินครั้งแรก');
  const res = await fetch(`/api/public/onboarding-face/${encodeURIComponent(faceToken)}/${path}`, {
    method:'POST', headers:{'content-type':'application/json','accept':'application/json'}, cache:'no-store', body:JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'ตั้งค่าใบหน้าไม่สำเร็จ');
  return data;
}
async function enrollFaceNow() {
  if (faceBusy) return;
  faceBusy = true;
  const button = $('#faceEnrollBtn');
  const errorBox = $('#faceError');
  button.disabled = true;
  errorBox.classList.add('hidden');
  resetFaceSteps();
  try {
    await loadFaceModels();
    await startFaceCamera();
    const challenge = await onboardingFacePost('challenge', {});
    if (challenge.already_enrolled) { finishFaceStep({enrolled:true}); return; }
    const liveness = await runLiveness(challenge.actions || []);
    const descriptor = await captureDescriptor(3);
    $('#faceCameraState').textContent = 'กำลังเข้ารหัสและบันทึก Face Template…';
    await onboardingFacePost('enroll', { challenge_token:challenge.challenge_token, liveness, descriptor, model_version:FACE_MODEL_VERSION });
    $('#faceCameraState').textContent = 'ลงทะเบียนใบหน้าเรียบร้อย ✓';
    $('#faceInstruction').textContent = 'ระบบไม่ได้บันทึกรูปภาพจากกล้อง';
    await sleep(650);
    finishFaceStep({enrolled:true});
  } catch (error) {
    stopFaceCamera();
    errorBox.textContent = error.message || 'ลงทะเบียนใบหน้าไม่สำเร็จ กรุณาลองใหม่';
    errorBox.classList.remove('hidden');
    $('#faceCameraState').textContent = 'ลองใหม่ได้เมื่อพร้อม';
  } finally {
    faceBusy = false;
    button.disabled = false;
  }
}
$('#faceEnrollBtn')?.addEventListener('click', enrollFaceNow);
window.addEventListener('pagehide', stopFaceCamera);

function formatDate(value) {
  const d = new Date(`${String(value).slice(0,10)}T00:00:00+07:00`);
  return d.toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'numeric', timeZone:'Asia/Bangkok' });
}

loadInvite();
