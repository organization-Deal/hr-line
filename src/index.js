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

CREATE INDEX IF NOT EXISTS idx_employees_client_status ON employees(client_id, status);
CREATE INDEX IF NOT EXISTS idx_employees_birth_date ON employees(birth_date);
CREATE INDEX IF NOT EXISTS idx_attendance_client_date ON attendance(client_id, work_date);
CREATE INDEX IF NOT EXISTS idx_leave_client_status ON leave_requests(client_id, status);
CREATE INDEX IF NOT EXISTS idx_candidates_client_stage ON candidates(client_id, stage);
CREATE INDEX IF NOT EXISTS idx_candidates_activity ON candidates(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_requests_client_status ON employee_requests(client_id, status);
`;

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
        return json({ ok: true, service: 'Nakna HR', brand: 'นากนะ', version: '0.3.4', auth: 'google-oauth' });
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

      if (url.pathname === '/webhooks/line' && request.method === 'POST') {
        return await handleLineWebhook(request, env, ctx);
      }

      if (url.pathname.startsWith('/api/')) {
        const auth = await authorizeUser(request, env, { requireCompany: !['/api/me','/api/companies','/api/onboarding/claim-company'].includes(url.pathname) });
        if (!auth.ok) return json({ error: auth.error }, auth.status);
        return handleApi(request, env, url, auth);
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

  if (path === '/api/companies' && method === 'POST') {
    const body = await safeJson(request);
    const name = String(body.name || '').trim();
    if (name.length < 2) return json({ error: 'กรุณาใส่ชื่อบริษัท' }, 400);
    const created = await createCompanyForUser(env.DB, auth, name);
    return withCookie(json({ ok: true, company: created }, 201), companyCookie(created.id));
  }

  if (path === '/api/onboarding/claim-company' && method === 'POST') {
    const body = await safeJson(request);
    const claimable = await getClaimableLegacyCompany(env.DB);
    if (!claimable || Number(body.client_id) !== Number(claimable.id)) return json({ error: 'Workspace นี้ไม่สามารถรับช่วงได้แล้ว' }, 409);
    await env.DB.prepare(`INSERT OR IGNORE INTO company_members (client_id, user_id, role, status) VALUES (?1,?2,'owner','active')`).bind(Number(claimable.id), Number(auth.user.id)).run();
    await env.DB.prepare('UPDATE auth_sessions SET selected_client_id=?1 WHERE token_hash=?2').bind(Number(claimable.id), auth.sessionHash).run();
    await audit(env.DB, Number(claimable.id), 'user', String(auth.user.id), 'company.claim', 'client', String(claimable.id), null);
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

  if (path === '/api/dashboard' && method === 'GET') {
    return json(await getDashboard(env.DB, clientId));
  }

  if (path === '/api/employees' && method === 'GET') {
    const result = await env.DB.prepare(`
      SELECT e.*, d.name AS department_name, p.name AS position_name
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN positions p ON p.id = e.position_id
      WHERE e.client_id = ?1
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

  if (path === '/api/attendance/today' && method === 'GET') {
    const client = await getClient(env.DB, clientId);
    if (!client) return json({ error: 'Client not found' }, 404);
    const workDate = dateInBangkok();
    const result = await env.DB.prepare(`
      SELECT e.id AS employee_id, e.employee_code, e.first_name, e.last_name, e.nickname,
             d.name AS department_name, a.check_in_at, a.check_out_at, a.status, a.late_minutes
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN attendance a ON a.employee_id = e.id AND a.work_date = ?1
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
      SELECT l.*, e.first_name, e.last_name, e.nickname
      FROM leave_requests l JOIN employees e ON e.id = l.employee_id
      WHERE l.client_id = ?1 ORDER BY l.created_at DESC
    `).bind(clientId).all();
    return json({ data: result.results });
  }

  if (path === '/api/leaves' && method === 'POST') {
    const body = await safeJson(request);
    if (!body.employee_id || !body.leave_type || !body.start_date || !body.end_date) return json({ error: 'Missing leave fields' }, 400);
    const employee = await env.DB.prepare('SELECT client_id FROM employees WHERE id = ?1').bind(Number(body.employee_id)).first();
    if (!employee || Number(employee.client_id) !== clientId) return json({ error: 'Employee not found' }, 404);
    const result = await env.DB.prepare(`
      INSERT INTO leave_requests (client_id, employee_id, leave_type, start_date, end_date, reason)
      VALUES (?1,?2,?3,?4,?5,?6)
    `).bind(clientId, Number(body.employee_id), body.leave_type, body.start_date, body.end_date, body.reason || null).run();
    return json({ ok: true, id: result.meta.last_row_id }, 201);
  }

  const leaveStatusMatch = path.match(/^\/api\/leaves\/(\d+)\/(approve|reject)$/);
  if (leaveStatusMatch && method === 'PATCH') {
    const status = leaveStatusMatch[2] === 'approve' ? 'approved' : 'rejected';
    await env.DB.prepare(`
      UPDATE leave_requests SET status = ?1, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?2 AND client_id = ?3
    `).bind(status, Number(leaveStatusMatch[1]), clientId).run();
    return json({ ok: true, status });
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
                WHERE l.client_id=?1 AND l.status='pending'`).bind(clientId),
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

  const present = employees.filter(e => attendanceByEmployee.has(Number(e.id))).length;
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

async function handleLineWebhook(request, env, ctx) {
  if (!env.LINE_CHANNEL_SECRET || !env.LINE_CHANNEL_ACCESS_TOKEN) {
    return json({ error: 'LINE secrets not configured' }, 503);
  }

  const signature = request.headers.get('x-line-signature') || '';
  const rawBody = await request.text();
  const valid = await verifyLineSignature(rawBody, signature, env.LINE_CHANNEL_SECRET);
  if (!valid) return json({ error: 'Invalid LINE signature' }, 401);

  let payload;
  try { payload = JSON.parse(rawBody); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const work = Promise.all((payload.events || []).map(event => processLineEvent(event, env)));
  ctx.waitUntil(work);
  return json({ ok: true });
}

async function processLineEvent(event, env) {
  const lineUserId = event?.source?.userId;
  if (!lineUserId || !event.replyToken) return;

  if (event.type === 'message' && event.message?.type === 'text') {
    const text = String(event.message.text || '').trim();

    const linkMatch = text.match(/^LINK\s+(\d{6})$/i);
    if (linkMatch) {
      const linked = await linkLineAccount(env.DB, lineUserId, linkMatch[1]);
      return replyLine(env.LINE_CHANNEL_ACCESS_TOKEN, event.replyToken,
        linked.ok ? `✅ เชื่อมบัญชีสำเร็จ\nสวัสดี ${linked.name}\nพิมพ์ “เช็กอิน” หรือ “เช็กเอาต์” ได้เลย` : `❌ ${linked.error}`);
    }

    const employee = await env.DB.prepare(`
      SELECT e.*, c.geofence_lat, c.geofence_lng, c.geofence_radius_m, c.geofence_name
      FROM employees e JOIN clients c ON c.id=e.client_id
      WHERE e.line_user_id=?1 AND e.status='active'
    `).bind(lineUserId).first();
    if (!employee) return replyLine(env.LINE_CHANNEL_ACCESS_TOKEN, event.replyToken, 'ยังไม่ได้เชื่อมบัญชีพนักงาน\nกรุณาขอรหัสจาก HR แล้วส่ง: LINK 123456');

    if (['เช็กอิน','checkin','check-in'].includes(text.toLowerCase())) {
      if (employee.geofence_lat != null && employee.geofence_lng != null) {
        await setLineSession(env.DB, lineUserId, 'checkin');
        return replyLine(env.LINE_CHANNEL_ACCESS_TOKEN, event.replyToken, '📍 ส่ง Location ปัจจุบันมาในแชตนี้เพื่อเช็กอิน');
      }
      try {
        const result = await checkIn(env.DB, Number(employee.id), null, null, 'line');
        return replyLine(env.LINE_CHANNEL_ACCESS_TOKEN, event.replyToken, `✅ Check-in สำเร็จ\nเวลา ${formatBangkokTime(result.check_in_at)}${result.late_minutes > 0 ? `\n🟠 สาย ${result.late_minutes} นาที` : '\n🟢 ตรงเวลา'}`);
      } catch (e) { return replyLine(env.LINE_CHANNEL_ACCESS_TOKEN, event.replyToken, `❌ ${e.message}`); }
    }

    if (['เช็กเอาต์','checkout','check-out'].includes(text.toLowerCase())) {
      if (employee.geofence_lat != null && employee.geofence_lng != null) {
        await setLineSession(env.DB, lineUserId, 'checkout');
        return replyLine(env.LINE_CHANNEL_ACCESS_TOKEN, event.replyToken, '📍 ส่ง Location ปัจจุบันมาในแชตนี้เพื่อเช็กเอาต์');
      }
      try {
        const result = await checkOut(env.DB, Number(employee.id), null, null, 'line');
        return replyLine(env.LINE_CHANNEL_ACCESS_TOKEN, event.replyToken, `✅ Check-out สำเร็จ\nเวลา ${formatBangkokTime(result.check_out_at)}`);
      } catch (e) { return replyLine(env.LINE_CHANNEL_ACCESS_TOKEN, event.replyToken, `❌ ${e.message}`); }
    }

    if (text === 'สถานะ' || text.toLowerCase() === 'status') {
      const today = dateInBangkok();
      const a = await env.DB.prepare('SELECT * FROM attendance WHERE employee_id=?1 AND work_date=?2').bind(Number(employee.id), today).first();
      const l = await env.DB.prepare(`SELECT COUNT(*) AS n FROM leave_requests WHERE employee_id=?1 AND status='pending'`).bind(Number(employee.id)).first();
      const statusText = a?.check_in_at ? `เข้า ${formatBangkokTime(a.check_in_at)}${a.check_out_at ? ` · ออก ${formatBangkokTime(a.check_out_at)}` : ''}` : 'ยังไม่เช็กอิน';
      return replyLine(env.LINE_CHANNEL_ACCESS_TOKEN, event.replyToken, `👤 ${displayName(employee)}\nวันนี้: ${statusText}\nใบลารออนุมัติ: ${Number(l?.n || 0)} รายการ`);
    }

    return replyLine(env.LINE_CHANNEL_ACCESS_TOKEN, event.replyToken, 'HR LINE OS\n• พิมพ์ “เช็กอิน”\n• พิมพ์ “เช็กเอาต์”\n• พิมพ์ “สถานะ”');
  }

  if (event.type === 'message' && event.message?.type === 'location') {
    const employee = await env.DB.prepare('SELECT * FROM employees WHERE line_user_id=?1 AND status=\'active\'').bind(lineUserId).first();
    if (!employee) return replyLine(env.LINE_CHANNEL_ACCESS_TOKEN, event.replyToken, 'ยังไม่ได้เชื่อมบัญชีพนักงาน');

    const session = await env.DB.prepare('SELECT * FROM line_sessions WHERE line_user_id=?1').bind(lineUserId).first();
    if (!session || new Date(session.expires_at).getTime() < Date.now()) {
      return replyLine(env.LINE_CHANNEL_ACCESS_TOKEN, event.replyToken, 'คำขอหมดเวลาแล้ว กรุณาพิมพ์ “เช็กอิน” หรือ “เช็กเอาต์” ใหม่');
    }

    const lat = Number(event.message.latitude);
    const lng = Number(event.message.longitude);
    try {
      const result = session.action === 'checkin'
        ? await checkIn(env.DB, Number(employee.id), lat, lng, 'line')
        : await checkOut(env.DB, Number(employee.id), lat, lng, 'line');
      await env.DB.prepare('DELETE FROM line_sessions WHERE line_user_id=?1').bind(lineUserId).run();
      const label = session.action === 'checkin' ? 'Check-in' : 'Check-out';
      const time = session.action === 'checkin' ? result.check_in_at : result.check_out_at;
      return replyLine(env.LINE_CHANNEL_ACCESS_TOKEN, event.replyToken, `✅ ${label} สำเร็จ\nเวลา ${formatBangkokTime(time)}${result.distance_m != null ? `\nระยะจากจุดทำงาน ${Math.round(result.distance_m)} เมตร` : ''}`);
    } catch (e) {
      return replyLine(env.LINE_CHANNEL_ACCESS_TOKEN, event.replyToken, `❌ ${e.message}`);
    }
  }

  if (event.type === 'postback') {
    const params = new URLSearchParams(event.postback?.data || '');
    const action = params.get('action');
    if (action === 'checkin' || action === 'checkout') {
      await setLineSession(env.DB, lineUserId, action);
      return replyLine(env.LINE_CHANNEL_ACCESS_TOKEN, event.replyToken, `📍 ส่ง Location ปัจจุบันมาเพื่อ${action === 'checkin' ? 'เช็กอิน' : 'เช็กเอาต์'}`);
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

  const distance = validateGeofence(employee, lat, lng);
  const lateMinutes = calculateLateMinutes(now, employee.work_start, Number(employee.late_grace_minutes || 0));
  const status = lateMinutes > 0 ? 'late' : 'present';
  const nowIso = now.toISOString();

  await db.prepare(`
    INSERT INTO attendance (client_id, employee_id, work_date, check_in_at, checkin_lat, checkin_lng, source, status, late_minutes)
    VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)
    ON CONFLICT(employee_id, work_date) DO UPDATE SET
      check_in_at=excluded.check_in_at, checkin_lat=excluded.checkin_lat, checkin_lng=excluded.checkin_lng,
      source=excluded.source, status=excluded.status, late_minutes=excluded.late_minutes, updated_at=CURRENT_TIMESTAMP
  `).bind(Number(employee.client_id), employeeId, workDate, nowIso, lat ?? null, lng ?? null, source, status, lateMinutes).run();

  await audit(db, Number(employee.client_id), source, String(employeeId), 'attendance.check_in', 'attendance', `${employeeId}:${workDate}`, { lat, lng, late_minutes: lateMinutes });
  return { check_in_at: nowIso, work_date: workDate, status, late_minutes: lateMinutes, distance_m: distance };
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

  const distance = validateGeofence(employee, lat, lng);
  const nowIso = new Date().toISOString();
  await db.prepare(`
    UPDATE attendance SET check_out_at=?1, checkout_lat=?2, checkout_lng=?3, updated_at=CURRENT_TIMESTAMP
    WHERE employee_id=?4 AND work_date=?5
  `).bind(nowIso, lat ?? null, lng ?? null, employeeId, workDate).run();

  await audit(db, Number(employee.client_id), source, String(employeeId), 'attendance.check_out', 'attendance', `${employeeId}:${workDate}`, { lat, lng });
  return { check_out_at: nowIso, work_date: workDate, distance_m: distance };
}

function validateGeofence(employee, lat, lng) {
  if (employee.geofence_lat == null || employee.geofence_lng == null) return null;
  if (lat == null || lng == null) throw httpError('ต้องส่ง Location เพื่อเช็กอิน/เอาต์', 400);
  const d = haversineMeters(Number(employee.geofence_lat), Number(employee.geofence_lng), Number(lat), Number(lng));
  if (d > Number(employee.geofence_radius_m || 250)) {
    throw httpError(`อยู่นอกพื้นที่ ${employee.geofence_name || 'จุดทำงาน'} (${Math.round(d)} เมตร)`, 403);
  }
  return d;
}

async function linkLineAccount(db, lineUserId, token) {
  const row = await db.prepare(`
    SELECT t.*, e.first_name, e.nickname, e.client_id
    FROM line_link_tokens t JOIN employees e ON e.id=t.employee_id
    WHERE t.token=?1 AND t.used_at IS NULL
  `).bind(token).first();
  if (!row) return { ok: false, error: 'รหัสไม่ถูกต้องหรือถูกใช้แล้ว' };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, error: 'รหัสหมดอายุแล้ว กรุณาขอรหัสใหม่จาก HR' };

  const used = await db.prepare('SELECT id FROM employees WHERE line_user_id=?1').bind(lineUserId).first();
  if (used && Number(used.id) !== Number(row.employee_id)) return { ok: false, error: 'LINE นี้เชื่อมกับพนักงานคนอื่นอยู่แล้ว' };

  await db.batch([
    db.prepare('UPDATE employees SET line_user_id=?1, updated_at=CURRENT_TIMESTAMP WHERE id=?2').bind(lineUserId, Number(row.employee_id)),
    db.prepare('UPDATE line_link_tokens SET used_at=CURRENT_TIMESTAMP WHERE token=?1').bind(token),
  ]);
  await audit(db, Number(row.client_id), 'line', lineUserId, 'employee.line_link', 'employee', String(row.employee_id), null);
  return { ok: true, name: row.nickname || row.first_name };
}

async function setLineSession(db, lineUserId, action) {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  await db.prepare(`
    INSERT INTO line_sessions (line_user_id, action, expires_at)
    VALUES (?1,?2,?3)
    ON CONFLICT(line_user_id) DO UPDATE SET action=excluded.action, expires_at=excluded.expires_at, created_at=CURRENT_TIMESTAMP
  `).bind(lineUserId, action, expiresAt).run();
}

async function sendDailyHrBrief(env) {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) {
    console.log(JSON.stringify({ level: 'warn', event: 'daily_hr_brief_skipped', reason: 'LINE access token missing' }));
    return;
  }

  const clients = await env.DB.prepare('SELECT * FROM clients ORDER BY id').all();
  for (const client of clients.results || []) {
    const hrUsers = await env.DB.prepare(`
      SELECT DISTINCT e.line_user_id
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
      await pushLine(env.LINE_CHANNEL_ACCESS_TOKEN, hr.line_user_id, text);
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
  await audit(db, clientId, 'user', String(auth.user.id), 'company.create', 'client', String(clientId), { name, code });
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
