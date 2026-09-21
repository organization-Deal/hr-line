-- Nakna P8.17 — structured data for generated HR documents
ALTER TABLE employee_documents ADD COLUMN data_json TEXT;
CREATE INDEX IF NOT EXISTS idx_employee_documents_template_workflow
ON employee_documents(client_id,template_id,workflow_status,created_at);
