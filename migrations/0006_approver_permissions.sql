CREATE TABLE IF NOT EXISTS employee_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  permission_key TEXT NOT NULL,
  granted_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id, employee_id, permission_key),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_employee_permissions_employee ON employee_permissions(client_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_permissions_key ON employee_permissions(client_id, permission_key);
-- Existing leave approvers are granted leave.approve automatically by runtime bootstrap.
