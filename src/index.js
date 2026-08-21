const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

const INIT_SCHEMA_SQL = String.raw`CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'Asia/Bangkok',
  work_start TEXT NOT NULL DEFAULT '09:00',
  work_end TEXT NOT NULL DEFAULT '18:00',
  late_grace_minutes INTEGER NOT NULL DEFAULT 10,
  geofence_name TEXT,
  geofence_lat REAL,
  geofence_lng REAL,
  geofence_radius_m INTEGER NOT NULL DEFAULT 250,
  birthday_reminder_days INTEGER NOT NULL DEFAULT 7,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  manager_employee_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id, code),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  department_id INTEGER,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  employee_code TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  nickname TEXT,
  email TEXT,
  phone TEXT,
  birth_date TEXT,
  start_date TEXT NOT NULL,
  probation_end_date TEXT,
  contract_end_date TEXT,
  department_id INTEGER,
  position_id INTEGER,
  manager_employee_id INTEGER,
  employment_type TEXT NOT NULL DEFAULT 'full_time',
  status TEXT NOT NULL DEFAULT 'active',
  line_user_id TEXT UNIQUE,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id, employee_code),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE SET NULL,
  FOREIGN KEY (manager_employee_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  work_date TEXT NOT NULL,
  check_in_at TEXT,
  check_out_at TEXT,
  checkin_lat REAL,
  checkin_lng REAL,
  checkout_lat REAL,
  checkout_lng REAL,
  source TEXT NOT NULL DEFAULT 'line',
  status TEXT NOT NULL DEFAULT 'present',
  late_minutes INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_id, work_date),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  leave_type TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  approver_employee_id INTEGER,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (approver_employee_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  nickname TEXT,
  email TEXT,
  phone TEXT,
  position_name TEXT NOT NULL,
  source TEXT,
  expected_salary REAL,
  available_start_date TEXT,
  stage TEXT NOT NULL DEFAULT 'new',
  score REAL,
  owner_employee_id INTEGER,
  notes TEXT,
  last_activity_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_employee_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS employee_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  request_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  assigned_to_employee_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to_employee_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS line_link_tokens (
  token TEXT PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS line_sessions (
  line_user_id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  detail_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS work_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  radius_m INTEGER NOT NULL DEFAULT 150,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS employee_work_locations (
  employee_id INTEGER NOT NULL,
  location_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (employee_id, location_id),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES work_locations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS employee_invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  token_value TEXT,
  token_hint TEXT,
  department_id INTEGER,
  position_id INTEGER,
  employee_role TEXT NOT NULL DEFAULT 'employee',
  start_date TEXT,
  expires_at TEXT NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS employee_invite_locations (
  invite_id INTEGER NOT NULL,
  location_id INTEGER NOT NULL,
  PRIMARY KEY (invite_id, location_id),
  FOREIGN KEY (invite_id) REFERENCES employee_invites(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES work_locations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS line_join_tokens (
  token_hash TEXT PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_employees_client_status ON employees(client_id, status);
CREATE INDEX IF NOT EXISTS idx_employees_birth_date ON employees(birth_date);
CREATE INDEX IF NOT EXISTS idx_attendance_client_date ON attendance(client_id, work_date);
CREATE INDEX IF NOT EXISTS idx_leave_client_status ON leave_requests(client_id, status);
CREATE INDEX IF NOT EXISTS idx_candidates_client_stage ON candidates(client_id, stage);
CREATE INDEX IF NOT EXISTS idx_candidates_activity ON candidates(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_requests_client_status ON employee_requests(client_id, status);
CREATE INDEX IF NOT EXISTS idx_work_locations_client ON work_locations(client_id, is_active);
CREATE INDEX IF NOT EXISTS idx_employee_locations_employee ON employee_work_locations(employee_id);
CREATE INDEX IF NOT EXISTS idx_invites_client_status ON employee_invites(client_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_line_join_expiry ON line_join_tokens(expires_at);
`;

const V050_SCHEMA_SQL = String.raw`CREATE TABLE IF NOT EXISTS leave_policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  default_entitlement_days REAL NOT NULL DEFAULT 0,
  is_unlimited INTEGER NOT NULL DEFAULT 0,
  requires_reason INTEGER NOT NULL DEFAULT 1,
  evidence_required_after_days REAL,
  notice_days INTEGER NOT NULL DEFAULT 0,
  allow_negative INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id, code),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS employee_leave_entitlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  leave_policy_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  entitlement_days REAL NOT NULL DEFAULT 0,
  adjustment_days REAL NOT NULL DEFAULT 0,
  note TEXT,
  updated_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_id, leave_policy_id, year),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (leave_policy_id) REFERENCES leave_policies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS leave_approval_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  leave_request_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_employee_id INTEGER,
  actor_user_id INTEGER,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS leave_request_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  leave_request_id INTEGER NOT NULL,
  uploaded_by_employee_id INTEGER,
  r2_key TEXT NOT NULL,
  file_name TEXT,
  content_type TEXT,
  file_size INTEGER,
  source TEXT NOT NULL DEFAULT 'line',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by_employee_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS leave_evidence_share_tokens (
  token_hash TEXT PRIMARY KEY,
  evidence_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (evidence_id) REFERENCES leave_request_evidence(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_leave_evidence_share_expiry ON leave_evidence_share_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_leave_policy_client ON leave_policies(client_id, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_leave_entitlement_employee_year ON employee_leave_entitlements(employee_id, year);
CREATE INDEX IF NOT EXISTS idx_leave_events_request ON leave_approval_events(leave_request_id, created_at);
CREATE INDEX IF NOT EXISTS idx_leave_evidence_request ON leave_request_evidence(leave_request_id, created_at);
`;

const V060_SCHEMA_SQL = String.raw`CREATE TABLE IF NOT EXISTS line_integrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL UNIQUE,
  channel_id TEXT,
  bot_user_id TEXT,
  bot_basic_id TEXT,
  bot_display_name TEXT,
  bot_picture_url TEXT,
  encrypted_credentials TEXT NOT NULL,
  webhook_key TEXT NOT NULL UNIQUE,
  webhook_url TEXT NOT NULL,
  webhook_active INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'connected',
  last_test_at TEXT,
  last_error TEXT,
  connected_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_line_integrations_status ON line_integrations(status);
`;

const V061_SCHEMA_SQL = String.raw`CREATE TABLE IF NOT EXISTS employee_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  permission_key TEXT NOT NULL,
  granted_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id, employee_id, permission_key),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_permissions_employee ON employee_permissions(client_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_permissions_key ON employee_permissions(client_id, permission_key);
`;

const APPROVER_PERMISSION_KEYS = new Set([
  'leave.approve',
  'attendance.approve',
  'ot.approve',
  'hr_request.approve',
  'team.read'
]);

const INIT_AUTH_SCHEMA_SQL = String.raw`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  picture_url TEXT,
  locale TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS company_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id, user_id),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  selected_client_id INTEGER,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (selected_client_id) REFERENCES clients(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS oauth_states (
  state_hash TEXT PRIMARY KEY,
  purpose TEXT NOT NULL,
  user_id INTEGER,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS gmail_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  google_sub TEXT,
  email TEXT NOT NULL,
  encrypted_tokens TEXT NOT NULL,
  scopes TEXT,
  access_expires_at TEXT,
  connected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_company_members_user ON company_members(user_id, status);
CREATE INDEX IF NOT EXISTS idx_company_members_client ON company_members(client_id, status);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expiry ON oauth_states(expires_at);
`;

const INIT_SEED_SQL = String.raw`INSERT OR IGNORE INTO clients (
  id, name, code, timezone, work_start, work_end, late_grace_minutes,
  geofence_name, geofence_radius_m, birthday_reminder_days
) VALUES (1, 'DEAL Invest', 'DEAL', 'Asia/Bangkok', '11:00', '20:00', 10, 'DEAL Office', 250, 7);

INSERT OR IGNORE INTO departments (id, client_id, name, code) VALUES
  (1, 1, 'Visionhub', 'VISION'),
  (2, 1, 'Operations', 'OPS'),
  (3, 1, 'Dealmaker', 'SALES'),
  (4, 1, 'Accounting & Finance', 'FIN'),
  (5, 1, 'Human Resources', 'HR');

INSERT OR IGNORE INTO positions (id, client_id, department_id, name) VALUES
  (1, 1, 1, 'Content Creator'),
  (2, 1, 2, 'Operations Executive'),
  (3, 1, 3, 'Dealmaker'),
  (4, 1, 4, 'Accountant'),
  (5, 1, 5, 'HR Manager'),
  (6, 1, 1, 'Video Editor');

INSERT OR IGNORE INTO employees (
  id, client_id, employee_code, first_name, last_name, nickname, email, phone,
  birth_date, start_date, probation_end_date, contract_end_date,
  department_id, position_id, status
) VALUES
  (1,1,'DEAL-001','เมย์','รัตนา','May','may@example.com','0800000001','1997-08-20','2024-06-01','2024-09-29',NULL,5,5,'active'),
  (2,1,'DEAL-002','บีม','วรัญญา','Beam','beam@example.com','0800000002','1998-08-24','2025-08-27','2025-12-25',NULL,1,1,'active'),
  (3,1,'DEAL-003','ปอนด์','กิตติ','Pond','pond@example.com','0800000003','1996-09-02','2026-06-01','2026-09-29','2027-05-31',1,6,'active'),
  (4,1,'DEAL-004','เฟิร์น','จิราพร','Fern','fern@example.com','0800000004','1999-08-28','2026-05-15','2026-09-12',NULL,2,2,'active'),
  (5,1,'DEAL-005','โจ','ธนา','Joe','joe@example.com','0800000005','1995-11-05','2025-09-01','2025-12-30','2026-09-05',3,3,'active'),
  (6,1,'DEAL-006','อาย','ชลธิชา','Aim','aim@example.com','0800000006','2000-12-10','2026-05-25','2026-09-22',NULL,4,4,'active');

INSERT OR IGNORE INTO candidates (
  id, client_id, first_name, last_name, nickname, email, phone, position_name,
  source, expected_salary, stage, score, last_activity_at
) VALUES
  (1,1,'นนท์','พงษ์','Non','non@example.com','0810000001','Content Creator','Facebook Jobs',28000,'screening',4.2,'2026-08-19 10:00:00'),
  (2,1,'แพรว','พิชชา','Praew','praew@example.com','0810000002','Content Creator','JobsDB',30000,'hr_interview',4.5,'2026-08-16 10:00:00'),
  (3,1,'ต้น','ศุภชัย','Ton','ton@example.com','0810000003','Dealmaker','Referral',25000,'manager_interview',4.0,'2026-08-18 09:00:00'),
  (4,1,'ฟ้า','กมล','Fah','fah@example.com','0810000004','Video Editor','TikTok',32000,'offer',4.7,'2026-08-20 12:00:00'),
  (5,1,'เจ','อัคร','Jay','jay@example.com','0810000005','Operations Executive','Facebook Jobs',27000,'new',NULL,'2026-08-20 14:00:00');

INSERT OR IGNORE INTO leave_requests (
  id, client_id, employee_id, leave_type, start_date, end_date, reason, status, created_at
) VALUES
  (1,1,4,'sick','2026-08-20','2026-08-20','ไม่สบาย','approved','2026-08-20 07:30:00'),
  (2,1,2,'annual','2026-08-24','2026-08-25','ธุระส่วนตัว','pending','2026-08-20 09:20:00');

INSERT OR IGNORE INTO employee_requests (
  id, client_id, employee_id, request_type, subject, detail, status, created_at
) VALUES
  (1,1,3,'document','ขอหนังสือรับรองเงินเดือน','ใช้ยื่นเช่าคอนโด','received','2026-08-20 13:30:00');

INSERT OR IGNORE INTO attendance (
  id, client_id, employee_id, work_date, check_in_at, source, status, late_minutes
) VALUES
  (1,1,1,'2026-08-20','2026-08-20T03:56:00.000Z','line','present',0),
  (2,1,2,'2026-08-20','2026-08-20T04:14:00.000Z','line','late',4),
  (3,1,5,'2026-08-20','2026-08-20T03:52:00.000Z','line','present',0);
`;

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);

      if (url.pathname === '/api/health') {
        return json({ ok: true, service: 'Nakna HR', brand: 'นากนะ', version: '0.6.1', auth: 'google-oauth' });
      }

      if (url.pathname === '/auth/google/start' && request.method === 'GET') {
        return await startGoogleLogin(request, env);
      }
      if (url.pathname === '/auth/google/callback' && request.method === 'GET') {
        return await finishGoogleLogin(request, env);
      }
      if (url.pathname === '/auth/logout' && request.method === 'POST') {
        return await logoutSession(request, env);
      }
      if (url.pathname === '/integrations/gmail/start' && request.method === 'GET') {
        return await startGmailConnection(request, env);
      }
      if (url.pathname === '/integrations/gmail/callback' && request.method === 'GET') {
        return await finishGmailConnection(request, env);
      }

      const joinPageMatch = url.pathname.match(/^\/join\/([A-Za-z0-9_-]{20,})$/);
      if (joinPageMatch && request.method === 'GET') {
        return Response.redirect(`${appOrigin(request, env)}/invite.html?token=${encodeURIComponent(joinPageMatch[1])}`, 302);
      }

      const publicInviteMatch = url.pathname.match(/^\/api\/public\/invites\/([A-Za-z0-9_-]{20,})$/);
      if (publicInviteMatch && request.method === 'GET') {
        await ensureCoreSchema(env.DB);
        return await getPublicInvite(env.DB, publicInviteMatch[1]);
      }
      if (publicInviteMatch && request.method === 'POST') {
        await ensureCoreSchema(env.DB);
        return await acceptPublicInvite(request, env, publicInviteMatch[1]);
      }

      const sharedEvidenceMatch = url.pathname.match(/^\/evidence\/([A-Za-z0-9_-]{20,})$/);
      if (sharedEvidenceMatch && request.method === 'GET') {
        await ensureV050Ready(env.DB);
        return await serveSharedEvidence(env, sharedEvidenceMatch[1]);
      }

      const dedicatedLineWebhookMatch = url.pathname.match(/^\/webhooks\/line\/([A-Za-z0-9_-]{32,})$/);
      if (dedicatedLineWebhookMatch && request.method === 'POST') {
        await ensureV060Ready(env.DB);
        const integration = await getLineIntegrationByWebhookKey(env, dedicatedLineWebhookMatch[1]);
        if (!integration) return json({ error: 'LINE integration not found' }, 404);
        return await handleLineWebhook(request, env, ctx, integration);
      }

      if (url.pathname === '/webhooks/line' && request.method === 'POST') {
        return await handleLineWebhook(request, env, ctx, null);
      }

      if (url.pathname.startsWith('/api/')) {
        const auth = await authorizeUser(request, env, { requireCompany: !['/api/me','/api/companies','/api/onboarding/claim-company'].includes(url.pathname) });
        if (!auth.ok) return json({ error: auth.error }, auth.status);
        return await handleApi(request, env, url, auth);
      }

      return new Response('Not found', { status: 404 });
    } catch (error) {
      let pathname = 'unknown';
      try { pathname = new URL(request.url).pathname; } catch {}
      console.error(JSON.stringify({
        level: 'error',
        event: 'unhandled',
        pathname,
        message: String(error?.message || error),
        stack: String(error?.stack || '').slice(0, 2000),
      }));
      return json({ error: 'Internal server error', request_path: pathname }, 500);
    }
  },

  async scheduled(controller, env, ctx) {
    // Cloudflare Cron runs in UTC. 01:00 UTC = 08:00 Asia/Bangkok.
    await sendDailyHrBrief(env);
  },
};

async function handleApi(request, env, url, auth) {
  const method = request.method;
  const path = url.pathname;
  const clientId = auth.clientId ? Number(auth.clientId) : null;

  if (path === '/api/me' && method === 'GET') {
    const memberships = await getMemberships(env.DB, auth.user.id);
    const claimable = memberships.length ? null : await getClaimableLegacyCompany(env.DB);
    return json({
      user: publicUser(auth.user),
      companies: memberships,
      active_company_id: auth.clientId || null,
      claimable_company: claimable,
    });
  }

  if (path === '/api/bootstrap' && method === 'GET') {
    try {
      await ensureCoreSchema(env.DB);
      await ensureV060Ready(env.DB);
      await ensureV061Ready(env.DB);
      if (clientId) await ensureDefaultLeavePolicies(env.DB, clientId);
      return json({ ok: true, core_schema: 'ready', leave_policy: 'ready', line_integrations: 'ready', approver_permissions: 'ready' });
    } catch (error) {
      const detail = safeCoreSchemaErrorDetail(error);
      console.error(JSON.stringify({ level: 'error', event: 'core_schema_failed', detail }));
      return json({ error: 'CORE_SCHEMA_REPAIR_FAILED', stage: 'core_schema', detail }, 500);
    }
  }

  if (path === '/api/companies' && method === 'POST') {
    const body = await safeJson(request);
    const name = String(body.name || '').trim();
    if (name.length < 2) return json({ error: 'กรุณาใส่ชื่อบริษัท' }, 400);
    const created = await createCompanyForUser(env.DB, auth, name);
    await ensureCoreSchema(env.DB);
    await ensureDefaultLeavePolicies(env.DB, Number(created.id));
    return withCookie(json({ ok: true, company: created }, 201), companyCookie(created.id));
  }

  if (path === '/api/onboarding/claim-company' && method === 'POST') {
    await ensureCoreSchema(env.DB);
    const body = await safeJson(request);
    const claimable = await getClaimableLegacyCompany(env.DB);
    if (!claimable || Number(body.client_id) !== Number(claimable.id)) return json({ error: 'Workspace นี้ไม่สามารถรับช่วงได้แล้ว' }, 409);
    await env.DB.prepare(`INSERT OR IGNORE INTO company_members (client_id, user_id, role, status) VALUES (?1,?2,'owner','active')`).bind(Number(claimable.id), Number(auth.user.id)).run();
    await env.DB.prepare('UPDATE auth_sessions SET selected_client_id=?1 WHERE token_hash=?2').bind(Number(claimable.id), auth.sessionHash).run();
    await safeAudit(env.DB, Number(claimable.id), 'user', String(auth.user.id), 'company.claim', 'client', String(claimable.id), null);
    return withCookie(json({ ok: true, company: claimable }), companyCookie(claimable.id));
  }

  if (path === '/api/session/company' && method === 'POST') {
    const body = await safeJson(request);
    const nextClientId = Number(body.client_id);
    const member = await env.DB.prepare(`SELECT role FROM company_members WHERE user_id=?1 AND client_id=?2 AND status='active'`).bind(Number(auth.user.id), nextClientId).first();
    if (!member) return json({ error: 'คุณไม่มีสิทธิ์เข้าบริษัทนี้' }, 403);
    await env.DB.prepare('UPDATE auth_sessions SET selected_client_id=?1, last_seen_at=CURRENT_TIMESTAMP WHERE token_hash=?2').bind(nextClientId, auth.sessionHash).run();
    return withCookie(json({ ok: true, client_id: nextClientId }), companyCookie(nextClientId));
  }

  if (path === '/api/integrations/gmail' && method === 'GET') {
    const row = await env.DB.prepare(`SELECT email, scopes, access_expires_at, connected_at, updated_at FROM gmail_connections WHERE user_id=?1`).bind(Number(auth.user.id)).first();
    return json({ connected: Boolean(row), account: row || null });
  }

  if (path === '/api/integrations/gmail' && method === 'DELETE') {
    await env.DB.prepare('DELETE FROM gmail_connections WHERE user_id=?1').bind(Number(auth.user.id)).run();
    return json({ ok: true });
  }

  if (path === '/api/integrations/line' && method === 'GET') {
    await ensureV060Ready(env.DB);
    const integration = await getWorkspaceLineIntegration(env, clientId, false);
    if (integration) {
      let live = null;
      try {
        const creds = await decryptLineIntegrationCredentials(env, integration);
        live = await getLineWebhookInfo(creds.access_token);
        if (live) await env.DB.prepare('UPDATE line_integrations SET webhook_active=?1,updated_at=CURRENT_TIMESTAMP WHERE id=?2').bind(live.active ? 1 : 0, Number(integration.id)).run();
      } catch {}
      return json({ mode: 'dedicated', connected: true, integration: publicLineIntegration(integration, live, canManageIntegrations(auth.role)) });
    }
    let defaultBot = null;
    if (env.LINE_CHANNEL_ACCESS_TOKEN) { try { defaultBot = await getLineBotInfo(env.LINE_CHANNEL_ACCESS_TOKEN); } catch {} }
    return json({ mode: 'nakna_default', connected: false, default_available: Boolean(env.LINE_CHANNEL_ACCESS_TOKEN && env.LINE_CHANNEL_SECRET), bot: defaultBot ? { basic_id: defaultBot.basicId || null, display_name: defaultBot.displayName || 'นากนะ' } : null });
  }

  if (path === '/api/integrations/line' && method === 'PUT') {
    if (!canManageIntegrations(auth.role)) return json({ error: 'เฉพาะ Owner หรือ HR Admin ที่เชื่อม LINE OA ได้' }, 403);
    await ensureV060Ready(env.DB);
    const body = await safeJson(request);
    const channelSecret = String(body.channel_secret || '').trim();
    const accessToken = String(body.access_token || '').trim();
    const channelId = String(body.channel_id || '').trim() || null;
    if (channelSecret.length < 16 || accessToken.length < 20) return json({ error: 'กรุณาใส่ Channel Secret และ Channel Access Token ให้ครบ' }, 400);
    try {
      const saved = await saveWorkspaceLineIntegration(env, { clientId, userId: Number(auth.user.id), channelId, channelSecret, accessToken });
      await safeAudit(env.DB, clientId, 'user', String(auth.user.id), 'line.integration.connect', 'line_integration', String(saved.id), { bot: saved.bot_display_name });
      return json({ ok: true, integration: publicLineIntegration(saved) });
    } catch (error) {
      return json({ error: safeLineIntegrationError(error) }, 400);
    }
  }

  if (path === '/api/integrations/line/test' && method === 'POST') {
    if (!canManageIntegrations(auth.role)) return json({ error: 'ไม่มีสิทธิ์ทดสอบ LINE Integration' }, 403);
    await ensureV060Ready(env.DB);
    const integration = await getWorkspaceLineIntegration(env, clientId, false);
    if (!integration) return json({ error: 'ยังไม่ได้เชื่อม LINE Official Account' }, 404);
    try {
      const creds = await decryptLineIntegrationCredentials(env, integration);
      const [bot, webhook, test] = await Promise.all([getLineBotInfo(creds.access_token), getLineWebhookInfo(creds.access_token), testLineWebhook(creds.access_token, integration.webhook_url)]);
      const ok = Boolean(test?.success);
      await env.DB.prepare('UPDATE line_integrations SET webhook_active=?1,last_test_at=CURRENT_TIMESTAMP,last_error=?2,updated_at=CURRENT_TIMESTAMP WHERE id=?3')
        .bind(webhook?.active ? 1 : 0, ok ? null : String(test?.reason || test?.detail || 'webhook_test_failed'), Number(integration.id)).run();
      return json({ ok, bot: { display_name: bot.displayName, basic_id: bot.basicId }, webhook: { ...webhook, test } });
    } catch (error) {
      await env.DB.prepare('UPDATE line_integrations SET last_test_at=CURRENT_TIMESTAMP,last_error=?1,updated_at=CURRENT_TIMESTAMP WHERE id=?2').bind(String(error?.message || error).slice(0,300), Number(integration.id)).run();
      return json({ error: safeLineIntegrationError(error) }, 400);
    }
  }

  if (path === '/api/integrations/line' && method === 'DELETE') {
    if (!canManageIntegrations(auth.role)) return json({ error: 'เฉพาะ Owner หรือ HR Admin ที่ยกเลิก LINE Integration ได้' }, 403);
    const integration = await getWorkspaceLineIntegration(env, clientId, false);
    if (integration) {
      await env.DB.prepare('DELETE FROM line_integrations WHERE id=?1 AND client_id=?2').bind(Number(integration.id),clientId).run();
      await safeAudit(env.DB, clientId, 'user', String(auth.user.id), 'line.integration.disconnect', 'line_integration', String(integration.id), null);
    }
    return json({ ok: true, fallback: Boolean(env.LINE_CHANNEL_ACCESS_TOKEN && env.LINE_CHANNEL_SECRET) });
  }

  if (path === '/api/dashboard' && method === 'GET') {
    return json(await getDashboard(env.DB, clientId));
  }

  if (path === '/api/employees' && method === 'GET') {
    const result = await env.DB.prepare(`
      SELECT e.*, d.name AS department_name, p.name AS position_name,
             ap.nickname AS leave_approver_nickname, ap.first_name AS leave_approver_first_name, ap.last_name AS leave_approver_last_name,
             GROUP_CONCAT(DISTINCT wl.name) AS work_location_names
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN positions p ON p.id = e.position_id
      LEFT JOIN employees ap ON ap.id=e.leave_approver_employee_id
      LEFT JOIN employee_work_locations ewl ON ewl.employee_id=e.id
      LEFT JOIN work_locations wl ON wl.id=ewl.location_id AND wl.is_active=1
      WHERE e.client_id = ?1
      GROUP BY e.id
      ORDER BY e.status = 'active' DESC, e.first_name ASC
    `).bind(clientId).all();
    return json({ data: result.results });
  }

  if (path === '/api/employees' && method === 'POST') {
    const body = await safeJson(request);
    const required = ['employee_code', 'first_name', 'last_name', 'start_date'];
    for (const key of required) if (!body[key]) return json({ error: `Missing ${key}` }, 400);

    const result = await env.DB.prepare(`
      INSERT INTO employees (
        client_id, employee_code, first_name, last_name, nickname, email, phone,
        birth_date, start_date, probation_end_date, contract_end_date,
        department_id, position_id, employment_type, status
      ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,'active')
    `).bind(
      clientId, body.employee_code, body.first_name, body.last_name, body.nickname || null,
      body.email || null, body.phone || null, body.birth_date || null, body.start_date,
      body.probation_end_date || null, body.contract_end_date || null,
      body.department_id || null, body.position_id || null, body.employment_type || 'full_time'
    ).run();

    await audit(env.DB, clientId, 'user', String(auth.user.id), 'employee.create', 'employee', String(result.meta.last_row_id), body);
    return json({ ok: true, id: result.meta.last_row_id }, 201);
  }

  const employeeLinkMatch = path.match(/^\/api\/employees\/(\d+)\/line-link-code$/);
  if (employeeLinkMatch && method === 'POST') {
    const employeeId = Number(employeeLinkMatch[1]);
    const employee = await env.DB.prepare('SELECT id, client_id, line_user_id FROM employees WHERE id = ?1').bind(employeeId).first();
    if (!employee || Number(employee.client_id) !== clientId) return json({ error: 'Employee not found' }, 404);
    if (employee.line_user_id) return json({ error: 'Employee already linked to LINE' }, 409);

    const token = randomDigits(6);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await env.DB.prepare(`
      INSERT INTO line_link_tokens (token, employee_id, expires_at)
      VALUES (?1, ?2, ?3)
      ON CONFLICT(token) DO UPDATE SET employee_id = excluded.employee_id, expires_at = excluded.expires_at, used_at = NULL
    `).bind(token, employeeId, expiresAt).run();
    return json({ ok: true, token, expires_at: expiresAt, instruction: `ส่งข้อความ LINK ${token} ไปที่ LINE OA` });
  }

  if (path === '/api/lookups' && method === 'GET') {
    const [departments, positions, locations] = await env.DB.batch([
      env.DB.prepare('SELECT id,name,code FROM departments WHERE client_id=?1 ORDER BY name').bind(clientId),
      env.DB.prepare('SELECT id,department_id,name FROM positions WHERE client_id=?1 ORDER BY name').bind(clientId),
      env.DB.prepare('SELECT id,name,address,latitude,longitude,radius_m,is_active FROM work_locations WHERE client_id=?1 AND is_active=1 ORDER BY name').bind(clientId),
    ]);
    return json({
      departments: departments.results || [],
      positions: positions.results || [],
      locations: locations.results || [],
    });
  }

  if (path === '/api/invites' && method === 'GET') {
    const result = await env.DB.prepare(`
      SELECT i.id, i.token_value, i.token_hint, i.employee_role, i.start_date, i.expires_at, i.max_uses, i.used_count, i.status, i.created_at,
             d.name AS department_name, p.name AS position_name,
             GROUP_CONCAT(DISTINCT wl.name) AS location_names
      FROM employee_invites i
      LEFT JOIN departments d ON d.id=i.department_id
      LEFT JOIN positions p ON p.id=i.position_id
      LEFT JOIN employee_invite_locations eil ON eil.invite_id=i.id
      LEFT JOIN work_locations wl ON wl.id=eil.location_id
      WHERE i.client_id=?1
      GROUP BY i.id
      ORDER BY i.created_at DESC
      LIMIT 100
    `).bind(clientId).all();
    return json({ data: (result.results || []).map(row => ({
      ...row,
      invite_url: row.token_value ? `${appOrigin(request, env)}/invite.html?token=${encodeURIComponent(row.token_value)}` : null,
      token_value: undefined,
    })) });
  }

  if (path === '/api/invites' && method === 'POST') {
    if (!canManagePeople(auth.role)) return json({ error: 'ไม่มีสิทธิ์สร้างลิงก์เชิญ' }, 403);
    const body = await safeJson(request);
    const maxUses = Math.max(1, Math.min(100, Number(body.max_uses || 1)));
    const expiresDays = Math.max(1, Math.min(30, Number(body.expires_days || 7)));
    const departmentId = body.department_id ? Number(body.department_id) : null;
    const positionId = body.position_id ? Number(body.position_id) : null;
    const startDate = body.start_date || null;
    const locationIds = [...new Set((Array.isArray(body.location_ids) ? body.location_ids : []).map(Number).filter(Number.isFinite))];

    if (departmentId) {
      const row = await env.DB.prepare('SELECT id FROM departments WHERE id=?1 AND client_id=?2').bind(departmentId, clientId).first();
      if (!row) return json({ error: 'แผนกไม่อยู่ในบริษัทนี้' }, 400);
    }
    if (positionId) {
      const row = await env.DB.prepare('SELECT id FROM positions WHERE id=?1 AND client_id=?2').bind(positionId, clientId).first();
      if (!row) return json({ error: 'ตำแหน่งไม่อยู่ในบริษัทนี้' }, 400);
    }
    for (const locationId of locationIds) {
      const row = await env.DB.prepare('SELECT id FROM work_locations WHERE id=?1 AND client_id=?2 AND is_active=1').bind(locationId, clientId).first();
      if (!row) return json({ error: 'มี Work Location ที่ไม่อยู่ในบริษัทนี้' }, 400);
    }

    const token = randomToken(24);
    const tokenHash = await sha256Hex(token);
    const expiresAt = new Date(Date.now() + expiresDays * 86400000).toISOString();
    const result = await env.DB.prepare(`
      INSERT INTO employee_invites (client_id,token_hash,token_value,token_hint,department_id,position_id,employee_role,start_date,expires_at,max_uses,used_count,status,created_by_user_id)
      VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,0,'active',?11)
    `).bind(clientId, tokenHash, token, token.slice(-6), departmentId, positionId, body.employee_role || 'employee', startDate, expiresAt, maxUses, Number(auth.user.id)).run();
    const inviteId = Number(result.meta.last_row_id);
    for (const locationId of locationIds) {
      await env.DB.prepare('INSERT OR IGNORE INTO employee_invite_locations (invite_id,location_id) VALUES (?1,?2)').bind(inviteId, locationId).run();
    }
    await safeAudit(env.DB, clientId, 'user', String(auth.user.id), 'employee_invite.create', 'employee_invite', String(inviteId), { max_uses: maxUses, location_ids: locationIds });
    return json({
      ok: true,
      id: inviteId,
      invite_url: `${appOrigin(request, env)}/invite.html?token=${encodeURIComponent(token)}`,
      expires_at: expiresAt,
      max_uses: maxUses,
    }, 201);
  }

  const revokeInviteMatch = path.match(/^\/api\/invites\/(\d+)\/revoke$/);
  if (revokeInviteMatch && method === 'POST') {
    if (!canManagePeople(auth.role)) return json({ error: 'ไม่มีสิทธิ์ยกเลิกลิงก์เชิญ' }, 403);
    const id = Number(revokeInviteMatch[1]);
    await env.DB.prepare("UPDATE employee_invites SET status='revoked',updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND client_id=?2").bind(id, clientId).run();
    return json({ ok: true });
  }

  if (path === '/api/work-locations' && method === 'GET') {
    const result = await env.DB.prepare('SELECT * FROM work_locations WHERE client_id=?1 ORDER BY is_active DESC,name').bind(clientId).all();
    return json({ data: result.results || [] });
  }

  if (path === '/api/work-locations' && method === 'POST') {
    if (!canManagePeople(auth.role)) return json({ error: 'ไม่มีสิทธิ์จัดการ Work Location' }, 403);
    const body = await safeJson(request);
    const name = String(body.name || '').trim();
    const lat = Number(body.latitude);
    const lng = Number(body.longitude);
    const radius = Math.max(30, Math.min(5000, Number(body.radius_m || 150)));
    if (name.length < 2 || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return json({ error: 'กรุณาใส่ชื่อและพิกัด Work Location ให้ครบ' }, 400);
    }
    const result = await env.DB.prepare(`INSERT INTO work_locations (client_id,name,address,latitude,longitude,radius_m,is_active) VALUES (?1,?2,?3,?4,?5,?6,1)`)
      .bind(clientId, name, body.address || null, lat, lng, radius).run();
    return json({ ok: true, id: result.meta.last_row_id }, 201);
  }

  const locationMatch = path.match(/^\/api\/work-locations\/(\d+)$/);
  if (locationMatch && method === 'PATCH') {
    if (!canManagePeople(auth.role)) return json({ error: 'ไม่มีสิทธิ์จัดการ Work Location' }, 403);
    const id = Number(locationMatch[1]);
    const body = await safeJson(request);
    const existing = await env.DB.prepare('SELECT * FROM work_locations WHERE id=?1 AND client_id=?2').bind(id, clientId).first();
    if (!existing) return json({ error: 'ไม่พบ Work Location' }, 404);
    await env.DB.prepare(`UPDATE work_locations SET name=?1,address=?2,latitude=?3,longitude=?4,radius_m=?5,is_active=?6,updated_at=CURRENT_TIMESTAMP WHERE id=?7 AND client_id=?8`)
      .bind(
        String(body.name ?? existing.name).trim(),
        body.address ?? existing.address,
        Number(body.latitude ?? existing.latitude),
        Number(body.longitude ?? existing.longitude),
        Math.max(30, Math.min(5000, Number(body.radius_m ?? existing.radius_m))),
        body.is_active == null ? Number(existing.is_active) : (body.is_active ? 1 : 0),
        id, clientId
      ).run();
    return json({ ok: true });
  }

  if (path === '/api/candidates' && method === 'GET') {
    const result = await env.DB.prepare(`
      SELECT * FROM candidates WHERE client_id = ?1
      ORDER BY CASE stage
        WHEN 'new' THEN 1 WHEN 'screening' THEN 2 WHEN 'hr_interview' THEN 3
        WHEN 'manager_interview' THEN 4 WHEN 'assignment' THEN 5 WHEN 'offer' THEN 6
        WHEN 'hired' THEN 7 ELSE 8 END, updated_at DESC
    `).bind(clientId).all();
    return json({ data: result.results });
  }

  if (path === '/api/candidates' && method === 'POST') {
    const body = await safeJson(request);
    if (!body.first_name || !body.last_name || !body.position_name) return json({ error: 'Missing candidate name or position' }, 400);
    const result = await env.DB.prepare(`
      INSERT INTO candidates (
        client_id, first_name, last_name, nickname, email, phone, position_name,
        source, expected_salary, available_start_date, stage, notes
      ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)
    `).bind(
      clientId, body.first_name, body.last_name, body.nickname || null, body.email || null,
      body.phone || null, body.position_name, body.source || null, body.expected_salary || null,
      body.available_start_date || null, body.stage || 'new', body.notes || null
    ).run();
    return json({ ok: true, id: result.meta.last_row_id }, 201);
  }

  const candidateStageMatch = path.match(/^\/api\/candidates\/(\d+)\/stage$/);
  if (candidateStageMatch && method === 'PATCH') {
    const body = await safeJson(request);
    const allowed = ['new','screening','hr_interview','manager_interview','assignment','offer','hired','rejected'];
    if (!allowed.includes(body.stage)) return json({ error: 'Invalid stage' }, 400);
    await env.DB.prepare(`
      UPDATE candidates SET stage = ?1, last_activity_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?2 AND client_id = ?3
    `).bind(body.stage, Number(candidateStageMatch[1]), clientId).run();
    return json({ ok: true });
  }

  if (path === '/api/approver-access' && method === 'GET') {
    await ensureV061Ready(env.DB);
    if (!canManageApproverAccess(auth.role)) return json({ error: 'ไม่มีสิทธิ์ดูหรือจัดการสิทธิ์ผู้อนุมัติ' }, 403);
    const rows = await env.DB.prepare(`
      SELECT e.id,e.employee_code,e.first_name,e.last_name,e.nickname,e.status,e.line_user_id,e.line_display_name,e.line_picture_url,
             d.name AS department_name, GROUP_CONCAT(ep.permission_key) AS permission_keys
      FROM employees e
      LEFT JOIN departments d ON d.id=e.department_id
      LEFT JOIN employee_permissions ep ON ep.employee_id=e.id AND ep.client_id=e.client_id
      WHERE e.client_id=?1 AND e.status='active'
      GROUP BY e.id
      ORDER BY e.first_name,e.last_name
    `).bind(clientId).all();
    return json({ data:(rows.results||[]).map(row=>({ ...row, permissions:String(row.permission_keys||'').split(',').filter(Boolean) })), catalog:approverPermissionCatalog() });
  }

  const approverAccessMatch = path.match(/^\/api\/approver-access\/(\d+)$/);
  if (approverAccessMatch && method === 'PUT') {
    await ensureV061Ready(env.DB);
    if (!canManageApproverAccess(auth.role)) return json({ error: 'ไม่มีสิทธิ์จัดการสิทธิ์ผู้อนุมัติ' }, 403);
    const employeeId=Number(approverAccessMatch[1]);
    const employee=await getEmployeeForClient(env.DB,employeeId,clientId);
    if(!employee) return json({error:'ไม่พบพนักงาน'},404);
    const body=await safeJson(request);
    const requested=[...new Set((Array.isArray(body.permissions)?body.permissions:[]).map(String).filter(key=>APPROVER_PERMISSION_KEYS.has(key)))];
    const previous=(await env.DB.prepare('SELECT permission_key FROM employee_permissions WHERE client_id=?1 AND employee_id=?2').bind(clientId,employeeId).all()).results||[];
    const previousKeys=new Set(previous.map(row=>row.permission_key));
    const statements=[env.DB.prepare('DELETE FROM employee_permissions WHERE client_id=?1 AND employee_id=?2').bind(clientId,employeeId)];
    for(const key of requested) statements.push(env.DB.prepare('INSERT INTO employee_permissions (client_id,employee_id,permission_key,granted_by_user_id) VALUES (?1,?2,?3,?4)').bind(clientId,employeeId,key,Number(auth.user.id)));
    await env.DB.batch(statements);
    if(previousKeys.has('leave.approve')&&!requested.includes('leave.approve')){
      await env.DB.batch([
        env.DB.prepare('UPDATE employees SET leave_approver_employee_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE client_id=?1 AND leave_approver_employee_id=?2').bind(clientId,employeeId),
        env.DB.prepare("UPDATE leave_requests SET approver_employee_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE client_id=?1 AND approver_employee_id=?2 AND status='pending'").bind(clientId,employeeId)
      ]);
    }
    await safeAudit(env.DB,clientId,'user',String(auth.user.id),'approver.permissions.update','employee',String(employeeId),{permissions:requested});
    return json({ok:true,employee_id:employeeId,permissions:requested});
  }

  if (path === '/api/leave-policies' && method === 'GET') {
    await ensureDefaultLeavePolicies(env.DB, clientId);
    const result = await env.DB.prepare(`SELECT * FROM leave_policies WHERE client_id=?1 ORDER BY sort_order,name`).bind(clientId).all();
    return json({ data: result.results || [] });
  }

  if (path === '/api/leave-policies' && method === 'POST') {
    if (!canManagePeople(auth.role)) return json({ error: 'ไม่มีสิทธิ์จัดการนโยบายลา' }, 403);
    const body = await safeJson(request);
    const name = String(body.name || '').trim();
    const code = slugCode(body.code || name);
    if (name.length < 2 || !code) return json({ error: 'กรุณาใส่ชื่อประเภทลา' }, 400);
    const result = await env.DB.prepare(`
      INSERT INTO leave_policies (client_id,code,name,default_entitlement_days,is_unlimited,requires_reason,evidence_required_after_days,notice_days,allow_negative,is_active,sort_order)
      VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,1,?10)
    `).bind(clientId, code, name, num(body.default_entitlement_days,0), body.is_unlimited?1:0, body.requires_reason===false?0:1,
      nullableNum(body.evidence_required_after_days), Math.max(0,Math.floor(num(body.notice_days,0))), body.allow_negative?1:0, Math.floor(num(body.sort_order,100))).run();
    return json({ ok:true, id:result.meta.last_row_id },201);
  }

  const leavePolicyMatch = path.match(/^\/api\/leave-policies\/(\d+)$/);
  if (leavePolicyMatch && method === 'PATCH') {
    if (!canManagePeople(auth.role)) return json({ error: 'ไม่มีสิทธิ์จัดการนโยบายลา' }, 403);
    const id=Number(leavePolicyMatch[1]);
    const existing=await env.DB.prepare('SELECT * FROM leave_policies WHERE id=?1 AND client_id=?2').bind(id,clientId).first();
    if(!existing) return json({error:'ไม่พบนโยบายลา'},404);
    const body=await safeJson(request);
    await env.DB.prepare(`UPDATE leave_policies SET name=?1,default_entitlement_days=?2,is_unlimited=?3,requires_reason=?4,evidence_required_after_days=?5,notice_days=?6,allow_negative=?7,is_active=?8,sort_order=?9,updated_at=CURRENT_TIMESTAMP WHERE id=?10 AND client_id=?11`)
      .bind(String(body.name ?? existing.name).trim(),num(body.default_entitlement_days,existing.default_entitlement_days),body.is_unlimited==null?Number(existing.is_unlimited):(body.is_unlimited?1:0),body.requires_reason==null?Number(existing.requires_reason):(body.requires_reason?1:0),body.evidence_required_after_days===undefined?existing.evidence_required_after_days:nullableNum(body.evidence_required_after_days),Math.max(0,Math.floor(num(body.notice_days,existing.notice_days))),body.allow_negative==null?Number(existing.allow_negative):(body.allow_negative?1:0),body.is_active==null?Number(existing.is_active):(body.is_active?1:0),Math.floor(num(body.sort_order,existing.sort_order)),id,clientId).run();
    return json({ok:true});
  }

  const employeeLeaveProfileMatch = path.match(/^\/api\/employees\/(\d+)\/leave-profile$/);
  if (employeeLeaveProfileMatch && method === 'GET') {
    const employeeId=Number(employeeLeaveProfileMatch[1]);
    const employee=await getEmployeeForClient(env.DB,employeeId,clientId);
    if(!employee) return json({error:'ไม่พบพนักงาน'},404);
    const year=Math.floor(num(url.searchParams.get('year'), new Date().getFullYear()));
    return json(await getEmployeeLeaveProfile(env.DB,employeeId,clientId,year));
  }
  if (employeeLeaveProfileMatch && method === 'PUT') {
    if (!canManagePeople(auth.role)) return json({ error: 'ไม่มีสิทธิ์จัดการสิทธิ์ลา' }, 403);
    const employeeId=Number(employeeLeaveProfileMatch[1]);
    const employee=await getEmployeeForClient(env.DB,employeeId,clientId);
    if(!employee) return json({error:'ไม่พบพนักงาน'},404);
    const body=await safeJson(request);
    const approverId=body.leave_approver_employee_id ? Number(body.leave_approver_employee_id) : null;
    if(approverId){ const approver=await getEmployeeForClient(env.DB,approverId,clientId); if(!approver) return json({error:'ผู้อนุมัติไม่อยู่ในบริษัทนี้'},400); if(!await employeeHasPermission(env.DB,clientId,approverId,'leave.approve')) return json({error:'พนักงานคนนี้ยังไม่มีสิทธิ์ “อนุมัติการลา” กรุณาเพิ่มสิทธิ์ผู้อนุมัติก่อน'},409); }
    await env.DB.prepare('UPDATE employees SET leave_approver_employee_id=?1,updated_at=CURRENT_TIMESTAMP WHERE id=?2 AND client_id=?3').bind(approverId,employeeId,clientId).run();
    if(approverId){
      const waiting=(await env.DB.prepare("SELECT id FROM leave_requests WHERE employee_id=?1 AND client_id=?2 AND status='pending' AND approver_employee_id IS NULL").bind(employeeId,clientId).all()).results||[];
      await env.DB.prepare("UPDATE leave_requests SET approver_employee_id=?1,updated_at=CURRENT_TIMESTAMP WHERE employee_id=?2 AND client_id=?3 AND status='pending' AND approver_employee_id IS NULL").bind(approverId,employeeId,clientId).run();
      for(const requestRow of waiting) await notifyLeaveApprover(env,Number(requestRow.id));
    }
    const year=Math.floor(num(body.year,new Date().getFullYear()));
    for(const item of Array.isArray(body.entitlements)?body.entitlements:[]){
      const policyId=Number(item.policy_id); if(!policyId) continue;
      const policy=await env.DB.prepare('SELECT id FROM leave_policies WHERE id=?1 AND client_id=?2').bind(policyId,clientId).first(); if(!policy) continue;
      await env.DB.prepare(`INSERT INTO employee_leave_entitlements (client_id,employee_id,leave_policy_id,year,entitlement_days,adjustment_days,note,updated_by_user_id) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)
        ON CONFLICT(employee_id,leave_policy_id,year) DO UPDATE SET entitlement_days=excluded.entitlement_days,adjustment_days=excluded.adjustment_days,note=excluded.note,updated_by_user_id=excluded.updated_by_user_id,updated_at=CURRENT_TIMESTAMP`)
        .bind(clientId,employeeId,policyId,year,num(item.entitlement_days,0),num(item.adjustment_days,0),item.note||null,Number(auth.user.id)).run();
    }
    await safeAudit(env.DB,clientId,'user',String(auth.user.id),'leave.entitlement.update','employee',String(employeeId),{year,approver_id:approverId});
    return json({ok:true,profile:await getEmployeeLeaveProfile(env.DB,employeeId,clientId,year)});
  }

  const evidenceMatch = path.match(/^\/api\/leave-evidence\/(\d+)$/);
  if (evidenceMatch && method === 'GET') {
    const row=await env.DB.prepare(`SELECT ev.* FROM leave_request_evidence ev JOIN leave_requests lr ON lr.id=ev.leave_request_id WHERE ev.id=?1 AND ev.client_id=?2`).bind(Number(evidenceMatch[1]),clientId).first();
    if(!row) return json({error:'ไม่พบหลักฐาน'},404);
    if(!env.EVIDENCE_BUCKET) return json({error:'Evidence storage ยังไม่พร้อม'},503);
    const object=await env.EVIDENCE_BUCKET.get(row.r2_key);
    if(!object) return json({error:'ไม่พบไฟล์หลักฐาน'},404);
    const headers=new Headers(); object.writeHttpMetadata(headers); headers.set('cache-control','private, max-age=60'); headers.set('content-disposition',`inline; filename*=UTF-8''${encodeURIComponent(row.file_name||'evidence')}`);
    return new Response(object.body,{headers});
  }

  if (path === '/api/attendance/today' && method === 'GET') {
    const client = await getClient(env.DB, clientId);
    if (!client) return json({ error: 'Client not found' }, 404);
    const workDate = dateInBangkok();
    const result = await env.DB.prepare(`
      SELECT e.id AS employee_id, e.employee_code, e.first_name, e.last_name, e.nickname,
             d.name AS department_name, a.check_in_at, a.check_out_at,
             CASE WHEN lr.id IS NOT NULL AND a.check_in_at IS NULL THEN 'leave' ELSE a.status END AS status, a.late_minutes,
             lr.id AS leave_request_id, lp.name AS leave_name,
             a.checkin_lat, a.checkin_lng, a.checkin_location_id, a.checkin_location_name, a.checkin_distance_m,
             a.checkout_lat, a.checkout_lng, a.checkout_location_id, a.checkout_location_name, a.checkout_distance_m
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN attendance a ON a.employee_id = e.id AND a.work_date = ?1
      LEFT JOIN leave_requests lr ON lr.employee_id=e.id AND lr.status='approved' AND ?1 BETWEEN lr.start_date AND lr.end_date
      LEFT JOIN leave_policies lp ON lp.id=lr.policy_id
      WHERE e.client_id = ?2 AND e.status = 'active'
      ORDER BY e.first_name
    `).bind(workDate, clientId).all();
    return json({ work_date: workDate, data: result.results });
  }

  if (path === '/api/attendance/check-in' && method === 'POST') {
    const body = await safeJson(request);
    if (!body.employee_id) return json({ error: 'Missing employee_id' }, 400);
    try {
      const result = await checkIn(env.DB, Number(body.employee_id), body.lat, body.lng, body.source || 'dashboard');
      return json({ ok: true, ...result });
    } catch (e) {
      return json({ error: e.message }, e.status || 400);
    }
  }

  if (path === '/api/attendance/check-out' && method === 'POST') {
    const body = await safeJson(request);
    if (!body.employee_id) return json({ error: 'Missing employee_id' }, 400);
    try {
      const result = await checkOut(env.DB, Number(body.employee_id), body.lat, body.lng, body.source || 'dashboard');
      return json({ ok: true, ...result });
    } catch (e) {
      return json({ error: e.message }, e.status || 400);
    }
  }

  if (path === '/api/leaves' && method === 'GET') {
    const result = await env.DB.prepare(`
      SELECT l.*, e.first_name,e.last_name,e.nickname,e.employee_code,
             lp.name AS leave_type_name, lp.code AS leave_policy_code,
             ap.nickname AS approver_nickname,ap.first_name AS approver_first_name,ap.last_name AS approver_last_name,
             (SELECT COUNT(*) FROM leave_request_evidence ev WHERE ev.leave_request_id=l.id) AS evidence_count
      FROM leave_requests l
      JOIN employees e ON e.id=l.employee_id
      LEFT JOIN leave_policies lp ON lp.id=l.policy_id
      LEFT JOIN employees ap ON ap.id=l.approver_employee_id
      WHERE l.client_id=?1 ORDER BY l.created_at DESC LIMIT 300
    `).bind(clientId).all();
    return json({ data: result.results || [] });
  }

  if (path === '/api/leaves' && method === 'POST') {
    if (!canManagePeople(auth.role)) return json({error:'ไม่มีสิทธิ์สร้างคำขอลาแทนพนักงาน'},403);
    const body=await safeJson(request);
    try{
      const requestRow=await createLeaveRequest(env,{
        clientId,employeeId:Number(body.employee_id),policyId:Number(body.policy_id||0),leaveType:body.leave_type,
        startDate:body.start_date,endDate:body.end_date,dayPart:body.day_part||'full',reason:String(body.reason||'').trim(),submittedVia:'dashboard',submittedByUserId:Number(auth.user.id)
      });
      await safeAudit(env.DB,clientId,'user',String(auth.user.id),'leave.create','leave_request',String(requestRow.id),null);
      if(requestRow.status==='pending') await notifyLeaveApprover(env,requestRow.id);
      else if(requestRow.status==='awaiting_evidence') await notifyEmployeeEvidenceRequired(env,requestRow.id);
      return json({ok:true,id:requestRow.id,status:requestRow.status},201);
    }catch(e){ return json({error:e.message},e.status||400); }
  }

  const leaveStatusMatch = path.match(/^\/api\/leaves\/(\d+)\/(approve|reject)$/);
  if (leaveStatusMatch && method === 'PATCH') {
    if(!canOverrideLeave(auth.role)) return json({error:'การอนุมัติแทนใน Dashboard จำกัดเฉพาะ Owner/HR · ผู้อนุมัติปกติกดผ่าน LINE'},403);
    const body=await safeJson(request);
    try{
      const result=await decideLeaveRequest(env,Number(leaveStatusMatch[1]),leaveStatusMatch[2]==='approve'?'approved':'rejected',{
        actorType:'user',actorUserId:Number(auth.user.id),reason:String(body.reason||'').trim(),clientId
      });
      return json({ok:true,status:result.status});
    }catch(e){return json({error:e.message},e.status||400);}
  }

  const leaveEvidenceUploadMatch=path.match(/^\/api\/leaves\/(\d+)\/evidence$/);
  if(leaveEvidenceUploadMatch && method==='POST'){
    if(!canManagePeople(auth.role)) return json({error:'ไม่มีสิทธิ์อัปโหลดหลักฐาน'},403);
    if(!env.EVIDENCE_BUCKET) return json({error:'Evidence storage ยังไม่พร้อม'},503);
    const requestId=Number(leaveEvidenceUploadMatch[1]); const row=await getLeaveRequestDetail(env.DB,requestId,clientId); if(!row) return json({error:'ไม่พบคำขอลา'},404);
    const form=await request.formData(); const file=form.get('file'); if(!file||typeof file.arrayBuffer!=='function') return json({error:'กรุณาเลือกไฟล์'},400);
    if(Number(file.size||0)>10*1024*1024) return json({error:'ไฟล์ใหญ่เกิน 10 MB'},413);
    const key=`client-${clientId}/leave-${requestId}/${crypto.randomUUID()}-${String(file.name||'evidence').replace(/[^A-Za-z0-9._-]/g,'_')}`;
    await env.EVIDENCE_BUCKET.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type||'application/octet-stream'}});
    await env.DB.prepare(`INSERT INTO leave_request_evidence (client_id,leave_request_id,r2_key,file_name,content_type,file_size,source) VALUES (?1,?2,?3,?4,?5,?6,'dashboard')`).bind(clientId,requestId,key,file.name||'evidence',file.type||'application/octet-stream',Number(file.size||0)).run();
    await env.DB.prepare("UPDATE leave_requests SET status=CASE WHEN status='awaiting_evidence' THEN 'pending' ELSE status END,evidence_count=(SELECT COUNT(*) FROM leave_request_evidence WHERE leave_request_id=?1),updated_at=CURRENT_TIMESTAMP WHERE id=?1").bind(requestId).run();
    await notifyLeaveApprover(env,requestId);
    return json({ok:true});
  }

  const leaveDetailMatch=path.match(/^\/api\/leaves\/(\d+)$/);
  if(leaveDetailMatch && method==='GET'){
    const id=Number(leaveDetailMatch[1]);
    const row=await getLeaveRequestDetail(env.DB,id,clientId); if(!row) return json({error:'ไม่พบคำขอลา'},404);
    const [evidence,events]=await env.DB.batch([
      env.DB.prepare('SELECT id,file_name,content_type,file_size,source,created_at FROM leave_request_evidence WHERE leave_request_id=?1 ORDER BY created_at').bind(id),
      env.DB.prepare('SELECT * FROM leave_approval_events WHERE leave_request_id=?1 ORDER BY created_at').bind(id)
    ]);
    return json({data:row,evidence:evidence.results||[],events:events.results||[]});
  }

  if (path === '/api/requests' && method === 'GET') {
    const result = await env.DB.prepare(`
      SELECT r.*, e.first_name, e.last_name, e.nickname
      FROM employee_requests r JOIN employees e ON e.id = r.employee_id
      WHERE r.client_id = ?1 ORDER BY r.created_at DESC
    `).bind(clientId).all();
    return json({ data: result.results });
  }

  return json({ error: 'API route not found' }, 404);
}

async function getDashboard(db, clientId) {
  const client = await getClient(db, clientId);
  if (!client) throw new Error('Client not found');
  const today = dateInBangkok();
  const nowIso = new Date().toISOString();

  const [employeesRes, attendanceRes, leaveRes, candidatesRes, requestsRes] = await db.batch([
    db.prepare(`SELECT e.*, d.name AS department_name, p.name AS position_name FROM employees e
                LEFT JOIN departments d ON d.id=e.department_id LEFT JOIN positions p ON p.id=e.position_id
                WHERE e.client_id=?1 AND e.status='active'`).bind(clientId),
    db.prepare(`SELECT * FROM attendance WHERE client_id=?1 AND work_date=?2`).bind(clientId, today),
    db.prepare(`SELECT l.*, e.nickname, e.first_name FROM leave_requests l JOIN employees e ON e.id=l.employee_id
                WHERE l.client_id=?1 AND l.status IN ('pending','awaiting_evidence')`).bind(clientId),
    db.prepare(`SELECT * FROM candidates WHERE client_id=?1`).bind(clientId),
    db.prepare(`SELECT r.*, e.nickname, e.first_name FROM employee_requests r JOIN employees e ON e.id=r.employee_id
                WHERE r.client_id=?1 AND r.status NOT IN ('ready','delivered','closed')`).bind(clientId),
  ]);

  const employees = employeesRes.results || [];
  const attendance = attendanceRes.results || [];
  const leaves = leaveRes.results || [];
  const candidates = candidatesRes.results || [];
  const requests = requestsRes.results || [];
  const attendanceByEmployee = new Map(attendance.map(a => [Number(a.employee_id), a]));

  const onLeaveTodayIds = new Set();
  const approvedLeaveToday = await db.prepare(`
    SELECT employee_id FROM leave_requests
    WHERE client_id=?1 AND status='approved' AND start_date <= ?2 AND end_date >= ?2
  `).bind(clientId, today).all();
  for (const row of approvedLeaveToday.results || []) onLeaveTodayIds.add(Number(row.employee_id));

  const present = employees.filter(e => { const a=attendanceByEmployee.get(Number(e.id)); return Boolean(a?.check_in_at || ['present','late'].includes(a?.status)); }).length;
  const late = attendance.filter(a => a.status === 'late').length;
  const onLeave = employees.filter(e => onLeaveTodayIds.has(Number(e.id))).length;
  const missing = Math.max(0, employees.length - present - onLeave);

  const birthdays = upcomingBirthdays(employees, today, Number(client.birthday_reminder_days || 7));
  const probation = employees.filter(e => e.probation_end_date && daysBetween(today, e.probation_end_date) >= 0 && daysBetween(today, e.probation_end_date) <= 14)
    .map(e => ({ id: e.id, name: displayName(e), date: e.probation_end_date, days: daysBetween(today, e.probation_end_date) }));
  const contracts = employees.filter(e => e.contract_end_date && daysBetween(today, e.contract_end_date) >= 0 && daysBetween(today, e.contract_end_date) <= 30)
    .map(e => ({ id: e.id, name: displayName(e), date: e.contract_end_date, days: daysBetween(today, e.contract_end_date) }));
  const staleCandidates = candidates.filter(c => !['hired','rejected'].includes(c.stage) && hoursBetween(c.last_activity_at, nowIso) >= 72)
    .map(c => ({ id: c.id, name: `${c.nickname || c.first_name} · ${c.position_name}`, stage: c.stage, hours: Math.floor(hoursBetween(c.last_activity_at, nowIso)) }));

  const stages = {};
  for (const c of candidates) stages[c.stage] = (stages[c.stage] || 0) + 1;

  const attention = [
    { key: 'missing', level: 'danger', label: 'ยังไม่ Check-in', count: missing },
    { key: 'leave_pending', level: 'warning', label: 'ใบลารออนุมัติ', count: leaves.length },
    { key: 'probation', level: 'purple', label: 'Probation ใกล้ครบ', count: probation.length },
    { key: 'contract', level: 'warning', label: 'สัญญาใกล้หมด', count: contracts.length },
    { key: 'candidate', level: 'purple', label: 'Candidate รอ Action > 3 วัน', count: staleCandidates.length },
    { key: 'request', level: 'info', label: 'HR Request ค้าง', count: requests.length },
  ].filter(x => x.count > 0);

  return {
    client: { id: client.id, name: client.name, work_start: client.work_start, timezone: client.timezone },
    today,
    summary: { employees: employees.length, present, late, leave: onLeave, missing },
    attention,
    birthdays,
    probation,
    contracts,
    stale_candidates: staleCandidates,
    recruitment: stages,
    pending_leaves: leaves.slice(0, 6),
    requests: requests.slice(0, 6),
    recent_attendance: attendance.slice(0, 8),
  };
}

async function handleLineWebhook(request, env, ctx, integration = null) {
  const lineCtx = integration || defaultLineContext(env);
  if (!lineCtx?.channelSecret || !lineCtx?.accessToken) return json({ error: 'LINE integration not configured' }, 503);

  const signature = request.headers.get('x-line-signature') || '';
  const rawBody = await request.text();
  const valid = await verifyLineSignature(rawBody, signature, lineCtx.channelSecret);
  if (!valid) return json({ error: 'Invalid LINE signature' }, 401);
  await ensureV050Ready(env.DB);
  await ensureV060Ready(env.DB);

  let payload;
  try { payload = JSON.parse(rawBody); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const work = Promise.all((payload.events || []).map(event => processLineEvent(event, env, lineCtx)));
  ctx.waitUntil(work);
  return json({ ok: true });
}

async function processLineEvent(event, env, lineCtx) {
  const lineUserId = event?.source?.userId;
  if (!lineUserId || !event.replyToken) return;
  const accessToken = lineCtx.accessToken;
  const providerScope = lineCtx.providerScope || 'default';
  const sessionKey = lineSessionKey(providerScope, lineUserId);

  const employee = async () => {
    if (lineCtx.clientId) {
      return env.DB.prepare(`SELECT e.*, c.name AS company_name FROM employees e JOIN clients c ON c.id=e.client_id WHERE e.client_id=?1 AND e.line_user_id=?2 AND COALESCE(e.line_provider_scope,'default')=?3 AND e.status='active'`).bind(Number(lineCtx.clientId), lineUserId, providerScope).first();
    }
    return env.DB.prepare(`SELECT e.*, c.name AS company_name FROM employees e JOIN clients c ON c.id=e.client_id WHERE e.line_user_id=?1 AND COALESCE(e.line_provider_scope,'default')='default' AND e.status='active'`).bind(lineUserId).first();
  };

  if (event.type === 'message' && event.message?.type === 'text') {
    const text = String(event.message.text || '').trim();
    const joinMatch = text.match(/^JOIN\s+([A-Za-z0-9_-]{20,})$/i);
    if (joinMatch) {
      const linked = await linkLineJoinToken(env.DB, accessToken, lineUserId, joinMatch[1], { providerScope, expectedClientId: lineCtx.clientId });
      return replyLineMessages(accessToken,event.replyToken,[
        linked.ok ? buildWelcomeFlex(linked.name,linked.company_name) : buildSimpleNoticeFlex('เชื่อม LINE ไม่สำเร็จ',linked.error,'error')
      ]);
    }
    const linkMatch = text.match(/^LINK\s+(\d{6})$/i);
    if (linkMatch) {
      const linked = await linkLineAccount(env.DB, lineUserId, linkMatch[1], { providerScope, expectedClientId: lineCtx.clientId, accessToken });
      return replyLineMessages(accessToken,event.replyToken,[linked.ok?buildWelcomeFlex(linked.name,linked.company_name||'บริษัทของคุณ'):buildSimpleNoticeFlex('เชื่อม LINE ไม่สำเร็จ',linked.error,'error')]);
    }

    const emp=await employee();
    if(!emp) return replyLineMessages(accessToken,event.replyToken,[buildSimpleNoticeFlex('ยังไม่ได้เชื่อมบัญชีพนักงาน','เปิดลิงก์เชิญเข้าทีมที่ HR ส่งให้ แล้วกดเชื่อม LINE จากหน้านั้นได้เลย','warning')]);
    const session=await getLineSession(env.DB,sessionKey);

    if(session?.action==='leave_reason'){
      if(text.length<2) return replyLine(accessToken,event.replyToken,'ขอเหตุผลสั้น ๆ อย่างน้อย 2 ตัวอักษรนะ');
      try{
        const payload=session.payload||{};
        const requestRow=await createLeaveRequest(env,{clientId:Number(emp.client_id),employeeId:Number(emp.id),policyId:Number(payload.policy_id),startDate:payload.start_date,endDate:payload.end_date,dayPart:payload.day_part||'full',reason:text,submittedVia:'line'});
        await clearLineSession(env.DB,sessionKey);
        if(requestRow.status==='awaiting_evidence'){
          await setLineSession(env.DB,sessionKey,'leave_evidence',{request_id:requestRow.id,required:true});
          return replyEvidencePrompt(accessToken,event.replyToken,requestRow);
        }
        await notifyLeaveApprover(env,requestRow.id);
        return replyLineMessages(accessToken,event.replyToken,[buildLeaveSubmittedFlex(requestRow)]);
      }catch(e){ await clearLineSession(env.DB,sessionKey); return replyLine(accessToken,event.replyToken,`❌ ${e.message}`); }
    }

    if(session?.action==='leave_reject_reason'){
      try{
        const result=await decideLeaveRequest(env,Number(session.payload?.request_id),'rejected',{actorType:'employee',actorEmployeeId:Number(emp.id),reason:text,clientId:Number(emp.client_id),enforceApprover:true});
        await clearLineSession(env.DB,sessionKey);
        return replyLineMessages(accessToken,event.replyToken,[buildSimpleNoticeFlex('บันทึกผลเรียบร้อยแล้ว',`ไม่อนุมัติคำขอ · ${text}`,'success')]);
      }catch(e){return replyLine(accessToken,event.replyToken,`❌ ${e.message}`);}
    }

    if(session?.action==='leave_evidence' && ['ข้าม','skip'].includes(text.toLowerCase())){
      if(session.payload?.required) return replyLine(accessToken,event.replyToken,'คำขอนี้ต้องมีหลักฐาน กรุณาส่งรูปหรือไฟล์ก่อนนะ');
      await clearLineSession(env.DB,sessionKey);
      await notifyLeaveApprover(env,Number(session.payload?.request_id));
      return replyLineMessages(accessToken,event.replyToken,[buildSimpleNoticeFlex('ส่งคำขอแล้ว','นากนะส่งคำขอให้ผู้อนุมัติเรียบร้อยแล้ว','success')]);
    }

    const lower=text.toLowerCase();
    if(['เมนู','menu','help','ช่วยเหลือ'].includes(lower)) return replyLineMessages(accessToken,event.replyToken,[buildEmployeeMenuFlex(emp)]);
    if(['ลา','ขอลา','leave','ขอลางาน'].includes(lower)) return sendLeaveTypeMenu(env,event.replyToken,emp,accessToken);
    if(['สิทธิ์ลา','วันลา','leave balance'].includes(lower)) return sendLeaveBalance(env,event.replyToken,emp,accessToken);
    if(['เช็กอิน','checkin','check-in'].includes(lower)){
      const mustShareLocation=await employeeNeedsLocation(env.DB,emp);
      if(mustShareLocation){ await setLineSession(env.DB,sessionKey,'checkin'); return replyLineWithLocationQuickReply(accessToken,event.replyToken,'📍 แชร์ Location ปัจจุบันเพื่อเช็กอิน\nนากนะจะตรวจเฉพาะ Work Location ที่บริษัทอนุญาต'); }
      try{ const result=await checkIn(env.DB,Number(emp.id),null,null,'line'); return replyLineMessages(accessToken,event.replyToken,[buildAttendanceResultFlex('checkin',result)]);}catch(e){return replyLineMessages(accessToken,event.replyToken,[buildSimpleNoticeFlex('เช็กอินไม่สำเร็จ',e.message,'error')]);}
    }
    if(['เช็กเอาต์','checkout','check-out'].includes(lower)){
      const mustShareLocation=await employeeNeedsLocation(env.DB,emp);
      if(mustShareLocation){ await setLineSession(env.DB,sessionKey,'checkout'); return replyLineWithLocationQuickReply(accessToken,event.replyToken,'📍 แชร์ Location ปัจจุบันเพื่อเช็กเอาต์'); }
      try{const result=await checkOut(env.DB,Number(emp.id),null,null,'line');return replyLineMessages(accessToken,event.replyToken,[buildAttendanceResultFlex('checkout',result)]);}catch(e){return replyLineMessages(accessToken,event.replyToken,[buildSimpleNoticeFlex('เช็กเอาต์ไม่สำเร็จ',e.message,'error')]);}
    }
    if(lower==='สถานะ'){
      const a=await env.DB.prepare('SELECT * FROM attendance WHERE employee_id=?1 AND work_date=?2').bind(Number(emp.id),dateInBangkok()).first();
      return replyLineMessages(accessToken,event.replyToken,[buildEmployeeStatusFlex(emp,a)]);
    }
    return replyLineMessages(accessToken,event.replyToken,[buildEmployeeMenuFlex(emp)]);
  }

  if (event.type==='message' && ['image','file'].includes(event.message?.type)){
    const emp=await employee(); if(!emp) return replyLine(accessToken,event.replyToken,'ยังไม่ได้เชื่อมบัญชีพนักงาน');
    const session=await getLineSession(env.DB,sessionKey);
    if(session?.action!=='leave_evidence') return replyLine(accessToken,event.replyToken,'ได้รับไฟล์แล้ว แต่ตอนนี้ยังไม่มีคำขอที่รอหลักฐาน\nพิมพ์ “ขอลา” เพื่อเริ่มคำขอ');
    try{
      const requestId=Number(session.payload?.request_id);
      await storeLineLeaveEvidence(env,{requestId,employeeId:Number(emp.id),clientId:Number(emp.client_id),message:event.message,accessToken});
      await clearLineSession(env.DB,sessionKey);
      await env.DB.prepare("UPDATE leave_requests SET status=CASE WHEN status='awaiting_evidence' THEN 'pending' ELSE status END,evidence_count=(SELECT COUNT(*) FROM leave_request_evidence WHERE leave_request_id=?1),updated_at=CURRENT_TIMESTAMP WHERE id=?1").bind(requestId).run();
      await notifyLeaveApprover(env,requestId);
      const detail=await getLeaveRequestDetail(env.DB,requestId,Number(emp.client_id));
      return replyLineMessages(accessToken,event.replyToken,[buildLeaveSubmittedFlex(detail)]);
    }catch(e){return replyLine(accessToken,event.replyToken,`❌ เก็บหลักฐานไม่สำเร็จ: ${e.message}`);}
  }

  if(event.type==='message' && event.message?.type==='location'){
    const emp=await employee(); if(!emp) return replyLine(accessToken,event.replyToken,'ยังไม่ได้เชื่อมบัญชีพนักงาน');
    const session=await getLineSession(env.DB,sessionKey);
    if(!session || new Date(session.expires_at).getTime()<=Date.now()) return replyLineMessages(accessToken,event.replyToken,[buildSimpleNoticeFlex('คำขอหมดเวลาแล้ว','กรุณาเริ่มเช็กอินหรือเช็กเอาต์ใหม่อีกครั้ง','warning')]);
    if(!['checkin','checkout'].includes(session.action)) return;
    try{
      const lat=Number(event.message.latitude),lng=Number(event.message.longitude);
      const result=session.action==='checkin'?await checkIn(env.DB,Number(emp.id),lat,lng,'line'):await checkOut(env.DB,Number(emp.id),lat,lng,'line');
      await clearLineSession(env.DB,sessionKey);
      const label=session.action==='checkin'?'Check-in':'Check-out'; const tm=session.action==='checkin'?result.check_in_at:result.check_out_at;
      return replyLineMessages(accessToken,event.replyToken,[buildAttendanceResultFlex(session.action,result)]);
    }catch(e){return replyLine(accessToken,event.replyToken,`❌ ${e.message}`);}
  }

  if(event.type==='postback'){
    const emp=await employee(); if(!emp) return replyLine(accessToken,event.replyToken,'ยังไม่ได้เชื่อมบัญชีพนักงาน');
    const data=new URLSearchParams(event.postback?.data||''); const action=data.get('action');
    if(action==='menu') return replyLineMessages(accessToken,event.replyToken,[buildEmployeeMenuFlex(emp)]);
    if(action==='checkin'||action==='checkout'){ await setLineSession(env.DB,sessionKey,action); return replyLineWithLocationQuickReply(accessToken,event.replyToken,`📍 ส่ง Location ปัจจุบันมาเพื่อ${action==='checkin'?'เช็กอิน':'เช็กเอาต์'}`); }
    if(action==='leave_menu') return sendLeaveTypeMenu(env,event.replyToken,emp,accessToken);
    if(action==='leave_balance') return sendLeaveBalance(env,event.replyToken,emp,accessToken);
    if(action==='status'){ const a=await env.DB.prepare('SELECT * FROM attendance WHERE employee_id=?1 AND work_date=?2').bind(Number(emp.id),dateInBangkok()).first(); return replyLineMessages(accessToken,event.replyToken,[buildEmployeeStatusFlex(emp,a)]); }
    if(action==='leave_type'){
      const policyId=Number(data.get('policy_id')); const policy=await env.DB.prepare('SELECT * FROM leave_policies WHERE id=?1 AND client_id=?2 AND is_active=1').bind(policyId,Number(emp.client_id)).first();
      if(!policy) return replyLine(accessToken,event.replyToken,'ไม่พบประเภทลานี้');
      await setLineSession(env.DB,sessionKey,'leave_start',{policy_id:policyId});
      return replyLineMessages(accessToken,event.replyToken,[buildDatePickerFlex('เลือกวันเริ่มลา','leave_start',policyId)]);
    }
    if(action==='leave_start'){
      const date=event.postback?.params?.date; const policyId=Number(data.get('policy_id')); if(!date) return replyLine(accessToken,event.replyToken,'กรุณาเลือกวันที่');
      await setLineSession(env.DB,sessionKey,'leave_end',{policy_id:policyId,start_date:date});
      return replyLineMessages(accessToken,event.replyToken,[buildDatePickerFlex(`เริ่ม ${formatThaiDateOnly(date)} · เลือกวันสุดท้าย`,'leave_end',policyId,date)]);
    }
    if(action==='leave_end'){
      const endDate=event.postback?.params?.date; const startDate=data.get('start')||endDate; const policyId=Number(data.get('policy_id'));
      if(!endDate||endDate<startDate) return replyLine(accessToken,event.replyToken,'วันสิ้นสุดต้องไม่น้อยกว่าวันเริ่มลา');
      if(startDate===endDate){
        await setLineSession(env.DB,sessionKey,'leave_daypart',{policy_id:policyId,start_date:startDate,end_date:endDate});
        return replyLineMessages(accessToken,event.replyToken,[buildLeaveDayPartFlex(policyId,startDate,endDate)]);
      }
      await setLineSession(env.DB,sessionKey,'leave_reason',{policy_id:policyId,start_date:startDate,end_date:endDate,day_part:'full'});
      return replyLineMessages(accessToken,event.replyToken,[buildLeaveReasonPromptFlex(startDate,endDate,'full')]);
    }
    if(action==='leave_daypart'){
      const policyId=Number(data.get('policy_id')); const startDate=data.get('start'); const endDate=data.get('end')||startDate; const dayPart=data.get('part')||'full';
      if(!policyId||!startDate) return replyLine(accessToken,event.replyToken,'ข้อมูลคำขอไม่ครบ กรุณาพิมพ์ “ขอลา” ใหม่');
      await setLineSession(env.DB,sessionKey,'leave_reason',{policy_id:policyId,start_date:startDate,end_date:endDate,day_part:dayPart});
      const partLabel=dayPart==='am'?'ครึ่งวันเช้า':dayPart==='pm'?'ครึ่งวันบ่าย':'เต็มวัน';
      return replyLineMessages(accessToken,event.replyToken,[buildLeaveReasonPromptFlex(startDate,endDate,dayPart)]);
    }
    if(action==='leave_attach'){
      const id=Number(data.get('id')); const row=await env.DB.prepare("SELECT * FROM leave_requests WHERE id=?1 AND employee_id=?2 AND status IN ('pending','awaiting_evidence')").bind(id,Number(emp.id)).first(); if(!row) return replyLine(accessToken,event.replyToken,'คำขอนี้แนบหลักฐานไม่ได้แล้ว');
      await setLineSession(env.DB,sessionKey,'leave_evidence',{request_id:id,required:Number(row.evidence_required)===1});
      return replyEvidencePrompt(accessToken,event.replyToken,row);
    }
    if(action==='leave_approve'){
      try{const result=await decideLeaveRequest(env,Number(data.get('id')),'approved',{actorType:'employee',actorEmployeeId:Number(emp.id),clientId:Number(emp.client_id),enforceApprover:true});return replyLineMessages(accessToken,event.replyToken,[buildSimpleNoticeFlex('อนุมัติเรียบร้อยแล้ว',`คำขอ #LV-${String(result.id).padStart(4,'0')} ถูกอนุมัติแล้ว`,'success')]);}catch(e){return replyLine(accessToken,event.replyToken,`❌ ${e.message}`);}
    }
    if(action==='leave_reject'){
      const id=Number(data.get('id')); const row=await env.DB.prepare("SELECT id FROM leave_requests WHERE id=?1 AND approver_employee_id=?2 AND status='pending'").bind(id,Number(emp.id)).first(); if(!row) return replyLine(accessToken,event.replyToken,'คำขอนี้ไม่ได้รอคุณอนุมัติแล้ว');
      await setLineSession(env.DB,sessionKey,'leave_reject_reason',{request_id:id});
      return replyLineMessages(accessToken,event.replyToken,[buildSimpleNoticeFlex('ระบุเหตุผลที่ไม่อนุมัติ','พิมพ์เหตุผลส่งเป็นข้อความถัดไป เพื่อแจ้งกลับให้พนักงาน','coral')]);
    }
  }
}

async function checkIn(db, employeeId, lat, lng, source) {
  const employee = await db.prepare(`
    SELECT e.*, c.work_start, c.late_grace_minutes, c.geofence_lat, c.geofence_lng, c.geofence_radius_m, c.geofence_name
    FROM employees e JOIN clients c ON c.id=e.client_id WHERE e.id=?1 AND e.status='active'
  `).bind(employeeId).first();
  if (!employee) throw httpError('Employee not found', 404);

  const now = new Date();
  const workDate = dateInBangkok(now);
  const existing = await db.prepare('SELECT * FROM attendance WHERE employee_id=?1 AND work_date=?2').bind(employeeId, workDate).first();
  if (existing?.check_in_at) throw httpError('วันนี้เช็กอินไปแล้ว', 409);

  const matchedLocation = await resolveAllowedWorkLocation(db, employee, lat, lng);
  const lateMinutes = calculateLateMinutes(now, employee.work_start, Number(employee.late_grace_minutes || 0));
  const status = lateMinutes > 0 ? 'late' : 'present';
  const nowIso = now.toISOString();

  await db.prepare(`
    INSERT INTO attendance (
      client_id, employee_id, work_date, check_in_at, checkin_lat, checkin_lng, source, status, late_minutes,
      checkin_location_id, checkin_location_name, checkin_distance_m
    ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)
    ON CONFLICT(employee_id, work_date) DO UPDATE SET
      check_in_at=excluded.check_in_at, checkin_lat=excluded.checkin_lat, checkin_lng=excluded.checkin_lng,
      source=excluded.source, status=excluded.status, late_minutes=excluded.late_minutes,
      checkin_location_id=excluded.checkin_location_id, checkin_location_name=excluded.checkin_location_name,
      checkin_distance_m=excluded.checkin_distance_m, updated_at=CURRENT_TIMESTAMP
  `).bind(
    Number(employee.client_id), employeeId, workDate, nowIso, lat ?? null, lng ?? null, source, status, lateMinutes,
    matchedLocation?.id || null, matchedLocation?.name || null, matchedLocation?.distance_m ?? null
  ).run();

  await audit(db, Number(employee.client_id), source, String(employeeId), 'attendance.check_in', 'attendance', `${employeeId}:${workDate}`, {
    lat, lng, late_minutes: lateMinutes, location_id: matchedLocation?.id || null, location_name: matchedLocation?.name || null,
  });
  return {
    check_in_at: nowIso, work_date: workDate, status, late_minutes: lateMinutes,
    distance_m: matchedLocation?.distance_m ?? null, location_id: matchedLocation?.id || null, location_name: matchedLocation?.name || null,
  };
}

async function checkOut(db, employeeId, lat, lng, source) {
  const employee = await db.prepare(`
    SELECT e.*, c.geofence_lat, c.geofence_lng, c.geofence_radius_m, c.geofence_name
    FROM employees e JOIN clients c ON c.id=e.client_id WHERE e.id=?1 AND e.status='active'
  `).bind(employeeId).first();
  if (!employee) throw httpError('Employee not found', 404);

  const workDate = dateInBangkok();
  const existing = await db.prepare('SELECT * FROM attendance WHERE employee_id=?1 AND work_date=?2').bind(employeeId, workDate).first();
  if (!existing?.check_in_at) throw httpError('ยังไม่ได้เช็กอินวันนี้', 409);
  if (existing?.check_out_at) throw httpError('วันนี้เช็กเอาต์ไปแล้ว', 409);

  const matchedLocation = await resolveAllowedWorkLocation(db, employee, lat, lng);
  const nowIso = new Date().toISOString();
  await db.prepare(`
    UPDATE attendance SET check_out_at=?1, checkout_lat=?2, checkout_lng=?3,
      checkout_location_id=?4, checkout_location_name=?5, checkout_distance_m=?6, updated_at=CURRENT_TIMESTAMP
    WHERE employee_id=?7 AND work_date=?8
  `).bind(
    nowIso, lat ?? null, lng ?? null, matchedLocation?.id || null, matchedLocation?.name || null,
    matchedLocation?.distance_m ?? null, employeeId, workDate
  ).run();

  await audit(db, Number(employee.client_id), source, String(employeeId), 'attendance.check_out', 'attendance', `${employeeId}:${workDate}`, {
    lat, lng, location_id: matchedLocation?.id || null, location_name: matchedLocation?.name || null,
  });
  return {
    check_out_at: nowIso, work_date: workDate,
    distance_m: matchedLocation?.distance_m ?? null, location_id: matchedLocation?.id || null, location_name: matchedLocation?.name || null,
  };
}

async function employeeNeedsLocation(db, employee) {
  const assigned = await db.prepare(`
    SELECT COUNT(*) AS n FROM employee_work_locations ewl
    JOIN work_locations wl ON wl.id=ewl.location_id AND wl.is_active=1
    WHERE ewl.employee_id=?1
  `).bind(Number(employee.id)).first();
  if (Number(assigned?.n || 0) > 0) return true;
  const companyLocations = await db.prepare('SELECT COUNT(*) AS n FROM work_locations WHERE client_id=?1 AND is_active=1').bind(Number(employee.client_id)).first();
  if (Number(companyLocations?.n || 0) > 0) return true;
  return employee.geofence_lat != null && employee.geofence_lng != null;
}

async function resolveAllowedWorkLocation(db, employee, lat, lng) {
  const assigned = await db.prepare(`
    SELECT wl.* FROM employee_work_locations ewl
    JOIN work_locations wl ON wl.id=ewl.location_id
    WHERE ewl.employee_id=?1 AND wl.is_active=1
    ORDER BY wl.name
  `).bind(Number(employee.id)).all();
  let locations = assigned.results || [];

  if (!locations.length) {
    const company = await db.prepare('SELECT * FROM work_locations WHERE client_id=?1 AND is_active=1 ORDER BY name').bind(Number(employee.client_id)).all();
    locations = company.results || [];
  }

  if (!locations.length && employee.geofence_lat != null && employee.geofence_lng != null) {
    locations = [{
      id: null,
      name: employee.geofence_name || 'จุดทำงาน',
      latitude: Number(employee.geofence_lat),
      longitude: Number(employee.geofence_lng),
      radius_m: Number(employee.geofence_radius_m || 250),
    }];
  }

  if (!locations.length) return null;
  if (lat == null || lng == null) throw httpError('ต้องแชร์ Location เพื่อเช็กอิน/เอาต์', 400);

  const ranked = locations.map(location => ({
    ...location,
    distance_m: haversineMeters(Number(location.latitude), Number(location.longitude), Number(lat), Number(lng)),
  })).sort((a,b) => a.distance_m - b.distance_m);
  const nearest = ranked[0];
  if (nearest.distance_m > Number(nearest.radius_m || 150)) {
    throw httpError(`อยู่นอกพื้นที่ ${nearest.name} · ห่าง ${Math.round(nearest.distance_m)} ม. (อนุญาต ${Number(nearest.radius_m || 150)} ม.)`, 403);
  }
  return nearest;
}

async function getPublicInvite(db, token) {
  const tokenHash = await sha256Hex(token);
  const invite = await db.prepare(`
    SELECT i.*, c.name AS company_name, d.name AS department_name, p.name AS position_name
    FROM employee_invites i
    JOIN clients c ON c.id=i.client_id
    LEFT JOIN departments d ON d.id=i.department_id
    LEFT JOIN positions p ON p.id=i.position_id
    WHERE i.token_hash=?1
  `).bind(tokenHash).first();
  if (!invite) return json({ error: 'INVITE_NOT_FOUND' }, 404);
  const invalid = invite.status !== 'active' || new Date(invite.expires_at).getTime() <= Date.now() || Number(invite.used_count) >= Number(invite.max_uses);
  if (invalid) return json({ error: 'INVITE_EXPIRED', company_name: invite.company_name }, 410);
  const locations = await db.prepare(`
    SELECT wl.id,wl.name,wl.address FROM employee_invite_locations eil
    JOIN work_locations wl ON wl.id=eil.location_id AND wl.is_active=1
    WHERE eil.invite_id=?1 ORDER BY wl.name
  `).bind(Number(invite.id)).all();
  return json({
    invite: {
      company_name: invite.company_name,
      department_name: invite.department_name || null,
      position_name: invite.position_name || null,
      start_date: invite.start_date || null,
      expires_at: invite.expires_at,
      remaining_uses: Math.max(0, Number(invite.max_uses) - Number(invite.used_count)),
      locations: locations.results || [],
    },
  });
}

async function acceptPublicInvite(request, env, token) {
  const tokenHash = await sha256Hex(token);
  const invite = await env.DB.prepare(`
    SELECT i.*, c.name AS company_name FROM employee_invites i
    JOIN clients c ON c.id=i.client_id
    WHERE i.token_hash=?1
  `).bind(tokenHash).first();
  if (!invite) return json({ error: 'ลิงก์เชิญไม่ถูกต้อง' }, 404);
  if (invite.status !== 'active' || new Date(invite.expires_at).getTime() <= Date.now() || Number(invite.used_count) >= Number(invite.max_uses)) {
    return json({ error: 'ลิงก์เชิญหมดอายุหรือถูกใช้ครบแล้ว' }, 410);
  }

  const body = await safeJson(request);
  const firstName = String(body.first_name || '').trim();
  const lastName = String(body.last_name || '').trim();
  const nickname = String(body.nickname || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const phone = String(body.phone || '').trim();
  const birthDate = body.birth_date || null;
  if (firstName.length < 1 || lastName.length < 1 || phone.length < 8) return json({ error: 'กรุณากรอกชื่อ นามสกุล และเบอร์โทรให้ครบ' }, 400);

  const employeeCode = await generateEmployeeCode(env.DB, Number(invite.client_id));
  const startDate = invite.start_date || dateInBangkok();
  let result;
  try {
    result = await env.DB.prepare(`
      INSERT INTO employees (
        client_id,employee_code,first_name,last_name,nickname,email,phone,birth_date,start_date,
        department_id,position_id,employment_type,status,onboarding_source,emergency_contact_name,emergency_contact_phone
      ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,'full_time','active','invite',?12,?13)
    `).bind(
      Number(invite.client_id), employeeCode, firstName, lastName, nickname || null, email || null, phone,
      birthDate, startDate, invite.department_id || null, invite.position_id || null,
      String(body.emergency_contact_name || '').trim() || null,
      String(body.emergency_contact_phone || '').trim() || null,
    ).run();
  } catch (error) {
    if (/UNIQUE constraint failed: employees\.email/i.test(String(error?.message || error)) && email) {
      return json({ error: 'อีเมลนี้มีอยู่ในบริษัทแล้ว กรุณาติดต่อ HR' }, 409);
    }
    throw error;
  }
  const employeeId = Number(result.meta.last_row_id);

  const locations = await env.DB.prepare('SELECT location_id FROM employee_invite_locations WHERE invite_id=?1').bind(Number(invite.id)).all();
  for (const row of locations.results || []) {
    await env.DB.prepare('INSERT OR IGNORE INTO employee_work_locations (employee_id,location_id) VALUES (?1,?2)').bind(employeeId, Number(row.location_id)).run();
  }

  const nextUsed = Number(invite.used_count) + 1;
  await env.DB.prepare(`UPDATE employee_invites SET used_count=?1,status=?2,updated_at=CURRENT_TIMESTAMP WHERE id=?3`)
    .bind(nextUsed, nextUsed >= Number(invite.max_uses) ? 'consumed' : 'active', Number(invite.id)).run();

  const lineToken = randomToken(24);
  const lineTokenHash = await sha256Hex(lineToken);
  const lineExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare('INSERT INTO line_join_tokens (token_hash,employee_id,expires_at) VALUES (?1,?2,?3)')
    .bind(lineTokenHash, employeeId, lineExpiresAt).run();

  let lineConnectUrl = null;
  try {
    const lineCtx = await getEffectiveLineContextForClient(env, Number(invite.client_id));
    const bot = lineCtx?.accessToken ? await getLineBotInfo(lineCtx.accessToken) : null;
    if (bot?.basicId) lineConnectUrl = `https://line.me/R/oaMessage/${encodeURIComponent(bot.basicId)}/?${encodeURIComponent(`JOIN ${lineToken}`)}`;
  } catch (error) {
    console.warn(JSON.stringify({ level: 'warn', event: 'line_bot_info_failed', message: String(error?.message || error) }));
  }

  await safeAudit(env.DB, Number(invite.client_id), 'public_invite', String(employeeId), 'employee.self_onboard', 'employee', String(employeeId), { invite_id: Number(invite.id) });
  return json({
    ok: true,
    employee: { id: employeeId, employee_code: employeeCode, name: nickname || firstName, company_name: invite.company_name },
    line_connect_url: lineConnectUrl,
    line_command: `JOIN ${lineToken}`,
    line_token_expires_at: lineExpiresAt,
  }, 201);
}

async function generateEmployeeCode(db, clientId) {
  for (let attempt=0; attempt<5; attempt++) {
    const code = `EMP-${String(clientId).padStart(2,'0')}-${randomToken(4).replace(/[-_]/g,'').slice(0,6).toUpperCase()}`;
    const exists = await db.prepare('SELECT id FROM employees WHERE client_id=?1 AND employee_code=?2').bind(clientId, code).first();
    if (!exists) return code;
  }
  return `EMP-${clientId}-${Date.now().toString(36).toUpperCase()}`;
}

async function getLineBotInfo(accessToken) {
  if (!accessToken) return null;
  const response = await fetch('https://api.line.me/v2/bot/info', { headers: { authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`LINE bot info failed ${response.status}`);
  return response.json();
}

async function getLineProfile(accessToken, userId) {
  if (!accessToken || !userId) return null;
  const response = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(userId)}`, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!response.ok) return null;
  return response.json();
}

async function linkLineJoinToken(db, accessToken, lineUserId, token, { providerScope='default', expectedClientId=null } = {}) {
  const tokenHash = await sha256Hex(token);
  const row = await db.prepare(`
    SELECT t.*, e.id AS employee_id,e.first_name,e.nickname,e.client_id,e.line_user_id,c.name AS company_name
    FROM line_join_tokens t
    JOIN employees e ON e.id=t.employee_id
    JOIN clients c ON c.id=e.client_id
    WHERE t.token_hash=?1 AND t.used_at IS NULL
  `).bind(tokenHash).first();
  if (!row) return { ok:false, error:'ลิงก์เชื่อม LINE ไม่ถูกต้องหรือถูกใช้แล้ว' };
  if (expectedClientId && Number(row.client_id) !== Number(expectedClientId)) return { ok:false, error:'ลิงก์นี้เป็นของคนละบริษัทกับ LINE Official Account นี้' };
  if (new Date(row.expires_at).getTime() <= Date.now()) return { ok:false, error:'ลิงก์เชื่อม LINE หมดอายุแล้ว กรุณาขอลิงก์เชิญใหม่จาก HR' };
  const used = await db.prepare("SELECT id FROM employees WHERE line_user_id=?1 AND COALESCE(line_provider_scope,'default')=?2").bind(lineUserId,providerScope).first();
  if (used && Number(used.id) !== Number(row.employee_id)) return { ok:false, error:'LINE นี้เชื่อมกับพนักงานคนอื่นอยู่แล้ว' };

  const profile = await getLineProfile(accessToken, lineUserId);
  await db.batch([
    db.prepare(`UPDATE employees SET line_user_id=?1,line_provider_scope=?2,line_display_name=?3,line_picture_url=?4,line_linked_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?5`)
      .bind(lineUserId, providerScope, profile?.displayName || null, profile?.pictureUrl || null, Number(row.employee_id)),
    db.prepare('UPDATE line_join_tokens SET used_at=CURRENT_TIMESTAMP WHERE token_hash=?1').bind(tokenHash),
  ]);
  await safeAudit(db, Number(row.client_id), 'line', lineUserId, 'employee.line_link_invite', 'employee', String(row.employee_id), null);
  return { ok:true, name:row.nickname || row.first_name, company_name:row.company_name };
}

function canManagePeople(role) {
  return ['owner','hr_admin','hr','manager'].includes(String(role || ''));
}

function canOverrideLeave(role) {
  return ['owner','hr_admin','hr'].includes(String(role || ''));
}

function canManageIntegrations(role) {
  return ['owner','hr_admin'].includes(String(role || ''));
}

function canManageApproverAccess(role) {
  return ['owner','hr_admin','hr'].includes(String(role || ''));
}

function approverPermissionCatalog(){
  return [
    {key:'leave.approve',label:'อนุมัติการลา',description:'รับและตัดสินคำขอลาที่ถูกมอบหมายผ่าน LINE'},
    {key:'attendance.approve',label:'อนุมัติแก้เวลา',description:'สิทธิ์สำหรับ Flow แก้ไขเวลาเข้างาน/ออก'},
    {key:'ot.approve',label:'อนุมัติ OT',description:'เตรียมไว้สำหรับโมดูล OT'},
    {key:'hr_request.approve',label:'อนุมัติคำขอ HR',description:'เตรียมไว้สำหรับคำขอเอกสารและคำร้อง'},
    {key:'team.read',label:'ดูข้อมูลทีม',description:'ให้ผู้อนุมัติเห็นข้อมูลพื้นฐานของทีมที่เกี่ยวข้อง'}
  ];
}

async function employeeHasPermission(db,clientId,employeeId,key){
  if(!employeeId) return false;
  await ensureV061Ready(db);
  const row=await db.prepare('SELECT 1 AS ok FROM employee_permissions WHERE client_id=?1 AND employee_id=?2 AND permission_key=?3 LIMIT 1').bind(Number(clientId),Number(employeeId),String(key)).first();
  return Boolean(row);
}

async function linkLineAccount(db, lineUserId, token, { providerScope='default', expectedClientId=null, accessToken=null } = {}) {
  const row = await db.prepare(`
    SELECT t.*, e.first_name, e.nickname, e.client_id, c.name AS company_name
    FROM line_link_tokens t JOIN employees e ON e.id=t.employee_id JOIN clients c ON c.id=e.client_id
    WHERE t.token=?1 AND t.used_at IS NULL
  `).bind(token).first();
  if (!row) return { ok: false, error: 'รหัสไม่ถูกต้องหรือถูกใช้แล้ว' };
  if (expectedClientId && Number(row.client_id) !== Number(expectedClientId)) return { ok:false, error:'รหัสนี้เป็นของคนละบริษัทกับ LINE Official Account นี้' };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, error: 'รหัสหมดอายุแล้ว กรุณาขอรหัสใหม่จาก HR' };

  const used = await db.prepare("SELECT id FROM employees WHERE line_user_id=?1 AND COALESCE(line_provider_scope,'default')=?2").bind(lineUserId,providerScope).first();
  if (used && Number(used.id) !== Number(row.employee_id)) return { ok: false, error: 'LINE นี้เชื่อมกับพนักงานคนอื่นอยู่แล้ว' };

  await db.batch([
    db.prepare('UPDATE employees SET line_user_id=?1,line_provider_scope=?2,updated_at=CURRENT_TIMESTAMP WHERE id=?3').bind(lineUserId,providerScope,Number(row.employee_id)),
    db.prepare('UPDATE line_link_tokens SET used_at=CURRENT_TIMESTAMP WHERE token=?1').bind(token),
  ]);
  await audit(db, Number(row.client_id), 'line', lineUserId, 'employee.line_link', 'employee', String(row.employee_id), null);
  return { ok: true, name: row.nickname || row.first_name, company_name: row.company_name };
}

async function setLineSession(db,lineUserId,action,payload={}) {
  const expiresAt=new Date(Date.now()+30*60*1000).toISOString();
  await db.prepare(`INSERT INTO line_sessions (line_user_id,action,payload_json,expires_at) VALUES (?1,?2,?3,?4)
    ON CONFLICT(line_user_id) DO UPDATE SET action=excluded.action,payload_json=excluded.payload_json,expires_at=excluded.expires_at,created_at=CURRENT_TIMESTAMP`)
    .bind(lineUserId,action,JSON.stringify(payload||{}),expiresAt).run();
}
async function getLineSession(db,lineUserId){
  const row=await db.prepare('SELECT * FROM line_sessions WHERE line_user_id=?1').bind(lineUserId).first();
  if(!row) return null; if(new Date(row.expires_at).getTime()<=Date.now()){await clearLineSession(db,lineUserId);return null;}
  let payload={}; try{payload=JSON.parse(row.payload_json||'{}')}catch{}
  return {...row,payload};
}
async function clearLineSession(db,lineUserId){await db.prepare('DELETE FROM line_sessions WHERE line_user_id=?1').bind(lineUserId).run();}


function num(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
function nullableNum(value){if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)?n:null;}
function slugCode(value){return String(value||'').trim().toLowerCase().replace(/[^a-z0-9ก-๙]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40);}
function formatThaiDateOnly(date){try{return new Date(`${date}T12:00:00+07:00`).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit',timeZone:'Asia/Bangkok'});}catch{return date;}}

async function ensureV050Ready(db){
  const ready=await db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('leave_policies','leave_evidence_share_tokens')").first();
  if(Number(ready?.n||0)<2) await ensureV050Schema(db);
}

async function ensureV050Schema(db){
  const statements=V050_SCHEMA_SQL.split(';').map(x=>x.trim()).filter(Boolean);
  for(const statement of statements){try{await db.prepare(statement).run();}catch(error){if(/CREATE INDEX/i.test(statement)){console.warn(JSON.stringify({level:'warn',event:'v050_index_skip',message:String(error?.message||error)}));continue;}throw error;}}
  for(const [column,type] of [['leave_approver_employee_id','INTEGER']]) await ensureColumn(db,'employees',column,type);
  for(const [column,type] of [['payload_json','TEXT']]) await ensureColumn(db,'line_sessions',column,type);
  const leaveCols=[['policy_id','INTEGER'],['duration_days','REAL'],['day_part','TEXT'],['evidence_required','INTEGER'],['evidence_count','INTEGER'],['decision_reason','TEXT'],['decided_by_employee_id','INTEGER'],['decided_by_user_id','INTEGER'],['submitted_via','TEXT']];
  for(const [column,type] of leaveCols) await ensureColumn(db,'leave_requests',column,type);
}

async function ensureV060Ready(db){
  const ready=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='line_integrations'").first();
  if(!ready){
    const statements=V060_SCHEMA_SQL.split(';').map(x=>x.trim()).filter(Boolean);
    for(const statement of statements){try{await db.prepare(statement).run();}catch(error){if(/CREATE INDEX/i.test(statement)){continue;}throw error;}}
  }
  await ensureColumn(db,'employees','line_provider_scope','TEXT');
}

async function ensureV061Ready(db){
  await ensureV050Ready(db);
  const ready=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='employee_permissions'").first();
  if(!ready){
    const statements=V061_SCHEMA_SQL.split(';').map(x=>x.trim()).filter(Boolean);
    for(const statement of statements){try{await db.prepare(statement).run();}catch(error){if(/CREATE INDEX/i.test(statement))continue;throw error;}}
  }
  // Preserve existing leave approval flows when upgrading from V0.6.0.
  await db.prepare(`INSERT OR IGNORE INTO employee_permissions (client_id,employee_id,permission_key)
    SELECT DISTINCT client_id,leave_approver_employee_id,'leave.approve' FROM employees WHERE leave_approver_employee_id IS NOT NULL`).run();
}

function lineSessionKey(providerScope,lineUserId){return `${providerScope||'default'}:${lineUserId}`;}
function integrationEncryptionKey(env){return env.NAKNA_INTEGRATION_ENCRYPTION_KEY || env.GOOGLE_TOKEN_ENCRYPTION_KEY || null;}
function defaultLineContext(env){return env.LINE_CHANNEL_SECRET&&env.LINE_CHANNEL_ACCESS_TOKEN?{channelSecret:env.LINE_CHANNEL_SECRET,accessToken:env.LINE_CHANNEL_ACCESS_TOKEN,providerScope:'default',clientId:null,integrationId:null}:null;}

async function decryptLineIntegrationCredentials(env,row){
  const key=integrationEncryptionKey(env); if(!key) throw new Error('Integration encryption key is not configured');
  const data=await decryptJson(row.encrypted_credentials,key);
  if(!data?.channel_secret||!data?.access_token) throw new Error('LINE credentials are incomplete');
  return data;
}

async function getWorkspaceLineIntegration(env,clientId,withCredentials=false){
  if(!clientId)return null;
  const row=await env.DB.prepare("SELECT * FROM line_integrations WHERE client_id=?1 AND status='connected'").bind(Number(clientId)).first();
  if(!row)return null;
  if(withCredentials)return {...row,credentials:await decryptLineIntegrationCredentials(env,row)};
  return row;
}

async function getLineIntegrationByWebhookKey(env,webhookKey){
  const row=await env.DB.prepare("SELECT * FROM line_integrations WHERE webhook_key=?1 AND status='connected'").bind(webhookKey).first();
  if(!row)return null;
  const credentials=await decryptLineIntegrationCredentials(env,row);
  return {channelSecret:credentials.channel_secret,accessToken:credentials.access_token,providerScope:`integration:${row.id}`,clientId:Number(row.client_id),integrationId:Number(row.id),webhookKey:row.webhook_key};
}

async function getEffectiveLineContextForClient(env,clientId){
  await ensureV060Ready(env.DB);
  const row=await getWorkspaceLineIntegration(env,clientId,true);
  if(row)return {channelSecret:row.credentials.channel_secret,accessToken:row.credentials.access_token,providerScope:`integration:${row.id}`,clientId:Number(clientId),integrationId:Number(row.id),webhookKey:row.webhook_key};
  return defaultLineContext(env);
}

async function getAccessTokenForProviderScope(env,clientId,scope){
  const normalized=scope||'default';
  if(normalized==='default')return env.LINE_CHANNEL_ACCESS_TOKEN||null;
  const match=String(normalized).match(/^integration:(\d+)$/); if(!match)return null;
  const row=await env.DB.prepare("SELECT * FROM line_integrations WHERE id=?1 AND client_id=?2 AND status='connected'").bind(Number(match[1]),Number(clientId)).first();
  if(!row)return null;
  const creds=await decryptLineIntegrationCredentials(env,row); return creds.access_token;
}

function publicLineIntegration(row,live=null,includeWebhook=true){
  return {id:Number(row.id),channel_id:row.channel_id||null,bot_user_id:row.bot_user_id||null,bot_basic_id:row.bot_basic_id||null,bot_display_name:row.bot_display_name||null,bot_picture_url:row.bot_picture_url||null,webhook_url:includeWebhook?row.webhook_url:null,webhook_active:live?Boolean(live.active):Boolean(Number(row.webhook_active)),status:row.status,last_test_at:row.last_test_at||null,last_error:row.last_error||null,connected_at:row.created_at};
}

async function setLineWebhookEndpoint(accessToken,endpoint){
  const response=await fetch('https://api.line.me/v2/bot/channel/webhook/endpoint',{method:'PUT',headers:{authorization:`Bearer ${accessToken}`,'content-type':'application/json'},body:JSON.stringify({endpoint})});
  if(!response.ok)throw new Error(`LINE webhook setup failed ${response.status}`);
}
async function getLineWebhookInfo(accessToken){
  const response=await fetch('https://api.line.me/v2/bot/channel/webhook/endpoint',{headers:{authorization:`Bearer ${accessToken}`,'content-type':'application/json'}});
  if(response.status===404)return {endpoint:null,active:false};
  if(!response.ok)throw new Error(`LINE webhook info failed ${response.status}`); return response.json();
}
async function testLineWebhook(accessToken,endpoint){
  const response=await fetch('https://api.line.me/v2/bot/channel/webhook/test',{method:'POST',headers:{authorization:`Bearer ${accessToken}`,'content-type':'application/json'},body:JSON.stringify(endpoint?{endpoint}:{})});
  const data=await response.json().catch(()=>({})); if(!response.ok)throw new Error(`LINE webhook test failed ${response.status}`); return data;
}

async function saveWorkspaceLineIntegration(env,{clientId,userId,channelId,channelSecret,accessToken}){
  const key=integrationEncryptionKey(env); if(!key)throw new Error('NAKNA_INTEGRATION_ENCRYPTION_KEY_OR_GOOGLE_TOKEN_ENCRYPTION_KEY_MISSING');
  const bot=await getLineBotInfo(accessToken);
  const duplicate=bot?.userId ? await env.DB.prepare("SELECT client_id FROM line_integrations WHERE bot_user_id=?1 AND client_id<>?2 AND status='connected'").bind(bot.userId,Number(clientId)).first() : null;
  if(duplicate) throw new Error('LINE_OA_ALREADY_CONNECTED');
  let existing=await env.DB.prepare('SELECT * FROM line_integrations WHERE client_id=?1').bind(Number(clientId)).first();
  const webhookKey=existing?.webhook_key||randomToken(32);
  const base=String(env.APP_BASE_URL||'https://hr-line.organization-23c.workers.dev').replace(/\/$/,'');
  const webhookUrl=`${base}/webhooks/line/${webhookKey}`;
  await setLineWebhookEndpoint(accessToken,webhookUrl);
  const webhook=await getLineWebhookInfo(accessToken).catch(()=>({endpoint:webhookUrl,active:false}));
  const encrypted=await encryptJson({channel_secret:channelSecret,access_token:accessToken},key);
  await env.DB.prepare(`INSERT INTO line_integrations (client_id,channel_id,bot_user_id,bot_basic_id,bot_display_name,bot_picture_url,encrypted_credentials,webhook_key,webhook_url,webhook_active,status,last_test_at,last_error,connected_by_user_id)
    VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,'connected',CURRENT_TIMESTAMP,NULL,?11)
    ON CONFLICT(client_id) DO UPDATE SET channel_id=excluded.channel_id,bot_user_id=excluded.bot_user_id,bot_basic_id=excluded.bot_basic_id,bot_display_name=excluded.bot_display_name,bot_picture_url=excluded.bot_picture_url,encrypted_credentials=excluded.encrypted_credentials,webhook_key=excluded.webhook_key,webhook_url=excluded.webhook_url,webhook_active=excluded.webhook_active,status='connected',last_test_at=CURRENT_TIMESTAMP,last_error=NULL,connected_by_user_id=excluded.connected_by_user_id,updated_at=CURRENT_TIMESTAMP`)
    .bind(Number(clientId),channelId,bot.userId||null,bot.basicId||null,bot.displayName||null,bot.pictureUrl||null,encrypted,webhookKey,webhookUrl,webhook?.active?1:0,userId).run();
  return env.DB.prepare('SELECT * FROM line_integrations WHERE client_id=?1').bind(Number(clientId)).first();
}

function safeLineIntegrationError(error){
  const text=String(error?.message||error||'LINE integration failed');
  if(text.includes('bot info failed 401'))return 'Channel Access Token ไม่ถูกต้อง หรือถูกยกเลิกแล้ว';
  if(text.includes('LINE_OA_ALREADY_CONNECTED'))return 'LINE Official Account นี้ถูกเชื่อมกับ Workspace อื่นแล้ว';
  if(text.includes('webhook setup failed'))return 'ตั้ง Webhook ที่ LINE ไม่สำเร็จ กรุณาตรวจ Channel Access Token';
  if(text.includes('ENCRYPTION_KEY'))return 'ยังไม่มี Encryption Key สำหรับเก็บ LINE credentials';
  return 'เชื่อม LINE Official Account ไม่สำเร็จ กรุณาตรวจข้อมูลแล้วลองใหม่';
}

async function ensureDefaultLeavePolicies(db,clientId){
  if(!clientId) return;
  const defaults=[
    ['annual','ลาพักร้อน',6,0,1,null,1,0,10],
    ['sick','ลาป่วย',30,0,1,3,0,0,20],
    ['personal','ลากิจ',3,0,1,null,1,0,30],
    ['unpaid','ลาไม่รับค่าจ้าง',0,1,1,null,0,1,40],
  ];
  for(const d of defaults){await db.prepare(`INSERT OR IGNORE INTO leave_policies (client_id,code,name,default_entitlement_days,is_unlimited,requires_reason,evidence_required_after_days,notice_days,allow_negative,is_active,sort_order) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,1,?10)`).bind(clientId,...d).run();}
}

async function getEmployeeForClient(db,id,clientId){return db.prepare('SELECT * FROM employees WHERE id=?1 AND client_id=?2').bind(id,clientId).first();}

function businessDaysInclusive(startDate,endDate,dayPart='full'){
  const start=new Date(`${startDate}T12:00:00+07:00`),end=new Date(`${endDate}T12:00:00+07:00`); if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<start) throw httpError('ช่วงวันลาไม่ถูกต้อง',400);
  let days=0; for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){const dow=d.getDay();if(dow!==0&&dow!==6)days++;}
  if(startDate===endDate&&['am','pm','half'].includes(dayPart)) days=0.5;
  return days|| (startDate===endDate?1:0);
}

async function getEmployeeLeaveProfile(db,employeeId,clientId,year){
  await ensureDefaultLeavePolicies(db,clientId);
  const employee=await db.prepare(`SELECT e.*,ap.nickname AS approver_nickname,ap.first_name AS approver_first_name,ap.last_name AS approver_last_name FROM employees e LEFT JOIN employees ap ON ap.id=e.leave_approver_employee_id WHERE e.id=?1 AND e.client_id=?2`).bind(employeeId,clientId).first();
  if(!employee) throw httpError('ไม่พบพนักงาน',404);
  const policies=(await db.prepare('SELECT * FROM leave_policies WHERE client_id=?1 AND is_active=1 ORDER BY sort_order,name').bind(clientId).all()).results||[];
  const ent=(await db.prepare('SELECT * FROM employee_leave_entitlements WHERE employee_id=?1 AND year=?2').bind(employeeId,year).all()).results||[];
  const requests=(await db.prepare(`SELECT policy_id,status,SUM(COALESCE(duration_days,0)) AS days FROM leave_requests WHERE employee_id=?1 AND substr(start_date,1,4)=?2 AND status IN ('approved','pending','awaiting_evidence') GROUP BY policy_id,status`).bind(employeeId,String(year)).all()).results||[];
  const balances=policies.map(policy=>{
    const override=ent.find(x=>Number(x.leave_policy_id)===Number(policy.id));
    const entitlement=override?num(override.entitlement_days):num(policy.default_entitlement_days); const adjustment=override?num(override.adjustment_days):0;
    const used=requests.filter(x=>Number(x.policy_id)===Number(policy.id)&&x.status==='approved').reduce((a,x)=>a+num(x.days),0);
    const pending=requests.filter(x=>Number(x.policy_id)===Number(policy.id)&&x.status!=='approved').reduce((a,x)=>a+num(x.days),0);
    const total=entitlement+adjustment; const remaining=Number(policy.is_unlimited)?null:Math.max(-999,total-used-pending);
    return {...policy,entitlement_days:entitlement,adjustment_days:adjustment,total_days:total,used_days:used,pending_days:pending,remaining_days:remaining,note:override?.note||null};
  });
  return {employee,year,balances};
}

async function resolveLeavePolicy(db,clientId,policyId,leaveType){
  await ensureDefaultLeavePolicies(db,clientId);
  if(policyId) return db.prepare('SELECT * FROM leave_policies WHERE id=?1 AND client_id=?2 AND is_active=1').bind(policyId,clientId).first();
  if(leaveType) return db.prepare('SELECT * FROM leave_policies WHERE code=?1 AND client_id=?2 AND is_active=1').bind(leaveType,clientId).first();
  return null;
}

async function createLeaveRequest(env,{clientId,employeeId,policyId,leaveType,startDate,endDate,dayPart='full',reason='',submittedVia='line',submittedByUserId=null}){
  const employee=await getEmployeeForClient(env.DB,employeeId,clientId); if(!employee) throw httpError('ไม่พบพนักงาน',404);
  const policy=await resolveLeavePolicy(env.DB,clientId,policyId,leaveType); if(!policy) throw httpError('ไม่พบประเภทลา',400);
  if(!startDate||!endDate) throw httpError('กรุณาเลือกวันลาให้ครบ',400);
  const duration=businessDaysInclusive(startDate,endDate,dayPart); if(duration<=0) throw httpError('ช่วงนี้ไม่มีวันทำงานให้ลา',400);
  if(Number(policy.requires_reason)&&String(reason).trim().length<2) throw httpError('กรุณาระบุเหตุผลการลา',400);
  const overlap=await env.DB.prepare("SELECT id FROM leave_requests WHERE employee_id=?1 AND status IN ('pending','awaiting_evidence','approved') AND NOT(end_date<?2 OR start_date>?3) LIMIT 1").bind(employeeId,startDate,endDate).first(); if(overlap) throw httpError('มีคำขอลาในช่วงวันที่นี้อยู่แล้ว',409);
  const profile=await getEmployeeLeaveProfile(env.DB,employeeId,clientId,Number(startDate.slice(0,4)));
  const bal=profile.balances.find(x=>Number(x.id)===Number(policy.id));
  if(!Number(policy.is_unlimited)&&!Number(policy.allow_negative)&&num(bal?.remaining_days)<duration) throw httpError(`สิทธิ์${policy.name}ไม่พอ · เหลือ ${num(bal?.remaining_days)} วัน`,409);
  if(submittedVia==='line' && num(policy.notice_days)>0){
    const today=dateInBangkok(); const minDate=new Date(`${today}T12:00:00+07:00`); minDate.setDate(minDate.getDate()+num(policy.notice_days));
    if(new Date(`${startDate}T12:00:00+07:00`)<minDate) throw httpError(`${policy.name} ต้องแจ้งล่วงหน้าอย่างน้อย ${policy.notice_days} วัน`,409);
  }
  const evidenceRequired=policy.evidence_required_after_days!=null && duration>=num(policy.evidence_required_after_days);
  let approverId=employee.leave_approver_employee_id||employee.manager_employee_id||null;
  if(approverId && !await employeeHasPermission(env.DB,clientId,Number(approverId),'leave.approve')) approverId=null;
  if(submittedVia==='line' && !approverId) throw httpError('HR ยังไม่ได้กำหนดผู้อนุมัติที่มีสิทธิ์อนุมัติการลาให้คุณ กรุณาติดต่อ HR ก่อนส่งคำขอ',409);
  const status=evidenceRequired?'awaiting_evidence':'pending';
  const result=await env.DB.prepare(`INSERT INTO leave_requests (client_id,employee_id,leave_type,policy_id,start_date,end_date,reason,status,approver_employee_id,duration_days,day_part,evidence_required,evidence_count,submitted_via) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,0,?13)`)
    .bind(clientId,employeeId,policy.code,Number(policy.id),startDate,endDate,reason||null,status,approverId,duration,dayPart,evidenceRequired?1:0,submittedVia).run();
  const id=Number(result.meta.last_row_id);
  await env.DB.prepare(`INSERT INTO leave_approval_events (client_id,leave_request_id,action,actor_type,actor_employee_id,actor_user_id,reason) VALUES (?1,?2,'submitted',?3,?4,?5,?6)`).bind(clientId,id,submittedVia==='line'?'employee':'user',submittedVia==='line'?employeeId:null,submittedVia==='line'?null:submittedByUserId,reason||null).run();
  return getLeaveRequestDetail(env.DB,id,clientId);
}

async function getLeaveRequestDetail(db,id,clientId=null){
  return db.prepare(`SELECT l.*,e.first_name,e.last_name,e.nickname,e.employee_code,e.line_user_id AS employee_line_user_id,e.line_provider_scope AS employee_line_provider_scope,lp.name AS leave_type_name,lp.code AS leave_policy_code,lp.is_unlimited,ap.first_name AS approver_first_name,ap.last_name AS approver_last_name,ap.nickname AS approver_nickname,ap.line_user_id AS approver_line_user_id,ap.line_provider_scope AS approver_line_provider_scope,(SELECT COUNT(*) FROM leave_request_evidence ev WHERE ev.leave_request_id=l.id) AS evidence_count FROM leave_requests l JOIN employees e ON e.id=l.employee_id LEFT JOIN leave_policies lp ON lp.id=l.policy_id LEFT JOIN employees ap ON ap.id=l.approver_employee_id WHERE l.id=?1 ${clientId?'AND l.client_id=?2':''}`).bind(...(clientId?[id,clientId]:[id])).first();
}

async function decideLeaveRequest(env,id,status,{actorType,actorEmployeeId=null,actorUserId=null,reason='',clientId=null,enforceApprover=false}={}){
  const row=await getLeaveRequestDetail(env.DB,id,clientId); if(!row) throw httpError('ไม่พบคำขอลา',404); if(row.status!=='pending') throw httpError('คำขอนี้ไม่ได้รออนุมัติแล้ว',409);
  if(enforceApprover){ if(Number(row.approver_employee_id)!==Number(actorEmployeeId)) throw httpError('คุณไม่ใช่ผู้อนุมัติของคำขอนี้',403); if(!await employeeHasPermission(env.DB,Number(row.client_id),Number(actorEmployeeId),'leave.approve')) throw httpError('บัญชีพนักงานนี้ไม่มีสิทธิ์อนุมัติการลา กรุณาให้ HR เพิ่มสิทธิ์ผู้อนุมัติ',403); }
  if(status==='rejected'&&String(reason).trim().length<2) throw httpError('กรุณาระบุเหตุผลที่ไม่อนุมัติ',400);
  if(status==='approved'&&Number(row.evidence_required)&&Number(row.evidence_count||0)<1) throw httpError('คำขอนี้ยังไม่มีหลักฐานตาม Policy',409);
  await env.DB.batch([
    env.DB.prepare(`UPDATE leave_requests SET status=?1,approved_at=CASE WHEN ?1='approved' THEN CURRENT_TIMESTAMP ELSE approved_at END,decision_reason=?2,decided_by_employee_id=?3,decided_by_user_id=?4,updated_at=CURRENT_TIMESTAMP WHERE id=?5`).bind(status,reason||null,actorEmployeeId,actorUserId,id),
    env.DB.prepare(`INSERT INTO leave_approval_events (client_id,leave_request_id,action,actor_type,actor_employee_id,actor_user_id,reason) VALUES (?1,?2,?3,?4,?5,?6,?7)`).bind(Number(row.client_id),id,status,actorType||'user',actorEmployeeId,actorUserId,reason||null)
  ]);
  if(status==='approved') await syncApprovedLeaveToAttendance(env.DB,row);
  const updated=await getLeaveRequestDetail(env.DB,id,Number(row.client_id));
  await notifyLeaveDecision(env,updated);
  await safeAudit(env.DB,Number(row.client_id),actorType||'user',String(actorEmployeeId||actorUserId||''),`leave.${status}`,'leave_request',String(id),{reason:reason||null});
  return updated;
}

async function syncApprovedLeaveToAttendance(db,row){
  const start=new Date(`${row.start_date}T12:00:00+07:00`),end=new Date(`${row.end_date}T12:00:00+07:00`);
  for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
    if([0,6].includes(d.getDay())) continue;
    const date=d.toISOString().slice(0,10);
    await db.prepare(`INSERT OR IGNORE INTO attendance (client_id,employee_id,work_date,source,status,note) VALUES (?1,?2,?3,'leave','leave',?4)`).bind(Number(row.client_id),Number(row.employee_id),date,`${row.leave_type_name||row.leave_type} #LV-${String(row.id).padStart(4,'0')}`).run();
  }
}

async function storeLineLeaveEvidence(env,{requestId,employeeId,clientId,message,accessToken}){
  if(!env.EVIDENCE_BUCKET) throw httpError('Evidence storage ยังไม่ได้เชื่อม R2',503);
  const row=await env.DB.prepare("SELECT * FROM leave_requests WHERE id=?1 AND employee_id=?2 AND client_id=?3 AND status IN ('pending','awaiting_evidence')").bind(requestId,employeeId,clientId).first(); if(!row) throw httpError('ไม่พบคำขอที่รอหลักฐาน',404);
  const response=await fetch(`https://api-data.line.me/v2/bot/message/${encodeURIComponent(message.id)}/content`,{headers:{authorization:`Bearer ${accessToken}`}}); if(!response.ok) throw httpError(`LINE content ${response.status}`,502);
  const contentType=response.headers.get('content-type')|| (message.type==='image'?'image/jpeg':'application/octet-stream');
  const size=Number(response.headers.get('content-length')||message.fileSize||0); if(size>10*1024*1024) throw httpError('ไฟล์ใหญ่เกิน 10 MB',413);
  const ext=contentType.includes('png')?'png':contentType.includes('jpeg')||contentType.includes('jpg')?'jpg':contentType.includes('pdf')?'pdf':'bin';
  const fileName=message.fileName||`evidence-${Date.now()}.${ext}`; const key=`client-${clientId}/leave-${requestId}/${crypto.randomUUID()}-${fileName.replace(/[^A-Za-z0-9._-]/g,'_')}`;
  await env.EVIDENCE_BUCKET.put(key,response.body,{httpMetadata:{contentType}});
  const result=await env.DB.prepare(`INSERT INTO leave_request_evidence (client_id,leave_request_id,uploaded_by_employee_id,r2_key,file_name,content_type,file_size,source) VALUES (?1,?2,?3,?4,?5,?6,?7,'line')`).bind(clientId,requestId,employeeId,key,fileName,contentType,size||null).run();
  return Number(result.meta.last_row_id);
}

async function createEvidenceShareUrl(env,requestId){
  const evidence=await env.DB.prepare('SELECT id FROM leave_request_evidence WHERE leave_request_id=?1 ORDER BY created_at LIMIT 1').bind(requestId).first(); if(!evidence) return null;
  const token=randomToken(32); const hash=await sha256Hex(token); const expiresAt=new Date(Date.now()+24*60*60*1000).toISOString();
  await env.DB.prepare('INSERT INTO leave_evidence_share_tokens (token_hash,evidence_id,expires_at) VALUES (?1,?2,?3)').bind(hash,Number(evidence.id),expiresAt).run();
  const base=String(env.APP_BASE_URL||'https://hr-line.organization-23c.workers.dev').replace(/\/$/,''); return `${base}/evidence/${encodeURIComponent(token)}`;
}
async function serveSharedEvidence(env,token){
  if(!env.EVIDENCE_BUCKET) return json({error:'Evidence storage ยังไม่พร้อม'},503);
  const hash=await sha256Hex(token); const row=await env.DB.prepare(`SELECT st.expires_at,ev.* FROM leave_evidence_share_tokens st JOIN leave_request_evidence ev ON ev.id=st.evidence_id WHERE st.token_hash=?1`).bind(hash).first();
  if(!row||new Date(row.expires_at).getTime()<=Date.now()) return new Response('Link expired',{status:410});
  const object=await env.EVIDENCE_BUCKET.get(row.r2_key); if(!object) return new Response('Not found',{status:404});
  const headers=new Headers(); object.writeHttpMetadata(headers); headers.set('cache-control','private, no-store'); headers.set('content-disposition',`inline; filename*=UTF-8''${encodeURIComponent(row.file_name||'evidence')}`); return new Response(object.body,{headers});
}

async function notifyLeaveApprover(env,requestId){
  const row=await getLeaveRequestDetail(env.DB,requestId); if(!row||row.status!=='pending') return;
  if(!row.approver_employee_id||!row.approver_line_user_id){
    console.warn(JSON.stringify({level:'warn',event:'leave_approver_missing_line',request_id:requestId,approver_id:row.approver_employee_id||null})); return;
  }
  const profile=await getEmployeeLeaveProfile(env.DB,Number(row.employee_id),Number(row.client_id),Number(String(row.start_date).slice(0,4)));
  const balance=profile.balances.find(x=>Number(x.id)===Number(row.policy_id));
  let evidenceUrl=null; if(Number(row.evidence_count)>0) evidenceUrl=await createEvidenceShareUrl(env,requestId);
  const token=await getAccessTokenForProviderScope(env,Number(row.client_id),row.approver_line_provider_scope); if(!token)return;
  await pushLineMessages(token,row.approver_line_user_id,[buildLeaveApprovalFlex({...row,balance,evidence_url:evidenceUrl})]);
}

async function notifyEmployeeEvidenceRequired(env,requestId){
  const row=await getLeaveRequestDetail(env.DB,requestId); if(!row?.employee_line_user_id) return;
  const scope=row.employee_line_provider_scope||'default';
  const token=await getAccessTokenForProviderScope(env,Number(row.client_id),scope); if(!token)return;
  await setLineSession(env.DB,lineSessionKey(scope,row.employee_line_user_id),'leave_evidence',{request_id:requestId,required:true});
  await pushLineMessages(token,row.employee_line_user_id,[{type:'text',text:`📎 คำขอ ${row.leave_type_name||row.leave_type} ${row.duration_days} วัน ต้องแนบหลักฐานตาม Policy\nส่งรูปหรือไฟล์ในแชตนี้ได้เลย`,quickReply:{items:[{type:'action',action:{type:'cameraRoll',label:'เลือกรูป'}},{type:'action',action:{type:'camera',label:'ถ่ายรูป'}}]}}]);
}

async function notifyLeaveDecision(env,row){
  if(!row?.employee_line_user_id) return;
  const approved=row.status==='approved';
  const token=await getAccessTokenForProviderScope(env,Number(row.client_id),row.employee_line_provider_scope); if(!token)return;
  await pushLineMessages(token,row.employee_line_user_id,[buildLeaveDecisionFlex(row,approved)]);
}

const LINE_CI = {
  bg: '#F8FAF8',
  card: '#FFFFFF',
  primary: '#167D7F',
  primaryDark: '#123C4A',
  mint: '#8FD6C8',
  mintSoft: '#EFF8F5',
  coral: '#FF8A65',
  coralSoft: '#FFF2EE',
  text: '#202B2D',
  muted: '#6B787A',
  border: '#E4EAE7',
  success: '#2E9B68',
  successSoft: '#ECF8F1',
  warning: '#E6A23C',
  warningSoft: '#FFF7E8',
  error: '#D9534F',
  errorSoft: '#FDECEC',
  info: '#3B82F6',
  infoSoft: '#EFF6FF',
};

function lineText(text,size='sm',color=LINE_CI.text,weight='regular',extra={}){
  return { type:'text', text:String(text), size, color, weight, wrap:true, scaling:true, ...extra };
}
function lineTone(tone='neutral'){
  const map={
    success:{bg:LINE_CI.successSoft,fg:LINE_CI.success},
    warning:{bg:LINE_CI.warningSoft,fg:'#9A6700'},
    error:{bg:LINE_CI.errorSoft,fg:LINE_CI.error},
    info:{bg:LINE_CI.infoSoft,fg:LINE_CI.info},
    coral:{bg:LINE_CI.coralSoft,fg:'#C75B3C'},
    teal:{bg:LINE_CI.mintSoft,fg:LINE_CI.primary},
    neutral:{bg:'#F3F6F4',fg:LINE_CI.muted},
  };
  return map[tone]||map.neutral;
}
function lineChip(text,tone='teal'){
  const c=lineTone(tone);
  return {type:'box',layout:'vertical',paddingTop:'4px',paddingBottom:'4px',paddingStart:'9px',paddingEnd:'9px',cornerRadius:'10px',backgroundColor:c.bg,flex:0,contents:[lineText(text,'xxs',c.fg,'bold',{align:'center'})]};
}
function lineBrandHeader(eyebrow,title,subtitle=''){
  const contents=[
    {type:'box',layout:'horizontal',alignItems:'center',contents:[
      {type:'box',layout:'vertical',width:'8px',height:'8px',cornerRadius:'4px',backgroundColor:LINE_CI.mint,contents:[]},
      lineText(eyebrow||'นากนะ','xxs',LINE_CI.primary,'bold',{margin:'sm',flex:1}),
    ]},
    lineText(title,'xl',LINE_CI.primaryDark,'bold',{margin:'sm'}),
  ];
  if(subtitle) contents.push(lineText(subtitle,'xs',LINE_CI.muted,'regular',{margin:'xs'}));
  return {type:'box',layout:'vertical',paddingAll:'18px',backgroundColor:LINE_CI.bg,contents};
}
function lineInfoCard(contents,tone='neutral'){
  const c=lineTone(tone);
  return {type:'box',layout:'vertical',spacing:'sm',paddingAll:'12px',cornerRadius:'14px',backgroundColor:c.bg,borderWidth:'1px',borderColor:tone==='neutral'?LINE_CI.border:c.bg,contents};
}
function lineInfoRow(label,value,valueColor=LINE_CI.text){
  return {type:'box',layout:'horizontal',spacing:'md',alignItems:'flex-start',contents:[
    lineText(label,'xs',LINE_CI.muted,'regular',{flex:2}),
    lineText(value,'xs',valueColor,'bold',{flex:3,align:'end'}),
  ]};
}
function linePrimaryButton(label,action){return {type:'button',style:'primary',height:'sm',color:LINE_CI.primary,action};}
function lineSecondaryButton(label,action,color=LINE_CI.mintSoft){return {type:'button',style:'secondary',height:'sm',color,action};}
function lineDangerButton(label,action){return {type:'button',style:'secondary',height:'sm',color:LINE_CI.errorSoft,action};}
function lineBubble({eyebrow='นากนะ',title,subtitle='',body=[],footer=[],status=null,statusTone='teal',size='mega'}){
  const bodyContents=[];
  if(status) bodyContents.push({type:'box',layout:'horizontal',contents:[lineChip(status,statusTone)]});
  bodyContents.push(...body);
  const bubble={
    type:'bubble',size,
    header:lineBrandHeader(eyebrow,title,subtitle),
    body:{type:'box',layout:'vertical',spacing:'md',paddingAll:'18px',backgroundColor:LINE_CI.card,contents:bodyContents},
    styles:{header:{backgroundColor:LINE_CI.bg},body:{backgroundColor:LINE_CI.card},footer:{backgroundColor:LINE_CI.card,separator:true}},
  };
  if(footer.length) bubble.footer={type:'box',layout:'vertical',spacing:'sm',paddingAll:'14px',contents:footer};
  return bubble;
}
function leavePolicyIcon(policy){
  const code=String(policy?.code||'').toLowerCase(); const name=String(policy?.name||'');
  if(code.includes('sick')||name.includes('ป่วย')) return '🤒';
  if(code.includes('annual')||name.includes('พักร้อน')) return '🏖';
  if(code.includes('personal')||name.includes('กิจ')) return '👤';
  if(code.includes('unpaid')||name.includes('ไม่รับ')) return '📄';
  return '🗓';
}
function formatLeaveRange(row){return `${formatThaiDateOnly(row.start_date)}${row.start_date!==row.end_date?` – ${formatThaiDateOnly(row.end_date)}`:''}`;}
function formatDayPart(part){return part==='am'?'ครึ่งวันเช้า':part==='pm'?'ครึ่งวันบ่าย':'เต็มวัน';}

function buildWelcomeFlex(name,company){
  return {type:'flex',altText:`ยินดีต้อนรับสู่ ${company}`,contents:lineBubble({
    eyebrow:'NAKNA · HR TECH',title:`ยินดีต้อนรับ ${name} 👋`,subtitle:'เชื่อม LINE กับบัญชีพนักงานเรียบร้อยแล้ว',status:'พร้อมใช้งาน',statusTone:'success',
    body:[lineInfoCard([lineInfoRow('บริษัท',company),lineInfoRow('ช่องทาง','LINE · เชื่อมแล้ว',LINE_CI.success)],'teal')],
    footer:[linePrimaryButton('เปิดเมนูพนักงาน',{type:'postback',label:'เปิดเมนูพนักงาน',data:'action=menu'})]
  })};
}
function buildEmployeeMenuFlex(emp){
  const name=emp.nickname||emp.first_name;
  return {type:'flex',altText:'เมนูพนักงาน · นากนะ',contents:lineBubble({
    eyebrow:'นากนะ · EMPLOYEE',title:`สวัสดี ${name} 👋`,subtitle:emp.company_name||'',
    body:[
      lineText('จัดการเรื่องงานประจำวันได้จากตรงนี้','sm',LINE_CI.muted),
      linePrimaryButton('📍  เช็กอิน',{type:'postback',label:'เช็กอิน',data:'action=checkin'}),
      lineSecondaryButton('🏠  เช็กเอาต์',{type:'postback',label:'เช็กเอาต์',data:'action=checkout'}),
      lineSecondaryButton('🏖  ขอลางาน',{type:'postback',label:'ขอลางาน',data:'action=leave_menu'},'#F1F7F5'),
      lineSecondaryButton('📅  ดูสิทธิ์ลา',{type:'postback',label:'ดูสิทธิ์ลา',data:'action=leave_balance'},'#F7F9F8'),
    ]
  })};
}
function buildEmployeeStatusFlex(emp,a){
  const hasIn=Boolean(a?.check_in_at), hasOut=Boolean(a?.check_out_at), isLeave=a?.status==='leave';
  const status=isLeave?'วันนี้ลา':hasIn?(a?.status==='late'?'มาสาย':'มาทำงานแล้ว'):'ยังไม่เช็กอิน';
  const tone=isLeave?'info':hasIn?(a?.status==='late'?'warning':'success'):'warning';
  const rows=[];
  if(isLeave){ rows.push(lineInfoRow('สถานะ','ลางาน',LINE_CI.info)); }
  else {
    rows.push(lineInfoRow('เช็กอิน',hasIn?formatBangkokTime(a.check_in_at):'—',hasIn?LINE_CI.success:LINE_CI.muted));
    rows.push(lineInfoRow('เช็กเอาต์',hasOut?formatBangkokTime(a.check_out_at):'—'));
    if(Number(a?.late_minutes||0)>0) rows.push(lineInfoRow('มาสาย',`${a.late_minutes} นาที`,LINE_CI.warning));
  }
  return {type:'flex',altText:'สถานะวันนี้',contents:lineBubble({eyebrow:'ATTENDANCE',title:'สถานะวันนี้',subtitle:emp.nickname||emp.first_name,status,statusTone:tone,body:[lineInfoCard(rows,tone)]})};
}
async function sendLeaveTypeMenu(env,replyToken,emp,accessToken){
  await ensureDefaultLeavePolicies(env.DB,Number(emp.client_id));
  const policies=(await env.DB.prepare('SELECT * FROM leave_policies WHERE client_id=?1 AND is_active=1 ORDER BY sort_order,name').bind(Number(emp.client_id)).all()).results||[];
  const profile=await getEmployeeLeaveProfile(env.DB,Number(emp.id),Number(emp.client_id),new Date().getFullYear());
  const balanceMap=new Map((profile.balances||[]).map(b=>[Number(b.id),b]));
  const buttons=policies.slice(0,8).map(p=>{
    const b=balanceMap.get(Number(p.id));
    const balance=b?(Number(b.is_unlimited)?'ไม่จำกัด':`${Number(b.remaining_days||0).toFixed(Number(b.remaining_days||0)%1?1:0)} วัน`):'';
    const suffix=balance?` · ${balance}`:'';
    return lineSecondaryButton(`${leavePolicyIcon(p)}  ${p.name}${suffix}`,{type:'postback',label:p.name,data:`action=leave_type&policy_id=${p.id}`},LINE_CI.mintSoft);
  });
  return replyLineMessages(accessToken,replyToken,[{type:'flex',altText:'เลือกประเภทการลา',contents:lineBubble({
    eyebrow:'LEAVE',title:'ขอลางาน',subtitle:'เลือกประเภทการลาที่ต้องการ',body:buttons.length?buttons:[lineInfoCard([lineText('ยังไม่มีประเภทการลาที่เปิดใช้งาน','sm',LINE_CI.muted)],'neutral')]
  })}]);
}
async function sendLeaveBalance(env,replyToken,emp,accessToken){
  const profile=await getEmployeeLeaveProfile(env.DB,Number(emp.id),Number(emp.client_id),new Date().getFullYear());
  const rows=(profile.balances||[]).map(b=>{
    const remaining=Number(b.is_unlimited)?'ไม่จำกัด':`${Number(b.remaining_days).toFixed(Number(b.remaining_days)%1?1:0)} วัน`;
    const tone=!Number(b.is_unlimited)&&Number(b.remaining_days)<2?'error':'teal';
    return lineInfoCard([
      {type:'box',layout:'horizontal',alignItems:'center',contents:[lineText(`${leavePolicyIcon(b)} ${b.name}`,'sm',LINE_CI.primaryDark,'bold',{flex:1}),lineChip(remaining,tone)]},
      !Number(b.is_unlimited)?lineText(`ใช้แล้ว ${Number(b.used_days||0).toFixed(1).replace('.0','')} · รออนุมัติ ${Number(b.pending_days||0).toFixed(1).replace('.0','')} วัน`,'xxs',LINE_CI.muted):lineText('สิทธิ์ไม่จำกัดตามนโยบายบริษัท','xxs',LINE_CI.muted)
    ],'neutral');
  });
  return replyLineMessages(accessToken,replyToken,[{type:'flex',altText:'สิทธิ์ลาคงเหลือ',contents:lineBubble({eyebrow:'LEAVE BALANCE',title:`สิทธิ์ลา ${profile.year}`,subtitle:emp.nickname||emp.first_name,body:rows})}]);
}
function buildDatePickerFlex(title,action,policyId,start=null){
  const data=`action=${action}&policy_id=${policyId}${start?`&start=${start}`:''}`;
  return {type:'flex',altText:title,contents:lineBubble({eyebrow:'LEAVE · STEP',title,subtitle:'เลือกวันที่จากปฏิทิน',body:[lineInfoCard([lineText(start?`วันเริ่มลา ${formatThaiDateOnly(start)}`:'เลือกวันที่ที่ต้องการเริ่มลา','sm',LINE_CI.text,'bold')],'teal')],footer:[linePrimaryButton('เลือกวันที่',{type:'datetimepicker',label:'เลือกวันที่',data,mode:'date'})]})};
}
function buildLeaveDayPartFlex(policyId,startDate,endDate){
  const make=(label,part,primary=false)=>primary?linePrimaryButton(label,{type:'postback',label,data:`action=leave_daypart&policy_id=${policyId}&start=${startDate}&end=${endDate}&part=${part}`}):lineSecondaryButton(label,{type:'postback',label,data:`action=leave_daypart&policy_id=${policyId}&start=${startDate}&end=${endDate}&part=${part}`});
  return {type:'flex',altText:'เลือกรูปแบบวันลา',contents:lineBubble({eyebrow:'LEAVE · STEP',title:'เลือกรูปแบบวันลา',subtitle:formatThaiDateOnly(startDate),body:[make('เต็มวัน','full',true),make('ครึ่งวันเช้า','am'),make('ครึ่งวันบ่าย','pm')]})};
}
function buildLeaveReasonPromptFlex(startDate,endDate,dayPart='full'){
  const range=startDate===endDate?`${formatThaiDateOnly(startDate)} · ${formatDayPart(dayPart)}`:`${formatThaiDateOnly(startDate)} – ${formatThaiDateOnly(endDate)}`;
  return {type:'flex',altText:'ระบุเหตุผลการลา',contents:lineBubble({eyebrow:'LEAVE · STEP',title:'ระบุเหตุผลการลา',subtitle:'พิมพ์เหตุผลส่งเป็นข้อความถัดไป',body:[lineInfoCard([lineInfoRow('วันที่',range),lineText('ตัวอย่าง: มีธุระครอบครัว / มีไข้และไปพบแพทย์','xs',LINE_CI.muted)],'teal')]})};
}
function buildLeaveSubmittedFlex(row){
  const pending=row.status==='pending'; const awaiting=row.status==='awaiting_evidence';
  const tone=pending?'warning':awaiting?'coral':'success'; const status=pending?'รออนุมัติ':awaiting?'รอหลักฐาน':'ส่งแล้ว';
  const body=[lineInfoCard([
    lineInfoRow('ประเภท',row.leave_type_name||row.leave_type,LINE_CI.primaryDark),
    lineInfoRow('วันที่',formatLeaveRange(row)),
    lineInfoRow('จำนวน',`${Number(row.duration_days||0).toFixed(Number(row.duration_days||0)%1?1:0)} วัน`),
    row.reason?{type:'separator',color:LINE_CI.border}:null,
    row.reason?lineText('เหตุผล','xxs',LINE_CI.muted,'bold'):null,
    row.reason?lineText(row.reason,'sm',LINE_CI.text):null,
  ].filter(Boolean),'neutral')];
  const footer=[];
  if(awaiting||Number(row.evidence_required)) footer.push(lineSecondaryButton('📎  แนบหลักฐาน',{type:'postback',label:'แนบหลักฐาน',data:`action=leave_attach&id=${row.id}`},LINE_CI.coralSoft));
  footer.push(lineSecondaryButton('ดูสิทธิ์ลา',{type:'postback',label:'ดูสิทธิ์ลา',data:'action=leave_balance'},LINE_CI.mintSoft));
  return {type:'flex',altText:`ส่งคำขอ${row.leave_type_name||row.leave_type}แล้ว`,contents:lineBubble({eyebrow:`คำขอ #LV-${String(row.id).padStart(4,'0')}`,title:'ส่งคำขอเรียบร้อยแล้ว',subtitle:'นากนะส่งต่อให้ผู้เกี่ยวข้องแล้ว',status,statusTone:tone,body,footer})};
}
function buildLeaveApprovalFlex(row){
  const before=row.balance?.is_unlimited?'ไม่จำกัด':row.balance?`${Number(row.balance.remaining_days||0)+Number(row.duration_days||0)} วัน`:'—';
  const after=row.balance?.is_unlimited?'ไม่จำกัด':row.balance?`${Number(row.balance.remaining_days||0)} วัน`:'—';
  const evidenceCount=Number(row.evidence_count||0);
  const body=[
    lineInfoCard([
      lineInfoRow('พนักงาน',`${row.nickname||row.first_name} ${row.last_name||''}`.trim(),LINE_CI.primaryDark),
      lineInfoRow('ประเภท',row.leave_type_name||row.leave_type),
      lineInfoRow('วันที่',formatLeaveRange(row)),
      lineInfoRow('จำนวน',`${Number(row.duration_days||0).toFixed(Number(row.duration_days||0)%1?1:0)} วัน`),
    ],'neutral'),
    lineInfoCard([lineText('เหตุผล','xxs',LINE_CI.muted,'bold'),lineText(row.reason||'—','sm',LINE_CI.text)],'teal'),
    {type:'box',layout:'horizontal',spacing:'sm',contents:[
      {type:'box',layout:'vertical',flex:1,paddingAll:'10px',cornerRadius:'12px',backgroundColor:LINE_CI.bg,contents:[lineText('ก่อนลา','xxs',LINE_CI.muted,'bold'),lineText(before,'sm',LINE_CI.primaryDark,'bold',{margin:'xs'})]},
      {type:'box',layout:'vertical',flex:1,paddingAll:'10px',cornerRadius:'12px',backgroundColor:LINE_CI.mintSoft,contents:[lineText('หลังอนุมัติ','xxs',LINE_CI.muted,'bold'),lineText(after,'sm',LINE_CI.primary,'bold',{margin:'xs'})]},
    ]},
    {type:'box',layout:'horizontal',alignItems:'center',contents:[lineText('หลักฐาน','xs',LINE_CI.muted,'bold',{flex:1}),lineChip(`${evidenceCount} ไฟล์`,Number(row.evidence_required)&&!evidenceCount?'error':evidenceCount?'success':'neutral')]}
  ];
  if(row.evidence_url) body.push(lineSecondaryButton('ดูหลักฐาน',{type:'uri',label:'ดูหลักฐาน',uri:row.evidence_url},LINE_CI.mintSoft));
  return {type:'flex',altText:`คำขอลาใหม่จาก ${row.nickname||row.first_name}`,contents:lineBubble({eyebrow:`คำขอ #LV-${String(row.id).padStart(4,'0')}`,title:'มีคำขอลารออนุมัติ',subtitle:`${row.nickname||row.first_name} · ${row.leave_type_name||row.leave_type}`,status:'รอคุณพิจารณา',statusTone:'warning',body,footer:[linePrimaryButton('อนุมัติ',{type:'postback',label:'อนุมัติ',data:`action=leave_approve&id=${row.id}`}),lineDangerButton('ไม่อนุมัติ',{type:'postback',label:'ไม่อนุมัติ',data:`action=leave_reject&id=${row.id}`})]})};
}
function buildLeaveDecisionFlex(row,approved){
  const body=[lineInfoCard([
    lineInfoRow('ประเภท',row.leave_type_name||row.leave_type),
    lineInfoRow('วันที่',formatLeaveRange(row)),
    lineInfoRow('จำนวน',`${Number(row.duration_days||0).toFixed(Number(row.duration_days||0)%1?1:0)} วัน`),
  ],'neutral')];
  if(!approved) body.push(lineInfoCard([lineText('เหตุผลที่ไม่อนุมัติ','xxs',LINE_CI.muted,'bold'),lineText(row.decision_reason||'ไม่ระบุ','sm',LINE_CI.text)],'error'));
  else body.push(lineText('ระบบอัปเดตสิทธิ์ลาและ Attendance ให้เรียบร้อยแล้ว','xs',LINE_CI.muted));
  return {type:'flex',altText:approved?'คำขอลาได้รับอนุมัติ':'คำขอลาไม่ผ่านการอนุมัติ',contents:lineBubble({eyebrow:'LEAVE UPDATE',title:approved?'อนุมัติคำขอแล้ว':'คำขอไม่ผ่านการอนุมัติ',subtitle:`#LV-${String(row.id).padStart(4,'0')}`,status:approved?'อนุมัติแล้ว':'ไม่อนุมัติ',statusTone:approved?'success':'error',body,footer:[lineSecondaryButton('กลับเมนู',{type:'postback',label:'กลับเมนู',data:'action=menu'},LINE_CI.mintSoft)]})};
}
function buildAttendanceResultFlex(kind,result){
  const checkin=kind==='checkin'; const late=checkin&&Number(result.late_minutes||0)>0;
  const tone=late?'warning':'success'; const status=checkin?(late?`สาย ${result.late_minutes} นาที`:'ตรงเวลา'):'บันทึกเวลาแล้ว';
  const tm=checkin?result.check_in_at:result.check_out_at;
  const rows=[lineInfoRow('เวลา',formatBangkokTime(tm),LINE_CI.primaryDark)];
  if(result.location_name) rows.push(lineInfoRow('สถานที่',result.location_name));
  if(result.distance_m!=null) rows.push(lineInfoRow('ระยะจากจุด',`${Math.round(result.distance_m)} ม.`));
  return {type:'flex',altText:checkin?'เช็กอินสำเร็จ':'เช็กเอาต์สำเร็จ',contents:lineBubble({eyebrow:'ATTENDANCE',title:checkin?'เช็กอินสำเร็จ':'เช็กเอาต์สำเร็จ',subtitle:'บันทึกเวลาเรียบร้อยแล้ว',status,statusTone:tone,body:[lineInfoCard(rows,tone)],footer:[lineSecondaryButton('ดูสถานะวันนี้',{type:'postback',label:'ดูสถานะวันนี้',data:'action=status'},LINE_CI.mintSoft)]})};
}
function buildLocationRequestFlex(action){
  const checkin=action==='checkin';
  return {type:'flex',altText:`ส่งตำแหน่งเพื่อ${checkin?'เช็กอิน':'เช็กเอาต์'}`,contents:lineBubble({eyebrow:'ATTENDANCE',title:`${checkin?'เช็กอิน':'เช็กเอาต์'}ด้วยตำแหน่ง`,subtitle:'นากนะจะใช้ตำแหน่งนี้เฉพาะการตรวจ Work Location',status:'รอตำแหน่ง',statusTone:'teal',body:[lineInfoCard([lineText('กด “ส่งตำแหน่งปัจจุบัน” ด้านล่าง แล้ว LINE จะให้คุณเลือกตำแหน่ง','sm',LINE_CI.text)],'teal')]})};
}
function buildSimpleNoticeFlex(title,message,tone='teal'){
  return {type:'flex',altText:title,contents:lineBubble({eyebrow:'นากนะ',title,body:[lineInfoCard([lineText(message,'sm',LINE_CI.text)],tone)],status:tone==='error'?'มีปัญหา':tone==='success'?'เรียบร้อย':null,statusTone:tone})};
}
async function replyEvidencePrompt(accessToken,replyToken,row){
  const message={type:'flex',altText:'แนบหลักฐานการลา',contents:lineBubble({eyebrow:'LEAVE · EVIDENCE',title:'แนบหลักฐานการลา',subtitle:row.leave_type_name||row.leave_type,status:'รอหลักฐาน',statusTone:'coral',body:[lineInfoCard([lineText('ส่งรูปหรือไฟล์ในแชตนี้ได้เลย เช่น ใบรับรองแพทย์หรือเอกสารประกอบ','sm',LINE_CI.text)],'coral')]})};
  message.quickReply={items:[{type:'action',action:{type:'cameraRoll',label:'เลือกรูป'}},{type:'action',action:{type:'camera',label:'ถ่ายรูป'}}]};
  return replyLineMessages(accessToken,replyToken,[message]);
}
async function replyLineMessages(accessToken,replyToken,messages){const response=await fetch('https://api.line.me/v2/bot/message/reply',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${accessToken}`},body:JSON.stringify({replyToken,messages})});if(!response.ok)console.error(JSON.stringify({level:'error',event:'line_reply_messages_failed',status:response.status,body:await response.text()}));}
async function pushLineMessages(accessToken,to,messages){if(!accessToken||!to)return;const response=await fetch('https://api.line.me/v2/bot/message/push',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${accessToken}`},body:JSON.stringify({to,messages})});if(!response.ok)console.error(JSON.stringify({level:'error',event:'line_push_messages_failed',status:response.status,body:await response.text()}));}

async function sendDailyHrBrief(env) {
  const clients = await env.DB.prepare('SELECT * FROM clients ORDER BY id').all();
  for (const client of clients.results || []) {
    const hrUsers = await env.DB.prepare(`
      SELECT DISTINCT e.line_user_id,e.line_provider_scope
      FROM employees e
      LEFT JOIN departments d ON d.id=e.department_id
      LEFT JOIN positions p ON p.id=e.position_id
      WHERE e.client_id=?1 AND e.status='active' AND e.line_user_id IS NOT NULL
        AND (UPPER(COALESCE(d.code,''))='HR' OR LOWER(COALESCE(p.name,'')) LIKE '%hr%')
    `).bind(Number(client.id)).all();
    if (!(hrUsers.results || []).length) continue;

    const dashboard = await getDashboard(env.DB, Number(client.id));
    const lines = [`☀️ HR Morning Brief — ${client.name}`, formatThaiShortDate(dashboard.today), ''];

    if (dashboard.attention.length) {
      lines.push('สิ่งที่ต้องจัดการ');
      for (const item of dashboard.attention) lines.push(`• ${item.label}: ${item.count}`);
      lines.push('');
    }

    if (dashboard.birthdays.length) {
      lines.push('🎂 Birthday Radar');
      for (const item of dashboard.birthdays.slice(0, 6)) {
        lines.push(`• ${item.name} — ${item.days === 0 ? 'วันนี้' : `อีก ${item.days} วัน`}`);
      }
      lines.push('');
    }

    if (dashboard.probation.length) {
      lines.push('⏳ Probation');
      for (const item of dashboard.probation.slice(0, 5)) lines.push(`• ${item.name} — อีก ${item.days} วัน`);
      lines.push('');
    }

    if (dashboard.contracts.length) {
      lines.push('📄 Contract');
      for (const item of dashboard.contracts.slice(0, 5)) lines.push(`• ${item.name} — อีก ${item.days} วัน`);
      lines.push('');
    }

    if (!dashboard.attention.length && !dashboard.birthdays.length && !dashboard.probation.length && !dashboard.contracts.length) {
      lines.push('✅ วันนี้ยังไม่มีเรื่องเร่งด่วนที่ระบบตรวจพบ');
    }

    const text = lines.join('\n').slice(0, 4900);
    for (const hr of hrUsers.results) {
      const token=await getAccessTokenForProviderScope(env,Number(client.id),hr.line_provider_scope);
      if(token) await pushLine(token, hr.line_user_id, text);
    }
  }
}

async function pushLine(accessToken, to, text) {
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
  });
  if (!response.ok) {
    console.error(JSON.stringify({ level: 'error', event: 'line_push_failed', status: response.status, body: await response.text() }));
  }
}

function formatThaiShortDate(isoDate) {
  const d = new Date(`${isoDate}T00:00:00+07:00`);
  return d.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
}

async function replyLineWithLocationQuickReply(accessToken, replyToken, text) {
  const action=String(text||'').includes('เช็กเอาต์')?'checkout':'checkin';
  const message=buildLocationRequestFlex(action);
  message.quickReply={items:[{type:'action',action:{type:'location',label:'ส่งตำแหน่งปัจจุบัน'}}]};
  return replyLineMessages(accessToken,replyToken,[message]);
}

async function replyLine(accessToken, replyToken, text) {
  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text: text.slice(0, 4900) }] }),
  });
  if (!response.ok) {
    console.error(JSON.stringify({ level: 'error', event: 'line_reply_failed', status: response.status, body: await response.text() }));
  }
}

async function verifyLineSignature(rawBody, signature, channelSecret) {
  if (!signature) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(channelSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expected = bytesToBase64(new Uint8Array(digest));
  return constantTimeEqual(expected, signature);
}

async function ensureCoreSchema(db) {
  if (!db) throw new Error('D1 binding DB is not available');
  const requiredTables = [
    'departments','positions','employees','attendance','leave_requests','candidates','employee_requests',
    'line_link_tokens','line_sessions','audit_logs','work_locations','employee_work_locations','employee_invites',
    'employee_invite_locations','line_join_tokens'
  ];
  const placeholders = requiredTables.map(() => '?').join(',');
  const existing = await db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name IN (${placeholders})`)
    .bind(...requiredTables).all();
  const names = new Set((existing.results || []).map(row => row.name));
  const missing = requiredTables.filter(name => !names.has(name));

  if (missing.length) {
    console.log(JSON.stringify({ level: 'info', event: 'core_schema_repair_start', missing }));
    const statements = INIT_SCHEMA_SQL.split(';').map(statement => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      const tableMatch = statement.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([A-Za-z0-9_]+)/i);
      const indexMatch = statement.match(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+([A-Za-z0-9_]+)/i);
      const label = tableMatch?.[1] || indexMatch?.[1] || 'schema_statement';
      try {
        await db.prepare(statement).run();
      } catch (error) {
        if (indexMatch) {
          console.warn(JSON.stringify({ level: 'warn', event: 'core_schema_index_skipped', label, detail: safeDbErrorDetail(error) }));
          continue;
        }
        throw new Error(`CORE_SCHEMA_STEP:${label}:${String(error?.message || error)}`);
      }
    }
  }

  await ensureColumn(db,'employee_invites','token_value','TEXT');
  const employeeColumns = [
    ['line_display_name','TEXT'],['line_picture_url','TEXT'],['line_linked_at','TEXT'],['onboarding_source','TEXT'],
    ['emergency_contact_name','TEXT'],['emergency_contact_phone','TEXT']
  ];
  const attendanceColumns = [
    ['checkin_location_id','INTEGER'],['checkin_location_name','TEXT'],['checkin_distance_m','REAL'],['checkin_accuracy_m','REAL'],
    ['checkout_location_id','INTEGER'],['checkout_location_name','TEXT'],['checkout_distance_m','REAL'],['checkout_accuracy_m','REAL']
  ];
  for (const [column,type] of employeeColumns) await ensureColumn(db,'employees',column,type);
  for (const [column,type] of attendanceColumns) await ensureColumn(db,'attendance',column,type);
  await ensureV050Schema(db);
  await ensureV060Ready(db);
  await ensureV061Ready(db);
  console.log(JSON.stringify({ level: 'info', event: 'core_schema_repair_complete' }));
}

async function ensureColumn(db, table, column, type) {
  const columns = await db.prepare(`PRAGMA table_info(${table})`).all();
  if ((columns.results || []).some(row => row.name === column)) return;
  await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
}

function safeCoreSchemaErrorDetail(error) {
  const text = String(error?.message || error || 'unknown');
  const step = text.match(/CORE_SCHEMA_STEP:([A-Za-z0-9_]+):(.*)$/);
  if (step) return `${step[1]}:${safeDbErrorDetail(new Error(step[2]))}`;
  return safeDbErrorDetail(error);
}

async function ensureDbReady(db) {
  if (!db) throw new Error('D1 binding DB is not available');
  const ready = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='clients'").first();
  if (!ready) {
    console.log(JSON.stringify({ level: 'info', event: 'database_bootstrap_start' }));
    await db.exec(INIT_SCHEMA_SQL);
    await db.exec(INIT_SEED_SQL);
    console.log(JSON.stringify({ level: 'info', event: 'database_bootstrap_complete' }));
  }
  const authReady = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").first();
  if (!authReady) await db.exec(INIT_AUTH_SCHEMA_SQL);
}

async function authorizeUser(request, env, { requireCompany = true } = {}) {
  const rawToken = getCookie(request, 'nakna_session');
  if (!rawToken) return { ok: false, status: 401, error: 'AUTH_REQUIRED' };
  const sessionHash = await sha256Hex(rawToken);
  const session = await env.DB.prepare(`
    SELECT s.token_hash, s.user_id, s.selected_client_id, s.expires_at,
           u.google_sub, u.email, u.name, u.picture_url, u.locale, u.status
    FROM auth_sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=?1
  `).bind(sessionHash).first();
  if (!session || session.status !== 'active' || new Date(session.expires_at).getTime() <= Date.now()) {
    if (session) await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash=?1').bind(sessionHash).run();
    return { ok: false, status: 401, error: 'AUTH_REQUIRED' };
  }

  let clientId = Number(session.selected_client_id || getCookie(request, 'nakna_company') || 0) || null;
  let role = null;
  if (clientId) {
    const member = await env.DB.prepare(`SELECT role FROM company_members WHERE user_id=?1 AND client_id=?2 AND status='active'`).bind(Number(session.user_id), clientId).first();
    if (!member) clientId = null;
    else role = member.role;
  }
  if (!clientId) {
    const first = await env.DB.prepare(`SELECT client_id, role FROM company_members WHERE user_id=?1 AND status='active' ORDER BY id LIMIT 1`).bind(Number(session.user_id)).first();
    if (first) {
      clientId = Number(first.client_id);
      role = first.role;
      await env.DB.prepare('UPDATE auth_sessions SET selected_client_id=?1 WHERE token_hash=?2').bind(clientId, sessionHash).run();
    }
  }
  if (requireCompany && !clientId) return { ok: false, status: 409, error: 'COMPANY_REQUIRED' };

  await env.DB.prepare('UPDATE auth_sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE token_hash=?1').bind(sessionHash).run();
  return {
    ok: true,
    sessionHash,
    clientId,
    role,
    user: {
      id: Number(session.user_id),
      google_sub: session.google_sub,
      email: session.email,
      name: session.name,
      picture_url: session.picture_url,
      locale: session.locale,
    },
  };
}

async function startGoogleLogin(request, env) {
  assertGoogleConfig(env);
  const state = randomToken(32);

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: oauthRedirectUri(request, env, '/auth/google/callback'),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  return redirectResponse(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, [oauthStateCookie('nakna_oauth_state', state, 600)]);
}

async function finishGoogleLogin(request, env) {
  assertGoogleConfig(env);
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = getCookie(request, 'nakna_oauth_state');

  if (!code || !state || !cookieState || !constantTimeEqual(state, cookieState)) {
    console.warn(JSON.stringify({ level: 'warn', event: 'google_oauth_failed', stage: 'state' }));
    return json({ error: 'GOOGLE_OAUTH_STATE_FAILED', stage: 'state' }, 400);
  }

  let tokens;
  try {
    tokens = await exchangeGoogleCode(code, oauthRedirectUri(request, env, '/auth/google/callback'), env);
  } catch (error) {
    const detail = safeOAuthErrorDetail(error);
    console.error(JSON.stringify({ level: 'error', event: 'google_oauth_failed', stage: 'token_exchange', detail }));
    return json({ error: 'GOOGLE_TOKEN_EXCHANGE_FAILED', stage: 'token_exchange', detail }, 500);
  }

  let profile;
  try {
    profile = await fetchGoogleProfile(tokens.access_token);
  } catch (error) {
    const detail = safeOAuthErrorDetail(error);
    console.error(JSON.stringify({ level: 'error', event: 'google_oauth_failed', stage: 'userinfo', detail }));
    return json({ error: 'GOOGLE_PROFILE_FAILED', stage: 'userinfo', detail }, 500);
  }

  if (!profile?.sub || !profile?.email || profile.email_verified === false) {
    console.warn(JSON.stringify({ level: 'warn', event: 'google_oauth_failed', stage: 'profile_validation' }));
    return json({ error: 'GOOGLE_PROFILE_INVALID', stage: 'profile_validation' }, 400);
  }

  let user;
  try {
    await env.DB.prepare(`
      INSERT INTO users (google_sub, email, name, picture_url, locale, status)
      VALUES (?1,?2,?3,?4,?5,'active')
      ON CONFLICT(google_sub) DO UPDATE SET
        email=excluded.email, name=excluded.name, picture_url=excluded.picture_url,
        locale=excluded.locale, status='active', updated_at=CURRENT_TIMESTAMP
    `).bind(profile.sub, profile.email.toLowerCase(), profile.name || profile.email, profile.picture || null, profile.locale || null).run();
    user = await env.DB.prepare('SELECT * FROM users WHERE google_sub=?1').bind(profile.sub).first();
    if (!user?.id) throw new Error('USER_NOT_FOUND_AFTER_UPSERT');
  } catch (error) {
    const detail = safeDbErrorDetail(error);
    console.error(JSON.stringify({ level: 'error', event: 'google_oauth_failed', stage: 'db_user', detail }));
    return json({ error: 'DB_USER_UPSERT_FAILED', stage: 'db_user', detail }, 500);
  }

  let firstMembership = null;
  try {
    firstMembership = await env.DB.prepare(`SELECT client_id FROM company_members WHERE user_id=?1 AND status='active' ORDER BY id LIMIT 1`).bind(Number(user.id)).first();
  } catch (error) {
    const detail = safeDbErrorDetail(error);
    console.error(JSON.stringify({ level: 'error', event: 'google_oauth_failed', stage: 'db_membership', detail }));
    return json({ error: 'DB_MEMBERSHIP_LOOKUP_FAILED', stage: 'db_membership', detail }, 500);
  }

  const sessionToken = randomToken(40);
  const sessionHash = await sha256Hex(sessionToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  try {
    await env.DB.prepare(`INSERT INTO auth_sessions (token_hash, user_id, selected_client_id, expires_at) VALUES (?1,?2,?3,?4)`)
      .bind(sessionHash, Number(user.id), firstMembership ? Number(firstMembership.client_id) : null, expiresAt).run();
  } catch (error) {
    const detail = safeDbErrorDetail(error);
    console.error(JSON.stringify({ level: 'error', event: 'google_oauth_failed', stage: 'db_session', detail }));
    return json({ error: 'DB_SESSION_CREATE_FAILED', stage: 'db_session', detail }, 500);
  }

  const cookies = [sessionCookie(sessionToken), clearCookie('nakna_oauth_state')];
  if (firstMembership) cookies.push(companyCookie(Number(firstMembership.client_id)));
  return redirectResponse(`${appOrigin(request, env)}/?auth=success`, cookies);
}

function safeOAuthErrorDetail(error) {
  const text = String(error?.message || error || 'unknown');
  const known = ['invalid_client', 'invalid_grant', 'redirect_uri_mismatch', 'access_denied', 'unauthorized_client'];
  for (const code of known) if (text.includes(code)) return code;
  if (text.includes('Google token exchange failed')) return 'token_exchange_failed';
  if (text.includes('Google userinfo failed')) return 'userinfo_failed';
  return 'oauth_failed';
}

function safeDbErrorDetail(error) {
  const text = String(error?.message || error || 'unknown');
  const table = text.match(/no such table:\s*([A-Za-z0-9_]+)/i);
  if (table) return `missing_table:${table[1]}`;
  if (/UNIQUE constraint failed/i.test(text)) return 'unique_constraint';
  if (/FOREIGN KEY constraint failed/i.test(text)) return 'foreign_key_constraint';
  if (/D1 binding DB is not available/i.test(text)) return 'db_binding_missing';
  if (/USER_NOT_FOUND_AFTER_UPSERT/i.test(text)) return 'user_missing_after_upsert';
  return 'db_operation_failed';
}

async function logoutSession(request, env) {
  const rawToken = getCookie(request, 'nakna_session');
  if (rawToken) await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash=?1').bind(await sha256Hex(rawToken)).run();
  const response = json({ ok: true });
  response.headers.append('Set-Cookie', clearCookie('nakna_session'));
  response.headers.append('Set-Cookie', clearCookie('nakna_company'));
  return response;
}

async function startGmailConnection(request, env) {
  assertGoogleConfig(env);
  if (!env.GOOGLE_TOKEN_ENCRYPTION_KEY) return json({ error: 'GOOGLE_TOKEN_ENCRYPTION_KEY is not configured' }, 500);
  const auth = await authorizeUser(request, env, { requireCompany: false });
  if (!auth.ok) return redirectResponse(`${appOrigin(request, env)}/?auth=required`);

  const state = randomToken(32);
  const stateHash = await sha256Hex(state);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await env.DB.prepare(`INSERT INTO oauth_states (state_hash, purpose, user_id, expires_at) VALUES (?1,'gmail',?2,?3)`)
    .bind(stateHash, Number(auth.user.id), expiresAt).run();

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: oauthRedirectUri(request, env, '/integrations/gmail/callback'),
    response_type: 'code',
    scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
    state,
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    login_hint: auth.user.email,
  });
  return redirectResponse(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, [oauthStateCookie('nakna_gmail_state', state, 600)]);
}

async function finishGmailConnection(request, env) {
  assertGoogleConfig(env);
  if (!env.GOOGLE_TOKEN_ENCRYPTION_KEY) return gmailErrorRedirect(request, env, 'config');
  const auth = await authorizeUser(request, env, { requireCompany: false });
  if (!auth.ok) return redirectResponse(`${appOrigin(request, env)}/?auth=required`);

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = getCookie(request, 'nakna_gmail_state');
  if (!code || !state || !cookieState || !constantTimeEqual(state, cookieState)) return gmailErrorRedirect(request, env, 'state');
  const stateHash = await sha256Hex(state);
  const saved = await env.DB.prepare(`SELECT * FROM oauth_states WHERE state_hash=?1 AND purpose='gmail' AND user_id=?2`).bind(stateHash, Number(auth.user.id)).first();
  if (!saved || new Date(saved.expires_at).getTime() <= Date.now()) return gmailErrorRedirect(request, env, 'expired');
  await env.DB.prepare('DELETE FROM oauth_states WHERE state_hash=?1').bind(stateHash).run();

  const tokens = await exchangeGoogleCode(code, oauthRedirectUri(request, env, '/integrations/gmail/callback'), env);
  const profile = await fetchGoogleProfile(tokens.access_token);
  const current = await env.DB.prepare('SELECT encrypted_tokens FROM gmail_connections WHERE user_id=?1').bind(Number(auth.user.id)).first();
  let previous = null;
  if (current?.encrypted_tokens) {
    try { previous = await decryptJson(current.encrypted_tokens, env.GOOGLE_TOKEN_ENCRYPTION_KEY); } catch {}
  }
  const payload = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || previous?.refresh_token || null,
    token_type: tokens.token_type || 'Bearer',
  };
  if (!payload.refresh_token) return gmailErrorRedirect(request, env, 'refresh_token');
  const encrypted = await encryptJson(payload, env.GOOGLE_TOKEN_ENCRYPTION_KEY);
  const accessExpiresAt = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString();

  await env.DB.prepare(`
    INSERT INTO gmail_connections (user_id, google_sub, email, encrypted_tokens, scopes, access_expires_at)
    VALUES (?1,?2,?3,?4,?5,?6)
    ON CONFLICT(user_id) DO UPDATE SET google_sub=excluded.google_sub, email=excluded.email,
      encrypted_tokens=excluded.encrypted_tokens, scopes=excluded.scopes,
      access_expires_at=excluded.access_expires_at, updated_at=CURRENT_TIMESTAMP
  `).bind(Number(auth.user.id), profile.sub || null, profile.email || auth.user.email, encrypted, tokens.scope || '', accessExpiresAt).run();

  return redirectResponse(`${appOrigin(request, env)}/?gmail=connected`, [clearCookie('nakna_gmail_state')]);
}

async function exchangeGoogleCode(code, redirectUri, env) {
  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(`Google token exchange failed: ${data.error || response.status}`);
  return data;
}

async function fetchGoogleProfile(accessToken) {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Google userinfo failed: ${response.status}`);
  return data;
}

async function getMemberships(db, userId) {
  const result = await db.prepare(`
    SELECT c.id, c.name, c.code, m.role
    FROM company_members m JOIN clients c ON c.id=m.client_id
    WHERE m.user_id=?1 AND m.status='active'
    ORDER BY m.id
  `).bind(Number(userId)).all();
  return result.results || [];
}

async function getClaimableLegacyCompany(db) {
  return db.prepare(`
    SELECT c.id, c.name, c.code
    FROM clients c
    LEFT JOIN company_members m ON m.client_id=c.id AND m.status='active'
    GROUP BY c.id
    HAVING COUNT(m.id)=0
    ORDER BY c.id
    LIMIT 1
  `).first();
}

async function createCompanyForUser(db, auth, name) {
  let code = companyCode(name);
  for (let i = 0; i < 5; i++) {
    const exists = await db.prepare('SELECT id FROM clients WHERE code=?1').bind(code).first();
    if (!exists) break;
    code = `${companyCode(name).slice(0, 12)}-${randomToken(3).toUpperCase()}`;
  }
  const created = await db.prepare(`INSERT INTO clients (name, code, timezone, work_start, work_end) VALUES (?1,?2,'Asia/Bangkok','09:00','18:00')`).bind(name, code).run();
  const clientId = Number(created.meta.last_row_id);
  await db.prepare(`INSERT INTO company_members (client_id, user_id, role, status) VALUES (?1,?2,'owner','active')`).bind(clientId, Number(auth.user.id)).run();
  await db.prepare('UPDATE auth_sessions SET selected_client_id=?1 WHERE token_hash=?2').bind(clientId, auth.sessionHash).run();
  await safeAudit(db, clientId, 'user', String(auth.user.id), 'company.create', 'client', String(clientId), { name, code });
  return { id: clientId, name, code, role: 'owner' };
}

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, picture_url: user.picture_url, locale: user.locale };
}

function assertGoogleConfig(env) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw new Error('Google OAuth is not configured');
}

function appOrigin(request, env) {
  return String(env.APP_ORIGIN || new URL(request.url).origin).replace(/\/$/, '');
}

function oauthRedirectUri(request, env, path) {
  return `${appOrigin(request, env)}${path}`;
}

function authErrorRedirect(request, env, code) {
  return redirectResponse(`${appOrigin(request, env)}/?auth_error=${encodeURIComponent(code)}`);
}

function gmailErrorRedirect(request, env, code) {
  return redirectResponse(`${appOrigin(request, env)}/?gmail_error=${encodeURIComponent(code)}`);
}

function redirectResponse(location, cookies = []) {
  const headers = new Headers({ location });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 302, headers });
}

function getCookie(request, name) {
  const cookie = request.headers.get('cookie') || '';
  for (const part of cookie.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return '';
}

function sessionCookie(token) {
  return `nakna_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`;
}

function companyCookie(clientId) {
  return `nakna_company=${encodeURIComponent(String(clientId))}; Path=/; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`;
}

function oauthStateCookie(name, state, maxAge) {
  return `${name}=${encodeURIComponent(state)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function clearCookie(name) {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function withCookie(response, cookie) {
  response.headers.append('Set-Cookie', cookie);
  return response;
}

function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64Url(bytes) {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function encryptJson(value, secret) {
  const keyBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return `${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(ciphertext))}`;
}

async function decryptJson(value, secret) {
  const [ivPart, dataPart] = String(value).split('.');
  if (!ivPart || !dataPart) throw new Error('Invalid encrypted token');
  const keyBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64UrlToBytes(ivPart) }, key, base64UrlToBytes(dataPart));
  return JSON.parse(new TextDecoder().decode(plaintext));
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function companyCode(name) {
  const ascii = String(name).normalize('NFKD').replace(/[^A-Za-z0-9]+/g, '').toUpperCase().slice(0, 12);
  return ascii || `NAKNA-${randomToken(4).toUpperCase()}`;
}

async function getClient(db, id) {
  return db.prepare('SELECT * FROM clients WHERE id=?1').bind(id).first();
}

async function safeAudit(db, clientId, actorType, actorId, action, entityType, entityId, detail) {
  try {
    await audit(db, clientId, actorType, actorId, action, entityType, entityId, detail);
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'audit_write_failed', action, message: String(error?.message || error) }));
  }
}

async function audit(db, clientId, actorType, actorId, action, entityType, entityId, detail) {
  await db.prepare(`
    INSERT INTO audit_logs (client_id, actor_type, actor_id, action, entity_type, entity_id, detail_json)
    VALUES (?1,?2,?3,?4,?5,?6,?7)
  `).bind(clientId || null, actorType, actorId || null, action, entityType, entityId || null, detail ? JSON.stringify(detail) : null).run();
}

function upcomingBirthdays(employees, today, windowDays) {
  const year = Number(today.slice(0, 4));
  const todayDate = new Date(`${today}T00:00:00+07:00`);
  const out = [];
  for (const e of employees) {
    if (!e.birth_date) continue;
    const [, mm, dd] = e.birth_date.split('-').map(Number);
    let next = new Date(`${year}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}T00:00:00+07:00`);
    if (next < todayDate) next = new Date(`${year + 1}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}T00:00:00+07:00`);
    const days = Math.round((next - todayDate) / 86400000);
    if (days <= windowDays) out.push({ id: e.id, name: displayName(e), date: next.toISOString().slice(0,10), days });
  }
  return out.sort((a,b) => a.days - b.days);
}

function calculateLateMinutes(now, workStart, grace) {
  const [h, m] = String(workStart || '09:00').split(':').map(Number);
  const local = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const currentMinutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  return Math.max(0, currentMinutes - (h * 60 + m + grace));
}

function dateInBangkok(date = new Date()) {
  return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function formatBangkokTime(iso) {
  const d = new Date(iso);
  const local = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return `${String(local.getUTCHours()).padStart(2,'0')}:${String(local.getUTCMinutes()).padStart(2,'0')}`;
}

function daysBetween(a, b) {
  return Math.round((new Date(`${b}T00:00:00+07:00`) - new Date(`${a}T00:00:00+07:00`)) / 86400000);
}

function hoursBetween(a, b) {
  const normalize = value => /T|Z/.test(value) ? value : value.replace(' ', 'T') + 'Z';
  return (new Date(normalize(b)) - new Date(normalize(a))) / 3600000;
}

function displayName(e) {
  return e.nickname || e.first_name || e.employee_code || 'Employee';
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const r = 6371000;
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dp/2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function randomDigits(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => String(b % 10)).join('');
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function constantTimeEqual(a, b) {
  const aa = new TextEncoder().encode(String(a));
  const bb = new TextEncoder().encode(String(b));
  let diff = aa.length ^ bb.length;
  const len = Math.max(aa.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (aa[i % aa.length] || 0) ^ (bb[i % bb.length] || 0);
  return diff === 0;
}

function httpError(message, status) {
  const e = new Error(message); e.status = status; return e;
}

async function safeJson(request) {
  try { return await request.json(); } catch { return {}; }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}
