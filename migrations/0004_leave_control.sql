CREATE TABLE IF NOT EXISTS leave_policies (
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
-- คอลัมน์ V0.5 จะถูกเติมแบบ idempotent โดย /api/bootstrap เพื่อให้ upgrade จาก V0.4 ไม่ชน duplicate-column migration
