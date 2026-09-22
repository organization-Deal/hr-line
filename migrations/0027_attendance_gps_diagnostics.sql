-- P8.23 GPS diagnostics for Quick Attendance.
-- Stores technical acquisition metadata only; it intentionally does not persist latitude/longitude.
CREATE TABLE IF NOT EXISTS attendance_gps_diagnostics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  action TEXT,
  stage TEXT NOT NULL,
  attempt INTEGER,
  outcome TEXT,
  error_code TEXT,
  error_message TEXT,
  accuracy_m REAL,
  elapsed_ms INTEGER,
  permission_state TEXT,
  browser_name TEXT,
  browser_version TEXT,
  os_name TEXT,
  os_version TEXT,
  line_version TEXT,
  user_agent TEXT,
  visibility_state TEXT,
  is_secure_context INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attendance_gps_diagnostics_employee
  ON attendance_gps_diagnostics(client_id, employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_gps_diagnostics_code
  ON attendance_gps_diagnostics(client_id, error_code, created_at DESC);
