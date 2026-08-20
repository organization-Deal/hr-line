const state = {
  token: sessionStorage.getItem('hr_admin_token') || '',
  dashboard: null,
  employees: [],
  candidates: [],
  attendance: [],
  leaves: [],
  requests: [],
  currentView: 'dashboard',
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const stageLabels = {
  new: 'ผู้สมัครใหม่',
  screening: 'คัดกรอง',
  hr_interview: 'HR Interview',
  manager_interview: 'Manager Interview',
  assignment: 'แบบทดสอบ',
  offer: 'Offer',
  hired: 'รับเข้าทำงาน',
  rejected: 'ไม่ผ่าน',
};

const leaveLabels = {
  annual: 'พักร้อน',
  sick: 'ลาป่วย',
  personal: 'ลากิจ',
  unpaid: 'ลาไม่รับค่าจ้าง',
};

const viewMeta = {
  dashboard: ['ภาพรวม', 'HR COMMAND CENTER'],
  employees: ['พนักงาน', 'PEOPLE'],
  recruitment: ['Recruitment', 'TALENT'],
  attendance: ['เวลาเข้างาน', 'WORKDAY'],
  leave: ['การลา', 'LEAVE'],
  requests: ['คำขอ HR', 'HR INBOX'],
  payroll: ['Payroll', 'PAYROLL'],
  documents: ['เอกสาร', 'DOCUMENTS'],
  performance: ['Performance', 'PERFORMANCE'],
  settings: ['ตั้งค่า', 'SYSTEM'],
};

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${state.token}`,
      ...(options.headers || {}),
    },
  });

  let data = {};
  try { data = await res.json(); } catch {}

  if (res.status === 401) {
    logout();
    throw new Error('Admin Token ไม่ถูกต้อง');
  }
  if (!res.ok) throw new Error(data.error || 'โหลดข้อมูลไม่สำเร็จ');
  return data;
}

async function boot() {
  bindEvents();
  renderLoadingState();

  if (state.token) {
    try {
      await loadAll({ silent: true });
      hideLogin();
    } catch (error) {
      showLoginError(error.message);
    }
  } else {
    $('#login').classList.remove('hidden');
  }
}

function bindEvents() {
  $('#loginBtn').onclick = login;
  $('#tokenInput').addEventListener('keydown', event => {
    if (event.key === 'Enter') login();
  });
  $('#logoutBtn').onclick = logout;
  $('#refreshBtn').onclick = () => loadAll();

  $$('.nav-item').forEach(button => {
    button.onclick = () => showView(button.dataset.view);
  });
  $$('[data-jump]').forEach(button => {
    button.onclick = () => showView(button.dataset.jump);
  });

  $('#addEmployeeBtn').onclick = openEmployeeModal;
  $('#addCandidateBtn').onclick = openCandidateModal;
  $('#employeeSearch').addEventListener('input', event => renderEmployees(event.target.value));

  $('#mobileMenuBtn').onclick = () => document.body.classList.toggle('mobile-nav-open');
  $('#mobileNavBackdrop').onclick = closeMobileNav;

  $$('.future-view .secondary-btn').forEach(button => {
    button.onclick = () => toast('โมดูลนี้อยู่ใน Roadmap ของนากนะ V0.3', false, 'i');
  });
}

async function login() {
  const token = $('#tokenInput').value.trim();
  if (!token) return showLoginError('กรุณาใส่ Admin Token');

  state.token = token;
  sessionStorage.setItem('hr_admin_token', token);
  $('#loginBtn').disabled = true;
  $('#loginBtn').textContent = 'กำลังเข้าสู่ระบบ…';

  try {
    await loadAll({ silent: true });
    hideLogin();
    $('#loginError').textContent = '';
    toast('เข้าสู่ระบบเรียบร้อยแล้ว');
  } catch (error) {
    showLoginError(error.message);
  } finally {
    $('#loginBtn').disabled = false;
    $('#loginBtn').textContent = 'เข้าสู่ระบบ';
  }
}

function logout() {
  state.token = '';
  sessionStorage.removeItem('hr_admin_token');
  $('#tokenInput').value = '';
  $('#login').classList.remove('hidden');
  closeMobileNav();
}

function hideLogin() { $('#login').classList.add('hidden'); }
function showLoginError(message) { $('#loginError').textContent = message; }
function closeMobileNav() { document.body.classList.remove('mobile-nav-open'); }

async function loadAll({ silent = false } = {}) {
  setLoading(true);
  try {
    const [dashboard, employees, candidates, attendance, leaves, requests] = await Promise.all([
      api('/api/dashboard'),
      api('/api/employees'),
      api('/api/candidates'),
      api('/api/attendance/today'),
      api('/api/leaves'),
      api('/api/requests'),
    ]);

    state.dashboard = dashboard;
    state.employees = employees.data || [];
    state.candidates = candidates.data || [];
    state.attendance = attendance.data || [];
    state.leaves = leaves.data || [];
    state.requests = requests.data || [];

    renderAll();
    if (!silent) toast('อัปเดตข้อมูลล่าสุดแล้ว');
  } finally {
    setLoading(false);
  }
}

function setLoading(loading) {
  $('#refreshBtn').classList.toggle('loading', loading);
  $('#refreshBtn').disabled = loading;
}

function renderLoadingState() {
  $('#summaryGrid').innerHTML = Array.from({ length: 5 }, () => `
    <div class="summary-item">
      <div class="skeleton" style="width:72%;height:11px"></div>
      <div class="skeleton" style="width:42px;height:28px;margin-top:8px"></div>
    </div>`).join('');
  $('#attentionList').innerHTML = Array.from({ length: 4 }, () => '<div class="loading-row skeleton"></div>').join('');
  $('#birthdayList').innerHTML = Array.from({ length: 3 }, () => '<div class="loading-row skeleton"></div>').join('');
  $('#recruitmentPipeline').innerHTML = Array.from({ length: 6 }, () => '<div class="pipe-item"><div class="skeleton" style="height:25px;width:35px"></div><div class="skeleton" style="height:8px;width:60px;margin-top:7px"></div></div>').join('');
  $('#upcomingList').innerHTML = Array.from({ length: 3 }, () => '<div class="loading-row skeleton"></div>').join('');
}

function renderAll() {
  renderDashboard();
  renderEmployees($('#employeeSearch')?.value || '');
  renderCandidates();
  renderAttendance();
  renderLeaves();
  renderRequests();

  $('#todayText').textContent = formatDate(state.dashboard.today);
  $('#sidebarCompany').textContent = state.dashboard.client?.name || 'บริษัทของคุณ';
}

function renderDashboard() {
  const d = state.dashboard;
  const total = d.attention.reduce((sum, item) => sum + item.count, 0);

  $('#attentionTotal').textContent = total;
  $('#navAttention').textContent = total;
  $('#navAttention').dataset.empty = total ? 'false' : 'true';
  $('#heroSub').textContent = `${d.client.name} · ${d.summary.employees} คน · ${formatDate(d.today)}`;

  const summary = [
    ['พนักงานทั้งหมด', d.summary.employees, 'brand'],
    ['มาทำงานวันนี้', d.summary.present, 'success'],
    ['มาสาย', d.summary.late, 'warning'],
    ['ลาวันนี้', d.summary.leave, 'info'],
    ['ยังไม่เช็กอิน', d.summary.missing, 'danger'],
  ];

  $('#summaryGrid').innerHTML = summary.map(([label, value, tone]) => `
    <div class="summary-item">
      <div class="summary-label"><span class="summary-dot ${tone}"></span>${label}</div>
      <div class="summary-value">${value}<small>คน</small></div>
    </div>`).join('');

  $('#attentionList').innerHTML = d.attention.length
    ? d.attention.map(item => `
      <div class="list-row actionable" data-attention="${escapeHtml(item.key)}">
        <div class="list-icon ${attentionTone(item)}">${attentionIcon(item.key)}</div>
        <div class="list-copy">
          <strong>${attentionCopy(item)}</strong>
          <small>${attentionHelp(item.key)}</small>
        </div>
        <div class="count">${item.count}</div>
      </div>`).join('')
    : emptyState('วันนี้งานสำคัญเคลียร์แล้ว', 'ยังไม่มีรายการที่ HR ต้องรีบจัดการตอนนี้');

  $$('[data-attention]').forEach(row => {
    row.onclick = () => {
      const target = attentionTarget(row.dataset.attention);
      if (target) showView(target);
    };
  });

  $('#birthdayList').innerHTML = d.birthdays.length
    ? d.birthdays.map(person => `
      <div class="list-row">
        <div class="list-icon coral">${iconSvg('gift')}</div>
        <div class="list-copy">
          <strong>${escapeHtml(person.name)}</strong>
          <small>${person.days === 0 ? 'วันเกิดวันนี้ 🎉' : `วันเกิดอีก ${person.days} วัน`} · ${formatDate(person.date)}</small>
        </div>
        <span class="badge ${person.days === 0 ? 'badge-brand' : 'badge-neutral'}">${person.days === 0 ? 'วันนี้' : `${person.days} วัน`}</span>
      </div>`).join('')
    : emptyState('ยังไม่มีวันเกิดใกล้ถึง', 'นากนะจะแจ้งให้ HR รู้ล่วงหน้าเมื่อมีวันสำคัญ');

  const pipelineStages = ['new', 'screening', 'hr_interview', 'manager_interview', 'offer', 'hired'];
  $('#recruitmentPipeline').innerHTML = pipelineStages.map(stage => `
    <div class="pipe-item">
      <b>${d.recruitment[stage] || 0}</b>
      <span>${stageLabels[stage]}</span>
    </div>`).join('');

  const upcoming = [
    ...d.probation.map(item => ({ ...item, type: 'Probation', icon: 'clock' })),
    ...d.contracts.map(item => ({ ...item, type: 'สัญญา', icon: 'document' })),
  ].sort((a, b) => a.days - b.days);

  $('#upcomingList').innerHTML = upcoming.length
    ? upcoming.map(item => `
      <div class="list-row">
        <div class="list-icon ${item.days <= 7 ? 'warning' : ''}">${iconSvg(item.icon)}</div>
        <div class="list-copy">
          <strong>${escapeHtml(item.name)}</strong>
          <small>${item.type} · ${formatDate(item.date)}</small>
        </div>
        <span class="badge ${item.days <= 7 ? 'badge-warning' : 'badge-neutral'}">${item.days} วัน</span>
      </div>`).join('')
    : emptyState('ยังไม่มีกำหนดการใกล้ถึง', 'Probation และสัญญาที่ใกล้ครบจะมาแสดงตรงนี้');
}

function renderEmployees(query = '') {
  const normalized = query.trim().toLowerCase();
  const employees = normalized
    ? state.employees.filter(employee => [
        employee.nickname,
        employee.first_name,
        employee.last_name,
        employee.employee_code,
        employee.department_name,
        employee.position_name,
      ].some(value => String(value || '').toLowerCase().includes(normalized)))
    : state.employees;

  $('#employeeCountText').textContent = `${employees.length} คน`;

  $('#employeesBody').innerHTML = employees.length
    ? employees.map(employee => `
      <tr>
        <td data-label="พนักงาน">
          <div class="person">
            <div class="avatar">${initial(employee)}</div>
            <div><strong>${escapeHtml(employee.nickname || employee.first_name)} ${escapeHtml(employee.last_name)}</strong><small>${escapeHtml(employee.employee_code)}</small></div>
          </div>
        </td>
        <td data-label="แผนก">${escapeHtml(employee.department_name || '—')}</td>
        <td data-label="ตำแหน่ง">${escapeHtml(employee.position_name || '—')}</td>
        <td data-label="เริ่มงาน">${formatDate(employee.start_date)}</td>
        <td data-label="LINE">${employee.line_user_id ? '<span class="badge badge-success"><span class="status-dot"></span> เชื่อมแล้ว</span>' : '<span class="badge badge-neutral">ยังไม่เชื่อม</span>'}</td>
        <td data-label="จัดการ">${employee.line_user_id ? '<span class="muted">—</span>' : `<button class="text-btn" onclick="window.createLineCode(${employee.id})">สร้างรหัส LINE</button>`}</td>
      </tr>`).join('')
    : `<tr><td colspan="6">${emptyState('ไม่พบพนักงาน', 'ลองค้นหาด้วยชื่อ รหัสพนักงาน หรือแผนกอีกครั้ง')}</td></tr>`;
}

window.createLineCode = async id => {
  try {
    const result = await api(`/api/employees/${id}/line-link-code`, { method: 'POST', body: '{}' });
    const command = `LINK ${result.token}`;
    try { await navigator.clipboard?.writeText(command); } catch {}
    toast('สร้างรหัส LINE และคัดลอกคำสั่งแล้ว');
    window.alert(`รหัสเชื่อม LINE: ${result.token}\n\nให้พนักงานส่งใน LINE OA:\n${command}\n\nรหัสหมดอายุใน 15 นาที`);
  } catch (error) {
    toast(error.message, true);
  }
};

function renderCandidates() {
  const activeStages = ['new', 'screening', 'hr_interview', 'manager_interview', 'assignment', 'offer'];
  const total = state.candidates.length;
  const interviewing = state.candidates.filter(candidate => ['hr_interview', 'manager_interview'].includes(candidate.stage)).length;
  const offer = state.candidates.filter(candidate => candidate.stage === 'offer').length;

  $('#candidateTotal').textContent = total;
  $('#candidateInterview').textContent = interviewing;
  $('#candidateOffer').textContent = offer;

  $('#kanban').innerHTML = activeStages.map(stage => {
    const items = state.candidates.filter(candidate => candidate.stage === stage);
    return `
      <div class="kanban-col">
        <div class="kanban-head"><span>${stageLabels[stage]}</span><span class="badge badge-neutral">${items.length}</span></div>
        ${items.length ? items.map(candidate => `
          <article class="candidate-card">
            <strong>${escapeHtml(candidate.nickname || candidate.first_name)} ${escapeHtml(candidate.last_name)}</strong>
            <small>${escapeHtml(candidate.position_name)}</small>
            <div class="candidate-meta"><span>${escapeHtml(candidate.source || 'Direct')}</span><span>${candidate.expected_salary ? money(candidate.expected_salary) : 'ไม่ระบุเงินเดือน'}</span></div>
            <select aria-label="เปลี่ยนสถานะผู้สมัคร" onchange="window.moveCandidate(${candidate.id},this.value)">
              ${activeStages.concat(['hired', 'rejected']).map(option => `<option value="${option}" ${option === candidate.stage ? 'selected' : ''}>${stageLabels[option]}</option>`).join('')}
            </select>
          </article>`).join('') : `<div class="empty-state"><strong>ยังไม่มีผู้สมัคร</strong><p>ผู้สมัครในขั้นนี้จะมาแสดงตรงนี้</p></div>`}
      </div>`;
  }).join('');
}

window.moveCandidate = async (id, stage) => {
  try {
    await api(`/api/candidates/${id}/stage`, { method: 'PATCH', body: JSON.stringify({ stage }) });
    await loadAll({ silent: true });
    toast(`อัปเดตสถานะเป็น “${stageLabels[stage]}” แล้ว`);
  } catch (error) {
    toast(error.message, true);
  }
};

function renderAttendance() {
  const total = state.attendance.length;
  const late = state.attendance.filter(item => item.status === 'late').length;
  const checkedOut = state.attendance.filter(item => item.check_out_at).length;

  $('#attendanceSummary').innerHTML = `
    <span><strong>${total}</strong> เช็กอินแล้ว</span>
    <span><strong>${late}</strong> มาสาย</span>
    <span><strong>${checkedOut}</strong> เช็กเอาต์แล้ว</span>`;

  $('#attendanceBody').innerHTML = state.attendance.length
    ? state.attendance.map(attendance => `
      <tr>
        <td data-label="พนักงาน"><div class="person"><div class="avatar">${initial(attendance)}</div><div><strong>${escapeHtml(attendance.nickname || attendance.first_name)} ${escapeHtml(attendance.last_name)}</strong><small>${escapeHtml(attendance.employee_code)}</small></div></div></td>
        <td data-label="แผนก">${escapeHtml(attendance.department_name || '—')}</td>
        <td data-label="Check-in">${attendance.check_in_at ? time(attendance.check_in_at) : '—'}</td>
        <td data-label="Check-out">${attendance.check_out_at ? time(attendance.check_out_at) : '—'}</td>
        <td data-label="สถานะ">${attendanceStatus(attendance)}</td>
      </tr>`).join('')
    : `<tr><td colspan="5">${emptyState('ยังไม่มีการเช็กอินวันนี้', 'เมื่อพนักงานเช็กอินผ่าน LINE รายการจะมาแสดงตรงนี้')}</td></tr>`;
}

function renderLeaves() {
  const pending = state.leaves.filter(leave => leave.status === 'pending').length;
  const approved = state.leaves.filter(leave => leave.status === 'approved').length;
  const rejected = state.leaves.filter(leave => leave.status === 'rejected').length;

  $('#leaveSummary').innerHTML = `
    <span><strong>${pending}</strong> รออนุมัติ</span>
    <span><strong>${approved}</strong> อนุมัติแล้ว</span>
    <span><strong>${rejected}</strong> ไม่อนุมัติ</span>`;

  $('#leaveBody').innerHTML = state.leaves.length
    ? state.leaves.map(leave => `
      <tr>
        <td data-label="พนักงาน"><div class="person"><div class="avatar">${initial(leave)}</div><div><strong>${escapeHtml(leave.nickname || leave.first_name)} ${escapeHtml(leave.last_name || '')}</strong><small>#LV-${String(leave.id).padStart(4, '0')}</small></div></div></td>
        <td data-label="ประเภท">${leaveLabels[leave.leave_type] || escapeHtml(leave.leave_type)}</td>
        <td data-label="ช่วงวันที่">${formatDate(leave.start_date)}${leave.start_date !== leave.end_date ? ` – ${formatDate(leave.end_date)}` : ''}</td>
        <td data-label="เหตุผล">${escapeHtml(leave.reason || '—')}</td>
        <td data-label="สถานะ">${statusBadge(leave.status)}</td>
        <td data-label="จัดการ">${leave.status === 'pending' ? `<button class="text-btn" onclick="window.leaveAction(${leave.id},'approve')">อนุมัติ</button> <button class="text-btn danger" onclick="window.leaveAction(${leave.id},'reject')">ไม่อนุมัติ</button>` : '<span class="muted">—</span>'}</td>
      </tr>`).join('')
    : `<tr><td colspan="6">${emptyState('ยังไม่มีคำขอลา', 'คำขอลาจากพนักงานจะแสดงพร้อมสถานะอนุมัติที่นี่')}</td></tr>`;
}

window.leaveAction = async (id, action) => {
  try {
    await api(`/api/leaves/${id}/${action}`, { method: 'PATCH', body: '{}' });
    await loadAll({ silent: true });
    toast(action === 'approve' ? 'อนุมัติคำขอลาเรียบร้อยแล้ว' : 'บันทึกว่าไม่อนุมัติแล้ว');
  } catch (error) {
    toast(error.message, true);
  }
};

function renderRequests() {
  $('#requestCountBadge').textContent = `${state.requests.length} รายการ`;
  $('#requestsList').innerHTML = state.requests.length
    ? state.requests.map(request => `
      <article class="request-card">
        <span class="badge badge-neutral">#HR-${String(request.id).padStart(4, '0')}</span>
        <h4>${escapeHtml(request.subject)}</h4>
        <p>${escapeHtml(request.detail || 'ไม่มีรายละเอียดเพิ่มเติม')}</p>
        <div class="person"><div class="avatar">${initial(request)}</div><div><strong>${escapeHtml(request.nickname || request.first_name)}</strong><small>${requestTypeLabel(request.request_type)} · ${formatDateTime(request.created_at)}</small></div></div>
      </article>`).join('')
    : emptyState('HR Inbox โล่งแล้ว', 'ตอนนี้ไม่มีคำขอจากพนักงานที่กำลังรอดำเนินการ');
}

function showView(name) {
  const target = $(`#view-${name}`);
  if (!target) return;

  state.currentView = name;
  $$('.view').forEach(view => view.classList.remove('active'));
  $$('.nav-item').forEach(button => button.classList.remove('active'));

  target.classList.add('active');
  document.querySelector(`[data-view="${name}"]`)?.classList.add('active');

  const [title, kicker] = viewMeta[name] || [name, 'NAKNA HR'];
  $('#pageTitle').textContent = title;
  $('#pageKicker').textContent = kicker;

  closeMobileNav();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openEmployeeModal() {
  openModal('EMPLOYEE', 'เพิ่มพนักงานใหม่', 'ข้อมูลนี้จะถูกใช้สร้าง Employee Profile และเชื่อม LINE ภายหลัง', [
    ['employee_code', 'รหัสพนักงาน', 'text', true],
    ['nickname', 'ชื่อเล่น', 'text'],
    ['first_name', 'ชื่อ', 'text', true],
    ['last_name', 'นามสกุล', 'text', true],
    ['email', 'อีเมล', 'email'],
    ['phone', 'เบอร์โทร', 'text'],
    ['birth_date', 'วันเกิด', 'date'],
    ['start_date', 'วันเริ่มงาน', 'date', true],
    ['probation_end_date', 'วันครบ Probation', 'date'],
    ['contract_end_date', 'วันสิ้นสุดสัญญา', 'date'],
  ], async data => {
    await api('/api/employees', { method: 'POST', body: JSON.stringify(data) });
    await loadAll({ silent: true });
  });
}

function openCandidateModal() {
  openModal('RECRUITMENT', 'เพิ่มผู้สมัคร', 'เริ่มเก็บ Candidate ตั้งแต่เข้ามา เพื่อไม่ให้ประวัติการติดต่อหลุดหาย', [
    ['nickname', 'ชื่อเล่น', 'text'],
    ['first_name', 'ชื่อ', 'text', true],
    ['last_name', 'นามสกุล', 'text', true],
    ['position_name', 'ตำแหน่งที่สมัคร', 'text', true],
    ['email', 'อีเมล', 'email'],
    ['phone', 'เบอร์โทร', 'text'],
    ['source', 'ช่องทางที่สมัคร', 'text'],
    ['expected_salary', 'เงินเดือนที่คาดหวัง', 'number'],
  ], async data => {
    await api('/api/candidates', { method: 'POST', body: JSON.stringify(data) });
    await loadAll({ silent: true });
  });
}

function openModal(eyebrow, title, subtitle, fields, onSave) {
  $('#modalEyebrow').textContent = eyebrow;
  $('#modalTitle').textContent = title;
  $('#modalSubtitle').textContent = subtitle;
  $('#modalFields').className = 'modal-fields';
  $('#modalForm').reset();

  $('#modalFields').innerHTML = fields.map(([name, label, type, required]) => `
    <div class="field">
      <label for="field-${name}">${label}${required ? ' <em>*</em>' : ''}</label>
      <input id="field-${name}" name="${name}" type="${type}" ${required ? 'required' : ''} />
    </div>`).join('');

  $('#modalSave').onclick = async () => {
    const form = new FormData($('#modalForm'));
    const data = Object.fromEntries(form.entries());
    const missing = fields.find(([name, , , required]) => required && !String(data[name] || '').trim());
    if (missing) return toast(`กรุณากรอก “${missing[1]}”`, true);

    $('#modalSave').disabled = true;
    $('#modalSave').textContent = 'กำลังบันทึก…';
    try {
      await onSave(data);
      $('#modal').close();
      toast('บันทึกเรียบร้อยแล้ว');
    } catch (error) {
      toast(error.message, true);
    } finally {
      $('#modalSave').disabled = false;
      $('#modalSave').textContent = 'บันทึกข้อมูล';
    }
  };

  $('#modal').showModal();
}

function attentionCopy(item) {
  const copies = {
    missing: `มีพนักงาน ${item.count} คนยังไม่เช็กอิน`,
    leave_pending: `มีคำขอลารออนุมัติ ${item.count} รายการ`,
    probation: `มีพนักงาน ${item.count} คนใกล้ครบ Probation`,
    contract: `มีสัญญาพนักงาน ${item.count} รายการใกล้หมด`,
    candidate: `มีผู้สมัคร ${item.count} คนที่ควร Follow up`,
    request: `มีคำขอ HR ค้างอยู่ ${item.count} รายการ`,
  };
  return copies[item.key] || item.label;
}

function attentionHelp(key) {
  return ({
    missing: 'ตรวจสอบคนที่ยังไม่ลงเวลา หรือกำลังทำงานนอกสถานที่',
    leave_pending: 'เข้าไปอนุมัติหรือไม่อนุมัติให้เรียบร้อย',
    probation: 'เตรียมส่งแบบประเมินให้ Manager',
    contract: 'เช็กการต่อสัญญาก่อนถึงวันหมดอายุ',
    candidate: 'ผู้สมัครไม่มี Activity มากกว่า 3 วัน',
    request: 'คำขอจากพนักงานที่ยังไม่ได้ปิดงาน',
  })[key] || 'เปิดดูรายละเอียดและดำเนินการต่อ';
}

function attentionTarget(key) {
  return ({ missing: 'attendance', leave_pending: 'leave', probation: 'employees', contract: 'employees', candidate: 'recruitment', request: 'requests' })[key];
}

function attentionTone(item) {
  if (item.key === 'missing') return 'coral';
  if (['leave_pending', 'probation', 'contract'].includes(item.key)) return 'warning';
  if (item.key === 'request') return 'info';
  return '';
}

function attendanceStatus(item) {
  if (!item.check_in_at) return '<span class="badge badge-neutral">ยังไม่เช็กอิน</span>';
  if (item.status === 'late') return `<span class="badge badge-warning"><span class="status-dot"></span> สาย ${Number(item.late_minutes || 0)} นาที</span>`;
  return '<span class="badge badge-success"><span class="status-dot"></span> ตรงเวลา</span>';
}

function statusBadge(status) {
  const config = {
    approved: ['badge-success', 'อนุมัติแล้ว'],
    rejected: ['badge-danger', 'ไม่อนุมัติ'],
    pending: ['badge-warning', 'รออนุมัติ'],
    received: ['badge-info', 'รับเรื่องแล้ว'],
    processing: ['badge-warning', 'กำลังดำเนินการ'],
  };
  const [className, label] = config[status] || ['badge-neutral', status];
  return `<span class="badge ${className}">${escapeHtml(label)}</span>`;
}

function requestTypeLabel(type) {
  return ({ document: 'เอกสาร', payroll: 'เงินเดือน', profile: 'ข้อมูลพนักงาน', benefit: 'สวัสดิการ', equipment: 'อุปกรณ์' })[type] || type || 'คำขอทั่วไป';
}

function attentionIcon(key) {
  return ({
    missing: iconSvg('clock'),
    leave_pending: iconSvg('calendar'),
    probation: iconSvg('review'),
    contract: iconSvg('document'),
    candidate: iconSvg('person'),
    request: iconSvg('message'),
  })[key] || iconSvg('dot');
}

function iconSvg(name) {
  const paths = {
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calendar: '<path d="M6 4v3M18 4v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12H4V7a1 1 0 0 1 1-1Z"/>',
    review: '<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h5M8 16h3"/>',
    document: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    person: '<circle cx="9" cy="8" r="4"/><path d="M3 21v-2a6 6 0 0 1 10-4.5M17 14v6M20 17h-6"/>',
    message: '<path d="M5 5h14v11H8l-3 3V5Z"/><path d="M8 9h8M8 12h5"/>',
    gift: '<path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13"/><path d="M12 7H8.5A2.5 2.5 0 1 1 11 4.5L12 7Zm0 0h3.5A2.5 2.5 0 1 0 13 4.5L12 7Z"/>',
    dot: '<circle cx="12" cy="12" r="3"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.dot}</svg>`;
}

function emptyState(title, description) {
  return `<div class="empty-state"><div class="empty-face" aria-hidden="true"><span></span></div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(description)}</p></div>`;
}

function initial(entity) {
  return escapeHtml((entity.nickname || entity.first_name || '?').trim().slice(0, 1).toUpperCase());
}

function time(iso) {
  const date = new Date(iso);
  return date.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });
}

function formatDate(value) {
  if (!value) return '—';
  const string = String(value);
  const datePart = string.slice(0, 10);
  const date = new Date(`${datePart}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return escapeHtml(string);
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' });
}

function formatDateTime(value) {
  if (!value) return '—';
  const normalized = /T|Z/.test(value) ? value : value.replace(' ', 'T') + 'Z';
  return new Date(normalized).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function money(value) {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(Number(value));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

let toastTimer;
function toast(message, error = false, icon = null) {
  const element = $('#toast');
  const iconElement = $('#toastIcon');
  $('#toastText').textContent = message;
  iconElement.textContent = icon || (error ? '!' : '✓');
  element.classList.toggle('error', error);
  element.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('show'), 2400);
}

boot();
