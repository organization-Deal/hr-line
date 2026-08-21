-- Nakna HR V1.0-P4 — KPI, 1:1 and Probation Review
CREATE TABLE IF NOT EXISTS performance_cycles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  cycle_type TEXT NOT NULL DEFAULT 'monthly' CHECK(cycle_type IN ('probation','monthly','quarterly','annual','custom')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('draft','active','closed','archived')),
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_performance_cycles_client ON performance_cycles(client_id,status,start_date);

CREATE TABLE IF NOT EXISTS kpi_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  cycle_id INTEGER,
  employee_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metric_type TEXT NOT NULL DEFAULT 'number' CHECK(metric_type IN ('number','percent','currency','text','boolean')),
  target_value REAL,
  target_text TEXT,
  unit TEXT,
  weight REAL NOT NULL DEFAULT 0,
  update_frequency TEXT NOT NULL DEFAULT 'monthly' CHECK(update_frequency IN ('daily','weekly','monthly','once')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('draft','active','completed','cancelled')),
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (cycle_id) REFERENCES performance_cycles(id) ON DELETE SET NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_kpi_goals_employee ON kpi_goals(client_id,employee_id,status);

CREATE TABLE IF NOT EXISTS kpi_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  goal_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  update_date TEXT NOT NULL,
  period_key TEXT,
  actual_value REAL,
  actual_text TEXT,
  progress_pct REAL,
  note TEXT,
  source TEXT NOT NULL DEFAULT 'web' CHECK(source IN ('web','line','hr')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (goal_id) REFERENCES kpi_goals(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_kpi_updates_goal ON kpi_updates(goal_id,update_date,id);

CREATE TABLE IF NOT EXISTS one_on_ones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  manager_employee_id INTEGER,
  scheduled_at TEXT,
  occurred_at TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','completed','cancelled','missed')),
  employee_notes TEXT,
  manager_notes TEXT,
  action_items TEXT,
  next_followup_at TEXT,
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (manager_employee_id) REFERENCES employees(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_one_on_ones_employee ON one_on_ones(client_id,employee_id,scheduled_at);

CREATE TABLE IF NOT EXISTS probation_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  reviewer_employee_id INTEGER,
  review_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','submitted','passed','extended','not_passed')),
  score REAL,
  strengths TEXT,
  improvements TEXT,
  manager_comment TEXT,
  hr_comment TEXT,
  recommendation TEXT,
  extension_end_date TEXT,
  submitted_at TEXT,
  decided_at TEXT,
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_employee_id) REFERENCES employees(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_probation_reviews_employee ON probation_reviews(client_id,employee_id,review_date);
