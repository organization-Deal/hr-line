-- P8.26: explicit two-step signature workflow.
-- HR signs first; employee can then sign/acknowledge; only after both signatures is a two-party document Final.
ALTER TABLE employee_documents ADD COLUMN hr_signature_status TEXT NOT NULL DEFAULT 'not_required';
ALTER TABLE employee_documents ADD COLUMN hr_signed_at TEXT;
ALTER TABLE employee_documents ADD COLUMN hr_signer_user_id INTEGER;
ALTER TABLE employee_documents ADD COLUMN hr_signer_name TEXT;
ALTER TABLE employee_documents ADD COLUMN hr_signer_position TEXT;
ALTER TABLE employee_documents ADD COLUMN hr_signature_method TEXT;
ALTER TABLE employee_documents ADD COLUMN hr_signature_sha256 TEXT;
ALTER TABLE employee_documents ADD COLUMN employee_signature_status TEXT NOT NULL DEFAULT 'not_required';
ALTER TABLE employee_documents ADD COLUMN employee_signed_at TEXT;

-- Preserve historical generated PDFs. They were already approved under the previous workflow.
UPDATE employee_documents
SET hr_signature_status = CASE
      WHEN source='generated' AND drive_file_id IS NOT NULL THEN 'signed'
      WHEN source='generated' AND approval_status='pending' THEN 'pending'
      ELSE hr_signature_status
    END,
    employee_signature_status = CASE
      WHEN acknowledgement_required=1 AND acknowledgement_status IN ('acknowledged','responded') THEN 'signed'
      WHEN acknowledgement_required=1 AND workflow_status='final' THEN 'pending'
      ELSE employee_signature_status
    END
WHERE source='generated';

CREATE INDEX IF NOT EXISTS idx_employee_documents_signature_workflow
ON employee_documents(client_id,hr_signature_status,employee_signature_status,workflow_status,created_at);
