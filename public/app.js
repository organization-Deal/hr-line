const state = {
  me: null,
  onboardingConfig: null,
  onboardingStatus: null,
  recruitmentGmail: null,
  benefits: { data: [], enrollments: [] },
  loadErrors: [],
  companyProfile: null,
  googleWorkspace: null,
  lineIntegration: null,
  dashboard: null,
  employees: [],
  candidates: [],
  attendance: [],
  leaves: [],
  requests: [],
  employeeService: null,
  hrCases: [],
  broadcasts: [],
  payroll: null,
  payrollDetail: null,
  documents: { data: [], payslips: [] },
  learning: { courses: [], assignments: [], summary: {} },
  performance: { cycles: [], goals: [], one_on_ones: [], probation_reviews: [], probation_due: [], summary: {} },
  engagement: { rules: [], rewards: [], redemptions: [], leaderboard: [], recent_transactions: [], summary: {} },
  analytics: { summary: {}, headcount_trend: [], departments: [], recruitment: {}, moments: [] },
  subscription: null,
  saasAdmin: null,
  activePayrollPeriodId: null,
  activeHrCaseId: null,
  invites: [],
  lookups: { departments: [], positions: [], locations: [] },
  workLocations: [],
  leavePolicies: [],
  approverAccess: [],
  approverPermissionCatalog: [],
  peopleCore: { departments: [], positions: [], schedules: [], holidays: [], attendance_policy: {} },
  activeApproverEmployeeId: null,
  activeLeaveProfileEmployeeId: null,
  currentView: 'dashboard',
  activeSettingsCategory: null,
  settingsNavExpanded: false,
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

let bootWatchdog = null;
let onboardingRefreshInFlight = false;
function isLineInAppBrowser(){const ua=String(navigator.userAgent||'');return /(?:^|[;\s])Line\/[0-9]|LIFF/i.test(ua);}
function setBootStatus(message,showRetry=false){const text=$('#bootStatusText');if(text)text.textContent=message;$('#bootRetryBtn')?.classList.toggle('hidden',!showRetry);}
function startBootWatchdog(){clearTimeout(bootWatchdog);setBootStatus('กำลังเปิดระบบ HR…',false);bootWatchdog=setTimeout(()=>{if(!$('#bootSplash')?.classList.contains('hidden'))setBootStatus('เครือข่ายตอบช้ากว่าปกติ',true);},7000);}
function stopBootWatchdog(){clearTimeout(bootWatchdog);bootWatchdog=null;}

const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000;
let deferredLoadTimer = null;
let deferredLoadInFlight = false;

function dashboardCacheKey() {
  const companyId = Number(state.me?.active_company_id || activeCompany()?.id || 0);
  return companyId ? `nakna.dashboard.${companyId}` : null;
}
function readDashboardCache() {
  const key = dashboardCacheKey();
  if (!key) return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached?.dashboard || Date.now() - Number(cached.saved_at || 0) > DASHBOARD_CACHE_TTL_MS) return null;
    return cached;
  } catch { return null; }
}
function writeDashboardCache() {
  const key = dashboardCacheKey();
  if (!key || !state.dashboard) return;
  try {
    sessionStorage.setItem(key, JSON.stringify({
      saved_at: Date.now(),
      dashboard: state.dashboard,
      companyProfile: state.companyProfile || null,
    }));
  } catch {}
}
function hydrateDashboardCache() {
  const cached = readDashboardCache();
  if (!cached) return false;
  state.dashboard = cached.dashboard;
  if (cached.companyProfile) state.companyProfile = cached.companyProfile;
  try {
    renderDashboard();
    renderIdentity();
    $('#todayText').textContent = formatDate(state.dashboard.today);
    $('#sidebarCompany').textContent = state.dashboard.client?.name || activeCompany()?.name || 'บริษัทของคุณ';
  } catch {}
  return true;
}
async function loadDashboardFast({ silent = true } = {}) {
  const started = performance.now();
  try {
    const [dashboard, companyProfile] = await Promise.all([
      api('/api/dashboard', { timeoutMs: 12000 }),
      api('/api/company-profile', { timeoutMs: 12000 }).catch(() => null),
    ]);
    state.dashboard = dashboard || emptyDashboard();
    if (companyProfile) state.companyProfile = companyProfile.company || companyProfile;
    renderDashboard();
    renderIdentity();
    $('#todayText').textContent = formatDate(state.dashboard.today);
    $('#sidebarCompany').textContent = state.dashboard.client?.name || activeCompany()?.name || 'บริษัทของคุณ';
    writeDashboardCache();
    if (!silent) toast('อัปเดตภาพรวมแล้ว');
    return true;
  } catch (error) {
    if (!state.dashboard) state.dashboard = emptyDashboard();
    try { renderDashboard(); } catch {}
    renderLoadProblem([{ label: 'ภาพรวม', message: error.message }]);
    return false;
  } finally {
    const elapsed = Math.round(performance.now() - started);
    console.info(`[Nakna] fast dashboard ${elapsed}ms`);
  }
}
function scheduleDeferredLoad(delay = 250) {
  clearTimeout(deferredLoadTimer);
  deferredLoadTimer = setTimeout(async () => {
    if (deferredLoadInFlight) return;
    deferredLoadInFlight = true;
    try { await loadAll({ silent: true, background: true }); }
    finally { deferredLoadInFlight = false; }
  }, delay);
}
function warmWorkspaceInBackground() {
  // Migrations are the source of truth in production. Runtime bootstrap is only
  // a safety net and must never block first paint on mobile.
  setTimeout(() => api('/api/bootstrap', { timeoutMs: 30000 }).catch(error => {
    console.warn('[Nakna] background bootstrap failed', error?.message || error);
  }), 1200);
}

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
  benefits: ['สวัสดิการ', 'BENEFITS'],
  attendance: ['เวลาเข้างาน', 'WORKDAY'],
  leave: ['การลา', 'LEAVE'],
  requests: ['Employee Service', 'EMPLOYEE SERVICE'],
  payroll: ['Payroll', 'PAYROLL'],
  documents: ['เอกสาร', 'DOCUMENTS'],
  performance: ['Learning & KPI', 'GROWTH OS'],
  engagement: ['แต้ม & ของรางวัล', 'ENGAGEMENT'],
  analytics: ['People Analytics', 'PEOPLE INTELLIGENCE'],
  'saas-admin': ['Nakna Admin', 'SAAS CONTROL'],
  settings: ['ตั้งค่า', 'SYSTEM'],
};

const settingsCategoryMeta = {
  company: { title: 'ตั้งค่าบริษัท', kicker: 'COMPANY', description: 'ข้อมูลบริษัท แผนก ตำแหน่ง และโครงสร้างองค์กร' },
  worktime: { title: 'ตั้งค่าเวลาทำงาน', kicker: 'WORK SCHEDULE', description: 'ตั้งเวลาระดับบริษัท รายแผนก หรือรายคน พร้อม Grace period' },
  attendance: { title: 'ตั้งค่าการเช็กอิน', kicker: 'ATTENDANCE', description: 'กำหนดสถานที่ พิกัด รัศมี และกติกาเช็กเอาต์นอกพื้นที่' },
  leave: { title: 'การลา & วันหยุด', kicker: 'LEAVE & HOLIDAY', description: 'ตั้งประเภทลา สิทธิ์ช่วงทดลองงาน และปฏิทินวันหยุดบริษัท' },
  approvals: { title: 'สิทธิ์ & การอนุมัติ', kicker: 'APPROVAL FLOW', description: 'กำหนดหัวหน้า ผู้อนุมัติ และสิทธิ์ที่ใช้ในแต่ละ Workflow' },
  integrations: { title: 'การเชื่อมต่อ', kicker: 'INTEGRATIONS', description: 'เชื่อม LINE, Gmail, Google Drive และ Google Sheets' },
  payroll: { title: 'ตั้งค่า Payroll', kicker: 'PAYROLL', description: 'กำหนดวันจ่าย ภาษี ประกันสังคม และกติกาการหัก' },
  billing: { title: 'แพ็กเกจ & Billing', kicker: 'SUBSCRIPTION', description: 'ดู Free Trial, Active Seats, แพ็กเกจ และ Invoice' },
};

async function api(path, options = {}) {
  const controller = new AbortController();
  const { timeoutMs: requestedTimeout, ...fetchOptions } = options;
  const timeoutMs = Number(requestedTimeout || 18000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(path, {
      ...fetchOptions,
      signal: controller.signal,
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
        ...(fetchOptions.headers || {}),
      },
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`API_TIMEOUT:${path}`);
    throw error;
  } finally {
    clearTimeout(timer);
  }

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
  if (!res.ok) {
    const detail = data.detail ? ` · ${data.detail}` : '';
    throw new Error(`${data.error || `HTTP_${res.status}`}${detail}`);
  }
  return data;
}

async function boot() {
  closeAllDialogs();
  document.body?.classList.add('nakna-ready');
  showBootSplash();
  startBootWatchdog();
  bindEvents();
  renderLoadingState();
  loadPublicOnboarding();
  const returnState = handleReturnMessage();
  try {
    const ready = await loadSessionOnly({ forceNewBusiness: returnState.forceNewBusiness });
    if (!ready) return;
    const onboardingReady = await maybeRunOnboarding({ forceNewBusiness: returnState.forceNewBusiness });
    if (!onboardingReady) return;
    showAppShell();
    const hadCache = hydrateDashboardCache();
    await loadDashboardFast({ silent: true });
    scheduleDeferredLoad(hadCache ? 450 : 180);
  } catch (error) {
    showAppShell();
    if (!['AUTH_REQUIRED','COMPANY_REQUIRED'].includes(error.message)) {
      renderLoadProblem([{ label: 'เริ่มระบบ', message: error.message }]);
    }
  }
}

function bindEvents() {
  $('#lineBusinessBtn').onclick = openLineBusinessOnboarding;
  $('#bootRetryBtn').onclick = () => window.location.reload();
  $('#googleLoginBtn').onclick = () => { window.location.href = '/auth/google/start'; };
  $('#retryDataLoadBtn').onclick = async () => {
    if (await ensureWorkspaceReady()) await loadAll();
  };
  $('#logoutBtn').onclick = logout;
  $('#onboardingLogoutBtn').onclick = logout;
  $('#createCompanyBtn').onclick = createCompany;
  $('#onboardingGoogleBtn').onclick = connectGoogleWorkspace;
  $('#onboardingGoogleNextBtn').onclick = async () => {
    state.onboardingStatus = await api('/api/onboarding/status');
    setOnboardingStep('recruitment_gmail');
    renderOnboardingStatus();
  };
  $('#onboardingRecruitmentSaveBtn').onclick = () => saveRecruitmentOnboarding(false);
  $('#onboardingRecruitmentSyncBtn').onclick = () => saveRecruitmentOnboarding(true);
  $('#onboardingCompleteBtn').onclick = completeOnboarding;
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

  // Close dialog buttons in capture phase so required-field validation can never trap Cancel/X.
  document.addEventListener('click', event => {
    const cancel = event.target.closest('dialog button[value="cancel"], dialog .close-btn, dialog [data-dialog-close]');
    if (!cancel) return;
    const dialog = cancel.closest('dialog');
    if (!dialog) return;
    event.preventDefault();
    event.stopPropagation();
    if (dialog.open) dialog.close('cancel');
  }, true);
  $('#companyProfileShortcut').onclick = openCompanyProfileModal;
  $('#statusCompanyAction').onclick = openCompanyProfileModal;
  $('#companyProfileSaveBtn').onclick = saveCompanyProfile;
  $('#googleWorkspaceShortcut').onclick = () => document.querySelector('#googleWorkspaceSection')?.scrollIntoView({behavior:'smooth',block:'start'});
  $('#googleWorkspaceConnectBtn').onclick = connectGoogleWorkspace;
  $('#googleWorkspaceSyncBtn').onclick = syncGoogleWorkspace;
  $('#googleWorkspaceDisconnectBtn').onclick = disconnectGoogleWorkspace;
  $('#statusGoogleAction').onclick = connectGoogleWorkspace;
  $('#lineIntegrationShortcut').onclick = openLineIntegrationModal;
  $('#statusLineAction').onclick = openLineIntegrationModal;
  $('#lineConfigureBtn').onclick = openLineIntegrationModal;
  $('#lineTestBtn').onclick = testLineIntegration;
  $('#lineDisconnectBtn').onclick = disconnectLineIntegration;
  $('#lineIntegrationSaveBtn').onclick = saveLineIntegration;
  $('#approverAccessShortcut').onclick = () => document.querySelector('#approverAccessSection')?.scrollIntoView({behavior:'smooth',block:'start'});
  $('#addApproverAccessBtn').onclick = () => openApproverAccessModal();
  $('#approverAccessSaveBtn').onclick = saveApproverAccess;
  $('#approverRolePreset').onchange = applyApproverRolePreset;
  $('#copyLineWebhookModalBtn').onclick = copyLineWebhookFromModal;
  $('#refreshBtn').onclick = () => loadAll();
  $('#createBroadcastBtn').onclick = openBroadcastModal;
  $('#broadcastAudience').onchange = renderBroadcastAudienceFields;
  $('#broadcastSendBtn').onclick = sendBroadcast;
  $('#setupRichMenuBtn').onclick = setupRichMenu;
  $('#removeRichMenuBtn').onclick = removeRichMenu;
  $('#hrCaseSaveBtn').onclick = saveHrCase;
  $('#probationLeaveLockToggle').onchange = saveProbationLeaveLock;
  $('#payrollSettingsBtn').onclick = openPayrollSettingsModal;
  $('#payrollSettingsSaveBtn').onclick = savePayrollSettings;
  $('#createPayrollPeriodBtn').onclick = openPayrollPeriodModal;
  $('#payrollPeriodCreateBtn').onclick = createPayrollPeriod;
  $('#payrollProfileSaveBtn').onclick = savePayrollProfile;
  $('#payrollAdjustmentSaveBtn').onclick = savePayrollAdjustment;
  $('#generateDocumentBtn').onclick = openDocumentGenerateModal;
  $('#createCourseBtn').onclick = openCourseModal;
  $('#createKpiBtn').onclick = openKpiModal;
  $('#createOneOnOneBtn').onclick = openOneOnOneModal;
  $('#createProbationReviewBtn').onclick = openProbationReviewModal;
  $('#createPerformanceCycleBtn').onclick = openPerformanceCycleModal;
  $('#courseSaveBtn').onclick = saveCourse;
  $('#moduleSaveBtn').onclick = saveLearningModule;
  $('#quizQuestionSaveBtn').onclick = saveQuizQuestion;
  $('#courseAssignSaveBtn').onclick = assignCourse;
  $('#kpiSaveBtn').onclick = saveKpi;
  $('#kpiUpdateSaveBtn').onclick = saveKpiUpdate;
  $('#cycleSaveBtn').onclick = savePerformanceCycle;
  $('#oneSaveBtn').onclick = saveOneOnOne;
  $('#reviewSaveBtn').onclick = saveProbationReview;
  $('#moduleType').onchange = renderModuleFields;
  $('#assignAudience').onchange = renderCourseAssignFields;
  $('#documentGenerateSaveBtn').onclick = generateEmployeeDocument;
  $('#runPointRulesBtn').onclick = runPointRules;
  $('#manualAwardBtn').onclick = openManualAward;
  $('#createPointRuleBtn').onclick = openPointRule;
  $('#createRewardBtn').onclick = openReward;
  $('#subscriptionPlanBtn').onclick = openSubscriptionPlan;
  $('#generateInvoiceBtn').onclick = generateSubscriptionInvoice;

  $$('.nav-item').forEach(button => {
    button.onclick = () => {
      if (button.dataset.view === 'settings') {
        toggleSettingsNav();
        return;
      }
      showView(button.dataset.view);
    };
  });
  $$('[data-jump]').forEach(button => {
    button.onclick = () => showView(button.dataset.jump);
  });

  $$('[data-settings-open]').forEach(button => {
    button.onclick = () => openSettingsCategory(button.dataset.settingsOpen);
  });
  $$('[data-settings-sidebar-open]').forEach(button => {
    button.onclick = () => {
      const target = button.dataset.settingsSidebarOpen;
      if (!settingsCategoryMeta[target]) return;
      state.settingsNavExpanded = true;
      state.activeSettingsCategory = target;
      showView('settings');
      openSettingsCategory(target, { scroll: false });
    };
  });
  $$('[data-settings-sidebar-jump]').forEach(button => {
    button.onclick = () => {
      state.settingsNavExpanded = true;
      state.activeSettingsCategory = 'company';
      showView('settings');
      openSettingsCategory('company', { scroll: false });
      $$('.nav-subitem').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      requestAnimationFrame(() => $('#organizationSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    };
  });
  $('#settingsBackBtn').onclick = () => showSettingsHome();
  $('#settingsPayrollOpenBtn').onclick = openPayrollSettingsModal;

  $('#addEmployeeBtn').onclick = openEmployeeModal;
  $('#inviteEmployeeBtn').onclick = openInviteModal;
  $('#inviteEmployeeBtnInline').onclick = openInviteModal;
  $('#addWorkLocationBtn').onclick = openWorkLocationModal;
  $('#addDepartmentBtn').onclick = openDepartmentModal;
  $('#addPositionBtn').onclick = openPositionModal;
  if ($('#addPositionInlineBtn')) $('#addPositionInlineBtn').onclick = openPositionModal;
  $('#addScheduleBtn').onclick = openScheduleModal;
  $('#addHolidayBtn').onclick = openHolidayModal;
  $('#departmentSaveBtn').onclick = saveDepartment;
  $('#positionSaveBtn').onclick = savePosition;
  if ($('#positionCreateDepartmentBtn')) $('#positionCreateDepartmentBtn').onclick = () => { $('#positionModal')?.close(); state.resumePositionAfterDepartment = true; openDepartmentModal(); };
  $('#scheduleSaveBtn').onclick = saveSchedule;
  $('#scheduleScopeType').onchange = refreshScheduleTarget;
  $('#holidaySaveBtn').onclick = saveHoliday;
  $('#attendancePolicyToggle').onchange = saveAttendancePolicy;
  $('#peopleProfileSaveBtn').onclick = savePeopleProfile;
  $('#addLeaveBtn').onclick = openLeaveRequestModal;
  $('#addLeavePolicyBtn').onclick = () => openLeavePolicyModal();
  $('#leaveProfileSaveBtn').onclick = saveLeaveProfile;
  $('#leaveRequestSaveBtn').onclick = saveLeaveRequest;
  $('#leavePolicySaveBtn').onclick = saveLeavePolicy;
  $('#leaveProfileYear').onchange = () => state.activeLeaveProfileEmployeeId && openLeaveProfile(state.activeLeaveProfileEmployeeId, true);
  $('#inviteCreateBtn').onclick = createInvite;
  $('#locationSaveBtn').onclick = saveWorkLocation;
  $('#useCurrentLocationBtn').onclick = useCurrentLocation;
  $('#addCandidateBtn').onclick = openCandidateModal;
  $('#recruitmentGmailConnectBtn').onclick = connectGoogleWorkspace;
  $('#recruitmentGmailSyncBtn').onclick = syncRecruitmentGmailNow;
  $('#recruitmentGmailSettingsBtn').onclick = openRecruitmentGmailSettings;
  $('#addBenefitBtn').onclick = openBenefitCreate;
  $('#employeeSearch').addEventListener('input', event => renderEmployees(event.target.value));

  $('#mobileMenuBtn').onclick = () => document.body.classList.toggle('mobile-nav-open');
  $('#mobileNavBackdrop').onclick = closeMobileNav;

  $$('.future-view .secondary-btn').forEach(button => {
    button.onclick = () => toast('โมดูลนี้อยู่ใน Roadmap หลัง Phase 5', false, 'i');
  });
}

async function loadSessionOnly({ forceNewBusiness = false } = {}) {
  try {
    const data = await api('/api/me', { timeoutMs: 12000 });
    state.me = data;
    hideLogin();
    renderIdentity();

    if (forceNewBusiness || data.setup_mode === 'new') {
      showOnboarding({ step: 'company', forceNewBusiness: true });
      return false;
    }
    if (!(data.companies || []).length) {
      showOnboarding({ step: 'company' });
      return false;
    }
    return true;
  } catch (error) {
    if (error.message === 'AUTH_REQUIRED') {
      state.me = null;
      showLogin();
      return false;
    }
    showLogin();
    showLoginError(error.message.startsWith('API_TIMEOUT') ? 'ระบบเข้าสู่ระบบตอบช้าเกินไป กรุณาลองใหม่อีกครั้ง' : error.message);
    return false;
  }
}

function showBootSplash() {
  $('#bootSplash')?.classList.remove('hidden');
  $('#login')?.classList.add('hidden');
  $('#onboarding')?.classList.add('hidden');
  $('#appShell')?.classList.add('hidden');
}
function hideBootSplash() { stopBootWatchdog(); $('#bootSplash')?.classList.add('hidden'); }
function showLogin() {
  hideBootSplash();
  $('#login').classList.remove('hidden');
  $('#onboarding').classList.add('hidden');
  $('#appShell')?.classList.add('hidden');
}
function hideLogin() { $('#login').classList.add('hidden'); }
function showAppShell() {
  hideBootSplash();
  $('#login')?.classList.add('hidden');
  $('#onboarding')?.classList.add('hidden');
  $('#appShell')?.classList.remove('hidden');
}
function closeAllDialogs() {
  document.querySelectorAll('dialog[open]').forEach(dialog => {
    try { dialog.close('reset'); } catch { dialog.removeAttribute('open'); }
  });
}
window.addEventListener('pageshow',event=>{if(event.persisted)closeAllDialogs();refreshOnboardingAfterExternalOAuth();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshOnboardingAfterExternalOAuth();});
function showLoginError(message) { $('#loginError').textContent = message === 'AUTH_REQUIRED' ? '' : message; }
function closeMobileNav() { document.body.classList.remove('mobile-nav-open'); }

function showOnboarding({ step = 'company', forceNewBusiness = false } = {}) {
  hideBootSplash();
  hideLogin();
  $('#appShell')?.classList.add('hidden');
  const me = state.me || {};
  $('#onboarding').classList.remove('hidden');
  const name = me.user?.name || me.user?.email || '';
  const topLabel = document.querySelector('.onboarding-brand .brand-wordmark span');
  if (topLabel) topLabel.textContent = name ? `Business Setup · ${name}` : 'Business Setup Center';
  const claimable = forceNewBusiness ? null : me.claimable_company;
  $('#claimCompanyBtn').classList.toggle('hidden', !claimable);
  if (claimable) $('#claimCompanyName').textContent = `${claimable.name} · Workspace เดิมในระบบ`;
  $('#onboardingError').textContent = '';
  setOnboardingStep(step);
}
function hideOnboarding() { $('#onboarding').classList.add('hidden'); }

function setOnboardingStep(step = 'company') {
  const normalized = ['company','google_workspace','recruitment_gmail','complete'].includes(step) ? step : 'company';
  document.querySelectorAll('[data-setup-panel]').forEach(panel => panel.classList.toggle('hidden', panel.dataset.setupPanel !== normalized));
  const order = ['company','google_workspace','recruitment_gmail','complete'];
  const current = order.indexOf(normalized);
  document.querySelectorAll('[data-setup-indicator]').forEach(indicator => {
    const index = order.indexOf(indicator.dataset.setupIndicator);
    indicator.classList.toggle('active', index === current);
    indicator.classList.toggle('done', index < current);
  });
  const card = $('#onboarding');
  if (card) card.dataset.step = normalized;
}

async function maybeRunOnboarding({ forceNewBusiness = false } = {}) {
  if (forceNewBusiness) {
    showOnboarding({ step: 'company', forceNewBusiness: true });
    return false;
  }
  try {
    state.onboardingStatus = await api('/api/onboarding/status', { timeoutMs: 15000 });
  } catch (error) {
    renderLoadProblem([{ label: 'Business Setup', message: error.message }]);
    return true; // never trap an existing customer behind a broken wizard
  }
  if (state.onboardingStatus?.completed) {
    hideOnboarding();
    return true;
  }
  showOnboarding({ step: state.onboardingStatus?.current_step || 'company' });
  renderOnboardingStatus();
  return false;
}

function renderOnboardingStatus() {
  const status = state.onboardingStatus || {};
  const google = status.google || {};
  const recruitment = status.recruitment_gmail || {};
  if (status.company) {
    $('#companyNameInput').value = status.company.name || '';
    $('#onboardEmployeeEstimate').value = String(status.company.employee_estimate || 10);
    $('#onboardTaxId').value = status.company.tax_id || '';
    $('#onboardWorkStart').value = status.company.work_start || '09:00';
    $('#onboardWorkEnd').value = status.company.work_end || '18:00';
    $('#onboardCompanyPhone').value = status.company.phone || '';
    $('#onboardProvince').value = status.company.province || '';
    $('#onboardAddress').value = status.company.address || '';
  }
  $('#onboardingRecruitmentEnabled').checked = recruitment.enabled !== false;
  $('#onboardingRecruitmentQuery').value = recruitment.query || 'newer_than:30d {สมัคร resume CV "job application"}';

  const gState = $('#onboardingGoogleState');
  if (google.connected) {
    gState.classList.add('connected');
    gState.innerHTML = `<span class="state-dot"></span><div><strong>เชื่อม Google แล้ว</strong><p>${escapeHtml(google.email || 'Google Account')} · Drive + Sheets พร้อมใช้งาน</p></div>`;
    $('#onboardingGoogleBtn').classList.add('hidden');
    $('#googleMobileHandoff')?.classList.add('hidden');
    $('#onboardingGoogleNextBtn').classList.remove('hidden');
  } else {
    gState.classList.remove('connected');
    gState.innerHTML = `<span class="state-dot"></span><div><strong>ยังไม่ได้เชื่อม Google</strong><p>กดเชื่อมเพื่ออนุญาต Gmail, Drive และ Sheets</p></div>`;
    $('#onboardingGoogleBtn').classList.remove('hidden');
    if(!isLineInAppBrowser())$('#googleMobileHandoff')?.classList.add('hidden');
    $('#onboardingGoogleNextBtn').classList.add('hidden');
  }

  const rState = $('#onboardingRecruitmentState');
  if (recruitment.last_error) {
    rState.classList.remove('connected');
    rState.innerHTML = `<span class="state-dot"></span><div><strong>Sync ล่าสุดมีปัญหา</strong><p>${escapeHtml(recruitment.last_error)}</p></div>`;
  } else if (recruitment.last_sync_at) {
    rState.classList.add('connected');
    rState.innerHTML = `<span class="state-dot"></span><div><strong>Gmail ผู้สมัครพร้อมใช้งาน</strong><p>Sync ล่าสุด ${formatDateTime(recruitment.last_sync_at)}</p></div>`;
  } else {
    rState.classList.remove('connected');
    rState.innerHTML = `<span class="state-dot"></span><div><strong>พร้อมตั้งค่า Gmail ผู้สมัคร</strong><p>บันทึก Query แล้วลอง Sync รอบแรกได้เลย</p></div>`;
  }

  if (status.trial) {
    $('#onboardingTrialText').textContent = `${status.trial.days_remaining ?? 30} วัน`;
  }
  $('#onboardingGoogleReadyText').textContent = google.connected ? 'Connected' : 'Not connected';
  setOnboardingStep(status.current_step || (status.requires_company ? 'company' : 'google_workspace'));
}

async function createCompany() {
  const name = $('#companyNameInput').value.trim();
  if (name.length < 2) return onboardingError('กรุณาใส่ชื่อบริษัท');
  const button = $('#createCompanyBtn');
  button.disabled = true;
  button.textContent = 'กำลังสร้างธุรกิจ…';
  try {
    const result = await api('/api/companies', {
      method: 'POST',
      body: JSON.stringify({
        name,
        employee_estimate: Number($('#onboardEmployeeEstimate').value || 10),
        tax_id: $('#onboardTaxId').value.trim(),
        work_start: $('#onboardWorkStart').value || '09:00',
        work_end: $('#onboardWorkEnd').value || '18:00',
        phone: $('#onboardCompanyPhone').value.trim(),
        province: $('#onboardProvince').value.trim(),
        address: $('#onboardAddress').value.trim(),
        onboarding_source: 'line_web'
      })
    });
    await loadSessionOnly();
    state.onboardingStatus = result.onboarding || await api('/api/onboarding/status');
    showOnboarding({ step: 'google_workspace' });
    renderOnboardingStatus();
    toast('สร้างธุรกิจแล้ว · ต่อไปเชื่อม Google');
  } catch (error) {
    if (!['AUTH_REQUIRED','COMPANY_REQUIRED'].includes(error.message)) onboardingError(error.message);
  } finally {
    button.disabled = false;
    button.textContent = 'สร้างธุรกิจและไปขั้นต่อไป';
  }
}

function onboardingError(message='') {
  $('#onboardingError').textContent = message;
  if (message) toast(message, true);
}

async function saveRecruitmentOnboarding(syncNow = false) {
  const button = syncNow ? $('#onboardingRecruitmentSyncBtn') : $('#onboardingRecruitmentSaveBtn');
  const original = button.textContent;
  button.disabled = true;
  button.textContent = syncNow ? 'กำลัง Sync Gmail…' : 'กำลังบันทึก…';
  try {
    await api('/api/onboarding/recruitment-gmail', {
      method: 'POST',
      body: JSON.stringify({
        enabled: $('#onboardingRecruitmentEnabled').checked,
        auto_sync: $('#onboardingRecruitmentEnabled').checked,
        query: $('#onboardingRecruitmentQuery').value.trim()
      })
    });
    if (syncNow && $('#onboardingRecruitmentEnabled').checked) {
      const result = await api('/api/recruitment/gmail/sync', { method: 'POST', body: '{}' , timeoutMs: 45000});
      toast(`Sync Gmail แล้ว · เพิ่ม ${result.imported || 0} ผู้สมัคร · เชื่อมของเดิม ${result.linked || 0}`);
    } else {
      toast('บันทึก Gmail ผู้สมัครแล้ว');
    }
    state.onboardingStatus = await api('/api/onboarding/status');
    state.onboardingStatus.current_step = 'complete';
    setOnboardingStep('complete');
    renderOnboardingStatus();
  } catch (error) {
    onboardingError(error.message);
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

async function completeOnboarding() {
  const button = $('#onboardingCompleteBtn');
  button.disabled = true;
  button.textContent = 'กำลังเปิด Dashboard…';
  try {
    const result = await api('/api/onboarding/complete', { method: 'POST', body: '{}' });
    state.onboardingStatus = result.onboarding;
    hideOnboarding();
    showAppShell();
    if (await ensureWorkspaceReady()) await loadAll({ silent: true });
    toast('Workspace พร้อมใช้งาน · Free Trial เริ่มแล้ว');
  } catch (error) {
    onboardingError(error.message);
  } finally {
    button.disabled = false;
    button.textContent = 'เริ่มใช้งาน Dashboard';
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
    if (ready) {
      state.onboardingStatus = await api('/api/onboarding/status');
      if (state.onboardingStatus?.completed) {
        hideOnboarding();
        showAppShell();
        if (await ensureWorkspaceReady()) await loadAll({ silent: true });
      } else {
        showOnboarding({ step: state.onboardingStatus?.current_step || 'google_workspace' });
        renderOnboardingStatus();
      }
    }
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
  state.googleWorkspace = null;
  state.companyProfile = null;
  state.lineIntegration = null;
  window.location.href = '/';
}

async function switchCompany(clientId) {
  if (Number(clientId) === Number(state.me?.active_company_id)) return;
  try {
    await api('/api/session/company', { method: 'POST', body: JSON.stringify({ client_id: Number(clientId) }) });
    const ready = await loadSessionOnly();
    if (ready) {
      const onboardingReady = await maybeRunOnboarding();
      if (onboardingReady) {
        showAppShell();
        if (await ensureWorkspaceReady()) await loadAll({ silent: true });
      }
    }
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

function activeCompanyRole() {
  const me = state.me || {};
  return (me.companies || []).find(company => Number(company.id) === Number(me.active_company_id))?.role || null;
}

function canHrOverrideLeave() {
  return ['owner','hr_admin','hr'].includes(String(activeCompanyRole() || ''));
}

function activeCompany() {
  const me = state.me || {};
  return (me.companies || []).find(company => Number(company.id) === Number(me.active_company_id)) || null;
}

function companyProfileCompleted(profile) {
  return Boolean(profile && String(profile.name || '').trim() && String(profile.work_start || '').trim() && String(profile.work_end || '').trim());
}

function canManageCompanyProfile() { return ['owner','hr_admin','hr'].includes(String(activeCompanyRole() || '')); }
function canManageGoogleWorkspace() { return ['owner','hr_admin'].includes(String(activeCompanyRole() || '')); }

function openCompanyProfileModal() {
  const profile = state.companyProfile || state.dashboard?.client || activeCompany() || {};
  $('#companyProfileName').value = profile.name || '';
  $('#companyProfileWorkStart').value = profile.work_start || '09:00';
  $('#companyProfileWorkEnd').value = profile.work_end || '18:00';
  $('#companyProfileLateGrace').value = profile.late_grace_minutes ?? 10;
  $('#companyProfileTimezone').value = profile.timezone || 'Asia/Bangkok';
  $('#companyProfileModal').showModal();
}

async function saveCompanyProfile() {
  const body={name:$('#companyProfileName').value.trim(),work_start:$('#companyProfileWorkStart').value,work_end:$('#companyProfileWorkEnd').value,late_grace_minutes:Number($('#companyProfileLateGrace').value||0),timezone:$('#companyProfileTimezone').value.trim()||'Asia/Bangkok'};
  if(body.name.length<2)return toast('กรุณาใส่ชื่อบริษัท',true);
  const button=$('#companyProfileSaveBtn');button.disabled=true;button.textContent='กำลังบันทึก…';
  try{const result=await api('/api/company-profile',{method:'PATCH',body:JSON.stringify(body)});state.companyProfile=result.company;const active=activeCompany();if(active)active.name=result.company.name;$('#companyProfileModal').close();renderIdentity();renderSettings();toast('บันทึกข้อมูลบริษัทแล้ว');}
  catch(error){toast(error.message,true);}finally{button.disabled=false;button.textContent='บันทึกข้อมูลบริษัท';}
}

async function connectGoogleWorkspace(){
  if(!canManageGoogleWorkspace())return toast('เฉพาะ Owner หรือ HR Admin ที่เชื่อม Google ได้',true);
  if(!isLineInAppBrowser()){window.location.href='/integrations/google-workspace/start';return;}
  const button=$('#onboardingGoogleBtn');const handoff=$('#googleMobileHandoff');const externalBtn=$('#googleExternalBrowserBtn');
  if(button){button.disabled=true;button.textContent='กำลังเปิด Safari / Chrome…';}
  try{
    const result=await api('/api/integrations/google-workspace/mobile-handoff',{method:'POST',body:'{}',timeoutMs:12000});
    if(!result?.url)throw new Error('สร้างลิงก์เชื่อม Google ไม่สำเร็จ');
    if(externalBtn)externalBtn.href=result.url;handoff?.classList.remove('hidden');
    window.location.href=result.url;
  }catch(error){toast(error.message||'เปิด Google ไม่สำเร็จ กรุณาลองใหม่',true);handoff?.classList.add('hidden');}
  finally{if(button){button.disabled=false;button.textContent='เชื่อม Google';}}
}
async function refreshOnboardingAfterExternalOAuth(){
  if(document.hidden||onboardingRefreshInFlight||$('#onboarding')?.classList.contains('hidden'))return;onboardingRefreshInFlight=true;
  try{state.onboardingStatus=await api('/api/onboarding/status',{timeoutMs:12000});renderOnboardingStatus();if(state.onboardingStatus?.google?.connected&&$('#onboarding')?.dataset.step==='google_workspace'){setOnboardingStep('recruitment_gmail');toast('เชื่อม Google เรียบร้อยแล้ว');}}catch{}finally{onboardingRefreshInFlight=false;}
}

async function disconnectGoogleWorkspace() {
  if(!state.googleWorkspace?.connected)return;
  if(!confirm('ยกเลิกการเชื่อม Google? ไฟล์และ Sheet ที่สร้างไว้ใน Google Drive จะไม่ถูกลบ'))return;
  const button=$('#googleWorkspaceDisconnectBtn');button.disabled=true;
  try{await api('/api/integrations/google-workspace',{method:'DELETE'});state.googleWorkspace={connected:false,integration:null};renderSettings();toast('ยกเลิกการเชื่อม Google แล้ว');}
  catch(error){toast(error.message,true);}finally{button.disabled=false;}
}

async function syncGoogleWorkspace() {
  const button=$('#googleWorkspaceSyncBtn');button.disabled=true;button.textContent='กำลัง Sync…';
  try{await api('/api/integrations/google-workspace/sync',{method:'POST',body:'{}'});state.googleWorkspace=await api('/api/integrations/google-workspace');renderSettings();toast('Sync ข้อมูลเข้า Google Sheet แล้ว');}
  catch(error){toast(error.message,true);}finally{button.disabled=false;button.textContent='Sync ตอนนี้';}
}

function googleWorkspaceErrorText(code){return ({permission:'บัญชีนี้ไม่มีสิทธิ์เชื่อม Google',state:'เซสชัน Google หมดอายุ กรุณาเชื่อมใหม่',expired:'คำขอเชื่อมต่อหมดอายุ กรุณาเชื่อมใหม่',refresh_token:'Google ไม่ได้ส่ง Refresh Token กรุณาเชื่อมใหม่',drive_api:'เชื่อม Drive ไม่สำเร็จ กรุณาเปิด Google Drive API',sheets_api:'เชื่อม Sheets ไม่สำเร็จ กรุณาเปิด Google Sheets API',gmail_api:'เชื่อม Gmail ไม่สำเร็จ กรุณาเปิด Gmail API',connection_failed:'เชื่อม Google ไม่สำเร็จ กรุณาลองใหม่'})[code]||'เชื่อม Google ไม่สำเร็จ';}

function handleReturnMessage() {
  const url = new URL(window.location.href);
  const forceNewBusiness = url.searchParams.get('setup') === 'new';
  const googleConnected = url.searchParams.get('google_workspace') === 'connected';
  if (googleConnected) toast('เชื่อม Gmail + Drive + Google Sheets เรียบร้อยแล้ว');
  if (url.searchParams.get('auth') === 'success') toast('เข้าสู่ระบบด้วย Google เรียบร้อยแล้ว');
  if (url.searchParams.get('auth') === 'line') toast(forceNewBusiness ? 'ยืนยัน LINE แล้ว · ตั้งค่าธุรกิจต่อบนเว็บได้เลย' : 'เข้าสู่ระบบผ่าน LINE เรียบร้อยแล้ว');
  if (url.searchParams.has('auth_error')) {
    const code = url.searchParams.get('auth_error');
    showLoginError(code === 'line_token'
      ? 'ลิงก์จาก LINE หมดอายุหรือถูกใช้แล้ว พิมพ์ “เชื่อมธุรกิจ” ใน LINE เพื่อขอลิงก์ใหม่'
      : code === 'line_membership'
        ? 'บัญชี LINE นี้ไม่มีสิทธิ์เข้าธุรกิจดังกล่าว'
        : 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่');
  }
  if (url.searchParams.has('google_workspace_error')) toast(googleWorkspaceErrorText(url.searchParams.get('google_workspace_error')), true);
  const cleanup = ['google_workspace','google_workspace_error','auth','auth_error','setup'];
  if ([...url.searchParams.keys()].some(key => cleanup.includes(key))) {
    cleanup.forEach(key => url.searchParams.delete(key));
    const query = url.searchParams.toString();
    history.replaceState({}, '', `${url.pathname}${query ? `?${query}` : ''}${url.hash}`);
  }
  return { forceNewBusiness, googleConnected };
}

async function ensureWorkspaceReady() {
  try {
    await api('/api/bootstrap', { timeoutMs: 45000 });
    return true;
  } catch (error) {
    if (!['AUTH_REQUIRED','COMPANY_REQUIRED'].includes(error.message)) {
      renderFallbackShell();
      renderLoadProblem([{ label: 'ฐานข้อมูล', message: error.message }]);
    }
    return false;
  }
}

async function runLoadPool(tasks, limit = 6) {
  const results = new Array(tasks.length);
  let cursor = 0;
  const worker = async () => {
    while (true) {
      const index = cursor++;
      if (index >= tasks.length) return;
      results[index] = await tasks[index]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

async function loadAll({ silent = false, background = false } = {}) {
  if (!background) setLoading(true);
  const errors = [];
  const safeLoad = async (label, promise, fallback) => {
    try { return await promise; }
    catch (error) {
      if (['AUTH_REQUIRED','COMPANY_REQUIRED'].includes(error.message)) throw error;
      errors.push({ label, message: error.message });
      return typeof fallback === 'function' ? fallback() : fallback;
    }
  };

  try {
    const role=String(activeCompanyRole()||'');
    const isHr=['owner','hr_admin','hr'].includes(role);
    const canReadBroadcasts=['owner','hr_admin','hr','manager'].includes(role);
    const canViewPeople=['owner','hr_admin','hr','manager','viewer'].includes(role);
    const [dashboard, companyProfile, peopleCore, employees, candidates, attendance, leaves, requests, employeeService, hrCases, broadcasts, payroll, documents, learning, performance, engagement, analytics, subscription, googleWorkspace, lineIntegration, invites, lookups, workLocations, leavePolicies, approverAccess, recruitmentGmail, benefits] = await runLoadPool([
      () => safeLoad('ภาพรวม', api('/api/dashboard'), () => state.dashboard || emptyDashboard()),
      () => safeLoad('ข้อมูลบริษัท', api('/api/company-profile'), () => ({company:state.companyProfile || activeCompany() || {}})),
      () => safeLoad('โครงสร้างองค์กร', api('/api/people-core'), () => state.peopleCore || { departments: [], positions: [], schedules: [], holidays: [], attendance_policy: {} }),
      () => safeLoad('พนักงาน', api('/api/employees'), () => ({data:state.employees || []})),
      () => safeLoad('Recruitment', api('/api/candidates'), () => ({data:state.candidates || []})),
      () => safeLoad('เวลาเข้างาน', api('/api/attendance/today'), () => ({data:state.attendance || []})),
      () => safeLoad('การลา', api('/api/leaves'), () => ({data:state.leaves || []})),
      () => safeLoad('Employee Service', api('/api/requests'), () => ({data:state.requests || []})),
      () => safeLoad('Employee Service Center', api('/api/employee-service'), () => state.employeeService || {}),
      () => isHr ? safeLoad('HR Cases', api('/api/hr-cases'), () => ({data:state.hrCases || []})) : Promise.resolve({data:[]}),
      () => canReadBroadcasts ? safeLoad('ประกาศ', api('/api/broadcasts'), () => ({data:state.broadcasts || []})) : Promise.resolve({data:[]}),
      () => isHr ? safeLoad('Payroll', api('/api/payroll/overview'), () => state.payroll) : Promise.resolve(null),
      () => isHr ? safeLoad('เอกสาร', api('/api/documents'), () => state.documents || {data:[],payslips:[]}) : Promise.resolve({data:[],payslips:[]}),
      () => canReadBroadcasts ? safeLoad('Learning', api('/api/learning/overview'), () => state.learning || {courses:[],assignments:[],summary:{}}) : Promise.resolve({courses:[],assignments:[],summary:{}}),
      () => canReadBroadcasts ? safeLoad('Performance', api('/api/performance/overview'), () => state.performance || {cycles:[],goals:[],one_on_ones:[],probation_reviews:[],probation_due:[],summary:{}}) : Promise.resolve({cycles:[],goals:[],one_on_ones:[],probation_reviews:[],probation_due:[],summary:{}}),
      () => canViewPeople ? safeLoad('Engagement', api('/api/engagement/overview'), () => state.engagement || {rules:[],rewards:[],redemptions:[],leaderboard:[],recent_transactions:[],summary:{}}) : Promise.resolve({rules:[],rewards:[],redemptions:[],leaderboard:[],recent_transactions:[],summary:{}}),
      () => canViewPeople ? safeLoad('People Analytics', api('/api/analytics/overview'), () => state.analytics || {summary:{},headcount_trend:[],departments:[],recruitment:{},moments:[]}) : Promise.resolve({summary:{},headcount_trend:[],departments:[],recruitment:{},moments:[]}),
      () => safeLoad('Subscription', api('/api/subscription'), () => state.subscription),
      () => safeLoad('Google', api('/api/integrations/google-workspace'), () => state.googleWorkspace || {connected:false,integration:null}),
      () => safeLoad('LINE Integration', api('/api/integrations/line'), () => state.lineIntegration || {connected:false,integration:null}),
      () => safeLoad('ลิงก์เชิญ', api('/api/invites'), () => ({data:state.invites || []})),
      () => safeLoad('ข้อมูลตัวเลือก', api('/api/lookups'), () => state.lookups || {departments:[],positions:[],locations:[]}),
      () => safeLoad('สถานที่ทำงาน', api('/api/work-locations'), () => ({data:state.workLocations || []})),
      () => safeLoad('สิทธิ์ลา', api('/api/leave-policies'), () => ({data:state.leavePolicies || []})),
      () => isHr ? safeLoad('สิทธิ์ผู้อนุมัติ', api('/api/approver-access'), () => ({data:state.approverAccess || [],catalog:state.approverPermissionCatalog || []})) : Promise.resolve({data:[],catalog:[]}),
      () => isHr ? safeLoad('Gmail ผู้สมัคร', api('/api/recruitment/gmail/status'), () => state.recruitmentGmail || {connected:false,enabled:false}) : Promise.resolve({connected:false,enabled:false}),
      () => isHr ? safeLoad('สวัสดิการ', api('/api/benefits'), () => state.benefits || {data:[],enrollments:[]}) : Promise.resolve({data:[],enrollments:[]}),
    ], 6);

    state.dashboard = dashboard || emptyDashboard();
    state.companyProfile = companyProfile?.company || companyProfile || state.companyProfile || activeCompany() || {};
    state.peopleCore = peopleCore || { departments: [], positions: [], schedules: [], holidays: [], attendance_policy: {} };
    state.employees = employees?.data || [];
    state.candidates = candidates?.data || [];
    state.attendance = attendance?.data || [];
    state.leaves = leaves?.data || [];
    state.requests = requests?.data || [];
    state.employeeService = employeeService || {};
    state.hrCases = hrCases?.data || [];
    state.broadcasts = broadcasts?.data || [];
    state.payroll = payroll;
    state.documents = documents || {data:[],payslips:[]};
    state.learning = learning || {courses:[],assignments:[],summary:{}};
    state.performance = performance || {cycles:[],goals:[],one_on_ones:[],probation_reviews:[],probation_due:[],summary:{}};
    state.engagement = engagement || {rules:[],rewards:[],redemptions:[],leaderboard:[],recent_transactions:[],summary:{}};
    state.analytics = analytics || {summary:{},headcount_trend:[],departments:[],recruitment:{},moments:[]};
    state.subscription = subscription || null;
    state.saasAdmin = null;
    if (subscription?.saas_admin) {
      try { state.saasAdmin = await api('/api/admin/saas/overview'); }
      catch (error) { errors.push({label:'Nakna Admin',message:error.message}); }
    }
    state.googleWorkspace = googleWorkspace;
    state.lineIntegration = lineIntegration;
    state.invites = invites?.data || [];
    state.lookups = lookups || { departments: [], positions: [], locations: [] };
    state.workLocations = workLocations?.data || [];
    state.leavePolicies = leavePolicies?.data || [];
    state.approverAccess = approverAccess?.data || [];
    state.approverPermissionCatalog = approverAccess?.catalog || [];
    state.recruitmentGmail = recruitmentGmail || {connected:false,enabled:false};
    state.benefits = benefits || {data:[],enrollments:[]};

    renderAll();
    renderIdentity();
    renderSettings();
    renderLoadProblem(errors);
    writeDashboardCache();
    if (!silent && !errors.length) toast('อัปเดตข้อมูลล่าสุดแล้ว');
    if (!silent && errors.length) toast(`โหลดได้บางส่วน · มี ${errors.length} จุดที่ต้องลองใหม่`, true);
  } catch (error) {
    if (!['AUTH_REQUIRED','COMPANY_REQUIRED'].includes(error.message)) {
      renderFallbackShell();
      renderLoadProblem([{ label: 'ระบบ HR', message: error.message }]);
    }
  } finally {
    if (!background) setLoading(false);
  }
}

function setLoading(loading) {
  $('#refreshBtn').classList.toggle('loading', loading);
  $('#refreshBtn').disabled = loading;
}

function emptyDashboard() {
  const active = activeCompany() || state.companyProfile || {};
  const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return {
    today,
    client: { id: active.id || null, name: active.name || 'บริษัทของคุณ', code: active.code || '' },
    summary: { employees: Number(state.employees?.length || 0), present: 0, late: 0, leave: 0, missing: 0, holiday_name: null },
    attention: [], birthdays: [], recruitment: {}, probation: [], contracts: [],
  };
}

function renderFallbackShell() {
  if (!state.dashboard) state.dashboard = emptyDashboard();
  try {
    renderAll();
    renderIdentity();
  } catch {}
}

function renderLoadProblem(errors = []) {
  state.loadErrors = errors;
  const banner = $('#dataLoadBanner');
  if (!banner) return;
  if (!errors.length) {
    banner.classList.add('hidden');
    $('#dataLoadMessage').textContent = '';
    return;
  }
  const labels = errors.slice(0, 4).map(item => item.label).join(' · ');
  const timeout = errors.some(item => String(item.message || '').startsWith('API_TIMEOUT'));
  $('#dataLoadMessage').textContent = timeout
    ? `บางข้อมูลตอบช้าเกินไป (${labels}) — หน้าเว็บส่วนที่โหลดได้ยังใช้งานต่อได้`
    : `บางข้อมูลโหลดไม่สำเร็จ (${labels}) — หน้าเว็บจะไม่ค้าง Skeleton และลองโหลดใหม่ได้`;
  banner.classList.remove('hidden');
}

async function loadPublicOnboarding() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch('/api/public/onboarding', { signal: controller.signal });
    if (!res.ok) return;
    state.onboardingConfig = await res.json();
    const button = $('#lineBusinessBtn');
    if (button && state.onboardingConfig?.line_configured) {
      button.disabled = false;
      button.dataset.ready = 'true';
      $('#lineSetupHint').textContent = 'Add LINE → พิมพ์ “เชื่อมธุรกิจ” → เปิด Business Setup บนเว็บ';
    }
  } catch {} finally {
    clearTimeout(timer);
  }
}

function openLineBusinessOnboarding() {
  const config = state.onboardingConfig || {};
  const url = config.line_connect_url || config.line_add_url;
  if (!url) {
    showLoginError('LINE Official Account หลักยังไม่พร้อม กรุณาตรวจ LINE_CHANNEL_ACCESS_TOKEN / LINE_CHANNEL_SECRET');
    return;
  }
  window.location.href = url;
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
  renderRecruitmentGmail();
  renderBenefits();
  renderAttendance();
  renderLeaves();
  renderRequests();
  renderEmployeeService();
  renderInviteCenter();
  renderWorkLocations();
  renderPeopleCore();
  renderLeavePolicies();
  renderPayroll();
  renderDocuments();
  renderGrowth();
  renderEngagement();
  renderAnalytics();
  renderSubscription();
  renderSaasAdmin();

  $('#todayText').textContent = formatDate(state.dashboard.today);
  $('#sidebarCompany').textContent = state.dashboard.client?.name || 'บริษัทของคุณ';
}

function renderDashboard() {
  const d = state.dashboard;
  const total = d.attention.reduce((sum, item) => sum + item.count, 0);

  $('#attentionTotal').textContent = total;
  $('#navAttention').textContent = total;
  $('#navAttention').dataset.empty = total ? 'false' : 'true';
  $('#heroSub').textContent = `${d.client.name} · ${d.summary.employees} คน · ${formatDate(d.today)}${d.summary.holiday_name ? ` · 🎉 ${d.summary.holiday_name}` : ''}`;

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
    ? state.employees.filter(employee => [employee.nickname,employee.first_name,employee.last_name,employee.employee_code,employee.department_name,employee.position_name,employee.line_display_name,employee.work_location_names].some(value => String(value || '').toLowerCase().includes(normalized)))
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
            <div><strong>${escapeHtml(employee.nickname || employee.first_name)} ${escapeHtml(employee.last_name)}</strong><small>${escapeHtml(employee.employee_code)}${employee.position_name ? ` · ${escapeHtml(employee.position_name)}` : ''}</small><span class="people-status ${peopleStatusTone(employee.people_status)}">${escapeHtml(peopleStatusLabel(employee.people_status))}</span></div>
          </div>
        </td>
        <td data-label="แผนก"><strong class="table-primary">${escapeHtml(employee.department_name || '—')}</strong><small class="table-secondary">${employee.manager_employee_id ? `หัวหน้า ${escapeHtml(employee.manager_nickname || employee.manager_first_name || 'กำหนดแล้ว')}` : 'ยังไม่กำหนดหัวหน้า'}</small></td>
        <td data-label="Work Location">${employee.work_location_names ? `<span class="location-inline">📍 ${escapeHtml(employee.work_location_names)}</span>` : '<span class="muted">ทุก Location</span>'}</td>
        <td data-label="ผู้อนุมัติลา">${employee.leave_approver_employee_id ? `<div class="approver-inline"><strong>${escapeHtml(employee.leave_approver_nickname || employee.leave_approver_first_name || 'กำหนดแล้ว')}</strong><small>LINE Approval</small></div>` : '<span class="badge badge-warning">ยังไม่กำหนด</span>'}</td>
        <td data-label="LINE">${employee.line_user_id
          ? `<div class="line-connected"><span class="badge badge-success"><span class="status-dot"></span> เชื่อมแล้ว</span><small>${escapeHtml(employee.line_display_name || 'LINE account')}</small></div>`
          : '<span class="badge badge-neutral">ยังไม่เชื่อม</span>'}</td>
        <td data-label="จัดการ"><button class="text-btn" onclick="window.openPeopleProfile(${Number(employee.id)})">โปรไฟล์</button><br><button class="text-btn" onclick="window.openLeaveProfile(${Number(employee.id)})">สิทธิ์ลา</button></td>
      </tr>`).join('')
    : `<tr><td colspan="6">${emptyState('ไม่พบพนักงาน', 'ลองค้นหาด้วยชื่อ รหัสพนักงาน แผนก หรือ LINE อีกครั้ง')}</td></tr>`;
}

function peopleStatusLabel(status){return ({candidate:'Candidate',interview:'รอสัมภาษณ์',offer:'Offer',probation:'ทดลองงาน',employee:'พนักงาน',leave_of_absence:'พักงาน',resigned:'ลาออก',terminated:'เลิกจ้าง',alumni:'อดีตพนักงาน',inactive:'Inactive'})[status]||'พนักงาน';}
function peopleStatusTone(status){return ['employee'].includes(status)?'ok':['probation','offer','interview'].includes(status)?'wait':['resigned','terminated','alumni','inactive'].includes(status)?'off':'info';}

window.openPeopleProfile = id => {
  const employee=state.employees.find(e=>Number(e.id)===Number(id)); if(!employee)return;
  $('#peopleProfileEmployeeId').value=employee.id;
  $('#peopleProfileTitle').textContent=`จัดการ ${employee.nickname||employee.first_name}`;
  $('#peopleProfileStatus').value=employee.people_status||'employee';
  $('#peopleProfileDepartment').innerHTML=`<option value="">ไม่ระบุ</option>${(state.peopleCore.departments||[]).map(d=>`<option value="${d.id}" ${Number(employee.department_id)===Number(d.id)?'selected':''}>${escapeHtml(d.name)}</option>`).join('')}`;
  $('#peopleProfilePosition').innerHTML=`<option value="">ไม่ระบุ</option>${(state.peopleCore.positions||[]).map(pos=>`<option value="${pos.id}" ${Number(employee.position_id)===Number(pos.id)?'selected':''}>${escapeHtml(pos.name)}</option>`).join('')}`;
  $('#peopleProfileManager').innerHTML=`<option value="">ไม่ระบุ</option>${state.employees.filter(e=>Number(e.id)!==Number(id)&&e.status==='active').map(e=>`<option value="${e.id}" ${Number(employee.manager_employee_id)===Number(e.id)?'selected':''}>${escapeHtml(e.nickname||e.first_name)}${e.department_name?` · ${escapeHtml(e.department_name)}`:''}</option>`).join('')}`;
  $('#peopleProfileProbationEnd').value=employee.probation_end_date||''; $('#peopleProfileConfirmedAt').value=employee.confirmed_at||''; $('#peopleProfileEndDate').value=employee.end_date||''; $('#peopleProfileEndReason').value=employee.end_reason||'';
  const selectedLocations=new Set(String(employee.work_location_ids||'').split(',').filter(Boolean).map(Number));
  $('#peopleProfileLocations').innerHTML=(state.workLocations||[]).filter(l=>Number(l.is_active)).length?(state.workLocations||[]).filter(l=>Number(l.is_active)).map(l=>`<label class="location-check"><input type="checkbox" value="${l.id}" ${selectedLocations.has(Number(l.id))?'checked':''}/><span><strong>${escapeHtml(l.name)}</strong><small>${escapeHtml(l.address||`รัศมี ${l.radius_m} ม.`)}</small></span></label>`).join(''):`<div class="location-empty-inline"><strong>ยังไม่มี Work Location</strong><span>เพิ่ม Location จาก Settings ก่อน</span></div>`;
  $('#peopleProfileModal').showModal();
};

async function savePeopleProfile(){
  const id=Number($('#peopleProfileEmployeeId').value); const button=$('#peopleProfileSaveBtn'); button.disabled=true;
  const location_ids=$$('#peopleProfileLocations input:checked').map(i=>Number(i.value));
  try{await api(`/api/employees/${id}/people-profile`,{method:'PATCH',body:JSON.stringify({people_status:$('#peopleProfileStatus').value,department_id:$('#peopleProfileDepartment').value||null,position_id:$('#peopleProfilePosition').value||null,manager_employee_id:$('#peopleProfileManager').value||null,probation_end_date:$('#peopleProfileProbationEnd').value||null,confirmed_at:$('#peopleProfileConfirmedAt').value||null,end_date:$('#peopleProfileEndDate').value||null,end_reason:$('#peopleProfileEndReason').value.trim()||null,location_ids})});$('#peopleProfileModal').close();await loadAll({silent:true});toast('อัปเดตสถานะพนักงานแล้ว');}catch(e){toast(e.message,true);}finally{button.disabled=false;}
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
  if(stage==='hired') return window.hireCandidate(id);
  try {
    await api(`/api/candidates/${id}/stage`, { method: 'PATCH', body: JSON.stringify({ stage }) });
    await loadAll({ silent: true });
    toast(`อัปเดตสถานะเป็น “${stageLabels[stage]}” แล้ว`);
  } catch (error) {
    toast(error.message, true);
  }
};

window.hireCandidate = id => {
  const candidate=state.candidates.find(c=>Number(c.id)===Number(id)); if(!candidate)return;
  openModal('HIRE','รับเข้าทำงาน',`เปลี่ยน ${candidate.nickname||candidate.first_name} จาก Candidate เป็นพนักงานทดลองงาน`,[['employee_code','รหัสพนักงาน (ไม่กรอก = สร้างอัตโนมัติ)','text'],['start_date','วันเริ่มงาน','date',true],['probation_end_date','วันครบ Probation','date']],async data=>{await api(`/api/candidates/${id}/hire`,{method:'POST',body:JSON.stringify(data)});await loadAll({silent:true});toast('สร้างพนักงานทดลองงานแล้ว');}); const start=$('#field-start_date'); if(start&&!start.value) start.value=localDateKey(new Date());
};


function renderRecruitmentGmail() {
  const root = $('#recruitmentGmailCard');
  if (!root) return;
  const d = state.recruitmentGmail || {};
  const connected = Boolean(d.connected);
  $('#recruitmentGmailBadge').className = `badge ${connected && d.enabled !== false ? 'badge-success' : connected ? 'badge-neutral' : 'badge-warning'}`;
  $('#recruitmentGmailBadge').textContent = !connected ? 'ยังไม่เชื่อม Google' : d.enabled === false ? 'ปิด Auto Sync' : 'Auto Sync';
  $('#recruitmentGmailEmail').textContent = connected ? (d.email || 'Google connected') : 'เชื่อม Google เพื่ออ่านอีเมลสมัครงาน';
  $('#recruitmentGmailQueryText').textContent = d.query || 'ยังไม่ได้ตั้ง Query';
  $('#recruitmentGmailLastSync').textContent = d.last_sync_at ? `Sync ล่าสุด ${formatDateTime(d.last_sync_at)}` : 'ยังไม่เคย Sync';
  $('#recruitmentGmailImported').textContent = `${Number(d.imported_messages || 0).toLocaleString('th-TH')} อีเมล`;
  $('#recruitmentGmailError').textContent = d.last_error || '';
  $('#recruitmentGmailError').classList.toggle('hidden', !d.last_error);
  $('#recruitmentGmailConnectBtn').classList.toggle('hidden', connected);
  $('#recruitmentGmailSyncBtn').classList.toggle('hidden', !connected || d.enabled === false);
  $('#recruitmentGmailSettingsBtn').classList.toggle('hidden', !connected);
}

async function refreshRecruitmentGmail({ reloadCandidates = false } = {}) {
  state.recruitmentGmail = await api('/api/recruitment/gmail/status');
  if (reloadCandidates) {
    const candidates = await api('/api/candidates');
    state.candidates = candidates?.data || [];
    renderCandidates();
  }
  renderRecruitmentGmail();
}

async function syncRecruitmentGmailNow() {
  const button = $('#recruitmentGmailSyncBtn');
  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'กำลัง Sync…';
  try {
    const result = await api('/api/recruitment/gmail/sync', { method:'POST', body:'{}', timeoutMs:45000 });
    await refreshRecruitmentGmail({ reloadCandidates: true });
    toast(`Gmail Sync สำเร็จ · เพิ่ม ${result.imported || 0} ผู้สมัคร · เชื่อมของเดิม ${result.linked || 0}`);
  } catch (error) {
    toast(error.message, true);
    await refreshRecruitmentGmail().catch(()=>{});
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function openRecruitmentGmailSettings() {
  const d = state.recruitmentGmail || {};
  openPhase5Form({
    eyebrow:'RECRUITMENT GMAIL',
    title:'ตั้งค่า Gmail ผู้สมัคร',
    subtitle:'ใช้ Gmail Search Query เพื่อดึงเฉพาะเมลที่เป็นผู้สมัคร ลดการอ่านเมลอื่นที่ไม่เกี่ยวข้อง',
    html:`<div class="field full"><label class="toggle-line"><input id="p7RecruitEnabled" type="checkbox" ${d.enabled !== false ? 'checked' : ''}/> เปิด Auto Sync ผู้สมัครจาก Gmail</label></div>
      <div class="field full"><label>Gmail Search Query</label><input id="p7RecruitQuery" value="${escapeHtml(d.query || 'newer_than:30d {สมัคร resume CV &quot;job application&quot;}')}"/><small>ตัวอย่าง: <code>to:jobs@company.com newer_than:30d</code></small></div>`,
    onSave:async()=>{
      await api('/api/onboarding/recruitment-gmail',{method:'POST',body:JSON.stringify({enabled:$('#p7RecruitEnabled').checked,auto_sync:$('#p7RecruitEnabled').checked,query:$('#p7RecruitQuery').value.trim()})});
      await refreshRecruitmentGmail();
    }
  });
}

function renderBenefits() {
  const root = $('#benefitSummary');
  if (!root) return;
  const data = state.benefits?.data || [];
  const enrollments = state.benefits?.enrollments || [];
  const active = data.filter(x => x.status === 'active');
  const statutory = active.filter(x => Number(x.is_statutory) === 1);
  const employeeIds = new Set(enrollments.filter(x => x.status === 'active').map(x => Number(x.employee_id)));
  root.innerHTML = [
    ['สวัสดิการใช้งาน', active.length, 'PROGRAMS'],
    ['ตามกฎหมาย / Statutory', statutory.length, 'STATUTORY'],
    ['พนักงานที่มี Enrollment', employeeIds.size, 'ENROLLED'],
    ['รายการลงทะเบียนทั้งหมด', enrollments.filter(x=>x.status==='active').length, 'RECORDS']
  ].map(([label,value,kicker])=>`<article><span>${kicker}</span><strong>${Number(value).toLocaleString('th-TH')}</strong><p>${label}</p></article>`).join('');

  $('#addBenefitBtn').classList.toggle('hidden', !['owner','hr_admin','hr'].includes(String(activeCompanyRole()||'')));
  $('#benefitProgramList').innerHTML = data.length ? data.map(item => `
    <article class="benefit-card">
      <div class="benefit-icon">${Number(item.is_statutory) ? '⚖️' : benefitIcon(item.benefit_type)}</div>
      <div class="benefit-copy">
        <div class="benefit-title"><strong>${escapeHtml(item.name)}</strong><span class="badge ${item.status==='active'?'badge-success':'badge-neutral'}">${item.status==='active'?'ใช้งาน':'ปิด'}</span></div>
        <p>${escapeHtml(item.description || benefitTypeLabel(item.benefit_type))}</p>
        <small>${benefitTypeLabel(item.benefit_type)} · บริษัท ${money(item.employer_amount || 0)} · พนักงาน ${money(item.employee_amount || 0)} / ${benefitFrequencyLabel(item.frequency)}</small>
      </div>
      <div class="benefit-actions">
        <b>${Number(item.enrolled_count || 0)} คน</b>
        ${['owner','hr_admin','hr'].includes(String(activeCompanyRole()||'')) ? `<button class="secondary-btn small-btn" onclick="window.enrollBenefit(${Number(item.id)})">จัดพนักงาน</button>` : ''}
      </div>
    </article>`).join('') : emptyState('ยังไม่มีสวัสดิการ','เพิ่มประกันสังคม ประกันกลุ่ม ค่ารักษาพยาบาล หรือสวัสดิการของบริษัท');

  $('#benefitEnrollmentList').innerHTML = enrollments.length ? enrollments.slice(0,80).map(row => `
    <div class="phase5-row">
      <div class="phase5-copy"><strong>${escapeHtml(row.nickname || row.first_name)} · ${escapeHtml(row.benefit_name)}</strong><p>${escapeHtml(row.employee_code || '')}${row.start_date ? ` · เริ่ม ${formatDate(row.start_date)}` : ''}${row.end_date ? ` · ถึง ${formatDate(row.end_date)}` : ''}</p></div>
      <span class="badge ${row.status==='active'?'badge-success':'badge-neutral'}">${row.status==='active'?'ได้รับสิทธิ์':escapeHtml(row.status)}</span>
    </div>`).join('') : emptyState('ยังไม่มี Enrollment','กด “จัดพนักงาน” ที่สวัสดิการเพื่อกำหนดสิทธิ์รายคน');
}

function benefitTypeLabel(type) {
  return ({social_security:'ประกันสังคม',insurance:'ประกัน',medical:'ค่ารักษาพยาบาล',allowance:'เบี้ยเลี้ยง',fund:'กองทุน',leave:'สิทธิ์ลา',perk:'สิทธิพิเศษ',custom:'สวัสดิการอื่น'})[type] || type || 'สวัสดิการ';
}
function benefitFrequencyLabel(v){return ({monthly:'เดือน',annual:'ปี',one_time:'ครั้ง',per_claim:'เคลม'})[v]||v||'เดือน';}
function benefitIcon(v){return ({social_security:'🏛️',insurance:'🛡️',medical:'🩺',allowance:'💵',fund:'🏦',leave:'🌴',perk:'✨',custom:'🎁'})[v]||'🎁';}

function openBenefitCreate() {
  openPhase5Form({
    eyebrow:'BENEFITS',
    title:'เพิ่มสวัสดิการ',
    subtitle:'กำหนดค่าใช้จ่ายบริษัท/พนักงานและเลือกได้ว่าเป็นสิทธิ์ตามกฎหมายหรือสวัสดิการเพิ่มเติม',
    html:`<div class="field full"><label>ชื่อสวัสดิการ</label><input id="p7BenefitName" placeholder="เช่น ประกันกลุ่ม AIA"/></div>
      <div class="field"><label>ประเภท</label><select id="p7BenefitType"><option value="social_security">ประกันสังคม</option><option value="insurance">ประกัน</option><option value="medical">ค่ารักษาพยาบาล</option><option value="allowance">เบี้ยเลี้ยง</option><option value="fund">กองทุน</option><option value="perk">สิทธิพิเศษ</option><option value="custom" selected>อื่น ๆ</option></select></div>
      <div class="field"><label>รอบ</label><select id="p7BenefitFrequency"><option value="monthly">รายเดือน</option><option value="annual">รายปี</option><option value="one_time">ครั้งเดียว</option><option value="per_claim">ต่อการเคลม</option></select></div>
      <div class="field"><label>บริษัทสมทบ (บาท)</label><input id="p7BenefitEmployer" type="number" min="0" value="0"/></div>
      <div class="field"><label>พนักงานสมทบ (บาท)</label><input id="p7BenefitEmployee" type="number" min="0" value="0"/></div>
      <div class="field full"><label>รายละเอียด</label><textarea id="p7BenefitDescription" rows="3"></textarea></div>
      <div class="field full"><label class="toggle-line"><input id="p7BenefitStatutory" type="checkbox"/> เป็นสิทธิ์/รายการตามกฎหมาย</label></div>`,
    onSave:async()=>{
      await api('/api/benefits',{method:'POST',body:JSON.stringify({name:$('#p7BenefitName').value.trim(),benefit_type:$('#p7BenefitType').value,frequency:$('#p7BenefitFrequency').value,employer_amount:Number($('#p7BenefitEmployer').value||0),employee_amount:Number($('#p7BenefitEmployee').value||0),description:$('#p7BenefitDescription').value.trim(),is_statutory:$('#p7BenefitStatutory').checked})});
      state.benefits=await api('/api/benefits');renderBenefits();
    }
  });
}

window.enrollBenefit = benefitId => {
  const benefit = (state.benefits?.data || []).find(x=>Number(x.id)===Number(benefitId));
  if (!benefit) return;
  openPhase5Form({
    eyebrow:'BENEFIT ENROLLMENT',
    title:`จัดพนักงาน · ${benefit.name}`,
    subtitle:'กำหนดสิทธิ์รายคนได้ และใช้สถานะเพื่อหยุดสิทธิ์โดยไม่ลบประวัติ',
    html:`<div class="field full"><label>พนักงาน</label><select id="p7BenefitEmployeeId">${phase5EmployeeOptions()}</select></div>
      <div class="field"><label>สถานะ</label><select id="p7BenefitEnrollStatus"><option value="active">ได้รับสิทธิ์</option><option value="paused">พักสิทธิ์</option><option value="ended">สิ้นสุด</option></select></div>
      <div class="field"><label>วันเริ่ม</label><input id="p7BenefitStart" type="date" value="${new Date(Date.now()+7*3600000).toISOString().slice(0,10)}"/></div>
      <div class="field"><label>วันสิ้นสุด</label><input id="p7BenefitEnd" type="date"/></div>
      <div class="field full"><label>หมายเหตุ</label><input id="p7BenefitNote" placeholder="เช่น ผ่านทดลองงานแล้ว"/></div>`,
    onSave:async()=>{
      await api(`/api/benefits/${Number(benefitId)}/enroll`,{method:'POST',body:JSON.stringify({employee_id:Number($('#p7BenefitEmployeeId').value),status:$('#p7BenefitEnrollStatus').value,start_date:$('#p7BenefitStart').value,end_date:$('#p7BenefitEnd').value||null,note:$('#p7BenefitNote').value.trim()})});
      state.benefits=await api('/api/benefits');renderBenefits();
    }
  });
};

function renderAttendance() {
  const checkedIn = state.attendance.filter(item => item.check_in_at).length;
  const late = state.attendance.filter(item => item.status === 'late').length;
  const checkedOut = state.attendance.filter(item => item.check_out_at).length;
  const outside = state.attendance.filter(item => Number(item.checkout_outside_geofence)===1).length;

  $('#attendanceSummary').innerHTML = `
    <span><strong>${checkedIn}</strong> เช็กอินแล้ว</span>
    <span><strong>${late}</strong> มาสาย</span>
    <span><strong>${checkedOut}</strong> เช็กเอาต์แล้ว</span>
    <span><strong>${outside}</strong> ออกงานนอกพื้นที่</span>`;

  $('#attendanceBody').innerHTML = state.attendance.length
    ? state.attendance.map(attendance => `
      <tr>
        <td data-label="พนักงาน"><div class="person"><div class="avatar">${initial(attendance)}</div><div><strong>${escapeHtml(attendance.nickname || attendance.first_name)} ${escapeHtml(attendance.last_name)}</strong><small>${escapeHtml(attendance.employee_code)}</small></div></div></td>
        <td data-label="Check-in">${attendance.check_in_at ? `<strong class="table-primary">${time(attendance.check_in_at)}</strong>${attendance.scheduled_start?`<small class="table-secondary">ตาราง ${escapeHtml(attendance.scheduled_start)}${attendance.schedule_source?` · ${escapeHtml(attendance.schedule_source)}`:""}</small>`:""}` : '—'}</td>
        <td data-label="Location">${attendance.check_in_at
          ? attendance.checkin_location_name
            ? `<div class="attendance-location"><strong>📍 ${escapeHtml(attendance.checkin_location_name)}</strong><small>${attendance.checkin_distance_m != null ? `${Math.round(Number(attendance.checkin_distance_m))} ม. จากจุดกลาง` : ''}</small>${attendance.checkin_lat != null ? `<a href="https://www.google.com/maps?q=${Number(attendance.checkin_lat)},${Number(attendance.checkin_lng)}" target="_blank" rel="noopener">ดูแผนที่</a>` : ''}</div>`
            : attendance.checkin_lat != null ? '<span class="badge badge-warning">มีพิกัด · ไม่ได้ล็อก Location</span>' : '<span class="muted">ไม่เก็บพิกัด</span>'
          : '—'}</td>
        <td data-label="Check-out">${attendance.check_out_at ? `${time(attendance.check_out_at)}${Number(attendance.checkout_outside_geofence)===1?'<br><span class="badge badge-warning">นอกพื้นที่</span>':''}` : '—'}</td>
        <td data-label="สถานะ">${attendanceStatus(attendance)}</td>
      </tr>`).join('')
    : `<tr><td colspan="5">${emptyState('ยังไม่มีข้อมูลเวลาเข้างานวันนี้', 'พนักงานทั้งหมดจะแสดงตรงนี้ และเมื่อเช็กอินผ่าน LINE จะเห็น Location ที่ใช้ด้วย')}</td></tr>`;
}

function renderLeaves() {
  const pending = state.leaves.filter(leave => leave.status === 'pending').length;
  const evidence = state.leaves.filter(leave => leave.status === 'awaiting_evidence').length;
  const approved = state.leaves.filter(leave => leave.status === 'approved').length;
  const rejected = state.leaves.filter(leave => leave.status === 'rejected').length;

  $('#leaveSummary').innerHTML = `
    <span><strong>${pending}</strong> รออนุมัติ</span>
    <span><strong>${evidence}</strong> รอหลักฐาน</span>
    <span><strong>${approved}</strong> อนุมัติแล้ว</span>
    <span><strong>${rejected}</strong> ไม่อนุมัติ</span>`;

  $('#leaveBody').innerHTML = state.leaves.length
    ? state.leaves.map(leave => `
      <tr>
        <td data-label="พนักงาน"><div class="person"><div class="avatar">${initial(leave)}</div><div><strong>${escapeHtml(leave.nickname || leave.first_name)} ${escapeHtml(leave.last_name || '')}</strong><small>#LV-${String(leave.id).padStart(4, '0')}</small></div></div></td>
        <td data-label="ประเภท / วัน"><strong class="table-primary">${escapeHtml(leave.leave_type_name || leaveLabels[leave.leave_type] || leave.leave_type)}</strong><small class="table-secondary">${formatDate(leave.start_date)}${leave.start_date !== leave.end_date ? ` – ${formatDate(leave.end_date)}` : ''} · ${formatLeaveDays(leave.duration_days)}</small></td>
        <td data-label="ผู้อนุมัติ">${leave.approver_employee_id ? `<div class="approver-inline"><strong>${escapeHtml(leave.approver_nickname || leave.approver_first_name || 'ผู้อนุมัติ')}</strong><small>${leave.status === 'pending' ? 'กำลังรอคนนี้' : 'Approval owner'}</small></div>` : '<span class="badge badge-danger">ยังไม่กำหนด</span>'}</td>
        <td data-label="หลักฐาน"><button class="text-btn ${Number(leave.evidence_count||0) ? '' : 'muted-btn'}" onclick="window.openLeaveDetail(${Number(leave.id)})">${Number(leave.evidence_count||0) ? `📎 ${Number(leave.evidence_count)} ไฟล์` : Number(leave.evidence_required) ? '⚠ ต้องแนบ' : 'ดูรายละเอียด'}</button></td>
        <td data-label="สถานะ">${statusBadge(leave.status)}</td>
        <td data-label="จัดการ">${leave.status === 'pending' && canHrOverrideLeave() ? `<button class="text-btn" onclick="window.leaveAction(${leave.id},'approve')">HR อนุมัติแทน</button> <button class="text-btn danger" onclick="window.leaveAction(${leave.id},'reject')">HR ไม่อนุมัติ</button>` : leave.status === 'pending' ? '<span class="muted">รอผู้อนุมัติใน LINE</span>' : '<span class="muted">—</span>'}</td>
      </tr>`).join('')
    : `<tr><td colspan="6">${emptyState('ยังไม่มีคำขอลา', 'พนักงานกดขอลาผ่าน LINE หรือ HR บันทึกคำขอแทนได้')}</td></tr>`;

  renderLeaveCalendar();
}

function renderLeaveCalendar() {
  const root = $('#leaveCalendar');
  const today = new Date(); today.setHours(12,0,0,0);
  const days = Array.from({length:14}, (_,i) => { const d=new Date(today); d.setDate(d.getDate()+i); return d; });
  root.innerHTML = days.map(d => {
    const key = localDateKey(d);
    const leaves = state.leaves.filter(item => item.status === 'approved' && key >= item.start_date && key <= item.end_date);
    return `<div class="leave-day ${leaves.length ? 'has-leave' : ''}">
      <div class="leave-day-date"><strong>${d.toLocaleDateString('th-TH',{day:'numeric',timeZone:'Asia/Bangkok'})}</strong><span>${d.toLocaleDateString('th-TH',{weekday:'short',month:'short',timeZone:'Asia/Bangkok'})}</span></div>
      <div class="leave-day-people">${leaves.length ? leaves.slice(0,4).map(item => `<span>${escapeHtml(item.nickname || item.first_name)} · ${escapeHtml(item.leave_type_name || leaveLabels[item.leave_type] || item.leave_type)}</span>`).join('') : '<small>ไม่มีคนลา</small>'}${leaves.length>4?`<small>+${leaves.length-4} คน</small>`:''}</div>
    </div>`;
  }).join('');
}

window.leaveAction = async (id, action) => {
  const reason = action === 'reject' ? window.prompt('ระบุเหตุผลที่ไม่อนุมัติ') : '';
  if (action === 'reject' && (!reason || reason.trim().length < 2)) return;
  try {
    await api(`/api/leaves/${id}/${action}`, { method: 'PATCH', body: JSON.stringify({ reason }) });
    await loadAll({ silent: true });
    toast(action === 'approve' ? 'อนุมัติคำขอลาเรียบร้อยแล้ว' : 'บันทึกเหตุผลและไม่อนุมัติแล้ว');
  } catch (error) { toast(error.message, true); }
};

window.openLeaveDetail = async id => {
  try {
    const result = await api(`/api/leaves/${id}`);
    const row = result.data;
    $('#modalEyebrow').textContent = `#LV-${String(id).padStart(4,'0')}`;
    $('#modalTitle').textContent = `${row.leave_type_name || row.leave_type} · ${row.nickname || row.first_name}`;
    $('#modalSubtitle').textContent = `${formatDate(row.start_date)}${row.start_date!==row.end_date?` – ${formatDate(row.end_date)}`:''} · ${formatLeaveDays(row.duration_days)}`;
    $('#modalFields').className = 'leave-detail';
    $('#modalFields').innerHTML = `
      <div class="detail-block"><span>เหตุผล</span><strong>${escapeHtml(row.reason || '—')}</strong></div>
      <div class="detail-grid"><div><span>ผู้อนุมัติ</span><strong>${escapeHtml(row.approver_nickname || row.approver_first_name || 'ยังไม่กำหนด')}</strong></div><div><span>สถานะ</span>${statusBadge(row.status)}</div></div>
      ${row.decision_reason ? `<div class="detail-block"><span>เหตุผลการพิจารณา</span><strong>${escapeHtml(row.decision_reason)}</strong></div>` : ''}
      <div class="detail-block"><span>หลักฐาน</span><div class="evidence-links">${(result.evidence||[]).length ? result.evidence.map(ev => `<a class="secondary-btn" href="/api/leave-evidence/${ev.id}" target="_blank" rel="noopener">📎 ${escapeHtml(ev.file_name || `หลักฐาน ${ev.id}`)}</a>`).join('') : '<small class="muted">ไม่มีไฟล์แนบ</small>'}</div>${['pending','awaiting_evidence'].includes(row.status)?`<div class="evidence-upload"><input id="leaveEvidenceFile" type="file" accept="image/*,.pdf" /><button type="button" class="secondary-btn" onclick="window.uploadLeaveEvidence(${id})">อัปโหลดหลักฐาน</button></div>`:''}</div>`;
    $('#modalSave').textContent = 'ปิด';
    $('#modalSave').onclick = () => $('#modal').close();
    $('#modal').showModal();
  } catch(error){ toast(error.message,true); }
};

window.uploadLeaveEvidence = async requestId => {
  const input = $('#leaveEvidenceFile');
  const file = input?.files?.[0];
  if (!file) return toast('กรุณาเลือกไฟล์หลักฐานก่อน', true);
  if (Number(file.size || 0) > 10 * 1024 * 1024) return toast('ไฟล์ใหญ่เกิน 10 MB', true);
  const button = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null;
  if (button) { button.disabled = true; button.textContent = 'กำลังอัปโหลด…'; }
  try {
    const form = new FormData();
    form.append('file', file, file.name);
    const response = await fetch(`/api/leaves/${Number(requestId)}/evidence`, { method: 'POST', body: form, credentials: 'same-origin' });
    let data = {}; try { data = await response.json(); } catch {}
    if (response.status === 401) { showLogin(); throw new Error('กรุณาเข้าสู่ระบบใหม่'); }
    if (!response.ok) throw new Error(data.error || `อัปโหลดไม่สำเร็จ (${response.status})`);
    toast('อัปโหลดหลักฐานแล้ว');
    await window.openLeaveDetail(Number(requestId));
    await loadAll({ silent: true });
  } catch (error) {
    toast(error.message || 'อัปโหลดหลักฐานไม่สำเร็จ', true);
  } finally {
    if (button) { button.disabled = false; button.textContent = 'อัปโหลดหลักฐาน'; }
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

function renderEmployeeService(){
  const service=state.employeeService||{};
  const cases=state.hrCases||[];
  const broadcasts=state.broadcasts||[];
  const role=String(activeCompanyRole()||'');
  const isHr=['owner','hr_admin','hr'].includes(role);
  const openCases=cases.filter(c=>!['resolved','closed'].includes(c.status)).length;
  $('#createBroadcastBtn').classList.toggle('hidden',!isHr);
  const totalInbox=openCases+Number(state.requests?.length||0);
  $('#requestCountBadge').textContent=`${totalInbox} รายการ`;
  $('#hrCaseOpenCount').textContent=String(openCases);
  $('#broadcastTotalCount').textContent=String(broadcasts.length);
  const rich=service.rich_menu||{};
  $('#richMenuStatusText').textContent=rich.configured?'พร้อมใช้':'ยังไม่ตั้ง';
  $('#setupRichMenuBtn').textContent=rich.configured?'อัปเดต Rich Menu':'ตั้ง Rich Menu ให้ LINE บริษัท';
  $('#setupRichMenuBtn').disabled=!rich.dedicated_line || !['owner','hr_admin'].includes(String(activeCompanyRole()||''));
  $('#removeRichMenuBtn').classList.toggle('hidden',!rich.configured || !['owner','hr_admin'].includes(String(activeCompanyRole()||'')));

  const root=$('#hrCasesList');
  if(root){
    if(!isHr){
      root.innerHTML=emptyState('ข้อมูลส่วนนี้จำกัดเฉพาะ HR','Manager จะไม่เห็นเรื่องส่วนตัวที่พนักงานแจ้ง HR');
    }else root.innerHTML=cases.length?cases.map(c=>{
      const priorityClass=c.priority==='urgent'?'badge-danger':c.priority==='high'?'badge-warning':'badge-neutral';
      const statusLabel=({open:'รับเรื่องแล้ว',in_progress:'กำลังดำเนินการ',waiting_employee:'รอพนักงาน',resolved:'แก้ไขแล้ว',closed:'ปิดเรื่อง'})[c.status]||c.status;
      return `<button class="hr-case-row" type="button" onclick="window.openHrCase(${Number(c.id)})"><div class="hr-case-id"><span class="badge ${priorityClass}">${escapeHtml(c.priority==='urgent'?'ด่วน':c.priority==='high'?'สูง':'ส่วนตัว')}</span><strong>#HR-${String(c.id).padStart(4,'0')}</strong></div><div class="hr-case-copy"><strong>${escapeHtml(c.subject)}</strong><p>${escapeHtml(c.detail)}</p><small>${escapeHtml(c.nickname||c.first_name)}${c.department_name?` · ${escapeHtml(c.department_name)}`:''} · ${formatDateTime(c.created_at)}</small></div><span class="badge ${['resolved','closed'].includes(c.status)?'badge-success':'badge-soft'}">${escapeHtml(statusLabel)}</span></button>`;
    }).join(''):emptyState('ยังไม่มีเรื่องส่วนตัวถึง HR','เมื่อพนักงานกด “แจ้ง HR” ใน LINE เรื่องจะเข้ามาที่นี่โดยตรง');
  }

  const broadcastRoot=$('#broadcastList');
  if(broadcastRoot) broadcastRoot.innerHTML=broadcasts.length?broadcasts.slice(0,8).map(b=>`<article class="broadcast-row"><div><strong>${escapeHtml(b.title)}</strong><p>${escapeHtml(b.message)}</p><small>${formatDateTime(b.created_at)} · ${escapeHtml(b.audience_type==='all'?'ทุกคน':b.audience_type==='department'?'เฉพาะแผนก':'เลือกพนักงาน')}</small></div><div class="broadcast-stats"><span class="badge ${b.status==='sent'?'badge-success':b.status==='partial'?'badge-warning':'badge-neutral'}">${escapeHtml(b.status)}</span><small>${Number(b.delivered_count||0)}/${Number(b.total_recipients||0)} ส่งสำเร็จ</small>${b.status==='draft'?`<button class="text-btn" onclick="window.sendBroadcastById(${Number(b.id)})">ส่งตอนนี้</button>`:''}</div></article>`).join(''):emptyState('ยังไม่มีประกาศ','ส่งประกาศจาก HR เข้า LINE ของพนักงานได้จากปุ่มด้านบน');
}

function renderBroadcastAudienceFields(){
  const mode=$('#broadcastAudience').value;
  $('#broadcastDepartmentField').classList.toggle('hidden',mode!=='department');
  $('#broadcastEmployeesField').classList.toggle('hidden',mode!=='employees');
}
function openBroadcastModal(){
  $('#broadcastTitle').value=''; $('#broadcastMessage').value=''; $('#broadcastAudience').value='all';
  $('#broadcastDepartment').innerHTML=(state.peopleCore?.departments||[]).map(d=>`<option value="${Number(d.id)}">${escapeHtml(d.name)}</option>`).join('');
  $('#broadcastEmployeeChecks').innerHTML=state.employees.filter(e=>e.status==='active').map(e=>`<label class="location-check"><input type="checkbox" value="${Number(e.id)}"><span><strong>${escapeHtml(e.nickname||e.first_name)}</strong><small>${escapeHtml(e.department_name||'ไม่ระบุแผนก')}${e.line_user_id?' · LINE✓':' · ยังไม่เชื่อม LINE'}</small></span></label>`).join('');
  renderBroadcastAudienceFields(); $('#broadcastModal').showModal();
}
async function sendBroadcast(){
  const title=$('#broadcastTitle').value.trim(),message=$('#broadcastMessage').value.trim(),audience_type=$('#broadcastAudience').value;
  if(title.length<2||message.length<2)return toast('กรุณาใส่หัวข้อและข้อความประกาศ',true);
  const body={title,message,audience_type,send_now:true};
  if(audience_type==='department') body.department_id=Number($('#broadcastDepartment').value);
  if(audience_type==='employees') body.employee_ids=$$('#broadcastEmployeeChecks input:checked').map(x=>Number(x.value));
  const btn=$('#broadcastSendBtn');btn.disabled=true;btn.textContent='กำลังส่ง…';
  try{const result=await api('/api/broadcasts',{method:'POST',body:JSON.stringify(body)});$('#broadcastModal').close();await loadAll({silent:true});toast(`ส่งประกาศแล้ว ${Number(result.delivered||0)} คน${Number(result.failed||0)+Number(result.skipped||0)>0?` · ไม่สำเร็จ ${Number(result.failed||0)+Number(result.skipped||0)}`:''}`);}catch(e){toast(e.message,true);}finally{btn.disabled=false;btn.textContent='ส่งประกาศตอนนี้';}
}
window.sendBroadcastById=async id=>{try{const result=await api(`/api/broadcasts/${id}/send`,{method:'POST',body:'{}'});await loadAll({silent:true});toast(`ส่งประกาศแล้ว ${Number(result.delivered||0)} คน`);}catch(e){toast(e.message,true);}};

async function setupRichMenu(){
  const btn=$('#setupRichMenuBtn');btn.disabled=true;btn.textContent='กำลังตั้ง Rich Menu…';
  try{await api('/api/integrations/line/rich-menu',{method:'POST',body:'{}'});state.employeeService=await api('/api/employee-service');renderEmployeeService();toast('ตั้ง Rich Menu ให้ LINE บริษัทแล้ว');}catch(e){toast(e.message,true);}finally{btn.disabled=false;btn.textContent=state.employeeService?.rich_menu?.configured?'อัปเดต Rich Menu':'ตั้ง Rich Menu ให้ LINE บริษัท';}
}
async function removeRichMenu(){if(!confirm('ลบ Rich Menu เริ่มต้นของบริษัทออกจาก LINE ใช่ไหม?'))return;try{await api('/api/integrations/line/rich-menu',{method:'DELETE'});state.employeeService=await api('/api/employee-service');renderEmployeeService();toast('ลบ Rich Menu แล้ว');}catch(e){toast(e.message,true);}}

window.openHrCase=async id=>{
  try{
    const result=await api(`/api/hr-cases/${id}`); const c=result.data; state.activeHrCaseId=Number(id);
    $('#hrCaseModalTitle').textContent=`#HR-${String(id).padStart(4,'0')} · ${c.subject}`;
    $('#hrCaseModalSub').textContent=`${c.nickname||c.first_name} · ${c.department_name||'ไม่ระบุแผนก'} · ${formatDateTime(c.created_at)}`;
    $('#hrCaseStatus').value=c.status; $('#hrCasePriority').value=c.priority; $('#hrCaseNote').value=c.hr_note||''; $('#hrCaseReply').value='';
    $('#hrCaseDetail').innerHTML=`<div class="private-case-banner">🔒 ข้อมูลนี้สำหรับ HR เท่านั้น</div><div class="detail-block"><span>รายละเอียดจากพนักงาน</span><strong>${escapeHtml(c.detail)}</strong></div>${c.last_reply_to_employee?`<div class="detail-block"><span>ตอบกลับล่าสุด</span><strong>${escapeHtml(c.last_reply_to_employee)}</strong></div>`:''}<div class="case-timeline">${(result.events||[]).map(ev=>`<div><span>${formatDateTime(ev.created_at)}</span><strong>${escapeHtml(ev.action)}</strong>${ev.message?`<p>${escapeHtml(ev.message)}</p>`:''}</div>`).join('')}</div>`;
    $('#hrCaseModal').showModal();
  }catch(e){toast(e.message,true);}
};
async function saveHrCase(){
  const id=state.activeHrCaseId;if(!id)return;const btn=$('#hrCaseSaveBtn');btn.disabled=true;
  try{await api(`/api/hr-cases/${id}`,{method:'PATCH',body:JSON.stringify({status:$('#hrCaseStatus').value,priority:$('#hrCasePriority').value,hr_note:$('#hrCaseNote').value.trim(),assigned_to_me:true})});const reply=$('#hrCaseReply').value.trim();if(reply)await api(`/api/hr-cases/${id}/reply`,{method:'POST',body:JSON.stringify({message:reply})});$('#hrCaseModal').close();await loadAll({silent:true});toast(reply?'บันทึกและตอบกลับพนักงานแล้ว':'บันทึกเรื่อง HR แล้ว');}catch(e){toast(e.message,true);}finally{btn.disabled=false;}
}

async function saveProbationLeaveLock(){
  const input=$('#probationLeaveLockToggle');input.disabled=true;
  try{const result=await api('/api/leave-settings',{method:'PATCH',body:JSON.stringify({lock_leave_during_probation:input.checked})});state.employeeService={...(state.employeeService||{}),leave_settings:{lock_leave_during_probation:result.lock_leave_during_probation}};toast(result.lock_leave_during_probation?'ล็อกวันลาระหว่างทดลองงานแล้ว':'อนุญาตวันลาระหว่างทดลองงานตาม Policy แล้ว');}catch(e){input.checked=!input.checked;toast(e.message,true);}finally{input.disabled=false;}
}

function toggleSettingsNav() {
  state.settingsNavExpanded = !state.settingsNavExpanded;
  const settingsButton = document.querySelector('[data-view="settings"]');
  settingsButton?.setAttribute('aria-expanded', String(state.settingsNavExpanded));
  syncSettingsSidebar();
  if (state.settingsNavExpanded) {
    setTimeout(() => $('#settingsNavSection')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 30);
  }
}

function showView(name) {
  const target = $(`#view-${name}`);
  if (!target) return;

  state.currentView = name;
  if (name !== 'settings') state.settingsNavExpanded = false;
  else state.settingsNavExpanded = true;
  $$('.view').forEach(view => view.classList.remove('active'));
  $$('.nav-item').forEach(button => button.classList.remove('active'));

  target.classList.add('active');
  document.querySelector(`[data-view="${name}"]`)?.classList.add('active');

  const [title, kicker] = viewMeta[name] || [name, 'NAKNA HR'];
  $('#pageTitle').textContent = title;
  $('#pageKicker').textContent = kicker;

  closeMobileNav();
  if (name === 'settings' && state.activeSettingsCategory) {
    openSettingsCategory(state.activeSettingsCategory, { scroll: false });
  }
  syncSettingsSidebar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (name !== 'dashboard' && !deferredLoadInFlight) scheduleDeferredLoad(0);
}

function showSettingsHome({ scroll = true } = {}) {
  state.activeSettingsCategory = null;
  $('#settingsHome')?.classList.remove('hidden');
  $('#settingsDetail')?.classList.add('hidden');
  $$('[data-settings-category]').forEach(panel => panel.classList.add('hidden'));
  $$('.settings-detail-tabs [data-settings-open]').forEach(button => button.classList.remove('active'));
  syncSettingsSidebar();
  if (scroll && state.currentView === 'settings') window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openSettingsCategory(category, { scroll = true } = {}) {
  const meta = settingsCategoryMeta[category];
  if (!meta) return;
  state.activeSettingsCategory = category;
  $('#settingsHome')?.classList.add('hidden');
  $('#settingsDetail')?.classList.remove('hidden');
  $$('[data-settings-category]').forEach(panel => panel.classList.toggle('hidden', panel.dataset.settingsCategory !== category));
  $$('.settings-detail-tabs [data-settings-open]').forEach(button => button.classList.toggle('active', button.dataset.settingsOpen === category));
  if ($('#settingsDetailTitle')) $('#settingsDetailTitle').textContent = meta.title;
  if ($('#settingsDetailKicker')) $('#settingsDetailKicker').textContent = meta.kicker;
  if ($('#settingsDetailDescription')) $('#settingsDetailDescription').textContent = meta.description;
  syncSettingsSidebar();
  if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
}

function syncSettingsSidebar() {
  const open = Boolean(state.settingsNavExpanded || state.currentView === 'settings');
  $('#settingsNavSection')?.classList.toggle('hidden', !open);
  const settingsButton = document.querySelector('[data-view="settings"]');
  settingsButton?.setAttribute('aria-expanded', String(open));
  $$('[data-settings-sidebar-open]').forEach(button => {
    button.classList.toggle('active', state.currentView === 'settings' && button.dataset.settingsSidebarOpen === state.activeSettingsCategory);
  });
}

function renderSettingsSidebar() {
  const profile = state.companyProfile || state.dashboard?.client || activeCompany() || {};
  const core = state.peopleCore || {};
  const schedules = core.schedules || [];
  const holidays = core.holidays || [];
  const locations = state.workLocations || [];
  const leavePolicies = state.leavePolicies || [];
  const approvers = (state.approverAccess || []).filter(item => (item.permissions || []).length);
  const line = state.lineIntegration || {};
  const google = state.googleWorkspace || {};
  const payroll = state.payroll?.settings || {};
  const subscription = state.subscription || {};
  if ($('#settingsSidebarCompanyMeta')) $('#settingsSidebarCompanyMeta').textContent = `${(core.departments || []).length} แผนก · ${profile.name || 'โปรไฟล์บริษัท'}`;
  if ($('#settingsSidebarOrgMeta')) $('#settingsSidebarOrgMeta').textContent = `${(core.departments || []).length} แผนก · ${(core.positions || []).length} ตำแหน่ง`;
  if ($('#settingsSidebarWorktimeMeta')) $('#settingsSidebarWorktimeMeta').textContent = schedules.length ? `${schedules.length} กติกาเวลาทำงาน` : `${profile.work_start || '09:00'}–${profile.work_end || '18:00'} ค่าเริ่มต้น`;
  if ($('#settingsSidebarAttendanceMeta')) $('#settingsSidebarAttendanceMeta').textContent = locations.length ? `${locations.filter(x => Number(x.is_active) !== 0).length} จุดเช็กอิน` : 'ยังไม่มี Work location';
  if ($('#settingsSidebarLeaveMeta')) $('#settingsSidebarLeaveMeta').textContent = `${leavePolicies.length} ประเภทลา · ${holidays.length} วันหยุด`;
  if ($('#settingsSidebarApprovalMeta')) $('#settingsSidebarApprovalMeta').textContent = approvers.length ? `${approvers.length} คนมีสิทธิ์อนุมัติ` : 'ยังไม่ได้กำหนดผู้อนุมัติ';
  if ($('#settingsSidebarIntegrationMeta')) $('#settingsSidebarIntegrationMeta').textContent = `${line.connected ? 'LINE ✓' : 'LINE default'} · ${google.connected ? 'Google ✓' : 'Google ยังไม่เชื่อม'}`;
  if ($('#settingsSidebarPayrollMeta')) $('#settingsSidebarPayrollMeta').textContent = `จ่ายวันที่ ${payroll.pay_day || 28} · ${Number(payroll.social_security_enabled ?? 1) ? 'SSO ✓' : 'SSO ปิด'}`;
  if ($('#settingsSidebarBillingMeta')) $('#settingsSidebarBillingMeta').textContent = subscription.plan?.name || subscription.plan_name || (subscription.trial ? 'Free Trial' : 'ยังไม่มีแพ็กเกจ');
  syncSettingsSidebar();
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

function renderPeopleCore(){
  const core=state.peopleCore||{}; const departments=core.departments||[]; const schedules=core.schedules||[]; const holidays=core.holidays||[];
  const org=$('#organizationChart');
  if(org){
    const roots=departments.filter(d=>!d.parent_department_id||!departments.some(x=>Number(x.id)===Number(d.parent_department_id)));
    const renderNode=(d,depth=0)=>`<div class="org-node" style="--depth:${depth}"><div class="org-line"></div><div class="org-card"><div><strong>${escapeHtml(d.name)}</strong><small>${Number(d.employee_count||0)} คน · ${d.manager_employee_id?`หัวหน้า ${escapeHtml(d.manager_nickname||d.manager_first_name||'กำหนดแล้ว')}`:'ยังไม่กำหนดหัวหน้า'}</small></div><button class="text-btn" onclick="window.editDepartment(${Number(d.id)})">แก้ไข</button></div>${departments.filter(x=>Number(x.parent_department_id)===Number(d.id)).map(x=>renderNode(x,depth+1)).join('')}</div>`;
    org.innerHTML=roots.length?roots.map(d=>renderNode(d)).join(''):emptyState('ยังไม่มีโครงสร้างแผนก','เพิ่มแผนกแรก แล้วค่อยกำหนดหัวหน้าและแผนกย่อย');
  }
  const positionRoot=$('#positionList');
  if(positionRoot){
    const positions=core.positions||[];
    positionRoot.innerHTML=positions.length?positions.map(p=>`<article class="position-row"><div><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.department_name||'ใช้ได้ทุกแผนก')}</small></div><span class="badge badge-soft">${Number(p.employee_count||0)} คน</span></article>`).join(''):emptyState('ยังไม่มีตำแหน่ง','เพิ่มตำแหน่ง เช่น Graphic Designer, Sales, Accountant เพื่อใช้ตอนเพิ่มพนักงาน');
  }
  const scheduleRoot=$('#workScheduleList');
  if(scheduleRoot){
    const groups=new Map(); for(const r of schedules){const key=`${r.scope_type}:${r.scope_id}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
    const scopeName=(type,id)=>type==='company'?'ทั้งบริษัท':type==='department'?(departments.find(d=>Number(d.id)===Number(id))?.name||'แผนก'):state.employees.find(e=>Number(e.id)===Number(id))?.nickname||state.employees.find(e=>Number(e.id)===Number(id))?.first_name||'พนักงาน';
    const order=['จ','อ','พ','พฤ','ศ','ส','อา'];
    const cards=[...groups.entries()].map(([key,rules])=>{const [type,id]=key.split(':');const byDay=new Map(rules.map(r=>[Number(r.weekday),r]));return `<article class="schedule-card"><div class="schedule-head"><div><span class="scope-chip">${type==='company'?'บริษัท':type==='department'?'แผนก':'รายคน'}</span><strong>${escapeHtml(scopeName(type,Number(id)))}</strong></div><div class="schedule-actions"><button class="text-btn" onclick="window.openScheduleFor('${type}',${Number(id)})">ตั้งเวลาเพิ่ม</button><button class="text-btn danger-text" onclick="window.resetSchedule('${type}',${Number(id)})">ล้าง Override</button></div></div><div class="week-strip">${order.map((label,i)=>{const r=byDay.get(i+1);return `<div class="day-cell ${r&&Number(r.is_workday)?'work':'off'}"><b>${label}</b><span>${r?(Number(r.is_workday)?escapeHtml(r.start_time||'—'):'หยุด'):'ตามค่าเริ่มต้น'}</span></div>`}).join('')}</div></article>`}).join('');
    scheduleRoot.innerHTML=cards||`<article class="schedule-card default"><div class="schedule-head"><div><span class="scope-chip">ค่าเริ่มต้น</span><strong>ทั้งบริษัท</strong><small>${escapeHtml(state.companyProfile?.work_start||'09:00')}–${escapeHtml(state.companyProfile?.work_end||'18:00')} · จันทร์–ศุกร์</small></div><button class="text-btn" onclick="window.openScheduleFor('company',0)">กำหนดตาราง</button></div></article>`;
  }
  const holidayRoot=$('#holidayList'); if(holidayRoot){
    const currentYear=new Date().getFullYear(); const yearItems=holidays.filter(h=>String(h.holiday_date||'').startsWith(String(currentYear)));
    $('#holidayCountBadge').textContent=`${yearItems.length} วันใน ${currentYear+543}`; $('#holidayCompliance').className=`holiday-compliance ${yearItems.length>=13?'ok':'warn'}`; $('#holidayCompliance').innerHTML=yearItems.length>=13?`<strong>✓ จำนวนวันหยุดปีนี้ ${yearItems.length} วัน</strong><span>ตรวจสอบชื่อวันหยุดและวันแรงงานให้ตรงนโยบายบริษัทอีกครั้ง</span>`:`<strong>ควรตรวจวันหยุดประจำปี</strong><span>ตอนนี้มี ${yearItems.length} วัน · ระบบแนะนำให้ HR ตรวจ requirement วันหยุดตามประเพณีก่อนประกาศใช้</span>`;
    holidayRoot.innerHTML=holidays.length?holidays.slice(0,30).map(h=>`<div class="holiday-row"><div class="holiday-date"><strong>${new Date(`${h.holiday_date}T12:00:00`).getDate()}</strong><span>${new Date(`${h.holiday_date}T12:00:00`).toLocaleDateString('th-TH',{month:'short'})}</span></div><div><strong>${escapeHtml(h.name)}</strong><small>${h.holiday_type==='traditional'?'วันหยุดตามประเพณี':escapeHtml(h.holiday_type)}${Number(h.is_paid)?' · จ่ายค่าจ้าง':' · ไม่จ่ายค่าจ้าง'}</small></div><button class="text-btn danger-text" onclick="window.deleteHoliday(${Number(h.id)})">ลบ</button></div>`).join(''):emptyState('ยังไม่ได้ตั้งวันหยุดบริษัท','เพิ่มวันหยุดประจำปีให้พนักงานตรวจสอบได้จากระบบ');
  }
  const toggle=$('#attendancePolicyToggle'); if(toggle) toggle.checked=Boolean(core.attendance_policy?.allow_checkout_outside_geofence);
}

window.editDepartment=id=>openDepartmentModal((state.peopleCore.departments||[]).find(d=>Number(d.id)===Number(id)));
function openDepartmentModal(department=null){
  $('#departmentId').value=department?.id||''; $('#departmentName').value=department?.name||''; $('#departmentCode').value=department?.code||'';
  $('#departmentParent').innerHTML=`<option value="">ไม่มี / เป็นแผนกหลัก</option>${(state.peopleCore.departments||[]).filter(d=>Number(d.id)!==Number(department?.id)).map(d=>`<option value="${d.id}" ${Number(department?.parent_department_id)===Number(d.id)?'selected':''}>${escapeHtml(d.name)}</option>`).join('')}`;
  $('#departmentManager').innerHTML=`<option value="">ยังไม่กำหนด</option>${state.employees.filter(e=>e.status==='active').map(e=>`<option value="${e.id}" ${Number(department?.manager_employee_id)===Number(e.id)?'selected':''}>${escapeHtml(e.nickname||e.first_name)}${e.department_name?` · ${escapeHtml(e.department_name)}`:''}</option>`).join('')}`;
  $('#departmentModalTitle').textContent=department?'แก้ไขแผนก':'เพิ่มแผนก'; $('#departmentModal').showModal();
}
async function saveDepartment(){
  const id=$('#departmentId').value;
  const isCreating=!id;
  const body={name:$('#departmentName').value.trim(),code:$('#departmentCode').value.trim(),parent_department_id:$('#departmentParent').value||null,manager_employee_id:$('#departmentManager').value||null};
  if(body.name.length<2)return toast('กรุณาใส่ชื่อแผนก',true);
  const b=$('#departmentSaveBtn');b.disabled=true;
  try{
    const result=await api(id?`/api/departments/${id}`:'/api/departments',{method:id?'PATCH':'POST',body:JSON.stringify(body)});
    $('#departmentModal').close();
    const resumePosition=Boolean(state.resumePositionAfterDepartment && isCreating);
    state.resumePositionAfterDepartment=false;
    await loadAll({silent:true});
    toast('บันทึกโครงสร้างแผนกแล้ว');
    if(resumePosition) requestAnimationFrame(()=>openPositionModal(Number(result?.id||0)));
  }catch(e){toast(e.message,true);}finally{b.disabled=false;}
}
function openPositionModal(preselectDepartmentId=0){
  const departments=state.peopleCore?.departments||[];
  if(!departments.length){
    state.resumePositionAfterDepartment=true;
    toast('ยังไม่มีแผนก — สร้างแผนกแรกก่อน แล้วระบบจะพากลับมาเพิ่มตำแหน่งให้อัตโนมัติ');
    openDepartmentModal();
    return;
  }
  $('#positionName').value='';
  $('#positionDepartment').innerHTML=`${departments.map(d=>`<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('')}<option value="">ไม่ระบุแผนก</option>`;
  if(preselectDepartmentId && departments.some(d=>Number(d.id)===Number(preselectDepartmentId))) $('#positionDepartment').value=String(preselectDepartmentId);
  const help=$('#positionDepartmentHelp'); if(help) help.textContent=`มี ${departments.length} แผนก · เลือกแผนกที่ตำแหน่งนี้สังกัด หรือสร้างแผนกใหม่ได้`; 
  $('#positionModal').showModal();
}
async function savePosition(){const body={name:$('#positionName').value.trim(),department_id:$('#positionDepartment').value||null};if(body.name.length<2)return toast('กรุณาใส่ชื่อตำแหน่ง',true);const b=$('#positionSaveBtn');b.disabled=true;try{await api('/api/positions',{method:'POST',body:JSON.stringify(body)});$('#positionModal').close();await loadAll({silent:true});toast('เพิ่มตำแหน่งแล้ว');}catch(e){toast(e.message,true);}finally{b.disabled=false;}}
window.openScheduleFor=(type,id)=>openScheduleModal(type,id);
window.resetSchedule=async(type,id)=>{if(!confirm('ล้างตาราง Override นี้และกลับไปใช้ค่าระดับบนใช่ไหม?'))return;try{await api(`/api/work-schedules/${type}/${Number(id||0)}`,{method:'DELETE'});await loadAll({silent:true});toast('ล้างตาราง Override แล้ว');}catch(e){toast(e.message,true);}};
function openScheduleModal(type='company',id=0){$('#scheduleScopeType').value=type;refreshScheduleTarget();if(id)$('#scheduleScopeId').value=String(id);$('#scheduleStart').value=state.companyProfile?.work_start||'09:00';$('#scheduleEnd').value=state.companyProfile?.work_end||'18:00';$('#scheduleGrace').value=String(state.companyProfile?.late_grace_minutes??10);$('#scheduleIsWorkday').checked=true;$$('#scheduleWeekdays input').forEach((input,i)=>input.checked=i<5);$('#scheduleModal').showModal();}
function refreshScheduleTarget(){const type=$('#scheduleScopeType').value;const target=$('#scheduleScopeId');if(type==='company'){target.innerHTML='<option value="0">ทั้งบริษัท</option>';target.disabled=true;}else if(type==='department'){target.disabled=false;target.innerHTML=(state.peopleCore.departments||[]).map(d=>`<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');}else{target.disabled=false;target.innerHTML=state.employees.filter(e=>e.status==='active').map(e=>`<option value="${e.id}">${escapeHtml(e.nickname||e.first_name)} · ${escapeHtml(e.employee_code)}</option>`).join('');}}
async function saveSchedule(){const weekdays=$$('#scheduleWeekdays input:checked').map(i=>Number(i.value));if(!weekdays.length)return toast('เลือกวันที่ต้องการตั้งเวลาอย่างน้อย 1 วัน',true);const body={scope_type:$('#scheduleScopeType').value,scope_id:Number($('#scheduleScopeId').value||0),rules:weekdays.map(weekday=>({weekday,is_workday:$('#scheduleIsWorkday').checked,start_time:$('#scheduleStart').value,end_time:$('#scheduleEnd').value,late_grace_minutes:Number($('#scheduleGrace').value||0)}))};const b=$('#scheduleSaveBtn');b.disabled=true;try{await api('/api/work-schedules',{method:'PUT',body:JSON.stringify(body)});$('#scheduleModal').close();await loadAll({silent:true});toast('บันทึกเวลาทำงานแล้ว');}catch(e){toast(e.message,true);}finally{b.disabled=false;}}
function openHolidayModal(){ $('#holidayDate').value='';$('#holidayName').value='';$('#holidayType').value='traditional';$('#holidayPaid').checked=true;$('#holidayNotes').value='';$('#holidayModal').showModal(); }
async function saveHoliday(){const body={holiday_date:$('#holidayDate').value,name:$('#holidayName').value.trim(),holiday_type:$('#holidayType').value,is_paid:$('#holidayPaid').checked,notes:$('#holidayNotes').value.trim()};const b=$('#holidaySaveBtn');b.disabled=true;try{await api('/api/company-holidays',{method:'POST',body:JSON.stringify(body)});$('#holidayModal').close();await loadAll({silent:true});toast('เพิ่มวันหยุดบริษัทแล้ว');}catch(e){toast(e.message,true);}finally{b.disabled=false;}}
window.deleteHoliday=async id=>{if(!confirm('ลบวันหยุดนี้ใช่ไหม?'))return;try{await api(`/api/company-holidays/${id}`,{method:'DELETE'});await loadAll({silent:true});toast('ลบวันหยุดแล้ว');}catch(e){toast(e.message,true);}};
async function saveAttendancePolicy(){const toggle=$('#attendancePolicyToggle');toggle.disabled=true;try{const result=await api('/api/attendance-policy',{method:'PATCH',body:JSON.stringify({allow_checkout_outside_geofence:toggle.checked})});state.peopleCore.attendance_policy={allow_checkout_outside_geofence:result.allow_checkout_outside_geofence};toast(toggle.checked?'อนุญาตให้ออกงานนอกพื้นที่แล้ว':'บังคับ Check-out ในพื้นที่แล้ว');}catch(e){toggle.checked=!toggle.checked;toast(e.message,true);}finally{toggle.disabled=false;}}

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
  openModal('EMPLOYEE', 'เพิ่มพนักงานใหม่', 'กรอกข้อมูลพื้นฐาน แล้วเลือกแผนกและตำแหน่งได้ทันที ระบบจะผูกเข้ากับ Organization Chart อัตโนมัติ', [
    ['employee_code', 'รหัสพนักงาน (ไม่กรอก = สร้างอัตโนมัติ)', 'text'],
    ['nickname', 'ชื่อเล่น', 'text'],
    ['first_name', 'ชื่อ', 'text', true],
    ['last_name', 'นามสกุล', 'text', true],
    ['department_id', 'แผนก', 'select'],
    ['position_id', 'ตำแหน่ง', 'select'],
    ['email', 'อีเมล', 'email'],
    ['phone', 'เบอร์โทร', 'text'],
    ['birth_date', 'วันเกิด', 'date'],
    ['start_date', 'วันเริ่มงาน', 'date', true],
    ['probation_end_date', 'วันครบ Probation', 'date'],
    ['contract_end_date', 'วันสิ้นสุดสัญญา', 'date'],
  ], async data => {
    data.department_id = data.department_id || null;
    data.position_id = data.position_id || null;
    await api('/api/employees', { method: 'POST', body: JSON.stringify(data) });
    await loadAll({ silent: true });
  });
  const code = $('#field-employee_code');
  if (code) code.placeholder = 'เช่น NK-0001 · เว้นว่างได้';
  const start = $('#field-start_date');
  if (start && !start.value) start.value = localDateKey(new Date());
  const department = $('#field-department_id');
  const position = $('#field-position_id');
  const departments = state.peopleCore?.departments || state.lookups?.departments || [];
  const positions = state.peopleCore?.positions || state.lookups?.positions || [];
  if (department) {
    department.innerHTML = `<option value="">ยังไม่ระบุแผนก</option>${departments.map(d=>`<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('')}`;
  }
  const renderPositionOptions = () => {
    if (!position) return;
    const departmentId = Number(department?.value || 0);
    const filtered = positions.filter(x => !departmentId || !x.department_id || Number(x.department_id) === departmentId);
    position.innerHTML = `<option value="">ยังไม่ระบุตำแหน่ง</option>${filtered.map(x=>`<option value="${x.id}">${escapeHtml(x.name)}${x.department_name?` · ${escapeHtml(x.department_name)}`:''}</option>`).join('')}`;
  };
  if (department) department.onchange = renderPositionOptions;
  renderPositionOptions();
  if (!departments.length) {
    const hint = document.createElement('div');
    hint.className = 'modal-inline-hint full';
    hint.innerHTML = `<strong>ยังไม่มีแผนก</strong><span>ไปที่ ตั้งค่า → โครงสร้างองค์กร เพื่อสร้างแผนกและตำแหน่งก่อน หรือเพิ่มพนักงานโดยไม่ระบุก่อนได้</span>`;
    $('#modalFields')?.prepend(hint);
  }
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
  $('#modalSave').disabled = false;
  $('#modalSave').textContent = 'บันทึกข้อมูล';

  $('#modalFields').innerHTML = fields.map(([name, label, type, required]) => `
    <div class="field">
      <label for="field-${name}">${label}${required ? ' <em>*</em>' : ''}</label>
      ${type === 'select' ? `<select id="field-${name}" name="${name}" ${required ? 'required' : ''}></select>` : `<input id="field-${name}" name="${name}" type="${type}" ${required ? 'required' : ''} />`}
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

function formatLeaveDays(value) {
  const n = Number(value || 0);
  return `${n % 1 ? n.toFixed(1) : n.toFixed(0)} วัน`;
}
function localDateKey(date) {
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const get = type => parts.find(p=>p.type===type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

window.openLeaveProfile = (id) => openLeaveProfile(id);
async function openLeaveProfile(employeeId, keepOpen = false) {
  state.activeLeaveProfileEmployeeId = Number(employeeId);
  const year = Number($('#leaveProfileYear')?.value || new Date().getFullYear());
  try {
    const result = await api(`/api/employees/${employeeId}/leave-profile?year=${year}`);
    const employee = result.employee;
    $('#leaveProfileTitle').textContent = `สิทธิ์ลา · ${employee.nickname || employee.first_name}`;
    $('#leaveProfileSubtitle').textContent = `${employee.employee_code} · กำหนดผู้อนุมัติและสิทธิ์รายคน`;
    const years=[year-1,year,year+1];
    $('#leaveProfileYear').innerHTML=years.map(y=>`<option value="${y}" ${y===result.year?'selected':''}>${y+543}</option>`).join('');
    const leaveApproverIds=new Set((state.approverAccess||[]).filter(item=>(item.permissions||[]).includes('leave.approve')).map(item=>Number(item.id)));
    $('#leaveApproverSelect').innerHTML = `<option value="">ยังไม่กำหนด</option>${state.employees.filter(e=>Number(e.id)!==Number(employeeId) && (leaveApproverIds.has(Number(e.id)) || Number(e.id)===Number(employee.leave_approver_employee_id))).map(e=>`<option value="${e.id}" ${Number(e.id)===Number(employee.leave_approver_employee_id)?'selected':''}>${escapeHtml(e.nickname || e.first_name)}${e.department_name?` · ${escapeHtml(e.department_name)}`:''}${e.line_user_id?' · LINE✓':''} · ผู้อนุมัติ✓</option>`).join('')}`;
    $('#leaveAccessOverride').value = employee.leave_access_override == null ? '' : String(Number(employee.leave_access_override));
    $('#leaveEntitlementRows').innerHTML=result.balances.map(b=>`
      <div class="entitlement-row" data-policy-id="${b.id}">
        <div class="entitlement-name"><strong>${escapeHtml(b.name)}</strong><small>${Number(b.is_unlimited)?'ไม่จำกัดสิทธิ์':`ใช้แล้ว ${formatLeaveDays(b.used_days)} · รอ ${formatLeaveDays(b.pending_days)}`}</small></div>
        <div class="entitlement-input"><label>สิทธิ์</label><input data-field="entitlement" type="number" step="0.5" min="0" value="${Number(b.entitlement_days)}" ${Number(b.is_unlimited)?'disabled':''}></div>
        <div class="entitlement-input"><label>ปรับเพิ่ม/ลด</label><input data-field="adjustment" type="number" step="0.5" value="${Number(b.adjustment_days)}" ${Number(b.is_unlimited)?'disabled':''}></div>
        <div class="entitlement-balance"><span>คงเหลือ</span><strong>${Number(b.is_unlimited)?'∞':formatLeaveDays(b.remaining_days)}</strong></div>
      </div>`).join('');
    if(!keepOpen) $('#leaveProfileModal').showModal();
  } catch(error){ toast(error.message,true); }
}

async function saveLeaveProfile() {
  const employeeId=state.activeLeaveProfileEmployeeId; if(!employeeId) return;
  const button=$('#leaveProfileSaveBtn'); button.disabled=true;
  try{
    const entitlements=$$('#leaveEntitlementRows .entitlement-row').map(row=>({policy_id:Number(row.dataset.policyId),entitlement_days:Number(row.querySelector('[data-field="entitlement"]')?.value||0),adjustment_days:Number(row.querySelector('[data-field="adjustment"]')?.value||0)}));
    const leaveAccessRaw=$('#leaveAccessOverride').value;
    await api(`/api/employees/${employeeId}/leave-profile`,{method:'PUT',body:JSON.stringify({year:Number($('#leaveProfileYear').value),leave_approver_employee_id:$('#leaveApproverSelect').value||null,leave_access_override:leaveAccessRaw===''?null:Number(leaveAccessRaw),entitlements})});
    $('#leaveProfileModal').close(); await loadAll({silent:true}); toast('บันทึกผู้อนุมัติและสิทธิ์ลาแล้ว');
  }catch(error){toast(error.message,true);}finally{button.disabled=false;}
}

function openLeaveRequestModal(){
  $('#leaveEmployeeSelect').innerHTML=state.employees.filter(e=>e.status==='active').map(e=>`<option value="${e.id}">${escapeHtml(e.nickname||e.first_name)} · ${escapeHtml(e.employee_code)}</option>`).join('');
  $('#leavePolicySelect').innerHTML=state.leavePolicies.filter(p=>Number(p.is_active)).map(p=>`<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  const today=localDateKey(new Date()); $('#leaveStartDate').value=today; $('#leaveEndDate').value=today; $('#leaveReason').value=''; $('#leaveDayPart').value='full';
  $('#leaveRequestModal').showModal();
}
async function saveLeaveRequest(){
  const button=$('#leaveRequestSaveBtn'); button.disabled=true;
  try{
    await api('/api/leaves',{method:'POST',body:JSON.stringify({employee_id:Number($('#leaveEmployeeSelect').value),policy_id:Number($('#leavePolicySelect').value),start_date:$('#leaveStartDate').value,end_date:$('#leaveEndDate').value,day_part:$('#leaveDayPart').value,reason:$('#leaveReason').value.trim()})});
    $('#leaveRequestModal').close(); await loadAll({silent:true}); toast('ส่งคำขอลาเข้าระบบแล้ว');
  }catch(error){toast(error.message,true);}finally{button.disabled=false;}
}

function renderLeavePolicies(){
  const root=$('#leavePolicyList'); if(!root) return;
  root.innerHTML=state.leavePolicies.length?state.leavePolicies.map(p=>`
    <article class="leave-policy-card ${Number(p.is_active)?'':'inactive'}">
      <div class="leave-policy-icon">${p.code==='sick'?'＋':p.code==='annual'?'☀':'◷'}</div>
      <div class="leave-policy-copy"><strong>${escapeHtml(p.name)}</strong><p>${Number(p.is_unlimited)?'ไม่จำกัดวัน':`${Number(p.default_entitlement_days)} วัน/ปี`} · ${Number(p.requires_reason)?'ต้องมีเหตุผล':'ไม่บังคับเหตุผล'}${p.evidence_required_after_days!=null?` · หลักฐานเมื่อ ≥ ${Number(p.evidence_required_after_days)} วัน`:''}${Number(p.available_during_probation)?' · ใช้ได้ช่วงทดลองงาน':' · หลังผ่านทดลองงาน'}</p></div>
      <span class="badge ${Number(p.is_active)?'badge-success':'badge-neutral'}">${Number(p.is_active)?'ใช้งาน':'ปิด'}</span>
      <button class="text-btn" onclick="window.editLeavePolicy(${p.id})">แก้ไข</button>
    </article>`).join(''):emptyState('ยังไม่มี Leave Policy','เพิ่มประเภทลาให้บริษัทก่อนกำหนดสิทธิ์พนักงาน');
}
window.editLeavePolicy=id=>openLeavePolicyModal(state.leavePolicies.find(p=>Number(p.id)===Number(id)));
function openLeavePolicyModal(policy=null){
  $('#leavePolicyForm').reset(); $('#leavePolicyId').value=policy?.id||''; $('#leavePolicyModalTitle').textContent=policy?'แก้ไขประเภทลา':'เพิ่มประเภทลา';
  $('#leavePolicyName').value=policy?.name||''; $('#leavePolicyCode').value=policy?.code||''; $('#leavePolicyCode').disabled=Boolean(policy);
  $('#leavePolicyDays').value=policy?.default_entitlement_days??0; $('#leavePolicyNotice').value=policy?.notice_days??0; $('#leavePolicyEvidence').value=policy?.evidence_required_after_days??'';
  $('#leavePolicyUnlimited').checked=Boolean(Number(policy?.is_unlimited||0)); $('#leavePolicyReason').checked=policy?Boolean(Number(policy.requires_reason)):true; $('#leavePolicyNegative').checked=Boolean(Number(policy?.allow_negative||0)); $('#leavePolicyProbation').checked=Boolean(Number(policy?.available_during_probation||0));
  $('#leavePolicyModal').showModal();
}
async function saveLeavePolicy(){
  const id=$('#leavePolicyId').value; const body={name:$('#leavePolicyName').value.trim(),code:$('#leavePolicyCode').value.trim(),default_entitlement_days:Number($('#leavePolicyDays').value||0),notice_days:Number($('#leavePolicyNotice').value||0),evidence_required_after_days:$('#leavePolicyEvidence').value===''?null:Number($('#leavePolicyEvidence').value),is_unlimited:$('#leavePolicyUnlimited').checked,requires_reason:$('#leavePolicyReason').checked,allow_negative:$('#leavePolicyNegative').checked,available_during_probation:$('#leavePolicyProbation').checked};
  if(body.name.length<2)return toast('กรุณาใส่ชื่อประเภทลา',true); const button=$('#leavePolicySaveBtn');button.disabled=true;
  try{await api(id?`/api/leave-policies/${id}`:'/api/leave-policies',{method:id?'PATCH':'POST',body:JSON.stringify(body)});$('#leavePolicyModal').close();await loadAll({silent:true});toast('บันทึก Leave Policy แล้ว');}catch(error){toast(error.message,true);}finally{button.disabled=false;}
}

function renderSettings() {
  $('#companyProfileShortcut')?.classList.toggle('disabled', !canManageCompanyProfile());
  if ($('#statusCompanyAction')) $('#statusCompanyAction').disabled = !canManageCompanyProfile();
  renderLineIntegration();
  renderGoogleWorkspace();
  renderSetupOverview();
  renderApproverAccess();
  renderSettingsHub();
  renderSettingsSidebar();
  if($('#probationLeaveLockToggle')) $('#probationLeaveLockToggle').checked = state.employeeService?.leave_settings?.lock_leave_during_probation !== false;
}

function renderSettingsHub() {
  const profile = state.companyProfile || state.dashboard?.client || activeCompany() || {};
  const core = state.peopleCore || {};
  const schedules = core.schedules || [];
  const holidays = core.holidays || [];
  const locations = state.workLocations || [];
  const leavePolicies = state.leavePolicies || [];
  const approvers = (state.approverAccess || []).filter(item => (item.permissions || []).length);
  const line = state.lineIntegration || {};
  const google = state.googleWorkspace || {};
  const payroll = state.payroll?.settings || {};
  const subscription = state.subscription || {};

  const companyReady = companyProfileCompleted(profile);
  const lineReady = Boolean(line.mode === 'dedicated' && line.connected);
  const googleReady = Boolean(google.connected);
  const essentials = [companyReady, schedules.length > 0 || Boolean(profile.work_start), locations.length > 0, leavePolicies.length > 0, googleReady];
  const readyCount = essentials.filter(Boolean).length;
  if ($('#settingsReadyBadge')) {
    $('#settingsReadyBadge').textContent = `${readyCount}/${essentials.length} พื้นฐานพร้อม`;
    $('#settingsReadyBadge').className = `badge ${readyCount === essentials.length ? 'badge-success' : readyCount ? 'badge-soft' : 'badge-neutral'}`;
  }
  if ($('#settingsCompanyMeta')) $('#settingsCompanyMeta').textContent = companyReady ? `${profile.name || 'บริษัท'} · ${(core.departments || []).length} แผนก` : 'ควรกรอกข้อมูลบริษัทให้ครบ';
  if ($('#settingsWorktimeMeta')) $('#settingsWorktimeMeta').textContent = schedules.length ? `${schedules.length} กติกาเวลาทำงาน` : `${profile.work_start || '09:00'}–${profile.work_end || '18:00'} ค่าเริ่มต้น`;
  if ($('#settingsAttendanceMeta')) $('#settingsAttendanceMeta').textContent = locations.length ? `${locations.filter(x => Number(x.is_active) !== 0).length} จุดเช็กอิน` : 'ยังไม่มีจุดเช็กอิน';
  if ($('#settingsLeaveMeta')) $('#settingsLeaveMeta').textContent = `${leavePolicies.length} ประเภทลา · ${holidays.length} วันหยุด`;
  if ($('#settingsApprovalMeta')) $('#settingsApprovalMeta').textContent = approvers.length ? `${approvers.length} คนมีสิทธิ์อนุมัติ` : 'ยังไม่ได้กำหนดผู้อนุมัติ';
  if ($('#settingsIntegrationMeta')) $('#settingsIntegrationMeta').textContent = `${lineReady ? 'LINE OA ✓' : 'LINE นากนะ'} · ${googleReady ? 'Google ✓' : 'Google ยังไม่เชื่อม'}`;
  if ($('#settingsPayrollMeta')) $('#settingsPayrollMeta').textContent = payroll.pay_day ? `จ่ายวันที่ ${payroll.pay_day} · ${Number(payroll.social_security_enabled ?? 1) ? 'SSO ✓' : 'SSO ปิด'}` : 'ใช้ค่ามาตรฐานก่อนตั้งค่า';
  if ($('#settingsBillingMeta')) $('#settingsBillingMeta').textContent = subscription.plan?.name || subscription.plan_name || (subscription.trial ? 'Free Trial' : 'ดูสถานะแพ็กเกจ');
  if ($('#settingsCompanyName')) $('#settingsCompanyName').textContent = profile.name || 'ข้อมูลบริษัท';
  if ($('#settingsCompanyProfileText')) $('#settingsCompanyProfileText').textContent = `${profile.work_start || '09:00'}–${profile.work_end || '18:00'} · ${profile.timezone || 'Asia/Bangkok'}`;
  if ($('#settingsPayrollDetail')) $('#settingsPayrollDetail').textContent = `วันจ่าย ${payroll.pay_day || 28} · ภาษี ${Number(payroll.tax_enabled ?? 1) ? 'เปิด' : 'ปิด'} · ประกันสังคม ${Number(payroll.social_security_enabled ?? 1) ? 'เปิด' : 'ปิด'}`;
}

function renderGoogleWorkspace() {
  const data=state.googleWorkspace||{connected:false};
  const connected=Boolean(data.connected);
  const info=data.integration||{};
  const canManage=canManageGoogleWorkspace();
  const canSendGmail=String(info.scopes||'').includes('gmail.send');
  const needsPayrollMail=connected&&!canSendGmail;
  $('#googleWorkspaceTitle').textContent=connected?`Google · ${info.email||''}`:'Google';
  $('#googleWorkspaceText').textContent=connected?(needsPayrollMail?'Drive/Sheets พร้อมแล้ว · เพิ่มสิทธิ์ Gmail Send เพื่อส่ง Payslip ทางอีเมล':'Gmail, Drive, HR Database Sheet และ Payslip Email พร้อมใช้งาน'):'เชื่อมบัญชี Google ของบริษัทเพื่อใช้ Gmail, Drive และ Google Sheets';
  $('#googleWorkspaceBadge').className=`badge ${connected?'badge-success':'badge-neutral'}`;
  $('#googleWorkspaceBadge').textContent=connected?'เชื่อมแล้ว':'ยังไม่เชื่อม';
  $('#googleWorkspaceConnectBtn').classList.toggle('hidden',(connected&&!needsPayrollMail)||!canManage);
  $('#googleWorkspaceConnectBtn').textContent=needsPayrollMail?'เพิ่มสิทธิ์ส่ง Gmail':'เชื่อม Google';
  $('#googleWorkspaceSyncBtn').classList.toggle('hidden',!connected||!canManage);
  $('#googleWorkspaceDisconnectBtn').classList.toggle('hidden',!connected||!canManage);
  $('#googleWorkspaceDriveBtn').classList.toggle('hidden',!connected||!info.drive_url);
  $('#googleWorkspaceSheetBtn').classList.toggle('hidden',!connected||!info.spreadsheet_url);
  if(info.drive_url)$('#googleWorkspaceDriveBtn').href=info.drive_url;
  if(info.spreadsheet_url)$('#googleWorkspaceSheetBtn').href=info.spreadsheet_url;
  const meta=$('#googleWorkspaceMeta');const pills=$('#googleServicePills');
  meta.classList.toggle('hidden',!connected);pills.classList.toggle('hidden',!connected);
  pills.innerHTML=connected?`<span class="service-pill">Gmail Read</span><span class="service-pill ${canSendGmail?'':'service-pill-warning'}">${canSendGmail?'Gmail Send ✓':'Gmail Send ต้องเพิ่มสิทธิ์'}</span><span class="service-pill">Drive</span><span class="service-pill">Sheets</span>`:'';
  meta.innerHTML=connected?`<span><b>บัญชี</b> ${escapeHtml(info.email||'—')}</span><span><b>Sync ล่าสุด</b> ${info.last_sync_at?escapeHtml(formatDateTime(info.last_sync_at)):'ยังไม่เคย Sync'}</span>${info.last_error?`<span class="integration-error"><b>ล่าสุด</b> ${escapeHtml(info.last_error)}</span>`:''}`:'';
}

function renderSetupOverview(){
  const profile=state.companyProfile||state.dashboard?.client||activeCompany()||{};const line=state.lineIntegration||{};const google=state.googleWorkspace||{};
  const companyReady=companyProfileCompleted(profile);const lineReady=Boolean(line.mode==='dedicated'&&line.connected);const googleReady=Boolean(google.connected&&google.integration?.drive_folder_id&&google.integration?.spreadsheet_id);
  const ready=[companyReady,lineReady,googleReady].filter(Boolean).length;$('#setupOverviewBadge').textContent=`${ready}/3 พร้อมใช้งาน`;$('#setupOverviewBadge').className=`badge ${ready===3?'badge-success':ready?'badge-soft':'badge-neutral'}`;$('#setupProgressBar').style.width=`${ready/3*100}%`;
  $('#statusCompanyBadge').className=`badge ${companyReady?'badge-success':'badge-warning'}`;$('#statusCompanyBadge').textContent=companyReady?'พร้อมใช้งาน':'ควรตรวจ';$('#statusCompanyText').textContent=companyReady?`${profile.name} · ${profile.work_start}–${profile.work_end} · ${profile.timezone}`:'ใส่ชื่อบริษัท เวลาเข้างาน และเวลาสิ้นสุดงานให้ครบ';
  const dedicated=line.mode==='dedicated'&&line.connected;$('#statusLineBadge').className=`badge ${dedicated?'badge-success':line.default_available?'badge-soft':'badge-warning'}`;$('#statusLineBadge').textContent=dedicated?'เชื่อมธุรกิจแล้ว':line.default_available?'ใช้นากนะกลาง':'ยังไม่เชื่อม';$('#statusLineText').textContent=dedicated?`${line.integration?.bot_display_name||'LINE OA บริษัท'} เชื่อมกับ Workspace แล้ว`:line.default_available?'ตอนนี้ใช้ LINE “นากนะ” กลางอยู่ เชื่อม OA บริษัทได้เมื่อพร้อม':'ยังไม่มี LINE สำหรับ Workspace นี้';$('#statusLineAction').disabled=!canManageGoogleWorkspace();$('#statusLineAction').textContent=dedicated?'แก้การเชื่อมต่อ':'ตั้งค่า LINE OA';
  $('#statusGoogleBadge').className=`badge ${googleReady?'badge-success':'badge-neutral'}`;$('#statusGoogleBadge').textContent=googleReady?'เชื่อมแล้ว':'ยังไม่เชื่อม';$('#statusGoogleText').textContent=googleReady?`${google.integration?.email||'Google'} · Gmail ✓ Drive ✓ Sheets ✓`:'เชื่อมครั้งเดียวเพื่อเปิด Gmail, Drive และ HR Database Sheet';$('#statusGoogleAction').disabled=!canManageGoogleWorkspace();$('#statusGoogleAction').textContent=googleReady?'ดู Google':'เชื่อม Google';
  $('#statusGoogleAction').onclick=googleReady?()=>document.querySelector('#googleWorkspaceSection')?.scrollIntoView({behavior:'smooth'}):connectGoogleWorkspace;
}

function renderApproverAccess() {
  const section = $('#approverAccessSection');
  if (!section) return;
  const canManage = ['owner','hr_admin','hr'].includes(String(activeCompanyRole() || ''));
  section.classList.toggle('hidden', !canManage);
  if (!canManage) return;
  const granted = (state.approverAccess || []).filter(item => (item.permissions || []).length);
  $('#approverAccessCount').textContent = `${granted.length} คน`;
  $('#approverAccessList').innerHTML = granted.length ? granted.map(item => {
    const labels=(item.permissions||[]).map(key=>state.approverPermissionCatalog.find(x=>x.key===key)?.label||key);
    return `<article class="approver-access-row">
      <div class="employee-cell"><span class="avatar ${item.line_picture_url?'photo':''}" ${item.line_picture_url?`style="background-image:url('${escapeHtml(item.line_picture_url)}')"`:''}>${item.line_picture_url?'':initial(item)}</span><div><strong>${escapeHtml(item.nickname||item.first_name)} ${escapeHtml(item.last_name||'')}</strong><small>${escapeHtml(item.department_name||'ไม่ระบุทีม')} · ${item.line_user_id?'LINE เชื่อมแล้ว':'ยังไม่เชื่อม LINE'}</small></div></div>
      <div class="permission-chip-list">${labels.map(label=>`<span class="permission-chip">${escapeHtml(label)}</span>`).join('')}</div>
      <button class="text-btn" type="button" onclick="window.editApproverAccess(${Number(item.id)})">แก้สิทธิ์</button>
    </article>`;
  }).join('') : emptyState('ยังไม่มีผู้อนุมัติ','เพิ่มสิทธิ์ให้พนักงานที่ต้องอนุมัติการลา หรือ Flow อื่น ๆ');
}

window.editApproverAccess = id => openApproverAccessModal(Number(id));
function openApproverAccessModal(employeeId=null){
  const available=(state.approverAccess||[]);
  if(!available.length) return toast('ยังไม่มีข้อมูลพนักงานสำหรับกำหนดสิทธิ์',true);
  state.activeApproverEmployeeId=employeeId || Number(available[0]?.id||0);
  $('#approverEmployeeSelect').innerHTML=available.map(emp=>`<option value="${emp.id}" ${Number(emp.id)===Number(state.activeApproverEmployeeId)?'selected':''}>${escapeHtml(emp.nickname||emp.first_name)}${emp.department_name?` · ${escapeHtml(emp.department_name)}`:''}${emp.line_user_id?' · LINE✓':''}</option>`).join('');
  $('#approverEmployeeSelect').onchange=()=>{state.activeApproverEmployeeId=Number($('#approverEmployeeSelect').value);fillApproverPermissionChecks();};
  fillApproverPermissionChecks();
  $('#approverAccessModal').showModal();
}
function applyApproverRolePreset(){
  const preset=$('#approverRolePreset').value;
  const presets={
    leave_approver:['leave.approve','team.read'],
    team_manager:['leave.approve','attendance.approve','hr_request.approve','team.read'],
    full_approver:['leave.approve','attendance.approve','ot.approve','hr_request.approve','team.read']
  };
  if(preset==='custom') return;
  const wanted=new Set(presets[preset]||[]);
  $$('#approverPermissionChecks input[type="checkbox"]').forEach(input=>{input.checked=wanted.has(input.value);});
}

function fillApproverPermissionChecks(){
  const row=(state.approverAccess||[]).find(item=>Number(item.id)===Number(state.activeApproverEmployeeId));
  const current=new Set(row?.permissions||[]);
  $('#approverPermissionChecks').innerHTML=(state.approverPermissionCatalog||[]).map(item=>`<label class="permission-option"><input type="checkbox" value="${escapeHtml(item.key)}" ${current.has(item.key)?'checked':''}><span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.description||'')}</small></span></label>`).join('');
  const key=[...current].sort().join('|');
  const presetMap={
    ['leave.approve|team.read'.split('|').sort().join('|')]:'leave_approver',
    ['attendance.approve|hr_request.approve|leave.approve|team.read'.split('|').sort().join('|')]:'team_manager',
    ['attendance.approve|hr_request.approve|leave.approve|ot.approve|team.read'.split('|').sort().join('|')]:'full_approver'
  };
  $('#approverRolePreset').value=presetMap[key]||'custom';
  $('#approverLineHint').textContent=row?.line_user_id?'LINE เชื่อมแล้ว · สิทธิ์อนุมัติการลาจะใช้ผ่าน LINE ได้ทันที':'ยังไม่เชื่อม LINE · ตั้งสิทธิ์ไว้ก่อนได้ แต่การอนุมัติผ่าน LINE ต้องเชื่อมบัญชีก่อน';
}
async function saveApproverAccess(){
  const employeeId=Number($('#approverEmployeeSelect').value||state.activeApproverEmployeeId); if(!employeeId)return;
  const permissions=$$('#approverPermissionChecks input:checked').map(input=>input.value);
  const button=$('#approverAccessSaveBtn');button.disabled=true;
  try{
    await api(`/api/approver-access/${employeeId}`,{method:'PUT',body:JSON.stringify({permissions})});
    $('#approverAccessModal').close();await loadAll({silent:true});toast('บันทึกสิทธิ์ผู้อนุมัติแล้ว');
  }catch(error){toast(error.message,true);}finally{button.disabled=false;}
}

function renderLineIntegration() {
  const data = state.lineIntegration || { mode: 'nakna_default', connected: false };
  const dedicated = data.mode === 'dedicated' && data.connected;
  const info = data.integration || {};
  const title = $('#lineCompanyTitle');
  const text = $('#lineCompanyText');
  const badge = $('#lineCompanyBadge');
  const logo = $('#lineCompanyLogo');
  const meta = $('#lineIntegrationMeta');

  const canManage = ['owner','hr_admin'].includes(String(activeCompanyRole() || ''));
  if (dedicated) {
    $('#sidebarLineTitle').textContent = info.bot_display_name || 'LINE OA บริษัท';
    $('#sidebarLineText').textContent = info.webhook_active ? 'เชื่อมกับ Workspace แล้ว' : 'รอเปิด Use webhook';
    title.textContent = info.bot_display_name || 'LINE OA ของบริษัท';
    text.textContent = info.webhook_active
      ? 'เชื่อมกับ Workspace นี้แล้ว และ LINE เปิดใช้งาน Webhook อยู่'
      : 'เชื่อม OA แล้ว แต่ LINE ยังไม่ได้เปิด Use webhook';
    badge.className = `badge ${info.webhook_active ? 'badge-success' : 'badge-warning'}`;
    badge.textContent = info.webhook_active ? 'พร้อมใช้งาน' : 'รอเปิด Webhook';
    logo.textContent = 'LINE';
    meta.classList.remove('hidden');
    meta.innerHTML = `
      <span><b>Basic ID</b> ${escapeHtml(info.bot_basic_id || '—')}</span>
      <span><b>Webhook</b> <button type="button" class="inline-copy-btn" onclick="window.copyWorkspaceWebhook()">คัดลอก URL</button></span>
      ${info.last_test_at ? `<span><b>ทดสอบล่าสุด</b> ${escapeHtml(formatDateTime(info.last_test_at))}</span>` : ''}`;
    $('#lineConfigureBtn').textContent = 'แก้การเชื่อมต่อ';
    $('#lineTestBtn').classList.remove('hidden');
    $('#lineDisconnectBtn').classList.remove('hidden');
  } else {
    $('#sidebarLineTitle').textContent = data.default_available ? 'LINE นากนะ' : 'ยังไม่เชื่อม LINE';
    $('#sidebarLineText').textContent = data.default_available ? 'Nakna Default' : 'ตั้งค่าที่เมนูระบบ';
    title.textContent = data.bot?.display_name ? `ใช้ ${data.bot.display_name}` : 'LINE นากนะ';
    text.textContent = data.default_available
      ? 'ตอนนี้ Workspace ใช้ LINE “นากนะ” กลาง พนักงานใช้งานได้ทันที'
      : 'ยังไม่มี LINE OA สำหรับ Workspace นี้';
    badge.className = `badge ${data.default_available ? 'badge-soft' : 'badge-neutral'}`;
    badge.textContent = data.default_available ? 'Nakna Default' : 'ยังไม่เชื่อม';
    meta.classList.add('hidden');
    meta.innerHTML = '';
    $('#lineConfigureBtn').textContent = 'เชื่อม LINE OA บริษัท';
    $('#lineTestBtn').classList.add('hidden');
    $('#lineDisconnectBtn').classList.add('hidden');
  }
  $('#lineConfigureBtn').classList.toggle('hidden', !canManage);
  if (!canManage) { $('#lineTestBtn').classList.add('hidden'); $('#lineDisconnectBtn').classList.add('hidden'); }
}

function openLineIntegrationModal() {
  const data = state.lineIntegration || {};
  const info = data.integration || {};
  $('#lineIntegrationForm').reset();
  $('#lineChannelId').value = info.channel_id || '';
  $('#lineChannelSecret').value = '';
  $('#lineAccessToken').value = '';
  $('#lineWebhookPreview').value = info.webhook_url || 'ระบบจะสร้างหลังเชื่อม';
  $('#lineIntegrationSaveBtn').textContent = data.mode === 'dedicated' ? 'อัปเดตการเชื่อมต่อ' : 'เชื่อมและตั้ง Webhook';
  $('#lineIntegrationModal').showModal();
}

async function saveLineIntegration() {
  const channel_secret = $('#lineChannelSecret').value.trim();
  const access_token = $('#lineAccessToken').value.trim();
  const channel_id = $('#lineChannelId').value.trim();
  if (channel_secret.length < 16 || access_token.length < 20) return toast('กรุณาใส่ Channel Secret และ Channel Access Token ให้ครบ', true);
  const button = $('#lineIntegrationSaveBtn');
  button.disabled = true;
  button.textContent = 'กำลังเชื่อม LINE…';
  try {
    const result = await api('/api/integrations/line', { method: 'PUT', body: JSON.stringify({ channel_id, channel_secret, access_token }) });
    state.lineIntegration = { mode: 'dedicated', connected: true, integration: result.integration };
    $('#lineWebhookPreview').value = result.integration?.webhook_url || '';
    $('#lineIntegrationModal').close();
    renderLineIntegration();
    toast('เชื่อม LINE Official Account เรียบร้อยแล้ว');
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = 'เชื่อมและตั้ง Webhook';
  }
}

async function testLineIntegration() {
  const button = $('#lineTestBtn');
  button.disabled = true;
  button.textContent = 'กำลังทดสอบ…';
  try {
    const result = await api('/api/integrations/line/test', { method: 'POST', body: '{}' });
    if (result.ok) toast('Webhook ของ LINE รับข้อมูลจากนากนะได้แล้ว');
    else toast(`Webhook ยังไม่พร้อม: ${result.webhook?.test?.reason || 'กรุณาตรวจ Use webhook'}`, true);
    state.lineIntegration = await api('/api/integrations/line');
    renderLineIntegration();
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = 'ทดสอบ';
  }
}

async function disconnectLineIntegration() {
  if (!confirm('ยกเลิก LINE OA ของบริษัทนี้? หลังยกเลิก Invite ใหม่จะกลับไปใช้ LINE นากนะกลาง')) return;
  const button = $('#lineDisconnectBtn');
  button.disabled = true;
  try {
    await api('/api/integrations/line', { method: 'DELETE' });
    state.lineIntegration = await api('/api/integrations/line');
    renderLineIntegration();
    toast('ยกเลิก LINE OA ของบริษัทแล้ว');
  } catch (error) {
    toast(error.message, true);
  } finally { button.disabled = false; }
}

function copyLineWebhookFromModal() {
  const value = $('#lineWebhookPreview').value;
  if (!value || value.startsWith('ระบบจะ')) return toast('เชื่อม LINE OA ก่อน ระบบจึงจะสร้าง Webhook URL', true);
  copyText(value);
}

window.copyWorkspaceWebhook = () => {
  const value = state.lineIntegration?.integration?.webhook_url;
  if (value) copyText(value);
};

function copyText(value) {
  navigator.clipboard?.writeText(value).then(() => toast('คัดลอกแล้ว')).catch(() => {
    const area = document.createElement('textarea'); area.value = value; document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove(); toast('คัดลอกแล้ว');
  });
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
  if (item.status === 'leave') return `<span class="badge badge-info">🏖 ${escapeHtml(item.leave_name || 'ลา')}</span>`;
  if (!item.check_in_at) return '<span class="badge badge-neutral">ยังไม่เช็กอิน</span>';
  if (item.status === 'late') return `<span class="badge badge-warning"><span class="status-dot"></span> สาย ${Number(item.late_minutes || 0)} นาที</span>`;
  return '<span class="badge badge-success"><span class="status-dot"></span> ตรงเวลา</span>';
}

function statusBadge(status) {
  const config = {
    approved: ['badge-success', 'อนุมัติแล้ว'],
    rejected: ['badge-danger', 'ไม่อนุมัติ'],
    pending: ['badge-warning', 'รออนุมัติ'],
    awaiting_evidence: ['badge-coral', 'รอหลักฐาน'],
    received: ['badge-info', 'รับเรื่องแล้ว'],
    processing: ['badge-warning', 'กำลังดำเนินการ'],
  };
  const [className, label] = config[status] || ['badge-neutral', status];
  return `<span class="badge ${className}">${escapeHtml(label)}</span>`;
}

function requestTypeLabel(type) {
  return ({ document: 'เอกสาร', payroll: 'เงินเดือน', profile: 'ข้อมูลพนักงาน', benefit: 'สวัสดิการ', equipment: 'อุปกรณ์' })[type] || type || 'คำขอทั่วไป';
}

function payrollStatusLabel(status){return ({draft:'Draft',review:'รอตรวจ',locked:'Lock แล้ว',published:'ส่งแล้ว',void:'ยกเลิก'})[status]||status||'—';}
function payrollStatusClass(status){return status==='published'?'badge-success':status==='locked'?'badge-soft':status==='review'?'badge-warning':'badge-neutral';}

function renderPayroll(){
  const root=$('#payrollSummary'); if(!root)return; const data=state.payroll;
  if(!data){root.innerHTML='<div class="payroll-locked">Payroll แสดงเฉพาะ Owner / HR Admin / HR</div>';$('#payrollPeriods').innerHTML='';$('#payrollSettingsBtn').classList.add('hidden');$('#createPayrollPeriodBtn').classList.add('hidden');return;}
  $('#payrollSettingsBtn').classList.remove('hidden');$('#createPayrollPeriodBtn').classList.remove('hidden');
  const periods=data.periods||[]; const latest=periods[0]; const ready=data.readiness||{};
  root.innerHTML=[
    ['รอบล่าสุด',latest?latest.period_key:'ยังไม่มี','calendar'],
    ['Gross',latest?money(latest.gross_total):money(0),'brand'],
    ['รายการหัก',latest?money(latest.deduction_total):money(0),'warning'],
    ['รับสุทธิ',latest?money(latest.net_total):money(0),'success'],
    ['ตั้งเงินเดือนแล้ว',`${ready.salary_ready||0}/${ready.employees||0} คน`,'info'],
  ].map(([label,value,tone])=>`<div class="payroll-summary-card ${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
  $('#payrollReadyBadge').className=`badge ${(ready.salary_ready||0)===(ready.employees||0)&&ready.employees?'badge-success':'badge-warning'}`;
  $('#payrollReadyBadge').textContent=`เงินเดือน ${ready.salary_ready||0}/${ready.employees||0}`;
  $('#payrollPeriods').innerHTML=periods.length?periods.map(p=>`<button type="button" class="payroll-period-row ${Number(state.activePayrollPeriodId)===Number(p.id)?'active':''}" onclick="window.openPayrollPeriod(${p.id})"><span><strong>${escapeHtml(p.period_key)}</strong><small>จ่าย ${formatDate(p.pay_date)} · ${Number(p.employee_count||0)} คน</small></span><span><b>${money(p.net_total)}</b><em class="badge ${payrollStatusClass(p.status)}">${payrollStatusLabel(p.status)}</em></span></button>`).join(''):emptyState('ยังไม่มีรอบเงินเดือน','เริ่มจากตั้งเงินเดือนพนักงาน แล้วสร้างรอบเงินเดือนเดือนแรก');
  if(state.payrollDetail?.period && Number(state.payrollDetail.period.id)===Number(state.activePayrollPeriodId))renderPayrollDetail();
  else if(!state.activePayrollPeriodId&&periods.length){state.activePayrollPeriodId=Number(periods[0].id);loadPayrollPeriod(state.activePayrollPeriodId);}
  else if(!periods.length)renderPayrollSetupList();
}

function renderPayrollSetupList(){
  const profiles=state.payroll?.profiles||[]; $('#payrollDetail').innerHTML=`<div class="panel-head embedded-head"><div><p class="kicker">SALARY SETUP</p><h3>ตั้งข้อมูลเงินเดือนก่อนเริ่มรอบแรก</h3></div></div><div class="salary-setup-list">${profiles.length?profiles.map(e=>`<button type="button" class="salary-setup-row" onclick="window.openPayrollProfile(${e.id})"><span><strong>${escapeHtml(e.nickname||e.first_name)} · ${escapeHtml(e.employee_code)}</strong><small>${escapeHtml(e.department_name||'ยังไม่ระบุแผนก')}</small></span><span><b>${Number(e.base_salary||0)>0?money(e.base_salary):'ยังไม่ตั้ง'}</b><em>${e.bank_account_no?'บัญชีพร้อม':'ยังไม่มีบัญชี'}</em></span></button>`).join(''):emptyState('ยังไม่มีพนักงาน','เพิ่มพนักงานก่อนตั้ง Payroll')}</div>`;
}

window.openPayrollPeriod=id=>loadPayrollPeriod(Number(id));
async function loadPayrollPeriod(id){state.activePayrollPeriodId=Number(id);try{state.payrollDetail=await api(`/api/payroll/periods/${id}`);renderPayroll();renderPayrollDetail();}catch(error){toast(error.message,true);}}

function renderPayrollDetail(){
  const detail=state.payrollDetail; if(!detail?.period)return; const p=detail.period; const editable=['draft','review'].includes(p.status); const documents=detail.documents||[];
  const actions=[]; if(editable){actions.push(`<button class="secondary-btn" type="button" onclick="window.recalculatePayroll(${p.id})">คำนวณใหม่</button>`,`<button class="secondary-btn" type="button" onclick="window.openPayrollAdjustment(${p.id})">+ เพิ่ม/หัก</button>`);if(p.status==='draft')actions.push(`<button class="secondary-btn" type="button" onclick="window.reviewPayroll(${p.id})">ส่งตรวจ</button>`);actions.push(`<button class="primary-btn" type="button" onclick="window.lockPayroll(${p.id})">Lock รอบ</button>`);} if(p.status==='locked')actions.push(`<button class="primary-btn" type="button" onclick="window.publishPayroll(${p.id})">Publish Payslip</button>`);
  $('#payrollDetail').innerHTML=`<div class="payroll-detail-head"><div><p class="kicker">${escapeHtml(p.period_key)}</p><h2>Payroll ${escapeHtml(p.period_key)}</h2><div class="payroll-status-line"><span class="badge ${payrollStatusClass(p.status)}">${payrollStatusLabel(p.status)}</span><small>จ่าย ${formatDate(p.pay_date)}${p.locked_at?` · Lock ${formatDateTime(p.locked_at)}`:''}</small></div></div><div class="page-actions">${actions.join('')}</div></div>
    <div class="payroll-detail-totals"><div><span>Gross</span><strong>${money(p.gross_total)}</strong></div><div><span>หักรวม</span><strong>${money(p.deduction_total)}</strong></div><div class="net"><span>Net Payroll</span><strong>${money(p.net_total)}</strong></div></div>
    <div class="payroll-table-wrap"><table class="payroll-table"><thead><tr><th>พนักงาน</th><th>เงินเดือน</th><th>เพิ่ม</th><th>ขาด/สาย</th><th>SSO</th><th>ภาษี</th><th>รับสุทธิ</th><th></th></tr></thead><tbody>${(detail.items||[]).map(item=>{const adds=Number(item.overtime||0)+Number(item.commission||0)+Number(item.incentive||0)+Number(item.allowance||0)+Number(item.bonus||0)+Number(item.other_earnings||0);return `<tr><td><strong>${escapeHtml(item.nickname||item.first_name)}</strong><small>${escapeHtml(item.employee_code)} · ${escapeHtml(item.department_name||'-')}</small></td><td>${money(item.prorated_salary)}${Number(item.base_salary)!==Number(item.prorated_salary)?`<small>ฐาน ${money(item.base_salary)}</small>`:''}</td><td>${adds?money(adds):'—'}</td><td>${Number(item.attendance_deduction)?money(item.attendance_deduction):'—'}<small>${Number(item.absent_days||0)} วัน · ${Number(item.late_minutes||0)} นาที</small></td><td>${money(item.social_security)}</td><td>${money(item.withholding_tax)}</td><td class="net-cell"><strong>${money(item.net_pay)}</strong></td><td><button class="text-btn" onclick="window.openPayrollProfile(${item.employee_id})">เงินเดือน</button></td></tr>`}).join('')}</tbody></table></div>
    <div class="payroll-footnote"><span>ภาษีเป็นประมาณการแบบ annualized จากข้อมูลที่มีใน Nakna และค่าลดหย่อนที่ HR ระบุ ต้องตรวจสอบก่อน Lock</span><span>${documents.length?`สร้าง Payslip แล้ว ${documents.length} ใบ`:''}</span></div>`;
}

function openPayrollSettingsModal(){const s=state.payroll?.settings||{};$('#payrollPayDay').value=s.pay_day||28;$('#payrollDailyDivisor').value=s.daily_rate_divisor||30;$('#payrollSsoEnabled').checked=Boolean(Number(s.social_security_enabled??1));$('#payrollTaxEnabled').checked=Boolean(Number(s.tax_enabled??1));$('#payrollAbsenceDeduction').checked=Boolean(Number(s.absence_deduction_enabled||0));$('#payrollLateDeduction').checked=Boolean(Number(s.late_deduction_enabled||0));$('#payrollLatePerMinute').value=s.late_deduction_per_minute||0;$('#payrollSettingsModal').showModal();}
async function savePayrollSettings(){const button=$('#payrollSettingsSaveBtn');button.disabled=true;try{await api('/api/payroll/settings',{method:'PATCH',body:JSON.stringify({pay_day:Number($('#payrollPayDay').value),daily_rate_divisor:Number($('#payrollDailyDivisor').value),social_security_enabled:$('#payrollSsoEnabled').checked,tax_enabled:$('#payrollTaxEnabled').checked,absence_deduction_enabled:$('#payrollAbsenceDeduction').checked,late_deduction_enabled:$('#payrollLateDeduction').checked,late_deduction_per_minute:Number($('#payrollLatePerMinute').value||0)})});$('#payrollSettingsModal').close();await refreshPayroll();toast('บันทึก Payroll Settings แล้ว');}catch(e){toast(e.message,true)}finally{button.disabled=false;}}

function openPayrollPeriodModal(){const now=new Date();const key=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;$('#payrollPeriodKey').value=key;setPayrollPayDateFromMonth();$('#payrollPeriodKey').onchange=setPayrollPayDateFromMonth;$('#payrollPeriodModal').showModal();}
function setPayrollPayDateFromMonth(){const key=$('#payrollPeriodKey').value;if(!key)return;const [y,m]=key.split('-').map(Number);const last=new Date(y,m,0).getDate();const day=Math.min(last,Number(state.payroll?.settings?.pay_day||28));$('#payrollPayDate').value=`${key}-${String(day).padStart(2,'0')}`;}
async function createPayrollPeriod(){const button=$('#payrollPeriodCreateBtn');button.disabled=true;button.textContent='กำลังคำนวณ…';try{const result=await api('/api/payroll/periods',{method:'POST',body:JSON.stringify({period_key:$('#payrollPeriodKey').value,pay_date:$('#payrollPayDate').value})});$('#payrollPeriodModal').close();state.activePayrollPeriodId=result.id;await refreshPayroll();await loadPayrollPeriod(result.id);toast('สร้าง Payroll Preview แล้ว');}catch(e){toast(e.message,true)}finally{button.disabled=false;button.textContent='สร้างและคำนวณ Preview';}}

window.openPayrollProfile=async id=>{try{const result=await api(`/api/employees/${id}/payroll-profile`);const p=result.profile||{};const e=result.employee;$('#payrollProfileEmployeeId').value=id;$('#payrollProfileTitle').textContent=`เงินเดือน · ${e.nickname||e.first_name}`;$('#payrollBaseSalary').value=p.base_salary??0;$('#payrollEffectiveFrom').value=p.effective_from||localDateKey(new Date());$('#employeeSsoEnabled').checked=p.social_security_enabled==null?true:Boolean(Number(p.social_security_enabled));$('#employeeTaxEnabled').checked=p.tax_enabled==null?true:Boolean(Number(p.tax_enabled));$('#employeePersonalAllowance').value=p.personal_allowance??60000;$('#employeeExtraDeductions').value=p.extra_annual_deductions??0;$('#employeeTaxOverride').value=p.monthly_tax_override??'';$('#employeeBankName').value=p.bank_name||'';$('#employeeBankAccountName').value=p.bank_account_name||'';$('#employeeBankAccountNo').value=p.bank_account_no||'';$('#employeePayrollNote').value=p.payroll_note||'';$('#payrollProfileModal').showModal();}catch(e){toast(e.message,true)}};
async function savePayrollProfile(){const id=Number($('#payrollProfileEmployeeId').value);const button=$('#payrollProfileSaveBtn');button.disabled=true;try{await api(`/api/employees/${id}/payroll-profile`,{method:'PUT',body:JSON.stringify({base_salary:Number($('#payrollBaseSalary').value||0),effective_from:$('#payrollEffectiveFrom').value,social_security_enabled:$('#employeeSsoEnabled').checked,tax_enabled:$('#employeeTaxEnabled').checked,personal_allowance:Number($('#employeePersonalAllowance').value||0),extra_annual_deductions:Number($('#employeeExtraDeductions').value||0),monthly_tax_override:$('#employeeTaxOverride').value,bank_name:$('#employeeBankName').value.trim(),bank_account_name:$('#employeeBankAccountName').value.trim(),bank_account_no:$('#employeeBankAccountNo').value.trim(),payroll_note:$('#employeePayrollNote').value.trim()})});$('#payrollProfileModal').close();await refreshPayroll();if(state.activePayrollPeriodId&&['draft','review'].includes(state.payrollDetail?.period?.status)){await api(`/api/payroll/periods/${state.activePayrollPeriodId}/recalculate`,{method:'POST',body:'{}'});await loadPayrollPeriod(state.activePayrollPeriodId);}toast('บันทึกข้อมูลเงินเดือนแล้ว');}catch(e){toast(e.message,true)}finally{button.disabled=false;}}

window.openPayrollAdjustment=periodId=>{const detail=state.payrollDetail;if(!detail?.items?.length)return toast('ยังไม่มีพนักงานในรอบนี้',true);$('#payrollAdjustmentPeriodId').value=periodId;$('#payrollAdjustmentEmployee').innerHTML=detail.items.map(i=>`<option value="${i.employee_id}">${escapeHtml(i.nickname||i.first_name)} · ${escapeHtml(i.employee_code)}</option>`).join('');$('#payrollAdjustmentType').value='earning';$('#payrollAdjustmentCategory').value='commission';$('#payrollAdjustmentAmount').value='';$('#payrollAdjustmentNote').value='';$('#payrollAdjustmentTaxable').checked=true;$('#payrollAdjustmentSso').checked=false;$('#payrollAdjustmentModal').showModal();};
async function savePayrollAdjustment(){const periodId=Number($('#payrollAdjustmentPeriodId').value);const button=$('#payrollAdjustmentSaveBtn');button.disabled=true;try{await api(`/api/payroll/periods/${periodId}/adjustments`,{method:'POST',body:JSON.stringify({employee_id:Number($('#payrollAdjustmentEmployee').value),adjustment_type:$('#payrollAdjustmentType').value,category:$('#payrollAdjustmentCategory').value,amount:Number($('#payrollAdjustmentAmount').value||0),note:$('#payrollAdjustmentNote').value.trim(),taxable:$('#payrollAdjustmentTaxable').checked,sso_contributable:$('#payrollAdjustmentSso').checked})});$('#payrollAdjustmentModal').close();await loadPayrollPeriod(periodId);await refreshPayroll(false);toast('เพิ่มรายการและคำนวณใหม่แล้ว');}catch(e){toast(e.message,true)}finally{button.disabled=false;}}

window.recalculatePayroll=async id=>{try{await api(`/api/payroll/periods/${id}/recalculate`,{method:'POST',body:'{}'});await loadPayrollPeriod(id);await refreshPayroll(false);toast('คำนวณ Payroll ใหม่แล้ว');}catch(e){toast(e.message,true)}};
window.reviewPayroll=async id=>{try{await api(`/api/payroll/periods/${id}/review`,{method:'POST',body:'{}'});await refreshPayroll();await loadPayrollPeriod(id);toast('เปลี่ยนเป็นรอตรวจแล้ว');}catch(e){toast(e.message,true)}};
window.lockPayroll=async id=>{if(!confirm('Lock รอบเงินเดือนแล้วจะคำนวณใหม่/แก้รายการไม่ได้ ต้องการ Lock ใช่ไหม?'))return;try{await api(`/api/payroll/periods/${id}/lock`,{method:'POST',body:'{}'});await refreshPayroll();await loadPayrollPeriod(id);toast('Lock Payroll แล้ว');}catch(e){toast(e.message,true)}};
window.publishPayroll=async id=>{if(!confirm('Publish แล้วระบบจะสร้าง PDF ลง Google Drive และแจ้งพนักงานทาง Mail/LINE ต้องการทำต่อไหม?'))return;try{const r=await api(`/api/payroll/periods/${id}/publish`,{method:'POST',body:'{}'});await refreshPayroll();await loadPayrollPeriod(id);toast(r.message||'เริ่ม Publish Payslip แล้ว');setTimeout(()=>refreshDocuments(),2500);}catch(e){toast(e.message,true)}};

async function refreshPayroll(render=true){const role=String(activeCompanyRole()||'');if(!['owner','hr_admin','hr'].includes(role))return;state.payroll=await api('/api/payroll/overview');if(render)renderPayroll();}

function renderDocuments(){const canHr=['owner','hr_admin','hr'].includes(String(activeCompanyRole()||''));$('#generateDocumentBtn').classList.toggle('hidden',!canHr);const d=state.documents||{data:[],payslips:[]};const pays=d.payslips||[],docs=d.data||[];const emailCount=pays.filter(x=>x.email_sent_at).length,lineCount=pays.filter(x=>x.line_notified_at).length;$('#documentSummary').innerHTML=`<div><span>Payslip</span><strong>${pays.length}</strong></div><div><span>ส่ง Email</span><strong>${emailCount}</strong></div><div><span>แจ้ง LINE</span><strong>${lineCount}</strong></div><div><span>เอกสาร HR</span><strong>${docs.length}</strong></div>`;$('#payslipDocumentList').innerHTML=pays.length?pays.map(p=>{const share=p.share_token_value?`${location.origin}/payslip/${p.share_token_value}`:p.drive_url;return `<article class="document-row"><div class="document-file-icon">PDF</div><div><strong>${escapeHtml(p.nickname||p.first_name)} · ${escapeHtml(p.period_key)}</strong><p>${escapeHtml(p.file_name)}</p><small>${p.email_sent_at?'✓ Email ':''}${p.line_notified_at?'✓ LINE ':''}· ${formatDateTime(p.created_at)}</small></div>${share?`<a class="secondary-btn" href="${escapeHtml(share)}" target="_blank" rel="noopener">เปิด</a>`:''}</article>`}).join(''):emptyState('ยังไม่มี Payslip','เมื่อ Lock และ Publish Payroll เอกสารจะมาอยู่ตรงนี้อัตโนมัติ');$('#employeeDocumentList').innerHTML=docs.length?docs.map(x=>`<article class="document-row"><div class="document-file-icon">PDF</div><div><strong>${escapeHtml(x.title)}</strong><p>${escapeHtml(x.nickname||x.first_name||'เอกสารบริษัท')} · ${formatDate(x.document_date||x.created_at)}</p><small>${escapeHtml(x.document_type)}</small></div>${x.drive_url?`<a class="secondary-btn" href="${escapeHtml(x.drive_url)}" target="_blank" rel="noopener">Drive</a>`:''}</article>`).join(''):emptyState('ยังไม่มีเอกสาร','ออกหนังสือรับรองการทำงานหรือหนังสือรับรองเงินเดือนได้จากปุ่มด้านบน');}
async function refreshDocuments(){try{state.documents=await api('/api/documents');renderDocuments();}catch{}}
function openDocumentGenerateModal(){const employees=state.employees.filter(e=>e.status==='active');$('#documentEmployee').innerHTML=employees.map(e=>`<option value="${e.id}">${escapeHtml(e.nickname||e.first_name)} · ${escapeHtml(e.employee_code)}</option>`).join('');$('#documentType').value='employment_certificate';$('#documentNote').value='';$('#documentGenerateModal').showModal();}
async function generateEmployeeDocument(){const button=$('#documentGenerateSaveBtn');button.disabled=true;button.textContent='กำลังสร้าง PDF…';try{const result=await api('/api/documents/generate',{method:'POST',body:JSON.stringify({employee_id:Number($('#documentEmployee').value),document_type:$('#documentType').value,note:$('#documentNote').value.trim()})});$('#documentGenerateModal').close();await refreshDocuments();toast('สร้างเอกสารลง Google Drive แล้ว');if(result.document?.drive_url)window.open(result.document.drive_url,'_blank','noopener');}catch(e){toast(e.message,true)}finally{button.disabled=false;button.textContent='สร้าง PDF ลง Drive';}}

function renderGrowth(){
  const learning=state.learning||{courses:[],summary:{}}; const performance=state.performance||{goals:[],one_on_ones:[],probation_due:[],probation_reviews:[],summary:{}}; const canAdmin=['owner','hr_admin','hr'].includes(String(activeCompanyRole()||''));
  for(const id of ['createCourseBtn','createPerformanceCycleBtn']){const el=$(`#${id}`);if(el)el.classList.toggle('hidden',!canAdmin);}
  const ls=learning.summary||{},ps=performance.summary||{};
  $('#performanceSummary').innerHTML=[['หลักสูตร',ls.published||0,'คอร์สที่ Publish'],['เรียนจบ',ls.completed||0,`จาก ${ls.assigned||0} Assignment`],['KPI Active',ps.active_goals||0,`${ps.kpi_on_track||0} อยู่ในเกณฑ์`],['1:1 รอคุย',ps.one_on_one_pending||0,'รายการ'],['Probation',ps.probation_due||0,'คนรอประเมิน']].map(([label,value,sub])=>`<div><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`).join('');
  $('#learningProgressBadge').textContent=`${(learning.courses||[]).length} คอร์ส`; $('#probationDueBadge').textContent=`${(performance.probation_due||[]).length} คน`;
  renderLearningCourses(); renderKpiGoals(); renderOneOnOnes(); renderProbationReviews();
}

function renderLearningCourses(){
  const courses=state.learning?.courses||[]; const root=$('#learningCourseList'); if(!root)return;
  root.innerHTML=courses.length?courses.map(c=>{const modules=c.modules||[], stats=c.stats||{};const progress=stats.assigned?Math.round(stats.completed/stats.assigned*100):0;return `<article class="learning-course-card"><div class="course-top"><div class="course-icon">${c.status==='published'?'▶':'✦'}</div><div class="course-copy"><div class="course-title-line"><strong>${escapeHtml(c.title)}</strong><span class="badge ${c.status==='published'?'badge-success':'badge-neutral'}">${c.status==='published'?'Published':'Draft'}</span></div><p>${escapeHtml(c.description||'ยังไม่มีคำอธิบาย')}</p><small>${modules.length} บท · ${Number(c.estimated_minutes||0)} นาที · ผ่าน ${Number(c.passing_score||80)}%</small></div></div><div class="course-progress"><span><b>${stats.completed||0}</b> / ${stats.assigned||0} เรียนจบ</span><div><i style="width:${progress}%"></i></div></div><div class="course-module-strip">${modules.length?modules.map(m=>`<span title="${escapeHtml(m.title)}">${moduleTypeIcon(m.module_type)} ${escapeHtml(m.title)}${m.module_type==='quiz'?` · ${(m.questions||[]).length} ข้อ`:''}</span>`).join(''):'<span class="empty-module">ยังไม่มีบทเรียน</span>'}</div><div class="course-actions"><button class="text-btn" onclick="window.openLearningModule(${c.id})">+ บทเรียน</button>${modules.filter(m=>m.module_type==='quiz').map(m=>`<button class="text-btn" onclick="window.openQuizQuestion(${m.id})">+ คำถาม · ${escapeHtml(m.title)}</button>`).join('')}<button class="secondary-btn" onclick="window.openCourseAssign(${c.id})">Assign</button></div></article>`}).join(''):emptyState('ยังไม่มีหลักสูตร','สร้าง Onboarding Course แล้วเพิ่มวิดีโอจาก Google Drive หรือ Quiz ได้ทันที');
}
function moduleTypeIcon(type){return ({video:'🎬',document:'📄',text:'📝',link:'🔗',quiz:'🧠'})[type]||'•';}

function renderKpiGoals(){
  const goals=state.performance?.goals||[]; const root=$('#kpiGoalList'); if(!root)return;
  root.innerHTML=goals.length?goals.map(g=>{const pct=Math.max(0,Math.min(100,Number(g.current_progress||0)));return `<article class="kpi-card"><div class="kpi-person"><div class="avatar">${initial(g)}</div><div><strong>${escapeHtml(g.nickname||g.first_name)}</strong><small>${escapeHtml(g.department_name||g.employee_code||'')}</small></div><span class="badge ${pct>=80?'badge-success':pct>=50?'badge-soft':'badge-warning'}">${Math.round(pct)}%</span></div><h4>${escapeHtml(g.title)}</h4><p>${escapeHtml(g.description||'')}</p><div class="kpi-progress"><i style="width:${pct}%"></i></div><div class="kpi-foot"><span>${kpiTargetText(g)}</span><span>${frequencyLabel(g.update_frequency)}</span><button class="text-btn" onclick="window.openKpiUpdate(${g.id})">อัปเดต</button></div></article>`}).join(''):emptyState('ยังไม่มี KPI','สร้าง KPI ให้พนักงาน แล้วให้เจ้าตัวอัปเดตรายวัน/สัปดาห์/เดือนจาก LINE Portal');
}
function kpiTargetText(g){if(g.metric_type==='text')return 'อัปเดตเป็นข้อความ';if(g.target_value==null)return 'ไม่กำหนด Target';return `เป้า ${Number(g.target_value).toLocaleString('th-TH')} ${escapeHtml(g.unit||'')}`;}
function frequencyLabel(v){return ({daily:'ทุกวัน',weekly:'ทุกสัปดาห์',monthly:'ทุกเดือน',once:'ครั้งเดียว'})[v]||v;}

function renderOneOnOnes(){const rows=state.performance?.one_on_ones||[];$('#oneOnOneList').innerHTML=rows.length?rows.slice(0,12).map(o=>`<article class="timeline-card"><div class="timeline-dot ${o.status==='completed'?'done':''}"></div><div><strong>${escapeHtml(o.nickname||o.first_name)}</strong><p>${o.status==='completed'?'คุยแล้ว':'นัด 1:1'} · ${o.scheduled_at?formatDateTime(o.scheduled_at):'ยังไม่กำหนดเวลา'}</p>${o.action_items?`<small>Action: ${escapeHtml(o.action_items)}</small>`:''}</div><span class="badge ${o.status==='completed'?'badge-success':'badge-soft'}">${oneStatusLabel(o.status)}</span></article>`).join(''):emptyState('ยังไม่มี 1:1','นัดคุยกับทีมและเก็บ Action item ไว้เป็น Timeline');}
function oneStatusLabel(s){return ({scheduled:'นัดไว้',completed:'คุยแล้ว',cancelled:'ยกเลิก',missed:'ไม่ได้คุย'})[s]||s;}

function renderProbationReviews(){const due=state.performance?.probation_due||[], reviews=state.performance?.probation_reviews||[];const latest=new Map();for(const r of reviews){if(!latest.has(Number(r.employee_id)))latest.set(Number(r.employee_id),r);}$('#probationReviewList').innerHTML=due.length?due.map(e=>{const r=latest.get(Number(e.id));const days=e.probation_end_date?Math.ceil((new Date(`${e.probation_end_date}T12:00:00+07:00`)-new Date())/86400000):null;return `<article class="probation-card"><div><strong>${escapeHtml(e.nickname||e.first_name)} · ${escapeHtml(e.employee_code)}</strong><p>ครบโปร ${formatDate(e.probation_end_date)}${days!=null?` · ${days>=0?`อีก ${days} วัน`:`เลยมา ${Math.abs(days)} วัน`}`:''}</p><small>${r?`ล่าสุด: ${reviewStatusLabel(r.status)}${r.score!=null?` · ${r.score}/100`:''}`:'ยังไม่มีผลประเมิน'}</small></div><button class="secondary-btn" onclick="window.openProbationReview(${e.id})">ประเมิน</button></article>`}).join(''):emptyState('ไม่มีคนรอประเมิน','พนักงานทดลองงานที่มีวันครบโปรจะขึ้นที่นี่');}
function reviewStatusLabel(s){return ({pending:'รอประเมิน',submitted:'ส่งประเมิน',passed:'ผ่าน',extended:'ต่อโปร',not_passed:'ไม่ผ่าน'})[s]||s;}

async function refreshGrowth(){const role=String(activeCompanyRole()||'');if(!['owner','hr_admin','hr','manager'].includes(role))return;try{const [learning,performance]=await Promise.all([api('/api/learning/overview'),api('/api/performance/overview')]);state.learning=learning;state.performance=performance;renderGrowth();}catch(e){toast(e.message,true);}}

function openCourseModal(){ $('#courseTitle').value='';$('#courseDescription').value='';$('#courseAudience').value='probation';$('#coursePassingScore').value=80;$('#courseEstimatedMinutes').value=30;$('#courseRequired').checked=true;$('#courseModal').showModal(); }
async function saveCourse(){const button=$('#courseSaveBtn');button.disabled=true;try{await api('/api/learning/courses',{method:'POST',body:JSON.stringify({title:$('#courseTitle').value.trim(),description:$('#courseDescription').value.trim(),audience_type:$('#courseAudience').value,passing_score:Number($('#coursePassingScore').value||80),estimated_minutes:Number($('#courseEstimatedMinutes').value||0),required:$('#courseRequired').checked})});$('#courseModal').close();await refreshGrowth();toast('สร้างหลักสูตรแล้ว · เพิ่มบทเรียนต่อได้เลย');}catch(e){toast(e.message,true)}finally{button.disabled=false;}}

window.openLearningModule=id=>openLearningModule(Number(id));
function openLearningModule(courseId){$('#moduleCourseId').value=courseId;$('#moduleType').value='video';$('#moduleTitle').value='';$('#moduleDescription').value='';$('#moduleContentText').value='';$('#moduleExternalUrl').value='';$('#moduleFile').value='';$('#moduleRequired').checked=true;renderModuleFields();$('#moduleModal').showModal();}
function renderModuleFields(){const type=$('#moduleType').value;$('#moduleTextField').classList.toggle('hidden',type!=='text');$('#moduleLinkField').classList.toggle('hidden',type!=='link');$('#moduleFileField').classList.toggle('hidden',!['video','document'].includes(type));}
async function saveLearningModule(){const button=$('#moduleSaveBtn');button.disabled=true;button.textContent='กำลังเพิ่ม…';try{const type=$('#moduleType').value;const result=await api(`/api/learning/courses/${Number($('#moduleCourseId').value)}/modules`,{method:'POST',body:JSON.stringify({module_type:type,title:$('#moduleTitle').value.trim(),description:$('#moduleDescription').value.trim(),content_text:$('#moduleContentText').value.trim(),external_url:$('#moduleExternalUrl').value.trim(),required:$('#moduleRequired').checked})});const file=$('#moduleFile').files?.[0];if(file&&['video','document'].includes(type)){button.textContent='กำลังอัปขึ้น Drive…';const form=new FormData();form.append('file',file);const res=await fetch(`/api/learning/modules/${result.id}/media`,{method:'POST',credentials:'same-origin',body:form});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||'อัปโหลดไฟล์ไม่สำเร็จ');}$('#moduleModal').close();await refreshGrowth();toast(type==='quiz'?'เพิ่ม Quiz แล้ว · กดเพิ่มคำถามได้เลย':'เพิ่มบทเรียนแล้ว');if(type==='quiz')openQuizQuestion(result.id);}catch(e){toast(e.message,true)}finally{button.disabled=false;button.textContent='เพิ่มบทเรียน';}}

window.openQuizQuestion=id=>openQuizQuestion(Number(id));
function openQuizQuestion(moduleId){$('#quizModuleId').value=moduleId;$('#quizQuestionText').value='';$('#quizOptions').value='';$('#quizCorrectIndex').value=1;$('#quizPoints').value=1;$('#quizExplanation').value='';$('#quizQuestionModal').showModal();}
async function saveQuizQuestion(){const options=$('#quizOptions').value.split('\n').map(x=>x.trim()).filter(Boolean);const correct=Math.max(0,Number($('#quizCorrectIndex').value||1)-1);const button=$('#quizQuestionSaveBtn');button.disabled=true;try{await api(`/api/learning/modules/${Number($('#quizModuleId').value)}/questions`,{method:'POST',body:JSON.stringify({question_text:$('#quizQuestionText').value.trim(),question_type:'single',options,correct_answers:[correct],points:Number($('#quizPoints').value||1),explanation:$('#quizExplanation').value.trim()})});$('#quizQuestionModal').close();await refreshGrowth();toast('เพิ่มคำถามแล้ว');}catch(e){toast(e.message,true)}finally{button.disabled=false;}}

window.openCourseAssign=id=>openCourseAssign(Number(id));
function openCourseAssign(courseId){const course=(state.learning?.courses||[]).find(c=>Number(c.id)===courseId);$('#assignCourseId').value=courseId;$('#courseAssignTitle').textContent=`มอบหมาย · ${course?.title||'หลักสูตร'}`;$('#assignAudience').value=course?.audience_type==='manual'?'probation':course?.audience_type||'probation';$('#assignDueDate').value='';$('#assignDepartment').innerHTML=(state.peopleCore?.departments||[]).map(d=>`<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');$('#assignEmployeeChecks').innerHTML=state.employees.filter(e=>e.status==='active').map(e=>`<label class="location-check"><input type="checkbox" value="${e.id}"/><span><strong>${escapeHtml(e.nickname||e.first_name)}</strong><small>${escapeHtml(e.employee_code)} · ${escapeHtml(e.department_name||'-')}</small></span></label>`).join('');renderCourseAssignFields();$('#courseAssignModal').showModal();}
function renderCourseAssignFields(){const a=$('#assignAudience').value;$('#assignDepartmentField').classList.toggle('hidden',a!=='department');$('#assignEmployeesField').classList.toggle('hidden',a!=='employees');}
async function assignCourse(){const button=$('#courseAssignSaveBtn');button.disabled=true;try{const audience=$('#assignAudience').value;await api(`/api/learning/courses/${Number($('#assignCourseId').value)}/assign`,{method:'POST',body:JSON.stringify({audience_type:audience,department_id:audience==='department'?Number($('#assignDepartment').value):null,employee_ids:audience==='employees'?$$('#assignEmployeeChecks input:checked').map(x=>Number(x.value)):[],due_date:$('#assignDueDate').value||null})});$('#courseAssignModal').close();await refreshGrowth();toast('Publish และ Assign หลักสูตรแล้ว');}catch(e){toast(e.message,true)}finally{button.disabled=false;}}

function fillPerformanceEmployeeSelect(selector,selected=null){const el=$(selector);el.innerHTML=state.employees.filter(e=>e.status==='active').map(e=>`<option value="${e.id}" ${Number(selected)===Number(e.id)?'selected':''}>${escapeHtml(e.nickname||e.first_name)} · ${escapeHtml(e.employee_code)}</option>`).join('');}
function openKpiModal(){fillPerformanceEmployeeSelect('#kpiEmployee');$('#kpiTitle').value='';$('#kpiDescription').value='';$('#kpiMetricType').value='number';$('#kpiTargetValue').value='';$('#kpiUnit').value='';$('#kpiFrequency').value='monthly';$('#kpiWeight').value=0;$('#kpiCycle').innerHTML='<option value="">ไม่ผูกรอบ</option>'+(state.performance?.cycles||[]).filter(c=>c.status==='active').map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');$('#kpiModal').showModal();}
async function saveKpi(){const button=$('#kpiSaveBtn');button.disabled=true;try{await api('/api/performance/goals',{method:'POST',body:JSON.stringify({employee_id:Number($('#kpiEmployee').value),cycle_id:$('#kpiCycle').value||null,title:$('#kpiTitle').value.trim(),description:$('#kpiDescription').value.trim(),metric_type:$('#kpiMetricType').value,target_value:$('#kpiTargetValue').value,unit:$('#kpiUnit').value.trim(),update_frequency:$('#kpiFrequency').value,weight:Number($('#kpiWeight').value||0)})});$('#kpiModal').close();await refreshGrowth();toast('สร้าง KPI แล้ว');}catch(e){toast(e.message,true)}finally{button.disabled=false;}}
window.openKpiUpdate=id=>{const g=(state.performance?.goals||[]).find(x=>Number(x.id)===Number(id));if(!g)return;$('#kpiUpdateGoalId').value=id;$('#kpiUpdateTitle').textContent=`อัปเดต · ${g.title}`;$('#kpiActualValue').value=g.latest_update?.actual_value??'';$('#kpiProgressPct').value='';$('#kpiUpdateNote').value='';$('#kpiUpdateModal').showModal();};
async function saveKpiUpdate(){const button=$('#kpiUpdateSaveBtn');button.disabled=true;try{await api(`/api/performance/goals/${Number($('#kpiUpdateGoalId').value)}/updates`,{method:'POST',body:JSON.stringify({actual_value:$('#kpiActualValue').value,progress_pct:$('#kpiProgressPct').value,note:$('#kpiUpdateNote').value.trim()})});$('#kpiUpdateModal').close();await refreshGrowth();toast('อัปเดต KPI แล้ว');}catch(e){toast(e.message,true)}finally{button.disabled=false;}}

function openPerformanceCycleModal(){const now=new Date();const first=localDateKey(new Date(now.getFullYear(),now.getMonth(),1));const last=localDateKey(new Date(now.getFullYear(),now.getMonth()+1,0));$('#cycleName').value=`${now.toLocaleString('en',{month:'short'})} ${now.getFullYear()}`;$('#cycleType').value='monthly';$('#cycleStart').value=first;$('#cycleEnd').value=last;$('#performanceCycleModal').showModal();}
async function savePerformanceCycle(){const button=$('#cycleSaveBtn');button.disabled=true;try{await api('/api/performance/cycles',{method:'POST',body:JSON.stringify({name:$('#cycleName').value.trim(),cycle_type:$('#cycleType').value,start_date:$('#cycleStart').value,end_date:$('#cycleEnd').value})});$('#performanceCycleModal').close();await refreshGrowth();toast('สร้างรอบประเมินแล้ว');}catch(e){toast(e.message,true)}finally{button.disabled=false;}}

function openOneOnOneModal(){fillPerformanceEmployeeSelect('#oneEmployee');$('#oneScheduledAt').value='';$('#oneStatus').value='scheduled';$('#oneManagerNotes').value='';$('#oneActionItems').value='';$('#oneFollowup').value='';$('#oneOnOneModal').showModal();}
async function saveOneOnOne(){const button=$('#oneSaveBtn');button.disabled=true;try{await api('/api/performance/one-on-ones',{method:'POST',body:JSON.stringify({employee_id:Number($('#oneEmployee').value),scheduled_at:$('#oneScheduledAt').value||null,status:$('#oneStatus').value,manager_notes:$('#oneManagerNotes').value.trim(),action_items:$('#oneActionItems').value.trim(),next_followup_at:$('#oneFollowup').value||null})});$('#oneOnOneModal').close();await refreshGrowth();toast('บันทึก 1:1 แล้ว');}catch(e){toast(e.message,true)}finally{button.disabled=false;}}

function openProbationReviewModal(employeeId=null){const probation=state.employees.filter(e=>e.status==='active'&&e.people_status==='probation');const select=$('#reviewEmployee');select.innerHTML=probation.map(e=>`<option value="${e.id}" ${Number(employeeId)===Number(e.id)?'selected':''}>${escapeHtml(e.nickname||e.first_name)} · ${escapeHtml(e.employee_code)}</option>`).join('');$('#reviewDate').value=localDateKey(new Date());$('#reviewStatus').value='submitted';$('#reviewScore').value='';$('#reviewExtensionEnd').value='';$('#reviewStrengths').value='';$('#reviewImprovements').value='';$('#reviewManagerComment').value='';$('#reviewHrComment').value='';$('#probationReviewModal').showModal();}
window.openProbationReview=id=>openProbationReviewModal(Number(id));
async function saveProbationReview(){const button=$('#reviewSaveBtn');button.disabled=true;try{await api('/api/performance/probation-reviews',{method:'POST',body:JSON.stringify({employee_id:Number($('#reviewEmployee').value),review_date:$('#reviewDate').value,status:$('#reviewStatus').value,score:$('#reviewScore').value,strengths:$('#reviewStrengths').value.trim(),improvements:$('#reviewImprovements').value.trim(),manager_comment:$('#reviewManagerComment').value.trim(),hr_comment:$('#reviewHrComment').value.trim(),extension_end_date:$('#reviewExtensionEnd').value||null})});$('#probationReviewModal').close();await loadAll({silent:true});toast('บันทึกผล Probation แล้ว');}catch(e){toast(e.message,true)}finally{button.disabled=false;}}

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


// ─────────────────────────────────────────────────────────────
// Phase 5 — Engagement, Rewards, People Analytics & SaaS
// ─────────────────────────────────────────────────────────────
function canManageEngagementUi(){return ['owner','hr_admin','hr'].includes(String(activeCompanyRole()||''));}
function isOwnerUi(){return String(activeCompanyRole()||'')==='owner';}
function phase5EmployeeOptions(selected=''){return state.employees.filter(e=>e.status==='active').map(e=>`<option value="${e.id}" ${String(selected)===String(e.id)?'selected':''}>${escapeHtml(e.nickname||e.first_name)} · ${escapeHtml(e.employee_code||'')}</option>`).join('');}
function openPhase5Form({eyebrow='NAKNA',title,subtitle='',html,onSave,saveText='บันทึก'}){
  $('#modalEyebrow').textContent=eyebrow;$('#modalTitle').textContent=title;$('#modalSubtitle').textContent=subtitle;$('#modalFields').className='modal-fields';$('#modalFields').innerHTML=html;$('#modalSave').textContent=saveText;
  $('#modalSave').onclick=async()=>{const b=$('#modalSave');b.disabled=true;try{await onSave();$('#modal').close();toast('บันทึกเรียบร้อยแล้ว');}catch(e){toast(e.message,true)}finally{b.disabled=false;b.textContent=saveText;}};$('#modal').showModal();
}

async function refreshPhase5(){
  const role=String(activeCompanyRole()||'');const canView=['owner','hr_admin','hr','manager','viewer'].includes(role);
  if(canView){const [engagement,analytics]=await Promise.all([api('/api/engagement/overview'),api('/api/analytics/overview')]);state.engagement=engagement;state.analytics=analytics;}
  state.subscription=await api('/api/subscription');
  if(state.subscription?.saas_admin){try{state.saasAdmin=await api('/api/admin/saas/overview')}catch{state.saasAdmin=null}}
  renderEngagement();renderAnalytics();renderSubscription();renderSaasAdmin();
}

function renderEngagement(){
  const d=state.engagement||{},sum=d.summary||{},canManage=canManageEngagementUi();
  const root=$('#engagementSummary');if(!root)return;
  root.innerHTML=[['แต้มคงเหลือในระบบ',Number(sum.points_outstanding||0).toLocaleString('th-TH'),'POINTS'],['แต้มที่เคยให้ทั้งหมด',Number(sum.lifetime_earned||0).toLocaleString('th-TH'),'EARNED'],['ของรางวัลใช้งาน',Number(sum.active_rewards||0).toLocaleString('th-TH'),'REWARDS'],['รออนุมัติแลก',Number(sum.pending_redemptions||0).toLocaleString('th-TH'),'QUEUE'],['รอเข้า Payroll',money(sum.pending_cash_payroll||0),'INCENTIVE']].map(([l,v,k])=>`<article><span>${k}</span><strong>${v}</strong><p>${l}</p></article>`).join('');
  $('#manualAwardBtn').classList.toggle('hidden',!canManage);$('#createPointRuleBtn').classList.toggle('hidden',!canManage);$('#createRewardBtn').classList.toggle('hidden',!canManage);$('#runPointRulesBtn').classList.toggle('hidden',!canManage);
  const rules=d.rules||[];$('#pointRulesList').innerHTML=rules.length?rules.map(r=>`<div class="phase5-row"><div class="rule-state ${Number(r.is_active)?'on':''}"></div><div class="phase5-copy"><strong>${escapeHtml(r.name)}</strong><p>${escapeHtml(eventRuleLabel(r.event_type))} · +${Number(r.points||0).toLocaleString('th-TH')} แต้ม${Number(r.cash_value||0)>0?` · ${money(r.cash_value)} เข้า Payroll`:''}${r.event_type==='attendance_streak'?` · ทุก ${Number(r.threshold_count||1)} ครั้ง`:''}</p></div><span class="badge ${Number(r.is_active)?'badge-success':'badge-neutral'}">${Number(r.is_active)?'เปิด':'ปิด'}</span>${canManage?`<button class="text-btn" onclick="window.togglePointRule(${r.id},${Number(r.is_active)?0:1})">${Number(r.is_active)?'ปิด':'เปิด'}</button>`:''}</div>`).join(''):emptyState('ยังไม่มีกติกา','สร้างกติกาเพื่อให้แต้มจากพฤติกรรมที่บริษัทต้องการ');
  const board=d.leaderboard||[];$('#leaderboardList').innerHTML=board.length?board.slice(0,10).map((w,i)=>`<div class="leaderboard-row"><span class="rank ${i<3?'top':''}">${i+1}</span><span class="mini-avatar">${initial(w)}</span><div><strong>${escapeHtml(w.nickname||w.first_name)}</strong><small>${escapeHtml(w.department_name||'ไม่ระบุแผนก')}</small></div><b>${Number(w.balance||0).toLocaleString('th-TH')} <small>pts</small></b></div>`).join(''):emptyState('ยังไม่มีคะแนน','เมื่อเริ่มให้แต้ม Leaderboard จะขึ้นที่นี่');
  const rewards=d.rewards||[];$('#rewardCatalogList').innerHTML=rewards.length?rewards.map(r=>`<article class="reward-card ${r.status!=='active'?'inactive':''}"><div class="reward-emoji">${rewardEmoji(r.reward_type)}</div><div><strong>${escapeHtml(r.title)}</strong><p>${escapeHtml(r.description||'')}</p><small>${Number(r.points_cost||0).toLocaleString('th-TH')} แต้ม${Number(r.cash_value||0)>0?` · มูลค่า ${money(r.cash_value)}`:''}${r.stock_qty!=null?` · เหลือ ${r.stock_qty}`:' · ไม่จำกัดจำนวน'}</small></div><span class="badge ${r.status==='active'?'badge-success':'badge-neutral'}">${r.status==='active'?'พร้อมแลก':'ปิด'}</span></article>`).join(''):emptyState('ยังไม่มีของรางวัล','เพิ่มของขวัญ เงินรางวัล หรือสิทธิพิเศษให้ทีม');
  const reds=d.redemptions||[],pending=reds.filter(x=>x.status==='pending').length;$('#redemptionQueueBadge').textContent=`${pending} รอจัดการ`;$('#redemptionList').innerHTML=reds.length?reds.slice(0,30).map(r=>`<div class="phase5-row"><div class="reward-emoji small">${rewardEmoji(r.reward_type)}</div><div class="phase5-copy"><strong>${escapeHtml(r.nickname||r.first_name)} · ${escapeHtml(r.reward_title)}</strong><p>${Number(r.points_cost||0).toLocaleString('th-TH')} แต้ม · ${formatDateTime(r.requested_at)}</p></div><span class="badge ${r.status==='pending'?'badge-warning':r.status==='approved'?'badge-success':r.status==='delivered'?'badge-soft':'badge-neutral'}">${redemptionLabel(r.status)}</span>${canManage?redemptionActions(r):''}</div>`).join(''):emptyState('ยังไม่มีคำขอแลก','คำขอจาก Employee Portal จะมาอยู่ตรงนี้');
}
function eventRuleLabel(v){return ({attendance_streak:'มาตรงเวลาเป็นชุด',learning_complete:'เรียนจบหลักสูตร',kpi_complete:'KPI สำเร็จ',birthday:'วันเกิด',work_anniversary:'ครบรอบงาน',manual:'HR ให้เอง',custom:'กำหนดเอง'})[v]||v;}
function rewardEmoji(v){return ({gift:'🎁',cash:'💸',leave:'🌴',perk:'✨',custom:'⭐'})[v]||'🎁';}
function redemptionLabel(v){return ({pending:'รออนุมัติ',approved:'อนุมัติแล้ว',rejected:'ปฏิเสธ',delivered:'ส่งมอบแล้ว',cancelled:'ยกเลิก'})[v]||v;}
function redemptionActions(r){if(r.status==='pending')return `<div class="row-actions"><button class="text-btn success-text" onclick="window.rewardDecision(${r.id},'approve')">อนุมัติ</button><button class="text-btn danger-text" onclick="window.rewardDecision(${r.id},'reject')">ปฏิเสธ</button></div>`;if(r.status==='approved')return `<button class="text-btn" onclick="window.rewardDecision(${r.id},'deliver')">ส่งมอบแล้ว</button>`;return '';}
window.togglePointRule=async(id,on)=>{try{const r=(state.engagement.rules||[]).find(x=>Number(x.id)===Number(id));await api(`/api/engagement/rules/${id}`,{method:'PATCH',body:JSON.stringify({is_active:Boolean(on),name:r?.name,event_type:r?.event_type})});await refreshPhase5();toast(on?'เปิดกติกาแล้ว':'ปิดกติกาแล้ว')}catch(e){toast(e.message,true)}};
window.rewardDecision=async(id,action)=>{const note=action==='reject'?prompt('เหตุผลที่ปฏิเสธ','')||'':action==='approve'?prompt('หมายเหตุถึงพนักงาน (ถ้ามี)','')||'':'';try{await api(`/api/engagement/redemptions/${id}/${action}`,{method:'POST',body:JSON.stringify({note})});await refreshPhase5();toast(action==='approve'?'อนุมัติรางวัลแล้ว':action==='reject'?'ปฏิเสธและคืนแต้มแล้ว':'บันทึกว่าส่งมอบแล้ว')}catch(e){toast(e.message,true)}};
async function runPointRules(){try{const r=await api('/api/engagement/run-rules',{method:'POST',body:'{}'});await refreshPhase5();toast(`รันกติกาแล้ว · เพิ่ม ${Number(r.awarded||0)} รายการ`)}catch(e){toast(e.message,true)}}
function openManualAward(){openPhase5Form({eyebrow:'MANUAL POINTS',title:'ให้แต้มพนักงาน',subtitle:'แต้มติดลบใช้สำหรับปรับยอดได้ Cash Incentive จะถูกส่งเข้า Payroll รอบที่เกี่ยวข้อง',html:`<div class="field full"><label>พนักงาน</label><select id="p5AwardEmployee">${phase5EmployeeOptions()}</select></div><div class="field"><label>แต้ม</label><input id="p5AwardPoints" type="number" value="100"/></div><div class="field"><label>Cash Incentive (บาท)</label><input id="p5AwardCash" type="number" min="0" value="0"/></div><div class="field full"><label>เหตุผล</label><input id="p5AwardNote" value="HR ให้แต้ม"/></div>`,onSave:async()=>{await api('/api/engagement/award',{method:'POST',body:JSON.stringify({employee_id:Number($('#p5AwardEmployee').value),points:Number($('#p5AwardPoints').value),cash_value:Number($('#p5AwardCash').value||0),note:$('#p5AwardNote').value.trim()})});await refreshPhase5();}})}
function openPointRule(){openPhase5Form({eyebrow:'POINT RULE',title:'สร้างกติกาแต้ม',subtitle:'กติกาจะยังไม่ทำงานจนกว่าจะเปิดสวิตช์',html:`<div class="field full"><label>ชื่อกติกา</label><input id="p5RuleName" placeholder="เช่น มาตรงเวลา 10 ครั้ง"/></div><div class="field"><label>เหตุการณ์</label><select id="p5RuleEvent"><option value="attendance_streak">มาตรงเวลาครบจำนวน</option><option value="learning_complete">เรียนจบหลักสูตร</option><option value="kpi_complete">KPI สำเร็จ</option><option value="birthday">วันเกิด</option><option value="work_anniversary">ครบรอบงาน</option><option value="manual">Manual</option></select></div><div class="field"><label>จำนวนครั้ง</label><input id="p5RuleThreshold" type="number" min="1" value="10"/></div><div class="field"><label>แต้ม</label><input id="p5RulePoints" type="number" min="0" value="100"/></div><div class="field"><label>Cash Incentive (บาท)</label><input id="p5RuleCash" type="number" min="0" value="0"/></div><div class="field full"><label class="toggle-line"><input id="p5RuleActive" type="checkbox"/> เปิดใช้งานทันที</label></div>`,onSave:async()=>{await api('/api/engagement/rules',{method:'POST',body:JSON.stringify({name:$('#p5RuleName').value.trim(),event_type:$('#p5RuleEvent').value,threshold_count:Number($('#p5RuleThreshold').value||1),points:Number($('#p5RulePoints').value||0),cash_value:Number($('#p5RuleCash').value||0),is_active:$('#p5RuleActive').checked})});await refreshPhase5();}})}
function openReward(){openPhase5Form({eyebrow:'REWARD',title:'เพิ่มของรางวัล',subtitle:'พนักงานจะเห็นรายการนี้ใน Employee Portal และใช้แต้มแลกได้',html:`<div class="field full"><label>ชื่อของรางวัล</label><input id="p5RewardTitle" placeholder="เช่น Voucher 500 บาท"/></div><div class="field"><label>ประเภท</label><select id="p5RewardType"><option value="gift">ของขวัญ</option><option value="cash">เงินรางวัล</option><option value="leave">วันลา / วันหยุดพิเศษ</option><option value="perk">สิทธิพิเศษ</option><option value="custom">อื่นๆ</option></select></div><div class="field"><label>แต้มที่ใช้</label><input id="p5RewardPoints" type="number" min="0" value="500"/></div><div class="field"><label>มูลค่าเงิน (ถ้ามี)</label><input id="p5RewardCash" type="number" min="0" value="0"/></div><div class="field"><label>จำนวนในคลัง</label><input id="p5RewardStock" type="number" min="0" placeholder="เว้นว่าง = ไม่จำกัด"/></div><div class="field full"><label>รายละเอียด</label><input id="p5RewardDescription" placeholder="เงื่อนไขหรือรายละเอียดของรางวัล"/></div>`,onSave:async()=>{await api('/api/engagement/rewards',{method:'POST',body:JSON.stringify({title:$('#p5RewardTitle').value.trim(),description:$('#p5RewardDescription').value.trim(),reward_type:$('#p5RewardType').value,points_cost:Number($('#p5RewardPoints').value||0),cash_value:Number($('#p5RewardCash').value||0),stock_qty:$('#p5RewardStock').value})});await refreshPhase5();}})}

function renderAnalytics(){const d=state.analytics||{},s=d.summary||{};if(!$('#analyticsSummary'))return;$('#analyticsSummary').innerHTML=[['Active Headcount',s.active_headcount||0,'คน'],['Probation',s.probation||0,'คน'],['รับเข้า 30 วัน',s.hires_30||0,'คน'],['ออก 90 วัน',s.exits_90||0,'คน'],['Turnover 90 วัน',`${Number(s.turnover_90_pct||0).toFixed(1)}%`,'อัตรา'],['มาสาย 30 วัน',s.late_records_30||0,'ครั้ง']].map(([l,v,u])=>`<article><span>${escapeHtml(l)}</span><strong>${v}</strong><small>${u}</small></article>`).join('');
  const trend=d.headcount_trend||[],max=Math.max(1,...trend.map(x=>Number(x.headcount||0)));$('#headcountTrend').innerHTML=trend.length?trend.map(x=>`<div class="trend-column"><div class="trend-bars"><i class="head" style="height:${Math.max(8,Number(x.headcount||0)/max*100)}%" title="Headcount ${x.headcount}"></i><i class="hire" style="height:${Math.max(2,Number(x.hires||0)/max*100)}%" title="Hire ${x.hires}"></i><i class="exit" style="height:${Math.max(2,Number(x.exits||0)/max*100)}%" title="Exit ${x.exits}"></i></div><strong>${escapeHtml(x.month.slice(5))}/${escapeHtml(x.month.slice(2,4))}</strong><small>${x.headcount} คน</small></div>`).join(''):emptyState('ยังไม่มีข้อมูล Trend','ข้อมูลจะสะสมตามเดือน');
  const moments=d.moments||[];$('#peopleMomentsList').innerHTML=moments.length?moments.map(m=>`<div class="phase5-row"><div class="moment-icon">${m.type==='birthday'?'🎂':'🌱'}</div><div class="phase5-copy"><strong>${escapeHtml(m.name)}</strong><p>${m.type==='birthday'?'วันเกิด':`ครบรอบงาน ${m.years} ปี`} · ${formatDate(m.date)}</p></div><span class="badge badge-soft">${m.days===0?'วันนี้':`อีก ${m.days} วัน`}</span></div>`).join(''):emptyState('30 วันนี้ยังไม่มี Moment','วันเกิดและครบรอบงานจะขึ้นอัตโนมัติ');
  const deps=d.departments||[];$('#departmentAnalytics').innerHTML=deps.length?deps.map(x=>`<div class="department-health-row"><div><strong>${escapeHtml(x.name)}</strong><small>${x.headcount} คน · Probation ${x.probation}</small></div><div class="department-metrics"><span><b>${x.late_records}</b> สาย</span><span><b>${x.avg_kpi==null?'—':`${x.avg_kpi}%`}</b> KPI</span><span><b>${x.learning_completion==null?'—':`${x.learning_completion}%`}</b> Learning</span><span><b>${x.exits_90}</b> Exit</span></div></div>`).join(''):emptyState('ยังไม่มีแผนก','สร้างโครงสร้างองค์กรก่อน');
  const rec=d.recruitment||{};$('#recruitmentAnalytics').innerHTML=Object.keys(rec).length?Object.entries(rec).map(([k,v])=>`<div class="phase5-row"><div class="phase5-copy"><strong>${escapeHtml(stageLabels[k]||k)}</strong><p>Candidate Pipeline</p></div><b class="metric-number">${v}</b></div>`).join(''):emptyState('ยังไม่มี Recruitment Data','เพิ่มผู้สมัครแล้ว Pipeline จะขึ้นอัตโนมัติ');
}

function renderSubscription(){const d=state.subscription;if(!d||!$('#subscriptionBadge'))return;const sub=d.subscription||{},usage=d.usage||{},trial=d.trial||{},estimate=d.estimate||{},status=String(sub.status||'trialing');const labels={trialing:'ทดลองใช้',active:'ใช้งานอยู่',past_due:'ค้างชำระ',expired:'หมดอายุ',cancelled:'ยกเลิก'};$('#subscriptionBadge').className=`badge ${['trialing','active'].includes(status)?'badge-success':status==='past_due'?'badge-warning':'badge-coral'}`;$('#subscriptionBadge').textContent=labels[status]||status;$('#subscriptionPlanKicker').textContent=status==='trialing'?`FREE TRIAL · ${trial.days_remaining??0} DAYS LEFT`:String(sub.plan_code||'PLAN').toUpperCase();$('#subscriptionPlanName').textContent=sub.plan_name||'Free Trial';$('#subscriptionText').textContent=status==='trialing'?`ทดลองใช้ทุกฟีเจอร์ได้อีก ${trial.days_remaining??0} วัน · หลังจากนั้นเลือกแพ็กเกจตามจำนวนพนักงาน`:status==='active'?`แพ็กเกจ Active · ประมาณการ ${estimate.pricing_configured?money(estimate.monthly_amount):'ยังไม่ได้ตั้งราคา'} / เดือน`:'Workspace อยู่ในโหมดจำกัดการเพิ่มพนักงาน กรุณาตรวจ Subscription';const seats=Number(usage.active_employee_seats||0),max=Number(sub.max_seats||0);$('#subscriptionSeats').textContent=max?`${seats} / ${max}`:`${seats}`;$('#subscriptionSeatBar').style.width=max?`${Math.min(100,seats/max*100)}%`:`${Math.min(100,seats*5)}%`;$('#subscriptionPlanBtn').classList.toggle('hidden',!isOwnerUi());$('#generateInvoiceBtn').classList.toggle('hidden',!isOwnerUi()||status==='trialing'||sub.plan_code==='trial'||!estimate.pricing_configured);const inv=d.invoices||[];$('#subscriptionInvoiceList').innerHTML=inv.length?`<div class="subscription-invoice-head"><strong>Billing history</strong><span>${inv.length} รายการ</span></div>`+inv.slice(0,5).map(i=>`<div class="subscription-invoice-row"><span>${escapeHtml(i.invoice_no)}</span><span>${formatDate(i.period_start)} – ${formatDate(i.period_end)}</span><strong>${money(i.total)}</strong><span class="badge ${i.status==='paid'?'badge-success':i.status==='open'?'badge-warning':'badge-neutral'}">${i.status}</span></div>`).join(''):'';$('#saasAdminNav').classList.toggle('hidden',!d.saas_admin);}
function openSubscriptionPlan(){const plans=(state.subscription?.plans||[]).filter(p=>p.code!=='trial');openPhase5Form({eyebrow:'SUBSCRIPTION',title:'เลือกแพ็กเกจ',subtitle:'ราคาในระบบตั้งจาก Nakna Admin Console — หากยังเป็น 0 บาทหมายถึงยังไม่ได้ล็อกราคาขาย',html:`<div class="field full"><label>แพ็กเกจ</label><select id="p5Plan">${plans.map(p=>`<option value="${p.code}">${escapeHtml(p.name)} · ${p.pricing_mode==='custom'?'Custom':`${money(p.base_fee)} + ${money(p.price_per_seat)}/seat`}</option>`).join('')}</select></div><div class="field full"><label>รอบบิล</label><select id="p5BillingCycle"><option value="monthly">รายเดือน</option><option value="annual">รายปี</option></select></div>`,saveText:'เลือกแพ็กเกจ',onSave:async()=>{const r=await api('/api/subscription/plan',{method:'POST',body:JSON.stringify({plan_code:$('#p5Plan').value,billing_cycle:$('#p5BillingCycle').value})});state.subscription=r;await refreshPhase5();}})}
async function generateSubscriptionInvoice(){try{await api('/api/subscription/invoices/generate',{method:'POST',body:'{}'});await refreshPhase5();toast('สร้าง Invoice แล้ว')}catch(e){toast(e.message,true)}}

function renderSaasAdmin(){const d=state.saasAdmin,nav=$('#saasAdminNav');if(!nav)return;nav.classList.toggle('hidden',!d);if(!d)return;const s=d.summary||{};$('#saasAdminSummary').innerHTML=[['Companies',s.companies||0],['Trial',s.trialing||0],['Active',s.active||0],['Past due / Expired',s.past_due||0],['Active Seats',s.active_seats||0],['Estimated MRR',money(s.estimated_mrr||0)]].map(([l,v])=>`<article><span>${l}</span><strong>${v}</strong></article>`).join('');$('#saasPlansList').innerHTML=(d.plans||[]).map(p=>`<div class="phase5-row"><div class="phase5-copy"><strong>${escapeHtml(p.name)}</strong><p>${escapeHtml(p.code)} · ${p.pricing_mode} · Base ${money(p.base_fee)} · Seat ${money(p.price_per_seat)}</p></div><span class="badge ${p.status==='active'?'badge-success':'badge-neutral'}">${p.status}</span><button class="text-btn" onclick="window.editSaasPlan(${p.id})">ตั้งราคา</button></div>`).join('');$('#saasCompaniesList').innerHTML=(d.companies||[]).map(c=>`<div class="phase5-row"><div class="phase5-copy"><strong>${escapeHtml(c.name)}</strong><p>${escapeHtml(c.plan_name||'No plan')} · ${c.active_seats} seats${c.status==='trialing'&&c.trial_ends_at?` · Trial ถึง ${formatDate(c.trial_ends_at)}`:''}</p></div><span class="badge ${c.status==='active'?'badge-success':c.status==='trialing'?'badge-soft':'badge-warning'}">${c.status||'unconfigured'}</span><button class="text-btn" onclick="window.changeSaasStatus(${c.id},'${escapeHtml(c.status||'trialing')}')">สถานะ</button></div>`).join('');$('#saasInvoicesList').innerHTML=(d.invoices||[]).length?(d.invoices||[]).map(i=>`<div class="phase5-row"><div class="phase5-copy"><strong>${escapeHtml(i.invoice_no)} · ${escapeHtml(i.company_name)}</strong><p>${money(i.total)} · Due ${formatDate(i.due_date)}</p></div><span class="badge ${i.status==='paid'?'badge-success':'badge-warning'}">${i.status}</span>${i.status!=='paid'?`<button class="text-btn" onclick="window.markInvoicePaid(${i.id},${Number(i.total||0)})">รับชำระ</button>`:''}</div>`).join(''):emptyState('ยังไม่มี Invoice','Invoice จะปรากฏเมื่อมีแพ็กเกจที่ตั้งราคาแล้ว');}
window.editSaasPlan=id=>{const p=(state.saasAdmin?.plans||[]).find(x=>Number(x.id)===Number(id));if(!p)return;openPhase5Form({eyebrow:'NAKNA PRICING',title:`ตั้งราคา · ${p.name}`,subtitle:'ราคาเป็น THB และยังไม่รวม VAT โดยอัตโนมัติ เพื่อไม่เดาสถานะจด VAT ของธุรกิจ',html:`<div class="field"><label>Base fee / เดือน</label><input id="p5AdminBase" type="number" min="0" value="${Number(p.base_fee||0)}"/></div><div class="field"><label>ราคา / Active Seat</label><input id="p5AdminSeat" type="number" min="0" value="${Number(p.price_per_seat||0)}"/></div><div class="field"><label>Included seats</label><input id="p5AdminIncluded" type="number" min="0" value="${Number(p.included_seats||0)}"/></div><div class="field"><label>Max seats</label><input id="p5AdminMax" type="number" min="1" value="${p.max_seats??''}" placeholder="ว่าง = ไม่จำกัด"/></div><div class="field"><label>Trial days</label><input id="p5AdminTrial" type="number" min="0" value="${Number(p.trial_days||30)}"/></div><div class="field"><label>Pricing mode</label><select id="p5AdminMode"><option value="per_seat" ${p.pricing_mode==='per_seat'?'selected':''}>Per seat</option><option value="flat" ${p.pricing_mode==='flat'?'selected':''}>Flat</option><option value="custom" ${p.pricing_mode==='custom'?'selected':''}>Custom</option></select></div>`,onSave:async()=>{await api(`/api/admin/saas/plans/${id}`,{method:'PATCH',body:JSON.stringify({base_fee:Number($('#p5AdminBase').value||0),price_per_seat:Number($('#p5AdminSeat').value||0),included_seats:Number($('#p5AdminIncluded').value||0),max_seats:$('#p5AdminMax').value===''?null:Number($('#p5AdminMax').value),trial_days:Number($('#p5AdminTrial').value||30),pricing_mode:$('#p5AdminMode').value})});await refreshPhase5();}})};
window.changeSaasStatus=async(id,current)=>{const next=prompt('สถานะ: trialing / active / past_due / expired / cancelled',current);if(!next)return;try{await api(`/api/admin/saas/subscriptions/${id}/status`,{method:'POST',body:JSON.stringify({status:next})});await refreshPhase5();toast('อัปเดต Subscription แล้ว')}catch(e){toast(e.message,true)}};
window.markInvoicePaid=async(id,total)=>{if(!confirm(`ยืนยันรับชำระ ${money(total)} ?`))return;try{await api(`/api/admin/saas/invoices/${id}/mark-paid`,{method:'POST',body:JSON.stringify({amount:total,method:'manual',provider:'manual',note:'บันทึกจาก Nakna Admin Console'})});await refreshPhase5();toast('บันทึกรับชำระแล้ว')}catch(e){toast(e.message,true)}};

boot();
