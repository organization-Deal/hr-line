-- Nakna P8.06 — HR Document Case end-to-end evidence links
ALTER TABLE hr_document_cases ADD COLUMN warning_document_id INTEGER;
ALTER TABLE hr_document_cases ADD COLUMN employee_response_status TEXT NOT NULL DEFAULT 'not_requested';
ALTER TABLE hr_document_cases ADD COLUMN employee_response_text TEXT;
ALTER TABLE hr_document_cases ADD COLUMN employee_responded_at TEXT;
CREATE INDEX IF NOT EXISTS idx_hr_document_case_warning ON hr_document_cases(client_id,warning_document_id);
