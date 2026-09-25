-- Nakna HR P9.22 — period-specific manual overrides for payable days and current-period salary
CREATE TABLE IF NOT EXISTS payroll_item_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  period_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  payable_days_override REAL,
  prorated_salary_override REAL,
  updated_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(period_id, employee_id),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (period_id) REFERENCES payroll_periods(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_payroll_item_overrides_period
  ON payroll_item_overrides(client_id, period_id, employee_id);
