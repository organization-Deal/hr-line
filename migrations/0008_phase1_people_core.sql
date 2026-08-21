-- Nakna HR V1.0-P1 — Foundation + People Core

ALTER TABLE departments ADD COLUMN parent_department_id INTEGER;
ALTER TABLE departments ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE employees ADD COLUMN people_status TEXT NOT NULL DEFAULT 'employee';
ALTER TABLE employees ADD COLUMN confirmed_at TEXT;
ALTER TABLE employees ADD COLUMN end_date TEXT;
ALTER TABLE employees ADD COLUMN end_reason TEXT;

ALTER TABLE clients ADD COLUMN allow_checkout_outside_geofence INTEGER NOT NULL DEFAULT 0;

ALTER TABLE attendance ADD COLUMN checkout_outside_geofence INTEGER NOT NULL DEFAULT 0;
ALTER TABLE attendance ADD COLUMN scheduled_start TEXT;
ALTER TABLE attendance ADD COLUMN scheduled_end TEXT;
ALTER TABLE attendance ADD COLUMN schedule_source TEXT;

CREATE TABLE IF NOT EXISTS work_schedule_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  scope_type TEXT NOT NULL CHECK(scope_type IN ('company','department','employee')),
  scope_id INTEGER NOT NULL DEFAULT 0,
  weekday INTEGER NOT NULL CHECK(weekday BETWEEN 1 AND 7),
  is_workday INTEGER NOT NULL DEFAULT 1,
  start_time TEXT,
  end_time TEXT,
  late_grace_minutes INTEGER NOT NULL DEFAULT 10,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id, scope_type, scope_id, weekday),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_work_schedule_rules_scope ON work_schedule_rules(client_id, scope_type, scope_id);

CREATE TABLE IF NOT EXISTS company_holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  holiday_date TEXT NOT NULL,
  name TEXT NOT NULL,
  holiday_type TEXT NOT NULL DEFAULT 'traditional',
  is_paid INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id, holiday_date),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_company_holidays_date ON company_holidays(client_id, holiday_date);

UPDATE employees
SET people_status = CASE
  WHEN status='active' AND probation_end_date IS NOT NULL AND date(probation_end_date) >= date('now') THEN 'probation'
  WHEN status='active' THEN 'employee'
  ELSE 'inactive'
END
WHERE people_status IS NULL OR people_status='';
