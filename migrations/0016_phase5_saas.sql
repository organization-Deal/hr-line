-- Nakna HR V1.0-P5 — Trial, Seat Billing & SaaS Admin
CREATE TABLE IF NOT EXISTS subscription_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  pricing_mode TEXT NOT NULL DEFAULT 'per_seat' CHECK(pricing_mode IN ('per_seat','flat','custom')),
  base_fee REAL NOT NULL DEFAULT 0,
  price_per_seat REAL NOT NULL DEFAULT 0,
  included_seats INTEGER NOT NULL DEFAULT 0,
  max_seats INTEGER,
  trial_days INTEGER NOT NULL DEFAULT 30,
  features_json TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive','archived')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS company_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL UNIQUE,
  plan_id INTEGER,
  status TEXT NOT NULL DEFAULT 'trialing' CHECK(status IN ('trialing','active','past_due','expired','cancelled')),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK(billing_cycle IN ('monthly','annual')),
  trial_started_at TEXT,
  trial_ends_at TEXT,
  current_period_start TEXT,
  current_period_end TEXT,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  provider TEXT,
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_company_subscription_status ON company_subscriptions(status,trial_ends_at,current_period_end);

CREATE TABLE IF NOT EXISTS usage_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  snapshot_date TEXT NOT NULL,
  active_employee_seats INTEGER NOT NULL DEFAULT 0,
  line_connected_seats INTEGER NOT NULL DEFAULT 0,
  storage_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id,snapshot_date),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_usage_snapshots_client ON usage_snapshots(client_id,snapshot_date);

CREATE TABLE IF NOT EXISTS billing_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  subscription_id INTEGER,
  invoice_no TEXT NOT NULL UNIQUE,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  active_seats INTEGER NOT NULL DEFAULT 0,
  base_fee REAL NOT NULL DEFAULT 0,
  seat_amount REAL NOT NULL DEFAULT 0,
  subtotal REAL NOT NULL DEFAULT 0,
  vat_rate REAL NOT NULL DEFAULT 0,
  vat_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'THB',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','open','paid','overdue','void')),
  due_date TEXT,
  provider TEXT,
  provider_invoice_id TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES company_subscriptions(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_client ON billing_invoices(client_id,status,period_end);

CREATE TABLE IF NOT EXISTS billing_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  invoice_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  method TEXT,
  provider TEXT,
  provider_payment_id TEXT,
  note TEXT,
  paid_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by_user_id INTEGER,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (invoice_id) REFERENCES billing_invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_billing_payments_invoice ON billing_payments(invoice_id,paid_at);

INSERT OR IGNORE INTO subscription_plans (code,name,description,pricing_mode,base_fee,price_per_seat,included_seats,max_seats,trial_days,features_json,status)
VALUES
('trial','Free Trial','ทดลองใช้ทุกฟีเจอร์ 30 วัน','per_seat',0,0,0,NULL,30,'["all_features"]','active'),
('starter','Starter','สำหรับทีมขนาดเล็ก คิดตาม Active Employee Seat','per_seat',0,0,0,NULL,30,'["people","attendance","leave","line","google_workspace"]','active'),
('business','Business','HR + Payroll + Learning + Engagement','per_seat',0,0,0,NULL,30,'["all_features"]','active'),
('enterprise','Enterprise','Custom plan / Custom billing','custom',0,0,0,NULL,30,'["all_features","custom_support"]','active');
