-- Nakna HR V1.0-P4 — Onboarding & Learning
CREATE TABLE IF NOT EXISTS learning_courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  audience_type TEXT NOT NULL DEFAULT 'manual' CHECK(audience_type IN ('manual','all','department','probation')),
  audience_department_id INTEGER,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
  required INTEGER NOT NULL DEFAULT 1,
  estimated_minutes INTEGER NOT NULL DEFAULT 0,
  passing_score REAL NOT NULL DEFAULT 80,
  created_by_user_id INTEGER,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (audience_department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_learning_courses_client ON learning_courses(client_id,status,created_at);

CREATE TABLE IF NOT EXISTS learning_modules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  module_type TEXT NOT NULL CHECK(module_type IN ('video','document','text','link','quiz')),
  title TEXT NOT NULL,
  description TEXT,
  content_text TEXT,
  external_url TEXT,
  drive_file_id TEXT,
  drive_url TEXT,
  file_name TEXT,
  content_type TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  required INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES learning_courses(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_learning_modules_course ON learning_modules(course_id,sort_order,id);

CREATE TABLE IF NOT EXISTS learning_quiz_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  module_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'single' CHECK(question_type IN ('single','multiple','true_false')),
  options_json TEXT NOT NULL,
  correct_json TEXT NOT NULL,
  points REAL NOT NULL DEFAULT 1,
  explanation TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (module_id) REFERENCES learning_modules(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_learning_questions_module ON learning_quiz_questions(module_id,sort_order,id);

CREATE TABLE IF NOT EXISTS learning_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  required INTEGER NOT NULL DEFAULT 1,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK(status IN ('assigned','in_progress','completed','failed','waived')),
  progress_pct REAL NOT NULL DEFAULT 0,
  score_pct REAL,
  attempts INTEGER NOT NULL DEFAULT 0,
  assigned_by_user_id INTEGER,
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(course_id,employee_id),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES learning_courses(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_learning_assignments_employee ON learning_assignments(client_id,employee_id,status);

CREATE TABLE IF NOT EXISTS learning_module_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  assignment_id INTEGER NOT NULL,
  module_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK(status IN ('not_started','in_progress','completed')),
  progress_pct REAL NOT NULL DEFAULT 0,
  watched_seconds INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(assignment_id,module_id),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (assignment_id) REFERENCES learning_assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (module_id) REFERENCES learning_modules(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS learning_quiz_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  assignment_id INTEGER NOT NULL,
  module_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  score REAL NOT NULL DEFAULT 0,
  max_score REAL NOT NULL DEFAULT 0,
  score_pct REAL NOT NULL DEFAULT 0,
  passed INTEGER NOT NULL DEFAULT 0,
  answers_json TEXT,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (assignment_id) REFERENCES learning_assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (module_id) REFERENCES learning_modules(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_learning_attempts_assignment ON learning_quiz_attempts(assignment_id,module_id,submitted_at);

CREATE TABLE IF NOT EXISTS learning_access_tokens (
  token_hash TEXT PRIMARY KEY,
  client_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_learning_tokens_employee ON learning_access_tokens(client_id,employee_id,expires_at);
