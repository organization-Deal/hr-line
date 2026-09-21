-- Nakna P8.05 — document delivery/reminder evidence
ALTER TABLE document_acknowledgements ADD COLUMN last_reminded_at TEXT;
ALTER TABLE document_acknowledgements ADD COLUMN reminder_count INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_document_ack_reminder ON document_acknowledgements(client_id,status,last_reminded_at);
