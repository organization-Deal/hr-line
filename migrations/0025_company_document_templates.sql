-- Nakna P8.15 — multi-tenant company document identity
CREATE TABLE IF NOT EXISTS company_document_settings (
  client_id INTEGER PRIMARY KEY,
  legal_name TEXT,
  tax_id TEXT,
  address TEXT,
  phone TEXT,
  signer_name TEXT,
  signer_position TEXT,
  document_footer TEXT,
  numbering_style TEXT NOT NULL DEFAULT 'PREFIX-BE-SEQ',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE
);
