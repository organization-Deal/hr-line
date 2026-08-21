-- Nakna HR V1.0-P2 — Leave audit ledger
CREATE TABLE IF NOT EXISTS leave_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  leave_policy_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  entry_type TEXT NOT NULL CHECK(entry_type IN ('entitlement','adjustment','reserved','released','used','restored')),
  days REAL NOT NULL,
  reference_type TEXT,
  reference_id INTEGER,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (leave_policy_id) REFERENCES leave_policies(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_leave_ledger_employee_year ON leave_ledger(employee_id,year,leave_policy_id,created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leave_ledger_reference_unique ON leave_ledger(entry_type,reference_type,reference_id) WHERE reference_id IS NOT NULL;
