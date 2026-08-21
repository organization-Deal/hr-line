-- Nakna HR V1.0-P2 — Leave + Employee Service

ALTER TABLE clients ADD COLUMN lock_leave_during_probation INTEGER NOT NULL DEFAULT 1;
ALTER TABLE employees ADD COLUMN leave_access_override INTEGER;
ALTER TABLE leave_policies ADD COLUMN available_during_probation INTEGER NOT NULL DEFAULT 0;
ALTER TABLE line_integrations ADD COLUMN rich_menu_id TEXT;
ALTER TABLE line_integrations ADD COLUMN rich_menu_updated_at TEXT;

CREATE TABLE IF NOT EXISTS hr_cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  subject TEXT NOT NULL,
  detail TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','waiting_employee','resolved','closed')),
  confidential INTEGER NOT NULL DEFAULT 1,
  submitted_via TEXT NOT NULL DEFAULT 'line',
  assigned_user_id INTEGER,
  hr_note TEXT,
  last_reply_to_employee TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_hr_cases_client_status ON hr_cases(client_id,status,created_at);
CREATE INDEX IF NOT EXISTS idx_hr_cases_employee ON hr_cases(employee_id,created_at);

CREATE TABLE IF NOT EXISTS hr_case_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  case_id INTEGER NOT NULL,
  actor_type TEXT NOT NULL,
  actor_employee_id INTEGER,
  actor_user_id INTEGER,
  action TEXT NOT NULL,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (case_id) REFERENCES hr_cases(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_hr_case_events_case ON hr_case_events(case_id,created_at);

CREATE TABLE IF NOT EXISTS broadcasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  audience_type TEXT NOT NULL DEFAULT 'all' CHECK(audience_type IN ('all','department','employees')),
  audience_value TEXT,
  channel_line INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sending','sent','partial','failed')),
  total_recipients INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_by_user_id INTEGER,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_broadcast_client ON broadcasts(client_id,created_at);

CREATE TABLE IF NOT EXISTS broadcast_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  broadcast_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  channel TEXT NOT NULL DEFAULT 'line',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','delivered','failed','skipped')),
  error TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(broadcast_id,employee_id,channel),
  FOREIGN KEY (broadcast_id) REFERENCES broadcasts(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_broadcast_delivery_status ON broadcast_deliveries(broadcast_id,status);

-- Sick leave remains available during probation by default; HR can still configure other leave types.
UPDATE leave_policies SET available_during_probation=1 WHERE code='sick';
