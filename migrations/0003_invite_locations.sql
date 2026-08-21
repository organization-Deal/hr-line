CREATE TABLE IF NOT EXISTS work_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  radius_m INTEGER NOT NULL DEFAULT 150,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS employee_work_locations (
  employee_id INTEGER NOT NULL,
  location_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (employee_id, location_id),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES work_locations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS employee_invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  token_value TEXT,
  token_hint TEXT,
  department_id INTEGER,
  position_id INTEGER,
  employee_role TEXT NOT NULL DEFAULT 'employee',
  start_date TEXT,
  expires_at TEXT NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS employee_invite_locations (
  invite_id INTEGER NOT NULL,
  location_id INTEGER NOT NULL,
  PRIMARY KEY (invite_id, location_id),
  FOREIGN KEY (invite_id) REFERENCES employee_invites(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES work_locations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS line_join_tokens (
  token_hash TEXT PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_work_locations_client ON work_locations(client_id, is_active);
CREATE INDEX IF NOT EXISTS idx_employee_locations_employee ON employee_work_locations(employee_id);
CREATE INDEX IF NOT EXISTS idx_invites_client_status ON employee_invites(client_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_line_join_expiry ON line_join_tokens(expires_at);
