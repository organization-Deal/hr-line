-- Nakna HR P8.02 — Document & Evidence System Phase 2-7
ALTER TABLE employee_documents ADD COLUMN document_number TEXT;
ALTER TABLE employee_documents ADD COLUMN template_id INTEGER;
ALTER TABLE employee_documents ADD COLUMN workflow_status TEXT NOT NULL DEFAULT 'final';
ALTER TABLE employee_documents ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'not_required';
ALTER TABLE employee_documents ADD COLUMN acknowledgement_required INTEGER NOT NULL DEFAULT 0;
ALTER TABLE employee_documents ADD COLUMN acknowledgement_status TEXT NOT NULL DEFAULT 'not_required';
ALTER TABLE employee_documents ADD COLUMN final_at TEXT;
ALTER TABLE employee_documents ADD COLUMN sent_at TEXT;

CREATE TABLE IF NOT EXISTS document_templates (
 id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL,
 document_type TEXT NOT NULL, description TEXT, body_template TEXT NOT NULL DEFAULT '', numbering_prefix TEXT NOT NULL DEFAULT 'DOC',
 automation_mode TEXT NOT NULL DEFAULT 'assisted' CHECK(automation_mode IN ('manual','assisted','automatic')),
 approval_required INTEGER NOT NULL DEFAULT 1, acknowledgement_required INTEGER NOT NULL DEFAULT 0,
 visibility TEXT NOT NULL DEFAULT 'employee', active INTEGER NOT NULL DEFAULT 1, created_by_user_id INTEGER,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(client_id,code), FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_document_templates_client ON document_templates(client_id,active,document_type);

CREATE TABLE IF NOT EXISTS document_number_sequences (
 client_id INTEGER NOT NULL, template_id INTEGER NOT NULL, buddhist_year INTEGER NOT NULL, last_number INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(client_id,template_id,buddhist_year)
);

CREATE TABLE IF NOT EXISTS document_approvals (
 id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, document_id INTEGER NOT NULL, step_no INTEGER NOT NULL DEFAULT 1,
 approver_role TEXT, approver_user_id INTEGER, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','cancelled')),
 note TEXT, acted_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(document_id) REFERENCES employee_documents(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_document_approvals_pending ON document_approvals(client_id,status,created_at);

CREATE TABLE IF NOT EXISTS document_acknowledgements (
 id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, document_id INTEGER NOT NULL, employee_id INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','viewed','acknowledged','responded')),
 delivered_at TEXT, viewed_at TEXT, acknowledged_at TEXT, response_text TEXT, response_file_url TEXT,
 document_version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(document_id,employee_id,document_version), FOREIGN KEY(document_id) REFERENCES employee_documents(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_document_ack_pending ON document_acknowledgements(client_id,status,employee_id);

CREATE TABLE IF NOT EXISTS hr_document_cases (
 id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, case_number TEXT NOT NULL, employee_id INTEGER NOT NULL,
 case_type TEXT NOT NULL DEFAULT 'general', title TEXT NOT NULL, incident_date TEXT, description TEXT, status TEXT NOT NULL DEFAULT 'open',
 outcome TEXT, created_by_user_id INTEGER, closed_by_user_id INTEGER, closed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(client_id,case_number)
);
CREATE TABLE IF NOT EXISTS hr_document_case_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, case_id INTEGER NOT NULL, actor_user_id INTEGER,
 actor_employee_id INTEGER, event_type TEXT NOT NULL, detail TEXT, attachment_url TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(case_id) REFERENCES hr_document_cases(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS hr_document_case_documents (
 case_id INTEGER NOT NULL, document_id INTEGER NOT NULL, PRIMARY KEY(case_id,document_id),
 FOREIGN KEY(case_id) REFERENCES hr_document_cases(id) ON DELETE CASCADE, FOREIGN KEY(document_id) REFERENCES employee_documents(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_hr_document_cases ON hr_document_cases(client_id,status,employee_id,created_at);

CREATE TABLE IF NOT EXISTS document_automation_settings (
 client_id INTEGER PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 1, remind_pending_ack INTEGER NOT NULL DEFAULT 1,
 ack_reminder_days INTEGER NOT NULL DEFAULT 3, remind_expiry INTEGER NOT NULL DEFAULT 1, expiry_reminder_days INTEGER NOT NULL DEFAULT 30,
 updated_by_user_id INTEGER, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
