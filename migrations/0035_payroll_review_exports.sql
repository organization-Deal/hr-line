-- Nakna HR P9.23 — saved payroll review Excel exports
-- Stores an immutable payroll/bank snapshot for every generated review workbook.

CREATE TABLE IF NOT EXISTS payroll_exports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  period_id INTEGER NOT NULL,
  export_type TEXT NOT NULL DEFAULT 'review_xlsx',
  file_name TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  net_total REAL NOT NULL DEFAULT 0,
  missing_bank_count INTEGER NOT NULL DEFAULT 0,
  source_updated_at TEXT,
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (period_id) REFERENCES payroll_periods(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payroll_exports_period
  ON payroll_exports(client_id, period_id, created_at DESC, id DESC);
