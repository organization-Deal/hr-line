-- Nakna Recruitment multi-inbox: independent Gmail OAuth connections.
-- Never alter google_workspace_integrations (Drive / Sheets / Payroll).
CREATE TABLE IF NOT EXISTS recruitment_gmail_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  google_sub TEXT NOT NULL,
  email TEXT NOT NULL,
  encrypted_tokens TEXT,
  scopes TEXT,
  token_expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'connected' CHECK(status IN ('connected','reconnect_required','disconnected')),
  enabled INTEGER NOT NULL DEFAULT 1,
  auto_sync INTEGER NOT NULL DEFAULT 1,
  query TEXT NOT NULL DEFAULT 'newer_than:30d {สมัคร resume CV "job application"}',
  last_sync_at TEXT,
  last_error TEXT,
  sync_lock_until TEXT,
  connected_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id, google_sub),
  UNIQUE(client_id, email)
);
CREATE INDEX IF NOT EXISTS idx_rga_sync ON recruitment_gmail_accounts(status,enabled,auto_sync,last_sync_at);
CREATE TABLE IF NOT EXISTS recruitment_inbox_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES recruitment_gmail_accounts(id) ON DELETE RESTRICT,
  gmail_message_id TEXT NOT NULL,
  gmail_thread_id TEXT,
  sender_name TEXT,
  sender_email TEXT,
  subject TEXT,
  received_at TEXT,
  snippet TEXT,
  attachment_names TEXT,
  candidate_id INTEGER REFERENCES candidates(id) ON DELETE SET NULL,
  import_status TEXT NOT NULL DEFAULT 'seen',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(account_id, gmail_message_id)
);
CREATE INDEX IF NOT EXISTS idx_rim_client_date ON recruitment_inbox_messages(client_id,received_at);
CREATE INDEX IF NOT EXISTS idx_rim_candidate ON recruitment_inbox_messages(client_id,candidate_id);
