const NAKNA_FRONTEND_BUILD='P9.15.3'; window.__NAKNA_FRONTEND_BUILD=NAKNA_FRONTEND_BUILD;
// P9.15.3 — Face settings render lifecycle + deployment visibility fix.
// If a Face link is accidentally served by index.html, recover before booting the HR login page.
try {
  const bootUrl = new URL(window.location.href);
  const legacyFaceMode = String(bootUrl.searchParams.get('face') || '').toLowerCase();
  const legacyFaceToken = String(bootUrl.searchParams.get('token') || '').trim();
  if (legacyFaceToken && ['enroll','test','manage'].includes(legacyFaceMode) && bootUrl.pathname !== '/face') {
    const target = new URL('/face', bootUrl.origin);
    target.searchParams.set('token', legacyFaceToken);
    target.searchParams.set('face', legacyFaceMode);
    target.searchParams.set('v', 'P9.15.3');
    window.location.replace(target.toString());
  }
} catch {}

function dedupeBroadcastSidebar(){const sidebar=document.querySelector('.sidebar');if(!sidebar)return;const xs=[...sidebar.querySelectorAll('button,a')].filter(el=>el.id==='broadcastNav'||el.dataset?.view==='broadcast'||(el.textContent||'').replace(/\s+/g,'').trim()==='ประกาศ');const keep=xs.find(el=>el.id==='broadcastNav')||xs[0];xs.forEach(el=>{if(keep&&el!==keep)el.remove();});}

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
  teamWorkLog: null,
  teamWorkLogMode: 'today',
  employees: [],
  candidates: [],
  attendance: [],
  leaves: [],
  leaveMonthlyReport: null,
  requests: [],
  employeeService: null,
  hrCases: [],
  broadcasts: [],
  payroll: null,
  payrollDetail: null,
  documents: { data: [], payslips: [] },
  documentSystem: {summary:{},templates:[],pending_approvals:[],pending_acknowledgements:[],open_cases:[],expiring:[]},
  documentSettings: null,
  learning: { courses: [], assignments: [], summary: {} },
  performance: { cycles: [], goals: [], one_on_ones: [], probation_reviews: [], probation_due: [], summary: {} },
  engagement: { rules: [], rewards: [], redemptions: [], leaderboard: [], recent_transactions: [], summary: {} },
  wellness: { settings: {}, summary: {}, today_sessions: [], routine: [] },
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
  companyAccess: { members: [], eligible_employees: [], current_user_id: null },
  peopleCore: { departments: [], positions: [], schedules: [], holidays: [], attendance_policy: {}, attendance_reminder: {}, attendance_face: {} },
  activeApproverEmployeeId: null,
  activeLeaveProfileEmployeeId: null,
  currentView: 'dashboard',
  activeSettingsCategory: null,
  settingsNavExpanded: false,
  attendancePolicySaving: false,
  attendancePolicySavedAt: 0,
  attendanceFaceSaving: false,
  attendanceFaceSavedAt: 0,
  attendanceFaceLoaded: false,
  attendanceFaceRolloutBusy: false,
  attendanceFaceRolloutStatus: '',
  organizationViewMode: (() => { try { const saved = localStorage.getItem('nakna.organizationViewMode'); return saved === 'list' ? 'list' : 'chart'; } catch { return 'chart'; } })(),
  teamDirectorySearch: '',
  teamDirectoryDepartment: 'all',
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const DEFAULT_ATTENDANCE_REMINDER_MESSAGE = 'ตอนนี้ 12:30 น. หากเข้าทำงานแล้ว กรุณาเช็กอิน';

let bootWatchdog = null;
let onboardingRefreshInFlight = false;
function isLineInAppBrowser(){const ua=String(navigator.userAgent||'');return /(?:^|[;\s])Line\/[0-9]|LIFF/i.test(ua);}
function setBootStatus(message,showRetry=false){const text=$('#bootStatusText');if(text)text.textContent=message;$('#bootRetryBtn')?.classList.toggle('hidden',!showRetry);}
function initBootLogo(){const logo=$('#bootLogo');if(!logo)return;const markMissing=()=>logo.classList.add('is-missing');logo.addEventListener('error',markMissing,{once:true});if(logo.complete&&logo.naturalWidth===0)markMissing();}
function startBootWatchdog(){clearTimeout(bootWatchdog);setBootStatus('กำลังเตรียมพื้นที่ทำงานของคุณ',false);bootWatchdog=setTimeout(()=>{if(!$('#bootSplash')?.classList.contains('hidden'))setBootStatus('เครือข่ายตอบช้ากว่าปกติ',true);},7000);}
function stopBootWatchdog(){clearTimeout(bootWatchdog);bootWatchdog=null;}

// P7.61 — Stale-while-revalidate startup cache.
// sessionStorage disappeared when the tab was closed, so every reopen behaved
// like a cold start. Keep only the dashboard/company shell in localStorage,
// render it after the session is verified, then refresh in the background.
const DASHBOARD_CACHE_FRESH_MS = 5 * 60 * 1000;
const DASHBOARD_CACHE_MAX_STALE_MS = 12 * 60 * 60 * 1000;
let deferredLoadTimer = null;
let deferredIdleHandle = null;
let deferredLoadInFlight = false;

function dashboardCacheKey() {
  const companyId = Number(state.me?.active_company_id || activeCompany()?.id || 0);
  return companyId ? `nakna.dashboard.${companyId}` : null;
}
function readDashboardCache() {
  const key = dashboardCacheKey();
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    const age = Date.now() - Number(cached?.saved_at || 0);
    if (!cached?.dashboard || age > DASHBOARD_CACHE_MAX_STALE_MS) {
      localStorage.removeItem(key);
      return null;
    }
    cached.is_stale = age > DASHBOARD_CACHE_FRESH_MS;
    cached.age_ms = Math.max(0, age);
    return cached;
  } catch { return null; }
}
function writeDashboardCache() {
  const key = dashboardCacheKey();
  if (!key || !state.dashboard) return;
  try {
    localStorage.setItem(key, JSON.stringify({
      cache_version: 2,
      saved_at: Date.now(),
      dashboard: state.dashboard,
      companyProfile: state.companyProfile || null,
    }));
  } catch {}
}
function clearNaknaStartupCache() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith('nakna.dashboard.')) localStorage.removeItem(key);
    }
  } catch {}
}

let dashboardRefreshTimer = null;
function refreshDashboardSoon(delay = 250){
  clearTimeout(dashboardRefreshTimer);
  dashboardRefreshTimer = setTimeout(() => {
    viewLoadedAt.delete('dashboard');
    loadDashboardFast({ silent: true }).then(()=>markViewLoaded('dashboard')).catch(()=>{});
  }, Math.max(0, delay));
}
function attentionItemByKey(key){
  return (state.dashboard?.attention || []).find(item => String(item.key) === String(key)) || null;
}
function removeAttentionItemsLocally(key, itemKeys = []){
  if(!state.dashboard?.attention?.length) return;
  const removeSet=new Set((itemKeys||[]).map(String));
  const next=[];
  for(const item of state.dashboard.attention){
    if(String(item.key)!==String(key)){ next.push(item); continue; }
    const keys=Array.isArray(item.item_keys)?item.item_keys.map(String):[];
    const remaining=removeSet.size?keys.filter(k=>!removeSet.has(k)):[];
    if(remaining.length){ next.push({...item,item_keys:remaining,count:remaining.length}); }
  }
  state.dashboard={...state.dashboard,attention:next};
  try{ renderDashboard(); writeDashboardCache(); }catch{}
}
function markAttentionRead(key, itemKeys = [], { optimistic = true } = {}){
  const clean=[...new Set((itemKeys||[]).map(String).filter(Boolean))];
  if(!key || !clean.length) return Promise.resolve(false);
  if(optimistic) removeAttentionItemsLocally(key, clean);
  return api('/api/dashboard/attention/read',{method:'POST',body:JSON.stringify({key,item_keys:clean})})
    .then(()=>true)
    .catch(error=>{ console.warn('[Nakna] attention read sync failed', key, error?.message||error); refreshDashboardSoon(800); return false; });
}
function acknowledgeAttentionCategory(key){
  const item=attentionItemByKey(key);
  if(!item?.item_keys?.length) return;
  markAttentionRead(key,item.item_keys,{optimistic:true});
}
function acknowledgeAttentionForView(viewName){
  const map={attendance:['missing'],leave:['leave_pending'],recruitment:['candidate'],'hr-inbox':['hr_private'],requests:['request']};
  for(const key of (map[viewName]||[])) acknowledgeAttentionCategory(key);
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
    // Dashboard is the only first-paint API. Company profile is not required to
    // paint the shell and is fetched after the dashboard so D1 does not compete
    // with the critical request on LINE mobile.
    const dashboard = await api('/api/dashboard', { timeoutMs: 12000 });
    state.dashboard = dashboard || emptyDashboard();
    renderDashboard();
    renderIdentity();
    $('#todayText').textContent = formatDate(state.dashboard.today);
    $('#sidebarCompany').textContent = state.dashboard.client?.name || activeCompany()?.name || 'บริษัทของคุณ';
    writeDashboardCache();
    setTimeout(async()=>{
      try{
        const companyProfile=await api('/api/company-profile',{timeoutMs:12000});
        if(companyProfile){state.companyProfile=companyProfile.company||companyProfile;renderIdentity();writeDashboardCache();}
      }catch{}
    },650);
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
function scheduleDeferredLoad(delay = 4800) {
  clearTimeout(deferredLoadTimer);
  if (deferredIdleHandle && 'cancelIdleCallback' in window) {
    try { cancelIdleCallback(deferredIdleHandle); } catch {}
  }
  const run = async () => {
    if (deferredLoadInFlight || document.hidden) return;
    deferredLoadInFlight = true;
    try {
      // Warm only the two datasets used by the most common People screens.
      // Do NOT load Payroll / Analytics / Recruitment / Integrations in the
      // background: those modules are fetched only when the user opens them.
      await refreshPeopleData({ includeLookups: false, render: ['employees','organization'].includes(state.currentView) });
      markViewLoaded('employees');
      markViewLoaded('organization');
    } catch (error) {
      console.warn('[Nakna] common preload failed', error?.message || error);
    } finally { deferredLoadInFlight = false; }
  };
  deferredLoadTimer = setTimeout(() => {
    if ('requestIdleCallback' in window) deferredIdleHandle = requestIdleCallback(() => run(), { timeout: 4000 });
    else run();
  }, Math.max(0, delay));
}

const VIEW_CACHE_TTL_MS = 45 * 1000;
const viewLoadedAt = new Map();
const viewLoadInFlight = new Map();
function markViewLoaded(name){ viewLoadedAt.set(name, Date.now()); }
function mergePeopleCoreFromServer(incoming){
  if(!incoming)return state.peopleCore;
  if(incoming.attendance_face && typeof incoming.attendance_face.mode === 'string') state.attendanceFaceLoaded = true;
  const recentPolicyChange=state.attendancePolicySaving || (Date.now()-Number(state.attendancePolicySavedAt||0)<4000);
  if(recentPolicyChange && state.peopleCore?.attendance_policy){
    incoming={...incoming,attendance_policy:{...(incoming.attendance_policy||{}),...state.peopleCore.attendance_policy}};
  }
  const recentFaceChange=state.attendanceFaceSaving || (Date.now()-Number(state.attendanceFaceSavedAt||0)<4000);
  if(recentFaceChange && state.peopleCore?.attendance_face){
    incoming={...incoming,attendance_face:{...(incoming.attendance_face||{}),...state.peopleCore.attendance_face}};
  }
  return incoming;
}
function isViewFresh(name){ return Date.now() - Number(viewLoadedAt.get(name) || 0) < VIEW_CACHE_TTL_MS; }
function setViewLoading(name, loading, label = 'กำลังโหลดข้อมูล…'){
  const view=$(`#view-${name}`); if(!view)return;
  let overlay=view.querySelector(':scope > .view-loading-overlay');
  if(loading){
    if(!overlay){
      overlay=document.createElement('div');
      overlay.className='view-loading-overlay';
      overlay.setAttribute('role','status');
      overlay.setAttribute('aria-live','polite');
      overlay.innerHTML=`<span class="view-loading-progress-bar" aria-hidden="true"></span><span class="sr-only">${escapeHtml(label)}</span>`;
      view.prepend(overlay);
    }
    view.classList.add('is-view-loading');
  }else{
    view.classList.remove('is-view-loading');
    overlay?.remove();
  }
}
function renderViewData(name){
  try{
    if(name==='dashboard'){ renderDashboard(); return; }
    if(name==='employees'){ renderEmployees($('#employeeSearch')?.value || ''); renderInviteCenter(); return; }
    if(name==='organization'){ renderPeopleCore(); return; }
    if(name==='recruitment'){ renderCandidates(); renderRecruitmentGmail(); return; }
    if(name==='benefits'){ renderBenefits(); return; }
    if(name==='attendance'){ renderTeamWorkLog(); return; }
    if(name==='leave'){ renderLeaves(); renderLeavePolicies(); return; }
    if(name==='requests'){ renderRequests(); renderEmployeeService(); return; }
    if(name==='hr-inbox'){ renderHrInbox(); return; }
    if(name==='broadcast'){ renderBroadcastPage(); return; }
    if(name==='payroll'){ renderPayroll(); return; }
    if(name==='documents'){ renderDocuments(); return; }
    if(name==='performance'){ renderGrowth(); return; }
    if(name==='engagement'){ renderEngagement(); return; }
    if(name==='wellness'){ renderWellness(); return; }
    if(name==='analytics'){ renderAnalytics(); return; }
    if(name==='saas-admin'){ renderSaasAdmin(); return; }
    if(name==='settings'){ renderSettings(); renderSettingsSidebar(); renderWorkLocations(); renderLeavePolicies(); renderAttendanceSettingsControls({fetchFace:true}); return; }
  }catch(error){ console.warn('[Nakna] render view failed', name, error); }
}
async function loadViewData(name,{force=false}={}){
  if(!name || name==='dashboard'){
    if(force || !isViewFresh('dashboard')) await loadDashboardFast({silent:true});
    markViewLoaded('dashboard');
    return;
  }
  if(!force && isViewFresh(name)){ renderViewData(name); return; }
  if(viewLoadInFlight.has(name)) return viewLoadInFlight.get(name);
  const role=String(activeCompanyRole()||'');
  const isHr=['owner','co_owner','hr_admin','hr'].includes(role);
  const canPayroll=isHr||role==='payroll_admin';
  const canReadBroadcasts=['owner','co_owner','hr_admin','hr','manager'].includes(role);
  const canViewPeople=['owner','co_owner','hr_admin','hr','manager','viewer'].includes(role);
  const load=async(path,fallback=null)=>{ try{return await api(path,{timeoutMs:15000});}catch(error){console.warn('[Nakna] view load',name,path,error?.message||error);return fallback;} };
  const run=(async()=>{
    setViewLoading(name,true);
    try{
      if(name==='employees'){
        const [employees,peopleCore,invites,workLocations]=await Promise.all([load('/api/employees',{data:state.employees}),load('/api/people-core',state.peopleCore),load('/api/invites',{data:state.invites}),load('/api/work-locations',{data:state.workLocations})]);
        state.employees=employees?.data||state.employees; state.peopleCore=mergePeopleCoreFromServer(peopleCore)||state.peopleCore; state.invites=invites?.data||state.invites; state.workLocations=workLocations?.data||state.workLocations;
      }else if(name==='organization'){
        const [employees,peopleCore]=await Promise.all([load('/api/employees',{data:state.employees}),load('/api/people-core',state.peopleCore)]); state.employees=employees?.data||state.employees; state.peopleCore=mergePeopleCoreFromServer(peopleCore)||state.peopleCore;
      }else if(name==='recruitment'){
        const [candidates,gmail]=await Promise.all([load('/api/candidates',{data:state.candidates}),isHr?load('/api/recruitment/gmail/status',state.recruitmentGmail):Promise.resolve(state.recruitmentGmail)]); state.candidates=candidates?.data||state.candidates; state.recruitmentGmail=gmail||state.recruitmentGmail;
      }else if(name==='benefits'){
        const [benefits,employees]=await Promise.all([isHr?load('/api/benefits',state.benefits):Promise.resolve(state.benefits),load('/api/employees',{data:state.employees})]); state.benefits=benefits||state.benefits; state.employees=employees?.data||state.employees;
      }else if(name==='attendance'){
        await loadTeamWorkLog();
      }else if(name==='leave'){
        const [leaves,policies,employees,peopleCore]=await Promise.all([load('/api/leaves',{data:state.leaves}),load('/api/leave-policies',{data:state.leavePolicies}),load('/api/employees',{data:state.employees}),load('/api/people-core',state.peopleCore)]); state.leaves=leaves?.data||state.leaves; state.leavePolicies=policies?.data||state.leavePolicies; state.employees=employees?.data||state.employees; state.peopleCore=mergePeopleCoreFromServer(peopleCore)||state.peopleCore;
      }else if(name==='requests'){
        const [requests,service]=await Promise.all([load('/api/requests',{data:state.requests}),load('/api/employee-service',state.employeeService)]); state.requests=requests?.data||state.requests; state.employeeService=service||state.employeeService;
      }else if(name==='hr-inbox'){
        if(isHr){ const cases=await load('/api/hr-cases',{data:state.hrCases}); state.hrCases=cases?.data||state.hrCases; }
      }else if(name==='broadcast'){
        if(canReadBroadcasts){ const broadcasts=await load('/api/broadcasts',{data:state.broadcasts}); state.broadcasts=broadcasts?.data||state.broadcasts; }
      }else if(name==='payroll'){
        if(canPayroll){ const [payroll,employees]=await Promise.all([load('/api/payroll/overview',state.payroll),load('/api/employees',{data:state.employees})]); state.payroll=payroll||state.payroll; state.employees=employees?.data||state.employees; }
      }else if(name==='documents'){
        if(canPayroll){ const [documents,employees,documentSystem]=await Promise.all([load('/api/documents',state.documents),load('/api/employees',{data:state.employees}),load('/api/document-system/overview',state.documentSystem)]); state.documents=documents||state.documents; state.employees=employees?.data||state.employees; state.documentSystem=documentSystem||state.documentSystem; }
      }else if(name==='performance'){
        if(canReadBroadcasts){ const [learning,performance]=await Promise.all([load('/api/learning/overview',state.learning),load('/api/performance/overview',state.performance)]); state.learning=learning||state.learning; state.performance=performance||state.performance; }
      }else if(name==='engagement'){
        if(canViewPeople){ state.engagement=await load('/api/engagement/overview',state.engagement)||state.engagement; }
      }else if(name==='wellness'){
        if(canViewPeople){ state.wellness=await load('/api/wellness/overview',state.wellness)||state.wellness; }
      }else if(name==='analytics'){
        if(canViewPeople){ state.analytics=await load('/api/analytics/overview',state.analytics)||state.analytics; }
      }else if(name==='saas-admin'){
        state.saasAdmin=await load('/api/admin/saas/overview',state.saasAdmin)||state.saasAdmin;
      }else if(name==='settings'){
        const tasks=[load('/api/company-profile',{company:state.companyProfile}),load('/api/people-core',state.peopleCore),load('/api/work-locations',{data:state.workLocations}),load('/api/leave-policies',{data:state.leavePolicies}),load('/api/subscription',state.subscription),load('/api/integrations/google-workspace',state.googleWorkspace),load('/api/integrations/line',state.lineIntegration)];
        if(isHr)tasks.push(load('/api/approver-access',{data:state.approverAccess,catalog:state.approverPermissionCatalog}));
        const result=await runLoadPool(tasks.map(p=>()=>p),4);
        const [companyProfile,peopleCore,workLocations,leavePolicies,subscription,google,line,approver]=result;
        state.companyProfile=companyProfile?.company||companyProfile||state.companyProfile; state.peopleCore=mergePeopleCoreFromServer(peopleCore)||state.peopleCore; state.workLocations=workLocations?.data||state.workLocations; state.leavePolicies=leavePolicies?.data||state.leavePolicies; state.subscription=subscription||state.subscription; state.googleWorkspace=google||state.googleWorkspace; state.lineIntegration=line||state.lineIntegration; if(approver){state.approverAccess=approver?.data||state.approverAccess;state.approverPermissionCatalog=approver?.catalog||state.approverPermissionCatalog;}
      }
      markViewLoaded(name);
      renderViewData(name);
    }finally{ setViewLoading(name,false); viewLoadInFlight.delete(name); }
  })();
  viewLoadInFlight.set(name,run);
  return run;
}

let peopleRefreshTimer = null;
let peopleRefreshInFlight = null;
let peopleRefreshNeedsLookups = false;

function normalizeNullableId(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function patchEmployeeLocal(employeeId, patch = {}) {
  const employee = state.employees.find(e => Number(e.id) === Number(employeeId));
  if (!employee) return null;
  Object.assign(employee, patch);

  if (Object.prototype.hasOwnProperty.call(patch, 'department_id')) {
    const departmentId = normalizeNullableId(patch.department_id);
    employee.department_id = departmentId;
    const department = (state.peopleCore?.departments || []).find(d => Number(d.id) === Number(departmentId));
    employee.department_name = department?.name || null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'position_id')) {
    const positionId = normalizeNullableId(patch.position_id);
    employee.position_id = positionId;
    const position = (state.peopleCore?.positions || []).find(p => Number(p.id) === Number(positionId));
    employee.position_name = position?.name || null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'manager_employee_id')) {
    employee.manager_employee_id = normalizeNullableId(patch.manager_employee_id);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'people_status')) {
    const peopleStatus = String(patch.people_status || 'employee');
    employee.people_status = peopleStatus;
    employee.status = ['leave_of_absence','resigned','terminated','alumni','inactive'].includes(peopleStatus) ? 'inactive' : 'active';
  }
  if (Array.isArray(patch.location_ids)) {
    const ids = [...new Set(patch.location_ids.map(Number).filter(Number.isFinite))];
    employee.work_location_ids = ids.join(',');
    employee.work_location_names = ids.map(id => state.workLocations.find(x => Number(x.id) === Number(id))?.name).filter(Boolean).join(', ');
  }
  return employee;
}

function renderPeopleFast() {
  try { renderEmployees($('#employeeSearch')?.value || ''); } catch {}
  try { renderPeopleCore(); } catch {}
  try { renderSettingsSidebar(); } catch {}
}

async function refreshPeopleData({ includeLookups = false, render = true } = {}) {
  const tasks = [api('/api/employees'), api('/api/people-core')];
  if (includeLookups) tasks.push(api('/api/lookups'));
  const [employees, peopleCore, lookups] = await Promise.all(tasks);
  state.employees = employees?.data || state.employees || [];
  state.peopleCore = mergePeopleCoreFromServer(peopleCore) || state.peopleCore || { departments: [], positions: [], schedules: [], holidays: [], attendance_policy: {} };
  if (includeLookups && lookups) state.lookups = lookups;
  if (render) renderPeopleFast();
  return true;
}

function schedulePeopleRefresh(delay = 700, { includeLookups = false } = {}) {
  peopleRefreshNeedsLookups = peopleRefreshNeedsLookups || includeLookups;
  clearTimeout(peopleRefreshTimer);
  peopleRefreshTimer = setTimeout(async () => {
    if (peopleRefreshInFlight) {
      schedulePeopleRefresh(350, { includeLookups: peopleRefreshNeedsLookups });
      return;
    }
    const needsLookups = peopleRefreshNeedsLookups;
    peopleRefreshNeedsLookups = false;
    peopleRefreshInFlight = refreshPeopleData({ includeLookups: needsLookups, render: true });
    try { await peopleRefreshInFlight; }
    catch (error) { console.warn('[Nakna] people refresh failed', error?.message || error); }
    finally { peopleRefreshInFlight = null; }
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
  organization: ['ทีมและตำแหน่ง', 'TEAM DIRECTORY'],
  recruitment: ['Recruitment', 'TALENT'],
  benefits: ['สวัสดิการ', 'BENEFITS'],
  attendance: ['เวลาเข้างาน', 'ATTENDANCE CENTER'],
  leave: ['การลา', 'LEAVE'],
  requests: ['Employee Service', 'EMPLOYEE SERVICE'],
  broadcast: ['ประกาศ', 'BROADCAST'],
  payroll: ['Payroll', 'PAYROLL'],
  documents: ['เอกสาร', 'DOCUMENTS'],
  performance: ['Learning & KPI', 'GROWTH OS'],
  engagement: ['แต้ม & ของรางวัล', 'ENGAGEMENT'],
  wellness: ['พักยืดกับนากนะ', 'NAKNA MOVE'],
  analytics: ['People Analytics', 'PEOPLE INTELLIGENCE'],
  'saas-admin': ['Nakna Admin', 'SAAS CONTROL'],
  settings: ['ตั้งค่า', 'SYSTEM'],
};

const settingsCategoryMeta = {
  company: { title: 'ตั้งค่าบริษัท', kicker: 'COMPANY', description: 'ข้อมูลบริษัทและข้อมูลพื้นฐานของ Workspace' },
  worktime: { title: 'ตั้งค่าเวลาทำงาน', kicker: 'WORK SCHEDULE', description: 'ตั้งเวลาระดับบริษัท รายแผนก หรือรายคน พร้อม Grace period' },
  attendance: { title: 'ตั้งค่าการเช็กอิน', kicker: 'ATTENDANCE', description: 'กำหนดสถานที่ พิกัด รัศมี และกติกาเช็กเอาต์นอกพื้นที่' },
  leave: { title: 'การลา & วันหยุด', kicker: 'LEAVE & HOLIDAY', description: 'ตั้งประเภทลา สิทธิ์ช่วงทดลองงาน และปฏิทินวันหยุดบริษัท' },
  approvals: { title: 'สิทธิ์ & การอนุมัติ', kicker: 'APPROVAL FLOW', description: 'กำหนดหัวหน้า ผู้อนุมัติ และสิทธิ์ที่ใช้ในแต่ละ Workflow' },
  integrations: { title: 'การเชื่อมต่อ', kicker: 'INTEGRATIONS', description: 'เชื่อม LINE, Gmail, Google Drive และ Google Sheets' },
  payroll: { title: 'ตั้งค่า Payroll', kicker: 'PAYROLL', description: 'กำหนดวันจ่าย ภาษี ประกันสังคม และกติกาการหัก' },
  billing: { title: 'แพ็กเกจ & Billing', kicker: 'SUBSCRIPTION', description: 'ดู Free Trial, Active Seats, แพ็กเกจ และ Invoice' },
};


let actionStatusCounter = 0;
let actionStatusHideTimer = null;
let actionStatusShowTimer = null;
let actionStatusVisible = false;
let actionStatusHadError = false;

function clearTransientTextCaret() {
  requestAnimationFrame(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
    const selection = window.getSelection?.();
    if (selection?.rangeCount) selection.removeAllRanges();
  });
}

function setButtonBusy(button, busy, label = 'กำลังบันทึก…') {
  if (!button) return;
  if (busy) {
    if (!button.dataset.idleHtml) button.dataset.idleHtml = button.innerHTML;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.innerHTML = `<span class="button-inline-spinner" aria-hidden="true"></span><span>${label}</span>`;
  } else {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    if (button.dataset.idleHtml) {
      button.innerHTML = button.dataset.idleHtml;
      delete button.dataset.idleHtml;
    }
  }
}

function requestActionCopy(path = '', method = 'POST') {
  const p = String(path).toLowerCase();
  const m = String(method || 'POST').toUpperCase();
  if (m === 'DELETE') return ['กำลังลบข้อมูล…', 'กำลังอัปเดตข้อมูลให้ตรงกัน'];
  if (p.includes('/sync')) return ['กำลังซิงก์ข้อมูล…', 'กำลังอัปเดตข้อมูลล่าสุด'];
  if (p.includes('check-in') || p.includes('checkin')) return ['กำลังเช็กอิน…', 'กำลังบันทึกเวลาและตำแหน่ง'];
  if (p.includes('check-out') || p.includes('checkout')) return ['กำลังเช็กเอาต์…', 'กำลังบันทึกเวลาออกงาน'];
  if (p.includes('/publish')) return ['กำลังเผยแพร่…', 'กำลังบันทึกและแจ้งผู้เกี่ยวข้อง'];
  if (p.includes('/generate')) return ['กำลังสร้างข้อมูล…', 'กรุณารอสักครู่'];
  return ['กำลังบันทึก…', 'กำลังบันทึกการเปลี่ยนแปลงของคุณ'];
}

function showActionStatus(title = 'กำลังบันทึก…', text = 'กรุณารอสักครู่') {
  const root = $('#actionStatus');
  if (!root) return;
  clearTimeout(actionStatusHideTimer);
  actionStatusVisible = true;
  root.classList.remove('hidden', 'success', 'error');
  $('#actionStatusTitle').textContent = title;
  $('#actionStatusText').textContent = text;
  document.body?.classList.add('is-mutating');
}

function hideActionStatus(delay = 0){
  const root=$('#actionStatus');
  clearTimeout(actionStatusHideTimer);
  const hide=()=>{root?.classList.add('hidden');document.body?.classList.remove('is-mutating');actionStatusVisible=false;};
  if(delay>0) actionStatusHideTimer=setTimeout(hide,delay); else hide();
}

function beginMutationStatus(path, method, silent = false, target = null) {
  if (silent) return null;
  actionStatusCounter += 1;
  const inlineBusy=Boolean(target)&&target.getAttribute?.('aria-busy')!=='true';
  const tracker={target,done:false,inlineBusy};
  if(inlineBusy){
    target?.classList?.add('nakna-mutation-pending');
    target?.setAttribute?.('aria-busy','true');
  }
  if (actionStatusCounter === 1) {
    actionStatusHadError = false;
    clearTimeout(actionStatusShowTimer);
    const [title, text] = requestActionCopy(path, method);
    // Fast saves should feel instant. Only show a global status when the operation is actually taking time.
    actionStatusShowTimer=setTimeout(()=>{
      if(actionStatusCounter>0) showActionStatus(title,text);
    },450);
  }
  return tracker;
}

function endMutationStatus(tracker, ok = true, errorText = null) {
  if (!tracker || tracker.done) return;
  tracker.done=true;
  if(tracker.inlineBusy){
    tracker.target?.classList?.remove('nakna-mutation-pending');
    tracker.target?.removeAttribute?.('aria-busy');
  }
  actionStatusCounter = Math.max(0, actionStatusCounter - 1);
  if(!ok) actionStatusHadError=true;
  if (actionStatusCounter > 0) return;
  clearTimeout(actionStatusShowTimer);
  const root=$('#actionStatus');
  if(actionStatusHadError){
    if(root){
      root.classList.remove('hidden','success');
      root.classList.add('error');
      $('#actionStatusTitle').textContent='ทำรายการไม่สำเร็จ';
      $('#actionStatusText').textContent=errorText||'กรุณาลองอีกครั้ง หรือตรวจสอบการเชื่อมต่อ';
      actionStatusVisible=true;
      document.body?.classList.remove('is-mutating');
      hideActionStatus(1700);
    }
  }else if(actionStatusVisible){
    // Do not show a second "success" popup; normal toast / updated UI is enough confirmation.
    hideActionStatus(120);
  }else{
    document.body?.classList.remove('is-mutating');
  }
  actionStatusHadError=false;
}

let naknaInteractionSeq = 0;
let naknaInteractionContext = null;
let naknaInteractionHideTimer = null;

function interactionTargetLabel(target){
  if(!target)return 'รายการที่เลือก';
  const aria=String(target.getAttribute?.('aria-label')||'').trim();
  const data=String(target.dataset?.loadingLabel||target.dataset?.label||'').trim();
  const text=String(target.textContent||'').replace(/\s+/g,' ').trim();
  return (data||aria||text||'รายการที่เลือก').slice(0,72);
}

function interactionReadCopy(path=''){
  const p=String(path||'').toLowerCase();
  if(p.includes('/employees/')||p.includes('/employees?')||p.endsWith('/employees'))return ['กำลังเปิดข้อมูลพนักงาน…','กำลังดึงข้อมูลล่าสุดของพนักงาน'];
  if(p.includes('/leave'))return ['กำลังเปิดข้อมูลการลา…','กำลังตรวจสอบสิทธิ์และรายการลา'];
  if(p.includes('/payroll'))return ['กำลังเปิด Payroll…','กำลังโหลดรอบเงินเดือนและข้อมูลที่เกี่ยวข้อง'];
  if(p.includes('/document'))return ['กำลังเปิดเอกสาร…','กำลังโหลดเอกสารและสถานะล่าสุด'];
  if(p.includes('/attendance')||p.includes('/work-log')||p.includes('/work-locations'))return ['กำลังเปิดข้อมูลเวลาเข้างาน…','กำลังโหลด Attendance และสถานที่ทำงาน'];
  if(p.includes('/recruit')||p.includes('/candidate'))return ['กำลังเปิด Recruitment…','กำลังโหลดข้อมูลผู้สมัครล่าสุด'];
  if(p.includes('/performance')||p.includes('/learning'))return ['กำลังเปิดข้อมูลทีม…','กำลังโหลด Learning / KPI ล่าสุด'];
  if(p.includes('/analytics'))return ['กำลังเปิดรายงาน…','กำลังประมวลผลข้อมูลสำหรับหน้านี้'];
  if(p.includes('/company')||p.includes('/people-core')||p.includes('/settings')||p.includes('/integrations'))return ['กำลังเปิดการตั้งค่า…','กำลังโหลดข้อมูลของบริษัท'];
  return ['กำลังโหลดข้อมูล…','ระบบกำลังเตรียมข้อมูลที่คุณเลือก'];
}

function clearNaknaInteractionVisual(context=naknaInteractionContext){
  if(!context)return;
  clearTimeout(context.showTimer);
  context.target?.classList?.remove('nakna-read-pending','nakna-tap-ack');
  if(!context.target?.classList?.contains('nakna-mutation-pending')) context.target?.removeAttribute?.('aria-busy');
  document.body?.classList.remove('nakna-reading');
}

function hideInteractionStatus(delay=0){
  clearTimeout(naknaInteractionHideTimer);
  const root=$('#interactionStatus');
  const hide=()=>root?.classList.add('hidden');
  if(delay>0)naknaInteractionHideTimer=setTimeout(hide,delay);else hide();
}

function showInteractionStatus(context,path){
  if(!context)return;
  // Read/navigation actions use only inline feedback on the button that was actually tapped.
  // No floating popup: view-level loading already has its own progress indicator when needed.
  context.shown=true;
  context.target?.classList?.add('nakna-read-pending');
  context.target?.setAttribute?.('aria-busy','true');
}

function finishInteractionStatus(context,ok=true,errorText=''){
  if(!context)return;
  clearTimeout(context.showTimer);
  context.target?.classList?.remove('nakna-read-pending');
  if(!context.target?.classList?.contains('nakna-mutation-pending')) context.target?.removeAttribute?.('aria-busy');
  document.body?.classList.remove('nakna-reading');
  hideInteractionStatus();
  // Read failures are surfaced by the caller/toast. Avoid a second status popup here.
}

function startUserReadInteraction(path,{silent=false}={}){
  if(silent)return null;
  const context=naknaInteractionContext;
  if(!context||Date.now()-context.startedAt>1800)return null;
  context.pendingReads=(context.pendingReads||0)+1;
  context.lastPath=path;
  clearTimeout(context.expireTimer);
  if(context.pendingReads===1){
    clearTimeout(context.showTimer);
    context.showTimer=setTimeout(()=>showInteractionStatus(context,path),220);
  }
  return context.id;
}

function endUserReadInteraction(contextId,ok=true,errorText=''){
  const context=naknaInteractionContext;
  if(!context||context.id!==contextId)return;
  context.pendingReads=Math.max(0,Number(context.pendingReads||0)-1);
  if(context.pendingReads>0)return;
  finishInteractionStatus(context,ok,errorText);
  clearTimeout(context.expireTimer);
  context.expireTimer=setTimeout(()=>{
    if(naknaInteractionContext?.id===context.id){
      clearNaknaInteractionVisual(context);
      naknaInteractionContext=null;
    }
  },700);
}

function cancelUserInteractionForMutation(){
  const context=naknaInteractionContext;
  if(!context)return;
  clearNaknaInteractionVisual(context);
  hideInteractionStatus();
  naknaInteractionContext=null;
}

function initGlobalInteractionFeedback(){
  if(document.documentElement.dataset.naknaInteractionFeedback==='1')return;
  document.documentElement.dataset.naknaInteractionFeedback='1';
  document.addEventListener('click',event=>{
    const target=event.target?.closest?.('button,a,[role="button"],[data-view]');
    if(!target||target.disabled||target.getAttribute('aria-disabled')==='true')return;
    if(target.closest('#interactionStatus,#actionStatus,#toast'))return;
    if(target.matches('[data-no-action-feedback]'))return;
    if(target.matches('.close-btn,[data-close-dialog],[data-modal-close],[value="cancel"]'))return;
    target.classList.add('nakna-tap-ack');
    setTimeout(()=>target.classList.remove('nakna-tap-ack'),220);
    const old=naknaInteractionContext;
    if(old)clearNaknaInteractionVisual(old);
    const id=++naknaInteractionSeq;
    const context={id,target,label:interactionTargetLabel(target),startedAt:Date.now(),pendingReads:0,shown:false,showTimer:null,expireTimer:null};
    context.expireTimer=setTimeout(()=>{
      if(naknaInteractionContext?.id!==id)return;
      clearNaknaInteractionVisual(context);
      hideInteractionStatus();
      naknaInteractionContext=null;
    },2200);
    naknaInteractionContext=context;
  },true);
}

async function api(path, options = {}) {
  const controller = new AbortController();
  const { timeoutMs: requestedTimeout, silentStatus = false, ...fetchOptions } = options;
  const method = String(fetchOptions.method || 'GET').toUpperCase();
  const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  const trackedRead = !mutating ? startUserReadInteraction(path,{silent:silentStatus}) : null;
  const mutationTarget = mutating ? naknaInteractionContext?.target : null;
  const trackedMutation = mutating ? beginMutationStatus(path, method, silentStatus, mutationTarget) : null;
  if(mutating) cancelUserInteractionForMutation();
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
    clearTimeout(timer);
    endMutationStatus(trackedMutation, false);
    endUserReadInteraction(trackedRead,false,error?.name==='AbortError'?'ใช้เวลานานเกินไป กรุณาลองอีกครั้ง':String(error?.message||error||''));
    if (error?.name === 'AbortError') throw new Error(`API_TIMEOUT:${path}`);
    throw error;
  }
  clearTimeout(timer);

  let data = {};
  try { data = await res.json(); } catch {}

  if (res.status === 401) {
    endMutationStatus(trackedMutation, false);
    endUserReadInteraction(trackedRead,false,'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
    showLogin();
    throw new Error('AUTH_REQUIRED');
  }
  if (res.status === 409 && data.error === 'COMPANY_REQUIRED') {
    endMutationStatus(trackedMutation, false);
    endUserReadInteraction(trackedRead,false,'กรุณาเลือกบริษัทก่อนใช้งาน');
    await loadSessionOnly();
    throw new Error('COMPANY_REQUIRED');
  }
  if (!res.ok) {
    const detail = data.detail ? ` · ${data.detail}` : '';
    const message = `${data.error || `HTTP_${res.status}`}${detail}`;
    endMutationStatus(trackedMutation, false, message);
    endUserReadInteraction(trackedRead,false,message);
    const apiError = new Error(message);
    apiError.status = res.status;
    apiError.data = data;
    throw apiError;
  }
  endMutationStatus(trackedMutation, true);
  endUserReadInteraction(trackedRead,true);
  return data;
}

function inlineLineLoginToken(){
  try{return new URL(window.location.href).searchParams.get('line_login')||'';}catch{return '';}
}
function cleanupInlineLineLoginUrl(){
  try{
    const url=new URL(window.location.href);
    ['line_login','entry'].forEach(key=>url.searchParams.delete(key));
    const query=url.searchParams.toString();
    history.replaceState({},'',`${url.pathname}${query?`?${query}`:''}${url.hash}`);
  }catch{}
}
async function consumeInlineLineSession(){
  const token=inlineLineLoginToken();
  if(!token)return null;
  setBootStatus('กำลังยืนยันสิทธิ์จาก LINE',false);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),9000);
  try{
    const res=await fetch('/api/public/line-session',{method:'POST',credentials:'same-origin',signal:controller.signal,headers:{'content-type':'application/json'},body:JSON.stringify({token})});
    let data={};try{data=await res.json();}catch{}
    if(!res.ok)throw new Error(data.error||`HTTP_${res.status}`);
    cleanupInlineLineLoginUrl();
    return data;
  }finally{clearTimeout(timer);}
}


// P9.10 — one-scroll mobile dialog system for LINE iOS / Safari / Chrome.
let naknaMobileDialogSystemBound = false;
let naknaMobileDialogObserver = null;
function updateNaknaVisualViewport(){
  const vv=window.visualViewport;
  const height=Math.max(320,Math.round(vv?.height||window.innerHeight||720));
  const offsetTop=Math.max(0,Math.round(vv?.offsetTop||0));
  document.documentElement.style.setProperty('--nakna-visual-height',`${height}px`);
  document.documentElement.style.setProperty('--nakna-visual-offset-top',`${offsetTop}px`);
}
function syncNaknaOpenDialogs(){
  const open=[...document.querySelectorAll('dialog[open]')];
  document.body?.classList.toggle('nakna-dialog-open',open.length>0);
  open.forEach(dialog=>dialog.classList.add('nakna-dialog-active'));
  document.querySelectorAll('dialog.nakna-dialog-active:not([open])').forEach(dialog=>dialog.classList.remove('nakna-dialog-active'));
  updateNaknaVisualViewport();
}
function initMobileDialogSystem(){
  if(naknaMobileDialogSystemBound)return;
  naknaMobileDialogSystemBound=true;
  updateNaknaVisualViewport();
  const dialogs=[...document.querySelectorAll('dialog')];
  dialogs.forEach(dialog=>{
    dialog.classList.add('nakna-dialog');
    dialog.addEventListener('close',syncNaknaOpenDialogs);
    dialog.addEventListener('cancel',()=>setTimeout(syncNaknaOpenDialogs,0));
  });
  naknaMobileDialogObserver=new MutationObserver(records=>{
    if(records.some(record=>record.type==='attributes'&&record.attributeName==='open'))syncNaknaOpenDialogs();
  });
  dialogs.forEach(dialog=>naknaMobileDialogObserver.observe(dialog,{attributes:true,attributeFilter:['open']}));
  window.visualViewport?.addEventListener('resize',updateNaknaVisualViewport,{passive:true});
  window.visualViewport?.addEventListener('scroll',updateNaknaVisualViewport,{passive:true});
  window.addEventListener('resize',updateNaknaVisualViewport,{passive:true});
  document.addEventListener('focusin',event=>{
    if(window.matchMedia('(max-width: 720px)').matches===false)return;
    const target=event.target;
    if(!(target instanceof HTMLElement)||!target.matches('input,select,textarea,[contenteditable="true"]'))return;
    const dialog=target.closest('dialog[open]');
    if(!dialog)return;
    // iOS/LINE resizes the visual viewport after the keyboard animation.
    // Re-center the active field after that resize so the sticky footer never covers it.
    setTimeout(()=>{
      updateNaknaVisualViewport();
      try{target.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'});}catch{}
    },280);
  },true);
  syncNaknaOpenDialogs();
}

async function boot() {
  const bootStarted=performance.now();
  closeAllDialogs();
  document.body?.classList.add('nakna-ready');
  showBootSplash();
  startBootWatchdog();
  renderLoadingState();
  const returnState = handleReturnMessage();

  // Start network work immediately. Previously bindEvents + public LINE config
  // ran before /api/me, delaying every reopen inside LINE WebView.
  const sessionPromise=(async()=>{
    const inline=await consumeInlineLineSession();
    if(inline?.workspace_joined) toast('เปิด Workspace ที่ได้รับสิทธิ์แล้ว');
    if(inline?.me) return applySessionPayload(inline.me,{forceNewBusiness:returnState.forceNewBusiness});
    return loadSessionOnly({ forceNewBusiness: returnState.forceNewBusiness, reconcileIdentity: returnState.reconcileIdentity });
  })();
  bindEvents();

  try {
    const ready = await sessionPromise;
    if (!ready) {
      setTimeout(()=>loadPublicOnboarding(),300);
      return;
    }

    showAppShell();
    const hadCache = hydrateDashboardCache();
    if (!hadCache) {
      try { renderFallbackShell(); } catch {}
    }
    console.info(`[Nakna] shell visible ${Math.round(performance.now()-bootStarted)}ms`);
    loadDashboardFast({ silent: true }).then(()=>markViewLoaded('dashboard')).catch(() => {});
    scheduleDeferredLoad(hadCache ? 7000 : 5200);

    // Public LINE config and onboarding checks are useful but not part of first
    // paint. Delaying them prevents extra requests from competing with /api/me
    // and /api/dashboard on mobile networks.
    setTimeout(()=>loadPublicOnboarding(),1800);
    if (!returnState.forceNewBusiness) {
      setTimeout(async()=>{
        const onboardingReady=await maybeRunOnboarding({forceNewBusiness:false});
        if(onboardingReady) showAppShell();
      }, 2200);
    }
  } catch (error) {
    cleanupInlineLineLoginUrl();
    if(String(error?.message||'').includes('LINE_TOKEN')){
      showLogin();
      showLoginError('ลิงก์จาก LINE หมดอายุ กรุณากด Dashboard จากเมนู LINE ใหม่อีกครั้ง');
      return;
    }
    showAppShell();
    if (!['AUTH_REQUIRED','COMPANY_REQUIRED'].includes(error.message)) {
      renderLoadProblem([{ label: 'เริ่มระบบ', message: error.message }]);
    }
  }
}

function bindEvents() {
  ensureAttendanceFaceCard();
  bindAttendanceFaceControls();
  initMobileDialogSystem();
  initGlobalInteractionFeedback();
  $('#lineBusinessBtn').onclick = openLineBusinessOnboarding;
  $('#bootRetryBtn').onclick = () => window.location.reload();
  $('#googleLoginBtn').onclick = () => { window.location.href = '/auth/google/start'; };
  $('#retryDataLoadBtn').onclick = async () => {
    if (await ensureWorkspaceReady()) await loadViewData(state.currentView || 'dashboard',{force:true});
  };
  $$('[data-worklog-mode]').forEach(btn=>btn.onclick=()=>setTeamWorkLogMode(btn.dataset.worklogMode));
  if ($('#teamWorkLogDate')) $('#teamWorkLogDate').onchange=()=>{ if(teamWorkLogMode()==='today') state.teamWorkLogMode='day'; syncTeamWorkLogControls(); $$('[data-worklog-mode]').forEach(btn=>btn.classList.toggle('active',btn.dataset.worklogMode===state.teamWorkLogMode)); loadTeamWorkLog(); };
  if ($('#teamWorkLogPrevBtn')) $('#teamWorkLogPrevBtn').onclick=()=>{const step=teamWorkLogMode()==='week'?-7:-1; $('#teamWorkLogDate').value=shiftDateKey($('#teamWorkLogDate').value||currentBangkokDateKey(),step); if(teamWorkLogMode()==='today') state.teamWorkLogMode='day'; syncTeamWorkLogControls(); $$('[data-worklog-mode]').forEach(btn=>btn.classList.toggle('active',btn.dataset.worklogMode===state.teamWorkLogMode)); loadTeamWorkLog();};
  if ($('#teamWorkLogNextBtn')) $('#teamWorkLogNextBtn').onclick=()=>{const step=teamWorkLogMode()==='week'?7:1; $('#teamWorkLogDate').value=shiftDateKey($('#teamWorkLogDate').value||currentBangkokDateKey(),step); if(teamWorkLogMode()==='today') state.teamWorkLogMode='day'; syncTeamWorkLogControls(); $$('[data-worklog-mode]').forEach(btn=>btn.classList.toggle('active',btn.dataset.worklogMode===state.teamWorkLogMode)); loadTeamWorkLog();};
  if ($('#teamWorkLogMonth')) $('#teamWorkLogMonth').onchange=()=>loadTeamWorkLog();
  if ($('#teamWorkLogApplyRangeBtn')) $('#teamWorkLogApplyRangeBtn').onclick=()=>loadTeamWorkLog();
  if ($('#teamWorkLogStartDate')) $('#teamWorkLogStartDate').onchange=()=>{if($('#teamWorkLogEndDate')&&$('#teamWorkLogEndDate').value<$('#teamWorkLogStartDate').value) $('#teamWorkLogEndDate').value=$('#teamWorkLogStartDate').value;};
  if ($('#teamWorkLogSearch')) $('#teamWorkLogSearch').addEventListener('input', renderTeamWorkLog);
  if ($('#teamWorkLogDepartmentFilter')) $('#teamWorkLogDepartmentFilter').addEventListener('change', renderTeamWorkLog);
  if ($('#teamWorkLogStatusFilter')) $('#teamWorkLogStatusFilter').addEventListener('change', renderTeamWorkLog);
  if ($('#teamWorkLogClearFilterBtn')) $('#teamWorkLogClearFilterBtn').onclick=()=>{if($('#teamWorkLogSearch'))$('#teamWorkLogSearch').value='';if($('#teamWorkLogDepartmentFilter'))$('#teamWorkLogDepartmentFilter').value='';if($('#teamWorkLogStatusFilter'))$('#teamWorkLogStatusFilter').value='all';renderTeamWorkLog();};
  if ($('#attendanceSummaryExportBtn')) $('#attendanceSummaryExportBtn').onclick=exportAttendancePeriodSummaryCsv;
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
  $('#accountMenuBtn').onclick = event => {
    event.stopPropagation();
    const menu=$('#accountMenu');
    const willOpen=menu.classList.contains('hidden');
    menu.classList.toggle('hidden',!willOpen);
    $('#accountMenuBtn').setAttribute('aria-expanded',String(willOpen));
    $('#companyMenu').classList.add('hidden');
  };
  $('#accountLinkGoogleBtn').onclick=()=>{window.location.href='/auth/google/start?link=1';};
  $('#accountSwitchLoginBtn').onclick=async()=>{try{await fetch('/auth/logout',{method:'POST',credentials:'same-origin'});}catch{} window.location.href='/auth/google/start';};
  $('#accountLogoutBtn').onclick=logout;
  $('#deleteCompanySaveBtn').onclick=deleteCompanyConfirmed;
  document.addEventListener('click', () => {
    $('#companyMenu').classList.add('hidden');
    $('#companySwitcher').setAttribute('aria-expanded', 'false');
    $('#accountMenu')?.classList.add('hidden');
    $('#accountMenuBtn')?.setAttribute('aria-expanded','false');
  });
  $('#accountMenu')?.addEventListener('click',event=>event.stopPropagation());

  // Universal close handler. Works for native <dialog> and fullscreen/custom viewers.
  // Capture phase prevents required-field validation or overlay layers from trapping the X/Cancel button.
  const closeDialogLike = trigger => {
    if (!trigger) return false;
    const dialog = trigger.closest('dialog');
    if (dialog) {
      try { if (dialog.open) dialog.close('cancel'); else dialog.removeAttribute('open'); }
      catch { dialog.removeAttribute('open'); }
      return true;
    }
    const root = trigger.closest('[data-modal-root], [role="dialog"], .modal-overlay, .fullscreen-modal, .chart-modal, .organization-chart-modal, .org-chart-modal');
    if (!root) return false;
    root.classList.add('hidden');
    root.setAttribute('aria-hidden', 'true');
    root.style.display = 'none';
    document.body.classList.remove('modal-open','dialog-open','chart-open');
    document.documentElement.classList.remove('modal-open','dialog-open','chart-open');
    return true;
  };
  document.addEventListener('click', event => {
    const cancel = event.target.closest('button[value="cancel"], .close-btn, [data-dialog-close], [data-modal-close], [aria-label="ปิด"], [aria-label="Close"], .modal-close, .chart-close');
    if (!cancel) return;
    if (!closeDialogLike(cancel)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const openDialog = document.querySelector('dialog[open]');
    if (openDialog) { event.preventDefault(); try { openDialog.close('cancel'); } catch { openDialog.removeAttribute('open'); } return; }
    const custom = document.querySelector('[data-modal-root]:not(.hidden), [role="dialog"]:not(.hidden), .modal-overlay:not(.hidden), .fullscreen-modal:not(.hidden), .chart-modal:not(.hidden), .organization-chart-modal:not(.hidden), .org-chart-modal:not(.hidden)');
    if (custom) { custom.classList.add('hidden'); custom.setAttribute('aria-hidden','true'); custom.style.display='none'; }
  });
  if ($('#companyProfileShortcut')) $('#companyProfileShortcut').onclick = openCompanyProfileModal;
  $('#statusCompanyAction').onclick = openCompanyProfileModal;
  $('#companyProfileSaveBtn').onclick = saveCompanyProfile;
  $('#companyLogoFile').onchange = handleCompanyLogoFile;
  $('#companyLogoRemoveBtn').onclick = removeCompanyLogo;
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
  $('#addCompanyAccessBtn').onclick = openCompanyAccessModal;
  $('#companyAccessSaveBtn').onclick = saveCompanyAccess;
  $('#companyAccessRoleSelect').onchange = renderCompanyAccessRoleHint;
  $('#addApproverAccessBtn').onclick = () => openApproverAccessModal();
  $('#approverAccessSaveBtn').onclick = saveApproverAccess;
  $('#approverRolePreset').onchange = applyApproverRolePreset;
  $('#copyLineWebhookModalBtn').onclick = copyLineWebhookFromModal;
  $('#refreshBtn').onclick = () => loadViewData(state.currentView || 'dashboard',{force:true});
  $('#createBroadcastBtn').onclick = openBroadcastModal;
  $('#broadcastAudience').onchange = renderBroadcastAudienceFields;
  $('#broadcastRequiresAck').onchange = renderBroadcastAckFields;
  $('#broadcastSendBtn').onclick = sendBroadcast;
  $('#broadcastRemindPendingBtn').onclick = remindPendingBroadcast;
  if ($('#createBroadcastPageBtn')) $('#createBroadcastPageBtn').onclick = openBroadcastModal;
  $('#setupRichMenuBtn').onclick = setupRichMenu;
  $('#removeRichMenuBtn').onclick = removeRichMenu;
  $('#hrCaseSaveBtn').onclick = saveHrCase;
  $('#probationLeaveLockToggle').onchange = saveProbationLeaveLock;
  $('#payrollSettingsBtn').onclick = openPayrollSettingsModal;
  $('#payrollSettingsSaveBtn').onclick = savePayrollSettings;
  $('#createPayrollPeriodBtn').onclick = openPayrollPeriodModal;
  $('#payrollPeriodCreateBtn').onclick = createPayrollPeriod;
  $('#payrollProfileSaveBtn').onclick = savePayrollProfile;
  if ($('#payrollQuickEditSaveBtn')) $('#payrollQuickEditSaveBtn').onclick = savePayrollQuickEdit;
  $('#payrollAdjustmentSaveBtn').onclick = savePayrollAdjustment;
  $('#payrollAdjustmentCategory').onchange = syncPayrollAdjustmentMode;
  $('#payrollAdjustmentType').onchange = syncPayrollAdjustmentCategory;
  if ($('#payrollBulkSaveBtn')) $('#payrollBulkSaveBtn').onclick = savePayrollBulkAdjustment;
  if ($('#payrollComponentSaveBtn')) $('#payrollComponentSaveBtn').onclick = savePayrollComponent;
  if ($('#payrollComponentsBtn')) $('#payrollComponentsBtn').onclick = window.openPayrollComponentsModal;
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
  if($('#wellnessSaveBtn')) $('#wellnessSaveBtn').onclick = saveWellnessSettings;
  if($('#wellnessRemindNowBtn')) $('#wellnessRemindNowBtn').onclick = sendWellnessReminderNow;
  if($('#wellnessPreviewBtn')) $('#wellnessPreviewBtn').onclick = openWellnessPreview;
  if($('#wellnessTestTiming')) $('#wellnessTestTiming').onchange = syncWellnessTestTimingUi;
  if($('#wellnessTestSendBtn')) $('#wellnessTestSendBtn').onclick = sendWellnessTestReminder;
  if($('#wellnessTestScheduleStatus')) $('#wellnessTestScheduleStatus').onclick = event => { const btn=event.target.closest('[data-cancel-wellness-test]'); if(btn) cancelWellnessTestSchedule(Number(btn.dataset.cancelWellnessTest)); };
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
      state.activeSettingsJump = null;
      showView('settings');
      openSettingsCategory(target, { scroll: false });
    };
  });
  $('#settingsPayrollOpenBtn').onclick = openPayrollSettingsModal;

  $('#addEmployeeBtn').onclick = openEmployeeModal;
  $('#inviteEmployeeBtn').onclick = openInviteModal;
  $('#inviteEmployeeBtnInline').onclick = openInviteModal;
  $('#addWorkLocationBtn').onclick = openWorkLocationModal;
  $('#addDepartmentBtn').onclick = openDepartmentModal;
  $('#addPositionBtn').onclick = openPositionModal;
  $('#positionAssignSaveBtn').onclick = savePositionAssignment;
  $('#positionAssignSearch').addEventListener('input', renderPositionAssignPeople);
  $('#addScheduleBtn').onclick = openScheduleModal;
  $('#addHolidayBtn').onclick = openHolidayModal;
  $('#departmentSaveBtn').onclick = saveDepartment;
  $('#departmentAssignSaveBtn').onclick = saveDepartmentAssignment;
  $('#departmentAssignSearch').addEventListener('input', renderDepartmentAssignPeople);
  if ($('#organizationBuilderRefreshBtn')) $('#organizationBuilderRefreshBtn').onclick = renderOrganizationBuilder;
  if ($('#organizationRootDropZone')) { $('#organizationRootDropZone').ondragover = e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }; $('#organizationRootDropZone').ondragleave = e => e.currentTarget.classList.remove('drag-over'); $('#organizationRootDropZone').ondrop = async e => { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); const id=Number(e.dataTransfer.getData('text/plain')||0); if(id) await setDepartmentParentQuick(id,null); }; }
  if ($('#departmentLinkSaveBtn')) $('#departmentLinkSaveBtn').onclick = saveDepartmentLink;
  $('#positionSaveBtn').onclick = savePosition;
  if ($('#peopleProfileCreatePositionBtn')) $('#peopleProfileCreatePositionBtn').onclick = () => { $('#peopleProfileModal')?.close(); state.returnToPeopleProfileAfterPosition = Number($('#peopleProfileEmployeeId')?.value||0); openPositionModal(); };
  $$('[data-position-preset]').forEach(button=>button.onclick=()=>{ if($('#positionName')) $('#positionName').value=button.dataset.positionPreset||''; });
  $('#scheduleSaveBtn').onclick = saveSchedule;
  $('#scheduleScopeType').onchange = refreshScheduleTarget;
  $('#holidaySaveBtn').onclick = saveHoliday;
  $('#attendancePolicyToggle').onchange = saveAttendancePolicy;
  if ($('#attendanceFaceSaveBtn')) $('#attendanceFaceSaveBtn').onclick = () => saveAttendanceFaceSettings({ silentSuccess: false });
  bindAttendanceFaceControls();
  if ($('#attendanceReminderToggle')) $('#attendanceReminderToggle').onchange = () => { updateAttendanceReminderEditor(); saveAttendanceReminderSettings({fromToggle:true}); };
  if ($('#attendanceReminderMessage')) $('#attendanceReminderMessage').oninput = updateAttendanceReminderEditor;
  if ($('#attendanceReminderResetBtn')) $('#attendanceReminderResetBtn').onclick = () => { $('#attendanceReminderMessage').value=DEFAULT_ATTENDANCE_REMINDER_MESSAGE; updateAttendanceReminderEditor(); $('#attendanceReminderMessage').focus(); };
  if ($('#attendanceReminderSaveBtn')) $('#attendanceReminderSaveBtn').onclick = () => saveAttendanceReminderSettings();
  $('#peopleProfileSaveBtn').onclick = savePeopleProfile;
  if ($('#peopleFaceResetBtn')) $('#peopleFaceResetBtn').onclick = resetPeopleFaceProfile;
  $('#addLeaveBtn').onclick = openLeaveRequestModal;
  if ($('#leaveReportMonth')) {
    $('#leaveReportMonth').value = currentBangkokMonth();
    $('#leaveReportMonth').onchange = () => loadLeaveMonthlyReport($('#leaveReportMonth').value);
  }
  if ($('#leaveReportStatus')) $('#leaveReportStatus').onchange = renderLeaveMonthlyReport;
  if ($('#leaveReportPrevBtn')) $('#leaveReportPrevBtn').onclick = () => loadLeaveMonthlyReport(shiftMonthKey($('#leaveReportMonth').value,-1));
  if ($('#leaveReportNextBtn')) $('#leaveReportNextBtn').onclick = () => loadLeaveMonthlyReport(shiftMonthKey($('#leaveReportMonth').value,1));
  if ($('#leaveReportExportBtn')) $('#leaveReportExportBtn').onclick = exportLeaveMonthlyReportCsv;
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

function applySessionPayload(data,{forceNewBusiness=false}={}){
  state.me=data;
  hideLogin();
  renderIdentity();
  if(forceNewBusiness||data?.setup_mode==='new'){
    showOnboarding({step:'company',forceNewBusiness:true});
    return false;
  }
  if(!(data?.companies||[]).length){
    showOnboarding({step:'company'});
    return false;
  }
  return true;
}
async function loadSessionOnly({ forceNewBusiness = false, reconcileIdentity = false } = {}) {
  try {
    const meUrl = reconcileIdentity ? '/api/me?reconcile=1' : '/api/me';
    const data = await api(meUrl, { timeoutMs: 9000 });
    return applySessionPayload(data,{forceNewBusiness});
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
        onboarding_source: 'line_web',
        confirm_new_workspace: true
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
  clearNaknaStartupCache();
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
        const hadCache=hydrateDashboardCache();
        if(!hadCache) renderLoadingState();
        loadDashboardFast({silent:true}).catch(()=>{});
        scheduleDeferredLoad(hadCache?900:350);
      }
    }
    toast('เปลี่ยนบริษัทเรียบร้อยแล้ว');
  } catch (error) {
    if (!['AUTH_REQUIRED','COMPANY_REQUIRED'].includes(error.message)) toast(error.message, true);
  }
}

function openDeleteCompanyModal(clientId){
  const company=(state.me?.companies||[]).find(item=>Number(item.id)===Number(clientId));
  if(!company)return toast('ไม่พบบริษัท',true);
  $('#deleteCompanyId').value=String(company.id);
  $('#deleteCompanyName').textContent=company.name;
  $('#deleteCompanyEmployeeCount').textContent=String(Number(company.employee_count||0));
  $('#deleteCompanyConfirmName').value='';
  $('#deleteCompanyConfirmName').placeholder=company.name;
  $('#companyMenu').classList.add('hidden');
  $('#deleteCompanyModal').showModal();
  setTimeout(()=>$('#deleteCompanyConfirmName')?.focus(),120);
}

async function deleteCompanyConfirmed(){
  const id=Number($('#deleteCompanyId').value||0);
  const company=(state.me?.companies||[]).find(item=>Number(item.id)===id);
  if(!company)return toast('ไม่พบบริษัท',true);
  const confirmName=$('#deleteCompanyConfirmName').value.trim();
  if(confirmName!==String(company.name||'').trim())return toast('พิมพ์ชื่อบริษัทให้ตรงก่อนลบ',true);
  const button=$('#deleteCompanySaveBtn');button.disabled=true;
  try{
    await api(`/api/companies/${id}`,{method:'DELETE',body:JSON.stringify({confirm_name:confirmName})});
    $('#deleteCompanyModal').close();
    state.dashboardCache=null;
    const ready=await loadSessionOnly({forceNewBusiness:false});
    if(!ready){showLogin();return;}
    if(state.me?.active_company_id){showAppShell();await loadAll({silent:true});}
    else{await maybeRunOnboarding({forceNewBusiness:true});}
    toast('ลบบริษัทออกจากนากนะแล้ว');
  }catch(error){toast(error.message,true);}finally{button.disabled=false;}
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
    const companyAvatar=$('#companyAvatar'); const companyLogo=active.logo_data_url||''; companyAvatar.textContent=companyLogo?'':(active.name||'N').trim().slice(0,1).toUpperCase(); companyAvatar.classList.toggle('has-logo',Boolean(companyLogo)); companyAvatar.style.backgroundImage=companyLogo?`url("${String(companyLogo).replace(/"/g,'%22')}")`:'';
  }

  $('#companyMenu').innerHTML = memberships.map(company => `
    <div class="company-menu-row ${Number(company.id) === Number(me.active_company_id) ? 'active' : ''}">
      <button class="company-menu-item" data-company-id="${Number(company.id)}" role="menuitem">
        <span class="company-menu-avatar ${company.logo_data_url?'has-logo':''}" ${company.logo_data_url?`style="background-image:url('${String(company.logo_data_url).replace(/'/g,'%27')}')"`:''}>${company.logo_data_url?'':escapeHtml((company.name||'N').slice(0,1).toUpperCase())}</span>
        <span><strong>${escapeHtml(company.name)}</strong><small>${escapeHtml(roleLabel(company.role))} · ${Number(company.employee_count||0)} คน${company.duplicate_name?` · Workspace #${Number(company.id)}`:''}</small></span>
        ${Number(company.id) === Number(me.active_company_id) ? '<b>✓</b>' : ''}
      </button>
      ${String(company.role)==='owner'?`<button class="company-delete-btn" type="button" data-delete-company-id="${Number(company.id)}" title="ลบบริษัท" aria-label="ลบ ${escapeHtml(company.name)}"><span aria-hidden="true">×</span><b>ลบ</b></button>`:''}
    </div>`).join('');
  $$('[data-company-id]').forEach(button => {
    button.onclick = event => {
      event.stopPropagation();
      $('#companyMenu').classList.add('hidden');
      switchCompany(button.dataset.companyId);
    };
  });
  $$('[data-delete-company-id]').forEach(button=>{
    button.onclick=event=>{event.stopPropagation();openDeleteCompanyModal(Number(button.dataset.deleteCompanyId));};
  });

  const accountAvatar=$('#accountMenuAvatar');
  $('#accountMenuName').textContent=user.name||user.email||'บัญชีนากนะ';
  $('#accountMenuEmail').textContent=user.email||'เชื่อมผ่าน LINE';
  $('#accountProviderBadge').textContent=user.google_connected&&user.line_connected?'Google + LINE':user.google_connected?'Google':'LINE';
  $('#accountWorkspaceText').textContent=active?`${active.name} · ${roleLabel(active.role)}`:'ยังไม่มี Workspace';
  $('#accountLinkGoogleTitle').textContent=user.google_connected?'บัญชี Google เชื่อมแล้ว':'เชื่อมบัญชี Google';
  accountAvatar.textContent=(user.name||user.email||'U').trim().slice(0,1).toUpperCase();
  accountAvatar.classList.toggle('has-photo',Boolean(user.picture_url));
  accountAvatar.style.backgroundImage=user.picture_url?`url("${String(user.picture_url).replace(/"/g,'%22')}")`:'';
}

function roleLabel(role) {
  return ({ owner:'Primary Owner', co_owner:'Co-Owner', hr_admin:'HR Admin', hr:'HR', payroll_admin:'Payroll Admin', manager:'Manager', approver:'Approver', employee:'Employee', viewer:'Viewer' })[role] || role || 'Member';
}

function activeCompanyRole() {
  const me = state.me || {};
  return (me.companies || []).find(company => Number(company.id) === Number(me.active_company_id))?.role || null;
}

function canHrOverrideLeave() {
  return ['owner','co_owner','hr_admin','hr'].includes(String(activeCompanyRole() || ''));
}

function activeCompany() {
  const me = state.me || {};
  return (me.companies || []).find(company => Number(company.id) === Number(me.active_company_id)) || null;
}

function companyProfileCompleted(profile) {
  return Boolean(profile && String(profile.name || '').trim() && String(profile.work_start || '').trim() && String(profile.work_end || '').trim());
}

function canManageCompanyProfile() { return ['owner','co_owner','hr_admin','hr'].includes(String(activeCompanyRole() || '')); }
function canManageGoogleWorkspace() { return ['owner','co_owner','hr_admin'].includes(String(activeCompanyRole() || '')); }

function fillCompanyProfileForm() {
  const profile = state.companyProfile || state.dashboard?.client || activeCompany() || {};
  if ($('#companyProfileName')) $('#companyProfileName').value = profile.name || '';
  if ($('#companyProfileWorkStart')) $('#companyProfileWorkStart').value = profile.work_start || '09:00';
  if ($('#companyProfileWorkEnd')) $('#companyProfileWorkEnd').value = profile.work_end || '18:00';
  if ($('#companyProfileLateGrace')) $('#companyProfileLateGrace').value = profile.late_grace_minutes ?? 10;
  if ($('#companyProfileTimezone')) $('#companyProfileTimezone').value = profile.timezone || 'Asia/Bangkok';
  if ($('#companyLogoFile')) $('#companyLogoFile').value='';
  renderCompanyLogoEditor(profile.logo_data_url || '');
}

function openCompanyProfileModal() {
  showView('settings');
  openSettingsCategory('company', { scroll: false });
  fillCompanyProfileForm();
  requestAnimationFrame(() => document.querySelector('#companyProfileInline')?.scrollIntoView({behavior:'smooth',block:'start'}));
}

function renderCompanyLogoEditor(dataUrl='') {
  const preview=$('#companyLogoPreview'); if(!preview)return;
  preview.innerHTML=dataUrl?`<img src="${String(dataUrl).replace(/"/g,'%22')}" alt="โลโก้บริษัท"/>`:'<span>โลโก้</span>';
  preview.dataset.current=dataUrl||'';
  $('#companyLogoRemoveBtn')?.classList.toggle('hidden',!dataUrl);
}

async function fileToDataUrl(file){
  return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(new Error('อ่านไฟล์โลโก้ไม่สำเร็จ'));reader.readAsDataURL(file);});
}

async function handleCompanyLogoFile(){
  const file=$('#companyLogoFile')?.files?.[0]; if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))return toast('รองรับเฉพาะ PNG, JPG และ WebP',true);
  if(file.size>512*1024){$('#companyLogoFile').value='';return toast('โลโก้ต้องมีขนาดไม่เกิน 512 KB',true);}
  try{const dataUrl=await fileToDataUrl(file);renderCompanyLogoEditor(dataUrl);$('#companyLogoPreview').dataset.pending=dataUrl;}catch(error){toast(error.message,true);}
}

async function removeCompanyLogo(){
  const button=$('#companyLogoRemoveBtn');button.disabled=true;
  try{await api('/api/company-logo',{method:'DELETE'}); if(state.companyProfile)state.companyProfile.logo_data_url=''; const active=activeCompany();if(active)active.logo_data_url=''; renderCompanyLogoEditor('');renderIdentity();toast('ลบโลโก้บริษัทแล้ว');}
  catch(error){toast(error.message,true);}finally{button.disabled=false;}
}

async function saveCompanyProfile() {
  const body={name:$('#companyProfileName').value.trim(),work_start:$('#companyProfileWorkStart').value,work_end:$('#companyProfileWorkEnd').value,late_grace_minutes:Number($('#companyProfileLateGrace').value||0),timezone:$('#companyProfileTimezone').value.trim()||'Asia/Bangkok'};
  if(body.name.length<2)return toast('กรุณาใส่ชื่อบริษัท',true);
  const button=$('#companyProfileSaveBtn');button.disabled=true;button.textContent='กำลังบันทึก…';
  try{let result=await api('/api/company-profile',{method:'PATCH',body:JSON.stringify(body)});const pending=$('#companyLogoPreview')?.dataset?.pending||'';if(pending){const logoResult=await api('/api/company-logo',{method:'PUT',body:JSON.stringify({data_url:pending})});result.company.logo_data_url=logoResult.logo_data_url||pending;delete $('#companyLogoPreview').dataset.pending;}state.companyProfile=result.company;const active=activeCompany();if(active){active.name=result.company.name;active.logo_data_url=result.company.logo_data_url||active.logo_data_url||'';}renderIdentity();renderSettings();fillCompanyProfileForm();toast('บันทึกข้อมูลบริษัทแล้ว');}
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
  const joinedWorkspace = url.searchParams.get('workspace') === 'joined';
  const reconcileIdentity = url.searchParams.get('account') === 'linked';
  if (googleConnected) toast('เชื่อม Gmail + Drive + Google Sheets เรียบร้อยแล้ว');
  if (url.searchParams.get('auth') === 'success') toast('เข้าสู่ระบบด้วย Google เรียบร้อยแล้ว');
  if (url.searchParams.get('account') === 'linked') toast('เชื่อมบัญชี Google กับ LINE แล้ว · มือถือและคอมใช้บัญชีเดียวกัน');
  if (url.searchParams.get('account_error') === 'link') toast('เชื่อมบัญชี Google ไม่สำเร็จ กรุณาลองใหม่', true);
  if (joinedWorkspace) toast('เข้าร่วม Workspace เดิมเรียบร้อยแล้ว · ไม่ต้องสร้างธุรกิจใหม่');
  if (url.searchParams.get('auth') === 'line') toast(forceNewBusiness ? 'ยืนยัน LINE แล้ว · กำลังสร้าง Workspace ใหม่' : joinedWorkspace ? 'เปิด Workspace ที่ได้รับสิทธิ์แล้ว' : 'เข้าสู่ระบบผ่าน LINE เรียบร้อยแล้ว');
  if (url.searchParams.has('auth_error')) {
    const code = url.searchParams.get('auth_error');
    showLoginError(code === 'line_token'
      ? 'ลิงก์จาก LINE หมดอายุหรือถูกใช้แล้ว พิมพ์ “เชื่อมธุรกิจ” ใน LINE เพื่อขอลิงก์ใหม่'
      : code === 'line_membership'
        ? 'บัญชี LINE นี้ไม่มีสิทธิ์เข้าธุรกิจดังกล่าว'
        : 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่');
  }
  if (url.searchParams.has('google_workspace_error')) toast(googleWorkspaceErrorText(url.searchParams.get('google_workspace_error')), true);
  const cleanup = ['google_workspace','google_workspace_error','auth','auth_error','account','account_error','setup','workspace'];
  if ([...url.searchParams.keys()].some(key => cleanup.includes(key))) {
    cleanup.forEach(key => url.searchParams.delete(key));
    const query = url.searchParams.toString();
    history.replaceState({}, '', `${url.pathname}${query ? `?${query}` : ''}${url.hash}`);
  }
  return { forceNewBusiness, googleConnected, joinedWorkspace, reconcileIdentity };
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
    const isHr=['owner','co_owner','hr_admin','hr'].includes(role);
    const canPayroll=isHr||role==='payroll_admin';
    const canReadBroadcasts=['owner','co_owner','hr_admin','hr','manager'].includes(role);
    const canViewPeople=['owner','co_owner','hr_admin','hr','manager','viewer'].includes(role);
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
      () => canPayroll ? safeLoad('Payroll', api('/api/payroll/overview'), () => state.payroll) : Promise.resolve(null),
      () => canPayroll ? safeLoad('เอกสาร', api('/api/documents'), () => state.documents || {data:[],payslips:[]}) : Promise.resolve({data:[],payslips:[]}),
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
    state.peopleCore = mergePeopleCoreFromServer(peopleCore) || { departments: [], positions: [], schedules: [], holidays: [], attendance_policy: {} };
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
    renderDashboard();
    renderIdentity();
    $('#todayText').textContent = formatDate(state.dashboard.today);
    $('#sidebarCompany').textContent = state.dashboard.client?.name || activeCompany()?.name || 'บริษัทของคุณ';
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
  if ($('#teamWorkLogBody')) $('#teamWorkLogBody').innerHTML = Array.from({length:4},()=>'<tr><td colspan="7"><div class="loading-row skeleton"></div></td></tr>').join('');
}

function renderAll() {
  renderDashboard();
  renderEmployees($('#employeeSearch')?.value || '');
  renderCandidates();
  renderRecruitmentGmail();
  renderBenefits();
  renderAttendance();
  renderLeaves();
  if ($('#leaveReportMonth') && !state.leaveMonthlyReport) loadLeaveMonthlyReport($('#leaveReportMonth').value || currentBangkokMonth());
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


function currentBangkokDateKey(){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}
function shiftDateKey(dateKey,delta){
  const [y,m,d]=String(dateKey||currentBangkokDateKey()).split('-').map(Number);
  const dt=new Date(Date.UTC(y,m-1,d+delta));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`;
}
function teamWorkLogMode(){return state.teamWorkLogMode||'today';}
function currentBangkokMonthKey(){return currentBangkokDateKey().slice(0,7);}
function monthBounds(monthKey){
  const [y,m]=String(monthKey||currentBangkokMonthKey()).split('-').map(Number);
  const last=new Date(Date.UTC(y,m,0));
  return {start:`${y}-${String(m).padStart(2,'0')}-01`,end:`${y}-${String(m).padStart(2,'0')}-${String(last.getUTCDate()).padStart(2,'0')}`};
}
function syncTeamWorkLogControls(){
  const mode=teamWorkLogMode();
  const single=$('#teamWorkLogSingleDateControls'), month=$('#teamWorkLogMonth'), range=$('#teamWorkLogRangeControls');
  if(single) single.hidden=mode==='month'||mode==='range';
  if(month) month.hidden=mode!=='month';
  if(range) range.hidden=mode!=='range';
  if(mode==='month'&&month&&!month.value) month.value=currentBangkokMonthKey();
  if(mode==='range'){
    const today=currentBangkokDateKey();
    if($('#teamWorkLogStartDate')&&!$('#teamWorkLogStartDate').value) $('#teamWorkLogStartDate').value=shiftDateKey(today,-29);
    if($('#teamWorkLogEndDate')&&!$('#teamWorkLogEndDate').value) $('#teamWorkLogEndDate').value=today;
  }
}
function setTeamWorkLogMode(mode){
  state.teamWorkLogMode=['today','day','week','month','range'].includes(mode)?mode:'today';
  $$('[data-worklog-mode]').forEach(btn=>btn.classList.toggle('active',btn.dataset.worklogMode===state.teamWorkLogMode));
  if(state.teamWorkLogMode==='today' && $('#teamWorkLogDate')) $('#teamWorkLogDate').value=currentBangkokDateKey();
  syncTeamWorkLogControls();
  loadTeamWorkLog();
}
async function loadTeamWorkLog(){
  const mode=teamWorkLogMode();
  let params=new URLSearchParams({mode});
  if(mode==='month'){
    const month=$('#teamWorkLogMonth')?.value||currentBangkokMonthKey(); if($('#teamWorkLogMonth')) $('#teamWorkLogMonth').value=month; params.set('month',month);
  }else if(mode==='range'){
    const start=$('#teamWorkLogStartDate')?.value||shiftDateKey(currentBangkokDateKey(),-29);
    const end=$('#teamWorkLogEndDate')?.value||currentBangkokDateKey();
    if(start>end){toast('วันที่เริ่มต้องไม่มากกว่าวันสิ้นสุด',true);return;}
    params.set('start',start);params.set('end',end);
  }else{
    const date=mode==='today'?currentBangkokDateKey():($('#teamWorkLogDate')?.value||currentBangkokDateKey());
    if($('#teamWorkLogDate')) $('#teamWorkLogDate').value=date; params.set('date',date);
  }
  syncTeamWorkLogControls();
  const body=$('#teamWorkLogBody'); if(body) body.innerHTML=`<tr><td colspan="7"><div class="leave-report-empty">กำลังโหลดเวลาเข้างานของทีม…</div></td></tr>`;
  try{
    state.teamWorkLog=await api(`/api/team-work-log?${params.toString()}`,{timeoutMs:15000});
    renderTeamWorkLog();
  }catch(e){if(body) body.innerHTML=`<tr><td colspan="7"><div class="leave-report-empty">${escapeHtml(e.message||'โหลดข้อมูลไม่สำเร็จ')}</div></td></tr>`;}
}
function workLogStatus(row){
  if(row.is_future) return '<span class="worklog-status future">ยังไม่ถึงวัน</span>';
  if(row.approved_leave && !row.check_in_at) return '<span class="worklog-status leave">ลา</span>';
  if(row.check_in_at && Number(row.late_minutes||0)>0) return `<span class="worklog-status warn">สาย ${Number(row.late_minutes)} นาที</span>`;
  if(row.check_in_at) return '<span class="worklog-status ok">มาทำงาน</span>';
  if(row.is_workday===false)return `<span class="worklog-status future">${row.holiday_name?'วันหยุดบริษัท':'วันหยุด'}</span>`;
  return '<span class="worklog-status danger">ยังไม่เช็กอิน</span>';
}
function workLogPlace(row,prefix='checkin'){
  const outside=Number(row?.[`${prefix}_outside_geofence`]||0)===1;
  const workLocation=String(row?.[`${prefix}_location_name`]||'').trim();
  const actualTitle=String(row?.[`${prefix}_actual_title`]||'').trim();
  const actualAddress=String(row?.[`${prefix}_actual_address`]||'').trim();
  const sourceTitle=String(row?.[`${prefix}_source_title`]||'').trim();
  const sourceAddress=String(row?.[`${prefix}_source_address`]||'').trim();
  if(!outside&&workLocation)return workLocation;
  // Never use the nearest company Work Location as the employee's real place when outside.
  if(actualTitle&&actualTitle!==workLocation)return actualTitle;
  if(sourceTitle&&sourceTitle!==workLocation)return sourceTitle;
  if(actualAddress)return actualAddress;
  if(sourceAddress&&sourceAddress!==String(row?.[`${prefix}_work_location_address`]||'').trim())return sourceAddress;
  if(row?.[`${prefix}_lat`]!=null&&row?.[`${prefix}_lng`]!=null)return 'มีพิกัด GPS · กดดูรายละเอียด';
  return outside?'อยู่นอกพื้นที่ · ยังไม่มีชื่อสถานที่':(workLocation||'ยังไม่มีข้อมูลสถานที่');
}
function workLogDistanceLabel(value){
  if(value==null||!Number.isFinite(Number(value)))return '';
  const n=Number(value);
  return n>=1000?`${(n/1000).toFixed(n>=10000?0:1)} กม.`:`${Math.round(n)} ม.`;
}
function workLogMatrixCell(r){
  if(!r) return '<div class="worklog-day-card empty"><span>—</span></div>';
  const parts=[];
  const leaveLabels={am:'ครึ่งวันเช้า',pm:'ครึ่งวันบ่าย',half:'ครึ่งวัน',full:'เต็มวัน'};
  const leavePart=leaveLabels[String(r.leave_day_part||'full')]||'เต็มวัน';
  const leaveDays=Number(r.leave_duration_days||0);
  const leaveDaysLabel=Number.isFinite(leaveDays)&&leaveDays>0?`${leaveDays.toLocaleString('th-TH',{maximumFractionDigits:1})} วัน`:leavePart;

  // Approved leave is a first-class attendance status. Show it even on future dates,
  // and never mislabel an approved leave day as "ยังไม่เช็กอิน".
  if(r.approved_leave){
    parts.push(`<div class="worklog-approved-leave"><div class="worklog-leave-chip">ลา · อนุมัติแล้ว</div><strong>${escapeHtml(r.leave_name||'ลางาน')}</strong><small>${escapeHtml(leavePart)} · ${escapeHtml(leaveDaysLabel)}</small></div>`);
  }else if(r.leave_name){
    const pendingLabel=({pending:'รออนุมัติ',awaiting_evidence:'รอหลักฐาน'})[r.leave_status]||'รอดำเนินการ';
    parts.push(`<div class="worklog-leave-note pending">${escapeHtml(r.leave_name)} · ${escapeHtml(pendingLabel)}</div>`);
  }

  if(r.is_future && !r.approved_leave && !r.leave_name) return '<div class="worklog-day-card future"><small>ยังไม่ถึงวัน</small></div>';
  if(r.is_active_date===false&&!r.check_in_at&&!r.leave_name)return '<div class="worklog-day-card future"><small>ยังไม่เริ่มงาน</small></div>';
  if(r.is_workday===false&&!r.check_in_at&&!r.approved_leave&&!r.leave_name){
    return `<div class="worklog-day-card future"><small>${escapeHtml(r.holiday_name||'วันหยุด')}</small></div>`;
  }

  if(r.check_in_at){
    const outside=Number(r.checkin_outside_geofence||0)===1;
    const place=workLogPlace(r,'checkin');
    const workLocation=String(r.checkin_location_name||'').trim();
    const late=Number(r.late_minutes||0)>0;
    parts.push(`<div class="worklog-line"><span>เข้า</span><strong class="${late?'late':''}">${time(r.check_in_at)}</strong></div>`);
    parts.push(`<div class="worklog-check-state ${outside?'outside':late?'late':'inside'}">${outside?'นอกพื้นที่':late?`สาย ${Number(r.late_minutes)} นาที`:'ในพื้นที่ · ตรงเวลา'}</div>`);
    if(r.checkin_face_verified)parts.push('<div class="worklog-face-chip">✓ Face Verify</div>');
    parts.push(`<div class="worklog-place" title="${escapeHtml(place)}">📍 ${escapeHtml(place)}</div>`);
    if(workLocation){
      const distance=workLogDistanceLabel(r.checkin_distance_m);
      parts.push(`<div class="worklog-work-location" title="${escapeHtml(workLocation)}">Work: ${escapeHtml(workLocation)}${distance?` · ${distance}`:''}</div>`);
    }
  }
  if(r.check_out_at){
    const checkoutOutside=Number(r.checkout_outside_geofence||0)===1;
    const checkoutPlace=workLogPlace(r,'checkout');
    const checkoutWorkLocation=String(r.checkout_location_name||'').trim();
    parts.push(`<div class="worklog-line checkout"><span>ออก</span><strong>${time(r.check_out_at)}</strong></div>`);
    parts.push(`<div class="worklog-check-state ${checkoutOutside?'outside':'inside'}">${checkoutOutside?'เช็กเอาต์นอกพื้นที่':'เช็กเอาต์ในพื้นที่'}</div>`);
    if(r.checkout_face_verified)parts.push('<div class="worklog-face-chip">✓ Face Verify</div>');
    parts.push(`<div class="worklog-place checkout-place" title="${escapeHtml(checkoutPlace)}">📍 ${escapeHtml(checkoutPlace)}</div>`);
    if(checkoutWorkLocation){
      const checkoutDistance=workLogDistanceLabel(r.checkout_distance_m);
      parts.push(`<div class="worklog-work-location checkout-work" title="${escapeHtml(checkoutWorkLocation)}">Work: ${escapeHtml(checkoutWorkLocation)}${checkoutDistance?` · ${checkoutDistance}`:''}</div>`);
    }
  }

  // Pending leave does not excuse attendance yet. Keep the missing signal visible.
  if(!r.check_in_at&&!r.approved_leave&&!r.is_future&&r.is_workday!==false){
    parts.push('<div class="worklog-missing-note">ยังไม่เช็กอิน</div>');
  }
  if(!parts.length)return `<div class="worklog-day-card missing"><small>ยังไม่เช็กอิน</small></div>`;
  const detail=(r.check_in_at||r.check_out_at)?`<button type="button" class="worklog-detail-btn" data-worklog-detail data-employee-id="${Number(r.employee_id||r.id||0)}" data-work-date="${escapeHtml(r.work_date||'')}">ดูรายละเอียด</button>`:'';
  return `<div class="worklog-day-card ${r.approved_leave?'has-approved-leave':r.leave_name?'has-leave':''}">${parts.join('')}${detail}</div>`;
}
window.openWorkLogDetail=async(employeeId,workDate)=>{
  const modal=$('#workLogDetailModal');
  if(!modal)return;
  const cached=(state.teamWorkLog?.rows||[]).find(x=>Number(x.employee_id||x.id)===Number(employeeId)&&String(x.work_date)===String(workDate));
  const fallbackPerson=cached?`${cached.nickname||cached.first_name||'—'} ${cached.last_name||''}`.trim():'รายละเอียดการลงเวลา';
  $('#workLogDetailTitle').textContent=fallbackPerson;
  $('#workLogDetailSubtitle').textContent=cached?`${formatDate(cached.work_date)} · ${cached.department_name||'ยังไม่ระบุแผนก'}`:formatDate(workDate);
  $('#workLogDetailBody').innerHTML='<div class="worklog-detail-loading"><i class="action-status-spinner"></i><span>กำลังอ่านจุด GPS และรายละเอียดสถานที่…</span></div>';
  try{modal.showModal();}catch{modal.setAttribute('open','');}

  const pointStatus=(item,kind,lateMinutes=0)=>{
    if(!item)return kind==='checkout'?'ยังไม่เช็กเอาต์':'ยังไม่เช็กอิน';
    if(Boolean(item.outside_geofence))return kind==='checkout'?'เช็กเอาต์นอกพื้นที่':'เช็กอินนอกพื้นที่';
    if(kind==='checkin'&&Number(lateMinutes||0)>0)return `อยู่ในพื้นที่ · สาย ${Number(lateMinutes)} นาที`;
    return kind==='checkout'?'เช็กเอาต์ในพื้นที่':'อยู่ในพื้นที่ · ตรงเวลา';
  };
  const pointPlace=item=>item?.actual_title||item?.nearby_name||item?.actual_address||(item?.lat!=null?'มีพิกัด GPS':'—');
  const renderPoint=(kind,item,{lateMinutes=0,fallback=false}={})=>{
    const isCheckout=kind==='checkout';
    const label=isCheckout?'เช็กเอาต์':'เช็กอิน';
    if(!item){
      return `<section class="worklog-point-card empty"><div class="worklog-point-head"><div><span>${label}</span><strong>${isCheckout?'ยังไม่เช็กเอาต์':'ยังไม่เช็กอิน'}</strong></div><span class="worklog-point-badge neutral">—</span></div></section>`;
    }
    const outside=Boolean(item.outside_geofence);
    const place=pointPlace(item);
    const address=item.actual_address&&item.actual_address!==item.actual_title?item.actual_address:null;
    const workName=item.work_location?.name||item.location_name||'ไม่ได้จับคู่ Work Location';
    const workAddress=item.work_location?.address||item.location_address||null;
    const radius=item.work_location?.radius_m??item.location_radius_m??null;
    const map=(item.lat!=null&&item.lng!=null)?`<a class="worklog-map-btn ${isCheckout?'secondary':''}" href="https://www.google.com/maps?q=${Number(item.lat)},${Number(item.lng)}" target="_blank" rel="noopener">📍 ดูจุด${label}บนแผนที่</a>`:'';
    const nearby=item.nearby_name?`<small class="worklog-nearby">Landmark: ${escapeHtml(`${item.nearby_relation||'ใกล้'} ${item.nearby_name}`)}${item.nearby_distance_text?` · ${escapeHtml(item.nearby_distance_text)}`:''}</small>`:'';
    const badgeClass=outside?'outside':(kind==='checkin'&&Number(lateMinutes||0)>0?'late':'inside');
    return `<section class="worklog-point-card ${outside?'outside':'inside'}">
      <div class="worklog-point-head"><div><span>${label}</span><strong>${item.time?time(item.time):'—'}</strong></div><span class="worklog-point-badge ${badgeClass}">${escapeHtml(pointStatus(item,kind,lateMinutes))}</span></div>
      <div class="worklog-point-place"><span>จุดที่${label}จริง</span><strong>📍 ${escapeHtml(place)}</strong>${address?`<small>${escapeHtml(address)}</small>`:''}${nearby}</div>
      <div class="worklog-detail-grid compact">
        <div><span>สถานะพื้นที่</span><strong>${outside?'นอก Work Location':'อยู่ใน Work Location'}</strong></div>
        <div><span>GPS</span><strong>${item.accuracy_m!=null?`±${Math.round(Number(item.accuracy_m))} ม.`:'—'}</strong></div>
        <div><span>Work Location ที่ระบบเทียบ</span><strong>${escapeHtml(workName)}</strong>${workAddress?`<small>${escapeHtml(workAddress)}</small>`:''}</div>
        <div><span>ระยะจาก Work Location</span><strong>${workLogDistanceLabel(item.distance_m)||'—'}</strong></div>
        <div><span>รัศมีที่อนุญาต</span><strong>${radius!=null?`${Math.round(Number(radius))} ม.`:'—'}</strong></div>
        <div><span>พิกัดจริง</span><strong class="coordinate-text">${item.lat!=null&&item.lng!=null?`${Number(item.lat).toFixed(6)}, ${Number(item.lng).toFixed(6)}`:'—'}</strong></div>
      </div>
      ${map?`<div class="worklog-point-actions">${map}</div>`:''}
      ${fallback?'<div class="worklog-detail-fallback-note">แสดงข้อมูลที่บันทึกไว้ในตารางเวลา</div>':''}
    </section>`;
  };

  try{
    const detail=await api(`/api/team-work-log/location-detail?employee_id=${Number(employeeId)}&date=${encodeURIComponent(workDate)}`,{timeoutMs:12000});
    const r=detail||{}; const ci=r.checkin||null; const co=r.checkout||null;
    const person=`${r.employee?.nickname||r.employee?.first_name||'—'} ${r.employee?.last_name||''}`.trim();
    $('#workLogDetailTitle').textContent=person;
    $('#workLogDetailSubtitle').textContent=`${formatDate(r.work_date)} · ${r.employee?.department_name||'ยังไม่ระบุแผนก'}`;
    const overall=!ci?'ยังไม่เช็กอิน':Boolean(ci.outside_geofence)?'เช็กอินนอกพื้นที่':Number(r.late_minutes||0)>0?`มาสาย ${Number(r.late_minutes)} นาที`:'มาทำงาน';
    const overallClass=!ci?'neutral':Boolean(ci.outside_geofence)?'outside':Number(r.late_minutes||0)>0?'late':'inside';
    const faceCheckin=Boolean(r.face_verification?.checkin?.verified),faceCheckout=Boolean(r.face_verification?.checkout?.verified);
    $('#workLogDetailBody').innerHTML=`
      <div class="worklog-detail-status ${overallClass}"><span>สถานะวันนี้</span><strong>${escapeHtml(overall)}</strong></div>
      ${(faceCheckin||faceCheckout)?`<div class="worklog-face-evidence"><div><span>ยืนยันตัวตน</span><strong>Face Verification ผ่าน</strong></div><small>${faceCheckin?'เช็กอิน ✓':''}${faceCheckin&&faceCheckout?' · ':''}${faceCheckout?'เช็กเอาต์ ✓':''} · ไม่เก็บรูปภาพ</small></div>`:''}
      <div class="worklog-points-stack">
        ${renderPoint('checkin',ci,{lateMinutes:Number(r.late_minutes||0)})}
        ${renderPoint('checkout',co)}
      </div>`;
  }catch(e){
    if(cached){
      const ci=cached.check_in_at?{
        time:cached.check_in_at,
        actual_title:workLogPlace(cached,'checkin'),
        actual_address:cached.checkin_actual_address||cached.checkin_source_address||null,
        lat:cached.checkin_lat,lng:cached.checkin_lng,accuracy_m:cached.checkin_accuracy_m,
        distance_m:cached.checkin_distance_m,outside_geofence:Number(cached.checkin_outside_geofence||0)===1,
        location_name:cached.checkin_location_name,location_address:cached.checkin_work_location_address,location_radius_m:cached.checkin_location_radius_m,
      }:null;
      const co=cached.check_out_at?{
        time:cached.check_out_at,
        actual_title:workLogPlace(cached,'checkout'),
        actual_address:cached.checkout_actual_address||cached.checkout_source_address||null,
        lat:cached.checkout_lat,lng:cached.checkout_lng,accuracy_m:cached.checkout_accuracy_m,
        distance_m:cached.checkout_distance_m,outside_geofence:Number(cached.checkout_outside_geofence||0)===1,
        location_name:cached.checkout_location_name,location_address:cached.checkout_work_location_address,location_radius_m:cached.checkout_location_radius_m,
      }:null;
      const overall=!ci?'ยังไม่เช็กอิน':ci.outside_geofence?'เช็กอินนอกพื้นที่':Number(cached.late_minutes||0)>0?`มาสาย ${Number(cached.late_minutes)} นาที`:'มาทำงาน';
      const overallClass=!ci?'neutral':ci.outside_geofence?'outside':Number(cached.late_minutes||0)>0?'late':'inside';
      const faceCheckin=Boolean(cached.checkin_face_verified),faceCheckout=Boolean(cached.checkout_face_verified);
      $('#workLogDetailBody').innerHTML=`
        <div class="worklog-detail-status ${overallClass}"><span>สถานะวันนี้</span><strong>${escapeHtml(overall)}</strong></div>
        ${(faceCheckin||faceCheckout)?`<div class="worklog-face-evidence"><div><span>ยืนยันตัวตน</span><strong>Face Verification ผ่าน</strong></div><small>${faceCheckin?'เช็กอิน ✓':''}${faceCheckin&&faceCheckout?' · ':''}${faceCheckout?'เช็กเอาต์ ✓':''} · ไม่เก็บรูปภาพ</small></div>`:''}
        <div class="worklog-points-stack">
          ${renderPoint('checkin',ci,{lateMinutes:Number(cached.late_minutes||0),fallback:true})}
          ${renderPoint('checkout',co,{fallback:true})}
        </div>
        <div class="worklog-detail-fallback-note">รายละเอียด Landmark แบบสดโหลดไม่สำเร็จ แต่ข้อมูล GPS / เวลา / พื้นที่ที่บันทึกไว้ยังแสดงครบ</div>`;
    }else{
      $('#workLogDetailBody').innerHTML=`<div class="worklog-detail-error"><strong>เปิดรายละเอียดไม่สำเร็จ</strong><span>${escapeHtml(e.message||'กรุณาลองใหม่อีกครั้ง')}</span></div>`;
    }
  }
};
function attendanceSummaryNumber(value){
  const n=Number(value||0);
  return n.toLocaleString('th-TH',{maximumFractionDigits:1});
}
function attendanceLeaveBreakdown(summary){
  const rows=Array.isArray(summary?.leave_breakdown)?summary.leave_breakdown:[];
  return rows.length?rows.map(x=>`${escapeHtml(x.name||'ลา')} ${attendanceSummaryNumber(x.days)} วัน`).join(' · '):'—';
}
function attendanceSummaryMatches(summary,query,dept,status){
  if(query&&!([summary.nickname,summary.first_name,summary.last_name,summary.employee_code,summary.department_name,summary.position_name].some(v=>String(v||'').toLowerCase().includes(query))))return false;
  if(dept&&String(summary.department_name||'')!==dept)return false;
  if(status==='checked_in'&&Number(summary.present_days||0)<=0)return false;
  if(status==='late'&&Number(summary.late_days||0)<=0)return false;
  if(status==='leave'&&Number(summary.leave_days||0)<=0)return false;
  if(status==='outside'&&Number(summary.outside_days||0)<=0)return false;
  if(status==='missing'&&Number(summary.absent_days||0)<=0)return false;
  return true;
}
function renderAttendancePersonSummary({query='',dept='',status='all'}={}){
  const report=state.teamWorkLog||{};
  const body=$('#attendancePersonSummaryBody'); if(!body)return;
  const summaries=(report.employee_summary||[]).filter(s=>attendanceSummaryMatches(s,query,dept,status));
  body.innerHTML=summaries.length?summaries.map(s=>{
    const fullName=`${s.nickname||s.first_name||'—'} ${s.last_name||''}`.trim();
    const presentNote=Number(s.extra_work_days||0)>0?`<small>+ ทำงานวันหยุด ${attendanceSummaryNumber(s.extra_work_days)} วัน</small>`:'';
    const late=Number(s.late_days||0)>0?`<strong class="summary-warn">${attendanceSummaryNumber(s.late_days)} วัน</strong><small>${Number(s.late_minutes||0).toLocaleString('th-TH')} นาที</small>`:'<strong>0 วัน</strong>';
    const absent=Number(s.absent_days||0)>0?`<strong class="summary-danger">${attendanceSummaryNumber(s.absent_days)} วัน</strong>`:'<strong>0 วัน</strong>';
    const leave=Number(s.leave_days||0)>0?`<strong class="summary-leave">${attendanceSummaryNumber(s.leave_days)} วัน</strong>`:'<strong>0 วัน</strong>';
    return `<tr>
      <td><div class="attendance-summary-person"><span>${escapeHtml((s.nickname||s.first_name||'?').slice(0,1))}</span><div><strong>${escapeHtml(fullName)}</strong><small>${escapeHtml(s.employee_code||'')} · ${escapeHtml(s.department_name||'—')} · ${escapeHtml(s.position_name||'ยังไม่ระบุตำแหน่ง')}</small></div></div></td>
      <td><strong>${attendanceSummaryNumber(s.scheduled_days)} วัน</strong></td>
      <td><strong>${attendanceSummaryNumber(s.present_days)} วัน</strong>${presentNote}</td>
      <td><strong class="summary-ok">${attendanceSummaryNumber(s.on_time_days)} วัน</strong></td>
      <td>${late}</td>
      <td>${absent}</td>
      <td>${leave}</td>
      <td class="attendance-leave-breakdown">${attendanceLeaveBreakdown(s)}</td>
      <td><strong>${attendanceSummaryNumber(s.outside_days)} วัน</strong></td>
      <td><strong>${attendanceSummaryNumber(s.missing_checkout_days)} วัน</strong></td>
    </tr>`;
  }).join(''):`<tr><td colspan="10"><div class="leave-report-empty">ไม่พบข้อมูลสรุปที่ตรงกับตัวกรอง</div></td></tr>`;
  const asOf=$('#attendanceSummaryAsOf');
  if(asOf){
    const hasFuture=String(report.end_date||'')>String(report.as_of_date||report.end_date||'');
    asOf.textContent=hasFuture?`สรุปวันทำงาน/ขาดถึง ${formatDate(report.as_of_date)} · วันที่ในอนาคตยังไม่นำมาคิด`: `สรุปตามช่วง ${report.range_label||''}`;
  }
}
function csvEscapeCell(value){
  const text=String(value??'');
  return /[",\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;
}
function exportAttendancePeriodSummaryCsv(){
  const report=state.teamWorkLog||{};
  const query=String($('#teamWorkLogSearch')?.value||'').trim().toLowerCase();
  const dept=String($('#teamWorkLogDepartmentFilter')?.value||'').trim();
  const status=String($('#teamWorkLogStatusFilter')?.value||'all');
  const summaries=(report.employee_summary||[]).filter(s=>attendanceSummaryMatches(s,query,dept,status));
  if(!summaries.length)return toast('ไม่มีข้อมูลสรุปสำหรับดาวน์โหลด',true);
  const header=['พนักงาน','รหัสพนักงาน','แผนก','ตำแหน่ง','วันทำงาน','มาทำงาน','ตรงเวลา','สาย (วัน)','สายนาทีรวม','ขาด (วัน)','ลา (วัน)','ประเภทการลา','นอกพื้นที่ (วัน)','ยังไม่เช็กเอาต์ (วัน)'];
  const lines=[header,...summaries.map(s=>[
    `${s.nickname||s.first_name||''} ${s.last_name||''}`.trim(),s.employee_code||'',s.department_name||'',s.position_name||'',
    s.scheduled_days||0,s.present_days||0,s.on_time_days||0,s.late_days||0,s.late_minutes||0,s.absent_days||0,s.leave_days||0,
    (s.leave_breakdown||[]).map(x=>`${x.name} ${x.days} วัน`).join(' | '),s.outside_days||0,s.missing_checkout_days||0
  ])];
  const csv='\uFEFF'+lines.map(row=>row.map(csvEscapeCell).join(',')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=url;a.download=`nakna-attendance-${report.start_date||'start'}-${report.end_date||'end'}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function renderTeamWorkLog(){
  const report=state.teamWorkLog||{}; const rows=report.rows||[];
  if($('#teamWorkLogRangeLabel')) $('#teamWorkLogRangeLabel').textContent=report.range_label||'—';
  const effectiveRows=rows.filter(r=>!r.is_future&&r.is_active_date!==false);
  const metrics={
    checked_in:effectiveRows.filter(r=>r.check_in_at).length,
    ontime:effectiveRows.filter(r=>r.is_workday!==false&&r.check_in_at&&Number(r.late_minutes||0)<=0).length,
    late:effectiveRows.filter(r=>r.is_workday!==false&&r.check_in_at&&Number(r.late_minutes||0)>0).length,
    leave:(report.employee_summary||[]).reduce((sum,s)=>sum+Number(s.leave_days||0),0),
    outside:effectiveRows.filter(r=>Number(r.checkin_outside_geofence||0)===1||Number(r.checkout_outside_geofence||0)===1).length,
    missing:(report.employee_summary||[]).reduce((sum,s)=>sum+Number(s.absent_days||0),0),
  };
  if($('#teamWorkLogSummary')) $('#teamWorkLogSummary').innerHTML=`
    <div><span>เช็กอินแล้ว</span><strong>${metrics.checked_in.toLocaleString('th-TH')}</strong><small>ครั้ง</small></div>
    <div><span>ตรงเวลา</span><strong>${metrics.ontime.toLocaleString('th-TH')}</strong><small>ครั้ง</small></div>
    <div><span>มาสาย</span><strong>${metrics.late.toLocaleString('th-TH')}</strong><small>ครั้ง</small></div>
    <div><span>ลา</span><strong>${attendanceSummaryNumber(metrics.leave)}</strong><small>วัน</small></div>
    <div><span>นอกพื้นที่</span><strong>${metrics.outside.toLocaleString('th-TH')}</strong><small>ครั้ง</small></div>
    <div><span>ขาด / ไม่ลงเวลา</span><strong>${attendanceSummaryNumber(metrics.missing)}</strong><small>วัน</small></div>`;

  const dateKeys=[...new Set(rows.map(r=>r.work_date).filter(Boolean))].sort();
  const employeeMap=new Map();
  rows.forEach(r=>{
    const resolvedEmployeeId=Number(r.employee_id||r.id||0)||null;
    const key=String(resolvedEmployeeId||r.employee_code||`${r.first_name}-${r.last_name}`);
    if(!employeeMap.has(key)) employeeMap.set(key,{key,employee_id:resolvedEmployeeId,employee_code:r.employee_code,first_name:r.first_name,last_name:r.last_name,nickname:r.nickname,department_name:r.department_name,position_name:r.position_name,days:new Map()});
    employeeMap.get(key).days.set(r.work_date,r);
  });
  const people=[...employeeMap.values()];

  const deptSelect=$('#teamWorkLogDepartmentFilter');
  if(deptSelect){
    const current=deptSelect.value;
    const departments=[...new Set(people.map(p=>String(p.department_name||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'));
    deptSelect.innerHTML=`<option value="">ทุกแผนก</option>${departments.map(d=>`<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('')}`;
    if(departments.includes(current))deptSelect.value=current;
  }
  const query=String($('#teamWorkLogSearch')?.value||'').trim().toLowerCase();
  const dept=String($('#teamWorkLogDepartmentFilter')?.value||'').trim();
  const status=String($('#teamWorkLogStatusFilter')?.value||'all');
  const dayMatches=(row)=>{
    if(!row||row.is_future)return false;
    if(status==='checked_in')return Boolean(row.check_in_at);
    if(status==='late')return Boolean(row.check_in_at)&&Number(row.late_minutes||0)>0;
    if(status==='leave')return Boolean(row.approved_leave);
    if(status==='outside')return Number(row.checkin_outside_geofence||0)===1||Number(row.checkout_outside_geofence||0)===1;
    if(status==='missing')return row.is_workday!==false&&!row.check_in_at&&!row.approved_leave;
    return true;
  };
  const visiblePeople=people.filter(p=>{
    if(query&&!([p.nickname,p.first_name,p.last_name,p.employee_code,p.department_name,p.position_name].some(v=>String(v||'').toLowerCase().includes(query))))return false;
    if(dept&&String(p.department_name||'')!==dept)return false;
    if(status!=='all'&&![...p.days.values()].some(dayMatches))return false;
    return true;
  });
  renderAttendancePersonSummary({query,dept,status});
  if($('#teamWorkLogRowCount')) $('#teamWorkLogRowCount').textContent=`${visiblePeople.length.toLocaleString('th-TH')} / ${people.length.toLocaleString('th-TH')} คน · ${dateKeys.length.toLocaleString('th-TH')} วัน`;

  const head=$('#teamWorkLogHead');
  if(head){
    head.innerHTML=`<tr><th class="worklog-person-col">พนักงาน</th>${dateKeys.map(d=>{
      const sample=rows.find(r=>r.work_date===d)||{};
      return `<th class="worklog-date-col"><strong>${formatDate(d)}</strong><small>${escapeHtml(sample.day_label||'')}</small></th>`;
    }).join('')}</tr>`;
  }
  const body=$('#teamWorkLogBody'); if(!body)return;
  body.innerHTML=visiblePeople.length?visiblePeople.map(p=>`<tr>
    <td class="worklog-person-col"><div class="team-worklog-person"><span class="team-worklog-avatar">${escapeHtml((p.nickname||p.first_name||'?').slice(0,1))}</span><div><strong>${escapeHtml(p.nickname||p.first_name||'—')} ${escapeHtml(p.last_name||'')}</strong><small>${escapeHtml(p.employee_code||'')}</small><small class="worklog-role">${escapeHtml(p.department_name||'—')} · ${escapeHtml(p.position_name||'ยังไม่ระบุตำแหน่ง')}</small></div></div></td>
    ${dateKeys.map(d=>`<td class="worklog-date-col">${workLogMatrixCell(p.days.get(d))}</td>`).join('')}
  </tr>`).join(''):`<tr><td colspan="${Math.max(1,dateKeys.length+1)}"><div class="leave-report-empty">ไม่พบพนักงานที่ตรงกับตัวกรองนี้</div></td></tr>`;
  $$('[data-worklog-detail]').forEach(button=>{
    button.onclick=e=>{
      e.preventDefault(); e.stopPropagation();
      window.openWorkLogDetail(Number(button.dataset.employeeId),String(button.dataset.workDate||''));
    };
  });
}

function dashboardCompactEmpty(title, detail, tone='clear') {
  return `<div class="dashboard-compact-empty ${escapeHtml(tone)}"><span class="dashboard-compact-empty-icon">✓</span><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></div></div>`;
}

function renderDashboard() {
  const d = state.dashboard;
  if (!d?.summary) return;
  const dashboardAttention=(d.attention||[]).filter(item=>item.key!=='missing');
  const total = dashboardAttention.reduce((sum, item) => sum + Number(item.count||0), 0);
  const summaryData=d.summary||{};

  $('#attentionTotal').textContent = total;
  $('#navAttention').textContent = total;
  $('#navAttention').dataset.empty = total ? 'false' : 'true';
  $('#heroSub').textContent = `${d.client.name} · ${summaryData.employees} คน · ${formatDate(d.today)}${summaryData.holiday_name ? ` · 🎉 ${summaryData.holiday_name}` : ''}`;

  const summary = [
    ['พนักงานทั้งหมด', summaryData.employees, 'brand', 'คน'],
    ['เช็กอินแล้ว', summaryData.present, 'success', 'คน'],
    ['ลาวันนี้', summaryData.leave, 'info', 'คน'],
    ['ยังไม่เช็กอิน', summaryData.missing, summaryData.missing ? 'danger' : 'success', 'คน'],
    ['มาสาย', summaryData.late, summaryData.late ? 'warning' : 'success', 'คน'],
  ];
  $('#summaryGrid').innerHTML = summary.map(([label, value, tone, unit]) => `
    <div class="summary-item">
      <div class="summary-label"><span class="summary-dot ${tone}"></span>${escapeHtml(label)}</div>
      <div class="summary-value">${Number(value||0)}<small>${escapeHtml(unit)}</small></div>
    </div>`).join('');

  $('#attentionList').innerHTML = dashboardAttention.length
    ? dashboardAttention.map(item => `
      <div class="list-row actionable dashboard-action-row" data-attention="${escapeHtml(item.key)}">
        <div class="list-icon ${attentionTone(item)}">${attentionIcon(item.key)}</div>
        <div class="list-copy">
          <strong>${attentionCopy(item)}</strong>
          <small>${attentionHelp(item.key)}</small>
        </div>
        <div class="count">${item.count}</div>
      </div>`).join('')
    : dashboardCompactEmpty('วันนี้ไม่มีงานเร่งด่วน', 'รายการอนุมัติและเรื่องที่ต้องจัดการเคลียร์แล้ว');

  $$('[data-attention]').forEach(row => {
    row.onclick = () => {
      const key=row.dataset.attention;
      const item=attentionItemByKey(key);
      if(item?.item_keys?.length) markAttentionRead(key,item.item_keys,{optimistic:true});
      const target = attentionTarget(key);
      if (target) showView(target);
    };
  });

  const scheduled=Math.max(0,Number(summaryData.scheduled_today||0));
  const present=Math.max(0,Number(summaryData.present||0));
  const leave=Math.max(0,Number(summaryData.leave||0));
  const missing=Math.max(0,Number(summaryData.missing||0));
  const late=Math.max(0,Number(summaryData.late||0));
  const attendanceRate=scheduled?Math.min(100,Math.round((present/scheduled)*100)):0;
  const attendanceRoot=$('#attendanceSnapshot');
  if(attendanceRoot) attendanceRoot.innerHTML=`
    <div class="attendance-progress-head"><div><strong>${present}/${scheduled || summaryData.employees}</strong><span>เช็กอินแล้ว</span></div><b>${attendanceRate}%</b></div>
    <div class="attendance-progress"><span style="width:${attendanceRate}%"></span></div>
    <div class="attendance-mini-grid">
      <div><span>มาแล้ว</span><strong>${present}</strong></div>
      <div><span>ลา</span><strong>${leave}</strong></div>
      <div class="${missing?'warn':''}"><span>ยังไม่มา</span><strong>${missing}</strong></div>
      <div class="${late?'warn':''}"><span>สาย</span><strong>${late}</strong></div>
    </div>`;

  const payrollRoot=$('#payrollSnapshot');
  const payroll=d.payroll||null;
  if(payrollRoot){
    if(payroll){
      const statusText=payrollStatusLabel(payroll.status);
      payrollRoot.innerHTML=`<div class="module-snapshot-main"><div><span class="dashboard-module-label">${escapeHtml(payroll.period_key||'รอบล่าสุด')}</span><strong>${formatDate(payroll.period_start)} → ${formatDate(payroll.period_end)}</strong><small>${Number(payroll.employee_count||0)} คน · จ่าย ${formatDate(payroll.pay_date)}</small></div><span class="badge ${payrollStatusClass(payroll.status)}">${escapeHtml(statusText)}</span></div><div class="module-snapshot-money"><span>ยอดโอนสุทธิ</span><strong>${money(payroll.net_total||0)}</strong></div>`;
    }else{
      payrollRoot.innerHTML=dashboardCompactEmpty('ยังไม่มีรอบเงินเดือน', 'สร้างรอบแรกเมื่อข้อมูลพนักงานพร้อม', 'neutral');
    }
  }

  const documentRoot=$('#documentSnapshot');
  const docs=d.documents||{};
  if(documentRoot){
    const pendingHr=Number(docs.pending_hr_sign||0),pendingEmployee=Number(docs.pending_employee_sign||0),finalTotal=Number(docs.final_total||0);
    documentRoot.innerHTML=`<div class="module-stat-grid"><div class="${pendingHr?'needs-action':''}"><span>รอ HR เซ็น</span><strong>${pendingHr}</strong></div><div class="${pendingEmployee?'needs-action':''}"><span>รอพนักงานเซ็น</span><strong>${pendingEmployee}</strong></div><div><span>Final</span><strong>${finalTotal}</strong></div></div>${pendingHr||pendingEmployee?'':'<div class="module-clean-note">ไม่มีเอกสารรอลงนามตอนนี้</div>'}`;
  }

  const pipelineStages = ['new', 'screening', 'hr_interview', 'manager_interview', 'offer', 'hired'];
  $('#recruitmentPipeline').innerHTML = pipelineStages.map((stage,index) => `
    <div class="pipe-item ${Number(d.recruitment?.[stage]||0)?'has-data':''}">
      <b>${d.recruitment?.[stage] || 0}</b>
      <span>${stageLabels[stage]}</span>${index<pipelineStages.length-1?'<i>→</i>':''}
    </div>`).join('');

  const moments = [
    ...(d.birthdays||[]).map(item => ({...item,type:'วันเกิด',icon:'gift',priority:item.days===0?0:item.days})),
    ...(d.probation||[]).map(item => ({ ...item, type: 'Probation', icon: 'clock', priority:item.days })),
    ...(d.contracts||[]).map(item => ({ ...item, type: 'สัญญา', icon: 'document', priority:item.days })),
  ].sort((a,b)=>Number(a.priority||0)-Number(b.priority||0)).slice(0,7);

  $('#upcomingList').innerHTML = moments.length
    ? moments.map(item => `
      <div class="list-row timeline-row">
        <div class="list-icon ${item.type==='วันเกิด'?'coral':item.days<=7?'warning':'info'}">${iconSvg(item.icon)}</div>
        <div class="list-copy">
          <strong>${escapeHtml(item.name)}</strong>
          <small>${escapeHtml(item.type)} · ${formatDate(item.date)}</small>
        </div>
        <span class="badge ${item.days===0?'badge-brand':item.days<=7?'badge-warning':'badge-neutral'}">${item.days===0?'วันนี้':`${item.days} วัน`}</span>
      </div>`).join('')
    : dashboardCompactEmpty('ยังไม่มีกำหนดการใกล้ถึง', 'วันเกิด Probation และสัญญาจะมาแสดงตรงนี้', 'neutral');

  const birthdayRoot=$('#birthdayList');
  if(birthdayRoot){birthdayRoot.innerHTML='';birthdayRoot.classList.add('hidden');}
}

function renderEmployees(query = '') {
  const normalized = query.trim().toLowerCase();
  const employees = normalized
    ? state.employees.filter(employee => [employee.nickname,employee.first_name,employee.last_name,employee.employee_code,employee.department_name,employee.position_name,employee.line_display_name,employee.work_location_names,employee.phone,employee.email,employee.national_id,employee.bank_name,employee.bank_account_no,employee.contract_type,employee.contract_number].some(value => String(value || '').toLowerCase().includes(normalized)))
    : state.employees;

  $('#employeeCountText').textContent = `${employees.length} คน`;
  const connected = state.employees.filter(employee => employee.line_user_id).length;
  $('#peopleTotal').textContent = state.employees.length;
  $('#peopleLineConnected').textContent = connected;
  $('#peopleLinePending').textContent = Math.max(0, state.employees.length - connected);
  $('#peopleActiveInvites').textContent = state.invites.filter(invite => invite.status === 'active' && new Date(invite.expires_at).getTime() > Date.now() && Number(invite.used_count) < Number(invite.max_uses)).length;

  const maskNationalId = value => {
    const digits = String(value || '').replace(/\D/g,'');
    if (!digits) return '—';
    return digits.length >= 13 ? `${digits.slice(0,1)}-${digits.slice(1,5)}-${digits.slice(5,10)}-${digits.slice(10,12)}-${digits.slice(12)}` : escapeHtml(value);
  };
  const salaryText = value => Number(value || 0) > 0 ? Number(value).toLocaleString('th-TH',{maximumFractionDigits:0}) : 'ยังไม่ตั้ง';
  const contractTypeLabel = value => ({permanent:'ประจำ',fixed_term:'มีกำหนด',probation:'ทดลองงาน',part_time:'พาร์ทไทม์',intern:'ฝึกงาน',freelance:'ฟรีแลนซ์',consultant:'ที่ปรึกษา'})[String(value||'')] || '—';

  $('#employeesBody').innerHTML = employees.length
    ? employees.map(employee => `
      <tr>
        <td data-label="พนักงาน" class="employee-sticky-name">
          <div class="person">
            <div class="avatar ${employee.line_picture_url ? 'avatar-photo' : ''}" ${employee.line_picture_url ? `style="background-image:url('${escapeHtml(employee.line_picture_url)}')"` : ''}>${employee.line_picture_url ? '' : initial(employee)}</div>
            <div><strong>${escapeHtml(employee.nickname || employee.first_name)} ${escapeHtml(employee.last_name)}</strong><small>${escapeHtml(employee.employee_code)}</small><span class="people-status ${peopleStatusTone(employee.people_status)}">${escapeHtml(peopleStatusLabel(employee.people_status))}</span></div>
          </div>
        </td>
        <td data-label="แผนก">${escapeHtml(employee.department_name || '—')}</td>
        <td data-label="ตำแหน่ง">${escapeHtml(employee.position_name || '—')}</td>
        <td data-label="เบอร์โทร">${escapeHtml(employee.phone || '—')}</td>
        <td data-label="อีเมล">${escapeHtml(employee.email || '—')}</td>
        <td data-label="วันเกิด">${employee.birth_date ? formatDate(employee.birth_date) : '—'}</td>
        <td data-label="บัตรประชาชน"><span class="mono-data">${maskNationalId(employee.national_id)}</span></td>
        <td data-label="ธนาคาร">${escapeHtml(employee.bank_name || '—')}</td>
        <td data-label="ชื่อบัญชี">${escapeHtml(employee.bank_account_name || '—')}</td>
        <td data-label="เลขบัญชี"><span class="mono-data">${escapeHtml(employee.bank_account_no || '—')}</span></td>
        <td data-label="เงินเดือน"><strong class="salary-cell">${salaryText(employee.base_salary)}</strong></td>
        <td data-label="ประเภทสัญญา"><span class="badge badge-soft">${escapeHtml(contractTypeLabel(employee.contract_type))}</span></td>
        <td data-label="เลขที่สัญญา"><span class="mono-data">${escapeHtml(employee.contract_number || '—')}</span></td>
        <td data-label="เริ่มสัญญา">${employee.contract_start_date ? formatDate(employee.contract_start_date) : '—'}</td>
        <td data-label="วันที่เซ็น">${employee.contract_signed_date ? formatDate(employee.contract_signed_date) : '—'}</td>
        <td data-label="สิ้นสุดสัญญา">${employee.contract_end_date ? formatDate(employee.contract_end_date) : '<span class="muted">ไม่กำหนด</span>'}</td>
        <td data-label="เอกสาร"><button class="document-count-btn" type="button" onclick="window.openEmployeeDocuments(${Number(employee.id)})"><span>${Number(employee.document_count||0)}</span> ไฟล์</button></td>
        <td data-label="วันเริ่มงาน">${employee.start_date ? formatDate(employee.start_date) : '—'}</td>
        <td data-label="Work Location">${employee.work_location_names ? `<span class="location-inline">${escapeHtml(employee.work_location_names)}</span>` : '<span class="muted">ทุก Location</span>'}</td>
        <td data-label="ผู้อนุมัติลา">${employee.leave_approver_employee_id ? `<div class="approver-inline"><strong>${escapeHtml(employee.leave_approver_nickname || employee.leave_approver_first_name || 'กำหนดแล้ว')}</strong><small>LINE Approval</small></div>` : '<span class="badge badge-soft">HR / Owner</span>'}</td>
        <td data-label="LINE">${employee.line_user_id
          ? `<div class="line-connected"><span class="badge badge-success"><span class="status-dot"></span> เชื่อมแล้ว</span><small>${escapeHtml(employee.line_display_name || 'LINE account')}</small></div>`
          : '<span class="badge badge-neutral">ยังไม่เชื่อม</span>'}</td>
        <td data-label="จัดการ" class="employee-sticky-actions"><div class="employee-row-actions"><button class="text-btn" onclick="window.openEmployeeEdit(${Number(employee.id)})">แก้ไข</button><button class="text-btn" onclick="window.openPeopleProfile(${Number(employee.id)})">โปรไฟล์</button>${Number(employee.leave_access_override)===1?`<button class="text-btn quick-leave-btn is-enabled" type="button" disabled title="พนักงานคนนี้ถูกเปิดสิทธิ์ลาแบบรายคนแล้ว">✓ ลาได้แล้ว</button>`:`<button class="text-btn quick-leave-btn" type="button" onclick="window.quickEnableEmployeeLeave(${Number(employee.id)}, this)">เปิดสิทธิ์ลา</button>`}<button class="text-btn" onclick="window.openLeaveProfile(${Number(employee.id)})">ตั้งสิทธิ์ลา</button><button class="text-btn" onclick="window.openEmployeeDocuments(${Number(employee.id)})">เอกสาร</button><button class="text-btn danger-text" onclick="window.deleteEmployee(${Number(employee.id)})">ลบ</button></div></td>
      </tr>`).join('')
    : `<tr><td colspan="22">${emptyState('ไม่พบพนักงาน', 'ลองค้นหาด้วยชื่อ รหัสพนักงาน แผนก เบอร์โทร บัญชีธนาคาร หรือ LINE อีกครั้ง')}</td></tr>`;
}
function peopleStatusLabel(status){return ({candidate:'Candidate',interview:'รอสัมภาษณ์',offer:'Offer',probation:'ทดลองงาน',employee:'พนักงาน',leave_of_absence:'พักงาน',resigned:'ลาออก',terminated:'เลิกจ้าง',alumni:'อดีตพนักงาน',inactive:'Inactive'})[status]||'พนักงาน';}
function peopleStatusTone(status){return ['employee'].includes(status)?'ok':['probation','offer','interview'].includes(status)?'wait':['resigned','terminated','alumni','inactive'].includes(status)?'off':'info';}

window.quickEnableEmployeeLeave = async (id, button) => {
  const employee=state.employees.find(e=>Number(e.id)===Number(id));
  if(!employee)return;
  const original=button?.textContent||'เปิดสิทธิ์ลา';
  if(button){button.disabled=true;button.textContent='กำลังเปิด…';}
  try{
    const result=await api(`/api/employees/${Number(id)}/leave-access`,{method:'PATCH',body:JSON.stringify({mode:'enabled'}),silentStatus:true});
    employee.leave_access_override=Number(result.leave_access_override ?? 1);
    renderEmployees($('#employeeSearch')?.value||'');
    toast(`เปิดสิทธิ์ลาให้ ${employee.nickname||employee.first_name} แล้ว`);
  }catch(error){
    if(button){button.disabled=false;button.textContent=original;}
    toast(error.message||'เปิดสิทธิ์ลาไม่สำเร็จ',true);
  }
};

window.openPeopleProfile = id => {
  const employee=state.employees.find(e=>Number(e.id)===Number(id)); if(!employee)return;
  $('#peopleProfileEmployeeId').value=employee.id;
  $('#peopleProfileTitle').textContent=`จัดการ ${employee.nickname||employee.first_name}`;
  $('#peopleProfileStatus').value=employee.people_status||'employee';
  const profileDepartment=$('#peopleProfileDepartment'); const profilePosition=$('#peopleProfilePosition');
  const profileDepartments=state.peopleCore.departments||[]; const profilePositions=state.peopleCore.positions||[];
  profileDepartment.innerHTML=`<option value="">ไม่ระบุแผนก</option>${profileDepartments.map(d=>`<option value="${d.id}" ${Number(employee.department_id)===Number(d.id)?'selected':''}>${escapeHtml(d.name)}</option>`).join('')}`;
  const renderProfilePositions=()=>{const sorted=[...profilePositions].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'th'));profilePosition.innerHTML=`<option value="">ไม่ระบุตำแหน่ง</option>${sorted.map(pos=>`<option value="${pos.id}" ${Number(employee.position_id)===Number(pos.id)?'selected':''}>${escapeHtml(pos.name)}</option>`).join('')}`;};
  profileDepartment.onchange=()=>{}; renderProfilePositions();
  $('#peopleProfileManager').innerHTML=`<option value="">ไม่ระบุ</option>${state.employees.filter(e=>Number(e.id)!==Number(id)&&e.status==='active').map(e=>`<option value="${e.id}" ${Number(employee.manager_employee_id)===Number(e.id)?'selected':''}>${escapeHtml(e.nickname||e.first_name)}${e.department_name?` · ${escapeHtml(e.department_name)}`:''}</option>`).join('')}`;
  $('#peopleProfileProbationEnd').value=employee.probation_end_date||''; $('#peopleProfileConfirmedAt').value=employee.confirmed_at||''; $('#peopleProfileEndDate').value=employee.end_date||''; $('#peopleProfileEndReason').value=employee.end_reason||'';
  const selectedLocations=new Set(String(employee.work_location_ids||'').split(',').filter(Boolean).map(Number));
  $('#peopleProfileLocations').innerHTML=(state.workLocations||[]).filter(l=>Number(l.is_active)).length?(state.workLocations||[]).filter(l=>Number(l.is_active)).map(l=>`<label class="location-check"><input type="checkbox" value="${l.id}" ${selectedLocations.has(Number(l.id))?'checked':''}/><span><strong>${escapeHtml(l.name)}</strong><small>${escapeHtml(l.address||`รัศมี ${l.radius_m} ม.`)}</small></span></label>`).join(''):`<div class="location-empty-inline"><strong>ยังไม่มี Work Location</strong><span>เพิ่ม Location จาก Settings ก่อน</span></div>`;
  $('#peopleProfileModal').showModal();
  loadPeopleFaceProfile(Number(employee.id));
};

async function savePeopleProfile(){
  const id=Number($('#peopleProfileEmployeeId').value);
  const button=$('#peopleProfileSaveBtn');
  const modal=$('#peopleProfileModal');
  setButtonBusy(button,true,'กำลังบันทึก…');
  modal?.classList.add('is-saving');
  modal?.setAttribute('aria-busy','true');
  const location_ids=$$('#peopleProfileLocations input:checked').map(i=>Number(i.value));
  const payload={people_status:$('#peopleProfileStatus').value,department_id:$('#peopleProfileDepartment').value||null,position_id:$('#peopleProfilePosition').value||null,manager_employee_id:$('#peopleProfileManager').value||null,probation_end_date:$('#peopleProfileProbationEnd').value||null,confirmed_at:$('#peopleProfileConfirmedAt').value||null,end_date:$('#peopleProfileEndDate').value||null,end_reason:$('#peopleProfileEndReason').value.trim()||null,location_ids};
  try{
    await api(`/api/employees/${id}/people-profile`,{method:'PATCH',body:JSON.stringify(payload)});
    patchEmployeeLocal(id,payload);
    modal?.close();
    clearTransientTextCaret();
    renderPeopleFast();
    markViewLoaded('employees'); markViewLoaded('organization');
    toast('บันทึกข้อมูลพนักงานแล้ว');
    schedulePeopleRefresh(900);
  }catch(e){
    toast(e.message,true);
  }finally{
    modal?.classList.remove('is-saving');
    modal?.removeAttribute('aria-busy');
    setButtonBusy(button,false);
  }
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
    const candidate=state.candidates.find(x=>Number(x.id)===Number(id));
    if(candidate){candidate.stage=stage;candidate.last_activity_at=new Date().toISOString();candidate.updated_at=candidate.last_activity_at;}
    renderCandidates(); markViewLoaded('recruitment'); refreshDashboardSoon(80);
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

  $('#addBenefitBtn').classList.toggle('hidden', !['owner','co_owner','hr_admin','hr'].includes(String(activeCompanyRole()||'')));
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
        ${['owner','co_owner','hr_admin','hr'].includes(String(activeCompanyRole()||'')) ? `<button class="secondary-btn small-btn" onclick="window.enrollBenefit(${Number(item.id)})">จัดพนักงาน</button>` : ''}
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
  const outside = state.attendance.filter(item => Number(item.checkout_outside_geofence)===1 || Number(item.checkin_outside_geofence)===1).length;

  $('#attendanceSummary').innerHTML = `
    <span><strong>${checkedIn}</strong> เช็กอินแล้ว</span>
    <span><strong>${late}</strong> มาสาย</span>
    <span><strong>${checkedOut}</strong> เช็กเอาต์แล้ว</span>
    <span><strong>${outside}</strong> ลงเวลานอกพื้นที่</span>`;

  $('#attendanceBody').innerHTML = state.attendance.length
    ? state.attendance.map(attendance => `
      <tr>
        <td data-label="พนักงาน"><div class="person"><div class="avatar">${initial(attendance)}</div><div><strong>${escapeHtml(attendance.nickname || attendance.first_name)} ${escapeHtml(attendance.last_name)}</strong><small>${escapeHtml(attendance.employee_code)}</small></div></div></td>
        <td data-label="Check-in">${attendance.check_in_at ? `<strong class="table-primary">${time(attendance.check_in_at)}</strong>${Number(attendance.checkin_outside_geofence)===1?'<br><span class="badge badge-warning">นอกพื้นที่</span>':''}${attendance.scheduled_start?`<small class="table-secondary">ตาราง ${escapeHtml(attendance.scheduled_start)}${attendance.schedule_source?` · ${escapeHtml(attendance.schedule_source)}`:""}</small>`:""}` : '—'}</td>
        <td data-label="Location">${attendance.check_in_at
          ? `<div class="attendance-location actual-location"><strong>📍 ${escapeHtml(Number(attendance.checkin_outside_geofence)!==1&&attendance.checkin_location_name?attendance.checkin_location_name:(attendance.checkin_source_title||attendance.checkin_source_address||attendance.checkin_location_name||'มีพิกัด'))}</strong>${Number(attendance.checkin_outside_geofence)!==1&&attendance.checkin_location_name?'<small class="success-text">อยู่ในพื้นที่บริษัท</small>':(attendance.checkin_source_address&&attendance.checkin_source_address!==attendance.checkin_source_title?`<small>${escapeHtml(attendance.checkin_source_address)}</small>`:'')}${attendance.checkin_location_name?`<small>Work Location: ${escapeHtml(attendance.checkin_location_name)}${attendance.checkin_distance_m!=null?` · ${Number(attendance.checkin_distance_m)>=1000?`${(Number(attendance.checkin_distance_m)/1000).toFixed(1)} กม.`:`${Math.round(Number(attendance.checkin_distance_m))} ม.`}`:''}</small>`:''}${attendance.checkin_lat != null ? `<a href="https://www.google.com/maps?q=${Number(attendance.checkin_lat)},${Number(attendance.checkin_lng)}" target="_blank" rel="noopener">ดูจุดที่เช็กอินจริง</a>` : ''}</div>`
          : '—'}</td>
        <td data-label="Check-out">${attendance.check_out_at ? `${time(attendance.check_out_at)}${Number(attendance.checkout_outside_geofence)===1?'<br><span class="badge badge-warning">นอกพื้นที่</span>':''}` : '—'}</td>
        <td data-label="สถานะ">${attendanceStatus(attendance)}</td>
      </tr>`).join('')
    : `<tr><td colspan="5">${emptyState('ยังไม่มีข้อมูลเวลาเข้างานวันนี้', 'พนักงานทั้งหมดจะแสดงตรงนี้ และเมื่อเช็กอินผ่าน LINE จะเห็น Location ที่ใช้ด้วย')}</td></tr>`;
}


function currentBangkokMonth(){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);
}
function shiftMonthKey(monthKey, delta){
  const [y,m]=String(monthKey||currentBangkokMonth()).split('-').map(Number);
  const d=new Date(Date.UTC(y,m-1+delta,1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
}
async function loadLeaveMonthlyReport(monthKey){
  const month = monthKey || $('#leaveReportMonth')?.value || currentBangkokMonth();
  if ($('#leaveReportMonth')) $('#leaveReportMonth').value = month;
  try{
    const result=await api(`/api/leave-report?month=${encodeURIComponent(month)}`);
    state.leaveMonthlyReport=result||{month,summary:{},by_type:[],top_people:[],rows:[]};
    renderLeaveMonthlyReport();
  }catch(error){
    const body=$('#leaveReportBody');
    if(body) body.innerHTML=`<tr><td colspan="9"><div class="leave-report-empty">${escapeHtml(error.message||'โหลดรายงานการลาไม่สำเร็จ')}</div></td></tr>`;
  }
}
function renderLeaveMonthlyReport(){
  const report=state.leaveMonthlyReport||{};
  const summary=report.summary||{};
  const status=$('#leaveReportStatus')?.value||'all';
  const rows=(report.rows||[]).filter(r=>status==='all'||String(r.status)===status);
  if($('#leaveReportRangeLabel')) $('#leaveReportRangeLabel').textContent=report.range_label||report.month||'—';
  if($('#leaveReportSummary')) $('#leaveReportSummary').innerHTML=`
    <article><small>พนักงานที่ลา</small><strong>${Number(summary.employees_with_leave||0).toLocaleString('th-TH')}</strong><span>คน</span></article>
    <article><small>คำขอลา</small><strong>${Number(summary.requests||0).toLocaleString('th-TH')}</strong><span>รายการ</span></article>
    <article><small>วันลาอนุมัติ</small><strong>${Number(summary.approved_days||0).toLocaleString('th-TH',{maximumFractionDigits:1})}</strong><span>วัน</span></article>
    <article><small>รออนุมัติ</small><strong>${Number(summary.pending_requests||0).toLocaleString('th-TH')}</strong><span>รายการ</span></article>`;
  const maxType=Math.max(1,...(report.by_type||[]).map(x=>Number(x.days||0)));
  if($('#leaveReportByType')) $('#leaveReportByType').innerHTML=(report.by_type||[]).length
    ? report.by_type.map(x=>`<div class="leave-type-bar"><label>${escapeHtml(x.name||'ไม่ระบุ')}</label><div class="leave-type-track"><div class="leave-type-fill" style="width:${Math.max(3,Math.round(Number(x.days||0)/maxType*100))}%"></div></div><b>${Number(x.days||0).toLocaleString('th-TH',{maximumFractionDigits:1})} วัน · ${Number(x.requests||0)} ครั้ง</b></div>`).join('')
    : '<div class="leave-report-empty">เดือนนี้ยังไม่มีการลา</div>';
  if($('#leaveReportTopPeople')) $('#leaveReportTopPeople').innerHTML=(report.top_people||[]).length
    ? report.top_people.map((x,i)=>`<div class="leave-top-row"><div class="person-mini"><span class="avatar-mini">${escapeHtml((x.nickname||x.first_name||'?').slice(0,1))}</span><div><strong>${escapeHtml(x.nickname||x.first_name||'—')} ${escapeHtml(x.last_name||'')}</strong><small>${escapeHtml(x.department_name||'ยังไม่ระบุแผนก')}</small></div></div><b>${Number(x.days||0).toLocaleString('th-TH',{maximumFractionDigits:1})} วัน</b></div>`).join('')
    : '<div class="leave-report-empty">ยังไม่มีวันลาที่อนุมัติ</div>';
  if($('#leaveReportBody')) $('#leaveReportBody').innerHTML=rows.length?rows.map(r=>`
    <tr>
      <td><strong>${escapeHtml(r.nickname||r.first_name||'—')} ${escapeHtml(r.last_name||'')}</strong><small>${escapeHtml(r.employee_code||'')}</small></td>
      <td><strong>${escapeHtml(r.department_name||'—')}</strong><small>${escapeHtml(r.position_name||'ยังไม่ระบุตำแหน่ง')}</small></td>
      <td><strong>${escapeHtml(r.leave_type_name||r.leave_type||'—')}</strong><small>#LV-${String(r.id).padStart(4,'0')}</small></td>
      <td><strong>${formatDate(r.start_date)}${r.start_date!==r.end_date?` – ${formatDate(r.end_date)}`:''}</strong><small>${escapeHtml(r.day_part==='am'?'ครึ่งวันเช้า':r.day_part==='pm'?'ครึ่งวันบ่าย':'เต็มวัน')}</small></td>
      <td><strong>${Number(r.duration_days||0).toLocaleString('th-TH',{maximumFractionDigits:1})} วัน</strong></td>
      <td><span>${escapeHtml(r.reason||'—')}</span></td>
      <td>${statusBadge(r.status)}</td>
      <td><strong>${escapeHtml(r.approver_nickname||r.approver_first_name||'HR / Owner')}</strong><small>${r.decision_reason?escapeHtml(r.decision_reason):''}</small></td>
      <td><strong>${formatDate(r.created_at)}</strong><small>${r.approved_at?`อนุมัติ ${formatDate(r.approved_at)}`:''}</small></td>
    </tr>`).join(''):`<tr><td colspan="9"><div class="leave-report-empty">ไม่มีรายการตามตัวกรองนี้</div></td></tr>`;
}
function exportLeaveMonthlyReportCsv(){
  const report=state.leaveMonthlyReport||{};
  const status=$('#leaveReportStatus')?.value||'all';
  const rows=(report.rows||[]).filter(r=>status==='all'||String(r.status)===status);
  if(!rows.length) return toast('ไม่มีข้อมูลสำหรับ Export',true);
  const headers=['รหัสพนักงาน','ชื่อ','แผนก','ตำแหน่ง','ประเภทลา','วันเริ่ม','วันสิ้นสุด','จำนวนวัน','เหตุผล','สถานะ','ผู้อนุมัติ','วันที่ส่ง','วันที่อนุมัติ'];
  const csv=[headers,...rows.map(r=>[
    r.employee_code||'',`${r.nickname||r.first_name||''} ${r.last_name||''}`.trim(),r.department_name||'',r.position_name||'',r.leave_type_name||r.leave_type||'',
    r.start_date||'',r.end_date||'',r.duration_days||0,r.reason||'',r.status||'',r.approver_nickname||r.approver_first_name||'HR / Owner',r.created_at||'',r.approved_at||''
  ])].map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=url;a.download=`nakna-leave-${report.month||currentBangkokMonth()}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
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
    const leave=state.leaves.find(x=>Number(x.id)===Number(id));
    if(leave){ leave.status=action==='approve'?'approved':'rejected'; if(reason)leave.decision_reason=reason; }
    renderLeaves(); markViewLoaded('leave'); refreshDashboardSoon(80);
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
  const isHr=['owner','co_owner','hr_admin','hr'].includes(role);
  const openCases=cases.filter(c=>!['resolved','closed'].includes(c.status)).length;
  $('#createBroadcastBtn').classList.toggle('hidden',!isHr);
  const totalInbox=openCases+Number(state.requests?.length||0);
  $('#requestCountBadge').textContent=`${totalInbox} รายการ`;
  $('#hrCaseOpenCount').textContent=String(openCases);
  $('#broadcastTotalCount').textContent=String(broadcasts.length);
  const rich=service.rich_menu||{};
  $('#richMenuStatusText').textContent=rich.configured?'พร้อมใช้':'ยังไม่ตั้ง';
  $('#setupRichMenuBtn').textContent=rich.configured?'อัปเดต Rich Menu':'ตั้ง Rich Menu ให้ LINE บริษัท';
  $('#setupRichMenuBtn').disabled=!rich.dedicated_line || !['owner','co_owner','hr_admin'].includes(String(activeCompanyRole()||''));
  $('#removeRichMenuBtn').classList.toggle('hidden',!rich.configured || !['owner','co_owner','hr_admin'].includes(String(activeCompanyRole()||'')));

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
  if(broadcastRoot) broadcastRoot.innerHTML=broadcasts.length?broadcasts.slice(0,8).map(b=>`<article class="broadcast-row"><div><strong>${escapeHtml(b.title)}</strong><p>${escapeHtml(b.message)}</p><small>${formatDateTime(b.created_at)} · ${escapeHtml(b.audience_type==='all'?'ทุกคน':b.audience_type==='department'?'เฉพาะแผนก':'เลือกพนักงาน')}</small></div><div class="broadcast-stats"><span class="badge ${b.status==='sent'?'badge-success':b.status==='partial'?'badge-warning':'badge-neutral'}">${escapeHtml(b.status)}</span><small>${Number(b.delivered_count||0)}/${Number(b.total_recipients||0)} ส่งสำเร็จ</small>${broadcastAckStatHtml(b)}${b.status==='draft'?`<button class="text-btn" onclick="window.sendBroadcastById(${Number(b.id)})">ส่งตอนนี้</button>`:''}</div></article>`).join(''):emptyState('ยังไม่มีประกาศ','ส่งประกาศจาก HR เข้า LINE ของพนักงานได้จากปุ่มด้านบน');
  renderBroadcastPage();
  renderHrInbox();
}

function renderBroadcastPage(){
  const role=String(activeCompanyRole()||'');
  const canRead=['owner','primary_owner','co_owner','hr_admin','hr','manager'].includes(role);
  const canSend=['owner','primary_owner','co_owner','hr_admin','hr'].includes(role);
  const nav=$('#broadcastNav');
  if(nav) nav.classList.toggle('hidden',!canRead);
  const createBtn=$('#createBroadcastPageBtn');
  if(createBtn) createBtn.classList.toggle('hidden',!canSend);
  if(!canRead) return;
  const broadcasts=state.broadcasts||[];
  const totalDelivered=broadcasts.reduce((sum,b)=>sum+Number(b.delivered_count||0),0);
  const totalFailed=broadcasts.reduce((sum,b)=>sum+Number(b.failed_count||0),0);
  if($('#broadcastPageTotal')) $('#broadcastPageTotal').textContent=String(broadcasts.length);
  if($('#broadcastPageDelivered')) $('#broadcastPageDelivered').textContent=String(totalDelivered);
  if($('#broadcastPageFailed')) $('#broadcastPageFailed').textContent=String(totalFailed);
  const root=$('#broadcastPageList');
  if(!root) return;
  root.innerHTML=broadcasts.length?broadcasts.map(b=>`<article class="broadcast-row"><div><strong>${escapeHtml(b.title)}</strong><p>${escapeHtml(b.message)}</p><small>${formatDateTime(b.created_at)} · ${escapeHtml(b.audience_type==='all'?'พนักงานทั้งหมด':b.audience_type==='department'?'เฉพาะแผนก':'เลือกพนักงาน')} · ${escapeHtml(b.created_by_name||'HR')}</small></div><div class="broadcast-stats"><span class="badge ${b.status==='sent'?'badge-success':b.status==='partial'?'badge-warning':'badge-neutral'}">${escapeHtml(({draft:'แบบร่าง',sending:'กำลังส่ง',sent:'ส่งแล้ว',partial:'ส่งบางส่วน'})[b.status]||b.status)}</span><small>${Number(b.delivered_count||0)}/${Number(b.total_recipients||0)} ส่งสำเร็จ</small>${broadcastAckStatHtml(b)}${b.status==='draft'&&canSend?`<button class="text-btn" onclick="window.sendBroadcastById(${Number(b.id)})">ส่งตอนนี้</button>`:''}</div></article>`).join(''):emptyState('ยังไม่มีประกาศ','กด “สร้างประกาศ” เพื่อส่งข้อความเข้า LINE ของพนักงาน');
}

function renderHrInbox(){
  const role=String(activeCompanyRole()||'');
  const isHr=['owner','co_owner','primary_owner','hr_admin','hr'].includes(role);
  const nav=$('#hrInboxNav');
  if(nav) nav.classList.toggle('hidden',!isHr);
  if(!isHr) return;
  const cases=state.hrCases||[];
  const open=cases.filter(c=>!['resolved','closed'].includes(String(c.status))).length;
  const urgent=cases.filter(c=>!['resolved','closed'].includes(String(c.status))&&['urgent','high'].includes(String(c.priority))).length;
  const closed=cases.filter(c=>['resolved','closed'].includes(String(c.status))).length;
  const unreadPrivate=Number(attentionItemByKey('hr_private')?.count||0);
  if($('#hrInboxNavCount')){ $('#hrInboxNavCount').textContent=String(unreadPrivate); $('#hrInboxNavCount').classList.toggle('hidden',unreadPrivate===0); }
  if($('#hrInboxOpenBadge')) $('#hrInboxOpenBadge').textContent=`${open} เรื่องเปิด`;
  if($('#hrInboxOpenCount')) $('#hrInboxOpenCount').textContent=String(open);
  if($('#hrInboxUrgentCount')) $('#hrInboxUrgentCount').textContent=String(urgent);
  if($('#hrInboxClosedCount')) $('#hrInboxClosedCount').textContent=String(closed);
  renderHrInboxList();
}
function renderHrInboxList(){
  const root=$('#hrInboxList'); if(!root) return;
  const q=String($('#hrInboxSearch')?.value||'').trim().toLowerCase();
  const status=String($('#hrInboxStatusFilter')?.value||'all');
  const rows=(state.hrCases||[]).filter(c=>{
    if(status!=='all'&&String(c.status)!==status)return false;
    if(!q)return true;
    return [c.subject,c.detail,c.category,c.nickname,c.first_name,c.last_name,c.department_name].some(v=>String(v||'').toLowerCase().includes(q));
  });
  const statusLabels={open:'รับเรื่องแล้ว',in_progress:'กำลังดำเนินการ',waiting_employee:'รอพนักงาน',resolved:'แก้ไขแล้ว',closed:'ปิดเรื่อง'};
  const priorityLabels={urgent:'ด่วน',high:'สูง',normal:'ปกติ',low:'ต่ำ'};
  root.innerHTML=rows.length?rows.map(c=>{
    const priorityClass=c.priority==='urgent'?'badge-danger':c.priority==='high'?'badge-warning':'badge-neutral';
    const category=escapeHtml(c.category||'เรื่องส่วนตัว');
    return `<button class="hr-case-row hr-inbox-case-row" type="button" onclick="window.openHrCase(${Number(c.id)})"><div class="hr-case-id"><span class="badge ${priorityClass}">${escapeHtml(priorityLabels[c.priority]||'ส่วนตัว')}</span><strong>#HR-${String(c.id).padStart(4,'0')}</strong></div><div class="hr-case-copy"><div class="hr-case-title-line"><strong>${escapeHtml(c.subject)}</strong><span class="badge badge-soft">${category}</span></div><p>${escapeHtml(c.detail)}</p><small>${escapeHtml(c.nickname||c.first_name||'พนักงาน')}${c.department_name?` · ${escapeHtml(c.department_name)}`:''} · ${formatDateTime(c.created_at)}</small></div><span class="badge ${['resolved','closed'].includes(c.status)?'badge-success':'badge-soft'}">${escapeHtml(statusLabels[c.status]||c.status)}</span></button>`;
  }).join(''):emptyState(q||status!=='all'?'ไม่พบเรื่องที่ค้นหา':'ยังไม่มีเรื่องแจ้ง HR','เมื่อพนักงานส่งฟอร์ม “แจ้ง HR” รายการจะเข้าหน้านี้อัตโนมัติ');
}
function renderBroadcastAudienceFields(){
  const mode=$('#broadcastAudience').value;
  $('#broadcastDepartmentField').classList.toggle('hidden',mode!=='department');
  $('#broadcastEmployeesField').classList.toggle('hidden',mode!=='employees');
}
function renderBroadcastAckFields(){
  const required=Boolean($('#broadcastRequiresAck')?.checked);
  $('#broadcastAckDueField')?.classList.toggle('hidden',!required);
  if(!required&&$('#broadcastAckDueAt')) $('#broadcastAckDueAt').value='';
}
function broadcastAckStatHtml(b,canOpen=true){
  if(!Number(b.requires_ack||0))return '';
  const ack=Number(b.acknowledged_count||0),pending=Number(b.pending_ack_count||0),delivered=Number(b.delivered_count||0);
  return `<div class="broadcast-ack-inline"><span class="badge ${pending?'badge-warning':'badge-success'}">รับทราบ ${ack}/${delivered}</span>${pending?`<small>รอ ${pending} คน</small>`:'<small>ครบแล้ว ✓</small>'}${canOpen?`<button class="text-btn" type="button" onclick="window.openBroadcastAckDetail(${Number(b.id)})">ดูการรับทราบ</button>`:''}</div>`;
}
function openBroadcastModal(){
  $('#broadcastTitle').value=''; $('#broadcastMessage').value=''; $('#broadcastAudience').value='all';
  $('#broadcastRequiresAck').checked=false; $('#broadcastAckDueAt').value=''; renderBroadcastAckFields();
  $('#broadcastDepartment').innerHTML=(state.peopleCore?.departments||[]).map(d=>`<option value="${Number(d.id)}">${escapeHtml(d.name)}</option>`).join('');
  $('#broadcastEmployeeChecks').innerHTML=state.employees.filter(e=>e.status==='active').map(e=>`<label class="location-check"><input type="checkbox" value="${Number(e.id)}"><span><strong>${escapeHtml(e.nickname||e.first_name)}</strong><small>${escapeHtml(e.department_name||'ไม่ระบุแผนก')}${e.line_user_id?' · LINE✓':' · ยังไม่เชื่อม LINE'}</small></span></label>`).join('');
  renderBroadcastAudienceFields(); $('#broadcastModal').showModal();
}
async function sendBroadcast(){
  const title=$('#broadcastTitle').value.trim(),message=$('#broadcastMessage').value.trim(),audience_type=$('#broadcastAudience').value;
  if(title.length<2||message.length<2)return toast('กรุณาใส่หัวข้อและข้อความประกาศ',true);
  const body={title,message,audience_type,send_now:true,requires_ack:Boolean($('#broadcastRequiresAck')?.checked),ack_due_at:$('#broadcastRequiresAck')?.checked?($('#broadcastAckDueAt')?.value||null):null};
  if(audience_type==='department') body.department_id=Number($('#broadcastDepartment').value);
  if(audience_type==='employees') body.employee_ids=$$('#broadcastEmployeeChecks input:checked').map(x=>Number(x.value));
  const btn=$('#broadcastSendBtn');btn.disabled=true;btn.textContent='กำลังส่ง…';
  try{const result=await api('/api/broadcasts',{method:'POST',body:JSON.stringify(body)});$('#broadcastModal').close();const fresh=await api('/api/broadcasts');state.broadcasts=fresh?.data||[];renderEmployeeService();renderBroadcastPage();toast(`ส่งประกาศแล้ว ${Number(result.delivered||0)} คน${body.requires_ack?' · เปิดการรับทราบแล้ว':''}${Number(result.failed||0)+Number(result.skipped||0)>0?` · ไม่สำเร็จ ${Number(result.failed||0)+Number(result.skipped||0)}`:''}`);}catch(e){toast(e.message,true);}finally{btn.disabled=false;btn.textContent='ส่งประกาศตอนนี้';}
}
window.sendBroadcastById=async id=>{try{const result=await api(`/api/broadcasts/${id}/send`,{method:'POST',body:'{}'});const fresh=await api('/api/broadcasts');state.broadcasts=fresh?.data||[];renderEmployeeService();renderBroadcastPage();toast(`ส่งประกาศแล้ว ${Number(result.delivered||0)} คน`);}catch(e){toast(e.message,true);}};
window.openBroadcastAckDetail=async id=>{
  try{
    const result=await api(`/api/broadcasts/${Number(id)}/acknowledgements`); const b=result.broadcast||{},summary=result.summary||{},rows=result.data||[];
    $('#broadcastAckId').value=String(id); $('#broadcastAckTitle').textContent=`การรับทราบ · ${b.title||'ประกาศ'}`;
    $('#broadcastAckSubtitle').textContent=`${b.ack_due_at?`กำหนดรับทราบภายใน ${formatDate(b.ack_due_at)} · `:''}กดเตือนได้เฉพาะพนักงานที่ยังไม่รับทราบ`;
    $('#broadcastAckSummary').innerHTML=`<div><span>ส่งสำเร็จ</span><strong>${Number(summary.delivered||0)}</strong></div><div><span>รับทราบแล้ว</span><strong class="success-text">${Number(summary.acknowledged||0)}</strong></div><div><span>ยังไม่รับทราบ</span><strong>${Number(summary.pending||0)}</strong></div>`;
    $('#broadcastRemindPendingBtn').disabled=Number(summary.pending||0)===0;
    $('#broadcastRemindPendingBtn').textContent=Number(summary.pending||0)?`เตือน ${Number(summary.pending)} คนที่ยังไม่รับทราบ`:'รับทราบครบแล้ว';
    $('#broadcastAckList').innerHTML=rows.length?rows.map(r=>{const name=escapeHtml(r.nickname||r.first_name||'พนักงาน');const meta=[r.employee_code,r.department_name,r.position_name].filter(Boolean).map(escapeHtml).join(' · ');const ack=Boolean(r.acknowledged_at);const deliveryOk=r.delivery_status==='delivered';return `<article class="broadcast-ack-person ${ack?'done':!deliveryOk?'failed':''}"><div class="person-mini-avatar">${escapeHtml((r.nickname||r.first_name||'?').slice(0,1).toUpperCase())}</div><div><strong>${name} ${escapeHtml(r.last_name||'')}</strong><small>${meta||'—'}</small></div><div class="broadcast-ack-person-status"><span class="badge ${ack?'badge-success':deliveryOk?'badge-warning':'badge-neutral'}">${ack?'✓ รับทราบ':deliveryOk?'รอรับทราบ':'ส่งไม่สำเร็จ'}</span><small>${ack?formatDateTime(r.acknowledged_at):(r.last_reminded_at?`เตือนล่าสุด ${formatDateTime(r.last_reminded_at)}`:'')}</small></div></article>`}).join(''):emptyState('ยังไม่มีผู้รับ','ประกาศนี้ยังไม่มีข้อมูลการส่งถึงพนักงาน');
    $('#broadcastAckModal').showModal();
  }catch(e){toast(e.message,true);}
};
async function remindPendingBroadcast(){
  const id=Number($('#broadcastAckId').value||0); if(!id)return;
  const btn=$('#broadcastRemindPendingBtn');btn.disabled=true;const old=btn.textContent;btn.textContent='กำลังส่งแจ้งเตือน…';
  try{const result=await api(`/api/broadcasts/${id}/remind-pending`,{method:'POST',body:'{}'});toast(`ส่งเตือนแล้ว ${Number(result.delivered||0)} คน${Number(result.failed||0)?` · ไม่สำเร็จ ${Number(result.failed)}`:''}`);await window.openBroadcastAckDetail(id);}catch(e){toast(e.message,true);}finally{btn.disabled=false;if(btn.textContent==='กำลังส่งแจ้งเตือน…')btn.textContent=old;}
}

async function setupRichMenu(){
  const btn=$('#setupRichMenuBtn');btn.disabled=true;btn.textContent='กำลังตั้ง Rich Menu…';
  try{await api('/api/integrations/line/rich-menu',{method:'POST',body:'{}'});state.employeeService=await api('/api/employee-service');renderEmployeeService();toast('ตั้ง Rich Menu ให้ LINE บริษัทแล้ว');}catch(e){toast(e.message,true);}finally{btn.disabled=false;btn.textContent=state.employeeService?.rich_menu?.configured?'อัปเดต Rich Menu':'ตั้ง Rich Menu ให้ LINE บริษัท';}
}
async function removeRichMenu(){if(!confirm('ลบ Rich Menu เริ่มต้นของบริษัทออกจาก LINE ใช่ไหม?'))return;try{await api('/api/integrations/line/rich-menu',{method:'DELETE'});state.employeeService=await api('/api/employee-service');renderEmployeeService();toast('ลบ Rich Menu แล้ว');}catch(e){toast(e.message,true);}}

window.openHrCase=async id=>{
  try{
    const result=await api(`/api/hr-cases/${id}`); const c=result.data; state.activeHrCaseId=Number(id);
    const caseKey=`hr_private:${Number(id)}:${String(c.created_at||'')}`;
    markAttentionRead('hr_private',[caseKey],{optimistic:true});
    $('#hrCaseModalTitle').textContent=`#HR-${String(id).padStart(4,'0')} · ${c.subject}`;
    $('#hrCaseModalSub').textContent=`${c.nickname||c.first_name} · ${c.department_name||'ไม่ระบุแผนก'} · ${formatDateTime(c.created_at)}`;
    $('#hrCaseStatus').value=c.status; $('#hrCasePriority').value=c.priority; $('#hrCaseNote').value=c.hr_note||''; $('#hrCaseReply').value='';
    $('#hrCaseDetail').innerHTML=`<div class="private-case-banner">🔒 ข้อมูลนี้สำหรับ HR เท่านั้น</div><div class="detail-block"><span>รายละเอียดจากพนักงาน</span><strong>${escapeHtml(c.detail)}</strong></div>${c.last_reply_to_employee?`<div class="detail-block"><span>ตอบกลับล่าสุด</span><strong>${escapeHtml(c.last_reply_to_employee)}</strong></div>`:''}<div class="case-timeline">${(result.events||[]).map(ev=>`<div><span>${formatDateTime(ev.created_at)}</span><strong>${escapeHtml(ev.action)}</strong>${ev.message?`<p>${escapeHtml(ev.message)}</p>`:''}</div>`).join('')}</div>`;
    $('#hrCaseModal').showModal();
  }catch(e){toast(e.message,true);}
};
async function saveHrCase(){
  const id=state.activeHrCaseId;if(!id)return;const btn=$('#hrCaseSaveBtn');btn.disabled=true;
  try{await api(`/api/hr-cases/${id}`,{method:'PATCH',body:JSON.stringify({status:$('#hrCaseStatus').value,priority:$('#hrCasePriority').value,hr_note:$('#hrCaseNote').value.trim(),assigned_to_me:true})});const reply=$('#hrCaseReply').value.trim();if(reply)await api(`/api/hr-cases/${id}/reply`,{method:'POST',body:JSON.stringify({message:reply})});$('#hrCaseModal').close();await loadViewData('hr-inbox',{force:true});refreshDashboardSoon(80);toast(reply?'บันทึกและตอบกลับพนักงานแล้ว':'บันทึกเรื่อง HR แล้ว');}catch(e){toast(e.message,true);}finally{btn.disabled=false;}
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
  // Entering a task-specific inbox means the HR user has seen the current
  // notification set. Hide those attention items immediately and persist the
  // read state, while unresolved records remain available inside the page.
  acknowledgeAttentionForView(name);
  // Route-based lazy loading: opening one menu no longer downloads every HR
  // module. This is especially important on mobile / 4G.
  loadViewData(name).catch(error=>console.warn('[Nakna] route load failed',name,error));
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
  if (category === 'company') fillCompanyProfileForm();
  if (category === 'attendance') renderAttendanceSettingsControls({fetchFace:true});
  if (category === 'approvals' && ['owner','co_owner'].includes(String(activeCompanyRole()||''))) loadCompanyAccess();
  if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
}

function syncSettingsSidebar() {
  const open = Boolean(state.settingsNavExpanded);
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
  if ($('#settingsSidebarAttendanceMeta')) { const face=core.attendance_face||{}; const enrolled=Number(face.summary?.enrolled||0),active=Number(face.summary?.active||0); const locationText=locations.length?`${locations.filter(x => Number(x.is_active) !== 0).length} จุดเช็กอิน`:'ยังไม่มี Work location'; $('#settingsSidebarAttendanceMeta').textContent=face.mode&&face.mode!=='off'?`${locationText} · Face ${enrolled}/${active}`:locationText; }
  if ($('#settingsSidebarLeaveMeta')) $('#settingsSidebarLeaveMeta').textContent = `${leavePolicies.length} ประเภทลา · ${holidays.length} วันหยุด`;
  if ($('#settingsSidebarApprovalMeta')) {
    const admins = (state.companyAccess?.members || []).length;
    const ownerText = admins ? `${admins} ผู้ดูแล` : state.me?.is_primary_owner ? 'Primary Owner' : '';
    $('#settingsSidebarApprovalMeta').textContent = [ownerText, approvers.length ? `${approvers.length} ผู้อนุมัติ` : 'ยังไม่มีผู้อนุมัติ'].filter(Boolean).join(' · ');
  }
  if ($('#settingsSidebarIntegrationMeta')) $('#settingsSidebarIntegrationMeta').textContent = `${line.connected ? 'LINE ✓' : 'LINE default'} · ${google.connected ? 'Google ✓' : 'Google ยังไม่เชื่อม'}`;
  if ($('#settingsSidebarPayrollMeta')) $('#settingsSidebarPayrollMeta').textContent = `จ่ายวันที่ ${payroll.pay_day || 28} · ${Number(payroll.social_security_enabled ?? 1) ? 'SSO ✓' : 'SSO ปิด'}`;
  if ($('#settingsSidebarBillingMeta')) $('#settingsSidebarBillingMeta').textContent = subscription.plan?.name || subscription.plan_name || (subscription.trial ? 'Free Trial' : 'ยังไม่มีแพ็กเกจ');
  syncSettingsSidebar();
}

function renderWorkLocations() {
  const list = $('#workLocationList');
  if (!list) return;
  const locations = state.workLocations || [];
  list.innerHTML = locations.length ? locations.map(location => {
    const lat=Number(location.latitude),lng=Number(location.longitude),active=Number(location.is_active)!==0;
    const coord=(Number.isFinite(lat)&&Number.isFinite(lng))?`${lat.toFixed(6)}, ${lng.toFixed(6)}`:'ไม่มีพิกัด';
    return `
    <article class="work-location-card ${active ? '' : 'inactive'}">
      <div class="work-location-pin">⌖</div>
      <div class="work-location-copy">
        <div class="work-location-title"><strong>${escapeHtml(location.name)}</strong><span class="badge ${active ? 'badge-success' : 'badge-neutral'}">${active ? 'ใช้งาน' : 'ปิด'}</span></div>
        <p>${escapeHtml(location.address || coord)}</p>
        <small>รัศมี ${Number(location.radius_m)} ม. · ${escapeHtml(coord)}</small>
      </div>
      <div class="work-location-actions">
        <button class="text-btn" type="button" onclick="window.editWorkLocation(${Number(location.id)})">แก้ไข</button>
        <button class="text-btn danger-text" type="button" onclick="window.deleteWorkLocation(${Number(location.id)})">ลบ</button>
      </div>
    </article>`;
  }).join('') : emptyState('ยังไม่มี Work Location', 'เพิ่มสำนักงานใหญ่ สาขา หรือหน้างาน ระบบจะใช้ทุก Location ที่เปิดใช้งานตรวจ GPS อัตโนมัติ');
  renderAttendanceSettingsControls({fetchFace:true});
}

window.editWorkLocation = id => {
  const location=(state.workLocations||[]).find(item=>Number(item.id)===Number(id));
  if(!location)return toast('ไม่พบ Work Location',true);
  state.editingWorkLocationId=Number(location.id);
  $('#locationForm').reset();
  $('#locationName').value=location.name||'';
  $('#locationAddress').value=location.address||'';
  $('#locationLat').value=location.latitude??'';
  $('#locationLng').value=location.longitude??'';
  $('#locationRadius').value=String(location.radius_m||150);
  if($('#locationModalTitle'))$('#locationModalTitle').textContent='แก้ไขจุดเช็กอิน';
  if($('#locationModalSubtitle'))$('#locationModalSubtitle').textContent='แก้พิกัดหรือรัศมีได้ทันที ระบบจะใช้ค่าล่าสุดในการเช็กอินครั้งถัดไป';
  if($('#locationSaveBtn'))$('#locationSaveBtn').textContent='บันทึกการแก้ไข';
  $('#locationModal').showModal();
};

window.deleteWorkLocation = async id => {
  const location=(state.workLocations||[]).find(item=>Number(item.id)===Number(id));
  if(!location)return;
  if(!confirm(`ลบ Work Location “${location.name}” ใช่ไหม?\n\nพนักงานจะไม่สามารถใช้จุดนี้เช็กอินได้อีก แต่ประวัติการลงเวลาเดิมยังคงอยู่`))return;
  try{
    const result=await api(`/api/work-locations/${Number(id)}`,{method:'DELETE'});
    state.workLocations=(state.workLocations||[]).filter(item=>Number(item.id)!==Number(id));
    if(state.lookups?.locations)state.lookups.locations=state.lookups.locations.filter(item=>Number(item.id)!==Number(id));
    renderWorkLocations();
    renderSettingsSidebar();
    toast(result?.unassigned_count?`ลบ Work Location แล้ว · ยกเลิกการผูก ${Number(result.unassigned_count)} คน`:'ลบ Work Location แล้ว');
  }catch(error){toast(error.message,true);}
};

window.openDepartmentAssignment = id => {
  const department=(state.peopleCore?.departments||[]).find(d=>Number(d.id)===Number(id));
  if(!department)return;
  $('#departmentAssignId').value=department.id;
  $('#departmentAssignTitle').textContent=`จัดพนักงาน · ${department.name}`;
  $('#departmentAssignSubtitle').textContent='ติ๊กพนักงานที่ต้องการให้อยู่ในแผนกนี้ คนที่อยู่แผนกอื่นจะถูกย้ายมาให้อัตโนมัติ';
  $('#departmentAssignSearch').value='';
  renderDepartmentAssignPeople();
  $('#departmentAssignModal').showModal();
};
function renderDepartmentAssignPeople(){
  const root=$('#departmentAssignPeople'); if(!root)return;
  const departmentId=Number($('#departmentAssignId').value||0);
  const query=String($('#departmentAssignSearch').value||'').trim().toLowerCase();
  let employees=state.employees.filter(e=>e.status==='active');
  if(query) employees=employees.filter(e=>[e.nickname,e.first_name,e.last_name,e.employee_code,e.department_name,e.position_name].some(v=>String(v||'').toLowerCase().includes(query)));
  employees.sort((a,b)=>{
    const aCurrent=Number(a.department_id)===departmentId?0:1;
    const bCurrent=Number(b.department_id)===departmentId?0:1;
    if(aCurrent!==bCurrent)return aCurrent-bCurrent;
    return String(a.nickname||a.first_name||'').localeCompare(String(b.nickname||b.first_name||''),'th');
  });
  root.innerHTML=employees.length?employees.map(e=>{
    const inDepartment=Number(e.department_id)===departmentId;
    const currentDept=e.department_name||'ยังไม่ระบุแผนก';
    const statusText=inDepartment?'อยู่ในแผนกนี้แล้ว':`ปัจจุบัน: ${currentDept}`;
    return `<label class="position-person-row department-person-row"><input type="checkbox" value="${e.id}" ${inDepartment?'checked':''}/><span class="person-mini-avatar">${initial(e)}</span><span class="position-person-copy"><strong>${escapeHtml(e.nickname||e.first_name)} ${escapeHtml(e.last_name||'')}</strong><small>${escapeHtml(e.employee_code||'')} · ${escapeHtml(statusText)}${e.position_name?` · ${escapeHtml(e.position_name)}`:''}</small></span></label>`;
  }).join(''):emptyState('ไม่พบพนักงาน','ลองค้นหาด้วยชื่อ รหัสพนักงาน แผนก หรือตำแหน่ง');
  const syncCount=()=>{
    const checked=$$('#departmentAssignPeople input:checked').length;
    $('#departmentAssignCount').textContent=`${checked} คน`;
  };
  syncCount();
  $$('#departmentAssignPeople input').forEach(input=>input.onchange=syncCount);
}
async function saveDepartmentAssignment(){
  const id=Number($('#departmentAssignId').value||0);
  const employee_ids=$$('#departmentAssignPeople input:checked').map(i=>Number(i.value));
  const button=$('#departmentAssignSaveBtn'); button.disabled=true;
  try{
    const result=await api(`/api/departments/${id}/assign`,{method:'POST',body:JSON.stringify({employee_ids})});
    const selected=new Set(employee_ids.map(Number));
    state.employees.forEach(employee=>{
      if(employee.status!=='active')return;
      if(Number(employee.department_id)===id&&!selected.has(Number(employee.id))) patchEmployeeLocal(employee.id,{department_id:null});
      if(selected.has(Number(employee.id))) patchEmployeeLocal(employee.id,{department_id:id});
    });
    $('#departmentAssignModal').close();
    renderPeopleFast();
    const resetCount=Number(result?.position_reset_count||0);
    toast(resetCount?`จัดพนักงานเข้าแผนกแล้ว ${employee_ids.length} คน · ล้างตำแหน่งเดิม ${resetCount} คน`:`จัดพนักงานเข้าแผนกแล้ว ${employee_ids.length} คน`);
    schedulePeopleRefresh(650);
  }catch(e){toast(e.message,true);}finally{button.disabled=false;}
}

window.setOrganizationViewMode = mode => {
  state.organizationViewMode = mode === 'list' ? 'list' : 'chart';
  try { localStorage.setItem('nakna.organizationViewMode', state.organizationViewMode); } catch {}
  renderPeopleCore();
};

window.openOrganizationBuilder = function openOrganizationBuilder(){
  renderOrganizationBuilder();
  $('#organizationBuilderModal')?.showModal();
}
function organizationDepartmentChildrenMap(){
  const map=new Map();
  for(const d of state.peopleCore?.departments||[]){
    const parent=d.parent_department_id?Number(d.parent_department_id):0;
    if(!map.has(parent))map.set(parent,[]);
    map.get(parent).push(d);
  }
  for(const list of map.values()) list.sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)||String(a.name||'').localeCompare(String(b.name||''),'th'));
  return map;
}
function organizationDeptDepthMap(){
  const departments=state.peopleCore?.departments||[];
  const byId=new Map(departments.map(d=>[Number(d.id),d]));
  const depth=new Map();
  const get=id=>{ if(depth.has(id))return depth.get(id); let n=0,c=byId.get(id),seen=new Set([id]); while(c?.parent_department_id){ const p=Number(c.parent_department_id); if(seen.has(p)||!byId.has(p))break; seen.add(p); n++; c=byId.get(p); if(n>20)break; } depth.set(id,n); return n; };
  departments.forEach(d=>get(Number(d.id)));
  return depth;
}
function renderOrganizationBuilder(){
  const root=$('#organizationBuilderList'); if(!root)return;
  const departments=state.peopleCore?.departments||[];
  const depthMap=organizationDeptDepthMap();
  const sorted=[...departments].sort((a,b)=>{
    const da=depthMap.get(Number(a.id))||0, db=depthMap.get(Number(b.id))||0;
    if(da!==db)return da-db;
    return Number(a.sort_order||0)-Number(b.sort_order||0)||String(a.name||'').localeCompare(String(b.name||''),'th');
  });
  $('#organizationBuilderCount').textContent=`${departments.length} แผนก`;
  root.innerHTML=sorted.length?sorted.map(d=>{
    const depth=depthMap.get(Number(d.id))||0;
    const parent=departments.find(x=>Number(x.id)===Number(d.parent_department_id));
    const options=departments.filter(x=>Number(x.id)!==Number(d.id)).map(x=>`<option value="${x.id}" ${Number(d.parent_department_id)===Number(x.id)?'selected':''}>${escapeHtml(x.name)}</option>`).join('');
    return `<article class="organization-builder-row" draggable="true" data-department-id="${Number(d.id)}" style="--builder-depth:${Math.min(depth,5)}">
      <div class="organization-drag-handle" title="ลากเพื่อย้าย">⋮⋮</div>
      <div class="organization-builder-info"><div class="organization-builder-title"><strong>${escapeHtml(d.name)}</strong><span>${Number(d.employee_count||0)} คน</span></div><small>${parent?`ขึ้นตรงกับ ${escapeHtml(parent.name)}`:'ระดับบนสุด'}${d.manager_employee_id?` · หัวหน้า ${escapeHtml(d.manager_nickname||d.manager_first_name||'กำหนดแล้ว')}`:''}</small></div>
      <label class="organization-parent-control"><span>ขึ้นตรงกับ</span><select onchange="window.quickChangeDepartmentParent(${Number(d.id)},this.value)"><option value="">ระดับบนสุด</option>${options}</select></label>
      <div class="organization-builder-order"><button type="button" title="ขึ้น" onclick="window.moveDepartment(${Number(d.id)},'up');setTimeout(()=>window.renderOrganizationBuilder?.(),300)">↑</button><button type="button" title="ลง" onclick="window.moveDepartment(${Number(d.id)},'down');setTimeout(()=>window.renderOrganizationBuilder?.(),300)">↓</button></div>
      <button class="organization-builder-edit" type="button" onclick="window.editDepartment(${Number(d.id)})">แก้ไข</button>
    </article>`;
  }).join(''):emptyState('ยังไม่มีแผนก','กด + แผนก เพื่อเริ่มสร้างโครงสร้าง');
  $$('.organization-builder-row').forEach(row=>{
    row.ondragstart=e=>{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',row.dataset.departmentId);row.classList.add('dragging');};
    row.ondragend=()=>row.classList.remove('dragging');
    row.ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect='move';row.classList.add('drag-over');};
    row.ondragleave=()=>row.classList.remove('drag-over');
    row.ondrop=async e=>{e.preventDefault();e.stopPropagation();row.classList.remove('drag-over');const draggedId=Number(e.dataTransfer.getData('text/plain')||0);const targetId=Number(row.dataset.departmentId||0);if(draggedId&&targetId&&draggedId!==targetId)await setDepartmentParentQuick(draggedId,targetId);};
  });
}
window.renderOrganizationBuilder=renderOrganizationBuilder;
async function setDepartmentParentQuick(id,parentId){
  try{
    await api(`/api/departments/${Number(id)}`,{method:'PATCH',body:JSON.stringify({parent_department_id:parentId||null})});
    await loadAll({silent:true});
    renderOrganizationBuilder();
    toast(parentId?'โยงสายบังคับบัญชาแล้ว':'ย้ายเป็นระดับบนสุดแล้ว');
  }catch(e){toast(e.message,true);}
}
window.quickChangeDepartmentParent=async(id,value)=>setDepartmentParentQuick(id,value?Number(value):null);
window.openDepartmentLink = id => {
  const department=(state.peopleCore?.departments||[]).find(d=>Number(d.id)===Number(id));
  if(!department)return;
  $('#departmentLinkId').value=department.id;
  $('#departmentLinkTitle').textContent=`โยงเส้นลำดับ · ${department.name}`;
  $('#departmentLinkDepartmentName').textContent=department.name;
  $('#departmentLinkParent').innerHTML=`<option value="">ไม่มี / วางเป็นระดับบนสุด</option>${(state.peopleCore?.departments||[]).filter(d=>Number(d.id)!==Number(department.id)).map(d=>`<option value="${d.id}" ${Number(department.parent_department_id)===Number(d.id)?'selected':''}>${escapeHtml(d.name)}</option>`).join('')}`;
  $('#departmentLinkOrder').value=String(Number(department.sort_order||0));
  const parent=(state.peopleCore?.departments||[]).find(d=>Number(d.id)===Number(department.parent_department_id));
  $('#departmentLinkHint').textContent=parent?`ปัจจุบันขึ้นตรงกับ ${parent.name}`:'ปัจจุบันวางเป็นแผนกหลักระดับบนสุด';
  $('#departmentLinkModal').showModal();
};
async function saveDepartmentLink(){
  const id=Number($('#departmentLinkId').value||0);
  const parentRaw=$('#departmentLinkParent').value;
  const sortOrder=Math.max(0, Number($('#departmentLinkOrder').value||0));
  const button=$('#departmentLinkSaveBtn');
  button.disabled=true;
  try{
    await api(`/api/departments/${id}`,{method:'PATCH',body:JSON.stringify({parent_department_id:parentRaw||null,sort_order:sortOrder})});
    $('#departmentLinkModal').close();
    await loadAll({silent:true});
    toast('บันทึกการโยงเส้นและลำดับแล้ว');
  }catch(e){toast(e.message,true);}finally{button.disabled=false;}
}
function sortDepartmentsForView(items){
  return [...(items||[])].sort((a,b)=>{
    const ao=Number.isFinite(Number(a?.sort_order))?Number(a.sort_order):0;
    const bo=Number.isFinite(Number(b?.sort_order))?Number(b.sort_order):0;
    if(ao!==bo)return ao-bo;
    return String(a?.name||'').localeCompare(String(b?.name||''),'th');
  });
}
window.moveDepartment = async (id,direction) => {
  const departments=state.peopleCore?.departments||[];
  const current=departments.find(d=>Number(d.id)===Number(id));
  if(!current)return;
  const parentId=current.parent_department_id?Number(current.parent_department_id):0;
  const siblings=sortDepartmentsForView(departments.filter(d=>(d.parent_department_id?Number(d.parent_department_id):0)===parentId));
  const index=siblings.findIndex(d=>Number(d.id)===Number(id));
  const delta=direction==='up'?-1:1;
  const target=siblings[index+delta];
  if(!target)return toast(direction==='up'?'แผนกนี้อยู่บนสุดแล้ว':'แผนกนี้อยู่ล่างสุดแล้ว',true);
  const currentOrder=Number.isFinite(Number(current.sort_order))?Number(current.sort_order):index;
  const targetOrder=Number.isFinite(Number(target.sort_order))?Number(target.sort_order):index+delta;
  try{
    await Promise.all([
      api(`/api/departments/${current.id}`,{method:'PATCH',body:JSON.stringify({sort_order:targetOrder})}),
      api(`/api/departments/${target.id}`,{method:'PATCH',body:JSON.stringify({sort_order:currentOrder})}),
    ]);
    await loadAll({silent:true});
    toast(`ย้ายลำดับ ${current.name} แล้ว`);
  }catch(e){toast(e.message,true);}
};

window.openPositionAssignment = id => {
  const position=(state.peopleCore?.positions||[]).find(p=>Number(p.id)===Number(id)); if(!position)return;
  $('#positionAssignId').value=position.id;
  $('#positionAssignTitle').textContent=`จัดคน · ${position.name}`;
  $('#positionAssignSubtitle').textContent=position.department_name?`ตำแหน่งนี้อยู่ในแผนก ${position.department_name} · คนที่เลือกจะถูกย้ายเข้าแผนกนี้อัตโนมัติ`:'เลือกพนักงานที่ต้องการให้อยู่ในตำแหน่งนี้';
  $('#positionAssignSearch').value='';
  renderPositionAssignPeople();
  $('#positionAssignModal').showModal();
};
window.openPositionForDepartment = departmentId => openPositionModal(Number(departmentId));
function renderPositionAssignPeople(){
  const root=$('#positionAssignPeople'); if(!root)return;
  const positionId=Number($('#positionAssignId').value||0);
  const query=String($('#positionAssignSearch').value||'').trim().toLowerCase();
  let employees=state.employees.filter(e=>e.status==='active');
  if(query) employees=employees.filter(e=>[e.nickname,e.first_name,e.last_name,e.employee_code,e.department_name,e.position_name].some(v=>String(v||'').toLowerCase().includes(query)));
  root.innerHTML=employees.length?employees.map(e=>`<label class="position-person-row"><input type="checkbox" value="${e.id}" ${Number(e.position_id)===positionId?'checked':''}/><span class="person-mini-avatar">${initial(e)}</span><span class="position-person-copy"><strong>${escapeHtml(e.nickname||e.first_name)} ${escapeHtml(e.last_name||'')}</strong><small>${escapeHtml(e.employee_code||'')} · ${escapeHtml(e.department_name||'ยังไม่ระบุแผนก')} · ${escapeHtml(e.position_name||'ยังไม่ระบุตำแหน่ง')}</small></span></label>`).join(''):emptyState('ไม่พบพนักงาน','ลองค้นหาด้วยชื่อ รหัสพนักงาน หรือแผนก');
  const syncCount=()=>{$('#positionAssignCount').textContent=`${$$('#positionAssignPeople input:checked').length} คน`;};
  syncCount();
  $$('#positionAssignPeople input').forEach(input=>input.onchange=syncCount);
}
async function savePositionAssignment(){
  const id=Number($('#positionAssignId').value||0);
  const employee_ids=$$('#positionAssignPeople input:checked').map(i=>Number(i.value));
  const button=$('#positionAssignSaveBtn'); button.disabled=true;
  try{
    await api(`/api/positions/${id}/assign`,{method:'POST',body:JSON.stringify({employee_ids})});
    const selected=new Set(employee_ids.map(Number));
    state.employees.forEach(employee=>{
      if(Number(employee.position_id)===id&&!selected.has(Number(employee.id))) patchEmployeeLocal(employee.id,{position_id:null});
      if(selected.has(Number(employee.id))) patchEmployeeLocal(employee.id,{position_id:id});
    });
    $('#positionAssignModal').close();
    renderPeopleFast();
    toast(`บันทึกคนในตำแหน่งแล้ว ${employee_ids.length} คน`);
    schedulePeopleRefresh(650);
  }catch(e){toast(e.message,true);}finally{button.disabled=false;}
}

window.setTeamDirectorySearch = value => { state.teamDirectorySearch=String(value||''); renderPeopleCore(); requestAnimationFrame(()=>{const input=$('#teamDirectorySearch');if(input){input.focus();try{input.setSelectionRange(input.value.length,input.value.length)}catch{}}}); };
window.setTeamDirectoryDepartment = value => { state.teamDirectoryDepartment=String(value||'all'); renderPeopleCore(); };
window.clearTeamDirectoryFilters = () => { state.teamDirectorySearch=''; state.teamDirectoryDepartment='all'; renderPeopleCore(); };
window.quickSetEmployeePosition = async (employeeId,positionId) => {
  const employee=state.employees.find(e=>Number(e.id)===Number(employeeId)); if(!employee)return;
  const select=document.querySelector(`[data-quick-position="${Number(employeeId)}"]`); if(select)select.disabled=true;
  const previous=employee.position_id||null;
  try{
    await api(`/api/employees/${Number(employeeId)}/team-placement`,{method:'PATCH',body:JSON.stringify({department_id:employee.department_id||null,position_id:positionId||null})});
    patchEmployeeLocal(employeeId,{position_id:positionId||null});
    renderPeopleFast();
    toast('อัปเดตตำแหน่งแล้ว');
    schedulePeopleRefresh(800);
  }catch(e){patchEmployeeLocal(employeeId,{position_id:previous});renderPeopleFast();toast(e.message,true);}finally{if(select)select.disabled=false;}
};
window.quickSetEmployeeDepartment = async (employeeId,departmentId) => {
  const employee=state.employees.find(e=>Number(e.id)===Number(employeeId)); if(!employee)return;
  const select=document.querySelector(`[data-quick-department="${Number(employeeId)}"]`); if(select)select.disabled=true;
  const previous=employee.department_id||null;
  try{
    await api(`/api/employees/${Number(employeeId)}/team-placement`,{method:'PATCH',body:JSON.stringify({department_id:departmentId||null,position_id:employee.position_id||null})});
    patchEmployeeLocal(employeeId,{department_id:departmentId||null});
    renderPeopleFast();
    toast('ย้ายแผนกแล้ว');
    schedulePeopleRefresh(800);
  }catch(e){patchEmployeeLocal(employeeId,{department_id:previous});renderPeopleFast();toast(e.message,true);}finally{if(select)select.disabled=false;}
};

function renderPeopleCore(){
  const core=state.peopleCore||{}; const departments=core.departments||[]; const schedules=core.schedules||[]; const holidays=core.holidays||[];
  const org=$('#organizationChart');
  if(org){
    const activeEmployees=state.employees.filter(e=>e.status==='active');
    const positions=[...(core.positions||[])].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'th'));
    const departments=[...(core.departments||[])].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'th'));
    const query=String(state.teamDirectorySearch||'').trim().toLowerCase();
    const deptFilter=String(state.teamDirectoryDepartment||'all');
    const matches=e=>!query||[e.nickname,e.first_name,e.last_name,e.employee_code,e.department_name,e.position_name].some(v=>String(v||'').toLowerCase().includes(query));
    const positionOptions=e=>`<option value="">ยังไม่ระบุตำแหน่ง</option>${positions.map(p=>`<option value="${p.id}" ${Number(e.position_id)===Number(p.id)?'selected':''}>${escapeHtml(p.name)}</option>`).join('')}`;
    const departmentOptions=e=>`<option value="">ยังไม่ระบุแผนก</option>${departments.map(d=>`<option value="${d.id}" ${Number(e.department_id)===Number(d.id)?'selected':''}>${escapeHtml(d.name)}</option>`).join('')}`;
    const personRow=e=>`<div class="team-directory-row"><div class="team-person-cell"><span class="team-person-avatar">${escapeHtml(initial(e))}</span><div><strong>${escapeHtml(e.nickname||e.first_name||'ไม่ระบุชื่อ')} ${escapeHtml(e.last_name||'')}</strong><small>${escapeHtml(e.employee_code||'ไม่มีรหัสพนักงาน')}</small></div></div><div class="team-position-cell"><span class="mobile-cell-label">ตำแหน่ง</span><select data-quick-position="${Number(e.id)}" onchange="window.quickSetEmployeePosition(${Number(e.id)},this.value)">${positionOptions(e)}</select></div><div class="team-department-cell"><span class="mobile-cell-label">แผนก</span><select data-quick-department="${Number(e.id)}" onchange="window.quickSetEmployeeDepartment(${Number(e.id)},this.value)">${departmentOptions(e)}</select></div><div class="team-status-cell"><span class="people-status ${peopleStatusTone(e.people_status||'employee')}">${escapeHtml(peopleStatusLabel(e.people_status||'employee'))}</span></div><button class="icon-action-btn" type="button" onclick="window.openPeopleProfile(${Number(e.id)})">แก้ไข</button></div>`;
    const groups=[];
    for(const d of departments){
      if(deptFilter!=='all'&&deptFilter!==String(d.id))continue;
      const people=activeEmployees.filter(e=>Number(e.department_id)===Number(d.id)&&matches(e));
      if(query&&!people.length)continue;
      groups.push({id:d.id,name:d.name,manager:d.manager_employee_id?(d.manager_nickname||d.manager_first_name||'กำหนดแล้ว'):'ยังไม่กำหนดหัวหน้า',people});
    }
    const unassigned=activeEmployees.filter(e=>!e.department_id&&matches(e));
    if((deptFilter==='all'||deptFilter==='unassigned')&&unassigned.length)groups.push({id:null,name:'ยังไม่ระบุแผนก',manager:'—',people:unassigned,unassigned:true});
    const visiblePeople=groups.reduce((n,g)=>n+g.people.length,0);
    const filterOptions=`<option value="all">ทุกแผนก</option>${departments.map(d=>`<option value="${d.id}" ${deptFilter===String(d.id)?'selected':''}>${escapeHtml(d.name)}</option>`).join('')}<option value="unassigned" ${deptFilter==='unassigned'?'selected':''}>ยังไม่ระบุแผนก</option>`;
    const groupHtml=g=>`<section class="team-department-group ${g.unassigned?'is-unassigned':''}"><header class="team-department-header"><div><div class="team-department-title"><strong>${escapeHtml(g.name)}</strong><span>${g.people.length} คน</span></div><small>${g.unassigned?'พนักงานที่ยังไม่ได้จัดแผนก':`หัวหน้า: ${escapeHtml(g.manager)}`}</small></div>${g.id?`<div class="team-department-header-actions"><button type="button" onclick="window.openDepartmentAssignment(${Number(g.id)})">เพิ่ม/ย้ายคน</button><button type="button" onclick="window.editDepartment(${Number(g.id)})">ตั้งค่า</button></div>`:''}</header><div class="team-directory-columns"><span>พนักงาน</span><span>ตำแหน่ง</span><span>แผนก</span><span>สถานะ</span><span></span></div><div class="team-directory-rows">${g.people.length?g.people.map(personRow).join(''):`<div class="team-empty-row"><span>ยังไม่มีพนักงานในแผนกนี้</span>${g.id?`<button type="button" onclick="window.openDepartmentAssignment(${Number(g.id)})">+ เพิ่มพนักงาน</button>`:''}</div>`}</div></section>`;
    org.innerHTML=`<div class="team-directory-toolbar"><div class="team-directory-search"><span>⌕</span><input id="teamDirectorySearch" type="search" value="${escapeHtml(state.teamDirectorySearch||'')}" placeholder="ค้นหาชื่อ รหัส ตำแหน่ง..." oninput="window.setTeamDirectorySearch(this.value)"/></div><select class="team-directory-filter" onchange="window.setTeamDirectoryDepartment(this.value)">${filterOptions}</select><div class="team-directory-count"><strong>${visiblePeople}</strong><span>จาก ${activeEmployees.length} พนักงาน · ${departments.length} แผนก</span></div><button class="secondary-btn team-add-employee" type="button" onclick="window.openEmployeeModal()">+ พนักงาน</button></div>${groups.length?`<div class="team-directory-groups">${groups.map(groupHtml).join('')}</div>`:`<div class="team-no-result"><strong>ไม่พบพนักงาน</strong><span>ลองเปลี่ยนคำค้นหาหรือเลือกแผนกอื่น</span><button type="button" onclick="window.clearTeamDirectoryFilters()">ล้างตัวกรอง</button></div>`}`;
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
  renderAttendanceSettingsControls();
}

window.editDepartment=id=>openDepartmentModal((state.peopleCore.departments||[]).find(d=>Number(d.id)===Number(id)));
function openDepartmentModal(department=null){
  $('#departmentId').value=department?.id||''; $('#departmentName').value=department?.name||''; $('#departmentCode').value=department?.code||'';
  $('#departmentParent').innerHTML=`<option value="">ไม่มี / เป็นแผนกหลัก</option>${(state.peopleCore.departments||[]).filter(d=>Number(d.id)!==Number(department?.id)).map(d=>`<option value="${d.id}" ${Number(department?.parent_department_id)===Number(d.id)?'selected':''}>${escapeHtml(d.name)}</option>`).join('')}`;
  $('#departmentManager').innerHTML=`<option value="">ยังไม่กำหนด</option>${state.employees.filter(e=>e.status==='active').map(e=>`<option value="${e.id}" ${Number(department?.manager_employee_id)===Number(e.id)?'selected':''}>${escapeHtml(e.nickname||e.first_name)}${e.department_name?` · ${escapeHtml(e.department_name)}`:''}</option>`).join('')}`;
  if ($('#departmentSortOrder')) $('#departmentSortOrder').value=String(Number(department?.sort_order||0));
  $('#departmentModalTitle').textContent=department?'แก้ไขแผนก':'เพิ่มแผนก'; $('#departmentModal').showModal();
}
async function saveDepartment(){
  const id=$('#departmentId').value;
  const isCreating=!id;
  const body={name:$('#departmentName').value.trim(),code:$('#departmentCode').value.trim(),parent_department_id:$('#departmentParent').value||null,manager_employee_id:$('#departmentManager').value||null,sort_order:Math.max(0,Number($('#departmentSortOrder')?.value||0))};
  if(body.name.length<2)return toast('กรุณาใส่ชื่อแผนก',true);
  const b=$('#departmentSaveBtn');b.disabled=true;
  try{
    const result=await api(id?`/api/departments/${id}`:'/api/departments',{method:id?'PATCH':'POST',body:JSON.stringify(body)});
    $('#departmentModal').close();
    const resumePosition=Boolean(state.resumePositionAfterDepartment && isCreating);
    state.resumePositionAfterDepartment=false;
    const departmentId=Number(id||result?.id||0);
    const manager=state.employees.find(e=>Number(e.id)===Number(body.manager_employee_id));
    const patch={id:departmentId,name:body.name,code:body.code||null,parent_department_id:normalizeNullableId(body.parent_department_id),manager_employee_id:normalizeNullableId(body.manager_employee_id),sort_order:Number(body.sort_order||0),manager_nickname:manager?.nickname||null,manager_first_name:manager?.first_name||null,employee_count:Number((state.peopleCore.departments||[]).find(d=>Number(d.id)===departmentId)?.employee_count||0)};
    const currentIndex=(state.peopleCore.departments||[]).findIndex(d=>Number(d.id)===departmentId);
    if(currentIndex>=0) state.peopleCore.departments[currentIndex]={...state.peopleCore.departments[currentIndex],...patch}; else state.peopleCore.departments.push(patch);
    renderPeopleFast();
    toast('บันทึกแผนกแล้ว');
    schedulePeopleRefresh(650,{includeLookups:true});
    if(resumePosition) requestAnimationFrame(()=>openPositionModal());
  }catch(e){toast(e.message,true);}finally{b.disabled=false;}
}
function openPositionModal(){
  $('#positionName').value='';
  $('#positionModal').showModal();
  requestAnimationFrame(()=>$('#positionName')?.focus());
}
async function savePosition(){
  const body={name:$('#positionName').value.trim()}; if(body.name.length<2)return toast('กรุณาใส่ชื่อตำแหน่ง',true);
  const b=$('#positionSaveBtn');b.disabled=true;
  try{
    const result=await api('/api/positions',{method:'POST',body:JSON.stringify(body)});
    const positionId=Number(result?.id||0);
    if(positionId&&!state.peopleCore.positions.some(p=>Number(p.id)===positionId)) state.peopleCore.positions.push({id:positionId,name:body.name,department_id:null,employee_count:0});
    $('#positionModal').close();
    renderPeopleFast();
    toast(result?.reused?'ตำแหน่งนี้มีอยู่แล้ว ใช้รายการเดิมได้เลย':'เพิ่มตำแหน่งกลางแล้ว');
    schedulePeopleRefresh(650,{includeLookups:true});
    const employeeId=Number(state.returnToPeopleProfileAfterPosition||0);state.returnToPeopleProfileAfterPosition=null;
    if(employeeId)requestAnimationFrame(()=>window.openPeopleProfile(employeeId));
  }catch(e){toast(e.message,true);}finally{b.disabled=false;}
}
window.openScheduleFor=(type,id)=>openScheduleModal(type,id);
window.resetSchedule=async(type,id)=>{if(!confirm('ล้างตาราง Override นี้และกลับไปใช้ค่าระดับบนใช่ไหม?'))return;try{await api(`/api/work-schedules/${type}/${Number(id||0)}`,{method:'DELETE'});await loadAll({silent:true});toast('ล้างตาราง Override แล้ว');}catch(e){toast(e.message,true);}};
function openScheduleModal(type='company',id=0){$('#scheduleScopeType').value=type;refreshScheduleTarget();if(id)$('#scheduleScopeId').value=String(id);$('#scheduleStart').value=state.companyProfile?.work_start||'09:00';$('#scheduleEnd').value=state.companyProfile?.work_end||'18:00';$('#scheduleGrace').value=String(state.companyProfile?.late_grace_minutes??10);$('#scheduleIsWorkday').checked=true;$$('#scheduleWeekdays input').forEach((input,i)=>input.checked=i<5);$('#scheduleModal').showModal();}
function refreshScheduleTarget(){const type=$('#scheduleScopeType').value;const target=$('#scheduleScopeId');if(type==='company'){target.innerHTML='<option value="0">ทั้งบริษัท</option>';target.disabled=true;}else if(type==='department'){target.disabled=false;target.innerHTML=(state.peopleCore.departments||[]).map(d=>`<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');}else{target.disabled=false;target.innerHTML=state.employees.filter(e=>e.status==='active').map(e=>`<option value="${e.id}">${escapeHtml(e.nickname||e.first_name)} · ${escapeHtml(e.employee_code)}</option>`).join('');}}
async function saveSchedule(){const weekdays=$$('#scheduleWeekdays input:checked').map(i=>Number(i.value));if(!weekdays.length)return toast('เลือกวันที่ต้องการตั้งเวลาอย่างน้อย 1 วัน',true);const body={scope_type:$('#scheduleScopeType').value,scope_id:Number($('#scheduleScopeId').value||0),rules:weekdays.map(weekday=>({weekday,is_workday:$('#scheduleIsWorkday').checked,start_time:$('#scheduleStart').value,end_time:$('#scheduleEnd').value,late_grace_minutes:Number($('#scheduleGrace').value||0)}))};const b=$('#scheduleSaveBtn');b.disabled=true;try{await api('/api/work-schedules',{method:'PUT',body:JSON.stringify(body)});$('#scheduleModal').close();await loadAll({silent:true});toast('บันทึกเวลาทำงานแล้ว');}catch(e){toast(e.message,true);}finally{b.disabled=false;}}
function openHolidayModal(){ $('#holidayDate').value='';$('#holidayName').value='';$('#holidayType').value='traditional';$('#holidayPaid').checked=true;$('#holidayNotes').value='';$('#holidayModal').showModal(); }
async function saveHoliday(){const body={holiday_date:$('#holidayDate').value,name:$('#holidayName').value.trim(),holiday_type:$('#holidayType').value,is_paid:$('#holidayPaid').checked,notes:$('#holidayNotes').value.trim()};const b=$('#holidaySaveBtn');b.disabled=true;try{await api('/api/company-holidays',{method:'POST',body:JSON.stringify(body)});$('#holidayModal').close();await loadAll({silent:true});toast('เพิ่มวันหยุดบริษัทแล้ว');}catch(e){toast(e.message,true);}finally{b.disabled=false;}}
window.deleteHoliday=async id=>{if(!confirm('ลบวันหยุดนี้ใช่ไหม?'))return;try{await api(`/api/company-holidays/${id}`,{method:'DELETE'});await loadAll({silent:true});toast('ลบวันหยุดแล้ว');}catch(e){toast(e.message,true);}};
function renderAttendanceReminderSettings(){
  const card=$('#attendanceReminderCard'),toggle=$('#attendanceReminderToggle'),message=$('#attendanceReminderMessage');
  if(!card||!toggle||!message)return;
  const settings=state.peopleCore?.attendance_reminder||{};
  const enabled=settings.enabled!==false;
  const text=String(settings.message_text||DEFAULT_ATTENDANCE_REMINDER_MESSAGE).trim()||DEFAULT_ATTENDANCE_REMINDER_MESSAGE;
  toggle.checked=enabled;
  if(document.activeElement!==message) message.value=text;
  updateAttendanceReminderEditor();
}
function updateAttendanceReminderEditor(){
  const card=$('#attendanceReminderCard'),toggle=$('#attendanceReminderToggle'),message=$('#attendanceReminderMessage');
  if(!card||!toggle||!message)return;
  const enabled=Boolean(toggle.checked),text=String(message.value||'').slice(0,300);
  card.classList.toggle('is-disabled',!enabled);
  const status=$('#attendanceReminderStatus');
  if(status){status.textContent=enabled?'เปิดใช้งาน · ส่งเฉพาะคนที่ยังไม่เช็กอินเวลา 12:30 น.':'ปิดใช้งาน · วันนี้และวันถัดไปจะไม่ส่งข้อความเตือน';status.className=enabled?'is-on':'is-off';}
  if($('#attendanceReminderCharCount')) $('#attendanceReminderCharCount').textContent=String(text.length);
  if($('#attendanceReminderPreviewText')) $('#attendanceReminderPreviewText').textContent=text.trim()||DEFAULT_ATTENDANCE_REMINDER_MESSAGE;
}
async function saveAttendanceReminderSettings({fromToggle=false}={}){
  const toggle=$('#attendanceReminderToggle'),message=$('#attendanceReminderMessage'),button=$('#attendanceReminderSaveBtn');
  if(!toggle||!message)return;
  const previous={...(state.peopleCore?.attendance_reminder||{})};
  const body={enabled:Boolean(toggle.checked),message_text:String(message.value||'').trim()||DEFAULT_ATTENDANCE_REMINDER_MESSAGE};
  if(body.message_text.length>300)return toast('ข้อความแจ้งเตือนยาวเกิน 300 ตัวอักษร',true);
  if(button)button.disabled=true; toggle.disabled=true;
  const status=$('#attendanceReminderStatus'); if(status){status.textContent='กำลังบันทึก…';status.className='saving';}
  try{
    const result=await api('/api/attendance-reminder-settings',{method:'PATCH',body:JSON.stringify(body),silentStatus:true});
    state.peopleCore.attendance_reminder=result.settings||body;
    renderAttendanceReminderSettings();
    toast(body.enabled?(fromToggle?'เปิดระบบแจ้งเตือน 12:30 น. แล้ว':'บันทึกข้อความแจ้งเตือนแล้ว'):'ปิดระบบแจ้งเตือนคนยังไม่เช็กอินแล้ว');
  }catch(e){
    state.peopleCore.attendance_reminder=previous; renderAttendanceReminderSettings(); toast(e.message,true);
  }finally{if(button)button.disabled=false;toggle.disabled=false;}
}


function ensureAttendanceFaceCard(){
  const host=document.querySelector('.settings-category-panel[data-settings-category="attendance"] .work-location-section');
  if(!host)return null;
  const policy=host.querySelector('.attendance-policy-card');
  const reminder=$('#attendanceReminderCard');
  const existing=$('#attendanceFaceCard');
  if(existing){
    existing.classList.remove('hidden');
    existing.style.removeProperty('display');
    // Keep Face Verification in one deterministic place: directly after the geofence policy.
    if(policy && policy.nextElementSibling!==existing) policy.insertAdjacentElement('afterend',existing);
    else if(!policy && existing.parentElement!==host) host.prepend(existing);
    return existing;
  }
  const wrap=document.createElement('div');
  wrap.innerHTML=`<section id="attendanceFaceCard" class="attendance-face-card face-card-recovered">
    <div class="attendance-face-head">
      <div class="attendance-face-icon" aria-hidden="true">◉</div>
      <div class="attendance-face-copy">
        <div class="attendance-face-title-row"><strong>ยืนยันตัวตนด้วยใบหน้า</strong><span class="badge badge-soft">FACE VERIFY · BETA · P9.15.3</span></div>
        <p>Face Verification แยกจาก Location โดยสิ้นเชิง ใช้ยืนยันว่าเป็นเจ้าของบัญชีจริงก่อนบันทึกเวลา</p>
        <small id="attendanceFaceStatus">กำลังโหลดการตั้งค่า…</small>
      </div>
    </div>
    <div class="attendance-face-grid">
      <label class="field"><span>โหมดการใช้งาน</span><select id="attendanceFaceMode">
        <option value="off">ปิดใช้งาน</option>
        <option value="enroll">ช่วงลงทะเบียน · ยังไม่บังคับ</option>
        <option value="required">บังคับยืนยันก่อนเช็กอิน</option>
      </select></label>
      <div class="attendance-face-option"><div><strong>ตรวจตอนเช็กเอาต์ด้วย</strong><small>เช็กอินจะตรวจเสมอเมื่อเลือกโหมดบังคับ</small></div><label class="switch"><input id="attendanceFaceCheckoutToggle" type="checkbox"/><span></span></label></div>
    </div>
    <div class="attendance-face-summary">
      <div><strong id="attendanceFaceReadyCount">0/0</strong><span>ลงทะเบียนแล้ว</span></div>
      <div><strong id="attendanceFacePendingCount">0</strong><span>ยังไม่ลงทะเบียน</span></div>
      <div class="attendance-face-privacy"><b>ไม่เก็บรูปประจำวัน</b><span>ภาพจากกล้องใช้ชั่วคราวเพื่อสร้าง Face Template แล้วทิ้งทันที · Template ในฐานข้อมูลเข้ารหัส</span></div>
    </div>
    <div id="attendanceFacePendingPeople" class="attendance-face-pending hidden"></div>
    <div class="attendance-face-rollout">
      <div class="attendance-face-rollout-copy"><strong>สแกนหน้าได้จากตรงนี้</strong><span>กดปุ่มด้านล่างเพื่อเปิดกล้องทันที ไม่สร้าง Check-in ซ้ำ และใช้ทดสอบได้แม้วันนี้เช็กอินแล้ว</span></div>
      <div class="attendance-face-rollout-buttons">
        <button id="attendanceFaceSelfTestBtn" class="primary-btn attendance-face-scan-btn" type="button">สแกน / ลงทะเบียนใบหน้าของฉัน</button>
        <button id="attendanceFaceRemindBtn" class="secondary-btn" type="button">ส่ง LINE ให้คนที่ยังไม่ลงทะเบียน</button>
        <button id="attendanceFaceCopyInstructionBtn" class="text-btn" type="button">คัดลอกข้อความแจ้งทีม</button>
      </div>
      <small id="attendanceFaceRolloutStatus" class="attendance-face-rollout-status">กำลังโหลดสถานะการลงทะเบียน…</small>
    </div>
    <div class="attendance-face-actions"><small id="attendanceFaceAutosaveNote">เปลี่ยนค่าแล้วระบบจะบันทึกอัตโนมัติ</small></div>
  </section>`;
  const card=wrap.firstElementChild;
  if(policy) policy.insertAdjacentElement('afterend',card);
  else if(reminder) host.insertBefore(card,reminder);
  else host.appendChild(card);
  return card;
}


let attendanceFaceSettingsFetchPromise=null;
function attendanceFaceBool(value){
  if(value===true||value===1)return true;
  if(value===false||value===0||value==null)return false;
  const normalized=String(value).trim().toLowerCase();
  return ['1','true','yes','on'].includes(normalized);
}
function bindAttendanceFaceControls(){
  ensureAttendanceFaceCard();
  const mode=$('#attendanceFaceMode');
  const checkout=$('#attendanceFaceCheckoutToggle');
  const remind=$('#attendanceFaceRemindBtn');
  const self=$('#attendanceFaceSelfTestBtn');
  const copy=$('#attendanceFaceCopyInstructionBtn');
  if(mode) mode.onchange=()=>{ updateAttendanceFaceModeHint(); saveAttendanceFaceSettings({silentSuccess:true}); };
  if(checkout) checkout.onchange=()=>{
    // P9.20: checkout preference must always be clickable, even when Face mode is OFF
    // or another autosave is still in flight. Keep the latest click and flush it next.
    const desired=Boolean(checkout.checked);
    state.peopleCore={...(state.peopleCore||{}),attendance_face:{...(state.peopleCore?.attendance_face||{}),verify_checkout:desired}};
    if(state.attendanceFaceSaving){
      state.attendanceFaceQueuedCheckout=desired;
      return;
    }
    saveAttendanceFaceSettings({silentSuccess:true,verifyCheckoutOverride:desired});
  };
  if(remind) remind.onclick=sendAttendanceFaceEnrollmentReminders;
  if(self) self.onclick=openAttendanceFaceSelfTest;
  if(copy) copy.onclick=copyAttendanceFaceInstructions;
}
async function ensureAttendanceFaceSettingsLoaded(){
  const current=state.peopleCore?.attendance_face||{};
  if(state.attendanceFaceLoaded||typeof current.mode==='string')return current;
  if(attendanceFaceSettingsFetchPromise)return attendanceFaceSettingsFetchPromise;
  attendanceFaceSettingsFetchPromise=(async()=>{
    try{
      const result=await api('/api/attendance-face-settings',{silentStatus:true,timeoutMs:12000});
      if(result?.settings){
        state.peopleCore={...(state.peopleCore||{}),attendance_face:result.settings};
        state.attendanceFaceLoaded=true;
      }
      return state.peopleCore?.attendance_face||{};
    }catch(error){
      const status=$('#attendanceFaceStatus');
      if(status)status.textContent=`โหลด Face Verification ไม่สำเร็จ · ${error.message||'กรุณาลองใหม่'}`;
      console.warn('[Nakna] attendance face settings fallback failed',error?.message||error);
      return state.peopleCore?.attendance_face||{};
    }finally{
      attendanceFaceSettingsFetchPromise=null;
      renderAttendanceFaceSettings();
    }
  })();
  return attendanceFaceSettingsFetchPromise;
}
function renderAttendanceSettingsControls({fetchFace=false}={}){
  ensureAttendanceFaceCard();
  bindAttendanceFaceControls();
  const core=state.peopleCore||{};
  const toggle=$('#attendancePolicyToggle');
  const outsideAllowed=Boolean(core.attendance_policy?.allow_attendance_outside_geofence ?? core.attendance_policy?.allow_checkout_outside_geofence);
  if(toggle&&!state.attendancePolicySaving)toggle.checked=outsideAllowed;
  updateAttendancePolicyStatus(outsideAllowed,state.attendancePolicySaving?'saving':'ready');
  renderAttendanceFaceSettings();
  renderAttendanceReminderSettings();
  if(fetchFace&&!state.attendanceFaceLoaded&&typeof core.attendance_face?.mode!=='string')ensureAttendanceFaceSettingsLoaded();
}

function attendanceFaceModeLabel(mode){
  if(mode==='required')return 'บังคับยืนยันก่อนเช็กอิน';
  if(mode==='enroll')return 'ช่วงลงทะเบียน · ยังไม่บังคับ';
  return 'ปิดใช้งาน';
}
function renderAttendanceFaceSettings(){
  ensureAttendanceFaceCard();
  const settings=state.peopleCore?.attendance_face||{};
  const loaded=Boolean(state.attendanceFaceLoaded || typeof settings.mode==='string');
  const mode=['off','enroll','required'].includes(String(settings.mode))?String(settings.mode):'off';
  const modeSelect=$('#attendanceFaceMode'),checkout=$('#attendanceFaceCheckoutToggle'),status=$('#attendanceFaceStatus'),autoNote=$('#attendanceFaceAutosaveNote');
  const remindBtn=$('#attendanceFaceRemindBtn'),selfBtn=$('#attendanceFaceSelfTestBtn'),copyBtn=$('#attendanceFaceCopyInstructionBtn'),rolloutStatus=$('#attendanceFaceRolloutStatus');
  if(!loaded){
    if(modeSelect)modeSelect.disabled=true;
    if(checkout)checkout.disabled=true;
    if($('#attendanceFaceReadyCount'))$('#attendanceFaceReadyCount').textContent='—';
    if($('#attendanceFacePendingCount'))$('#attendanceFacePendingCount').textContent='—';
    if($('#attendanceFacePendingPeople')){$('#attendanceFacePendingPeople').classList.add('hidden');$('#attendanceFacePendingPeople').innerHTML='';}
    if(status)status.textContent='กำลังโหลดการตั้งค่าจากบริษัท…';
    if(autoNote)autoNote.textContent='กำลังโหลดการตั้งค่า…';
    if(remindBtn)remindBtn.disabled=true;
    if(selfBtn)selfBtn.disabled=true;
    if(copyBtn)copyBtn.disabled=true;
    if(rolloutStatus)rolloutStatus.textContent='กำลังโหลดสถานะการลงทะเบียน…';
    return;
  }
  if(modeSelect&&!state.attendanceFaceSaving)modeSelect.value=mode;
  if(checkout&&!state.attendanceFaceSaving)checkout.checked=attendanceFaceBool(settings.verify_checkout);
  if(modeSelect)modeSelect.disabled=Boolean(state.attendanceFaceSaving);
  // P9.20: do not lock this preference just because Face mode is OFF or autosaving.
  // A disabled checkbox shows the browser's 🚫 cursor and made the control feel broken.
  if(checkout)checkout.disabled=false;
  const summary=settings.summary||{};const active=Number(summary.active||0),enrolled=Number(summary.enrolled||0),pending=Math.max(0,Number(summary.pending??active-enrolled));
  if($('#attendanceFaceReadyCount'))$('#attendanceFaceReadyCount').textContent=`${enrolled}/${active}`;
  if($('#attendanceFacePendingCount'))$('#attendanceFacePendingCount').textContent=String(pending);
  if(remindBtn){
    remindBtn.disabled=Boolean(state.attendanceFaceRolloutBusy)||mode==='off'||pending<=0||!settings.encryption_ready;
    remindBtn.textContent=state.attendanceFaceRolloutBusy?'กำลังส่ง LINE…':(pending>0?`ส่ง LINE ให้ ${pending} คนที่ยังไม่ลงทะเบียน`:'ทุกคนลงทะเบียนแล้ว');
  }
  if(selfBtn)selfBtn.disabled=Boolean(state.attendanceFaceRolloutBusy)||mode==='off'||!settings.encryption_ready;
  if(copyBtn)copyBtn.disabled=mode==='off';
  if(rolloutStatus){
    rolloutStatus.textContent=state.attendanceFaceRolloutStatus
      ||(mode==='off'?'เปิด Face Verification แล้วจึงส่งคำขอลงทะเบียนได้'
      :pending>0?`ยังเหลือ ${pending} คน · ส่ง LINE ได้แม้วันนี้พนักงานเช็กอินไปแล้ว`
      :'พนักงานที่ Active ลงทะเบียนครบแล้ว ✓');
    rolloutStatus.classList.toggle('is-success',pending===0&&mode!=='off');
  }
  const pendingRoot=$('#attendanceFacePendingPeople');
  if(pendingRoot){
    const people=Array.isArray(summary.pending_people)?summary.pending_people:[];
    pendingRoot.classList.toggle('hidden',!people.length||mode==='off');
    pendingRoot.innerHTML=people.length?`<span>ยังไม่ลงทะเบียน:</span>${people.slice(0,8).map(p=>`<b>${escapeHtml(p.nickname||p.first_name||p.employee_code||'พนักงาน')}</b>`).join('')}${pending>people.length?`<em>+${pending-people.length} คน</em>`:''}`:'';
  }
  if(status){
    if(state.attendanceFaceSaving)status.textContent='กำลังบันทึกการตั้งค่า…';
    else if(mode!=='off'&&!settings.encryption_ready)status.textContent='ยังไม่พร้อม · ต้องตั้งกุญแจเข้ารหัสข้อมูลชีวมิติ';
    else if(mode==='required')status.textContent=`เปิดใช้งาน · ${enrolled}/${active} คนลงทะเบียนแล้ว${attendanceFaceBool(settings.verify_checkout)?' · ตรวจทั้งเข้าและออก':' · ตรวจตอนเช็กอิน'}`;
    else if(mode==='enroll')status.textContent=`ช่วงลงทะเบียน · พนักงานยังเช็กอินได้ตามปกติ · พร้อมแล้ว ${enrolled}/${active} คน`;
    else status.textContent='ปิดใช้งาน · ระบบเช็กอินใช้ GPS ตามเดิม';
  }
  if(autoNote){
    if(state.attendanceFaceSaving)autoNote.textContent='กำลังบันทึก…';
    else if(state.attendanceFaceSavedAt)autoNote.textContent='บันทึกแล้ว ✓ · เปลี่ยนค่าเมื่อไหร่ระบบจะบันทึกอัตโนมัติ';
    else autoNote.textContent='เปลี่ยนค่าแล้วระบบจะบันทึกอัตโนมัติ';
  }
  updateAttendanceFaceModeHint();
}
function updateAttendanceFaceModeHint(){
  if(!state.attendanceFaceLoaded && typeof state.peopleCore?.attendance_face?.mode!=='string')return;
  const mode=String($('#attendanceFaceMode')?.value||'off');
  const checkout=$('#attendanceFaceCheckoutToggle');if(checkout)checkout.disabled=false;
  const status=$('#attendanceFaceStatus');if(!status||state.attendanceFaceSaving)return;
  if(mode==='required')status.textContent='กำลังเปิดโหมดบังคับ · คนที่ยังไม่มีใบหน้าจะลงทะเบียนก่อนเช็กอินครั้งถัดไป';
  else if(mode==='enroll')status.textContent='กำลังเปิดช่วงลงทะเบียน · พนักงานยังสามารถเช็กอินได้ตามปกติ';
  else status.textContent='กำลังปิด Face Verification · ใช้กฎ GPS/Work Location ตามเดิม';
}
async function saveAttendanceFaceSettings({silentSuccess=true,verifyCheckoutOverride=null}={}){
  const button=$('#attendanceFaceSaveBtn'),modeSelect=$('#attendanceFaceMode'),checkout=$('#attendanceFaceCheckoutToggle');
  if(!modeSelect||!checkout||state.attendanceFaceSaving)return;
  const previous={...(state.peopleCore?.attendance_face||{})};
  const desiredCheckout=verifyCheckoutOverride===null?Boolean(checkout.checked):Boolean(verifyCheckoutOverride);
  const draft={mode:String(modeSelect.value||'off'),verify_checkout:desiredCheckout};

  // Optimistic state: do this before any render so the switch can never snap back
  // to the stale value while autosave is running.
  state.peopleCore={...(state.peopleCore||{}),attendance_face:{...previous,...draft}};
  state.attendanceFaceSaving=true;
  if(button)setButtonBusy(button,true,'กำลังบันทึก…');
  renderAttendanceFaceSettings();
  try{
    const result=await api('/api/attendance-face-settings',{method:'PATCH',body:JSON.stringify(draft),silentStatus:true});
    const saved=result.settings||{...previous,...draft};
    saved.verify_checkout=attendanceFaceBool(saved.verify_checkout);
    state.peopleCore.attendance_face=saved;
    state.attendanceFaceLoaded=true;
    state.attendanceFaceSavedAt=Date.now();
    state.attendanceFaceRolloutStatus='';
    renderAttendanceFaceSettings();renderSettingsSidebar();
    if(!silentSuccess){
      const mode=state.peopleCore.attendance_face?.mode;
      toast(mode==='required'?'เปิดบังคับ Face Verification แล้ว':mode==='enroll'?'เปิดช่วงลงทะเบียนใบหน้าแล้ว':'ปิด Face Verification แล้ว');
    }
  }catch(error){
    state.peopleCore.attendance_face=previous;
    state.attendanceFaceLoaded=typeof previous.mode==='string';
    renderAttendanceFaceSettings();
    toast(error.message||'บันทึก Face Verification ไม่สำเร็จ',true);
  }finally{
    const queuedCheckout=typeof state.attendanceFaceQueuedCheckout==='boolean'
      ? state.attendanceFaceQueuedCheckout
      : null;
    state.attendanceFaceQueuedCheckout=null;
    state.attendanceFaceSaving=false;
    if(button)setButtonBusy(button,false);
    renderAttendanceFaceSettings();

    // If the user clicked again while the previous PATCH was saving, immediately persist
    // the last intent instead of ignoring the click or showing a disabled cursor.
    if(queuedCheckout!==null && queuedCheckout!==attendanceFaceBool(state.peopleCore?.attendance_face?.verify_checkout)){
      queueMicrotask(()=>saveAttendanceFaceSettings({silentSuccess:true,verifyCheckoutOverride:queuedCheckout}));
    }
  }
}

async function sendAttendanceFaceEnrollmentReminders(){
  if(state.attendanceFaceRolloutBusy)return;
  const settings=state.peopleCore?.attendance_face||{};
  const pending=Number(settings.summary?.pending||0);
  if(!pending)return toast('ทุกคนลงทะเบียนใบหน้าแล้ว');
  state.attendanceFaceRolloutBusy=true;
  state.attendanceFaceRolloutStatus=`กำลังส่ง LINE ให้ ${pending} คน…`;
  renderAttendanceFaceSettings();
  try{
    const result=await api('/api/attendance-face-enrollment/remind',{method:'POST',body:JSON.stringify({}),silentStatus:true});
    if(result.settings){
      state.peopleCore.attendance_face=result.settings;
      state.attendanceFaceLoaded=true;
    }
    const parts=[`ส่งแล้ว ${Number(result.sent||0)} คน`];
    if(Number(result.not_linked||0)>0)parts.push(`ยังไม่เชื่อม LINE ${Number(result.not_linked||0)} คน`);
    if(Number(result.failed||0)>0)parts.push(`ส่งไม่สำเร็จ ${Number(result.failed||0)} คน`);
    state.attendanceFaceRolloutStatus=parts.join(' · ');
    const noLine=Array.isArray(result.not_linked_people)?result.not_linked_people:[];
    if(noLine.length){
      const names=noLine.slice(0,5).map(x=>x.name).filter(Boolean).join(', ');
      toast(`ส่งคำขอลงทะเบียนแล้ว · คนที่ยังไม่เชื่อม LINE: ${names}${noLine.length>5?'…':''}`);
    }else toast(`ส่งคำขอลงทะเบียนใบหน้าแล้ว ${Number(result.sent||0)} คน`);
  }catch(error){
    state.attendanceFaceRolloutStatus=error.message||'ส่ง LINE ไม่สำเร็จ';
    toast(error.message||'ส่ง LINE ให้พนักงานไม่สำเร็จ',true);
  }finally{
    state.attendanceFaceRolloutBusy=false;
    renderAttendanceFaceSettings();
  }
}
async function openAttendanceFaceSelfTest(){
  if(state.attendanceFaceRolloutBusy)return;
  const sameWindow=isLineInAppBrowser() || window.matchMedia?.('(max-width: 820px)')?.matches;
  const preview=sameWindow?null:window.open('about:blank','_blank');
  state.attendanceFaceRolloutBusy=true;
  state.attendanceFaceRolloutStatus='กำลังเปิดกล้องสแกนใบหน้าของบัญชีคุณ…';
  renderAttendanceFaceSettings();
  try{
    const result=await api('/api/attendance-face-enrollment/self-link',{method:'POST',body:'{}',silentStatus:true});
    state.attendanceFaceRolloutStatus=result.enrolled
      ?`เปิดหน้าทดสอบของ ${result.employee?.name||'บัญชีคุณ'} แล้ว`
      :`เปิดหน้าลงทะเบียนของ ${result.employee?.name||'บัญชีคุณ'} แล้ว`;
    if(sameWindow){
      location.assign(result.url);
    }else if(preview){
      preview.location.href=result.url;
      try{preview.focus();}catch{}
    }else{
      location.assign(result.url);
    }
  }catch(error){
    try{preview?.close();}catch{}
    state.attendanceFaceRolloutStatus=error.message||'เปิดหน้าทดสอบไม่สำเร็จ';
    toast(error.message||'เปิดหน้าลงทะเบียน/ทดสอบไม่สำเร็จ',true);
  }finally{
    state.attendanceFaceRolloutBusy=false;
    renderAttendanceFaceSettings();
  }
}
async function copyAttendanceFaceInstructions(){
  const company=activeCompany()?.name||'บริษัท';
  const text=`${company} เปิดใช้งาน Face Verification แล้ว\nกรุณาเปิด LINE นากนะ → เมนูพนักงาน → “ใบหน้า & การยืนยันตัวตน” แล้วลงทะเบียนใบหน้าให้เรียบร้อย\nระบบไม่เก็บรูปภาพจากการเช็กอินประจำวัน`;
  try{
    await navigator.clipboard.writeText(text);
    state.attendanceFaceRolloutStatus='คัดลอกข้อความแจ้งทีมแล้ว ✓';
    toast('คัดลอกข้อความแจ้งทีมแล้ว');
  }catch{
    const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();
    try{document.execCommand('copy');toast('คัดลอกข้อความแจ้งทีมแล้ว');state.attendanceFaceRolloutStatus='คัดลอกข้อความแจ้งทีมแล้ว ✓';}
    catch{toast('คัดลอกไม่ได้ กรุณาลองใหม่',true);}
    area.remove();
  }
  renderAttendanceFaceSettings();
}

async function loadPeopleFaceProfile(employeeId){
  const status=$('#peopleFaceProfileStatus'),meta=$('#peopleFaceProfileMeta'),reset=$('#peopleFaceResetBtn');
  if(status)status.textContent='กำลังตรวจสอบ…';if(meta)meta.textContent='ระบบไม่เก็บรูปเช็กอินประจำวัน';if(reset)reset.classList.add('hidden');
  try{
    const result=await api(`/api/employees/${Number(employeeId)}/face-profile`,{silentStatus:true});const profile=result.profile||{};
    if(profile.enrolled){
      if(status)status.textContent='ลงทะเบียนใบหน้าแล้ว';
      if(meta)meta.textContent=`พร้อมใช้งาน · ลงทะเบียน ${profile.enrolled_at?formatDate(profile.enrolled_at.slice(0,10)):'แล้ว'} · ไม่เก็บรูปประจำวัน`;
      if(reset)reset.classList.remove('hidden');
    }else{
      if(status)status.textContent=profile.status==='reset'?'ต้องลงทะเบียนใหม่':'ยังไม่ลงทะเบียนใบหน้า';
      if(meta)meta.textContent='เมื่อบริษัทเปิดโหมดบังคับ พนักงานจะถูกพาไปลงทะเบียนก่อนเช็กอิน';
    }
  }catch(error){if(status)status.textContent='ตรวจสถานะไม่ได้';if(meta)meta.textContent=error.message||'กรุณาลองใหม่';}
}
async function resetPeopleFaceProfile(){
  const id=Number($('#peopleProfileEmployeeId')?.value||0);if(!id)return;
  const employee=state.employees.find(e=>Number(e.id)===id);const name=employee?.nickname||employee?.first_name||'พนักงาน';
  if(!confirm(`รีเซ็ตใบหน้าของ ${name} ใช่ไหม?\n\nหลังรีเซ็ต พนักงานต้องลงทะเบียนใบหน้าใหม่ก่อนเช็กอิน หากบริษัทเปิดโหมดบังคับ`))return;
  const button=$('#peopleFaceResetBtn');setButtonBusy(button,true,'กำลังรีเซ็ต…');
  try{await api(`/api/employees/${id}/face-profile`,{method:'DELETE',silentStatus:true});await loadPeopleFaceProfile(id);viewLoadedAt.delete('settings');toast(`รีเซ็ตใบหน้าของ ${name} แล้ว`);}
  catch(error){toast(error.message||'รีเซ็ตใบหน้าไม่สำเร็จ',true);}finally{setButtonBusy(button,false);}
}

function updateAttendancePolicyStatus(allowed,stateName='ready'){
  const status=$('#attendancePolicyStatus'); if(!status)return;
  status.classList.toggle('saving',stateName==='saving');
  status.classList.toggle('saved',stateName==='saved');
  status.textContent=stateName==='saving'?'กำลังบันทึกการตั้งค่า…':stateName==='saved'?'บันทึกแล้ว':allowed?'เปิดใช้งาน · พนักงานลงเวลานอกพื้นที่ได้':'ปิดใช้งาน · ต้องอยู่ใน Work Location';
}
async function saveAttendancePolicy(){
  const toggle=$('#attendancePolicyToggle'); if(!toggle)return;
  const current=Boolean(state.peopleCore?.attendance_policy?.allow_attendance_outside_geofence ?? state.peopleCore?.attendance_policy?.allow_checkout_outside_geofence);
  const desired=Boolean(toggle.checked);
  state.attendancePolicySaving=true; toggle.disabled=true;
  state.peopleCore.attendance_policy={...(state.peopleCore?.attendance_policy||{}),allow_attendance_outside_geofence:desired,allow_checkout_outside_geofence:desired};
  updateAttendancePolicyStatus(desired,'saving');
  try{
    const result=await api('/api/attendance-policy',{method:'PATCH',body:JSON.stringify({allow_attendance_outside_geofence:desired,allow_checkout_outside_geofence:desired})});
    const persisted=Boolean(result.allow_attendance_outside_geofence ?? result.allow_checkout_outside_geofence);
    if(persisted!==desired) throw new Error('ระบบยืนยันการตั้งค่าไม่ตรง กรุณาลองใหม่');
    state.peopleCore.attendance_policy={...(state.peopleCore?.attendance_policy||{}),allow_attendance_outside_geofence:persisted,allow_checkout_outside_geofence:persisted};
    if(state.companyProfile){state.companyProfile.allow_attendance_outside_geofence=persisted;state.companyProfile.allow_checkout_outside_geofence=persisted;}
    toggle.checked=persisted; state.attendancePolicySavedAt=Date.now(); updateAttendancePolicyStatus(persisted,'saved');
    setTimeout(()=>updateAttendancePolicyStatus(persisted,'ready'),900);
    toast(persisted?'อนุญาตเช็กอินและเช็กเอาต์นอกพื้นที่แล้ว':'บังคับให้ลงเวลาใน Work Location แล้ว');
  }catch(e){
    state.peopleCore.attendance_policy={...(state.peopleCore?.attendance_policy||{}),allow_attendance_outside_geofence:current,allow_checkout_outside_geofence:current};
    toggle.checked=current; updateAttendancePolicyStatus(current,'ready'); toast(e.message,true);
  }finally{state.attendancePolicySaving=false;toggle.disabled=false;}
}

function openWorkLocationModal() {
  state.editingWorkLocationId=0;
  $('#locationForm').reset();
  $('#locationRadius').value = '150';
  if($('#locationModalTitle'))$('#locationModalTitle').textContent='เพิ่มจุดเช็กอิน';
  if($('#locationModalSubtitle'))$('#locationModalSubtitle').textContent='กำหนดพิกัดกลางและรัศมีที่อนุญาต ทุก Work Location ที่เปิดใช้งานจะถูกนำมาตรวจ GPS อัตโนมัติ';
  if($('#locationSaveBtn'))$('#locationSaveBtn').textContent='บันทึก Location';
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
  const editingId=Number(state.editingWorkLocationId||0);
  button.disabled = true;
  try {
    const payload={ name, address: $('#locationAddress').value.trim(), latitude, longitude, radius_m };
    await api(editingId?`/api/work-locations/${editingId}`:'/api/work-locations', { method: editingId?'PATCH':'POST', body: JSON.stringify(payload) });
    state.editingWorkLocationId=0;
    $('#locationModal').close();
    await loadAll({ silent: true });
    toast(editingId?'แก้ไข Work Location แล้ว · ใช้พิกัดใหม่ทันที':'เพิ่ม Work Location แล้ว · พนักงานใช้จุดนี้เช็กอินได้ทันที');
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
}

window.openEmployeeModal = openEmployeeModal;
function openEmployeeModal() {
  openModal('EMPLOYEE', 'เพิ่มพนักงานใหม่', 'กรอกข้อมูลพื้นฐาน แล้วเลือกแผนกและตำแหน่งกลางของบริษัทได้ทันที', [
    ['employee_code', 'รหัสพนักงาน (ไม่กรอก = สร้างอัตโนมัติ)', 'text'],
    ['nickname', 'ชื่อเล่น', 'text'],
    ['first_name', 'ชื่อ', 'text', true],
    ['last_name', 'นามสกุล', 'text', true],
    ['department_id', 'แผนก', 'select'],
    ['position_id', 'ตำแหน่ง', 'select'],
    ['email', 'อีเมล', 'email'],
    ['phone', 'เบอร์โทร', 'text'],
    ['birth_date', 'วันเกิด', 'date'],
    ['national_id', 'เลขบัตรประชาชน', 'text'],
    ['bank_name', 'ธนาคาร', 'text'],
    ['bank_account_name', 'ชื่อบัญชี', 'text'],
    ['bank_account_no', 'เลขบัญชีธนาคาร', 'text'],
    ['base_salary', 'เงินเดือนฐาน', 'number'],
    ['start_date', 'วันเริ่มงาน', 'date', true],
    ['probation_end_date', 'วันครบ Probation', 'date'],
    ['contract_type', 'ประเภทสัญญา', 'select'],
    ['contract_number', 'เลขที่สัญญา', 'text'],
    ['contract_start_date', 'วันเริ่มสัญญา', 'date'],
    ['contract_signed_date', 'วันที่เซ็นสัญญา', 'date'],
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
  const contractType = $('#field-contract_type');
  if (contractType) contractType.innerHTML = `<option value="">ยังไม่ระบุ</option><option value="permanent">พนักงานประจำ</option><option value="fixed_term">สัญญามีกำหนด</option><option value="probation">ทดลองงาน</option><option value="part_time">พาร์ทไทม์</option><option value="intern">ฝึกงาน</option><option value="freelance">ฟรีแลนซ์</option><option value="consultant">ที่ปรึกษา</option>`;
  const departments = state.peopleCore?.departments || state.lookups?.departments || [];
  const positions = state.peopleCore?.positions || state.lookups?.positions || [];
  if (department) {
    department.innerHTML = `<option value="">ยังไม่ระบุแผนก</option>${departments.map(d=>`<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('')}`;
  }
  const renderPositionOptions = () => {
    if (!position) return;
    position.innerHTML = `<option value="">ยังไม่ระบุตำแหน่ง</option>${[...positions].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'th')).map(x=>`<option value="${x.id}">${escapeHtml(x.name)}</option>`).join('')}`;
  };
  renderPositionOptions();
  const contractStart = $('#field-contract_start_date');
  if (contractStart && !contractStart.value) contractStart.value = start?.value || localDateKey(new Date());
  if (!departments.length) {
    const hint = document.createElement('div');
    hint.className = 'modal-inline-hint full';
    hint.innerHTML = `<strong>ยังไม่มีแผนก</strong><span>เพิ่มแผนกจากหน้า ทีมและตำแหน่ง หรือเพิ่มพนักงานโดยไม่ระบุก่อนได้</span>`;
    $('#modalFields')?.prepend(hint);
  }
}

window.openEmployeeEdit = id => {
  const employee = state.employees.find(item => Number(item.id) === Number(id));
  if (!employee) return toast('ไม่พบข้อมูลพนักงาน', true);
  openModal('EMPLOYEE', `แก้ไข ${employee.nickname || employee.first_name}`, 'แก้ข้อมูลพื้นฐาน แผนก และตำแหน่งของพนักงาน แล้วกดบันทึก', [
    ['employee_code', 'รหัสพนักงาน', 'text', true],
    ['nickname', 'ชื่อเล่น', 'text'],
    ['first_name', 'ชื่อ', 'text', true],
    ['last_name', 'นามสกุล', 'text', true],
    ['department_id', 'แผนก', 'select'],
    ['position_id', 'ตำแหน่ง', 'select'],
    ['email', 'อีเมล', 'email'],
    ['phone', 'เบอร์โทร', 'text'],
    ['birth_date', 'วันเกิด', 'date'],
    ['national_id', 'เลขบัตรประชาชน', 'text'],
    ['bank_name', 'ธนาคาร', 'text'],
    ['bank_account_name', 'ชื่อบัญชี', 'text'],
    ['bank_account_no', 'เลขบัญชีธนาคาร', 'text'],
    ['base_salary', 'เงินเดือนฐาน', 'number'],
    ['start_date', 'วันเริ่มงาน', 'date', true],
    ['probation_end_date', 'วันครบ Probation', 'date'],
    ['contract_type', 'ประเภทสัญญา', 'select'],
    ['contract_number', 'เลขที่สัญญา', 'text'],
    ['contract_start_date', 'วันเริ่มสัญญา', 'date'],
    ['contract_signed_date', 'วันที่เซ็นสัญญา', 'date'],
    ['contract_end_date', 'วันสิ้นสุดสัญญา', 'date'],
  ], async data => {
    data.department_id = data.department_id || null;
    data.position_id = data.position_id || null;
    await api(`/api/employees/${employee.id}`, { method: 'PATCH', body: JSON.stringify(data) });
    await loadAll({ silent: true });
    toast('แก้ไขข้อมูลพนักงานแล้ว');
  });

  const departments = state.peopleCore?.departments || state.lookups?.departments || [];
  const positions = state.peopleCore?.positions || state.lookups?.positions || [];
  const department = $('#field-department_id');
  const position = $('#field-position_id');
  const contractType = $('#field-contract_type');
  if (contractType) contractType.innerHTML = `<option value="">ยังไม่ระบุ</option><option value="permanent">พนักงานประจำ</option><option value="fixed_term">สัญญามีกำหนด</option><option value="probation">ทดลองงาน</option><option value="part_time">พาร์ทไทม์</option><option value="intern">ฝึกงาน</option><option value="freelance">ฟรีแลนซ์</option><option value="consultant">ที่ปรึกษา</option>`;
  if (department) department.innerHTML = `<option value="">ยังไม่ระบุแผนก</option>${departments.map(d=>`<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('')}`;
  const renderPositionOptions = (selectedPositionId = null) => {
    if (!position) return;
    position.innerHTML = `<option value="">ยังไม่ระบุตำแหน่ง</option>${[...positions].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'th')).map(x=>`<option value="${x.id}">${escapeHtml(x.name)}</option>`).join('')}`;
    if (selectedPositionId) position.value = String(selectedPositionId);
  };
  if (department) department.value = employee.department_id ? String(employee.department_id) : '';
  renderPositionOptions(employee.position_id);
  const values = {
    employee_code: employee.employee_code,
    nickname: employee.nickname,
    first_name: employee.first_name,
    last_name: employee.last_name,
    email: employee.email,
    phone: employee.phone,
    birth_date: employee.birth_date,
    national_id: employee.national_id,
    bank_name: employee.bank_name,
    bank_account_name: employee.bank_account_name,
    bank_account_no: employee.bank_account_no,
    base_salary: employee.base_salary,
    start_date: employee.start_date,
    probation_end_date: employee.probation_end_date,
    contract_type: employee.contract_type,
    contract_number: employee.contract_number,
    contract_start_date: employee.contract_start_date,
    contract_signed_date: employee.contract_signed_date,
    contract_end_date: employee.contract_end_date,
  };
  Object.entries(values).forEach(([key,value]) => { const field = $(`#field-${key}`); if (field) field.value = value || ''; });
  $('#modalSave').textContent = 'บันทึกการแก้ไข';
};


function ensureEmployeeDocumentsDialog(){
  let dialog = $('#employeeDocumentsModal');
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.id = 'employeeDocumentsModal';
  dialog.className = 'modal employee-documents-modal';
  dialog.innerHTML = `<div class="modal-box employee-documents-box">
    <div class="modal-head"><div><p class="kicker">EMPLOYEE FILES</p><h3 id="employeeDocumentsTitle">เอกสารพนักงาน</h3><p>สัญญาจ้าง บัตรประชาชน สมุดบัญชี ประกันสังคม และเอกสารประกอบ Payroll</p></div><button type="button" class="icon-btn" data-close-employee-docs>×</button></div>
    <input type="hidden" id="employeeDocumentsEmployeeId" />
    <div class="employee-doc-upload-grid">
      <label><span>ประเภทเอกสาร</span><select id="employeeDocumentType"><optgroup label="การจ้างงาน"><option value="employment_contract">สัญญาจ้างงาน</option><option value="job_description">Job Description</option><option value="nda">ข้อตกลงรักษาความลับ</option><option value="probation">เอกสารทดลองงาน</option><option value="salary_adjustment">เอกสารปรับเงินเดือน</option></optgroup><optgroup label="ข้อมูลส่วนตัว"><option value="id_card_copy">สำเนาบัตรประชาชน</option><option value="house_registration">สำเนาทะเบียนบ้าน</option><option value="bank_book_copy">หน้าสมุดบัญชี</option><option value="education_certificate">วุฒิการศึกษา</option></optgroup><optgroup label="Payroll / ภาษี"><option value="social_security">เอกสารประกันสังคม</option><option value="tax_document">เอกสารภาษี</option><option value="salary_certificate">หนังสือรับรองเงินเดือน</option></optgroup><optgroup label="HR / สิ้นสุดการจ้าง"><option value="performance">เอกสารประเมินผลงาน</option><option value="warning">หนังสือเตือน</option><option value="resignation">เอกสารลาออก</option><option value="asset_return">เอกสารคืนทรัพย์สิน</option><option value="final_pay">Final Pay</option><option value="employment_certificate">หนังสือรับรองการทำงาน</option><option value="other">เอกสารอื่น</option></optgroup></select></label>
      <label><span>วันที่เอกสาร</span><input id="employeeDocumentDate" type="date" /></label>
      <label><span>วันหมดอายุ (ถ้ามี)</span><input id="employeeDocumentExpires" type="date" /></label>
      <label><span>การมองเห็น</span><select id="employeeDocumentVisibility"><option value="hr_only">HR เท่านั้น</option><option value="employee">พนักงานเห็นได้</option><option value="manager">ผู้จัดการเห็นได้</option></select></label>
      <label><span>ระดับความลับ</span><select id="employeeDocumentConfidentiality"><option value="confidential">Confidential</option><option value="internal">Internal</option><option value="restricted">Restricted</option></select></label>
      <label class="employee-doc-file-field"><span>ไฟล์</span><input id="employeeDocumentFile" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" /></label>
    </div>
    <div class="employee-doc-upload-actions"><small>PDF / รูป / Word · สูงสุด 10 MB · เก็บใน Google Drive ของบริษัท</small><button id="employeeDocumentUploadBtn" class="btn primary" type="button">อัปโหลดไฟล์</button></div>
    <div id="employeeDocumentsList" class="employee-documents-list"></div>
  </div>`;
  document.body.appendChild(dialog);
  dialog.querySelector('[data-close-employee-docs]').onclick = () => dialog.close();
  $('#employeeDocumentUploadBtn').onclick = uploadEmployeeDocument;
  return dialog;
}

const employeeDocumentTypeLabel = type => ({employment_contract:'สัญญาจ้างงาน',job_description:'Job Description',nda:'ข้อตกลงรักษาความลับ',id_card_copy:'สำเนาบัตรประชาชน',house_registration:'สำเนาทะเบียนบ้าน',bank_book_copy:'หน้าสมุดบัญชี',social_security:'เอกสารประกันสังคม',tax_document:'เอกสารภาษี',education_certificate:'วุฒิการศึกษา',salary_certificate:'หนังสือรับรองเงินเดือน',employment_certificate:'หนังสือรับรองการทำงาน',probation:'เอกสารทดลองงาน',salary_adjustment:'เอกสารปรับเงินเดือน',performance:'เอกสารประเมินผลงาน',warning:'หนังสือเตือน',resignation:'เอกสารลาออก',asset_return:'เอกสารคืนทรัพย์สิน',final_pay:'Final Pay',other:'เอกสารอื่น'})[type] || 'เอกสาร';

async function loadEmployeeDocuments(employeeId){
  const result = await api(`/api/employees/${employeeId}/documents`);
  const list = $('#employeeDocumentsList');
  const docs = result.data || [];
  list.innerHTML = docs.length ? docs.map(doc => `<div class="employee-document-row ${doc.status==='archived'?'is-archived':''}">
    <div class="employee-document-icon">${iconSvg('document')}</div>
    <div class="employee-document-copy"><strong>${escapeHtml(doc.title || employeeDocumentTypeLabel(doc.document_type))} <span class="doc-version">v${Number(doc.version||1)}</span></strong><span>${escapeHtml(employeeDocumentTypeLabel(doc.document_type))} · ${doc.document_date ? formatDate(doc.document_date) : formatDate(String(doc.created_at||'').slice(0,10))}${doc.expires_at ? ` · หมดอายุ ${formatDate(doc.expires_at)}` : ''}</span><small>${escapeHtml(doc.file_name || '')} · ${escapeHtml(doc.confidentiality||'internal')} ${doc.status==='archived'?'· เก็บถาวร':''}</small></div>
    <div class="employee-document-actions">${doc.drive_url ? `<a class="text-btn" href="${escapeHtml(doc.drive_url)}" target="_blank" rel="noopener">เปิดไฟล์</a>` : ''}<button type="button" class="text-btn" onclick="window.openEmployeeDocumentHistory(${Number(doc.id)})">ประวัติ</button>${doc.status!=='archived'?`<button type="button" class="text-btn danger-text" onclick="window.deleteEmployeeDocument(${Number(doc.id)},${Number(employeeId)})">เก็บถาวร</button>`:''}</div>
  </div>`).join('') : emptyState('ยังไม่มีเอกสาร', 'อัปโหลดสัญญาจ้าง สำเนาบัตรประชาชน หน้าสมุดบัญชี หรือเอกสาร Payroll ได้จากด้านบน');
  return result;
}

window.openEmployeeDocuments = async id => {
  const employee = state.employees.find(item => Number(item.id) === Number(id));
  if (!employee) return toast('ไม่พบข้อมูลพนักงาน', true);
  const dialog = ensureEmployeeDocumentsDialog();
  $('#employeeDocumentsEmployeeId').value = String(id);
  $('#employeeDocumentsTitle').textContent = `เอกสาร · ${employee.nickname || employee.first_name}`;
  $('#employeeDocumentDate').value = localDateKey(new Date());
  $('#employeeDocumentExpires').value = '';
  $('#employeeDocumentFile').value = '';
  $('#employeeDocumentsList').innerHTML = `<div class="employee-doc-loading">กำลังโหลดเอกสาร…</div>`;
  dialog.showModal();
  try { await loadEmployeeDocuments(id); } catch (error) { $('#employeeDocumentsList').innerHTML = emptyState('โหลดเอกสารไม่สำเร็จ', error.message); }
};

async function uploadEmployeeDocument(){
  const employeeId = Number($('#employeeDocumentsEmployeeId').value || 0);
  const file = $('#employeeDocumentFile').files?.[0];
  if (!employeeId || !file) return toast('กรุณาเลือกไฟล์ก่อน', true);
  if (file.size > 10 * 1024 * 1024) return toast('ไฟล์ต้องไม่เกิน 10 MB', true);
  const button = $('#employeeDocumentUploadBtn');
  button.disabled = true; button.textContent = 'กำลังอัปโหลด…';
  const tracked = beginMutationStatus(`/api/employees/${employeeId}/documents`,'POST',false);
  try {
    const form = new FormData();
    form.append('file',file); form.append('document_type',$('#employeeDocumentType').value); form.append('document_date',$('#employeeDocumentDate').value); form.append('expires_at',$('#employeeDocumentExpires').value); form.append('visibility',$('#employeeDocumentVisibility').value); form.append('confidentiality',$('#employeeDocumentConfidentiality').value);
    const res = await fetch(`/api/employees/${employeeId}/documents`,{method:'POST',credentials:'same-origin',body:form});
    let data={}; try{data=await res.json();}catch{}
    if (!res.ok) throw new Error(data.error || `HTTP_${res.status}`);
    endMutationStatus(tracked,true);
    $('#employeeDocumentFile').value='';
    await loadEmployeeDocuments(employeeId);
    await loadAll({silent:true});
    toast('อัปโหลดเอกสารแล้ว');
  } catch(error) { endMutationStatus(tracked,false); toast(error.message || 'อัปโหลดเอกสารไม่สำเร็จ',true); }
  finally { button.disabled=false; button.textContent='อัปโหลดไฟล์'; }
}

window.openEmployeeDocumentHistory = async documentId => {
  try {
    const result=await api(`/api/employee-documents/${documentId}/events`);
    const events=result.data||[];
    const lines=events.length?events.map(e=>`${formatDateTime(e.created_at)} — ${e.event_type==='uploaded'?'อัปโหลดเอกสาร':e.event_type==='archived'?'เก็บเข้าคลังถาวร':e.event_type}${e.actor_email?` · ${e.actor_email}`:''}`).join('\n'):'ยังไม่มีประวัติ';
    window.alert(`ประวัติ · ${result.document?.title||'เอกสาร'}\nVersion ${result.document?.version||1} · ${result.document?.status||'active'}\n\n${lines}`);
  } catch(error){ toast(error.message||'โหลดประวัติเอกสารไม่สำเร็จ',true); }
};

window.deleteEmployeeDocument = async (documentId,employeeId) => {
  if (!window.confirm('เก็บเอกสารนี้เข้าคลังถาวร?\nประวัติและไฟล์ต้นฉบับจะยังคงอยู่เพื่อการตรวจสอบย้อนหลัง')) return;
  try { await api(`/api/employee-documents/${documentId}`,{method:'DELETE',body:'{}'}); await loadEmployeeDocuments(employeeId); await loadAll({silent:true}); toast('เก็บเอกสารเข้าคลังถาวรแล้ว'); }
  catch(error){ toast(error.message || 'ลบเอกสารไม่สำเร็จ',true); }
};

window.deleteEmployee = async id => {
  const employee = state.employees.find(item => Number(item.id) === Number(id));
  if (!employee) return toast('ไม่พบข้อมูลพนักงาน', true);
  const name = `${employee.nickname || employee.first_name} ${employee.last_name || ''}`.trim();
  const confirmed = window.confirm(`ลบ ${name} ออกจากบริษัท?\n\nข้อมูลที่ผูกกับพนักงานคนนี้ เช่น เวลาเข้างาน คำขอลา และข้อมูล HR ที่อ้างอิงพนักงาน อาจถูกลบตามด้วย`);
  if (!confirmed) return;
  const typed = window.prompt(`เพื่อยืนยันการลบ กรุณาพิมพ์คำว่า ลบ`);
  if (typed !== 'ลบ') return toast('ยกเลิกการลบแล้ว');
  try {
    await api(`/api/employees/${employee.id}`, { method: 'DELETE', body: '{}' });
    await loadAll({ silent: true });
    toast(`ลบ ${name} แล้ว`);
  } catch (error) {
    toast(error.message || 'ลบพนักงานไม่สำเร็จ', true);
  }
};

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
  const currentYear = Number(localDateKey(new Date()).slice(0,4));
  const year = keepOpen ? Number($('#leaveProfileYear')?.value || currentYear) : currentYear;
  try {
    const result = await api(`/api/employees/${employeeId}/leave-profile?year=${year}`);
    const employee = result.employee;
    $('#leaveProfileTitle').textContent = `สิทธิ์ลา · ${employee.nickname || employee.first_name}`;
    $('#leaveProfileSubtitle').textContent = `${employee.employee_code} · กำหนดผู้อนุมัติและสิทธิ์รายคน`;
    const years=[year-1,year,year+1];
    $('#leaveProfileYear').innerHTML=years.map(y=>`<option value="${y}" ${y===result.year?'selected':''}>${y+543}</option>`).join('');
    const leaveApproverIds=new Set((state.approverAccess||[]).filter(item=>(item.permissions||[]).includes('leave.approve')).map(item=>Number(item.id)));
    $('#leaveApproverSelect').innerHTML = `<option value="">ส่งตรง HR / Owner</option>${state.employees.filter(e=>Number(e.id)!==Number(employeeId) && (leaveApproverIds.has(Number(e.id)) || Number(e.id)===Number(employee.leave_approver_employee_id))).map(e=>`<option value="${e.id}" ${Number(e.id)===Number(employee.leave_approver_employee_id)?'selected':''}>${escapeHtml(e.nickname || e.first_name)}${e.department_name?` · ${escapeHtml(e.department_name)}`:''}${e.line_user_id?' · LINE✓':''} · ผู้อนุมัติ✓</option>`).join('')}`;
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
    const result=await api(`/api/employees/${employeeId}/leave-profile`,{method:'PUT',body:JSON.stringify({year:Number($('#leaveProfileYear').value),leave_approver_employee_id:$('#leaveApproverSelect').value||null,leave_access_override:leaveAccessRaw===''?null:Number(leaveAccessRaw),entitlements})});
    const employee=state.employees.find(e=>Number(e.id)===Number(employeeId));
    if(employee && result.profile?.employee){employee.leave_access_override=result.profile.employee.leave_access_override;employee.leave_approver_employee_id=result.profile.employee.leave_approver_employee_id;}
    $('#leaveProfileModal').close(); await loadAll({silent:true});
    toast(result.auto_unlocked?'บันทึกสิทธิ์ลาแล้ว · เปิดสิทธิ์รายคนให้อัตโนมัติ':'บันทึกสิทธิ์ลาแล้ว');
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
  renderAttendanceSettingsControls({fetchFace:true});
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

async function loadCompanyAccess({ silent = true } = {}) {
  if (!['owner','co_owner'].includes(String(activeCompanyRole()||''))) {
    state.companyAccess = { members: [], eligible_employees: [], current_user_id: null };
    renderCompanyAccess();
    return;
  }
  try {
    state.companyAccess = await api('/api/company-access');
    renderCompanyAccess();
    renderSettingsSidebar();
  } catch (error) {
    if (!silent) toast(error.message, true);
  }
}

function renderCompanyAccess() {
  const section = $('#companyAccessSection');
  if (!section) return;
  const canManageAccess = ['owner','co_owner'].includes(String(activeCompanyRole()||''));
  section.classList.toggle('hidden', !canManageAccess);
  if (!canManageAccess) return;
  const data = state.companyAccess || { members: [], eligible_employees: [] };
  const members = data.members || [];
  if ($('#companyAccessCount')) $('#companyAccessCount').textContent = `${members.length} คน`;
  const root = $('#companyAccessList');
  if (!root) return;
  root.innerHTML = members.length ? members.map(member => {
    const role = String(member.role || '');
    const provider = String(member.auth_provider || '').includes('line') && String(member.auth_provider || '').includes('google') ? 'Google + LINE' : String(member.auth_provider || '').includes('line') ? 'LINE' : 'Google';
    return `<article class="company-access-card">
      <div class="company-access-avatar">${member.picture_url ? `<img src="${escapeHtml(member.picture_url)}" alt="" />` : escapeHtml(String(member.name || member.email || '?').trim().charAt(0).toUpperCase())}</div>
      <div class="company-access-copy"><strong>${escapeHtml(member.name || member.email || 'บัญชีนากนะ')}</strong><p>${escapeHtml(member.email || provider)} · ${provider}</p></div>
      <span class="badge ${member.is_primary_owner ? 'badge-success' : role === 'co_owner' ? 'badge-soft' : 'badge-neutral'}">${escapeHtml(roleLabel(role))}</span>
      ${member.is_primary_owner ? '<span class="company-access-self">เจ้าของหลัก</span>' : member.is_me ? '<span class="company-access-self">บัญชีคุณ</span>' : `<button class="text-btn danger-text" type="button" onclick="window.revokeCompanyAccess(${Number(member.user_id)},'${escapeHtml(member.name || member.email || '')}')">ถอนสิทธิ์</button>`}
    </article>`;
  }).join('') : emptyState('ยังไม่มีผู้ดูแลเพิ่มเติม', 'เพิ่ม Co-Owner, HR Admin, Payroll Admin, Manager หรือ Approver ให้เหมาะกับงาน');
}

function renderCompanyAccessRoleHint(){
  const role=$('#companyAccessRoleSelect')?.value||'co_owner';
  const catalog=state.companyAccess?.role_catalog||[];
  const item=catalog.find(row=>row.value===role);
  const hint=$('#companyAccessRoleHint');
  if(hint) hint.textContent=item?.description||({
    co_owner:'ดูแลได้เกือบทั้งหมด แต่ Billing / ลบบริษัท / โอนเจ้าของหลักยังเป็นของ Primary Owner',
    hr_admin:'จัดการพนักงาน เวลา ลา Recruitment เอกสาร Learning และงาน HR',
    payroll_admin:'เข้าถึง Payroll ภาษี SSO Payslip และเอกสารเงินเดือน',
    manager:'ดูแลทีม เวลา KPI และคำขอของทีมตามขอบเขตที่ได้รับ',
    approver:'อนุมัติคำขอที่ได้รับมอบหมาย โดยไม่แก้การตั้งค่าบริษัท'
  }[role]||'เลือกสิทธิ์ตามหน้าที่จริง');
}

async function openCompanyAccessModal() {
  // Always refresh Workspace access data before opening the modal.
  // Employee list can change after the page first loads, so stale state must never drive this selector.
  try {
    state.companyAccess = await api(`/api/company-access?ts=${Date.now()}`);
    renderCompanyAccess();
  } catch (error) {
    return toast(error.message || 'โหลดรายชื่อพนักงานไม่สำเร็จ', true);
  }
  const data = state.companyAccess || { members: [], eligible_employees: [] };
  const employees = data.eligible_employees || [];
  const select = $('#companyAccessEmployeeSelect');
  if (!select) return;
  select.innerHTML = employees.length ? employees.map(employee => {
    const name = employee.nickname || `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || employee.employee_code;
    const status = employee.current_role ? ` · ${roleLabel(employee.current_role)} แล้ว` : employee.linked ? (employee.account_backfill_needed ? ' · LINE เชื่อมแล้ว' : '') : ' · ยังไม่เชื่อมบัญชี';
    return `<option value="${Number(employee.id)}" ${employee.linked ? '' : 'disabled'}>${escapeHtml(name)}${escapeHtml(status)}</option>`;
  }).join('') : '<option value="">ยังไม่มีพนักงาน</option>';
  const firstLinked = employees.find(item => item.linked && !item.current_role) || employees.find(item => item.linked);
  if (firstLinked) select.value = String(firstLinked.id);
  const roleSelect=$('#companyAccessRoleSelect');
  const catalog=data.role_catalog||[];
  if(roleSelect&&catalog.length) roleSelect.innerHTML=catalog.map(item=>`<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`).join('');
  if(roleSelect) roleSelect.value = 'co_owner';
  $('#companyAccessEmployeeHint').textContent = employees.some(item => !item.linked) ? 'พนักงานที่เชื่อม LINE แล้วเพิ่มสิทธิ์ได้ทันที ส่วนคนที่เป็นสีเทายังต้องเชื่อม LINE หรือ Google ก่อน' : 'เลือกคนที่ต้องการให้ช่วยดูแล Workspace · บัญชี LINE เก่าจะถูกผูกเป็นบัญชีนากนะให้อัตโนมัติ';
  renderCompanyAccessRoleHint();
  $('#companyAccessModal').showModal();
}

async function saveCompanyAccess() {
  const employeeId = Number($('#companyAccessEmployeeSelect').value || 0);
  const role = $('#companyAccessRoleSelect').value;
  if (!employeeId) return toast('กรุณาเลือกพนักงาน', true);
  const button = $('#companyAccessSaveBtn');
  button.disabled = true;
  try {
    await api('/api/company-access', { method: 'POST', body: JSON.stringify({ employee_id: employeeId, role }) });
    $('#companyAccessModal').close();
    await loadCompanyAccess({ silent: false });
    await loadSessionOnly();
    renderIdentity();
    toast(`เพิ่มสิทธิ์ ${roleLabel(role)} แล้ว · LINE ของผู้รับจะมีปุ่มเข้า Workspace เดิม`);
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
  }
}

window.revokeCompanyAccess = async (userId, name) => {
  if (!confirm(`ถอนสิทธิ์ของ ${name || 'บัญชีนี้'} ออกจากการจัดการ Workspace ใช่ไหม?`)) return;
  try {
    await api(`/api/company-access/${Number(userId)}`, { method: 'DELETE', body: '{}' });
    await loadCompanyAccess({ silent: false });
    toast('ถอนสิทธิ์แล้ว');
  } catch (error) {
    toast(error.message, true);
  }
};

function renderApproverAccess() {
  const section = $('#approverAccessSection');
  if (!section) return;
  const canManage = ['owner','co_owner','hr_admin','hr'].includes(String(activeCompanyRole() || ''));
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

  const canManage = ['owner','co_owner','hr_admin'].includes(String(activeCompanyRole() || ''));
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
    hr_private: `แจ้งเรื่องส่วนตัวถึง HR ${item.count} เรื่อง`,
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
    hr_private: 'เปิดดูเรื่องร้องเรียนหรือเรื่องส่วนตัวที่พนักงานส่งถึง HR',
    request: 'คำขอจากพนักงานที่ยังไม่ได้ปิดงาน',
  })[key] || 'เปิดดูรายละเอียดและดำเนินการต่อ';
}

function attentionTarget(key) {
  return ({ missing: 'attendance', leave_pending: 'leave', probation: 'employees', contract: 'employees', candidate: 'recruitment', hr_private: 'hr-inbox', request: 'requests' })[key];
}

function attentionTone(item) {
  if (item.key === 'missing') return 'coral';
  if (['leave_pending', 'probation', 'contract'].includes(item.key)) return 'warning';
  if (item.key === 'hr_private') return 'coral';
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
  const workspace=$('.payroll-workspace');
  if(!data){root.innerHTML='<div class="payroll-locked">Payroll แสดงเฉพาะ Owner / HR Admin / HR</div>';$('#payrollPeriods').innerHTML='';$('#payrollSettingsBtn').classList.add('hidden');$('#createPayrollPeriodBtn').classList.add('hidden');$('#payrollComponentsBtn')?.classList.add('hidden');workspace?.classList.remove('setup-mode');return;}
  $('#payrollSettingsBtn').classList.remove('hidden');$('#createPayrollPeriodBtn').classList.remove('hidden');$('#payrollComponentsBtn')?.classList.remove('hidden');
  const periods=data.periods||[]; const latest=periods[0]; const ready=data.readiness||{}; const employees=Number(ready.employees||0); const salaryReady=Number(ready.salary_ready||0); const bankReady=Number(ready.bank_ready||0); const setupPct=employees?Math.round(((salaryReady+bankReady)/(employees*2))*100):0;
  workspace?.classList.toggle('setup-mode',!periods.length);
  if(periods.length){
    root.innerHTML=[
      ['รอบล่าสุด',latest?`${formatDate(latest.period_start)} → ${formatDate(latest.period_end)}`:'—','calendar',latest?`Payroll ${latest.period_key}`:'ยังไม่มีรอบ'],
      ['Gross Payroll',latest?money(latest.gross_total):money(0),'brand','รายได้รวมก่อนหัก'],
      ['รายการหัก',latest?money(latest.deduction_total):money(0),'warning','ภาษี · SSO · รายการหัก'],
      ['ยอดโอนสุทธิ',latest?money(latest.net_total):money(0),'success','ยอดสุทธิที่จ่ายพนักงาน'],
    ].map(([label,value,tone,note])=>`<div class="payroll-summary-card ${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></div>`).join('');
  }else{
    root.innerHTML=[
      ['พนักงานทั้งหมด',`${employees} คน`,'brand','พนักงาน Active ในบริษัท'],
      ['ฐานเงินเดือนพร้อม',`${salaryReady}/${employees} คน`,salaryReady===employees&&employees?'success':'warning','ต้องตั้งก่อนสร้างรอบ'],
      ['บัญชีรับเงินพร้อม',`${bankReady}/${employees} คน`,bankReady===employees&&employees?'success':'warning','ใช้สำหรับไฟล์โอนเงิน'],
      ['ความพร้อม Payroll',`${setupPct}%`,setupPct===100?'success':'info','ฐานเงินเดือน + บัญชีรับเงิน'],
    ].map(([label,value,tone,note])=>`<div class="payroll-summary-card ${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></div>`).join('');
  }
  $('#payrollReadyBadge').className=`badge ${salaryReady===employees&&employees?'badge-success':'badge-warning'}`;
  $('#payrollReadyBadge').textContent=periods.length?`เงินเดือน ${salaryReady}/${employees}`:`พร้อม ${setupPct}%`;
  $('#payrollPeriods').innerHTML=periods.length?periods.map(p=>`<button type="button" class="payroll-period-row ${Number(state.activePayrollPeriodId)===Number(p.id)?'active':''}" onclick="window.openPayrollPeriod(${p.id})"><span><strong>${escapeHtml(p.period_key)}</strong><small>${formatDate(p.period_start)} → ${formatDate(p.period_end)} · จ่าย ${formatDate(p.pay_date)} · ${Number(p.employee_count||0)} คน</small></span><span><b>${money(p.net_total)}</b><em class="badge ${payrollStatusClass(p.status)}">${payrollStatusLabel(p.status)}</em></span></button>`).join(''):renderPayrollGettingStarted(ready);
  if(state.payrollDetail?.period && Number(state.payrollDetail.period.id)===Number(state.activePayrollPeriodId))renderPayrollDetail();
  else if(!state.activePayrollPeriodId&&periods.length){state.activePayrollPeriodId=Number(periods[0].id);loadPayrollPeriod(state.activePayrollPeriodId);}
  else if(!periods.length)renderPayrollSetupList();
}

function renderPayrollGettingStarted(ready={}){
  const employees=Number(ready.employees||0),salary=Number(ready.salary_ready||0),bank=Number(ready.bank_ready||0); const pct=employees?Math.round(((salary+bank)/(employees*2))*100):0;
  return `<div class="payroll-onboarding"><div class="payroll-onboarding-progress"><span style="width:${Math.max(0,Math.min(100,pct))}%"></span></div><div class="payroll-onboarding-score"><strong>${pct}%</strong><span>พร้อมเริ่ม Payroll</span></div><div class="payroll-onboarding-steps"><div class="${salary===employees&&employees?'done':''}"><b>1</b><span><strong>ตั้งฐานเงินเดือน</strong><small>${salary}/${employees} คน</small></span></div><div class="${bank===employees&&employees?'done':''}"><b>2</b><span><strong>ตั้งบัญชีรับเงิน</strong><small>${bank}/${employees} คน</small></span></div><div><b>3</b><span><strong>สร้างรอบเงินเดือนแรก</strong><small>คำนวณ Preview ก่อนส่งตรวจ</small></span></div></div><div class="payroll-onboarding-actions"><button type="button" class="secondary-btn" onclick="window.openNextPayrollSetup()">ตั้งค่าคนที่ยังไม่พร้อม</button><button type="button" class="primary-btn" onclick="document.querySelector('#createPayrollPeriodBtn')?.click()">สร้างรอบแรก</button></div></div>`;
}

function payrollSetupStatus(e){const salary=Number(e.base_salary||0)>0,bank=Boolean(String(e.bank_account_no||'').trim());if(salary&&bank)return{key:'ready',label:'พร้อม',className:'ready'};if(!salary&&!bank)return{key:'missing',label:'ขาดเงินเดือน + บัญชี',className:'missing'};if(!salary)return{key:'salary',label:'ขาดฐานเงินเดือน',className:'warning'};return{key:'bank',label:'ขาดบัญชีรับเงิน',className:'warning'};}
function renderPayrollSetupList(){
  const detail=$('#payrollDetail'); if(!detail)return; detail.classList.remove('payroll-detail-empty');
  const profiles=state.payroll?.profiles||[]; const ready=state.payroll?.readiness||{}; const missing=profiles.filter(e=>payrollSetupStatus(e).key!=='ready').length;
  const rows=profiles.map(e=>{
    const status=payrollSetupStatus(e);const search=`${e.nickname||''} ${e.first_name||''} ${e.last_name||''} ${e.employee_code||''} ${e.department_name||''} ${e.position_name||''}`.toLowerCase();const tax=e.tax_enabled==null||Number(e.tax_enabled)===1;const sso=e.social_security_enabled==null||Number(e.social_security_enabled)===1;const bankDisplay=(e.bank_name||'').trim();const accountDisplay=(e.bank_account_no||'').trim();const accountHolder=(e.bank_account_name||'').trim();
    return `<tr data-payroll-setup-row data-payroll-setup-search="${escapeAttr(search)}" data-payroll-setup-status="${status.key}">
      <td class="payroll-setup-employee"><button type="button" onclick="window.openPayrollProfile(${Number(e.id)})"><span class="payroll-person-avatar">${escapeHtml((e.nickname||e.first_name||'?').slice(0,1))}</span><span><strong>${escapeHtml(e.nickname||e.first_name)} ${escapeHtml(e.last_name||'')}</strong><small>${escapeHtml(e.employee_code||'—')}</small></span></button></td>
      <td><strong>${escapeHtml(e.department_name||'ยังไม่ระบุ')}</strong><small>${escapeHtml(e.position_name||'ยังไม่ระบุตำแหน่ง')}</small></td>
      <td class="payroll-setup-money"><button type="button" class="payroll-inline-trigger ${Number(e.base_salary||0)>0?'':'is-empty'}" onclick="window.openPayrollQuickEdit(${Number(e.id)},'base_salary')">${Number(e.base_salary||0)>0?`<strong>${money(e.base_salary)}</strong><small>มีผล ${e.effective_from?formatDate(e.effective_from):'ตามข้อมูลล่าสุด'}</small>`:`<span class="payroll-missing-value">ยังไม่ตั้ง</span><small>คลิกเพื่อตั้งฐานเงินเดือน</small>`}<span class="inline-edit-hint">คลิกเพื่อแก้ไข</span></button></td>
      <td><div class="payroll-rule-badges"><span class="${tax?'on':'off'}">ภาษี ${tax?'เปิด':'ปิด'}</span><span class="${sso?'on':'off'}">SSO ${sso?'เปิด':'ปิด'}</span></div></td>
      <td><button type="button" class="payroll-inline-trigger ${bankDisplay?'':'is-empty'}" onclick="window.openPayrollQuickEdit(${Number(e.id)},'bank_name')">${bankDisplay?`<strong>${escapeHtml(bankDisplay)}</strong><small>${accountHolder?escapeHtml(accountHolder):'คลิกเพื่อเปลี่ยนธนาคาร'}</small>`:`<span class="payroll-missing-value">ยังไม่มีธนาคาร</span><small>คลิกเพื่อตั้งชื่อธนาคาร</small>`}<span class="inline-edit-hint">คลิกเพื่อแก้ไข</span></button></td>
      <td><button type="button" class="payroll-inline-trigger ${accountDisplay?'':'is-empty'}" onclick="window.openPayrollQuickEdit(${Number(e.id)},'bank_account_no')">${accountDisplay?`<strong>${escapeHtml(accountDisplay)}</strong><small>${accountHolder?escapeHtml(accountHolder):'บัญชีรับเงินเดือน'}</small>`:`<span class="payroll-missing-value">ยังไม่มีบัญชี</span><small>คลิกเพื่อตั้งเลขบัญชี</small>`}<span class="inline-edit-hint">คลิกเพื่อแก้ไข</span></button></td>
      <td><span class="payroll-setup-status ${status.className}">${escapeHtml(status.label)}</span></td>
      <td class="payroll-setup-action"><button type="button" class="secondary-btn" onclick="window.openPayrollProfile(${Number(e.id)})">ดูเต็ม</button></td>
    </tr>`;
  }).join('');
  detail.innerHTML=`<div class="payroll-setup-head"><div><p class="kicker">EMPLOYEE PAYROLL SETUP</p><h2>ตั้งข้อมูลเงินเดือนพนักงาน</h2><p>คลิกที่ฐานเงินเดือน / ธนาคาร / เลขบัญชี เพื่อแก้ไขได้ทันที ไม่ต้องกดปุ่มตั้งค่า</p></div><div class="payroll-setup-head-status"><strong>${Number(ready.salary_ready||0)}/${Number(ready.employees||0)}</strong><span>ฐานเงินเดือนพร้อม</span></div></div><div class="payroll-setup-toolbar"><div class="payroll-setup-search"><input id="payrollSetupSearch" type="search" placeholder="ค้นหาชื่อ / รหัส / แผนก" oninput="window.filterPayrollSetup()"/><select id="payrollSetupStatusFilter" onchange="window.filterPayrollSetup()"><option value="all">ทุกสถานะ</option><option value="missing">ขาดหลายรายการ</option><option value="salary">ขาดฐานเงินเดือน</option><option value="bank">ขาดบัญชีรับเงิน</option><option value="ready">พร้อมแล้ว</option></select></div><span id="payrollSetupCount">${profiles.length} คน${missing?` · ต้องตั้งค่าอีก ${missing} คน`:''}</span></div>${profiles.length?`<div class="payroll-setup-table-wrap"><table class="payroll-setup-table"><thead><tr><th>พนักงาน</th><th>แผนก / ตำแหน่ง</th><th>ฐานเงินเดือน</th><th>ภาษี / ประกันสังคม</th><th>ธนาคาร</th><th>เลขบัญชี</th><th>สถานะ</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`:emptyState('ยังไม่มีพนักงาน','เพิ่มพนักงานก่อนตั้ง Payroll')}`;
}
window.filterPayrollSetup=()=>{const q=String($('#payrollSetupSearch')?.value||'').trim().toLowerCase(),status=String($('#payrollSetupStatusFilter')?.value||'all');let visible=0;$$('[data-payroll-setup-row]').forEach(row=>{const matchesSearch=!q||String(row.dataset.payrollSetupSearch||'').includes(q),matchesStatus=status==='all'||String(row.dataset.payrollSetupStatus||'')===status;const show=matchesSearch&&matchesStatus;row.classList.toggle('hidden',!show);if(show)visible++;});const count=$('#payrollSetupCount');if(count)count.textContent=`แสดง ${visible} คน`;};
window.openNextPayrollSetup=()=>{const profiles=state.payroll?.profiles||[];const target=profiles.find(e=>payrollSetupStatus(e).key!=='ready')||profiles[0];if(target)window.openPayrollProfile(Number(target.id));else toast('ยังไม่มีพนักงานให้ตั้งค่า',true);};

function payrollRecurringComponentsPayload(result){return (result.components||[]).map(x=>({component_id:Number(x.component_id),amount:Number(x.amount||0)}));}
function payrollProfilePayloadFromResult(result){const p=result?.profile||{};return {base_salary:Number(p.base_salary||0),effective_from:p.effective_from||localDateKey(new Date()),social_security_enabled:p.social_security_enabled==null?true:Boolean(Number(p.social_security_enabled)),tax_enabled:p.tax_enabled==null?true:Boolean(Number(p.tax_enabled)),personal_allowance:Number(p.personal_allowance??60000),extra_annual_deductions:Number(p.extra_annual_deductions??0),monthly_tax_override:p.monthly_tax_override??'',bank_name:p.bank_name||'',bank_account_name:p.bank_account_name||'',bank_account_no:p.bank_account_no||'',payroll_note:p.payroll_note||'',recurring_components:payrollRecurringComponentsPayload(result)};}
window.openPayrollQuickEdit=async(id,field)=>{try{const result=await api(`/api/employees/${Number(id)}/payroll-profile`);const p=result.profile||{},e=result.employee||{};$('#payrollQuickEditEmployeeId').value=String(id);$('#payrollQuickEditField').value=String(field||'base_salary');$('#payrollQuickEditEmployeeLabel').textContent=`พนักงาน · ${(e.nickname||e.first_name||'พนักงาน')} ${e.last_name||''}`.trim();const salaryWrap=$('#payrollQuickEditSalaryFields');const bankWrap=$('#payrollQuickEditBankFields');const isSalary=String(field)==='base_salary';salaryWrap?.classList.toggle('hidden',!isSalary);bankWrap?.classList.toggle('hidden',isSalary);if($('#payrollQuickEditTitle'))$('#payrollQuickEditTitle').textContent=isSalary?'แก้ฐานเงินเดือน':'แก้ข้อมูลบัญชีรับเงิน';if($('#payrollQuickEditSubtitle'))$('#payrollQuickEditSubtitle').textContent=isSalary?'อัปเดตฐานเงินเดือนและวันที่มีผลได้ทันทีจากตาราง Payroll':'แยกแก้ธนาคารและเลขบัญชีจากตาราง Payroll ได้โดยไม่ต้องกดปุ่มตั้งค่า';if($('#payrollQuickEditHint'))$('#payrollQuickEditHint').textContent=isSalary?'ใช้สำหรับเงินเดือนประจำของพนักงานคนนี้':'แก้ธนาคาร ชื่อบัญชี และเลขบัญชีสำหรับรับเงินเดือน';$('#payrollQuickBaseSalary').value=p.base_salary??0;$('#payrollQuickEffectiveFrom').value=p.effective_from||localDateKey(new Date());$('#payrollQuickBankName').value=p.bank_name||'';$('#payrollQuickBankAccountName').value=p.bank_account_name||'';$('#payrollQuickBankAccountNo').value=p.bank_account_no||'';$('#payrollQuickEditModal').showModal();setTimeout(()=>{(isSalary?$('#payrollQuickBaseSalary'):(String(field)==='bank_name'?$('#payrollQuickBankName'):$('#payrollQuickBankAccountNo')))?.focus();},40);}catch(error){toast(error.message,true)}};
async function savePayrollQuickEdit(){const id=Number($('#payrollQuickEditEmployeeId')?.value||0);const field=String($('#payrollQuickEditField')?.value||'base_salary');const button=$('#payrollQuickEditSaveBtn');if(!id||!button)return;button.disabled=true;button.textContent='กำลังบันทึก…';try{const result=await api(`/api/employees/${id}/payroll-profile`);const payload=payrollProfilePayloadFromResult(result);if(field==='base_salary'){payload.base_salary=Number($('#payrollQuickBaseSalary').value||0);payload.effective_from=$('#payrollQuickEffectiveFrom').value||localDateKey(new Date());}else{payload.bank_name=$('#payrollQuickBankName').value.trim();payload.bank_account_name=$('#payrollQuickBankAccountName').value.trim();payload.bank_account_no=$('#payrollQuickBankAccountNo').value.trim();}await api(`/api/employees/${id}/payroll-profile`,{method:'PUT',body:JSON.stringify(payload)});$('#payrollQuickEditModal').close();await refreshPayroll();if(state.activePayrollPeriodId&&['draft','review'].includes(state.payrollDetail?.period?.status)){await api(`/api/payroll/periods/${state.activePayrollPeriodId}/recalculate`,{method:'POST',body:'{}'});await loadPayrollPeriod(state.activePayrollPeriodId);}toast(field==='base_salary'?'อัปเดตฐานเงินเดือนแล้ว':'อัปเดตข้อมูลบัญชีรับเงินแล้ว');}catch(error){toast(error.message,true)}finally{button.disabled=false;button.textContent='บันทึกทันที';}}

window.openPayrollPeriod=id=>loadPayrollPeriod(Number(id));
async function loadPayrollPeriod(id){state.activePayrollPeriodId=Number(id);try{state.payrollDetail=await api(`/api/payroll/periods/${id}`);renderPayroll();renderPayrollDetail();}catch(error){toast(error.message,true);}}

function payrollAdjustmentMaps(detail){
  const map=new Map();
  for(const a of detail?.adjustments||[]){
    const id=Number(a.employee_id); const row=map.get(id)||{commission:0,kpi:0,incentive:0,bonus:0,otherEarn:0,otherDeduct:0,taxAdjust:0,commissionGrid:0,kpiGrid:0,incentiveGrid:0,bonusGrid:0,otherGrid:0,otherDeductGrid:0,items:[]};
    const amt=Number(a.amount||0), cat=String(a.category||'other'), source=String(a.source_key||''); row.items.push(a);
    if(source==='grid:commission')row.commissionGrid=amt; if(source==='grid:kpi')row.kpiGrid=amt; if(source==='grid:incentive')row.incentiveGrid=amt; if(source==='grid:bonus')row.bonusGrid=amt; if(source==='grid:other')row.otherGrid=amt; if(source==='grid:other_deduction')row.otherDeductGrid=amt;
    if(cat==='commission') row.commission+=amt;
    else if(cat==='kpi') row.kpi+=amt;
    else if(cat==='incentive') row.incentive+=amt;
    else if(cat==='bonus') row.bonus+=amt;
    else if(cat==='tax_add') row.taxAdjust+=amt;
    else if(cat==='tax_reduce') row.taxAdjust-=amt;
    else if(a.adjustment_type==='deduction') row.otherDeduct+=amt;
    else row.otherEarn+=amt;
    map.set(id,row);
  }
  return map;
}
function payrollBreakdown(item){try{return JSON.parse(item?.breakdown_json||'{}')||{}}catch{return {}}}
function payrollApprovalLabel(p){if(p.approval_status==='pending')return 'รอ Checker อนุมัติ';if(p.approval_status==='approved')return 'อนุมัติแล้ว';return 'ไม่บังคับ Checker';}
function payrollVarianceBadge(item){const pct=Number(item.variance_pct||0);if(!Number(item.prior_net_pay||0))return '<span class="payroll-variance neutral">ใหม่</span>';const cls=Math.abs(pct)>=30?'warn':pct>0?'up':pct<0?'down':'neutral';return `<span class="payroll-variance ${cls}">${pct>0?'+':''}${pct.toFixed(1)}%</span>`;}
function payrollGridInput(periodId,employeeId,category,value,editable){
  if(!editable)return Number(value||0)?money(value):'—';
  return `<input class="payroll-grid-input" inputmode="decimal" type="number" min="0" step="0.01" value="${Number(value||0)||''}" placeholder="0" onchange="window.savePayrollGridCell(${Number(periodId)},${Number(employeeId)},'${category}',this)" />`;
}
function payrollReadiness(detail){
  const items=detail?.items||[],exceptions=detail?.exceptions||[];
  const bankMissing=items.filter(x=>!String(x.bank_account_no||'').trim()).length;
  const salaryMissing=items.filter(x=>Number(x.base_salary||0)<=0).length;
  const blocking=exceptions.filter(x=>x.severity==='error').length;
  const warnings=exceptions.filter(x=>x.severity!=='error').length;
  const ready=Math.max(0,items.length-new Set([
    ...items.filter(x=>!String(x.bank_account_no||'').trim()).map(x=>Number(x.employee_id)),
    ...items.filter(x=>Number(x.base_salary||0)<=0).map(x=>Number(x.employee_id)),
    ...exceptions.filter(x=>x.severity==='error').map(x=>Number(x.employee_id))
  ]).size);
  return {total:items.length,ready,bankMissing,salaryMissing,blocking,warnings};
}
function renderPayrollExceptions(detail){
  const rows=detail?.exceptions||[]; const r=payrollReadiness(detail);
  if(!rows.length)return `<section class="payroll-validation-compact is-clear"><span class="payroll-validation-icon">✓</span><div><strong>ตรวจสอบเบื้องต้นแล้ว</strong><small>${r.ready}/${r.total} คนพร้อม · ไม่พบรายการผิดปกติ</small></div></section>`;
  const errors=rows.filter(x=>x.severity==='error'),warnings=rows.filter(x=>x.severity!=='error');
  return `<section class="payroll-exception-center"><div class="payroll-exception-head"><div><p class="kicker">CHECK BEFORE PAY</p><h3>มี ${rows.length} รายการที่ควรตรวจ</h3><span>${errors.length?`${errors.length} รายการต้องแก้ก่อนปิดรอบ`:''}${errors.length&&warnings.length?' · ':''}${warnings.length?`${warnings.length} รายการควรตรวจ`:''}</span></div><div class="payroll-exception-count"><b>${errors.length}</b><small>ต้องแก้</small></div></div><div class="payroll-exception-list">${rows.slice(0,8).map(x=>`<button type="button" class="payroll-exception ${x.severity}" onclick="window.openPayrollEmployeeDetail(${Number(x.employee_id)})"><span><strong>${escapeHtml(x.employee_name)}</strong><small>${escapeHtml(x.title)} · ${escapeHtml(x.detail||'')}</small></span><em>${x.severity==='error'?'แก้ตอนนี้':'ตรวจสอบ'}</em></button>`).join('')}${rows.length>8?`<small class="payroll-more-exceptions">และอีก ${rows.length-8} รายการ</small>`:''}</div></section>`;
}
function payrollWorkflowState(p,settings={}){
  if(p.status==='published')return {step:5,label:'ส่งให้พนักงานแล้ว'};
  if(p.status==='locked')return {step:5,label:'พร้อมออกสลิปและส่งพนักงาน'};
  if(p.status==='review'&&p.approval_status==='pending')return {step:3,label:'รอผู้อนุมัติ'};
  if(p.status==='review'&&(p.approval_status==='approved'||!Number(settings.require_separate_approver||0)))return {step:4,label:'พร้อมปิดการแก้ไขรอบ'};
  if(p.status==='review')return {step:2,label:'กำลังตรวจสอบ'};
  return {step:1,label:'กำลังเตรียมข้อมูล'};
}
function renderPayrollWorkflow(p,settings={}){
  const wf=payrollWorkflowState(p,settings),steps=['เตรียมข้อมูล','ตรวจสอบ','อนุมัติ','ปิดการแก้ไข','ออกสลิป'];
  return `<section class="payroll-workflow"><div class="payroll-workflow-head"><div><p class="kicker">PAYROLL FLOW</p><strong>${escapeHtml(wf.label)}</strong></div><span>ขั้น ${Math.min(wf.step,5)}/5</span></div><div class="payroll-workflow-steps">${steps.map((label,i)=>{const n=i+1,done=p.status==='published'||n<wf.step,current=n===wf.step&&p.status!=='published';return `<div class="${done?'done':''} ${current?'current':''}"><b>${done?'✓':n}</b><span>${label}</span></div>`}).join('')}</div></section>`;
}
function payrollPrimaryAction(p,settings={}){
  if(p.status==='draft')return `<button class="primary-btn payroll-next-action" type="button" onclick="window.reviewPayroll(${p.id})">ตรวจสอบรอบเงินเดือน →</button>`;
  if(p.status==='review'&&p.approval_status==='pending')return `<button class="primary-btn payroll-next-action" type="button" onclick="window.approvePayroll(${p.id})">อนุมัติรอบ →</button>`;
  if(p.status==='review'&&(p.approval_status==='approved'||!Number(settings.require_separate_approver||0)))return `<button class="primary-btn payroll-next-action" type="button" onclick="window.openPayrollLockPreview(${p.id})">ตรวจสรุปก่อนปิดรอบ →</button>`;
  if(p.status==='locked')return `<button class="primary-btn payroll-next-action" type="button" onclick="window.publishPayroll(${p.id})">ออกสลิปและส่งพนักงาน →</button>`;
  return '';
}
function renderPayrollTools(p,editable){
  const tools=[];
  if(editable)tools.push(`<button type="button" onclick="window.editPayrollPeriod(${p.id})">แก้ไขรอบ</button>`,`<button type="button" onclick="window.recalculatePayroll(${p.id})">คำนวณใหม่</button>`,`<button type="button" onclick="window.openPayrollBulkAdjustment(${p.id})">เพิ่มหลายคน</button>`,`<button type="button" onclick="window.openPayrollAdjustment(${p.id})">เพิ่มรายการรายคน</button>`,`<button class="danger" type="button" onclick="window.deletePayrollPeriod(${p.id})">ลบรอบ</button>`);
  if(p.status==='locked')tools.push(`<button type="button" onclick="window.generatePayrollPayslips(${p.id})">สร้างสลิปก่อนส่ง</button>`,`<button type="button" onclick="window.exportPayroll(${p.id},'bank')">Export ธนาคาร</button>`,`<button type="button" onclick="window.exportPayroll(${p.id},'accounting')">Export บัญชี</button>`,`<button class="danger" type="button" onclick="window.unlockPayroll(${p.id})">ปลด Lock</button>`);
  if(p.status==='published')tools.push(`<button type="button" onclick="window.exportPayroll(${p.id},'bank')">Export ธนาคาร</button>`,`<button type="button" onclick="window.exportPayroll(${p.id},'accounting')">Export บัญชี</button>`);
  if(!tools.length)return '';
  return `<details class="payroll-more-actions"><summary>เครื่องมือเพิ่มเติม</summary><div>${tools.join('')}</div></details>`;
}
function renderPayrollTimeline(detail){const rows=detail?.timeline||[];if(!rows.length)return '';const labels={period_created:'สร้างรอบ',submitted_for_review:'ส่งตรวจ',approved:'อนุมัติ',locked:'Lock รอบ',unlocked:'ปลด Lock',published:'Publish',grid_cell_updated:'แก้ตาราง',bulk_adjustment:'เพิ่มรายการหลายคน',bank_exported:'Export ธนาคาร',accounting_exported:'Export บัญชี'};return `<details class="payroll-timeline"><summary>ประวัติรอบเงินเดือน <span>${rows.length}</span></summary><div>${rows.slice(0,30).map(x=>`<article><b>${escapeHtml(labels[x.event_type]||x.event_type)}</b><span>${escapeHtml(x.actor_name||x.actor_email||'ระบบ')}</span><time>${formatDateTime(x.created_at)}</time></article>`).join('')}</div></details>`;}
function renderPayrollMobileCards(period,items,editable,settings,adjMap){
  return `<div class="payroll-mobile-list">${items.map(item=>{const a=adjMap.get(Number(item.employee_id))||{commission:0,kpi:0,incentive:0,bonus:0,otherEarn:0,otherDeduct:0};const bd=payrollBreakdown(item),search=`${item.nickname||''} ${item.first_name||''} ${item.last_name||''} ${item.employee_code||''} ${item.department_name||''} ${item.position_name||''}`.toLowerCase();const deductions=Number(item.gross_income||0)-Number(item.net_pay||0);return `<article class="payroll-mobile-card payroll-mobile-card-compact" data-payroll-search="${escapeAttr(search)}"><div class="payroll-mobile-card-head"><button class="payroll-person payroll-person-button" type="button" onclick="window.openPayrollEmployeeDetail(${Number(item.employee_id)})"><span class="payroll-person-avatar">${escapeHtml((item.nickname||item.first_name||'?').slice(0,1))}</span><span><strong>${escapeHtml(item.nickname||item.first_name)} ${escapeHtml(item.last_name||'')}</strong><small>${escapeHtml(item.employee_code||'')} · ${escapeHtml(item.department_name||'—')}</small></span></button><div class="payroll-mobile-net"><span>รับสุทธิ</span><strong>${money(item.net_pay)}</strong></div></div><div class="payroll-mobile-three"><div><span>รายได้รวม</span><strong>${money(item.gross_income)}</strong></div><div><span>หักทั้งหมด</span><strong>${money(Math.max(0,deductions))}</strong></div><div><span>สถานะ</span><strong>${String(item.bank_account_no||'').trim()?'พร้อม':'ขาดบัญชี'}</strong></div></div>${editable?`<div class="payroll-mobile-quick-edit"><label><span>Commission</span>${payrollGridInput(period.id,item.employee_id,'commission',a.commissionGrid,editable)}</label><label><span>KPI</span>${payrollGridInput(period.id,item.employee_id,'kpi',a.kpiGrid,editable)}</label><label><span>Incentive</span>${payrollGridInput(period.id,item.employee_id,'incentive',a.incentiveGrid,editable)}</label><label><span>Bonus</span>${payrollGridInput(period.id,item.employee_id,'bonus',a.bonusGrid,editable)}</label></div>`:''}<details class="payroll-mobile-more"><summary>ดูรายละเอียดเงินเดือน</summary><div class="payroll-mobile-more-body"><div class="payroll-mobile-pairs"><div><span>ฐานเงินเดือน</span><strong>${money(item.base_salary)}</strong></div><div><span>เงินเดือนรอบนี้</span><strong>${money(item.prorated_salary)}</strong></div><div><span>ขาด/สาย</span><strong>${money(item.attendance_deduction||0)}</strong><small>${Number(item.absent_days||0)} วัน · ${Number(item.late_minutes||0)} นาที</small></div><div><span>ประกันสังคม</span><strong>${money(item.social_security)}</strong></div><div><span>ภาษี</span><strong>${money(item.withholding_tax)}</strong></div><div><span>ต้นทุนบริษัท</span><strong>${money(item.employer_cost||item.gross_income)}</strong></div><div><span>ธนาคาร</span><strong>${escapeHtml(item.bank_name||'—')}</strong></div><div><span>เลขบัญชี</span><strong>${item.bank_account_no?escapeHtml(String(item.bank_account_no)):'—'}</strong></div></div></div></details><div class="payroll-mobile-actions">${editable?`<button class="secondary-btn" type="button" onclick="window.openPayrollAdjustment(${period.id},${item.employee_id})">เพิ่ม/หักเงิน</button>`:''}<button class="primary-btn ghost" type="button" onclick="window.openPayrollEmployeeDetail(${item.employee_id})">ดูที่มาของตัวเลข</button></div></article>`;}).join('')}</div>`;
}
function renderPayrollDetail(){
  $('#payrollDetail')?.classList.remove('payroll-detail-empty');
  const detail=state.payrollDetail; if(!detail?.period)return; const p=detail.period; const editable=['draft','review'].includes(p.status); const documents=detail.documents||[]; const adjMap=payrollAdjustmentMaps(detail); const items=detail.items||[]; const settings=detail.settings||state.payroll?.settings||{}; const ready=payrollReadiness(detail);
  const employerCost=items.reduce((a,x)=>a+Number(x.employer_cost||x.gross_income||0),0),taxTotal=items.reduce((a,x)=>a+Number(x.withholding_tax||0),0),ssoTotal=items.reduce((a,x)=>a+Number(x.social_security||0),0),deductionTotal=Math.max(0,Number(p.gross_total||0)-Number(p.net_total||0));
  $('#payrollDetail').innerHTML=`<div class="payroll-detail-head payroll-detail-head-simplified"><div><p class="kicker">PAYROLL · ${escapeHtml(p.period_key)}</p><h2>รอบ ${formatDate(p.period_start)} – ${formatDate(p.period_end)}</h2><div class="payroll-period-subline"><span>${items.length} คน</span><span>จ่าย ${formatDate(p.pay_date)}</span><span class="badge ${payrollStatusClass(p.status)}">${payrollStatusLabel(p.status)}</span></div></div><div class="payroll-period-nav"><button type="button" onclick="window.navigatePayrollPeriod(1)">‹ รอบก่อน</button><button type="button" onclick="window.navigatePayrollPeriod(-1)">รอบถัดไป ›</button></div></div>
    ${renderPayrollWorkflow(p,settings)}
    <div class="payroll-command-row"><div class="payroll-readiness-card"><span>ความพร้อม</span><strong>${ready.ready}/${ready.total} คน</strong><small>${ready.blocking?`${ready.blocking} รายการต้องแก้`:ready.bankMissing?`${ready.bankMissing} คนยังไม่มีบัญชี`:'พร้อมตรวจรอบ'}</small></div><div class="payroll-primary-command">${payrollPrimaryAction(p,settings)}${renderPayrollTools(p,editable)}</div></div>
    <div class="payroll-detail-totals payroll-detail-totals-v2 payroll-totals-readable"><div><span>รายได้รวมก่อนหัก</span><strong>${money(p.gross_total)}</strong><small>Gross Payroll</small></div><div><span>รายการหักทั้งหมด</span><strong>${money(deductionTotal)}</strong><small>ภาษี + ปกส. + หักอื่น</small></div><div><span>ภาษีหัก ณ ที่จ่าย</span><strong>${money(taxTotal)}</strong></div><div><span>ประกันสังคมพนักงาน</span><strong>${money(ssoTotal)}</strong></div><div class="net"><span>ยอดโอนสุทธิ</span><strong>${money(p.net_total)}</strong><small>Net Pay</small></div><div><span>ต้นทุนบริษัท</span><strong>${money(employerCost)}</strong><small>Employer Cost</small></div></div>
    ${renderPayrollExceptions(detail)}
    <div class="payroll-grid-toolbar payroll-grid-toolbar-mobile"><div><input id="payrollGridSearch" type="search" placeholder="ค้นหาชื่อ / รหัส / แผนก" oninput="window.filterPayrollGrid(this.value)" /><span>${items.length} คน · ข้อมูล Attendance/Leave ตามช่วงรอบนี้</span></div><button class="secondary-btn" type="button" onclick="window.openPayrollComponentsModal()">ตั้งค่ารายการเงิน</button></div>
    <div class="payroll-input-legend"><span class="editable">กรอกเอง</span><small>Commission · KPI · Incentive · Bonus · หักอื่น</small><span class="system">ระบบคำนวณ</span><small>เงินเดือนรอบนี้ · Attendance · ภาษี · ปกส. · Gross · Net</small></div>
    ${renderPayrollMobileCards(p,items,editable,settings,adjMap)}
    <div class="payroll-sheet-wrap payroll-control-grid payroll-desktop-grid"><table class="payroll-sheet payroll-sheet-v2 payroll-sheet-company"><thead><tr class="payroll-group-head"><th class="sticky-col employee-col" rowspan="2">พนักงาน</th><th colspan="6" class="group-fixed">ข้อมูลพนักงาน / เงินเดือน</th><th colspan="5" class="group-variable">กรอกเอง</th><th colspan="4" class="group-deduct">ระบบคำนวณรายการหัก</th><th colspan="4" class="group-result">ผลลัพธ์</th><th colspan="3" class="group-bank">บัญชีรับเงิน</th><th class="sticky-action" rowspan="2">จัดการ</th></tr><tr><th>แผนก / ตำแหน่ง</th><th>วันที่เริ่มงาน</th><th>ฐานเงินเดือน</th><th>รูปแบบ</th><th>วันคิดเงิน</th><th>เงินเดือนรอบนี้</th><th>Commission</th><th>KPI</th><th>Incentive</th><th>Bonus</th><th>อื่น ๆ</th><th>ขาด/สาย</th><th>ปกส.</th><th>ภาษี</th><th>หักอื่น</th><th>Gross</th><th>Net Pay</th><th>Δ รอบก่อน</th><th>ต้นทุนบริษัท</th><th>ธนาคาร</th><th>เลขบัญชี</th><th>ชื่อบัญชี</th></tr></thead><tbody>${items.map(item=>{const a=adjMap.get(Number(item.employee_id))||{commission:0,kpi:0,incentive:0,bonus:0,otherEarn:0,otherDeduct:0};const bd=payrollBreakdown(item),search=`${item.nickname||''} ${item.first_name||''} ${item.last_name||''} ${item.employee_code||''} ${item.department_name||''}`.toLowerCase(),salaryMode=bd.salary_mode==='full'?'เต็มเดือน':'Prorate',payableDays=Number(bd.payable_days??bd.active_calendar_days??0);return `<tr data-payroll-search="${escapeAttr(search)}"><td class="sticky-col employee-col"><button class="payroll-person payroll-person-button" type="button" onclick="window.openPayrollEmployeeDetail(${Number(item.employee_id)})"><span class="payroll-person-avatar">${escapeHtml((item.nickname||item.first_name||'?').slice(0,1))}</span><span><strong>${escapeHtml(item.nickname||item.first_name)} ${escapeHtml(item.last_name||'')}</strong><small>${escapeHtml(item.employee_code||'')}</small></span></button></td><td><strong>${escapeHtml(item.department_name||'—')}</strong><small>${escapeHtml(item.position_name||'—')}</small></td><td class="payroll-system-cell">${item.start_date?formatDate(item.start_date):'—'}</td><td class="payroll-system-cell">${money(item.base_salary)}</td><td class="payroll-system-cell"><span class="payroll-salary-mode ${bd.salary_mode==='full'?'full':'partial'}">${salaryMode}</span></td><td class="payroll-system-cell"><strong>${payableDays||'—'}</strong><small>ตัวหาร ${Number(settings.daily_rate_divisor||30)}</small></td><td class="payroll-system-cell">${money(item.prorated_salary)}</td><td class="editable-pay-cell">${payrollGridInput(p.id,item.employee_id,'commission',a.commissionGrid,editable)}</td><td class="editable-pay-cell">${payrollGridInput(p.id,item.employee_id,'kpi',a.kpiGrid,editable)}</td><td class="editable-pay-cell">${payrollGridInput(p.id,item.employee_id,'incentive',a.incentiveGrid,editable)}</td><td class="editable-pay-cell">${payrollGridInput(p.id,item.employee_id,'bonus',a.bonusGrid,editable)}</td><td class="editable-pay-cell">${payrollGridInput(p.id,item.employee_id,'other',a.otherGrid,editable)}</td><td class="payroll-system-cell payroll-click-source" onclick="window.openPayrollEmployeeDetail(${item.employee_id})">${Number(item.attendance_deduction||0)?money(item.attendance_deduction):'—'}<small>${Number(item.absent_days||0)} วัน · ${Number(item.late_minutes||0)} นาที</small></td><td class="payroll-system-cell">${money(item.social_security)}</td><td class="payroll-system-cell payroll-click-source" onclick="window.openPayrollEmployeeDetail(${item.employee_id})">${money(item.withholding_tax)}</td><td class="editable-pay-cell">${payrollGridInput(p.id,item.employee_id,'other_deduction',a.otherDeductGrid,editable)}</td><td class="gross-col payroll-system-cell"><strong>${money(item.gross_income)}</strong></td><td class="net-col payroll-system-cell payroll-click-source" onclick="window.openPayrollEmployeeDetail(${item.employee_id})"><strong>${money(item.net_pay)}</strong><small>ดูที่มา</small></td><td class="payroll-system-cell">${payrollVarianceBadge(item)}<small>${Number(item.prior_net_pay||0)?money(item.prior_net_pay):'ไม่มีรอบก่อน'}</small></td><td class="payroll-system-cell"><strong>${money(item.employer_cost||item.gross_income)}</strong></td><td><strong>${escapeHtml(item.bank_name||'—')}</strong></td><td>${item.bank_account_no?escapeHtml(String(item.bank_account_no)):'—'}</td><td>${escapeHtml(item.bank_account_name||'—')}</td><td class="sticky-action">${editable?`<button class="payroll-adjust-btn" onclick="window.openPayrollAdjustment(${p.id},${item.employee_id})">เพิ่ม/หัก</button>`:''}<button class="text-btn" onclick="window.openPayrollEmployeeDetail(${item.employee_id})">ที่มา</button></td></tr>`}).join('')}</tbody><tfoot><tr><td class="sticky-col employee-col"><strong>รวมทั้งรอบ</strong></td><td colspan="15"></td><td class="gross-col"><strong>${money(p.gross_total)}</strong></td><td class="net-col"><strong>${money(p.net_total)}</strong></td><td></td><td><strong>${money(employerCost)}</strong></td><td colspan="3"></td><td class="sticky-action"></td></tr></tfoot></table></div>
    ${renderPayrollAdjustments(detail,editable)}${renderPayrollTimeline(detail)}
    <div class="payroll-footnote"><span>ภาษีเป็นประมาณการจาก Tax Profile / YTD และ Rule version ของรอบ ตรวจสอบก่อนปิดรอบ</span><span>${documents.length?`Payslip ${documents.length}/${items.length}`:''}</span></div>`;
}
window.navigatePayrollPeriod=async direction=>{const periods=state.payroll?.periods||[];if(!periods.length)return;const current=periods.findIndex(x=>Number(x.id)===Number(state.activePayrollPeriodId));const next=current+Number(direction||0);if(next<0||next>=periods.length){toast(direction>0?'ไม่มีรอบก่อนหน้า':'ไม่มีรอบถัดไป');return;}state.activePayrollPeriodId=Number(periods[next].id);await loadPayrollPeriod(state.activePayrollPeriodId);renderPayroll();};
window.openPayrollLockPreview=periodId=>{const detail=state.payrollDetail;if(!detail?.period||Number(detail.period.id)!==Number(periodId))return;const p=detail.period,items=detail.items||[],r=payrollReadiness(detail),tax=items.reduce((a,x)=>a+Number(x.withholding_tax||0),0),sso=items.reduce((a,x)=>a+Number(x.social_security||0),0),banks={};items.forEach(x=>{const k=String(x.bank_name||'ไม่ระบุ').trim()||'ไม่ระบุ';banks[k]=(banks[k]||0)+1;});$('#payrollLockPreviewPeriodId').value=String(periodId);$('#payrollLockPreviewTitle').textContent=`ตรวจรอบ ${formatDate(p.period_start)} – ${formatDate(p.period_end)}`;$('#payrollLockPreviewBody').innerHTML=`<div class="payroll-lock-summary"><div><span>พนักงาน</span><strong>${items.length} คน</strong></div><div><span>รายได้รวม</span><strong>${money(p.gross_total)}</strong></div><div><span>ภาษี</span><strong>${money(tax)}</strong></div><div><span>ประกันสังคม</span><strong>${money(sso)}</strong></div><div class="net"><span>ต้องโอนทั้งหมด</span><strong>${money(p.net_total)}</strong></div></div><div class="payroll-lock-readiness ${r.blocking?'has-error':'is-ready'}"><strong>${r.blocking?`ยังมี ${r.blocking} รายการต้องแก้`:`พร้อมปิดรอบ · ${r.ready}/${r.total} คน`}</strong><span>${r.bankMissing?`${r.bankMissing} คนไม่มีบัญชีธนาคาร · `:''}${r.salaryMissing?`${r.salaryMissing} คนไม่มีฐานเงินเดือน · `:''}${r.warnings?`${r.warnings} รายการควรตรวจ`:''}</span></div><div class="payroll-bank-breakdown"><h4>บัญชีรับเงิน</h4>${Object.entries(banks).map(([name,count])=>`<div><span>${escapeHtml(name)}</span><strong>${count} คน</strong></div>`).join('')}</div>`;$('#payrollLockConfirmBtn').disabled=Boolean(r.blocking);$('#payrollLockPreviewModal').showModal();};
window.confirmPayrollLockPreview=async()=>{const id=Number($('#payrollLockPreviewPeriodId').value||0);if(!id)return;$('#payrollLockPreviewModal').close();await window.lockPayroll(id,true);};
function renderPayrollAdjustments(detail,editable){
  const rows=detail.adjustments||[]; if(!rows.length)return '';
  const label={overtime:'OT',commission:'Commission',kpi:'KPI',incentive:'Incentive',allowance:'Allowance',bonus:'Bonus',other:'อื่น ๆ',other_deduction:'หักอื่น',tax_add:'เพิ่มภาษี',tax_reduce:'ลดภาษี'};
  return `<details class="payroll-adjustment-log"><summary>รายการปรับในรอบนี้ <span>${rows.length} รายการ</span></summary><div class="payroll-adjustment-list">${rows.map(a=>`<div><span><strong>${escapeHtml(a.nickname||a.first_name||'')}</strong><small>${escapeHtml(label[a.category]||a.category)}${a.note?` · ${escapeHtml(a.note)}`:''}${a.source_key?` · Grid`:''}</small></span><b class="${a.category==='tax_reduce'?'tax-minus':a.adjustment_type==='deduction'||a.category==='tax_add'?'tax-plus':''}">${a.category==='tax_reduce'?'−':a.adjustment_type==='deduction'||a.category==='tax_add'?'−':'+'}${money(a.amount)}</b>${editable?`<button class="text-btn danger" onclick="window.deletePayrollAdjustment(${a.id},${detail.period.id})">ลบ</button>`:''}</div>`).join('')}</div></details>`;
}
function payrollCycleDateForKey(periodKey,monthOffset=0,day=1){const [year,month]=String(periodKey||'').split('-').map(Number);if(!year||!month)return'';const anchor=new Date(year,month-1+Number(monthOffset||0),1);const y=anchor.getFullYear(),m=anchor.getMonth();const last=new Date(y,m+1,0).getDate();const requested=Number(day||0);const d=requested<=0?last:Math.min(last,Math.max(1,requested));return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;}
function payrollRangeDays(start,end){if(!start||!end)return 0;const a=new Date(`${start}T12:00:00`),b=new Date(`${end}T12:00:00`);return Math.max(0,Math.floor((b-a)/86400000)+1);}
function updatePayrollCycleSettingsPreview(){const key=localDateKey(new Date()).slice(0,7),start=payrollCycleDateForKey(key,Number($('#payrollCycleStartOffset')?.value||0),Number($('#payrollCycleStartDay')?.value||1)),end=payrollCycleDateForKey(key,Number($('#payrollCycleEndOffset')?.value||0),Number($('#payrollCycleEndDay')?.value||0));const el=$('#payrollCycleSettingsPreview');if(el)el.textContent=start&&end?`ตัวอย่าง: ${formatDate(start)} → ${formatDate(end)} · ${payrollRangeDays(start,end)} วัน`:'กำหนดวันเริ่มและสิ้นสุดรอบ';}
window.applyPayrollCyclePreset=type=>{if(type==='25-25'){$('#payrollCycleStartOffset').value='-1';$('#payrollCycleStartDay').value=25;$('#payrollCycleEndOffset').value='0';$('#payrollCycleEndDay').value=25;}else if(type==='26-25'){$('#payrollCycleStartOffset').value='-1';$('#payrollCycleStartDay').value=26;$('#payrollCycleEndOffset').value='0';$('#payrollCycleEndDay').value=25;}else{$('#payrollCycleStartOffset').value='0';$('#payrollCycleStartDay').value=1;$('#payrollCycleEndOffset').value='0';$('#payrollCycleEndDay').value=0;}updatePayrollCycleSettingsPreview();};
function syncPayrollPeriodRangeFromMonth(){const key=$('#payrollPeriodKey')?.value;if(!key)return;const s=state.payroll?.settings||{};$('#payrollPeriodStart').value=payrollCycleDateForKey(key,Number(s.cycle_start_month_offset??0),Number(s.cycle_start_day??1));$('#payrollPeriodEnd').value=payrollCycleDateForKey(key,Number(s.cycle_end_month_offset??0),Number(s.cycle_end_day??0));setPayrollPayDateFromMonth();updatePayrollPeriodRangePreview();}
function updatePayrollPeriodRangePreview(){const start=$('#payrollPeriodStart')?.value,end=$('#payrollPeriodEnd')?.value,preview=$('#payrollPeriodRangePreview');if(!preview)return;const days=payrollRangeDays(start,end);preview.innerHTML=`<strong>ช่วงรอบเงินเดือน</strong><span>${start&&end?`${formatDate(start)} → ${formatDate(end)} · ${days} วัน`:'กรุณาระบุวันที่เริ่มและสิ้นสุด'}</span><small>Attendance / Leave / Prorate จะอิงช่วงวันที่นี้จริง</small>`;}
function openPayrollSettingsModal(){const s=state.payroll?.settings||{};$('#payrollPayDay').value=s.pay_day||28;$('#payrollDailyDivisor').value=s.daily_rate_divisor||30;$('#payrollSsoEnabled').checked=Boolean(Number(s.social_security_enabled??1));$('#payrollEmployerSsoEnabled').checked=Boolean(Number(s.employer_social_security_enabled??1));$('#payrollTaxEnabled').checked=Boolean(Number(s.tax_enabled??1));$('#payrollAutoPayslip').checked=Boolean(Number(s.auto_payslip_on_lock??1));$('#payrollAbsenceDeduction').checked=Boolean(Number(s.absence_deduction_enabled||0));$('#payrollLateDeduction').checked=Boolean(Number(s.late_deduction_enabled||0));$('#payrollLatePerMinute').value=s.late_deduction_per_minute||0;$('#payrollAttendanceCutoff').value=s.attendance_cutoff_day||25;$('#payrollCommissionCutoff').value=s.commission_cutoff_day||25;$('#payrollVarianceWarning').value=s.variance_warning_pct||30;$('#payrollSeparateApprover').checked=Boolean(Number(s.require_separate_approver||0));$('#payrollCycleStartDay').value=Number(s.cycle_start_day??1);$('#payrollCycleStartOffset').value=String(Number(s.cycle_start_month_offset??0));$('#payrollCycleEndDay').value=Number(s.cycle_end_day??0);$('#payrollCycleEndOffset').value=String(Number(s.cycle_end_month_offset??0));['payrollCycleStartDay','payrollCycleStartOffset','payrollCycleEndDay','payrollCycleEndOffset'].forEach(id=>{const el=$(`#${id}`);if(el)el.oninput=updatePayrollCycleSettingsPreview;});updatePayrollCycleSettingsPreview();$('#payrollSettingsModal').showModal();}
async function savePayrollSettings(){const button=$('#payrollSettingsSaveBtn');button.disabled=true;try{await api('/api/payroll/settings',{method:'PATCH',body:JSON.stringify({pay_day:Number($('#payrollPayDay').value),daily_rate_divisor:Number($('#payrollDailyDivisor').value),social_security_enabled:$('#payrollSsoEnabled').checked,employer_social_security_enabled:$('#payrollEmployerSsoEnabled').checked,tax_enabled:$('#payrollTaxEnabled').checked,auto_payslip_on_lock:$('#payrollAutoPayslip').checked,absence_deduction_enabled:$('#payrollAbsenceDeduction').checked,late_deduction_enabled:$('#payrollLateDeduction').checked,late_deduction_per_minute:Number($('#payrollLatePerMinute').value||0),attendance_cutoff_day:Number($('#payrollAttendanceCutoff').value||25),commission_cutoff_day:Number($('#payrollCommissionCutoff').value||25),variance_warning_pct:Number($('#payrollVarianceWarning').value||30),require_separate_approver:$('#payrollSeparateApprover').checked,cycle_start_day:Number($('#payrollCycleStartDay').value||1),cycle_start_month_offset:Number($('#payrollCycleStartOffset').value||0),cycle_end_day:Number($('#payrollCycleEndDay').value||0),cycle_end_month_offset:Number($('#payrollCycleEndOffset').value||0)})});$('#payrollSettingsModal').close();await refreshPayroll();if(state.activePayrollPeriodId)await loadPayrollPeriod(state.activePayrollPeriodId);toast('บันทึกรอบ Payroll ของบริษัทแล้ว');}catch(e){toast(e.message,true)}finally{button.disabled=false;}}
function configurePayrollPeriodModal(mode='create'){const editing=mode==='edit';if($('#payrollPeriodModalKicker'))$('#payrollPeriodModalKicker').textContent=editing?'EDIT PAY PERIOD':'NEW PAY PERIOD';if($('#payrollPeriodModalTitle'))$('#payrollPeriodModalTitle').textContent=editing?'แก้ไขรอบเงินเดือน':'สร้างรอบเงินเดือน';if($('#payrollPeriodModalDescription'))$('#payrollPeriodModalDescription').textContent=editing?'แก้เดือน รอบคิด และวันที่จ่ายได้ก่อน Lock ระบบจะคำนวณ Payroll ใหม่หลังบันทึก':'ระบบจะใช้รอบ Default ของบริษัท และ HR สามารถแก้ช่วงวันที่เฉพาะรอบนี้ได้';if($('#payrollPeriodCreateBtn'))$('#payrollPeriodCreateBtn').textContent=editing?'บันทึกและคำนวณใหม่':'สร้างและคำนวณ Preview';}
function bindPayrollPeriodModalDates(){if($('#payrollPeriodKey'))$('#payrollPeriodKey').onchange=syncPayrollPeriodRangeFromMonth;if($('#payrollPeriodStart'))$('#payrollPeriodStart').onchange=()=>{updatePayrollPeriodRangePreview();syncPayrollPayDateFromPeriodEnd();};if($('#payrollPeriodEnd'))$('#payrollPeriodEnd').onchange=()=>{updatePayrollPeriodRangePreview();syncPayrollPayDateFromPeriodEnd();};}
function openPayrollPeriodModal(){const now=new Date();const key=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;$('#payrollPeriodEditId').value='';configurePayrollPeriodModal('create');$('#payrollPeriodKey').value=key;syncPayrollPeriodRangeFromMonth();bindPayrollPeriodModalDates();$('#payrollPeriodModal').showModal();}
window.editPayrollPeriod=id=>{const period=(state.payrollDetail?.period&&Number(state.payrollDetail.period.id)===Number(id))?state.payrollDetail.period:(state.payroll?.periods||[]).find(x=>Number(x.id)===Number(id));if(!period){toast('ไม่พบรอบเงินเดือน',true);return;}if(!['draft','review'].includes(String(period.status||''))){toast('แก้ไขได้เฉพาะรอบ Draft หรือรอตรวจ',true);return;}$('#payrollPeriodEditId').value=String(id);configurePayrollPeriodModal('edit');$('#payrollPeriodKey').value=period.period_key||'';$('#payrollPayDate').value=period.pay_date||'';$('#payrollPeriodStart').value=period.period_start||'';$('#payrollPeriodEnd').value=period.period_end||'';bindPayrollPeriodModalDates();updatePayrollPeriodRangePreview();$('#payrollPeriodModal').showModal();};
function syncPayrollPayDateFromPeriodEnd(){const end=$('#payrollPeriodEnd')?.value;if(!end)return;const [y,m]=end.split('-').map(Number);if(!y||!m)return;const last=new Date(y,m,0).getDate();const day=Math.min(last,Math.max(1,Number(state.payroll?.settings?.pay_day||28)));$('#payrollPayDate').value=`${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;}
function setPayrollPayDateFromMonth(){syncPayrollPayDateFromPeriodEnd();}
async function createPayrollPeriod(retryOptions={}){const button=$('#payrollPeriodCreateBtn');const editId=Number($('#payrollPeriodEditId')?.value||0);const editing=editId>0;button.disabled=true;button.textContent=editing?'กำลังบันทึกและคำนวณ…':'กำลังคำนวณ…';const start=$('#payrollPeriodStart').value,end=$('#payrollPeriodEnd').value,periodKey=$('#payrollPeriodKey').value,payDate=$('#payrollPayDate').value;try{if(!start||!end)throw new Error('กรุณาระบุวันที่เริ่มและสิ้นสุดรอบเงินเดือน');if(start>end)throw new Error('วันที่เริ่มรอบต้องไม่เกินวันที่สิ้นสุดรอบ');const payload={period_key:periodKey,period_start:start,period_end:end,pay_date:payDate};if(!editing){payload.replace_existing_draft=Boolean(retryOptions.replaceExisting);payload.replace_overlapping_draft=Boolean(retryOptions.replaceOverlap);}const result=await api(editing?`/api/payroll/periods/${editId}`:'/api/payroll/periods',{method:editing?'PATCH':'POST',timeoutMs:45000,body:JSON.stringify(payload)});$('#payrollPeriodModal').close();$('#payrollPeriodEditId').value='';state.activePayrollPeriodId=Number(result.id||editId);await refreshPayroll();await loadPayrollPeriod(Number(result.id||editId));toast(editing?`แก้ไขรอบ ${formatDate(start)} → ${formatDate(end)} แล้ว`:`${result.reused?'ปรับรอบ Payroll เดิม':'สร้าง Payroll Preview'} ${formatDate(start)} → ${formatDate(end)} แล้ว`);}catch(e){const data=e?.data||{};if(!editing&&data.code==='PAYROLL_PERIOD_EXISTS_DRAFT'&&data.can_replace&&!retryOptions.replaceExisting){const x=data.existing||{};const ok=confirm(`มีรอบ ${periodKey} อยู่แล้ว ${x.period_start||''} → ${x.period_end||''}

ต้องการปรับรอบเดิมให้เป็น ${start} → ${end} แล้วคำนวณใหม่หรือไม่?`);if(ok){button.disabled=false;configurePayrollPeriodModal('create');return createPayrollPeriod({...retryOptions,replaceExisting:true});}}else if(!editing&&data.code==='PAYROLL_PERIOD_OVERLAP'&&data.can_replace&&!retryOptions.replaceOverlap){const x=data.overlap||{};const ok=confirm(`ช่วงวันที่นี้ทับกับ Draft รอบ ${x.period_key||''} (${x.period_start||''} → ${x.period_end||''})

หากนี่เป็นรอบทดลอง/รอบเก่าก่อนเปลี่ยน Cycle ระบบสามารถยกเลิกรอบเดิมแล้วสร้างรอบใหม่ให้ได้ ต้องการทำต่อหรือไม่?`);if(ok){button.disabled=false;configurePayrollPeriodModal('create');return createPayrollPeriod({...retryOptions,replaceOverlap:true});}}toast(e.message,true);}finally{button.disabled=false;configurePayrollPeriodModal(editing?'edit':'create');}}
window.deletePayrollPeriod=async id=>{const period=(state.payrollDetail?.period&&Number(state.payrollDetail.period.id)===Number(id))?state.payrollDetail.period:(state.payroll?.periods||[]).find(x=>Number(x.id)===Number(id));if(!period){toast('ไม่พบรอบเงินเดือน',true);return;}if(!['draft','review'].includes(String(period.status||''))){toast('ลบได้เฉพาะรอบ Draft หรือรอตรวจเท่านั้น',true);return;}const ok=confirm(`ลบรอบเงินเดือน ${period.period_key}
${formatDate(period.period_start)} → ${formatDate(period.period_end)}

รายการคำนวณและรายการปรับของรอบนี้จะถูกลบ และสามารถสร้างรอบใหม่ได้ทันที ต้องการลบหรือไม่?`);if(!ok)return;try{await api(`/api/payroll/periods/${Number(id)}`,{method:'DELETE',timeoutMs:30000,body:'{}'});if(Number(state.activePayrollPeriodId)===Number(id)){state.activePayrollPeriodId=null;state.payrollDetail=null;}await refreshPayroll();toast(`ลบรอบ ${period.period_key} แล้ว · สามารถสร้างใหม่ได้`);}catch(e){toast(e.message,true);}};
window.openPayrollProfile=async id=>{try{const result=await api(`/api/employees/${id}/payroll-profile`);const p=result.profile||{},e=result.employee;$('#payrollProfileEmployeeId').value=id;$('#payrollProfileTitle').textContent=`เงินเดือน · ${e.nickname||e.first_name}`;$('#payrollBaseSalary').value=p.base_salary??0;$('#payrollEffectiveFrom').value=p.effective_from||localDateKey(new Date());$('#employeeSsoEnabled').checked=p.social_security_enabled==null?true:Boolean(Number(p.social_security_enabled));$('#employeeTaxEnabled').checked=p.tax_enabled==null?true:Boolean(Number(p.tax_enabled));$('#employeePersonalAllowance').value=p.personal_allowance??60000;$('#employeeExtraDeductions').value=p.extra_annual_deductions??0;$('#employeeTaxOverride').value=p.monthly_tax_override??'';$('#employeeBankName').value=p.bank_name||'';$('#employeeBankAccountName').value=p.bank_account_name||'';$('#employeeBankAccountNo').value=p.bank_account_no||'';$('#employeePayrollNote').value=p.payroll_note||'';const current=new Map((result.components||[]).map(x=>[Number(x.component_id),Number(x.amount||0)]));$('#payrollRecurringComponents').innerHTML=(result.component_definitions||[]).map(d=>`<label class="payroll-component-input"><span>${escapeHtml(d.name)}<small>${d.component_type==='deduction'?'รายการหักประจำ':'รายได้ประจำ'} · ${Number(d.taxable)?'ภาษี':''}${Number(d.sso_contributable)?' · SSO':''}</small></span><input type="number" min="0" step="0.01" data-payroll-component-id="${Number(d.id)}" value="${current.get(Number(d.id))||''}" placeholder="0" /></label>`).join('')||'<small>ยังไม่มีรายการประจำ</small>';$('#payrollProfileModal').showModal();}catch(e){toast(e.message,true)}};
async function savePayrollProfile(){const id=Number($('#payrollProfileEmployeeId').value);const button=$('#payrollProfileSaveBtn');button.disabled=true;try{const recurring_components=$$('#payrollRecurringComponents [data-payroll-component-id]').map(i=>({component_id:Number(i.dataset.payrollComponentId),amount:Number(i.value||0)}));await api(`/api/employees/${id}/payroll-profile`,{method:'PUT',body:JSON.stringify({base_salary:Number($('#payrollBaseSalary').value||0),effective_from:$('#payrollEffectiveFrom').value,social_security_enabled:$('#employeeSsoEnabled').checked,tax_enabled:$('#employeeTaxEnabled').checked,personal_allowance:Number($('#employeePersonalAllowance').value||0),extra_annual_deductions:Number($('#employeeExtraDeductions').value||0),monthly_tax_override:$('#employeeTaxOverride').value,bank_name:$('#employeeBankName').value.trim(),bank_account_name:$('#employeeBankAccountName').value.trim(),bank_account_no:$('#employeeBankAccountNo').value.trim(),payroll_note:$('#employeePayrollNote').value.trim(),recurring_components})});$('#payrollProfileModal').close();await refreshPayroll();if(state.activePayrollPeriodId&&['draft','review'].includes(state.payrollDetail?.period?.status)){await api(`/api/payroll/periods/${state.activePayrollPeriodId}/recalculate`,{method:'POST',body:'{}'});await loadPayrollPeriod(state.activePayrollPeriodId);}toast('บันทึกข้อมูลเงินเดือนแล้ว');}catch(e){toast(e.message,true)}finally{button.disabled=false;}}
window.openPayrollAdjustment=(periodId,employeeId=null)=>{const detail=state.payrollDetail;if(!detail?.items?.length)return toast('ยังไม่มีพนักงานในรอบนี้',true);$('#payrollAdjustmentPeriodId').value=periodId;$('#payrollAdjustmentEmployee').innerHTML=detail.items.map(i=>`<option value="${i.employee_id}" ${Number(employeeId)===Number(i.employee_id)?'selected':''}>${escapeHtml(i.nickname||i.first_name)} · ${escapeHtml(i.employee_code)}</option>`).join('');$('#payrollAdjustmentType').value='earning';$('#payrollAdjustmentCategory').value='commission';$('#payrollAdjustmentAmount').value='';$('#payrollAdjustmentNote').value='';$('#payrollAdjustmentTaxable').checked=true;$('#payrollAdjustmentSso').checked=false;syncPayrollAdjustmentMode();$('#payrollAdjustmentModal').showModal();};
function syncPayrollAdjustmentMode(){const cat=$('#payrollAdjustmentCategory').value;const tax=['tax_add','tax_reduce'].includes(cat);if(cat==='other_deduction')$('#payrollAdjustmentType').value='deduction';if(cat==='tax_add')$('#payrollAdjustmentType').value='deduction';if(cat==='tax_reduce')$('#payrollAdjustmentType').value='earning';$('#payrollAdjustmentType').disabled=tax||cat==='other_deduction';$('#payrollAdjustmentTaxable').closest('label').classList.toggle('hidden',tax||cat==='other_deduction');$('#payrollAdjustmentSso').closest('label').classList.toggle('hidden',tax||cat==='other_deduction');if(tax||cat==='other_deduction'){$('#payrollAdjustmentTaxable').checked=false;$('#payrollAdjustmentSso').checked=false;}}
function syncPayrollAdjustmentCategory(){const cat=$('#payrollAdjustmentCategory').value;if($('#payrollAdjustmentType').value==='deduction'&&!['tax_add','tax_reduce','other_deduction'].includes(cat))$('#payrollAdjustmentCategory').value='other_deduction';if($('#payrollAdjustmentType').value==='earning'&&$('#payrollAdjustmentCategory').value==='other_deduction')$('#payrollAdjustmentCategory').value='commission';syncPayrollAdjustmentMode();}
async function savePayrollAdjustment(){const periodId=Number($('#payrollAdjustmentPeriodId').value);const button=$('#payrollAdjustmentSaveBtn');button.disabled=true;try{await api(`/api/payroll/periods/${periodId}/adjustments`,{method:'POST',body:JSON.stringify({employee_id:Number($('#payrollAdjustmentEmployee').value),adjustment_type:$('#payrollAdjustmentType').value,category:$('#payrollAdjustmentCategory').value,amount:Number($('#payrollAdjustmentAmount').value||0),note:$('#payrollAdjustmentNote').value.trim(),taxable:$('#payrollAdjustmentTaxable').checked,sso_contributable:$('#payrollAdjustmentSso').checked})});$('#payrollAdjustmentModal').close();await loadPayrollPeriod(periodId);await refreshPayroll(false);toast('เพิ่มรายการและคำนวณใหม่แล้ว');}catch(e){toast(e.message,true)}finally{button.disabled=false;}}
window.deletePayrollAdjustment=async(id,periodId)=>{if(!confirm('ลบรายการปรับนี้ใช่ไหม? ระบบจะคำนวณ Payroll ใหม่ทันที'))return;try{await api(`/api/payroll/adjustments/${Number(id)}`,{method:'DELETE'});await loadPayrollPeriod(Number(periodId));await refreshPayroll(false);toast('ลบรายการและคำนวณใหม่แล้ว');}catch(e){toast(e.message,true)}};
window.savePayrollGridCell=async(periodId,employeeId,category,input)=>{const value=Math.max(0,Number(input.value||0));input.disabled=true;input.classList.add('saving');try{const result=await api(`/api/payroll/periods/${periodId}/cell`,{method:'PUT',body:JSON.stringify({employee_id:employeeId,category,amount:value}),timeoutMs:30000,silentStatus:true});state.payrollDetail=result;renderPayrollDetail();await refreshPayroll(false);toast('คำนวณใหม่แล้ว');}catch(e){input.disabled=false;input.classList.remove('saving');toast(e.message,true)}};
window.filterPayrollGrid=query=>{const q=String(query||'').trim().toLowerCase();$$('[data-payroll-search]').forEach(tr=>tr.classList.toggle('hidden',q&&!String(tr.dataset.payrollSearch||'').includes(q)));};
window.openPayrollEmployeeDetail=employeeId=>{const item=(state.payrollDetail?.items||[]).find(x=>Number(x.employee_id)===Number(employeeId));if(!item)return;const bd=payrollBreakdown(item),rec=bd.recurring_components||[],adjs=(state.payrollDetail?.adjustments||[]).filter(x=>Number(x.employee_id)===Number(employeeId));const a=payrollAdjustmentMaps(state.payrollDetail).get(Number(employeeId))||{};$('#payrollEmployeeDetailTitle').textContent=`${item.nickname||item.first_name||''} ${item.last_name||''}`.trim();$('#payrollEmployeeDetailBody').innerHTML=`<div class="payroll-employee-kpis"><div><span>รายได้รวม</span><strong>${money(item.gross_income)}</strong></div><div><span>รับสุทธิ</span><strong>${money(item.net_pay)}</strong></div><div><span>YTD รายได้</span><strong>${money(item.ytd_gross)}</strong></div><div><span>YTD ภาษี</span><strong>${money(item.ytd_tax)}</strong></div></div><section class="payroll-source-card"><h4>ที่มาของตัวเลขรอบนี้</h4><div class="payroll-source-list"><div><span>ฐานเงินเดือน / Prorate</span><strong>${money(item.prorated_salary)}</strong><small>ฐาน ${money(item.base_salary)}</small></div>${Number(a.commission||0)?`<div><span>Commission</span><strong>+${money(a.commission)}</strong></div>`:''}${Number(a.kpi||0)?`<div><span>KPI</span><strong>+${money(a.kpi)}</strong></div>`:''}${Number(a.incentive||0)?`<div><span>Incentive</span><strong>+${money(a.incentive)}</strong></div>`:''}${Number(a.bonus||0)?`<div><span>Bonus</span><strong>+${money(a.bonus)}</strong></div>`:''}${rec.map(x=>`<div><span>${escapeHtml(x.name)}</span><strong>+${money(x.amount)}</strong><small>รายการประจำ</small></div>`).join('')}<div class="deduct"><span>ขาด / สาย</span><strong>-${money(item.attendance_deduction)}</strong><small>${Number(item.absent_days||0)} วัน · ${Number(item.late_minutes||0)} นาที</small></div><div class="deduct"><span>ประกันสังคม</span><strong>-${money(item.social_security)}</strong></div><div class="deduct"><span>ภาษีหัก ณ ที่จ่าย</span><strong>-${money(item.withholding_tax)}</strong><small>${escapeHtml(bd.tax_rule||'Tax Profile + YTD')}</small></div></div></section>${adjs.length?`<section class="payroll-source-card"><h4>รายการที่ HR ปรับในรอบนี้</h4><div class="payroll-source-list">${adjs.map(x=>`<div><span>${escapeHtml(x.category||x.adjustment_type||'รายการ')}</span><strong>${x.adjustment_type==='deduction'?'-':'+'}${money(x.amount)}</strong><small>${escapeHtml(x.note||'ไม่มีหมายเหตุ')}</small></div>`).join('')}</div></section>`:''}<div class="payroll-employee-detail-grid"><section><h4>ภาษี / ประกันสังคม</h4><p>ภาษีรอบนี้ <b>${money(item.withholding_tax)}</b></p><p>ประกันสังคมพนักงาน <b>${money(item.social_security)}</b></p><p>ประกันสังคมบริษัท <b>${money(item.employer_social_security)}</b></p></section><section><h4>การจ่ายเงิน</h4><p>ธนาคาร <b>${escapeHtml(item.bank_name||'ยังไม่ระบุ')}</b></p><p>เลขบัญชี <b>${escapeHtml(item.bank_account_no||'ยังไม่ระบุ')}</b></p><p>เทียบรอบก่อน ${payrollVarianceBadge(item)}</p></section></div>`;$('#payrollEmployeeDetailModal').showModal();};
window.openPayrollBulkAdjustment=periodId=>{const items=state.payrollDetail?.items||[];$('#payrollBulkPeriodId').value=periodId;$('#payrollBulkEmployees').innerHTML=items.map(x=>`<label><input type="checkbox" value="${Number(x.employee_id)}"><span>${escapeHtml(x.nickname||x.first_name)} · ${escapeHtml(x.employee_code||'')}</span></label>`).join('');$('#payrollBulkAmount').value='';$('#payrollBulkNote').value='';$('#payrollBulkAdjustmentModal').showModal();};
async function savePayrollBulkAdjustment(){const periodId=Number($('#payrollBulkPeriodId').value),ids=$$('#payrollBulkEmployees input:checked').map(x=>Number(x.value));const button=$('#payrollBulkSaveBtn');button.disabled=true;try{const category=$('#payrollBulkCategory').value,type=['other_deduction'].includes(category)?'deduction':'earning';await api(`/api/payroll/periods/${periodId}/bulk-adjustment`,{method:'POST',body:JSON.stringify({employee_ids:ids,adjustment_type:type,category,amount:Number($('#payrollBulkAmount').value||0),note:$('#payrollBulkNote').value.trim(),taxable:type==='earning',sso_contributable:false})});$('#payrollBulkAdjustmentModal').close();await loadPayrollPeriod(periodId);await refreshPayroll(false);toast(`เพิ่มรายการให้ ${ids.length} คนแล้ว`);}catch(e){toast(e.message,true)}finally{button.disabled=false;}};
window.openPayrollComponentsModal=()=>{const rows=state.payroll?.components||[];$('#payrollComponentList').innerHTML=rows.length?rows.map(x=>`<article><span><strong>${escapeHtml(x.name)}</strong><small>${x.component_type==='deduction'?'หัก':'เพิ่ม'} · ${Number(x.taxable)?'ภาษี':'ไม่เสียภาษี'} · ${Number(x.sso_contributable)?'เข้า SSO':'ไม่เข้า SSO'}</small></span><em>${x.active?'ใช้งาน':'ปิด'}</em></article>`).join(''):'<p class="muted">ยังไม่มีรายการ</p>';$('#payrollComponentName').value='';$('#payrollComponentType').value='earning';$('#payrollComponentTaxable').checked=true;$('#payrollComponentSso').checked=false;$('#payrollComponentsModal').showModal();};
async function savePayrollComponent(){const button=$('#payrollComponentSaveBtn');button.disabled=true;try{await api('/api/payroll/components',{method:'POST',body:JSON.stringify({name:$('#payrollComponentName').value.trim(),component_type:$('#payrollComponentType').value,taxable:$('#payrollComponentTaxable').checked,sso_contributable:$('#payrollComponentSso').checked,recurring_default:true})});$('#payrollComponentsModal').close();await refreshPayroll(false);window.openPayrollComponentsModal();toast('เพิ่มรายการเงินแล้ว');}catch(e){toast(e.message,true)}finally{button.disabled=false;}};
window.recalculatePayroll=async id=>{try{await api(`/api/payroll/periods/${id}/recalculate`,{method:'POST',body:'{}'});await loadPayrollPeriod(id);await refreshPayroll(false);toast('คำนวณ Payroll ใหม่แล้ว');}catch(e){toast(e.message,true)}};
window.reviewPayroll=async id=>{try{const r=await api(`/api/payroll/periods/${id}/review`,{method:'POST',body:'{}'});await refreshPayroll();await loadPayrollPeriod(id);toast(r.approval_status==='pending'?'ส่งให้ Checker อนุมัติแล้ว':'ตรวจรอบแล้ว พร้อม Lock');}catch(e){toast(e.message,true)}};
window.approvePayroll=async id=>{try{await api(`/api/payroll/periods/${id}/approve`,{method:'POST',body:'{}'});await refreshPayroll();await loadPayrollPeriod(id);toast('อนุมัติ Payroll แล้ว');}catch(e){toast(e.message,true)}};
window.lockPayroll=async(id,confirmed=false)=>{if(!confirmed&&!confirm('ปิดการแก้ไขรอบนี้แล้วจะเปลี่ยนตัวเลขไม่ได้ ต้องการทำต่อใช่ไหม?'))return;try{const r=await api(`/api/payroll/periods/${id}/lock`,{method:'POST',body:'{}'});await refreshPayroll();await loadPayrollPeriod(id);toast(r.warning||(r.payslip_queued?'Lock แล้ว · กำลังสร้าง Payslip อัตโนมัติ':'Lock Payroll แล้ว'));if(r.payslip_queued)setTimeout(()=>loadPayrollPeriod(id),2500);}catch(e){toast(e.message,true)}};
window.unlockPayroll=async id=>{const reason=prompt('เหตุผลการปลด Lock (ต้องบันทึก Audit Trail)');if(reason===null)return;try{await api(`/api/payroll/periods/${id}/unlock`,{method:'POST',body:JSON.stringify({reason})});await refreshPayroll();await loadPayrollPeriod(id);toast('ปลด Lock แล้ว · รอบกลับไปรอตรวจ');}catch(e){toast(e.message,true)}};
window.exportPayroll=(id,type)=>{window.open(`/api/payroll/periods/${Number(id)}/export/${type==='accounting'?'accounting':'bank'}.csv`,'_blank','noopener');};
window.publishPayroll=async id=>{if(!confirm('Publish แล้วระบบจะสร้าง PDF ลง Google Drive และแจ้งพนักงานทาง Mail/LINE ต้องการทำต่อไหม?'))return;try{const r=await api(`/api/payroll/periods/${id}/publish`,{method:'POST',body:'{}'});await refreshPayroll();await loadPayrollPeriod(id);toast(r.message||'เริ่ม Publish Payslip แล้ว');setTimeout(()=>refreshDocuments(),2500);}catch(e){toast(e.message,true)}};

async function refreshPayroll(render=true){const role=String(activeCompanyRole()||'');if(!['owner','co_owner','hr_admin','hr','payroll_admin'].includes(role))return;state.payroll=await api('/api/payroll/overview');if(render)renderPayroll();}

function renderDocuments(){
  const canHr=['owner','co_owner','hr_admin','hr','payroll_admin'].includes(String(activeCompanyRole()||''));
  $('#generateDocumentBtn').classList.toggle('hidden',!canHr);
  const d=state.documents||{data:[],payslips:[]},sys=state.documentSystem||{}; const pays=d.payslips||[],docs=d.data||[],sum=sys.summary||{};
  const computed={
    total:docs.length,
    drafts:docs.filter(x=>String(x.workflow_status||'')==='draft').length,
    pending_approvals:docs.filter(x=>String(x.approval_status||'')==='pending').length,
    pending_employee_signatures:docs.filter(x=>String(x.workflow_status||'')==='awaiting_employee_signature').length
  };
  const summary={
    total:Math.max(Number(sum.total||0),computed.total),
    drafts:Math.max(Number(sum.drafts||0),computed.drafts),
    pending_approvals:Math.max(Number(sum.pending_approvals||0),computed.pending_approvals),
    pending_employee_signatures:Math.max(Number(sum.pending_employee_signatures||0),computed.pending_employee_signatures)
  };
  const lineCount=pays.filter(x=>x.line_notified_at).length+docs.filter(x=>x.line_sent_at).length;
  $('#documentSummary').innerHTML=`<div><span>เอกสารทั้งหมด</span><strong>${summary.total}</strong></div><div><span>Draft</span><strong>${summary.drafts}</strong></div><div><span>รอ HR เซ็น</span><strong>${summary.pending_approvals}</strong></div><div><span>รอพนักงานเซ็น</span><strong>${summary.pending_employee_signatures}</strong></div><div><span>Payslip</span><strong>${pays.length}</strong></div><div><span>แจ้ง LINE</span><strong>${lineCount}</strong></div>`;

  const apiApprovals=sys.pending_approvals||[];
  const approvalIds=new Set(apiApprovals.map(x=>Number(x.document_id)));
  const fallbackApprovals=docs.filter(x=>String(x.approval_status||'')==='pending'&&!approvalIds.has(Number(x.id))).map(x=>({...x,document_id:Number(x.id)}));
  const approvals=[...apiApprovals,...fallbackApprovals],expiring=sys.expiring||[];
  $('#documentActionList').innerHTML=(approvals.length||expiring.length)?[
    ...approvals.map(x=>`<article class="document-row"><div class="document-file-icon">SIGN</div><div><strong>${escapeHtml(x.title)}</strong><p>${escapeHtml(x.nickname||x.first_name||'')} · ${escapeHtml(x.document_number||'')}</p><small>รอ HR ตรวจข้อมูลและลงลายเซ็น</small></div><div class="document-row-actions"><button class="secondary-btn" onclick="window.rejectDocumentWorkflow(${Number(x.document_id)},this)">ส่งกลับ</button><button class="primary-btn" onclick="window.openDocumentHrSignModal(${Number(x.document_id)})">ตรวจและลงนาม</button></div></article>`),
    ...expiring.map(x=>`<article class="document-row"><div class="document-file-icon">!</div><div><strong>${escapeHtml(x.title)}</strong><p>${escapeHtml(x.nickname||x.first_name||'')}</p><small>หมดอายุ ${formatDate(x.expires_at)}</small></div></article>`)
  ].join(''):emptyState('ไม่มีงานค้าง','เอกสารที่รอ HR ลงนามหรือใกล้หมดอายุจะแสดงที่นี่');

  const templates=sys.templates||[];
  const templateRows=templates.length?templates:standardDocumentCatalog.map(t=>({...t,automation_mode:'assisted',approval_required:1,acknowledgement_required:['EMP_CERT','SAL_CERT','PROB_PASS','SAL_ADJ','ACK_NOTICE','WARNING'].includes(t.code)}));
  $('#documentTemplateList').innerHTML=templateRows.map(t=>`<article class="document-row"><div class="document-file-icon">T</div><div><strong>${escapeHtml(t.name)}</strong><p>${escapeHtml(t.code)} · ${escapeHtml(t.automation_mode||'assisted')}</p><small>${t.approval_required?'HR ต้องตรวจและลงนาม':'ไม่ต้อง HR อนุมัติ'}${t.acknowledgement_required?' · พนักงานต้องลงนาม':''}${templates.length?'':' · มาตรฐาน Nakna'}</small></div></article>`).join('');

  $('#payslipDocumentList').innerHTML=pays.length?pays.map(p=>{const share=p.share_token_value?`${location.origin}/payslip/${p.share_token_value}`:p.drive_url;return `<article class="document-row"><div class="document-file-icon">PDF</div><div><strong>${escapeHtml(p.nickname||p.first_name)} · ${escapeHtml(p.period_key)}</strong><p>${escapeHtml(p.file_name)}</p><small>${p.email_sent_at?'✓ Email ':''}${p.line_notified_at?'✓ LINE ':''}· ${formatDateTime(p.created_at)}</small></div>${share?`<a class="secondary-btn" href="${escapeHtml(share)}" target="_blank" rel="noopener">เปิด</a>`:''}</article>`}).join(''):emptyState('ยังไม่มี Payslip','เมื่อ Lock และ Publish Payroll เอกสารจะมาอยู่ตรงนี้อัตโนมัติ');

  $('#employeeDocumentList').innerHTML=docs.length?docs.map(x=>{
    const workflow=String(x.workflow_status||'final');
    const awaiting=workflow==='awaiting_employee_signature';
    const final=workflow==='final';
    const employeeVisible=String(x.visibility||'')==='employee';
    const fullySigned=String(x.employee_signature_status||'')==='signed'||Boolean(x.final_signed_url);
    let statusText='Draft';
    let statusClass='';
    if(String(x.approval_status||'')==='pending'){statusText='รอ HR ตรวจและลงนาม';statusClass='hr';}
    else if(awaiting){statusText='HR ลงนามแล้ว · รอพนักงานเซ็น';statusClass='wait';}
    else if(final&&fullySigned){statusText='Final · ลงนามครบ 2 ฝ่าย';statusClass='done';}
    else if(final){statusText='Final · HR ลงนามแล้ว';statusClass='done';}

    let delivery='';
    if((awaiting||final)&&employeeVisible){
      if(x.employee_viewed_at)delivery='พนักงานเปิดแล้ว';
      else if(x.line_sent_at)delivery='ส่ง LINE แล้ว';
      else if(!x.line_user_id)delivery='ยังไม่เชื่อม LINE';
      else if(x.delivery_failed_at)delivery='LINE ส่งไม่สำเร็จ';
      else delivery='ยังไม่ส่ง LINE';
    }

    let sendBtn='';
    if((awaiting||final)&&employeeVisible){
      const label=awaiting?(x.line_sent_at?'เตือนให้เซ็น':'ส่งให้เซ็น'):(fullySigned?'ส่ง Final อีกครั้ง':(x.line_sent_at?'ส่งอีกครั้ง':'ส่งให้พนักงาน'));
      sendBtn=`<button class="secondary-btn" type="button" onclick="window.sendEmployeeDocument(${Number(x.id)},this)">${label}</button>`;
    }
    const pdfUrl=x.final_signed_url||x.drive_url||'';
    const pdfLabel=x.final_signed_url?'Final PDF':awaiting?'PDF ที่ HR เซ็น':'PDF';
    return `<article class="document-row"><div class="document-file-icon">${pdfUrl?'PDF':'DOC'}</div><div><strong>${escapeHtml(x.title)} <span class="document-status-pill ${statusClass}">${escapeHtml(statusText)}</span></strong><p>${escapeHtml(x.nickname||x.first_name||'เอกสารบริษัท')} · ${escapeHtml(x.document_number||'')} · ${formatDate(x.document_date||x.created_at)}</p><small>${escapeHtml(x.document_type)} · v${Number(x.version||1)}${x.hr_signed_at?` · HR เซ็น ${escapeHtml(formatDateTime(x.hr_signed_at))}`:''}${x.employee_signed_at?` · พนักงานเซ็น ${escapeHtml(formatDateTime(x.employee_signed_at))}`:''}${delivery?` · ${escapeHtml(delivery)}`:''}</small></div><div class="document-row-actions">${pdfUrl?`<a class="secondary-btn" href="${escapeHtml(pdfUrl)}" target="_blank" rel="noopener">${pdfLabel}</a>`:''}${sendBtn}</div></article>`;
  }).join(''):emptyState('ยังไม่มีเอกสาร','สร้างเอกสารจาก Template ได้จากปุ่มด้านบน');

  const acks=sys.pending_acknowledgements||[];
  $('#documentAckList').innerHTML=acks.length?acks.map(x=>`<article class="document-row"><div class="document-file-icon">SIGN</div><div><strong>${escapeHtml(x.title)}</strong><p>${escapeHtml(x.nickname||x.first_name||'')} · ${escapeHtml(x.document_number||'')}</p><small>${x.status==='viewed'?'พนักงานเปิดแล้ว · รอลงลายเซ็น':'ส่งแล้ว · รอลงลายเซ็นพนักงาน'}</small></div></article>`).join(''):emptyState('ไม่มีรายการรอลายเซ็น','เมื่อ HR ลงนามแล้วและส่งให้พนักงาน รายการที่รอลายเซ็นจะแสดงตรงนี้');

  const cases=sys.open_cases||[]; $('#documentCaseList').innerHTML=cases.length?cases.map(x=>`<article class="document-row"><div class="document-file-icon">CASE</div><div><strong>${escapeHtml(x.case_number)} · ${escapeHtml(x.title)}</strong><p>${escapeHtml(x.nickname||x.first_name||'')} · ${escapeHtml(x.case_type)}</p><small>${escapeHtml(x.status)}</small></div></article>`).join(''):emptyState('ไม่มี Case เปิดอยู่','Case ใบเตือนและเหตุการณ์ HR จะอยู่ใน Timeline เดียวกัน');
  const sel=$('#documentTemplate'); if(sel)sel.innerHTML='<option value="">เลือก Template</option>'+templates.map(t=>`<option value="${Number(t.id)}">${escapeHtml(t.name)}</option>`).join('');
}

async function refreshDocuments(options={}){
  let docsError=null,overviewError=null;
  const [docsResult,overviewResult]=await Promise.allSettled([api('/api/documents'),api('/api/document-system/overview')]);
  if(docsResult.status==='fulfilled')state.documents=docsResult.value; else {docsError=docsResult.reason;console.warn('documents load failed',docsError);}
  if(overviewResult.status==='fulfilled')state.documentSystem={...overviewResult.value,overview_ok:true,template_load_error:null};
  else{
    overviewError=overviewResult.reason;console.warn('document overview failed',overviewError);
    let fallbackTemplates=[];
    try{const r=await api('/api/document-templates');fallbackTemplates=r?.data||[];}catch(error){console.warn('template fallback failed',error);}
    state.documentSystem={...(state.documentSystem||{}),templates:fallbackTemplates.length?fallbackTemplates:(state.documentSystem?.templates||[]),overview_ok:false,template_load_error:overviewError?.message||'โหลดศูนย์เอกสารบางส่วนไม่สำเร็จ'};
  }
  renderDocuments();
  if(docsError&&!options.silent)toast(docsError.message||'โหลดรายการเอกสารไม่สำเร็จ',true);
  return {documents_ok:!docsError,overview_ok:!overviewError};
}
async function openDocumentSettings(){
  const dlg=$('#documentSettingsModal'); if(!dlg)return;
  try{
    const r=await api('/api/document-settings'); const d=r?.data||{}; state.documentSettings=d;
    $('#docSignerName').value=d.signer_name||state.me?.user?.name||'';
    $('#docSignerPosition').value=d.signer_position||'ฝ่ายทรัพยากรบุคคล';
    $('#docFooterText').value=d.document_footer||'เอกสารฉบับนี้จัดทำและเก็บประวัติผ่านระบบ Nakna HR';
    $('#docSignatureDataUrl').value=d.signer_signature_data_url||'';
    const preview=$('#docSignaturePreview'); preview.innerHTML=d.signer_signature_data_url?`<img src="${escapeAttr(d.signer_signature_data_url)}" alt="ลายเซ็น HR"><span>ลายเซ็นที่จะใช้ในเอกสาร</span>`:'<span>ยังไม่มีรูปลายเซ็น · ระบบจะแสดงชื่อผู้อนุมัติแทน</span>';
    const logo=$('#docCompanyLogoPreview'); logo.innerHTML=d.logo_data_url?`<img src="${escapeAttr(d.logo_data_url)}" alt="โลโก้บริษัท">`:'<span>ยังไม่มี Logo บริษัท</span>';
    dlg.showModal();
  }catch(e){toast(e.message||'โหลดการตั้งค่าเอกสารไม่สำเร็จ',true);}
}

function bindDocumentSignatureUpload(){
  const input=$('#docSignerSignatureFile'); if(!input||input.dataset.bound)return; input.dataset.bound='1';
  input.addEventListener('change',()=>{const file=input.files?.[0];if(!file)return;if(!/^image\/(png|jpeg)$/.test(file.type))return toast('ลายเซ็นรองรับ PNG หรือ JPG',true);if(file.size>520000)return toast('ไฟล์ลายเซ็นต้องไม่เกินประมาณ 500 KB',true);const reader=new FileReader();reader.onload=()=>{const data=String(reader.result||'');$('#docSignatureDataUrl').value=data;$('#docSignaturePreview').innerHTML=`<img src="${escapeAttr(data)}" alt="ลายเซ็น HR"><span>พร้อมใช้ในเอกสาร</span>`;};reader.readAsDataURL(file);});
  $('#clearDocSignerSignatureBtn')?.addEventListener('click',()=>{$('#docSignatureDataUrl').value='';input.value='';$('#docSignaturePreview').innerHTML='<span>ลบลายเซ็นแล้ว · เอกสารจะแสดงชื่อผู้อนุมัติแทน</span>';});
}

async function saveDocumentSettings(){
  const btn=$('#saveDocumentSettingsBtn'); if(!btn)return; const old=btn.textContent;btn.disabled=true;btn.textContent='กำลังบันทึก…';
  try{await api('/api/document-settings',{method:'PUT',body:JSON.stringify({signer_name:$('#docSignerName').value.trim(),signer_position:$('#docSignerPosition').value.trim(),signer_signature_data_url:$('#docSignatureDataUrl').value,document_footer:$('#docFooterText').value.trim()})});$('#documentSettingsModal')?.close();state.documentSettings=null;toast('บันทึกผู้ลงนามและลายเซ็น HR แล้ว');renderDocumentA4Preview();}
  catch(e){toast(e.message||'บันทึกการตั้งค่าเอกสารไม่สำเร็จ',true);}finally{btn.disabled=false;btn.textContent=old;}
}

const documentTypeMeta={
  EMP_CERT:['รับรองการทำงาน','ชื่อ · ตำแหน่ง · แผนก · วันเริ่มงาน','DOC'],
  SAL_CERT:['รับรองเงินเดือน','ชื่อ · ตำแหน่ง · เงินเดือนล่าสุด','฿'],
  PROB_PASS:['ผ่านทดลองงาน','ข้อมูลการจ้างงาน · วันที่มีผล · ต้องรับทราบ','✓'],
  SAL_ADJ:['ปรับเงินเดือน','เงินเดือนใหม่ · วันที่มีผล · ต้องรับทราบ','↗'],
  ACK_NOTICE:['เอกสารให้รับทราบ','เรื่อง · รายละเอียดประกาศ · รับทราบหรือชี้แจงได้','ACK'],
  WARNING:['หนังสือเตือน','สร้างผ่าน HR Case เพื่อเก็บเหตุการณ์และหลักฐาน','!']
};
const standardDocumentCatalog=Object.entries(documentTypeMeta).map(([code,m],i)=>({id:-(i+1),code,name:m[0],catalog_only:true}));
let selectedDocumentCode='';

function thaiToday(){return new Date(Date.now()+7*60*60*1000).toISOString().slice(0,10);}
function getDocumentEmployee(){return (state.employees||[]).find(x=>Number(x.id)===Number($('#documentEmployee')?.value));}
function getDocumentCompany(){return state.companyProfile||state.dashboard?.client||activeCompany()||{};}
function employeeDisplayName(e){return e?`${e.first_name||''} ${e.last_name||''}`.trim()||e.nickname||e.employee_code||'พนักงาน':'พนักงาน';}
function escapeAttr(v){return escapeHtml(String(v??'')).replace(/"/g,'&quot;');}

function documentFormHtml(code){
  const today=thaiToday();
  if(code==='EMP_CERT'||code==='SAL_CERT')return `<div class="field full"><label>3. วัตถุประสงค์ในการออกเอกสาร</label><input id="docPurpose" value="ใช้เป็นหลักฐานตามคำขอของพนักงาน" placeholder="เช่น ใช้ประกอบการขอสินเชื่อ"></div><div class="field"><label>วันที่ออกเอกสาร</label><input id="docIssueDate" type="date" value="${today}"></div><div class="field"><label>เรียน / ผู้รับเอกสาร</label><input id="docRecipient" value="ผู้เกี่ยวข้อง" placeholder="ผู้เกี่ยวข้อง"></div>`;
  if(code==='PROB_PASS')return `<div class="field"><label>3. วันที่มีผล</label><input id="docEffectiveDate" type="date" value="${today}"></div><div class="field full"><label>รายละเอียดเพิ่มเติม</label><textarea id="docDetail" rows="3" placeholder="เช่น ผ่านการประเมินทดลองงานตามเกณฑ์ของบริษัท"></textarea></div>`;
  if(code==='SAL_ADJ')return `<div class="field"><label>3. เงินเดือนใหม่ (บาท/เดือน)</label><input id="docNewSalary" type="number" min="0" step="0.01" placeholder="เช่น 45000"></div><div class="field"><label>วันที่มีผล</label><input id="docEffectiveDate" type="date" value="${today}"></div><div class="field full"><label>รายละเอียดเพิ่มเติม</label><textarea id="docDetail" rows="3" placeholder="เช่น ปรับตามผลการประเมินประจำปี"></textarea></div>`;
  if(code==='ACK_NOTICE')return `<div class="field full"><label>3. เรื่อง</label><input id="docSubject" placeholder="เช่น แจ้งนโยบายการทำงานฉบับใหม่"></div><div class="field full"><label>รายละเอียดประกาศ / เนื้อหาที่ต้องการให้รับทราบ</label><textarea id="docDetail" rows="5" placeholder="ระบุรายละเอียดที่พนักงานต้องอ่านและรับทราบ"></textarea></div><div class="field"><label>วันที่ออกเอกสาร</label><input id="docIssueDate" type="date" value="${today}"></div>`;
  if(code==='WARNING')return `<div class="document-template-error"><strong>หนังสือเตือนต้องสร้างจาก HR Case</strong><small>เพื่อให้มีเหตุการณ์ หลักฐาน คำชี้แจง และ Timeline ที่ตรวจสอบย้อนหลังได้</small><button type="button" class="primary-btn" onclick="window.quickOpenDocumentCase()">+ เปิด HR Case</button></div>`;
  return '';
}

function collectDocumentForm(){
  const code=selectedDocumentCode;
  const data={};
  if(code==='EMP_CERT'||code==='SAL_CERT'){
    data.purpose=$('#docPurpose')?.value.trim()||'ใช้เป็นหลักฐานตามคำขอของพนักงาน';
    data.issue_date=$('#docIssueDate')?.value||thaiToday();
    data.recipient=$('#docRecipient')?.value.trim()||'ผู้เกี่ยวข้อง';
  }else if(code==='PROB_PASS'){
    data.effective_date=$('#docEffectiveDate')?.value||thaiToday();
    data.note=$('#docDetail')?.value.trim()||'';
  }else if(code==='SAL_ADJ'){
    data.new_salary=Number($('#docNewSalary')?.value||0);
    data.effective_date=$('#docEffectiveDate')?.value||thaiToday();
    data.note=$('#docDetail')?.value.trim()||'';
  }else if(code==='ACK_NOTICE'){
    data.subject=$('#docSubject')?.value.trim()||'';
    data.note=$('#docDetail')?.value.trim()||'';
    data.issue_date=$('#docIssueDate')?.value||thaiToday();
  }
  return data;
}

function renderDocumentA4Preview(){
  const root=$('#documentDraftPreview'); if(!root)return;
  const code=selectedDocumentCode;
  if(!code){root.innerHTML='<p class="kicker">DOCUMENT PREVIEW</p><strong>เลือกประเภทเอกสารเพื่อกรอกแบบฟอร์ม</strong><small>ระบบจะสร้าง Preview จากข้อมูลบริษัทและแฟ้มพนักงานก่อนสร้าง Draft</small>';return;}
  if(code==='WARNING'){root.innerHTML='<p class="kicker">HR CASE WORKFLOW</p><strong>หนังสือเตือนสร้างจาก Case เท่านั้น</strong><small>เหตุการณ์ → หลักฐาน → ขอคำชี้แจง → HR พิจารณา → หนังสือเตือน → รับทราบ/ชี้แจง</small>';return;}
  const e=getDocumentEmployee(), c=getDocumentCompany(), d=collectDocumentForm(), meta=documentTypeMeta[code]||['เอกสารพนักงาน','','DOC'];
  const name=employeeDisplayName(e), company=String(c.legal_name||c.name||activeCompany()?.name||'ชื่อบริษัท'), position=e?.position_name||e?.position||'-', department=e?.department_name||e?.department||'-', start=e?.start_date||'-';
  let body='';
  if(code==='EMP_CERT') body=`${company} ขอรับรองว่า ${name} รหัสพนักงาน ${e?.employee_code||'-'} เป็นพนักงานของบริษัท ปัจจุบันดำรงตำแหน่ง ${position} สังกัด ${department} และเริ่มปฏิบัติงานตั้งแต่วันที่ ${start} จนถึงปัจจุบัน<br><br>วัตถุประสงค์: ${escapeHtml(d.purpose||'')}`;
  if(code==='SAL_CERT') body=`${company} ขอรับรองว่า ${name} ตำแหน่ง ${position} สังกัด ${department} เริ่มงานวันที่ ${start} โดยระบบจะดึงเงินเดือนล่าสุดจาก Payroll Profile ตอนสร้างเอกสาร Final<br><br>วัตถุประสงค์: ${escapeHtml(d.purpose||'')}`;
  if(code==='PROB_PASS') body=`เรียน ${escapeHtml(name)}<br><br>${escapeHtml(company)} ขอแจ้งให้ทราบว่าท่านผ่านการทดลองงานในตำแหน่ง ${escapeHtml(position)} สังกัด ${escapeHtml(department)} โดยมีผลตั้งแต่วันที่ ${escapeHtml(d.effective_date||'-')} เป็นต้นไป${d.note?`<br><br>${escapeHtml(d.note)}`:''}`;
  if(code==='SAL_ADJ') body=`เรียน ${escapeHtml(name)}<br><br>${escapeHtml(company)} ขอแจ้งการปรับเงินเดือนของท่านเป็น <b>${Number(d.new_salary||0).toLocaleString('th-TH')} บาท/เดือน</b> มีผลตั้งแต่วันที่ ${escapeHtml(d.effective_date||'-')} เป็นต้นไป${d.note?`<br><br>${escapeHtml(d.note)}`:''}`;
  if(code==='ACK_NOTICE') body=`เรียน ${escapeHtml(name)}<br><b>เรื่อง ${escapeHtml(d.subject||'—')}</b><br><br>${escapeHtml(d.note||'กรอกรายละเอียดประกาศด้านบน')}`;
  const needsAck=['PROB_PASS','SAL_ADJ','ACK_NOTICE'].includes(code);
  const signerName=state.documentSettings?.signer_name||'HR / ผู้มีอำนาจ';
  const signerPosition=state.documentSettings?.signer_position||'ฝ่ายทรัพยากรบุคคล';
  const hrSig=state.documentSettings?.signer_signature_data_url||'';
  root.innerHTML=`<p class="kicker">A4 DOCUMENT PREVIEW</p><div class="document-a4-preview-sheet"><div class="document-a4-brand"><div class="document-a4-logo">${state.documentSettings?.logo_data_url?`<img src="${escapeAttr(state.documentSettings.logo_data_url)}" alt="Logo">`:'<span>LOGO</span>'}</div><div><strong>${escapeHtml(company)}</strong><small>ข้อมูลที่อยู่ เลขภาษี และเบอร์โทรจะดึงจากบริษัทนี้</small></div></div><div class="document-a4-title"><h3>${escapeHtml(meta[0])}</h3><small>เลขเอกสารจะถูกสร้างเมื่อบันทึก Draft</small></div><div class="document-a4-body">${body}</div><div class="document-a4-signatures ${needsAck?'two':''}"><div class="signature-preview-box"><span>ฝ่าย HR / ผู้มีอำนาจลงนาม</span>${hrSig?`<img src="${escapeAttr(hrSig)}" alt="ลายเซ็น HR">`:'<div class="signature-placeholder">ลายเซ็น HR</div>'}<b>${escapeHtml(signerName)}</b><small>${escapeHtml(signerPosition)}</small></div>${needsAck?`<div class="signature-preview-box"><span>พนักงานผู้รับทราบ</span><div class="signature-placeholder">ลงชื่อผ่าน LINE / Nakna HR</div><b>${escapeHtml(name)}</b><small>ระบบจะเก็บวันเวลาและหลักฐานการรับทราบ</small></div>`:''}</div><div class="document-a4-footnote">Logo · ข้อมูลบริษัท · ลายเซ็น HR · ลายเซ็นรับทราบ จะถูกผูกกับบริษัทและพนักงานของเอกสารฉบับนั้น</div></div>`;
}

function renderDocumentDynamicForm(){
  const root=$('#documentDynamicFields'); if(!root)return;
  root.innerHTML=documentFormHtml(selectedDocumentCode);
  root.querySelectorAll('input,textarea,select').forEach(el=>{el.addEventListener('input',renderDocumentA4Preview);el.addEventListener('change',renderDocumentA4Preview);});
  renderDocumentA4Preview();
}

function renderDocumentTypeCards(){
  const templates=state.documentSystem?.templates||[],root=$('#documentTypeCards');if(!root)return;
  const byCode=new Map(templates.map(t=>[t.code,t]));
  root.innerHTML=standardDocumentCatalog.map(cat=>{const t=byCode.get(cat.code)||cat;const meta=documentTypeMeta[cat.code];return `<button type="button" class="document-type-card ${selectedDocumentCode===cat.code?'active':''}" data-template-code="${escapeAttr(cat.code)}"><span class="doc-symbol">${escapeHtml(meta[2])}</span><span><strong>${escapeHtml(meta[0])}</strong><small>${escapeHtml(meta[1])}</small></span></button>`}).join('');
  root.querySelectorAll('.document-type-card').forEach(btn=>btn.addEventListener('click',()=>selectDocumentTemplateByCode(btn.dataset.templateCode)));
}

function selectDocumentTemplateByCode(code){
  if(!documentTypeMeta[code])return;
  selectedDocumentCode=code;
  const hidden=$('#documentTemplate'); if(hidden){hidden.dataset.code=code; const t=(state.documentSystem?.templates||[]).find(x=>x.code===code);hidden.value=t?.id?String(t.id):'';}
  renderDocumentTypeCards();
  renderDocumentDynamicForm();
  const save=$('#documentGenerateSaveBtn'); if(save){save.disabled=code==='WARNING'; save.textContent=code==='WARNING'?'สร้างผ่าน HR Case':'สร้าง Draft เพื่อตรวจสอบ';}
}
window.selectDocumentTemplate=(id,code)=>selectDocumentTemplateByCode(code);
window.selectDocumentTemplateByCode=selectDocumentTemplateByCode;

function openDocumentGenerateModal(){
  selectedDocumentCode='';
  const employee=$('#documentEmployee');
  if(employee){employee.innerHTML=(state.employees||[]).map(e=>`<option value="${Number(e.id)}">${escapeHtml(e.nickname||employeeDisplayName(e))} · ${escapeHtml(e.employee_code||'')}</option>`).join(''); employee.onchange=renderDocumentA4Preview;}
  const hidden=$('#documentTemplate'); if(hidden){hidden.value=''; hidden.dataset.code='';}
  const fields=$('#documentDynamicFields'); if(fields)fields.innerHTML='';
  const save=$('#documentGenerateSaveBtn'); if(save){save.disabled=false;save.textContent='สร้าง Draft เพื่อตรวจสอบ';}
  renderDocumentTypeCards(); renderDocumentA4Preview();
  $('#documentGenerateModal')?.showModal();
}
window.openDocumentGenerateModal=openDocumentGenerateModal;

async function generateEmployeeDocument(){
  const button=$('#documentGenerateSaveBtn');
  if(!selectedDocumentCode)return toast('กรุณาเลือกประเภทเอกสาร',true);
  if(selectedDocumentCode==='WARNING')return toast('หนังสือเตือนต้องสร้างผ่าน HR Case',true);
  const employeeId=Number($('#documentEmployee')?.value||0); if(!employeeId)return toast('กรุณาเลือกพนักงาน',true);
  const data=collectDocumentForm();
  if(selectedDocumentCode==='SAL_ADJ'&&!(Number(data.new_salary)>0))return toast('กรุณาระบุเงินเดือนใหม่',true);
  if(selectedDocumentCode==='ACK_NOTICE'&&!data.subject)return toast('กรุณาระบุเรื่องของเอกสาร',true);
  if(selectedDocumentCode==='ACK_NOTICE'&&!data.note)return toast('กรุณาระบุรายละเอียดที่ต้องการให้พนักงานรับทราบ',true);
  button.disabled=true;button.textContent='กำลังสร้าง Draft…';
  try{
    const result=await api('/api/document-workflows/create',{method:'POST',body:JSON.stringify({employee_id:employeeId,template_code:selectedDocumentCode,data})});
    $('#documentGenerateModal').close();
    if(result.document){
      state.documents=state.documents||{data:[],payslips:[]}; state.documents.data=state.documents.data||[];
      state.documents.data=[result.document,...state.documents.data.filter(x=>Number(x.id)!==Number(result.document.id))];
      renderDocuments();
    }
    await refreshDocuments({silent:true});
    toast(`สร้าง Draft ${result.document_number} แล้ว · อยู่ใน “งานที่ต้องดำเนินการ” เพื่อให้ HR ตรวจและอนุมัติ`);
  }catch(e){toast(e.message,true)}finally{button.disabled=false;button.textContent='สร้าง Draft เพื่อตรวจสอบ';}
}

function renderGrowth(){
  const learning=state.learning||{courses:[],summary:{}}; const performance=state.performance||{goals:[],one_on_ones:[],probation_due:[],probation_reviews:[],summary:{}}; const canAdmin=['owner','co_owner','hr_admin','hr'].includes(String(activeCompanyRole()||''));
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

async function refreshGrowth(){const role=String(activeCompanyRole()||'');if(!['owner','co_owner','hr_admin','hr','manager'].includes(role))return;try{const [learning,performance]=await Promise.all([api('/api/learning/overview'),api('/api/performance/overview')]);state.learning=learning;state.performance=performance;renderGrowth();}catch(e){toast(e.message,true);}}

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
function canManageEngagementUi(){return ['owner','co_owner','hr_admin','hr'].includes(String(activeCompanyRole()||''));}
function isOwnerUi(){return String(activeCompanyRole()||'')==='owner';}
function phase5EmployeeOptions(selected=''){return state.employees.filter(e=>e.status==='active').map(e=>`<option value="${e.id}" ${String(selected)===String(e.id)?'selected':''}>${escapeHtml(e.nickname||e.first_name)} · ${escapeHtml(e.employee_code||'')}</option>`).join('');}
function openPhase5Form({eyebrow='NAKNA',title,subtitle='',html,onSave,saveText='บันทึก'}){
  $('#modalEyebrow').textContent=eyebrow;$('#modalTitle').textContent=title;$('#modalSubtitle').textContent=subtitle;$('#modalFields').className='modal-fields';$('#modalFields').innerHTML=html;$('#modalSave').textContent=saveText;
  $('#modalSave').onclick=async()=>{const b=$('#modalSave');b.disabled=true;try{await onSave();$('#modal').close();toast('บันทึกเรียบร้อยแล้ว');}catch(e){toast(e.message,true)}finally{b.disabled=false;b.textContent=saveText;}};$('#modal').showModal();
}

async function refreshPhase5(){
  const role=String(activeCompanyRole()||'');const canView=['owner','co_owner','hr_admin','hr','manager','viewer'].includes(role);
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
function wellnessStatusLabel(status){return ({completed:'ทำแล้ว',started:'กำลังทำ',reminded:'รอทำ',skipped:'ข้ามวันนี้'})[status]||'ยังไม่ได้เริ่ม';}
function renderWellness(){
  const d=state.wellness||{},settings=d.settings||{},summary=d.summary||{}; if(!$('#wellnessSummary'))return; const canManage=canManageEngagementUi();
  $('#wellnessSaveBtn')?.classList.toggle('hidden',!canManage); $('#wellnessRemindNowBtn')?.classList.toggle('hidden',!canManage); $('#wellnessPreviewBtn')?.classList.toggle('hidden',!canManage); $$('#view-wellness input,#view-wellness select').forEach(el=>el.disabled=!canManage);
  $('#wellnessSummary').innerHTML=[['พนักงานที่เชื่อม LINE',summary.line_connected||0,'LINE'],['ทำแล้ววันนี้',summary.completed||0,'DONE'],['กำลังทำ',summary.started||0,'ACTIVE'],['ข้ามวันนี้',summary.skipped||0,'SKIP'],['ยังรอ',summary.pending||0,'PENDING']].map(([label,value,key])=>`<article><span>${key}</span><strong>${Number(value||0)}</strong><p>${label}</p></article>`).join('');
  $('#wellnessEnabled').checked=Boolean(settings.enabled); $('#wellnessReminderTime').value=settings.reminder_time||'15:00'; $('#wellnessDuration').value=String(settings.duration_minutes||3); $('#wellnessSnooze').value=String(settings.snooze_minutes||30); $('#wellnessPoints').value=String(Number(settings.points_reward||0)); $('#wellnessCamera').checked=settings.camera_enabled!==false; if($('#wellnessPoseTracking')) $('#wellnessPoseTracking').checked=settings.pose_tracking_enabled!==false; $('#wellnessWorkdayOnly').checked=settings.workday_only!==false;
  const test=d.test_mode||{},tester=test.employee||null,testRoot=$('#wellnessTestRecipient');
  if(testRoot){if(tester){testRoot.classList.remove('unavailable');testRoot.innerHTML=`<span class="wellness-test-avatar">${escapeHtml(String(tester.nickname||tester.first_name||'T').slice(0,1).toUpperCase())}</span><div><strong>${escapeHtml(tester.nickname||tester.first_name)} · ส่งเฉพาะ LINE ของคุณ</strong><small>${escapeHtml(tester.employee_code||'')} · ${tester.line_connected?'LINE เชื่อมแล้ว':'ยังไม่ได้เชื่อม LINE'}</small></div>`;}else{testRoot.classList.add('unavailable');testRoot.innerHTML=`<span class="wellness-test-avatar">!</span><div><strong>ยังหาพนักงานที่ตรงกับบัญชีนี้ไม่เจอ</strong><small>ตั้ง Email ใน Employee Profile ให้ตรงกับบัญชีที่ล็อกอิน และเชื่อม LINE ก่อนทดสอบ</small></div>`;}}
  const testBtn=$('#wellnessTestSendBtn');if(testBtn)testBtn.disabled=!tester?.line_connected;
  const scheduled=test.scheduled||null,status=$('#wellnessTestScheduleStatus');if(status){status.classList.toggle('hidden',!scheduled);status.innerHTML=scheduled?`<span>🧪 ทดสอบถัดไป: <strong>${formatDateTime(scheduled.scheduled_for)}</strong> · ${escapeHtml(tester?.nickname||tester?.first_name||'ฉัน')}</span><button type="button" data-cancel-wellness-test="${Number(scheduled.id)}">ยกเลิก</button>`:'';}
  syncWellnessTestTimingUi();
  const routine=d.routine||[]; $('#wellnessRoutinePreview').innerHTML=routine.length?routine.map((step,i)=>`<div class="wellness-routine-row"><span>${i+1}</span><div><strong>${escapeHtml(step.title)}</strong><small>${escapeHtml(step.instruction)}${step.cue?` · AI: ${escapeHtml(step.cue)}`:''}</small></div><em>${Number(step.seconds||0)} วิ</em></div>`).join(''):emptyState('กำลังเตรียมท่ายืด','เปิดหน้านี้ใหม่อีกครั้ง');
  const sessions=d.today_sessions||[]; $('#wellnessTodayBadge').textContent=`${Number(summary.completed||0)}/${Number(summary.line_connected||0)} ทำแล้ว`;
  $('#wellnessTeamList').innerHTML=sessions.length?sessions.map(row=>`<div class="wellness-team-row"><span class="mini-avatar">${initial(row)}</span><div><strong>${escapeHtml(row.nickname||row.first_name)}</strong><small>${escapeHtml(row.department_name||'ไม่ระบุแผนก')}${row.completed_at?` · ${formatDateTime(row.completed_at)}`:''}${Number(row.ai_tracking_used)?` · AI ${Math.round(Number(row.ai_score||0))}% (${Number(row.ai_passed_steps||0)}/${Number(row.ai_total_steps||0)})`:''}</small></div><span class="badge ${row.status==='completed'?'badge-success':row.status==='skipped'?'badge-neutral':row.status==='started'?'badge-soft':'badge-warning'}">${wellnessStatusLabel(row.status)}</span>${Number(row.points_awarded||0)>0?`<b>+${Number(row.points_awarded||0)} pts</b>`:''}</div>`).join(''):emptyState('ยังไม่มี Activity วันนี้','เมื่อระบบส่งเตือน หรือพนักงานเปิดพักยืด รายชื่อจะมาอยู่ตรงนี้');
}
function openWellnessPreview(){
  const url=`/wellness.html?preview=1&v=${Date.now()}`;
  const win=window.open(url,'_blank');
  if(win){try{win.opener=null;}catch{}}else location.href=url;
}
async function saveWellnessSettings(){
  const button=$('#wellnessSaveBtn');button.disabled=true;try{const poseEnabled=$('#wellnessPoseTracking')?.checked!==false;if(poseEnabled&&$('#wellnessCamera'))$('#wellnessCamera').checked=true;const result=await api('/api/wellness/settings',{method:'PATCH',body:JSON.stringify({enabled:$('#wellnessEnabled').checked,reminder_time:$('#wellnessReminderTime').value,duration_minutes:Number($('#wellnessDuration').value||3),snooze_minutes:Number($('#wellnessSnooze').value||30),points_reward:Number($('#wellnessPoints').value||0),camera_enabled:$('#wellnessCamera').checked,pose_tracking_enabled:poseEnabled,workday_only:$('#wellnessWorkdayOnly').checked})});state.wellness.settings=result.settings||state.wellness.settings;markViewLoaded('wellness');renderWellness();toast('บันทึกการตั้งค่า Wellness แล้ว');}catch(e){toast(e.message,true)}finally{button.disabled=false;}}
async function sendWellnessReminderNow(){
  if(!confirm('ส่ง Wellness Reminder ให้ทีมงานที่เข้าเงื่อนไขตอนนี้ใช่ไหม?\n\nถ้าต้องการตรวจสอบ Flow ก่อน ให้ใช้ “พรีวิวสำหรับ HR” แทน'))return;
  const button=$('#wellnessRemindNowBtn');button.disabled=true;button.textContent='กำลังส่งทั้งทีม…';try{const r=await api('/api/wellness/remind-now',{method:'POST',body:'{}'});state.wellness=await api('/api/wellness/overview');markViewLoaded('wellness');renderWellness();toast(`ส่งเตือนแล้ว ${Number(r.sent||0)} คน${Number(r.failed||0)?` · ไม่สำเร็จ ${r.failed}`:''}`);}catch(e){toast(e.message,true)}finally{button.disabled=false;button.textContent='ส่งเตือนทั้งทีมตอนนี้';}}
function syncWellnessTestTimingUi(){const timing=$('#wellnessTestTiming')?.value||'now';$('#wellnessTestTimeField')?.classList.toggle('hidden',timing!=='custom');const btn=$('#wellnessTestSendBtn');if(btn)btn.textContent=timing==='now'?'ส่งให้ฉันตอนนี้':timing==='1'?'ส่งให้ฉันอีก 1 นาที':timing==='5'?'ส่งให้ฉันอีก 5 นาที':'ตั้งเวลาส่งให้ฉัน';}
async function sendWellnessTestReminder(){const btn=$('#wellnessTestSendBtn'),timing=$('#wellnessTestTiming')?.value||'now';const body=timing==='now'?{mode:'now'}:timing==='custom'?{mode:'time',scheduled_time:$('#wellnessTestTime')?.value||''}:{mode:'delay',delay_minutes:Number(timing)};if(timing==='custom'&&!body.scheduled_time)return toast('กรุณาเลือกเวลาส่ง',true);btn.disabled=true;try{const r=await api('/api/wellness/test-reminder',{method:'POST',body:JSON.stringify(body)});state.wellness=await api('/api/wellness/overview');markViewLoaded('wellness');renderWellness();toast(r.sent?'ส่งข้อความตรวจสอบให้คุณแล้ว':'ตั้งเวลาส่งแล้ว · ส่งเฉพาะคุณ');}catch(e){toast(e.message,true)}finally{btn.disabled=false;syncWellnessTestTimingUi();}}
async function cancelWellnessTestSchedule(id){if(!id)return;try{await api(`/api/wellness/test-schedules/${id}`,{method:'DELETE'});state.wellness=await api('/api/wellness/overview');renderWellness();toast('ยกเลิกเวลาส่งตรวจสอบแล้ว');}catch(e){toast(e.message,true)}}

function eventRuleLabel(v){return ({attendance_streak:'มาตรงเวลาเป็นชุด' ,learning_complete:'เรียนจบหลักสูตร',kpi_complete:'KPI สำเร็จ',birthday:'วันเกิด',work_anniversary:'ครบรอบงาน',manual:'HR ให้เอง',custom:'กำหนดเอง'})[v]||v;}
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

// P7.38 — Detailed Help Center
(function initNaknaHelpCenter(){
  const modal=document.getElementById('helpCenterModal');
  const openBtn=document.getElementById('helpCenterBtn');
  if(!modal||!openBtn)return;
  const closeBtn=document.getElementById('helpCenterClose');
  const nav=[...modal.querySelectorAll('[data-help-section]')];
  const sections=[...modal.querySelectorAll('[data-help-content]')];
  const search=document.getElementById('helpSearchInput');
  const subtitle=document.getElementById('helpCenterSubtitle');
  const titles={start:'ตั้งระบบ HR ตั้งแต่เริ่มจนใช้งานจริง',people:'จัดคน แผนก ตำแหน่ง และหัวหน้าให้ถูกโครงสร้าง',line:'ประสบการณ์พนักงานและผู้บริหารผ่าน LINE',leave:'ตั้งสิทธิ์ลาและ Workflow อนุมัติให้ทำงานจริง',hr:'รับเรื่องส่วนตัวจากพนักงานแบบเป็นความลับ',access:'กำหนดสิทธิ์ตามหน้าที่และความรับผิดชอบ',payroll:'เตรียมข้อมูลเงินเดือนและออกเอกสารพนักงาน',trouble:'วิธีเช็กปัญหาที่พบบ่อยก่อนแก้ระบบ'};
  function show(id){
    nav.forEach(b=>b.classList.toggle('active',b.dataset.helpSection===id));
    sections.forEach(s=>s.classList.toggle('active',s.dataset.helpContent===id));
    if(subtitle)subtitle.textContent=titles[id]||'คู่มือใช้งานนากนะ';
    const content=modal.querySelector('.help-center-content'); if(content)content.scrollTop=0;
    if(search)search.value='';
  }
  openBtn.addEventListener('click',()=>{show('start');modal.showModal();});
  closeBtn?.addEventListener('click',()=>modal.close());
  modal.addEventListener('click',e=>{if(e.target===modal)modal.close();});
  nav.forEach(b=>b.addEventListener('click',()=>show(b.dataset.helpSection)));
  document.getElementById('helpGoDashboardBtn')?.addEventListener('click',()=>{modal.close();document.querySelector('[data-view="dashboard"]')?.click();});
  search?.addEventListener('input',()=>{
    const q=search.value.trim().toLowerCase();
    if(!q)return;
    const matches=sections.filter(s=>s.textContent.toLowerCase().includes(q));
    if(matches.length){show(matches[0].dataset.helpContent);search.value=q;}
  });
})();

let documentHrSignDrawing=false;
let documentHrSignHasInk=false;
let documentHrSignLastPoint=null;
let documentHrSignPadBound=false;

async function ensureDocumentSettingsForSigning(){
  if(state.documentSettings)return state.documentSettings;
  const r=await api('/api/document-settings',{silentStatus:true});
  state.documentSettings=r?.data||{};
  return state.documentSettings;
}

function documentHrSignCanvas(){return $('#documentHrSignaturePad');}
function resizeDocumentHrSignPad(){
  const canvas=documentHrSignCanvas(); if(!canvas)return;
  const rect=canvas.getBoundingClientRect(); if(!rect.width)return;
  const ratio=Math.max(1,Math.min(3,window.devicePixelRatio||1));
  canvas.width=Math.max(1,Math.round(rect.width*ratio));
  canvas.height=Math.max(1,Math.round(112*ratio));
  const ctx=canvas.getContext('2d');
  ctx.setTransform(ratio,0,0,ratio,0,0);
  ctx.lineWidth=2.2; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.strokeStyle='#173c43';
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,rect.width,112);
  documentHrSignHasInk=false; documentHrSignLastPoint=null;
}
function clearDocumentHrSignPad(){
  const canvas=documentHrSignCanvas(); if(!canvas)return;
  const rect=canvas.getBoundingClientRect(),ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,rect.width,112);ctx.fillStyle='#fff';ctx.fillRect(0,0,rect.width,112);
  documentHrSignHasInk=false;documentHrSignLastPoint=null;
}
function documentHrSignPoint(ev){
  const canvas=documentHrSignCanvas(),r=canvas.getBoundingClientRect();
  return{x:ev.clientX-r.left,y:ev.clientY-r.top};
}

function updateDocumentHrSignSubmitState(){
  const btn=$('#documentHrSignSubmitBtn'); if(!btn)return;
  const useSaved=Boolean($('#documentHrUseSavedSignature')?.checked);
  const canSubmit=useSaved||Boolean(documentHrSignHasInk);
  const label=btn.dataset.readyLabel||btn.dataset.originalLabel||'ลงนามและส่งต่อให้พนักงาน';
  btn.disabled=!canSubmit;
  btn.setAttribute('aria-disabled',canSubmit?'false':'true');
  btn.classList.toggle('is-disabled',!canSubmit);
  if(canSubmit){
    btn.textContent=label;
  }else{
    btn.textContent='กรุณาเลือกลายเซ็นหรือเซ็นก่อน';
  }
}
function bindDocumentHrSignPad(){
  const canvas=documentHrSignCanvas(); if(!canvas||documentHrSignPadBound)return;
  documentHrSignPadBound=true;
  canvas.addEventListener('pointerdown',ev=>{
    ev.preventDefault();documentHrSignDrawing=true;documentHrSignHasInk=true;documentHrSignLastPoint=documentHrSignPoint(ev);
    canvas.setPointerCapture?.(ev.pointerId);
    const saved=$('#documentHrUseSavedSignature');if(saved)saved.checked=false;
    updateDocumentHrSignSubmitState();
  },{passive:false});
  canvas.addEventListener('pointermove',ev=>{
    if(!documentHrSignDrawing||!documentHrSignLastPoint)return;ev.preventDefault();
    const p=documentHrSignPoint(ev),ctx=canvas.getContext('2d');ctx.beginPath();ctx.moveTo(documentHrSignLastPoint.x,documentHrSignLastPoint.y);ctx.lineTo(p.x,p.y);ctx.stroke();documentHrSignLastPoint=p;
    updateDocumentHrSignSubmitState();
  },{passive:false});
  const end=ev=>{if(!documentHrSignDrawing)return;ev.preventDefault();documentHrSignDrawing=false;documentHrSignLastPoint=null;updateDocumentHrSignSubmitState();};
  canvas.addEventListener('pointerup',end,{passive:false});canvas.addEventListener('pointercancel',end,{passive:false});canvas.addEventListener('pointerleave',ev=>{if(ev.buttons===0)end(ev)});canvas.addEventListener('contextmenu',ev=>ev.preventDefault());
  $('#clearDocumentHrSignature')?.addEventListener('click',()=>{clearDocumentHrSignPad();updateDocumentHrSignSubmitState();});
  $('#documentHrUseSavedSignature')?.addEventListener('change',ev=>{if(ev.target.checked)clearDocumentHrSignPad();updateDocumentHrSignSubmitState();});
}

window.openDocumentHrSignModal=async function openDocumentHrSignModal(id){
  const dlg=$('#documentHrSignModal'); if(!dlg)return;
  const doc=(state.documents?.data||[]).find(x=>Number(x.id)===Number(id))||(state.documentSystem?.pending_approvals||[]).find(x=>Number(x.document_id)===Number(id))||{};
  $('#documentHrSignId').value=String(id);
  $('#documentHrSignTitle').textContent=doc.title||'เอกสารพนักงาน';
  const employee=doc.nickname||doc.first_name||doc.employee_name||'พนักงาน';
  $('#documentHrSignMeta').textContent=[doc.document_number,employee,doc.document_date?formatDate(doc.document_date):''].filter(Boolean).join(' · ')||`Document ID ${id}`;
  $('#documentHrSignNote').value='';
  $('#documentHrSignError').textContent='';
  const requiresEmployee=Number(doc.acknowledgement_required)===1;
  $('#documentHrSignNextStep').textContent=requiresEmployee
    ? 'ระบบจะสร้าง PDF ที่มีลายเซ็น HR แล้วส่ง LINE ให้พนักงานตรวจและลงลายเซ็นต่อ เมื่อพนักงานเซ็นครบ ระบบจะสร้าง Final PDF อัตโนมัติ'
    : 'เอกสารประเภทนี้ใช้ลายเซ็นฝ่ายบริษัทเพียงฝ่ายเดียว ระบบจะสร้าง Final PDF และส่งให้พนักงานเปิดดูทันที';
  const signBtn=$('#documentHrSignSubmitBtn');
  if(signBtn){
    signBtn.dataset.readyLabel=requiresEmployee?'ลงนามและส่งให้พนักงานเซ็นต่อ':'ลงนามและออก Final PDF';
    signBtn.dataset.originalLabel=signBtn.dataset.readyLabel;
    signBtn.textContent=signBtn.dataset.readyLabel;
  }
  documentHrSignHasInk=false;documentHrSignDrawing=false;documentHrSignLastPoint=null;
  try{
    const settings=await ensureDocumentSettingsForSigning();
    const saved=String(settings?.signer_signature_data_url||'');
    const preview=$('#documentHrSavedSignature');
    preview.innerHTML=saved?`<img src="${escapeAttr(saved)}" alt="ลายเซ็นที่บันทึกไว้"><span>${escapeHtml(settings?.signer_name||'ผู้มีอำนาจลงนาม')} · ${escapeHtml(settings?.signer_position||'')}</span>`:'<span>ยังไม่มีลายเซ็นที่บันทึกไว้ · สามารถเซ็นใหม่ทางด้านขวาได้</span>';
    const useSaved=$('#documentHrUseSavedSignature'); useSaved.checked=Boolean(saved); useSaved.disabled=!saved;
  }catch(e){
    $('#documentHrSavedSignature').innerHTML='<span>โหลดลายเซ็นที่บันทึกไว้ไม่สำเร็จ · กรุณาเซ็นใหม่ทางด้านขวา</span>';
    $('#documentHrUseSavedSignature').checked=false;$('#documentHrUseSavedSignature').disabled=true;
  }
  dlg.showModal();
  requestAnimationFrame(()=>{bindDocumentHrSignPad();resizeDocumentHrSignPad();updateDocumentHrSignSubmitState();});
};

async function submitDocumentHrSignature(){
  const id=Number($('#documentHrSignId')?.value||0),btn=$('#documentHrSignSubmitBtn'),err=$('#documentHrSignError'); if(!id||!btn)return;
  err.textContent='';
  const useSaved=Boolean($('#documentHrUseSavedSignature')?.checked);
  const canvas=documentHrSignCanvas();
  const signatureDataUrl=!useSaved&&documentHrSignHasInk&&canvas?canvas.toDataURL('image/png'):'';
  if(!useSaved&&!signatureDataUrl){err.textContent='กรุณาเลือกลายเซ็นที่บันทึกไว้ หรือเซ็นในกรอบก่อนดำเนินการ';return;}
  const old=btn.textContent;btn.disabled=true;btn.textContent='กำลังลงนามและสร้าง PDF…';
  try{
    const r=await api(`/api/document-workflows/${id}/approve`,{method:'POST',body:JSON.stringify({signature_data_url:signatureDataUrl,use_saved_signature:useSaved,note:$('#documentHrSignNote')?.value.trim()||''}),timeoutMs:60000,silentStatus:true});
    $('#documentHrSignModal')?.close();
    await refreshDocuments({silent:true});
    if(r.workflow_status==='awaiting_employee_signature'){
      const delivery=r.delivery?.ok?' · ส่ง LINE ให้พนักงานแล้ว':r.delivery?.reason==='line_not_connected'?' · พนักงานยังไม่เชื่อม LINE สามารถกดส่งภายหลังได้':' · HR ลงนามแล้ว แต่ LINE ยังส่งไม่สำเร็จ';
      toast(`HR ลงนามแล้ว · ส่งต่อให้พนักงานเซ็นเรียบร้อย${delivery}`);
    }else{
      toast('HR ลงนามแล้ว · Final PDF พร้อมใช้งาน');
    }
  }catch(e){
    console.error('[Nakna] HR document signing failed',id,e);
    const raw=String(e?.message||e||'');
    if(raw.includes('Google Drive')||raw.includes('Google Workspace'))err.textContent=raw;
    else if(raw.includes('GOOGLE_REAUTH_REQUIRED'))err.textContent='Google Drive ต้องเชื่อมใหม่ กรุณาไปที่ การเชื่อมต่อ แล้วเชื่อม Google อีกครั้ง';
    else if(raw.includes('API_TIMEOUT'))err.textContent='สร้าง PDF ใช้เวลานานเกินไป กรุณาลองอีกครั้ง';
    else err.textContent=`ลงนามไม่สำเร็จ · ${raw||'กรุณาลองอีกครั้ง'}`;
  }finally{btn.disabled=false;btn.textContent=old;}
}

window.approveDocumentWorkflow=(id)=>window.openDocumentHrSignModal(id);
window.rejectDocumentWorkflow=async function rejectDocumentWorkflow(id,button=null){
  const note=prompt('เหตุผลที่ส่งกลับให้แก้ไข');if(note===null)return;
  const original=button?.textContent||'ส่งกลับ';
  if(button){button.disabled=true;button.textContent='กำลังส่งกลับ…';}
  try{
    await api(`/api/document-workflows/${id}/reject`,{method:'POST',body:JSON.stringify({note}),timeoutMs:30000});
    await refreshDocuments({silent:true});toast('ส่งเอกสารกลับเป็น Draft แล้ว');
  }catch(e){
    console.error('[Nakna] document reject failed',id,e);
    toast(`ส่งกลับไม่สำเร็จ · ${e.message}`,true);
  }finally{
    if(button && button.isConnected){button.disabled=false;button.textContent=original;}
  }
};
window.sendEmployeeDocument=async function sendEmployeeDocument(id,button=null){
  const original=button?.textContent||'ส่งให้พนักงาน';
  if(button){button.disabled=true;button.textContent='กำลังส่ง LINE…';}
  try{
    const r=await api(`/api/employee-documents/${Number(id)}/send`,{method:'POST',body:'{}',timeoutMs:30000,silentStatus:true});
    await refreshDocuments({silent:true});
    toast(r.delivery?.ok?'ส่งเอกสารให้พนักงานทาง LINE แล้ว':'ส่งเอกสารแล้ว');
  }catch(e){
    toast(`ส่งเอกสารไม่สำเร็จ · ${e.message}`,true);
  }finally{if(button&&button.isConnected){button.disabled=false;button.textContent=original;}}
};

async function bulkApproveDocumentWorkflows(){const ids=(state.documentSystem?.pending_approvals||[]).map(x=>Number(x.document_id)).filter(Boolean);if(!ids.length)return toast('ไม่มีเอกสารรอ HR ลงนาม');const settings=await ensureDocumentSettingsForSigning().catch(()=>null);if(!settings?.signer_signature_data_url)return toast('การลงนามหลายเอกสารต้องบันทึกลายเซ็น HR ใน “ตั้งค่าเอกสาร & ลายเซ็น” ก่อน',true);if(!confirm(`ลงนามเอกสาร ${ids.length} ฉบับด้วยลายเซ็น HR ที่บันทึกไว้ และส่งเอกสารที่ต้องลงนามต่อให้พนักงาน?`))return;try{const r=await api('/api/document-workflows/bulk-approve',{method:'POST',body:JSON.stringify({ids}),timeoutMs:90000});await refreshDocuments({silent:true});toast(`ลงนามแล้ว ${Number(r.approved||0)} ฉบับ${Number(r.failed||0)?` · ไม่สำเร็จ ${Number(r.failed)} ฉบับ`:''}`);}catch(e){toast(`ลงนามหลายเอกสารไม่สำเร็จ · ${e.message}`,true)}}
async function seedDocumentTemplates(){try{await api('/api/document-templates/seed',{method:'POST',body:'{}'});await refreshDocuments();toast('ติดตั้ง Template มาตรฐานแล้ว');}catch(e){toast(e.message,true)}}

$('#seedDocumentTemplatesBtn')?.addEventListener('click',seedDocumentTemplates); $('#refreshDocumentSystemBtn')?.addEventListener('click',refreshDocuments); $('#bulkApproveDocumentsBtn')?.addEventListener('click',bulkApproveDocumentWorkflows); $('#documentSettingsBtn')?.addEventListener('click',()=>{bindDocumentSignatureUpload();openDocumentSettings();}); $('#saveDocumentSettingsBtn')?.addEventListener('click',saveDocumentSettings); $('#documentHrSignSubmitBtn')?.addEventListener('click',submitDocumentHrSignature);

window.quickOpenDocumentCase=async function quickOpenDocumentCase(){
  try{
    const employeeId=Number(prompt('Employee ID ที่ต้องการเปิด Case')); if(!employeeId)return;
    const title=prompt('หัวข้อ Case เช่น มาสายต่อเนื่อง / เหตุการณ์ที่ต้องตรวจสอบ'); if(!title)return;
    const description=prompt('รายละเอียดเบื้องต้น (ถ้ามี)')||'';
    const r=await api('/api/hr-document-cases',{method:'POST',body:JSON.stringify({employee_id:employeeId,title,description,case_type:'general'})});
    await refreshDocuments(); toast(`เปิด Case ${r.case_number} แล้ว`);
  }catch(e){toast(e.message,true)}
}
$('#openDocumentCaseBtn')?.addEventListener('click',quickOpenDocumentCase);
