-- Nakna HR V1.0-P3 — Payroll Thailand core

CREATE TABLE IF NOT EXISTS payroll_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL UNIQUE,
  currency TEXT NOT NULL DEFAULT 'THB',
  pay_day INTEGER NOT NULL DEFAULT 28,
  daily_rate_divisor REAL NOT NULL DEFAULT 30,
  absence_deduction_enabled INTEGER NOT NULL DEFAULT 0,
  late_deduction_enabled INTEGER NOT NULL DEFAULT 0,
  late_deduction_per_minute REAL NOT NULL DEFAULT 0,
  social_security_enabled INTEGER NOT NULL DEFAULT 1,
  tax_enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payroll_rule_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER,
  rule_key TEXT NOT NULL,
  version TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  config_json TEXT NOT NULL,
  source_note TEXT,
  is_system INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id, rule_key, version)
);
CREATE INDEX IF NOT EXISTS idx_payroll_rules_effective ON payroll_rule_versions(rule_key,effective_from,effective_to);

CREATE TABLE IF NOT EXISTS employee_payroll_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL UNIQUE,
  base_salary REAL NOT NULL DEFAULT 0,
  social_security_enabled INTEGER NOT NULL DEFAULT 1,
  tax_enabled INTEGER NOT NULL DEFAULT 1,
  personal_allowance REAL NOT NULL DEFAULT 60000,
  extra_annual_deductions REAL NOT NULL DEFAULT 0,
  monthly_tax_override REAL,
  bank_name TEXT,
  bank_account_name TEXT,
  bank_account_no TEXT,
  payroll_note TEXT,
  effective_from TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_employee_payroll_client ON employee_payroll_profiles(client_id,employee_id);

CREATE TABLE IF NOT EXISTS payroll_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  period_key TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  pay_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','locked','published','void')),
  employee_count INTEGER NOT NULL DEFAULT 0,
  gross_total REAL NOT NULL DEFAULT 0,
  deduction_total REAL NOT NULL DEFAULT 0,
  net_total REAL NOT NULL DEFAULT 0,
  created_by_user_id INTEGER,
  locked_by_user_id INTEGER,
  locked_at TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id,period_key),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (locked_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_payroll_period_status ON payroll_periods(client_id,status,pay_date);

CREATE TABLE IF NOT EXISTS payroll_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  period_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  adjustment_type TEXT NOT NULL CHECK(adjustment_type IN ('earning','deduction')),
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  taxable INTEGER NOT NULL DEFAULT 1,
  sso_contributable INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (period_id) REFERENCES payroll_periods(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_period ON payroll_adjustments(period_id,employee_id);

CREATE TABLE IF NOT EXISTS payroll_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  period_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  base_salary REAL NOT NULL DEFAULT 0,
  prorated_salary REAL NOT NULL DEFAULT 0,
  absent_days REAL NOT NULL DEFAULT 0,
  late_minutes INTEGER NOT NULL DEFAULT 0,
  attendance_deduction REAL NOT NULL DEFAULT 0,
  overtime REAL NOT NULL DEFAULT 0,
  commission REAL NOT NULL DEFAULT 0,
  incentive REAL NOT NULL DEFAULT 0,
  allowance REAL NOT NULL DEFAULT 0,
  bonus REAL NOT NULL DEFAULT 0,
  other_earnings REAL NOT NULL DEFAULT 0,
  gross_income REAL NOT NULL DEFAULT 0,
  social_security REAL NOT NULL DEFAULT 0,
  withholding_tax REAL NOT NULL DEFAULT 0,
  other_deductions REAL NOT NULL DEFAULT 0,
  total_deductions REAL NOT NULL DEFAULT 0,
  net_pay REAL NOT NULL DEFAULT 0,
  breakdown_json TEXT,
  calculation_note TEXT,
  status TEXT NOT NULL DEFAULT 'preview',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(period_id,employee_id),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (period_id) REFERENCES payroll_periods(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_payroll_items_employee ON payroll_items(employee_id,period_id);
