-- Nakna HR V1.0-P7
-- LINE -> Web business setup, Recruitment Gmail sync, Benefits catalog

CREATE TABLE IF NOT EXISTS line_web_login_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  client_id INTEGER,
  purpose TEXT NOT NULL DEFAULT 'business_setup',
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_line_web_login_tokens_user ON line_web_login_tokens(user_id,purpose,expires_at,used_at);

CREATE TABLE IF NOT EXISTS company_onboarding (
  client_id INTEGER PRIMARY KEY,
  owner_user_id INTEGER,
  source TEXT NOT NULL DEFAULT 'web',
  current_step TEXT NOT NULL DEFAULT 'google_workspace',
  employee_estimate INTEGER,
  legal_name TEXT,
  tax_id TEXT,
  phone TEXT,
  address TEXT,
  province TEXT,
  recruitment_gmail_enabled INTEGER NOT NULL DEFAULT 1,
  recruitment_gmail_query TEXT NOT NULL DEFAULT 'newer_than:30d {สมัคร resume CV "job application"}',
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS recruitment_email_settings (
  client_id INTEGER PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  query TEXT NOT NULL DEFAULT 'newer_than:30d {สมัคร resume CV "job application"}',
  auto_sync INTEGER NOT NULL DEFAULT 1,
  last_sync_at TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recruitment_email_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  gmail_message_id TEXT NOT NULL,
  gmail_thread_id TEXT,
  sender_name TEXT,
  sender_email TEXT,
  subject TEXT,
  received_at TEXT,
  snippet TEXT,
  attachment_names TEXT,
  candidate_id INTEGER,
  import_status TEXT NOT NULL DEFAULT 'seen',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id,gmail_message_id),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_recruitment_email_client ON recruitment_email_messages(client_id,received_at);

CREATE TABLE IF NOT EXISTS benefit_programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  benefit_type TEXT NOT NULL DEFAULT 'custom',
  description TEXT,
  employer_amount REAL NOT NULL DEFAULT 0,
  employee_amount REAL NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  is_statutory INTEGER NOT NULL DEFAULT 0,
  eligibility_json TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id,code),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_benefit_programs_client ON benefit_programs(client_id,status);

CREATE TABLE IF NOT EXISTS employee_benefit_enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  benefit_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  start_date TEXT,
  end_date TEXT,
  note TEXT,
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(benefit_id,employee_id),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (benefit_id) REFERENCES benefit_programs(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_employee_benefits_employee ON employee_benefit_enrollments(client_id,employee_id,status);
