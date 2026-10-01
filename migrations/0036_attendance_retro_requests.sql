-- P9.24 · Attendance retroactive check-in approval
CREATE TABLE IF NOT EXISTS attendance_retro_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  work_date TEXT NOT NULL,
  requested_check_in_time TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  decision_reason TEXT,
  decided_by_user_id INTEGER,
  decided_at TEXT,
  applied_attendance_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (decided_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (applied_attendance_id) REFERENCES attendance(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_attendance_retro_client_status
  ON attendance_retro_requests(client_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_retro_employee_date
  ON attendance_retro_requests(client_id,employee_id,work_date,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_retro_pending_unique
  ON attendance_retro_requests(client_id,employee_id,work_date)
  WHERE status='pending';
