-- Nakna HR V1.0-P3 — Payslip + employee document center

CREATE TABLE IF NOT EXISTS payroll_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  period_id INTEGER NOT NULL,
  payroll_item_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'payslip',
  file_name TEXT NOT NULL,
  storage_provider TEXT NOT NULL DEFAULT 'google_drive',
  drive_file_id TEXT,
  drive_url TEXT,
  content_type TEXT NOT NULL DEFAULT 'application/pdf',
  sha256 TEXT,
  share_token_hash TEXT UNIQUE,
  share_token_value TEXT,
  email_sent_at TEXT,
  line_notified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(period_id,employee_id,document_type),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (period_id) REFERENCES payroll_periods(id) ON DELETE CASCADE,
  FOREIGN KEY (payroll_item_id) REFERENCES payroll_items(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_payroll_documents_employee ON payroll_documents(employee_id,created_at);

CREATE TABLE IF NOT EXISTS employee_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  employee_id INTEGER,
  document_type TEXT NOT NULL,
  title TEXT NOT NULL,
  file_name TEXT,
  storage_provider TEXT NOT NULL DEFAULT 'google_drive',
  drive_file_id TEXT,
  drive_url TEXT,
  content_type TEXT,
  document_date TEXT,
  expires_at TEXT,
  visibility TEXT NOT NULL DEFAULT 'employee' CHECK(visibility IN ('employee','hr_only','manager')),
  note TEXT,
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_employee_documents_employee ON employee_documents(client_id,employee_id,document_type);
