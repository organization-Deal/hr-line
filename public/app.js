const state = {
  me: null,
  gmail: null,
  dashboard: null,
  employees: [],
  candidates: [],
  attendance: [],
  leaves: [],
  requests: [],
  invites: [],
  lookups: { departments: [], positions: [], locations: [] },
  workLocations: [],
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
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });

  let data = {};
  try { data = await res.json(); } catch {}

  if (res.status === 401) {
    showLogin();
    throw new Error('AUTH_REQUIRED');
  }
  if (res.status === 409 && data.error === 'COMPANY_REQUIRED') {
    await loadSessionOnly();
    throw new Error('COMPANY_REQUIRED');
  }
  if (!res.ok) throw new Error(data.error || 'โหลดข้อมูลไม่สำเร็จ');
  return data;
}

async function boot() {
  bindEvents();
  renderLoadingState();
  const ready = await loadSessionOnly();
  handleReturnMessage();
  if (ready && await ensureWorkspaceReady()) await loadAll({ silent: true });
}

function bindEvents() {
  $('#googleLoginBtn').onclick = () => { window.location.href = '/auth/google/start'; };
  $('#logoutBtn').onclick = logout;
  $('#onboardingLogoutBtn').onclick = logout;
  $('#createCompanyBtn').onclick = createCompany;
  $('#claimCompanyBtn').onclick = claimLegacyCompany;
  $('#companySwitcher').onclick = event => {
    event.stopPropagation();
    const menu = $('#companyMenu');
    const willOpen = menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !willOpen);
    $('#companySwitcher').setAttribute('aria-expanded', String(willOpen));
  };
  document.addEventListener('click', () => {
    $('#companyMenu').classList.add('hidden');
    $('#companySwitcher').setAttribute('aria-expanded', 'false');
  });
  $('#gmailConnectBtn').onclick = () => { window.location.href = '/integrations/gmail/start'; };
  $('#gmailDisconnectBtn').onclick = disconnectGmail;
  $('#refreshBtn').onclick = () => loadAll();

  $$('.nav-item').forEach(button => {
    button.onclick = () => showView(button.dataset.view);
  });
  $$('[data-jump]').forEach(button => {
    button.onclick = () => showView(button.dataset.jump);
  });

  $('#addEmployeeBtn').onclick = openEmployeeModal;
  $('#inviteEmployeeBtn').onclick = openInviteModal;
  $('#inviteEmployeeBtnInline').onclick = openInviteModal;
  $('#addWorkLocationBtn').onclick = openWorkLocationModal;
  $('#inviteCreateBtn').onclick = createInvite;
  $('#locationSaveBtn').onclick = saveWorkLocation;
  $('#useCurrentLocationBtn').onclick = useCurrentLocation;
  $('#addCandidateBtn').onclick = openCandidateModal;
  $('#employeeSearch').addEventListener('input', event => renderEmployees(event.target.value));

  $('#mobileMenuBtn').onclick = () => document.body.classList.toggle('mobile-nav-open');
  $('#mobileNavBackdrop').onclick = closeMobileNav;

  $$('.future-view .secondary-btn').forEach(button => {
    button.onclick = () => toast('โมดูลนี้อยู่ใน Roadmap ของนากนะ V0.4', false, 'i');
  });
}

async function loadSessionOnly() {
  try {
    const res = await fetch('/api/me', { credentials: 'same-origin' });
    let data = {};
    try { data = await res.json(); } catch {}
    if (res.status === 401) {
      state.me = null;
      showLogin();
      return false;
    }
    if (!res.ok) throw new Error(data.error || 'โหลดบัญชีไม่สำเร็จ');
    state.me = data;
    hideLogin();
    renderIdentity();
    if (!(data.companies || []).length) {
      showOnboarding();
      return false;
    }
    hideOnboarding();
    return true;
  } catch (error) {
    showLogin();
    showLoginError(error.message);
    return false;
  }
}

function showLogin() {
  $('#login').classList.remove('hidden');
  $('#onboarding').classList.add('hidden');
}
function hideLogin() { $('#login').classList.add('hidden'); }
function showLoginError(message) { $('#loginError').textContent = message === 'AUTH_REQUIRED' ? '' : message; }
function closeMobileNav() { document.body.classList.remove('mobile-nav-open'); }

function showOnboarding() {
  hideLogin();
  const me = state.me || {};
  $('#onboarding').classList.remove('hidden');
  $('#onboardingName').textContent = me.user?.name ? `${me.user.name} 👋` : '👋';
  const claimable = me.claimable_company;
  $('#claimCompanyBtn').classList.toggle('hidden', !claimable);
  if (claimable) $('#claimCompanyName').textContent = `${claimable.name} · Workspace เดิมในระบบ`;
}
function hideOnboarding() { $('#onboarding').classList.add('hidden'); }

async function createCompany() {
  const name = $('#companyNameInput').value.trim();
  if (name.length < 2) return toast('กรุณาใส่ชื่อบริษัท', true);
  const button = $('#createCompanyBtn');
  button.disabled = true;
  button.textContent = 'กำลังสร้าง Workspace…';
  try {
    await api('/api/companies', { method: 'POST', body: JSON.stringify({ name }) });
    const ready = await loadSessionOnly();
    if (ready && await ensureWorkspaceReady()) await loadAll({ silent: true });
    toast('สร้าง Workspace เรียบร้อยแล้ว');
  } catch (error) {
    if (!['AUTH_REQUIRED','COMPANY_REQUIRED'].includes(error.message)) toast(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = 'สร้าง Workspace';
  }
}

async function claimLegacyCompany() {
  const company = state.me?.claimable_company;
  if (!company) return;
  const button = $('#claimCompanyBtn');
  button.disabled = true;
  try {
    await api('/api/onboarding/claim-company', { method: 'POST', body: JSON.stringify({ client_id: company.id }) });
    const ready = await loadSessionOnly();
    if (ready && await ensureWorkspaceReady()) await loadAll({ silent: true });
    toast(`เชื่อม Workspace ${company.name} เรียบร้อยแล้ว`);
  } catch (error) {
    if (!['AUTH_REQUIRED','COMPANY_REQUIRED'].includes(error.message)) toast(error.message, true);
  } finally {
    button.disabled = false;
  }
}

async function logout() {
  try { await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' }); } catch {}
  state.me = null;
  state.gmail = null;
  window.location.href = '/';
}

async function switchCompany(clientId) {
  if (Number(clientId) === Number(state.me?.active_company_id)) return;
  try {
    await api('/api/session/company', { method: 'POST', body: JSON.stringify({ client_id: Number(clientId) }) });
    const ready = await loadSessionOnly();
    if (ready && await ensureWorkspaceReady()) await loadAll({ silent: true });
    toast('เปลี่ยนบริษัทเรียบร้อยแล้ว');
  } catch (error) {
    if (!['AUTH_REQUIRED','COMPANY_REQUIRED'].includes(error.message)) toast(error.message, true);
  }
}

function renderIdentity() {
  const me = state.me;
  if (!me?.user) return;
  const user = me.user;
  const memberships = me.companies || [];
  const active = memberships.find(company => Number(company.id) === Number(me.active_company_id)) || memberships[0];

  $('#profileName').textContent = user.name || user.email;
  $('#profileRole').textContent = active ? roleLabel(active.role) : 'ยังไม่มี Workspace';
  const avatar = $('#profileAvatar');
  avatar.textContent = (user.name || user.email || 'U').trim().slice(0, 1).toUpperCase();
  avatar.classList.toggle('has-photo', Boolean(user.picture_url));
  avatar.style.backgroundImage = user.picture_url ? `url("${String(user.picture_url).replace(/"/g, '%22')}")` : '';

  if (active) {
    $('#sidebarCompany').textContent = active.name;
    $('#sidebarRole').textContent = roleLabel(active.role);
    $('#companyAvatar').textContent = (active.name || 'N').trim().slice(0, 1).toUpperCase();
  }

  $('#companyMenu').innerHTML = memberships.map(company => `
    <button class="company-menu-item ${Number(company.id) === Number(me.active_company_id) ? 'active' : ''}" data-company-id="${Number(company.id)}" role="menuitem">
      <span class="company-menu-avatar">${escapeHtml((company.name || 'N').slice(0,1).toUpperCase())}</span>
      <span><strong>${escapeHtml(company.name)}</strong><small>${escapeHtml(roleLabel(company.role))}</small></span>
      ${Number(company.id) === Number(me.active_company_id) ? '<b>✓</b>' : ''}
    </button>`).join('');
  $$('[data-company-id]').forEach(button => {
    button.onclick = event => {
      event.stopPropagation();
      $('#companyMenu').classList.add('hidden');
      switchCompany(button.dataset.companyId);
    };
  });
}

function roleLabel(role) {
  return ({ owner: 'Owner', hr_admin: 'HR Admin', hr: 'HR', manager: 'Manager', employee: 'Employee', viewer: 'Viewer' })[role] || role || 'Member';
}

async function disconnectGmail() {
  if (!state.gmail?.connected) return;
  const button = $('#gmailDisconnectBtn');
  button.disabled = true;
  try {
    await api('/api/integrations/gmail', { method: 'DELETE' });
    state.gmail = { connected: false, account: null };
    renderSettings();
    toast('ยกเลิกการเชื่อม Gmail แล้ว');
  } catch (error) {
    if (!['AUTH_REQUIRED','COMPANY_REQUIRED'].includes(error.message)) toast(error.message, true);
  } finally {
    button.disabled = false;
  }
}

function handleReturnMessage() {
  const url = new URL(window.location.href);
  if (url.searchParams.get('gmail') === 'connected') toast('เชื่อม Gmail เรียบร้อยแล้ว');
  if (url.searchParams.get('auth') === 'success') toast('เข้าสู่ระบบด้วย Google เรียบร้อยแล้ว');
  if (url.searchParams.has('auth_error')) showLoginError('เข้าสู่ระบบ Google ไม่สำเร็จ กรุณาลองใหม่');
  if (url.searchParams.has('gmail_error')) toast('เชื่อม Gmail ไม่สำเร็จ กรุณาลองใหม่', true);
  if ([...url.searchParams.keys()].some(key => ['gmail','auth','auth_error','gmail_error'].includes(key))) {
    url.search = '';
    history.replaceState({}, '', url.pathname + url.hash);
  }
}

async function ensureWorkspaceReady() {
  try {
    await api('/api/bootstrap');
    return true;
  } catch (error) {
    if (!['AUTH_REQUIRED','COMPANY_REQUIRED'].includes(error.message)) {
      toast(`เตรียมฐานข้อมูลไม่สำเร็จ: ${error.message}`, true);
    }
    return false;
  }
}

async function loadAll({ silent = false } = {}) {
  setLoading(true);
  try {
    const [dashboard, employees, candidates, attendance, leaves, requests, gmail, invites, lookups, workLocations] = await Promise.all([
      api('/api/dashboard'),
      api('/api/employees'),
      api('/api/candidates'),
      api('/api/attendance/today'),
      api('/api/leaves'),
      api('/api/requests'),
      api('/api/integrations/gmail'),
      api('/api/invites'),
      api('/api/lookups'),
      api('/api/work-locations'),
    ]);

    state.dashboard = dashboard;
    state.employees = employees.data || [];
    state.candidates = candidates.data || [];
    state.attendance = attendance.data || [];
    state.leaves = leaves.data || [];
    state.requests = requests.data || [];
    state.gmail = gmail;
    state.invites = invites.data || [];
    state.lookups = lookups || { departments: [], positions: [], locations: [] };
    state.workLocations = workLocations.data || [];

    renderAll();
    renderIdentity();
    renderSettings();
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
  renderInviteCenter();
  renderWorkLocations();

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
        employee.line_display_name,
        employee.work_location_names,
      ].some(value => String(value || '').toLowerCase().includes(normalized)))
    : state.employees;

  $('#employeeCountText').textContent = `${employees.length} คน`;
  const connected = state.employees.filter(employee => employee.line_user_id).length;
  $('#peopleTotal').textContent = state.employees.length;
  $('#peopleLineConnected').textContent = connected;
  $('#peopleLinePending').textContent = Math.max(0, state.employees.length - connected);
  $('#peopleActiveInvites').textContent = state.invites.filter(invite => invite.status === 'active' && new Date(invite.expires_at).getTime() > Date.now() && Number(invite.used_count) < Number(invite.max_uses)).length;

  $('#employeesBody').innerHTML = employees.length
    ? employees.map(employee => `
      <tr>
        <td data-label="พนักงาน">
          <div class="person">
            <div class="avatar ${employee.line_picture_url ? 'avatar-photo' : ''}" ${employee.line_picture_url ? `style="background-image:url('${escapeHtml(employee.line_picture_url)}')"` : ''}>${employee.line_picture_url ? '' : initial(employee)}</div>
            <div><strong>${escapeHtml(employee.nickname || employee.first_name)} ${escapeHtml(employee.last_name)}</strong><small>${escapeHtml(employee.employee_code)}${employee.position_name ? ` · ${escapeHtml(employee.position_name)}` : ''}</small></div>
          </div>
        </td>
        <td data-label="แผนก">${escapeHtml(employee.department_name || '—')}</td>
        <td data-label="Work Location">${employee.work_location_names ? `<span class="location-inline">📍 ${escapeHtml(employee.work_location_names)}</span>` : '<span class="muted">ทุก Location</span>'}</td>
        <td data-label="เริ่มงาน">${formatDate(employee.start_date)}</td>
        <td data-label="LINE">${employee.line_user_id
          ? `<div class="line-connected"><span class="badge badge-success"><span class="status-dot"></span> เชื่อมแล้ว</span><small>${escapeHtml(employee.line_display_name || 'LINE account')}</small></div>`
          : '<span class="badge badge-neutral">ยังไม่เชื่อม</span>'}</td>
        <td data-label="สถานะ"><span class="badge ${employee.status === 'active' ? 'badge-success' : 'badge-neutral'}">${employee.status === 'active' ? 'ทำงานอยู่' : escapeHtml(employee.status)}</span></td>
      </tr>`).join('')
    : `<tr><td colspan="6">${emptyState('ไม่พบพนักงาน', 'ลองค้นหาด้วยชื่อ รหัสพนักงาน แผนก หรือ LINE อีกครั้ง')}</td></tr>`;
}

function renderInviteCenter() {
  const list = $('#inviteList');
  if (!list) return;
  const active = state.invites.filter(invite => invite.status === 'active' && new Date(invite.expires_at).getTime() > Date.now() && Number(invite.used_count) < Number(invite.max_uses));
  const items = [...active, ...state.invites.filter(invite => !active.includes(invite))].slice(0, 8);
  list.innerHTML = items.length ? items.map(invite => {
    const remaining = Math.max(0, Number(invite.max_uses) - Number(invite.used_count));
    const usable = invite.status === 'active' && new Date(invite.expires_at).getTime() > Date.now() && remaining > 0;
    return `<div class="invite-row">
      <div class="invite-main"><span class="invite-icon">↗</span><div><strong>${escapeHtml(invite.position_name || invite.department_name || 'พนักงานใหม่')}</strong><small>${invite.department_name ? `${escapeHtml(invite.department_name)} · ` : ''}${escapeHtml(invite.location_names || 'ทุก Work Location')}</small></div></div>
      <div class="invite-usage"><strong>${Number(invite.used_count)}/${Number(invite.max_uses)}</strong><small>เข้าร่วมแล้ว</small></div>
      <span class="badge ${usable ? 'badge-success' : 'badge-neutral'}">${usable ? `เหลือ ${remaining} สิทธิ์` : invite.status === 'revoked' ? 'ยกเลิกแล้ว' : 'ปิดแล้ว'}</span>
      <div class="invite-actions">
        ${usable ? `<button class="text-btn" onclick="window.copyInviteLink(${Number(invite.id)})">คัดลอกลิงก์</button><button class="text-btn danger-text" onclick="window.revokeInvite(${Number(invite.id)})">ยกเลิก</button>` : ''}
      </div>
    </div>`;
  }).join('') : emptyState('ยังไม่มีลิงก์เชิญ', 'กด “เชิญเข้าทีม” แล้วกำหนดแผนก ตำแหน่ง และ Work Location ได้เลย');
}

window.copyInviteLink = async id => {
  const invite = state.invites.find(item => Number(item.id) === Number(id));
  if (!invite?.invite_url) return toast('ลิงก์เก่านี้ไม่มี URL ให้คัดลอก กรุณาสร้างลิงก์ใหม่', true);
  try { await navigator.clipboard.writeText(invite.invite_url); toast('คัดลอกลิงก์เชิญแล้ว'); }
  catch { window.prompt('คัดลอกลิงก์เชิญ', invite.invite_url); }
};

window.revokeInvite = async id => {
  if (!confirm('ยกเลิกลิงก์เชิญนี้ใช่ไหม? คนที่ยังไม่ได้เข้าร่วมจะใช้ลิงก์นี้ต่อไม่ได้')) return;
  try {
    await api(`/api/invites/${id}/revoke`, { method: 'POST', body: '{}' });
    await loadAll({ silent: true });
    toast('ยกเลิกลิงก์เชิญแล้ว');
  } catch (error) { toast(error.message, true); }
};

function openInviteModal() {
  const departments = state.lookups.departments || [];
  const positions = state.lookups.positions || [];
  const locations = state.lookups.locations || [];
  $('#inviteDepartment').innerHTML = `<option value="">ไม่ระบุ</option>${departments.map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}`;
  $('#invitePosition').innerHTML = `<option value="">ไม่ระบุ</option>${positions.map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}`;
  $('#inviteLocations').innerHTML = locations.length
    ? locations.map(location => `<label class="location-check"><input type="checkbox" value="${location.id}" /><span><strong>${escapeHtml(location.name)}</strong><small>${escapeHtml(location.address || `รัศมี ${location.radius_m} ม.`)}</small></span></label>`).join('')
    : `<div class="location-empty-inline"><strong>ยังไม่มี Work Location</strong><span>ไม่เป็นไร ลิงก์ยังสร้างได้ และพนักงานจะเช็กอินได้ทุกที่จนกว่าจะเพิ่ม Location</span></div>`;
  $('#inviteStartDate').value = '';
  $('#inviteMaxUses').value = '1';
  $('#inviteExpiresDays').value = '7';
  $('#inviteModal').showModal();
}

async function createInvite() {
  const button = $('#inviteCreateBtn');
  const locationIds = $$('#inviteLocations input:checked').map(input => Number(input.value));
  button.disabled = true;
  button.textContent = 'กำลังสร้าง…';
  try {
    const result = await api('/api/invites', {
      method: 'POST',
      body: JSON.stringify({
        department_id: $('#inviteDepartment').value || null,
        position_id: $('#invitePosition').value || null,
        start_date: $('#inviteStartDate').value || null,
        max_uses: Number($('#inviteMaxUses').value || 1),
        expires_days: Number($('#inviteExpiresDays').value || 7),
        location_ids: locationIds,
      }),
    });
    try { await navigator.clipboard.writeText(result.invite_url); } catch {}
    $('#inviteModal').close();
    await loadAll({ silent: true });
    showInviteCreated(result.invite_url, result.expires_at, result.max_uses);
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = 'สร้างลิงก์เชิญ';
  }
}

function showInviteCreated(url, expiresAt, maxUses) {
  const message = `ลิงก์เชิญพร้อมแล้ว\n\n${url}\n\nใช้ได้ ${maxUses} คน · หมดอายุ ${formatDateTime(expiresAt)}\n\nระบบคัดลอกลิงก์ไว้ให้แล้ว ส่งให้พนักงานได้เลย`;
  window.alert(message);
  toast('สร้างและคัดลอกลิงก์เชิญแล้ว');
}

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
  const checkedIn = state.attendance.filter(item => item.check_in_at).length;
  const late = state.attendance.filter(item => item.status === 'late').length;
  const checkedOut = state.attendance.filter(item => item.check_out_at).length;
  const outside = state.attendance.filter(item => item.check_in_at && !item.checkin_location_name && item.checkin_lat != null).length;

  $('#attendanceSummary').innerHTML = `
    <span><strong>${checkedIn}</strong> เช็กอินแล้ว</span>
    <span><strong>${late}</strong> มาสาย</span>
    <span><strong>${checkedOut}</strong> เช็กเอาต์แล้ว</span>
    <span><strong>${outside}</strong> ไม่ระบุ Work Location</span>`;

  $('#attendanceBody').innerHTML = state.attendance.length
    ? state.attendance.map(attendance => `
      <tr>
        <td data-label="พนักงาน"><div class="person"><div class="avatar">${initial(attendance)}</div><div><strong>${escapeHtml(attendance.nickname || attendance.first_name)} ${escapeHtml(attendance.last_name)}</strong><small>${escapeHtml(attendance.employee_code)}</small></div></div></td>
        <td data-label="Check-in">${attendance.check_in_at ? time(attendance.check_in_at) : '—'}</td>
        <td data-label="Location">${attendance.check_in_at
          ? attendance.checkin_location_name
            ? `<div class="attendance-location"><strong>📍 ${escapeHtml(attendance.checkin_location_name)}</strong><small>${attendance.checkin_distance_m != null ? `${Math.round(Number(attendance.checkin_distance_m))} ม. จากจุดกลาง` : ''}</small>${attendance.checkin_lat != null ? `<a href="https://www.google.com/maps?q=${Number(attendance.checkin_lat)},${Number(attendance.checkin_lng)}" target="_blank" rel="noopener">ดูแผนที่</a>` : ''}</div>`
            : attendance.checkin_lat != null ? '<span class="badge badge-warning">มีพิกัด · ไม่ได้ล็อก Location</span>' : '<span class="muted">ไม่เก็บพิกัด</span>'
          : '—'}</td>
        <td data-label="Check-out">${attendance.check_out_at ? time(attendance.check_out_at) : '—'}</td>
        <td data-label="สถานะ">${attendanceStatus(attendance)}</td>
      </tr>`).join('')
    : `<tr><td colspan="5">${emptyState('ยังไม่มีข้อมูลเวลาเข้างานวันนี้', 'พนักงานทั้งหมดจะแสดงตรงนี้ และเมื่อเช็กอินผ่าน LINE จะเห็น Location ที่ใช้ด้วย')}</td></tr>`;
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

function renderWorkLocations() {
  const list = $('#workLocationList');
  if (!list) return;
  const locations = state.workLocations || [];
  list.innerHTML = locations.length ? locations.map(location => `
    <article class="work-location-card ${Number(location.is_active) ? '' : 'inactive'}">
      <div class="work-location-pin">⌖</div>
      <div><strong>${escapeHtml(location.name)}</strong><p>${escapeHtml(location.address || `${Number(location.latitude).toFixed(5)}, ${Number(location.longitude).toFixed(5)}`)}</p><small>อนุญาตภายใน ${Number(location.radius_m)} เมตร</small></div>
      <span class="badge ${Number(location.is_active) ? 'badge-success' : 'badge-neutral'}">${Number(location.is_active) ? 'ใช้งาน' : 'ปิด'}</span>
    </article>`).join('') : emptyState('ยังไม่มี Work Location', 'เพิ่มสำนักงานใหญ่ สาขา หรือหน้างาน แล้วเลือกให้พนักงานตอนส่งลิงก์เชิญ');
}

function openWorkLocationModal() {
  $('#locationForm').reset();
  $('#locationRadius').value = '150';
  $('#locationModal').showModal();
}

async function useCurrentLocation() {
  const button = $('#useCurrentLocationBtn');
  if (!navigator.geolocation) return toast('Browser นี้ไม่รองรับ Location', true);
  button.disabled = true;
  button.textContent = 'กำลังอ่านพิกัด…';
  navigator.geolocation.getCurrentPosition(position => {
    $('#locationLat').value = position.coords.latitude.toFixed(7);
    $('#locationLng').value = position.coords.longitude.toFixed(7);
    button.disabled = false;
    button.textContent = 'ใช้ตำแหน่งปัจจุบัน';
    toast('ใส่พิกัดปัจจุบันให้แล้ว');
  }, error => {
    button.disabled = false;
    button.textContent = 'ใช้ตำแหน่งปัจจุบัน';
    toast(error.message || 'อ่าน Location ไม่สำเร็จ', true);
  }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
}

async function saveWorkLocation() {
  const name = $('#locationName').value.trim();
  const latitude = Number($('#locationLat').value);
  const longitude = Number($('#locationLng').value);
  const radius_m = Number($('#locationRadius').value || 150);
  if (name.length < 2 || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return toast('กรุณาใส่ชื่อและพิกัดให้ครบ', true);
  const button = $('#locationSaveBtn');
  button.disabled = true;
  try {
    await api('/api/work-locations', { method: 'POST', body: JSON.stringify({ name, address: $('#locationAddress').value.trim(), latitude, longitude, radius_m }) });
    $('#locationModal').close();
    await loadAll({ silent: true });
    toast('เพิ่ม Work Location แล้ว');
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
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

function renderSettings() {
  const gmail = state.gmail || { connected: false };
  const connected = Boolean(gmail.connected);
  const account = gmail.account;
  $('#gmailConnectionText').textContent = connected
    ? `${account?.email || 'Gmail'} เชื่อมกับบัญชีของคุณแล้ว`
    : 'เชื่อม Gmail ของคุณเมื่อต้องการใช้ฟีเจอร์อีเมล';
  $('#gmailConnectionBadge').className = `badge ${connected ? 'badge-success' : 'badge-neutral'}`;
  $('#gmailConnectionBadge').textContent = connected ? 'เชื่อมแล้ว' : 'ยังไม่เชื่อม';
  $('#gmailConnectBtn').classList.toggle('hidden', connected);
  $('#gmailDisconnectBtn').classList.toggle('hidden', !connected);
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
