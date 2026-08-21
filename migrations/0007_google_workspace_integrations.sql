CREATE TABLE IF NOT EXISTS google_workspace_integrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL UNIQUE,
  connected_by_user_id INTEGER,
  google_sub TEXT,
  email TEXT NOT NULL,
  encrypted_tokens TEXT NOT NULL,
  scopes TEXT,
  gmail_enabled INTEGER NOT NULL DEFAULT 1,
  drive_enabled INTEGER NOT NULL DEFAULT 1,
  sheets_enabled INTEGER NOT NULL DEFAULT 1,
  drive_folder_id TEXT,
  leave_evidence_folder_id TEXT,
  spreadsheet_id TEXT,
  status TEXT NOT NULL DEFAULT 'connected',
  last_sync_at TEXT,
  last_error TEXT,
  connected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (connected_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_google_workspace_status ON google_workspace_integrations(status);
