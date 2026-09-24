PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS attendance_face_settings (
  client_id INTEGER PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT 'off' CHECK(mode IN ('off','enroll','required')),
  verify_checkin INTEGER NOT NULL DEFAULT 1,
  verify_checkout INTEGER NOT NULL DEFAULT 0,
  max_distance REAL NOT NULL DEFAULT 0.56,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS employee_face_profiles (
  client_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  template_encrypted TEXT NOT NULL,
  model_version TEXT NOT NULL DEFAULT 'face-api-0.22.2',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','reset','disabled')),
  enrolled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reset_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, employee_id),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attendance_face_challenges (
  token_hash TEXT PRIMARY KEY,
  client_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  purpose TEXT NOT NULL,
  actions_json TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attendance_face_passes (
  token_hash TEXT PRIMARY KEY,
  client_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('checkin','checkout')),
  model_version TEXT NOT NULL,
  distance REAL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attendance_face_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  work_date TEXT NOT NULL,
  action TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  liveness_passed INTEGER NOT NULL DEFAULT 0,
  distance REAL,
  threshold REAL,
  model_version TEXT,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_face_profiles_status ON employee_face_profiles(client_id,status,employee_id);
CREATE INDEX IF NOT EXISTS idx_face_challenges_employee ON attendance_face_challenges(client_id,employee_id,expires_at);
CREATE INDEX IF NOT EXISTS idx_face_passes_employee ON attendance_face_passes(client_id,employee_id,action,expires_at);
CREATE INDEX IF NOT EXISTS idx_face_events_employee_date ON attendance_face_events(client_id,employee_id,work_date,created_at DESC);
