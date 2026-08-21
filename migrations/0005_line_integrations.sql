CREATE TABLE IF NOT EXISTS line_integrations (
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

-- line_provider_scope is added safely at runtime by /api/bootstrap for existing databases.
