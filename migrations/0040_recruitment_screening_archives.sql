-- Reversible removal from Recruitment screening UI. Source Gmail evidence and Candidate remain untouched.
CREATE TABLE IF NOT EXISTS recruitment_screening_archives (
  client_id INTEGER NOT NULL,
  source_kind TEXT NOT NULL CHECK(source_kind IN ('dedicated','legacy')),
  message_id INTEGER NOT NULL,
  archived_by_user_id INTEGER,
  archived_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id,source_kind,message_id)
);
CREATE INDEX IF NOT EXISTS idx_screening_archives_client
ON recruitment_screening_archives (client_id,archived_at);
