-- Nakna HR V1.0-P5 — Engagement, Points & Rewards
CREATE TABLE IF NOT EXISTS engagement_settings (
  client_id INTEGER PRIMARY KEY,
  points_enabled INTEGER NOT NULL DEFAULT 1,
  leaderboard_enabled INTEGER NOT NULL DEFAULT 1,
  birthday_moment_enabled INTEGER NOT NULL DEFAULT 1,
  anniversary_moment_enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS point_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL CHECK(event_type IN ('attendance_streak','learning_complete','kpi_complete','birthday','work_anniversary','manual','custom')),
  points REAL NOT NULL DEFAULT 0,
  cash_value REAL NOT NULL DEFAULT 0,
  threshold_count INTEGER NOT NULL DEFAULT 1,
  window_days INTEGER,
  is_active INTEGER NOT NULL DEFAULT 0,
  effective_from TEXT,
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id, code),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_point_rules_client ON point_rules(client_id,is_active,event_type);

CREATE TABLE IF NOT EXISTS employee_point_wallets (
  client_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  balance REAL NOT NULL DEFAULT 0,
  lifetime_earned REAL NOT NULL DEFAULT 0,
  lifetime_spent REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(client_id, employee_id),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS point_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  rule_id INTEGER,
  transaction_type TEXT NOT NULL CHECK(transaction_type IN ('earn','spend','adjust','refund','expire')),
  points REAL NOT NULL,
  cash_value REAL NOT NULL DEFAULT 0,
  reference_type TEXT,
  reference_id TEXT,
  idempotency_key TEXT,
  note TEXT,
  payroll_adjustment_id INTEGER,
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id,idempotency_key),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (rule_id) REFERENCES point_rules(id) ON DELETE SET NULL,
  FOREIGN KEY (payroll_adjustment_id) REFERENCES payroll_adjustments(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_point_tx_employee ON point_transactions(client_id,employee_id,created_at);
CREATE INDEX IF NOT EXISTS idx_point_tx_cash ON point_transactions(client_id,payroll_adjustment_id,cash_value,created_at);

CREATE TABLE IF NOT EXISTS reward_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  reward_type TEXT NOT NULL DEFAULT 'gift' CHECK(reward_type IN ('gift','cash','leave','perk','custom')),
  points_cost REAL NOT NULL DEFAULT 0,
  cash_value REAL NOT NULL DEFAULT 0,
  stock_qty INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive','archived')),
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_reward_catalog_client ON reward_catalog(client_id,status);

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  reward_id INTEGER NOT NULL,
  points_cost REAL NOT NULL,
  cash_value REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','delivered','rejected','cancelled')),
  employee_note TEXT,
  hr_note TEXT,
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at TEXT,
  delivered_at TEXT,
  decided_by_user_id INTEGER,
  payroll_adjustment_id INTEGER,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (reward_id) REFERENCES reward_catalog(id) ON DELETE CASCADE,
  FOREIGN KEY (decided_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (payroll_adjustment_id) REFERENCES payroll_adjustments(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_client ON reward_redemptions(client_id,status,requested_at);
