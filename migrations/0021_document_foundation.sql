-- Nakna HR P8.01 — Document & Evidence Foundation (Phase 1)
ALTER TABLE employee_documents ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE employee_documents ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE employee_documents ADD COLUMN source TEXT NOT NULL DEFAULT 'upload';
ALTER TABLE employee_documents ADD COLUMN confidentiality TEXT NOT NULL DEFAULT 'internal';
ALTER TABLE employee_documents ADD COLUMN sha256 TEXT;
ALTER TABLE employee_documents ADD COLUMN archived_at TEXT;
ALTER TABLE employee_documents ADD COLUMN supersedes_document_id INTEGER;

CREATE TABLE IF NOT EXISTS employee_document_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  document_id INTEGER NOT NULL,
  employee_id INTEGER,
  actor_type TEXT NOT NULL DEFAULT 'user',
  actor_user_id INTEGER,
  event_type TEXT NOT NULL,
  detail_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES employee_documents(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_employee_document_events_doc ON employee_document_events(client_id,document_id,created_at);
CREATE INDEX IF NOT EXISTS idx_employee_documents_status ON employee_documents(client_id,status,employee_id,created_at);
