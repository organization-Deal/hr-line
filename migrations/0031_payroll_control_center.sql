-- Nakna HR P9.00 — Payroll Control Center
-- Adds maker-checker workflow, custom recurring pay components, exception/variance data and audit timeline.

ALTER TABLE payroll_settings ADD COLUMN attendance_cutoff_day INTEGER NOT NULL DEFAULT 25;
ALTER TABLE payroll_settings ADD COLUMN commission_cutoff_day INTEGER NOT NULL DEFAULT 25;
ALTER TABLE payroll_settings ADD COLUMN variance_warning_pct REAL NOT NULL DEFAULT 30;
ALTER TABLE payroll_settings ADD COLUMN require_separate_approver INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payroll_settings ADD COLUMN employer_social_security_enabled INTEGER NOT NULL DEFAULT 1;

ALTER TABLE payroll_periods ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'not_required';
ALTER TABLE payroll_periods ADD COLUMN approved_by_user_id INTEGER;
ALTER TABLE payroll_periods ADD COLUMN approved_at TEXT;
ALTER TABLE payroll_periods ADD COLUMN cutoff_start TEXT;
ALTER TABLE payroll_periods ADD COLUMN cutoff_end TEXT;
ALTER TABLE payroll_periods ADD COLUMN payroll_note TEXT;

ALTER TABLE payroll_adjustments ADD COLUMN source_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_adjustments_grid_source
  ON payroll_adjustments(period_id,employee_id,source_key);

ALTER TABLE payroll_items ADD COLUMN employer_social_security REAL NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN employer_cost REAL NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN prior_net_pay REAL NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN variance_pct REAL NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN ytd_gross REAL NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN ytd_tax REAL NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN ytd_sso REAL NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS payroll_component_definitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  component_type TEXT NOT NULL CHECK(component_type IN ('earning','deduction')),
  category TEXT NOT NULL DEFAULT 'other',
  taxable INTEGER NOT NULL DEFAULT 1,
  sso_contributable INTEGER NOT NULL DEFAULT 0,
  recurring_default INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 100,
  active INTEGER NOT NULL DEFAULT 1,
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id,code),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_payroll_components_client ON payroll_component_definitions(client_id,active,display_order);

CREATE TABLE IF NOT EXISTS employee_payroll_components (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  component_id INTEGER NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  effective_from TEXT,
  effective_to TEXT,
  note TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_id,component_id,effective_from),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (component_id) REFERENCES payroll_component_definitions(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_employee_payroll_components_effective ON employee_payroll_components(client_id,employee_id,active,effective_from,effective_to);

CREATE TABLE IF NOT EXISTS payroll_period_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  period_id INTEGER NOT NULL,
  actor_user_id INTEGER,
  event_type TEXT NOT NULL,
  detail_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (period_id) REFERENCES payroll_periods(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_payroll_period_events ON payroll_period_events(period_id,created_at,id);

INSERT OR IGNORE INTO payroll_component_definitions
  (client_id,code,name,component_type,category,taxable,sso_contributable,recurring_default,display_order,active)
SELECT id,'POSITION_ALLOWANCE','ค่าตำแหน่ง','earning','allowance',1,1,1,10,1 FROM clients;
INSERT OR IGNORE INTO payroll_component_definitions
  (client_id,code,name,component_type,category,taxable,sso_contributable,recurring_default,display_order,active)
SELECT id,'TRAVEL_ALLOWANCE','ค่าเดินทาง','earning','allowance',1,0,1,20,1 FROM clients;
INSERT OR IGNORE INTO payroll_component_definitions
  (client_id,code,name,component_type,category,taxable,sso_contributable,recurring_default,display_order,active)
SELECT id,'PHONE_ALLOWANCE','ค่าโทรศัพท์','earning','allowance',1,0,1,30,1 FROM clients;
