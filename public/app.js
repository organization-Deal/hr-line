const state = { token: sessionStorage.getItem('hr_admin_token') || '', dashboard: null, employees: [], candidates: [], attendance: [], leaves: [], requests: [] };
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const stageLabels = { new:'New', screening:'Screening', hr_interview:'HR Interview', manager_interview:'Manager Interview', assignment:'Assignment', offer:'Offer', hired:'Hired', rejected:'Rejected' };
const leaveLabels = { annual:'พักร้อน', sick:'ลาป่วย', personal:'ลากิจ', unpaid:'ลาไม่รับค่าจ้าง' };

async function api(path, options={}) {
  const res = await fetch(path, { ...options, headers: { 'content-type':'application/json', authorization:`Bearer ${state.token}`, ...(options.headers||{}) } });
  let data={}; try{data=await res.json()}catch{}
  if(res.status===401){ logout(); throw new Error('Token ไม่ถูกต้อง'); }
  if(!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function boot(){
  bindEvents();
  if(state.token){ try{ await loadAll(); hideLogin(); }catch(e){ showLoginError(e.message); } }
  else $('#login').classList.remove('hidden');
}

function bindEvents(){
  $('#loginBtn').onclick = login;
  $('#tokenInput').addEventListener('keydown', e=>{if(e.key==='Enter')login()});
  $('#logoutBtn').onclick = logout;
  $('#refreshBtn').onclick = loadAll;
  $$('.nav-item').forEach(btn=>btn.onclick=()=>showView(btn.dataset.view));
  $$('[data-jump]').forEach(btn=>btn.onclick=()=>showView(btn.dataset.jump));
  $('#addEmployeeBtn').onclick = openEmployeeModal;
  $('#addCandidateBtn').onclick = openCandidateModal;
}

async function login(){
  const token=$('#tokenInput').value.trim(); if(!token)return;
  state.token=token; sessionStorage.setItem('hr_admin_token', token);
  try{await loadAll(); hideLogin(); $('#loginError').textContent='';}catch(e){showLoginError(e.message)}
}
function logout(){state.token='';sessionStorage.removeItem('hr_admin_token');$('#login').classList.remove('hidden')}
function hideLogin(){$('#login').classList.add('hidden')}
function showLoginError(m){$('#loginError').textContent=m}

async function loadAll(){
  const [dashboard, employees, candidates, attendance, leaves, requests] = await Promise.all([
    api('/api/dashboard'), api('/api/employees'), api('/api/candidates'), api('/api/attendance/today'), api('/api/leaves'), api('/api/requests')
  ]);
  state.dashboard=dashboard; state.employees=employees.data; state.candidates=candidates.data; state.attendance=attendance.data; state.leaves=leaves.data; state.requests=requests.data;
  renderAll(); toast('อัปเดตข้อมูลแล้ว');
}

function renderAll(){ renderDashboard(); renderEmployees(); renderCandidates(); renderAttendance(); renderLeaves(); renderRequests(); $('#todayText').textContent = formatDate(state.dashboard.today); }

function renderDashboard(){
  const d=state.dashboard;
  const total=d.attention.reduce((n,x)=>n+x.count,0); $('#attentionTotal').textContent=total; $('#heroSub').textContent=`${d.client.name} · ${d.summary.employees} คน · ${formatDate(d.today)}`;
  const cards=[['พนักงานทั้งหมด',d.summary.employees,'#4f46e5'],['เข้างานแล้ว',d.summary.present,'#10b981'],['มาสาย',d.summary.late,'#f59e0b'],['ลา',d.summary.leave,'#3b82f6'],['ยังไม่เช็กอิน',d.summary.missing,'#ef4444']];
  $('#summaryGrid').innerHTML=cards.map(([l,v,c])=>`<div class="summary-card"><div class="label"><span class="dot" style="background:${c}"></span>${l}</div><div class="value">${v}</div></div>`).join('');
  $('#attentionList').innerHTML=d.attention.length?d.attention.map(x=>`<div class="list-row"><div class="list-icon">${iconFor(x.key)}</div><div class="list-copy"><strong>${x.label}</strong><small>ระบบพบรายการที่ต้องจัดการ</small></div><div class="count">${x.count}</div></div>`).join(''):`<div class="empty">วันนี้ไม่มีรายการเร่งด่วน 🎉</div>`;
  $('#birthdayList').innerHTML=d.birthdays.length?d.birthdays.map(x=>`<div class="list-row"><div class="list-icon">🎂</div><div class="list-copy"><strong>${escapeHtml(x.name)}</strong><small>${x.days===0?'วันนี้':`อีก ${x.days} วัน`} · ${formatDate(x.date)}</small></div><span class="badge purple">Birthday</span></div>`).join(''):`<div class="empty">ไม่มีวันเกิดในช่วงนี้</div>`;
  const pipeStages=['new','screening','hr_interview','manager_interview','offer','hired'];
  $('#recruitmentPipeline').innerHTML=pipeStages.map(s=>`<div class="pipe-item"><b>${d.recruitment[s]||0}</b><span>${stageLabels[s]}</span></div>`).join('');
  const up=[...d.probation.map(x=>({...x,type:'Probation',emoji:'⏳'})),...d.contracts.map(x=>({...x,type:'Contract',emoji:'📄'}))].sort((a,b)=>a.days-b.days);
  $('#upcomingList').innerHTML=up.length?up.map(x=>`<div class="list-row"><div class="list-icon">${x.emoji}</div><div class="list-copy"><strong>${escapeHtml(x.name)}</strong><small>${x.type} · ${formatDate(x.date)}</small></div><span class="badge ${x.days<=7?'amber':''}">${x.days} วัน</span></div>`).join(''):`<div class="empty">ยังไม่มี Deadline ใกล้เข้ามา</div>`;
}

function renderEmployees(){
  $('#employeesBody').innerHTML=state.employees.map(e=>`<tr><td><div class="person"><div class="avatar">${initial(e)}</div><div><strong>${escapeHtml(e.nickname||e.first_name)} ${escapeHtml(e.last_name)}</strong><small>${escapeHtml(e.employee_code)}</small></div></div></td><td>${escapeHtml(e.department_name||'-')}</td><td>${escapeHtml(e.position_name||'-')}</td><td>${formatDate(e.start_date)}</td><td>${e.line_user_id?'<span class="badge green">Connected</span>':'<span class="badge">Not linked</span>'}</td><td>${e.line_user_id?'':`<button class="text-btn" onclick="window.createLineCode(${e.id})">สร้างรหัส LINE</button>`}</td></tr>`).join('');
}
window.createLineCode=async id=>{try{const r=await api(`/api/employees/${id}/line-link-code`,{method:'POST',body:'{}'});await navigator.clipboard?.writeText(`LINK ${r.token}`);alert(`รหัสเชื่อม LINE: ${r.token}\n\nให้พนักงานส่งใน LINE OA:\nLINK ${r.token}\n\nหมดอายุใน 15 นาที`)}catch(e){toast(e.message,true)}};

function renderCandidates(){
  const stages=['new','screening','hr_interview','manager_interview','assignment','offer'];
  $('#kanban').innerHTML=stages.map(stage=>{const items=state.candidates.filter(c=>c.stage===stage);return `<div class="kanban-col"><div class="kanban-head"><span>${stageLabels[stage]}</span><span class="badge">${items.length}</span></div>${items.map(c=>`<div class="candidate-card"><strong>${escapeHtml(c.nickname||c.first_name)} ${escapeHtml(c.last_name)}</strong><small>${escapeHtml(c.position_name)}</small><div class="candidate-meta"><span>${escapeHtml(c.source||'Direct')}</span><span>${c.expected_salary?money(c.expected_salary):'-'}</span></div><select style="width:100%;margin-top:10px;border:1px solid #e2e4ec;border-radius:9px;padding:7px" onchange="window.moveCandidate(${c.id},this.value)">${stages.concat(['hired','rejected']).map(s=>`<option value="${s}" ${s===c.stage?'selected':''}>${stageLabels[s]}</option>`).join('')}</select></div>`).join('')}</div>`}).join('');
}
window.moveCandidate=async(id,stage)=>{try{await api(`/api/candidates/${id}/stage`,{method:'PATCH',body:JSON.stringify({stage})});await loadAll()}catch(e){toast(e.message,true)}};

function renderAttendance(){
  $('#attendanceBody').innerHTML=state.attendance.map(a=>`<tr><td><div class="person"><div class="avatar">${initial(a)}</div><div><strong>${escapeHtml(a.nickname||a.first_name)} ${escapeHtml(a.last_name)}</strong><small>${escapeHtml(a.employee_code)}</small></div></div></td><td>${escapeHtml(a.department_name||'-')}</td><td>${a.check_in_at?time(a.check_in_at):'-'}</td><td>${a.check_out_at?time(a.check_out_at):'-'}</td><td>${attendanceStatus(a)}</td></tr>`).join('');
}

function renderLeaves(){
  $('#leaveBody').innerHTML=state.leaves.map(l=>`<tr><td>${escapeHtml(l.nickname||l.first_name)} ${escapeHtml(l.last_name)}</td><td>${leaveLabels[l.leave_type]||escapeHtml(l.leave_type)}</td><td>${formatDate(l.start_date)}${l.start_date!==l.end_date?` – ${formatDate(l.end_date)}`:''}</td><td>${escapeHtml(l.reason||'-')}</td><td>${statusBadge(l.status)}</td><td>${l.status==='pending'?`<button class="text-btn" onclick="window.leaveAction(${l.id},'approve')">อนุมัติ</button> <button class="text-btn" style="color:#ef4444" onclick="window.leaveAction(${l.id},'reject')">ปฏิเสธ</button>`:''}</td></tr>`).join('');
}
window.leaveAction=async(id,act)=>{try{await api(`/api/leaves/${id}/${act}`,{method:'PATCH',body:'{}'});await loadAll()}catch(e){toast(e.message,true)}};

function renderRequests(){
  $('#requestsList').innerHTML=state.requests.length?state.requests.map(r=>`<div class="request-card"><span class="badge">#HR-${String(r.id).padStart(4,'0')}</span><h4>${escapeHtml(r.subject)}</h4><p>${escapeHtml(r.detail||'ไม่มีรายละเอียดเพิ่มเติม')}</p><div class="person"><div class="avatar">${initial(r)}</div><div><strong>${escapeHtml(r.nickname||r.first_name)}</strong><small>${escapeHtml(r.request_type)} · ${formatDateTime(r.created_at)}</small></div></div></div>`).join(''):`<div class="empty">ไม่มี Request ค้าง</div>`;
}

function showView(name){
  $$('.view').forEach(v=>v.classList.remove('active')); $$('.nav-item').forEach(v=>v.classList.remove('active'));
  $(`#view-${name}`).classList.add('active'); document.querySelector(`[data-view="${name}"]`)?.classList.add('active');
  $('#pageTitle').textContent={dashboard:'Dashboard',employees:'Employees',recruitment:'Recruitment',attendance:'Attendance',leave:'Leave',requests:'HR Requests'}[name]||name;
  window.scrollTo({top:0,behavior:'smooth'});
}

function openEmployeeModal(){
  openModal('EMPLOYEE','เพิ่มพนักงาน',[
    ['employee_code','Employee Code','text',true],['nickname','ชื่อเล่น','text'],['first_name','ชื่อ','text',true],['last_name','นามสกุล','text',true],['email','Email','email'],['phone','เบอร์โทร','text'],['birth_date','วันเกิด','date'],['start_date','วันเริ่มงาน','date',true],['probation_end_date','ครบ Probation','date'],['contract_end_date','สัญญาสิ้นสุด','date']
  ], async data=>{await api('/api/employees',{method:'POST',body:JSON.stringify(data)});await loadAll();});
}
function openCandidateModal(){
  openModal('RECRUITMENT','เพิ่ม Candidate',[
    ['nickname','ชื่อเล่น','text'],['first_name','ชื่อ','text',true],['last_name','นามสกุล','text',true],['position_name','ตำแหน่งที่สมัคร','text',true],['email','Email','email'],['phone','เบอร์โทร','text'],['source','Source','text'],['expected_salary','Expected Salary','number']
  ], async data=>{await api('/api/candidates',{method:'POST',body:JSON.stringify(data)});await loadAll();});
}
function openModal(eyebrow,title,fields,onSave){
  $('#modalEyebrow').textContent=eyebrow;$('#modalTitle').textContent=title;
  $('#modalFields').className='modal-fields';
  $('#modalFields').innerHTML=fields.map(([name,label,type,required])=>`<div class="field"><label>${label}${required?' *':''}</label><input name="${name}" type="${type}" ${required?'required':''}></div>`).join('');
  $('#modalSave').onclick=async()=>{const form=new FormData($('#modalForm'));const data=Object.fromEntries(form.entries());const missing=fields.find(([n,, ,r])=>r&&!data[n]);if(missing)return toast(`กรอก ${missing[1]}`,true);try{await onSave(data);$('#modal').close();toast('บันทึกแล้ว')}catch(e){toast(e.message,true)}};
  $('#modal').showModal();
}

function iconFor(k){return({missing:'◷',leave_pending:'◇',probation:'⏳',contract:'📄',candidate:'◎',request:'◫'})[k]||'•'}
function attendanceStatus(a){if(!a.check_in_at)return '<span class="badge">ยังไม่เช็กอิน</span>';if(a.status==='late')return `<span class="badge amber">สาย ${a.late_minutes} นาที</span>`;return '<span class="badge green">ตรงเวลา</span>'}
function statusBadge(s){const c=s==='approved'?'green':s==='rejected'?'red':s==='pending'?'amber':'';return `<span class="badge ${c}">${escapeHtml(s)}</span>`}
function initial(e){return escapeHtml((e.nickname||e.first_name||'?').trim().slice(0,1).toUpperCase())}
function time(iso){const d=new Date(iso);return d.toLocaleTimeString('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit'})}
function formatDate(s){if(!s)return'-';const d=new Date(`${s.slice(0,10)}T00:00:00+07:00`);return d.toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Bangkok'})}
function formatDateTime(s){if(!s)return'-';const norm=/T|Z/.test(s)?s:s.replace(' ','T')+'Z';return new Date(norm).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
function money(n){return new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:0}).format(Number(n))}
function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function toast(msg,error=false){const el=$('#toast');el.textContent=msg;el.style.background=error?'#b42318':'#171827';el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200)}
boot();
