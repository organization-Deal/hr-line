-- Nakna Recruitment Screening: keep mail evidence and HR decisions independently.
-- No deletion/backfill of existing candidates; old imports require HR review.
CREATE TABLE IF NOT EXISTS recruitment_screening_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  source_kind TEXT NOT NULL CHECK(source_kind IN ('dedicated','legacy')),
  message_id INTEGER NOT NULL,
  decision TEXT NOT NULL CHECK(decision IN ('accepted','rejected','review')),
  candidate_id INTEGER,
  decided_by_user_id INTEGER,
  decided_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id,source_kind,message_id)
);
CREATE INDEX IF NOT EXISTS idx_screening_client_decision
  ON recruitment_screening_decisions(client_id,decision);
