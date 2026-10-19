-- Nakna Recruitment — per-Inbox Gmail source selection.
-- Does not touch OAuth tokens, messages, Candidates or Google Workspace credentials.
CREATE TABLE IF NOT EXISTS recruitment_inbox_scopes (
  account_id INTEGER PRIMARY KEY REFERENCES recruitment_gmail_accounts(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'query' CHECK(mode IN ('query','recipient','sender','label','all')),
  value TEXT NOT NULL DEFAULT '',
  days INTEGER NOT NULL DEFAULT 30,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
