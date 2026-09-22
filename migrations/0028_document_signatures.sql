ALTER TABLE company_document_settings ADD COLUMN signer_signature_data_url TEXT;

ALTER TABLE document_acknowledgements ADD COLUMN signer_name TEXT;
ALTER TABLE document_acknowledgements ADD COLUMN signature_method TEXT;
ALTER TABLE document_acknowledgements ADD COLUMN signature_sha256 TEXT;
ALTER TABLE document_acknowledgements ADD COLUMN signature_drive_file_id TEXT;
ALTER TABLE document_acknowledgements ADD COLUMN signature_url TEXT;
ALTER TABLE document_acknowledgements ADD COLUMN signature_user_agent TEXT;
ALTER TABLE document_acknowledgements ADD COLUMN signed_at TEXT;
ALTER TABLE document_acknowledgements ADD COLUMN acknowledged_pdf_drive_file_id TEXT;
ALTER TABLE document_acknowledgements ADD COLUMN acknowledged_pdf_url TEXT;
ALTER TABLE document_acknowledgements ADD COLUMN acknowledged_pdf_sha256 TEXT;
