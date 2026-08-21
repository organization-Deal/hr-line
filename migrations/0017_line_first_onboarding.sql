PRAGMA foreign_keys = ON;

-- Nakna HR V1.0-P6 — LINE-first business onboarding + magic login
-- User identity columns are added defensively at runtime by
-- ensureLineBusinessOnboardingReady() so this migration stays safe even when
-- the Worker was deployed before D1 migrations were applied.

CREATE TABLE IF NOT EXISTS line_admin_login_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_line_admin_login_expiry
ON line_admin_login_tokens(user_id, expires_at, used_at);
