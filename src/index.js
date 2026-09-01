import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
// Per-isolate schema readiness cache. D1 migrations are persistent; repeated DDL/PRAGMA
// work on every API request was causing /api/bootstrap to exceed 30s.
const SCHEMA_READY = new Set();
const AUTH_CACHE = new Map();
const AUTH_CACHE_TTL_MS = 15 * 1000;

const INIT_SCHEMA_SQL = String.raw`CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'Asia/Bangkok',
  work_start TEXT NOT NULL DEFAULT '09:00',
  work_end TEXT NOT NULL DEFAULT '18:00',
  late_grace_minutes INTEGER NOT NULL DEFAULT 10,
  geofence_name TEXT,
  geofence_lat REAL,
  geofence_lng REAL,
  geofence_radius_m INTEGER NOT NULL DEFAULT 250,
  birthday_reminder_days INTEGER NOT NULL DEFAULT 7,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  manager_employee_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id, code),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  department_id INTEGER,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  employee_code TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  nickname TEXT,
  email TEXT,
  phone TEXT,
  birth_date TEXT,
  start_date TEXT NOT NULL,
  probation_end_date TEXT,
  contract_end_date TEXT,
  department_id INTEGER,
  position_id INTEGER,
  manager_employee_id INTEGER,
  employment_type TEXT NOT NULL DEFAULT 'full_time',
  status TEXT NOT NULL DEFAULT 'active',
  line_user_id TEXT UNIQUE,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id, employee_code),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE SET NULL,
  FOREIGN KEY (manager_employee_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  work_date TEXT NOT NULL,
  check_in_at TEXT,
  check_out_at TEXT,
  checkin_lat REAL,
  checkin_lng REAL,
  checkout_lat REAL,
  checkout_lng REAL,
  source TEXT NOT NULL DEFAULT 'line',
  status TEXT NOT NULL DEFAULT 'present',
  late_minutes INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_id, work_date),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  leave_type TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  approver_employee_id INTEGER,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (approver_employee_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  nickname TEXT,
  email TEXT,
  phone TEXT,
  position_name TEXT NOT NULL,
  source TEXT,
  expected_salary REAL,
  available_start_date TEXT,
  stage TEXT NOT NULL DEFAULT 'new',
  score REAL,
  owner_employee_id INTEGER,
  notes TEXT,
  last_activity_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_employee_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS employee_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  request_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  assigned_to_employee_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to_employee_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS line_link_tokens (
  token TEXT PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS line_sessions (
  line_user_id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  detail_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

CREATE INDEX IF NOT EXISTS idx_employees_client_status ON employees(client_id, status);
CREATE INDEX IF NOT EXISTS idx_employees_birth_date ON employees(birth_date);
CREATE INDEX IF NOT EXISTS idx_attendance_client_date ON attendance(client_id, work_date);
CREATE INDEX IF NOT EXISTS idx_leave_client_status ON leave_requests(client_id, status);
CREATE INDEX IF NOT EXISTS idx_candidates_client_stage ON candidates(client_id, stage);
CREATE INDEX IF NOT EXISTS idx_candidates_activity ON candidates(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_requests_client_status ON employee_requests(client_id, status);
CREATE INDEX IF NOT EXISTS idx_work_locations_client ON work_locations(client_id, is_active);
CREATE INDEX IF NOT EXISTS idx_employee_locations_employee ON employee_work_locations(employee_id);
CREATE INDEX IF NOT EXISTS idx_invites_client_status ON employee_invites(client_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_line_join_expiry ON line_join_tokens(expires_at);
`;

const V050_SCHEMA_SQL = String.raw`CREATE TABLE IF NOT EXISTS leave_policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  default_entitlement_days REAL NOT NULL DEFAULT 0,
  is_unlimited INTEGER NOT NULL DEFAULT 0,
  requires_reason INTEGER NOT NULL DEFAULT 1,
  evidence_required_after_days REAL,
  notice_days INTEGER NOT NULL DEFAULT 0,
  allow_negative INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id, code),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS employee_leave_entitlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  leave_policy_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  entitlement_days REAL NOT NULL DEFAULT 0,
  adjustment_days REAL NOT NULL DEFAULT 0,
  note TEXT,
  updated_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_id, leave_policy_id, year),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (leave_policy_id) REFERENCES leave_policies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS leave_approval_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  leave_request_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_employee_id INTEGER,
  actor_user_id INTEGER,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS leave_request_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  leave_request_id INTEGER NOT NULL,
  uploaded_by_employee_id INTEGER,
  r2_key TEXT NOT NULL,
  file_name TEXT,
  content_type TEXT,
  file_size INTEGER,
  source TEXT NOT NULL DEFAULT 'line',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by_employee_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS leave_evidence_share_tokens (
  token_hash TEXT PRIMARY KEY,
  evidence_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (evidence_id) REFERENCES leave_request_evidence(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_leave_evidence_share_expiry ON leave_evidence_share_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_leave_policy_client ON leave_policies(client_id, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_leave_entitlement_employee_year ON employee_leave_entitlements(employee_id, year);
CREATE INDEX IF NOT EXISTS idx_leave_events_request ON leave_approval_events(leave_request_id, created_at);
CREATE INDEX IF NOT EXISTS idx_leave_evidence_request ON leave_request_evidence(leave_request_id, created_at);
`;

const V060_SCHEMA_SQL = String.raw`CREATE TABLE IF NOT EXISTS line_integrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL UNIQUE,
  channel_id TEXT,
  bot_user_id TEXT,
  bot_basic_id TEXT,
  bot_display_name TEXT,
  bot_picture_url TEXT,
  encrypted_credentials TEXT NOT NULL,
  webhook_key TEXT NOT NULL UNIQUE,
  webhook_url TEXT NOT NULL,
  webhook_active INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'connected',
  last_test_at TEXT,
  last_error TEXT,
  connected_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_line_integrations_status ON line_integrations(status);
`;

const V061_SCHEMA_SQL = String.raw`CREATE TABLE IF NOT EXISTS employee_permissions (
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
`;

const V063_SCHEMA_SQL = String.raw`CREATE TABLE IF NOT EXISTS google_workspace_integrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL UNIQUE,
  connected_by_user_id INTEGER,
  google_sub TEXT,
  email TEXT NOT NULL,
  encrypted_tokens TEXT NOT NULL,
  scopes TEXT,
  gmail_enabled INTEGER NOT NULL DEFAULT 1,
  drive_enabled INTEGER NOT NULL DEFAULT 1,
  sheets_enabled INTEGER NOT NULL DEFAULT 1,
  drive_folder_id TEXT,
  leave_evidence_folder_id TEXT,
  spreadsheet_id TEXT,
  status TEXT NOT NULL DEFAULT 'connected',
  last_sync_at TEXT,
  last_error TEXT,
  connected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (connected_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_google_workspace_status ON google_workspace_integrations(status);
`;


const V100P1_SCHEMA_SQL = String.raw`CREATE TABLE IF NOT EXISTS work_schedule_rules (
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
`;

const V100P2_SCHEMA_SQL = String.raw`CREATE TABLE IF NOT EXISTS hr_cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  subject TEXT NOT NULL,
  detail TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'open',
  confidential INTEGER NOT NULL DEFAULT 1,
  submitted_via TEXT NOT NULL DEFAULT 'line',
  assigned_user_id INTEGER,
  hr_note TEXT,
  last_reply_to_employee TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_hr_cases_client_status ON hr_cases(client_id,status,created_at);
CREATE INDEX IF NOT EXISTS idx_hr_cases_employee ON hr_cases(employee_id,created_at);
CREATE TABLE IF NOT EXISTS hr_case_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  case_id INTEGER NOT NULL,
  actor_type TEXT NOT NULL,
  actor_employee_id INTEGER,
  actor_user_id INTEGER,
  action TEXT NOT NULL,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (case_id) REFERENCES hr_cases(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_hr_case_events_case ON hr_case_events(case_id,created_at);
CREATE TABLE IF NOT EXISTS hr_case_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  case_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT,
  file_size INTEGER,
  storage_provider TEXT,
  drive_file_id TEXT,
  drive_url TEXT,
  storage_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (case_id) REFERENCES hr_cases(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_hr_case_attachments_case ON hr_case_attachments(case_id,created_at);
CREATE TABLE IF NOT EXISTS broadcasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  audience_type TEXT NOT NULL DEFAULT 'all',
  audience_value TEXT,
  channel_line INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  total_recipients INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_by_user_id INTEGER,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_broadcast_client ON broadcasts(client_id,created_at);
CREATE TABLE IF NOT EXISTS broadcast_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  broadcast_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  channel TEXT NOT NULL DEFAULT 'line',
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(broadcast_id,employee_id,channel),
  FOREIGN KEY (broadcast_id) REFERENCES broadcasts(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_broadcast_delivery_status ON broadcast_deliveries(broadcast_id,status);
CREATE TABLE IF NOT EXISTS leave_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  leave_policy_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  entry_type TEXT NOT NULL,
  days REAL NOT NULL,
  reference_type TEXT,
  reference_id INTEGER,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (leave_policy_id) REFERENCES leave_policies(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_leave_ledger_employee_year ON leave_ledger(employee_id,year,leave_policy_id,created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leave_ledger_reference_unique ON leave_ledger(entry_type,reference_type,reference_id) WHERE reference_id IS NOT NULL;
`;

const V100P3_SCHEMA_SQL = String.raw`-- Nakna HR V1.0-P3 — Payroll Thailand core

CREATE TABLE IF NOT EXISTS payroll_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL UNIQUE,
  currency TEXT NOT NULL DEFAULT 'THB',
  pay_day INTEGER NOT NULL DEFAULT 28,
  daily_rate_divisor REAL NOT NULL DEFAULT 30,
  absence_deduction_enabled INTEGER NOT NULL DEFAULT 0,
  late_deduction_enabled INTEGER NOT NULL DEFAULT 0,
  late_deduction_per_minute REAL NOT NULL DEFAULT 0,
  social_security_enabled INTEGER NOT NULL DEFAULT 1,
  tax_enabled INTEGER NOT NULL DEFAULT 1,
  auto_payslip_on_lock INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payroll_rule_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER,
  rule_key TEXT NOT NULL,
  version TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  config_json TEXT NOT NULL,
  source_note TEXT,
  is_system INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id, rule_key, version)
);
CREATE INDEX IF NOT EXISTS idx_payroll_rules_effective ON payroll_rule_versions(rule_key,effective_from,effective_to);

CREATE TABLE IF NOT EXISTS employee_payroll_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL UNIQUE,
  base_salary REAL NOT NULL DEFAULT 0,
  social_security_enabled INTEGER NOT NULL DEFAULT 1,
  tax_enabled INTEGER NOT NULL DEFAULT 1,
  personal_allowance REAL NOT NULL DEFAULT 60000,
  extra_annual_deductions REAL NOT NULL DEFAULT 0,
  monthly_tax_override REAL,
  bank_name TEXT,
  bank_account_name TEXT,
  bank_account_no TEXT,
  payroll_note TEXT,
  effective_from TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_employee_payroll_client ON employee_payroll_profiles(client_id,employee_id);

CREATE TABLE IF NOT EXISTS payroll_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  period_key TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  pay_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','locked','published','void')),
  employee_count INTEGER NOT NULL DEFAULT 0,
  gross_total REAL NOT NULL DEFAULT 0,
  deduction_total REAL NOT NULL DEFAULT 0,
  net_total REAL NOT NULL DEFAULT 0,
  created_by_user_id INTEGER,
  locked_by_user_id INTEGER,
  locked_at TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id,period_key),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (locked_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_payroll_period_status ON payroll_periods(client_id,status,pay_date);

CREATE TABLE IF NOT EXISTS payroll_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  period_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  adjustment_type TEXT NOT NULL CHECK(adjustment_type IN ('earning','deduction')),
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  taxable INTEGER NOT NULL DEFAULT 1,
  sso_contributable INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (period_id) REFERENCES payroll_periods(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_period ON payroll_adjustments(period_id,employee_id);

CREATE TABLE IF NOT EXISTS payroll_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  period_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  base_salary REAL NOT NULL DEFAULT 0,
  prorated_salary REAL NOT NULL DEFAULT 0,
  absent_days REAL NOT NULL DEFAULT 0,
  late_minutes INTEGER NOT NULL DEFAULT 0,
  attendance_deduction REAL NOT NULL DEFAULT 0,
  overtime REAL NOT NULL DEFAULT 0,
  commission REAL NOT NULL DEFAULT 0,
  incentive REAL NOT NULL DEFAULT 0,
  allowance REAL NOT NULL DEFAULT 0,
  bonus REAL NOT NULL DEFAULT 0,
  other_earnings REAL NOT NULL DEFAULT 0,
  gross_income REAL NOT NULL DEFAULT 0,
  social_security REAL NOT NULL DEFAULT 0,
  withholding_tax REAL NOT NULL DEFAULT 0,
  other_deductions REAL NOT NULL DEFAULT 0,
  total_deductions REAL NOT NULL DEFAULT 0,
  net_pay REAL NOT NULL DEFAULT 0,
  breakdown_json TEXT,
  calculation_note TEXT,
  status TEXT NOT NULL DEFAULT 'preview',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(period_id,employee_id),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (period_id) REFERENCES payroll_periods(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_payroll_items_employee ON payroll_items(employee_id,period_id);

-- Nakna HR V1.0-P3 — Payslip + employee document center

CREATE TABLE IF NOT EXISTS payroll_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  period_id INTEGER NOT NULL,
  payroll_item_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'payslip',
  file_name TEXT NOT NULL,
  storage_provider TEXT NOT NULL DEFAULT 'google_drive',
  drive_file_id TEXT,
  drive_url TEXT,
  content_type TEXT NOT NULL DEFAULT 'application/pdf',
  sha256 TEXT,
  share_token_hash TEXT UNIQUE,
  share_token_value TEXT,
  email_sent_at TEXT,
  line_notified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(period_id,employee_id,document_type),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (period_id) REFERENCES payroll_periods(id) ON DELETE CASCADE,
  FOREIGN KEY (payroll_item_id) REFERENCES payroll_items(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_payroll_documents_employee ON payroll_documents(employee_id,created_at);

CREATE TABLE IF NOT EXISTS employee_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  employee_id INTEGER,
  document_type TEXT NOT NULL,
  title TEXT NOT NULL,
  file_name TEXT,
  storage_provider TEXT NOT NULL DEFAULT 'google_drive',
  drive_file_id TEXT,
  drive_url TEXT,
  content_type TEXT,
  document_date TEXT,
  expires_at TEXT,
  visibility TEXT NOT NULL DEFAULT 'employee' CHECK(visibility IN ('employee','hr_only','manager')),
  note TEXT,
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_employee_documents_employee ON employee_documents(client_id,employee_id,document_type);
`;


const V100P4_SCHEMA_SQL = String.raw`-- Nakna HR V1.0-P4 — Onboarding & Learning
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
`;


const V100P5_SCHEMA_SQL = String.raw`-- Nakna HR V1.0-P5 — Engagement, Points & Rewards
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
`;

const V100P7_SCHEMA_SQL = String.raw`-- Nakna HR V1.0-P7
-- LINE -> Web business setup, Recruitment Gmail sync, Benefits catalog

CREATE TABLE IF NOT EXISTS line_web_login_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  client_id INTEGER,
  purpose TEXT NOT NULL DEFAULT 'business_setup',
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_line_web_login_tokens_user ON line_web_login_tokens(user_id,purpose,expires_at,used_at);

CREATE TABLE IF NOT EXISTS company_onboarding (
  client_id INTEGER PRIMARY KEY,
  owner_user_id INTEGER,
  source TEXT NOT NULL DEFAULT 'web',
  current_step TEXT NOT NULL DEFAULT 'google_workspace',
  employee_estimate INTEGER,
  legal_name TEXT,
  tax_id TEXT,
  phone TEXT,
  address TEXT,
  province TEXT,
  recruitment_gmail_enabled INTEGER NOT NULL DEFAULT 1,
  recruitment_gmail_query TEXT NOT NULL DEFAULT 'newer_than:30d {สมัคร resume CV "job application"}',
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS recruitment_email_settings (
  client_id INTEGER PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  query TEXT NOT NULL DEFAULT 'newer_than:30d {สมัคร resume CV "job application"}',
  auto_sync INTEGER NOT NULL DEFAULT 1,
  last_sync_at TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recruitment_email_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  gmail_message_id TEXT NOT NULL,
  gmail_thread_id TEXT,
  sender_name TEXT,
  sender_email TEXT,
  subject TEXT,
  received_at TEXT,
  snippet TEXT,
  attachment_names TEXT,
  candidate_id INTEGER,
  import_status TEXT NOT NULL DEFAULT 'seen',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id,gmail_message_id),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_recruitment_email_client ON recruitment_email_messages(client_id,received_at);

CREATE TABLE IF NOT EXISTS benefit_programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  benefit_type TEXT NOT NULL DEFAULT 'custom',
  description TEXT,
  employer_amount REAL NOT NULL DEFAULT 0,
  employee_amount REAL NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  is_statutory INTEGER NOT NULL DEFAULT 0,
  eligibility_json TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id,code),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_benefit_programs_client ON benefit_programs(client_id,status);

CREATE TABLE IF NOT EXISTS employee_benefit_enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  benefit_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  start_date TEXT,
  end_date TEXT,
  note TEXT,
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(benefit_id,employee_id),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (benefit_id) REFERENCES benefit_programs(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_employee_benefits_employee ON employee_benefit_enrollments(client_id,employee_id,status);
`;

const APPROVER_PERMISSION_KEYS = new Set([
  'leave.approve',
  'attendance.approve',
  'ot.approve',
  'hr_request.approve',
  'team.read'
]);

const INIT_AUTH_SCHEMA_SQL = String.raw`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  picture_url TEXT,
  locale TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS company_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id, user_id),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  selected_client_id INTEGER,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (selected_client_id) REFERENCES clients(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS oauth_states (
  state_hash TEXT PRIMARY KEY,
  purpose TEXT NOT NULL,
  user_id INTEGER,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS gmail_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  google_sub TEXT,
  email TEXT NOT NULL,
  encrypted_tokens TEXT NOT NULL,
  scopes TEXT,
  access_expires_at TEXT,
  connected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_company_members_user ON company_members(user_id, status);
CREATE INDEX IF NOT EXISTS idx_company_members_client ON company_members(client_id, status);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expiry ON oauth_states(expires_at);
`;

const INIT_SEED_SQL = String.raw`INSERT OR IGNORE INTO clients (
  id, name, code, timezone, work_start, work_end, late_grace_minutes,
  geofence_name, geofence_radius_m, birthday_reminder_days
) VALUES (1, 'DEAL Invest', 'DEAL', 'Asia/Bangkok', '11:00', '20:00', 10, 'DEAL Office', 250, 7);

INSERT OR IGNORE INTO departments (id, client_id, name, code) VALUES
  (1, 1, 'Visionhub', 'VISION'),
  (2, 1, 'Operations', 'OPS'),
  (3, 1, 'Dealmaker', 'SALES'),
  (4, 1, 'Accounting & Finance', 'FIN'),
  (5, 1, 'Human Resources', 'HR');

INSERT OR IGNORE INTO positions (id, client_id, department_id, name) VALUES
  (1, 1, 1, 'Content Creator'),
  (2, 1, 2, 'Operations Executive'),
  (3, 1, 3, 'Dealmaker'),
  (4, 1, 4, 'Accountant'),
  (5, 1, 5, 'HR Manager'),
  (6, 1, 1, 'Video Editor');

INSERT OR IGNORE INTO employees (
  id, client_id, employee_code, first_name, last_name, nickname, email, phone,
  birth_date, start_date, probation_end_date, contract_end_date,
  department_id, position_id, status
) VALUES
  (1,1,'DEAL-001','เมย์','รัตนา','May','may@example.com','0800000001','1997-08-20','2024-06-01','2024-09-29',NULL,5,5,'active'),
  (2,1,'DEAL-002','บีม','วรัญญา','Beam','beam@example.com','0800000002','1998-08-24','2025-08-27','2025-12-25',NULL,1,1,'active'),
  (3,1,'DEAL-003','ปอนด์','กิตติ','Pond','pond@example.com','0800000003','1996-09-02','2026-06-01','2026-09-29','2027-05-31',1,6,'active'),
  (4,1,'DEAL-004','เฟิร์น','จิราพร','Fern','fern@example.com','0800000004','1999-08-28','2026-05-15','2026-09-12',NULL,2,2,'active'),
  (5,1,'DEAL-005','โจ','ธนา','Joe','joe@example.com','0800000005','1995-11-05','2025-09-01','2025-12-30','2026-09-05',3,3,'active'),
  (6,1,'DEAL-006','อาย','ชลธิชา','Aim','aim@example.com','0800000006','2000-12-10','2026-05-25','2026-09-22',NULL,4,4,'active');

INSERT OR IGNORE INTO candidates (
  id, client_id, first_name, last_name, nickname, email, phone, position_name,
  source, expected_salary, stage, score, last_activity_at
) VALUES
  (1,1,'นนท์','พงษ์','Non','non@example.com','0810000001','Content Creator','Facebook Jobs',28000,'screening',4.2,'2026-08-19 10:00:00'),
  (2,1,'แพรว','พิชชา','Praew','praew@example.com','0810000002','Content Creator','JobsDB',30000,'hr_interview',4.5,'2026-08-16 10:00:00'),
  (3,1,'ต้น','ศุภชัย','Ton','ton@example.com','0810000003','Dealmaker','Referral',25000,'manager_interview',4.0,'2026-08-18 09:00:00'),
  (4,1,'ฟ้า','กมล','Fah','fah@example.com','0810000004','Video Editor','TikTok',32000,'offer',4.7,'2026-08-20 12:00:00'),
  (5,1,'เจ','อัคร','Jay','jay@example.com','0810000005','Operations Executive','Facebook Jobs',27000,'new',NULL,'2026-08-20 14:00:00');

INSERT OR IGNORE INTO leave_requests (
  id, client_id, employee_id, leave_type, start_date, end_date, reason, status, created_at
) VALUES
  (1,1,4,'sick','2026-08-20','2026-08-20','ไม่สบาย','approved','2026-08-20 07:30:00'),
  (2,1,2,'annual','2026-08-24','2026-08-25','ธุระส่วนตัว','pending','2026-08-20 09:20:00');

INSERT OR IGNORE INTO employee_requests (
  id, client_id, employee_id, request_type, subject, detail, status, created_at
) VALUES
  (1,1,3,'document','ขอหนังสือรับรองเงินเดือน','ใช้ยื่นเช่าคอนโด','received','2026-08-20 13:30:00');

INSERT OR IGNORE INTO attendance (
  id, client_id, employee_id, work_date, check_in_at, source, status, late_minutes
) VALUES
  (1,1,1,'2026-08-20','2026-08-20T03:56:00.000Z','line','present',0),
  (2,1,2,'2026-08-20','2026-08-20T04:14:00.000Z','line','late',4),
  (3,1,5,'2026-08-20','2026-08-20T03:52:00.000Z','line','present',0);
`;

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);

      if (url.pathname === '/api/health') {
        return json({ ok: true, service: 'Nakna HR', brand: 'นากนะ', version: '1.0-P7.62', auth: 'line-first-web-setup+google' });
      }

      if (url.pathname === '/api/public/onboarding' && request.method === 'GET') {
        return await getPublicOnboardingConfig(env);
      }
      if (url.pathname === '/api/public/diagnostics' && request.method === 'GET') {
        return await getPublicDiagnostics(env);
      }
      if (url.pathname === '/auth/line/start' && request.method === 'GET') {
        return await finishLineWebLogin(request, env);
      }
      if (url.pathname === '/auth/google/start' && request.method === 'GET') {
        return await startGoogleLogin(request, env);
      }
      if (url.pathname === '/auth/google/callback' && request.method === 'GET') {
        return await finishGoogleLogin(request, env);
      }
      if (url.pathname === '/auth/logout' && request.method === 'POST') {
        return await logoutSession(request, env);
      }
      if (url.pathname === '/integrations/google-workspace/start' && request.method === 'GET') {
        return await startGoogleWorkspaceConnection(request, env);
      }
      if (url.pathname === '/integrations/google-workspace/callback' && request.method === 'GET') {
        return await finishGoogleWorkspaceConnection(request, env, ctx);
      }
      // Legacy personal Gmail flow is kept for existing test users.
      if (url.pathname === '/integrations/gmail/start' && request.method === 'GET') {
        return await startGmailConnection(request, env);
      }
      if (url.pathname === '/integrations/gmail/callback' && request.method === 'GET') {
        return await finishGmailConnection(request, env);
      }

      const joinPageMatch = url.pathname.match(/^\/join\/([A-Za-z0-9_-]{20,})$/);
      if (joinPageMatch && request.method === 'GET') {
        return Response.redirect(`${appOrigin(request, env)}/invite.html?token=${encodeURIComponent(joinPageMatch[1])}`, 302);
      }

      const publicInviteMatch = url.pathname.match(/^\/api\/public\/invites\/([A-Za-z0-9_-]{20,})$/);
      if (publicInviteMatch && request.method === 'GET') {
        await ensureCoreSchema(env.DB);
        await ensureV100P1Ready(env.DB);
        return await getPublicInvite(env.DB, publicInviteMatch[1]);
      }
      if (publicInviteMatch && request.method === 'POST') {
        await ensureCoreSchema(env.DB);
        await ensureV100P1Ready(env.DB);
        return await acceptPublicInvite(request, env, publicInviteMatch[1]);
      }

      const sharedEvidenceMatch = url.pathname.match(/^\/evidence\/([A-Za-z0-9_-]{20,})$/);
      if (sharedEvidenceMatch && request.method === 'GET') {
        await ensureV050Ready(env.DB);
        return await serveSharedEvidence(env, sharedEvidenceMatch[1]);
      }

      const payslipShareMatch = url.pathname.match(/^\/payslip\/([A-Za-z0-9_-]{24,})$/);
      if (payslipShareMatch && request.method === 'GET') {
        await ensureV100P3Ready(env.DB);
        return await serveSharedPayrollDocument(env, payslipShareMatch[1]);
      }

      const publicLeaveMatch = url.pathname.match(/^\/api\/public\/leave\/([A-Za-z0-9_-]{32,})$/);
      if (publicLeaveMatch && request.method === 'GET') {
        await ensureV050Ready(env.DB);
        await ensureV100P4Ready(env.DB);
        return await getPublicLeaveForm(env, publicLeaveMatch[1]);
      }
      if (publicLeaveMatch && request.method === 'POST') {
        await ensureV050Ready(env.DB);
        await ensureV100P4Ready(env.DB);
        return await submitPublicLeaveForm(request, env, publicLeaveMatch[1]);
      }

      const publicHrCaseAttachmentMatch = url.pathname.match(/^\/api\/public\/hr-case\/([A-Za-z0-9_-]{32,})\/attachments$/);
      if (publicHrCaseAttachmentMatch && request.method === 'POST') {
        await ensureV100P2Ready(env.DB);
        return await uploadPublicHrCaseAttachment(request, env, publicHrCaseAttachmentMatch[1]);
      }

      const publicHrCaseMatch = url.pathname.match(/^\/api\/public\/hr-case\/([A-Za-z0-9_-]{32,})$/);
      if (publicHrCaseMatch && request.method === 'GET') {
        await ensureV100P2Ready(env.DB);
        return await getPublicHrCaseForm(env, publicHrCaseMatch[1]);
      }
      if (publicHrCaseMatch && request.method === 'POST') {
        await ensureV100P2Ready(env.DB);
        return await submitPublicHrCaseForm(request, env, publicHrCaseMatch[1], ctx);
      }

      const publicLearningMatch = url.pathname.match(/^\/api\/public\/learning\/([A-Za-z0-9_-]{32,})$/);
      if (publicLearningMatch && request.method === 'GET') {
        await ensureV100P4Ready(env.DB);
        return await getPublicLearningPortal(env, publicLearningMatch[1]);
      }
      const publicLearningProgressMatch = url.pathname.match(/^\/api\/public\/learning\/([A-Za-z0-9_-]{32,})\/modules\/(\d+)\/progress$/);
      if (publicLearningProgressMatch && request.method === 'POST') {
        await ensureV100P4Ready(env.DB);
        return await updatePublicLearningProgress(request, env, publicLearningProgressMatch[1], Number(publicLearningProgressMatch[2]));
      }
      const publicLearningQuizMatch = url.pathname.match(/^\/api\/public\/learning\/([A-Za-z0-9_-]{32,})\/quiz\/(\d+)\/submit$/);
      if (publicLearningQuizMatch && request.method === 'POST') {
        await ensureV100P4Ready(env.DB);
        return await submitPublicLearningQuiz(request, env, publicLearningQuizMatch[1], Number(publicLearningQuizMatch[2]));
      }
      const publicLearningMediaMatch = url.pathname.match(/^\/api\/public\/learning\/([A-Za-z0-9_-]{32,})\/media\/(\d+)$/);
      if (publicLearningMediaMatch && request.method === 'GET') {
        await ensureV100P4Ready(env.DB);
        return await streamPublicLearningMedia(request, env, publicLearningMediaMatch[1], Number(publicLearningMediaMatch[2]));
      }
      const publicKpiUpdateMatch = url.pathname.match(/^\/api\/public\/learning\/([A-Za-z0-9_-]{32,})\/kpi\/(\d+)\/update$/);
      if (publicKpiUpdateMatch && request.method === 'POST') {
        await ensureV100P4Ready(env.DB);
        return await submitPublicKpiUpdate(request, env, publicKpiUpdateMatch[1], Number(publicKpiUpdateMatch[2]));
      }

      const publicRewardRedeemMatch = url.pathname.match(/^\/api\/public\/learning\/([A-Za-z0-9_-]{32,})\/rewards\/(\d+)\/redeem$/);
      if (publicRewardRedeemMatch && request.method === 'POST') {
        await ensureV100P5Ready(env.DB);
        return await redeemPublicReward(request, env, publicRewardRedeemMatch[1], Number(publicRewardRedeemMatch[2]));
      }

      const dedicatedLineWebhookMatch = url.pathname.match(/^\/webhooks\/line\/([A-Za-z0-9_-]{32,})$/);
      if (dedicatedLineWebhookMatch && request.method === 'POST') {
        await ensureV060Ready(env.DB);
        await ensureV100P1Ready(env.DB);
        await ensureV100P2Ready(env.DB);
        const integration = await getLineIntegrationByWebhookKey(env, dedicatedLineWebhookMatch[1]);
        if (!integration) return json({ error: 'LINE integration not found' }, 404);
        return await handleLineWebhook(request, env, ctx, integration);
      }

      if (url.pathname === '/webhooks/line' && request.method === 'POST') {
        // Global Nakna OA must acknowledge LINE before any schema work.
        // handleLineWebhook verifies the signature, returns 200 immediately,
        // then prepares schema + processes events in ctx.waitUntil().
        return await handleLineWebhook(request, env, ctx, null);
      }

      if (url.pathname.startsWith('/api/')) {
        const auth = await authorizeUser(request, env, { requireCompany: !['/api/me','/api/companies','/api/onboarding/claim-company','/api/onboarding/status'].includes(url.pathname) });
        if (!auth.ok) return json({ error: auth.error }, auth.status);
        return await handleApi(request, env, url, auth, ctx);
      }

      return new Response('Not found', { status: 404 });
    } catch (error) {
      let pathname = 'unknown';
      try { pathname = new URL(request.url).pathname; } catch {}
      console.error(JSON.stringify({
        level: 'error',
        event: 'unhandled',
        pathname,
        message: String(error?.message || error),
        stack: String(error?.stack || '').slice(0, 2000),
      }));
      return json({ error: 'Internal server error', request_path: pathname }, 500);
    }
  },

  async scheduled(controller, env, ctx) {
    // Cloudflare Cron runs in UTC. 01:00 UTC = 08:00 Asia/Bangkok.
    await Promise.all([
      sendDailyHrBrief(env),
      runPhase5DailyAutomation(env).catch(error=>console.error(JSON.stringify({level:'error',event:'phase5_daily_failed',message:String(error?.message||error)}))),
      syncAllRecruitmentGmail(env).catch(error=>console.error(JSON.stringify({level:'error',event:'recruitment_gmail_daily_failed',message:String(error?.message||error)})))
    ]);
  },
};

async function handleApi(request, env, url, auth, ctx) {
  const method = request.method;
  const path = url.pathname;
  const clientId = auth.clientId ? Number(auth.clientId) : null;

  if (path === '/api/me' && method === 'GET') {
    // Account reconciliation can touch several D1 tables and is only needed
    // immediately after an explicit account-link action. Running it on every
    // page open made /api/me the critical-path bottleneck.
    if (url.searchParams.get('reconcile') === '1') {
      auth = await reconcileAccountIdentity(env, auth).catch(error => {
        console.warn(JSON.stringify({level:'warn',event:'account_identity_reconcile_failed',message:String(error?.message||error)}));
        return auth;
      });
    }
    const memberships = await getMemberships(env.DB, auth.user.id);
    const claimable = memberships.length ? null : await getClaimableLegacyCompany(env.DB);
    const activeMembership=memberships.find(row=>Number(row.id)===Number(auth.clientId))||memberships[0]||null;
    return json({
      user: publicUser(auth.user),
      companies: memberships,
      active_company_id: auth.clientId || activeMembership?.id || null,
      active_role: activeMembership?.role || null,
      is_primary_owner: Boolean(activeMembership?.is_primary_owner),
      setup_mode: auth.setupMode || null,
      claimable_company: claimable,
    });
  }

  if (path === '/api/onboarding/status' && method === 'GET') {
    await ensureV100P7Ready(env.DB);
    return json(await getWebOnboardingStatus(env, auth));
  }

  if (path === '/api/onboarding/recruitment-gmail' && method === 'POST') {
    if (!clientId) return json({ error: 'COMPANY_REQUIRED' }, 409);
    if (!['owner','co_owner','hr_admin','hr'].includes(String(auth.role||''))) return json({ error:'ไม่มีสิทธิ์ตั้งค่า Recruitment Gmail' },403);
    await ensureV100P7Ready(env.DB);
    const body=await safeJson(request);
    const enabled=body.enabled===false?0:1;
    const query=String(body.query||'newer_than:30d {สมัคร resume CV "job application"}').trim().slice(0,500)||'newer_than:30d {สมัคร resume CV "job application"}';
    await env.DB.prepare(`INSERT INTO recruitment_email_settings (client_id,enabled,query,auto_sync,updated_at) VALUES (?1,?2,?3,?4,CURRENT_TIMESTAMP) ON CONFLICT(client_id) DO UPDATE SET enabled=excluded.enabled,query=excluded.query,auto_sync=excluded.auto_sync,updated_at=CURRENT_TIMESTAMP`).bind(clientId,enabled,query,body.auto_sync===false?0:1).run();
    await env.DB.prepare(`UPDATE company_onboarding SET recruitment_gmail_enabled=?1,recruitment_gmail_query=?2,current_step='recruitment_gmail',updated_at=CURRENT_TIMESTAMP WHERE client_id=?3`).bind(enabled,query,clientId).run();
    return json({ok:true,enabled:Boolean(enabled),query});
  }

  if (path === '/api/onboarding/complete' && method === 'POST') {
    if (!clientId) return json({ error:'COMPANY_REQUIRED' },409);
    if (!['owner','co_owner','hr_admin','hr'].includes(String(auth.role||''))) return json({ error:'ไม่มีสิทธิ์จบการตั้งค่า' },403);
    await ensureV100P7Ready(env.DB);
    const google=await env.DB.prepare(`SELECT id FROM google_workspace_integrations WHERE client_id=?1 AND status='connected'`).bind(clientId).first();
    if(!google) return json({error:'กรุณาเชื่อม Google ก่อนเริ่มใช้งาน'},409);
    await env.DB.prepare(`UPDATE company_onboarding SET current_step='complete',completed_at=COALESCE(completed_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE client_id=?1`).bind(clientId).run();
    await ensureP7CompanyDefaults(env.DB,clientId,auth.user.id);
    const status=await getWebOnboardingStatus(env,auth);
    return json({ok:true,onboarding:status});
  }

  if (path === '/api/recruitment/gmail/status' && method === 'GET') {
    if (!clientId) return json({error:'COMPANY_REQUIRED'},409);
    await ensureV100P7Ready(env.DB);
    return json(await getRecruitmentGmailStatus(env,clientId));
  }

  if (path === '/api/recruitment/gmail/sync' && method === 'POST') {
    if (!clientId) return json({error:'COMPANY_REQUIRED'},409);
    if (!['owner','co_owner','hr_admin','hr'].includes(String(auth.role||''))) return json({error:'ไม่มีสิทธิ์ Sync Gmail ผู้สมัคร'},403);
    try{
      const result=await syncRecruitmentGmailForClient(env,clientId,{limit:30});
      return json({ok:true,...result});
    }catch(error){
      await ensureV100P7Ready(env.DB);
      await env.DB.prepare(`UPDATE recruitment_email_settings SET last_error=?1,updated_at=CURRENT_TIMESTAMP WHERE client_id=?2`).bind(String(error?.message||error).slice(0,300),clientId).run().catch(()=>{});
      return json({error:safeRecruitmentGmailError(error)},400);
    }
  }

  if (path === '/api/benefits' && method === 'GET') {
    if (!clientId) return json({error:'COMPANY_REQUIRED'},409);
    await ensureP7CompanyDefaults(env.DB,clientId,auth.user.id);
    const programs=await env.DB.prepare(`SELECT b.*,COUNT(CASE WHEN e.status='active' THEN 1 END) AS enrolled_count FROM benefit_programs b LEFT JOIN employee_benefit_enrollments e ON e.benefit_id=b.id WHERE b.client_id=?1 GROUP BY b.id ORDER BY b.is_statutory DESC,b.id`).bind(clientId).all();
    const enrollments=await env.DB.prepare(`SELECT e.*,b.name AS benefit_name,emp.employee_code,emp.first_name,emp.last_name,emp.nickname FROM employee_benefit_enrollments e JOIN benefit_programs b ON b.id=e.benefit_id JOIN employees emp ON emp.id=e.employee_id WHERE e.client_id=?1 ORDER BY e.id DESC`).bind(clientId).all();
    return json({data:programs.results||[],enrollments:enrollments.results||[]});
  }

  if (path === '/api/benefits' && method === 'POST') {
    if (!['owner','co_owner','hr_admin','hr'].includes(String(auth.role||''))) return json({error:'ไม่มีสิทธิ์จัดการสวัสดิการ'},403);
    await ensureV100P7Ready(env.DB);
    const body=await safeJson(request); const name=String(body.name||'').trim(); if(name.length<2)return json({error:'กรุณาใส่ชื่อสวัสดิการ'},400);
    const code=slugCode(body.code||name)||`benefit-${Date.now()}`;
    const result=await env.DB.prepare(`INSERT INTO benefit_programs (client_id,code,name,benefit_type,description,employer_amount,employee_amount,frequency,is_statutory,eligibility_json,status,created_by_user_id) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)`).bind(clientId,code,name,String(body.benefit_type||'custom'),body.description||null,Number(body.employer_amount||0),Number(body.employee_amount||0),String(body.frequency||'monthly'),body.is_statutory?1:0,body.eligibility?JSON.stringify(body.eligibility):null,String(body.status||'active'),Number(auth.user.id)).run();
    return json({ok:true,id:result.meta.last_row_id},201);
  }

  const benefitEnrollMatch=path.match(/^\/api\/benefits\/(\d+)\/enroll$/);
  if(benefitEnrollMatch && method==='POST'){
    if(!['owner','co_owner','hr_admin','hr'].includes(String(auth.role||'')))return json({error:'ไม่มีสิทธิ์จัดการสวัสดิการ'},403);
    await ensureV100P7Ready(env.DB); const benefitId=Number(benefitEnrollMatch[1]); const body=await safeJson(request); const employeeId=Number(body.employee_id||0);
    const [benefit,employee]=await Promise.all([env.DB.prepare(`SELECT id FROM benefit_programs WHERE id=?1 AND client_id=?2`).bind(benefitId,clientId).first(),env.DB.prepare(`SELECT id FROM employees WHERE id=?1 AND client_id=?2`).bind(employeeId,clientId).first()]);
    if(!benefit||!employee)return json({error:'ไม่พบสวัสดิการหรือพนักงาน'},404);
    await env.DB.prepare(`INSERT INTO employee_benefit_enrollments (client_id,benefit_id,employee_id,status,start_date,end_date,note,created_by_user_id) VALUES (?1,?2,?3,?4,?5,?6,?7,?8) ON CONFLICT(benefit_id,employee_id) DO UPDATE SET status=excluded.status,start_date=excluded.start_date,end_date=excluded.end_date,note=excluded.note,updated_at=CURRENT_TIMESTAMP`).bind(clientId,benefitId,employeeId,String(body.status||'active'),body.start_date||dateInBangkok(),body.end_date||null,body.note||null,Number(auth.user.id)).run();
    return json({ok:true});
  }

  if (path === '/api/bootstrap' && method === 'GET') {
    try {
      // Fast bootstrap: each phase is chained and cached per Worker isolate.
      // Calling every phase separately caused the same DDL/PRAGMA work to repeat
      // many times and could push D1 beyond the browser's 30s timeout.
      await ensureCoreSchema(env.DB);
      await ensureV063Ready(env.DB);
      await ensureV100P7Ready(env.DB);
      if (clientId) {
        await ensureDefaultLeavePolicies(env.DB, clientId);
        await ensurePayrollDefaults(env.DB, clientId);
        await ensurePhase5Defaults(env.DB, clientId);
        await ensureP7CompanyDefaults(env.DB, clientId, auth.user.id);
      }
      return json({ ok: true, release: 'V1.0-P7.62', core_schema: 'ready', people_core: 'ready', employee_service: 'ready', payroll: 'ready', documents: 'ready', learning: 'ready', performance: 'ready', engagement: 'ready', subscription: 'ready', analytics: 'ready', line_integrations: 'ready', approver_permissions: 'ready', google_workspace: 'ready', web_onboarding: 'ready', recruitment_gmail: 'ready', benefits: 'ready' });
    } catch (error) {
      const detail = safeCoreSchemaErrorDetail(error);
      console.error(JSON.stringify({ level: 'error', event: 'core_schema_failed', detail }));
      return json({ error: 'CORE_SCHEMA_REPAIR_FAILED', stage: 'core_schema', detail }, 500);
    }
  }

  if (path === '/api/companies' && method === 'POST') {
    const body = await safeJson(request);
    const explicitNewWorkspace = auth.setupMode === 'new' || body.confirm_new_workspace === true;
    if (!explicitNewWorkspace) return json({ error: 'NEW_WORKSPACE_CONFIRM_REQUIRED', detail:'การสร้างบริษัทใหม่ต้องเริ่มจากเมนู “สร้าง Workspace ใหม่” โดยตั้งใจ' }, 409);
    const name = String(body.name || '').trim();
    if (name.length < 2) return json({ error: 'กรุณาใส่ชื่อบริษัท' }, 400);
    await ensureV100P7Ready(env.DB);
    const created = await createCompanyForUser(env.DB, auth, name);
    await ensureCoreSchema(env.DB);
    await ensureDefaultLeavePolicies(env.DB, Number(created.id));
    await ensurePayrollDefaults(env.DB, Number(created.id));
    await ensurePhase5Defaults(env.DB, Number(created.id));
    await ensureP7CompanyDefaults(env.DB, Number(created.id), Number(auth.user.id));
    const employeeEstimate=Math.max(1,Math.min(100000,Number(body.employee_estimate||1)||1));
    const workStart=normalizeTimeHM(body.work_start)||'09:00';
    const workEnd=normalizeTimeHM(body.work_end)||'18:00';
    await env.DB.prepare(`UPDATE clients SET work_start=?1,work_end=?2 WHERE id=?3`).bind(workStart,workEnd,Number(created.id)).run();
    await env.DB.prepare(`INSERT INTO company_onboarding (client_id,owner_user_id,source,current_step,employee_estimate,legal_name,tax_id,phone,address,province,recruitment_gmail_enabled,recruitment_gmail_query) VALUES (?1,?2,?3,'google_workspace',?4,?5,?6,?7,?8,?9,1,'newer_than:30d {สมัคร resume CV "job application"}') ON CONFLICT(client_id) DO UPDATE SET owner_user_id=excluded.owner_user_id,source=excluded.source,current_step='google_workspace',employee_estimate=excluded.employee_estimate,legal_name=excluded.legal_name,tax_id=excluded.tax_id,phone=excluded.phone,address=excluded.address,province=excluded.province,completed_at=NULL,updated_at=CURRENT_TIMESTAMP`)
      .bind(Number(created.id),Number(auth.user.id),String(body.onboarding_source||'web'),employeeEstimate,String(body.legal_name||name).trim(),String(body.tax_id||'').trim()||null,String(body.phone||'').trim()||null,String(body.address||'').trim()||null,String(body.province||'').trim()||null).run();
    await env.DB.prepare(`UPDATE auth_sessions SET selected_client_id=?1 WHERE user_id=?2 AND expires_at>CURRENT_TIMESTAMP`).bind(Number(created.id),Number(auth.user.id)).run();
    AUTH_CACHE.clear();
    const response=json({ ok: true, company: created, onboarding: await getWebOnboardingStatus(env,{...auth,clientId:Number(created.id),role:'owner',setupMode:null}) }, 201);
    response.headers.append('Set-Cookie',companyCookie(created.id));
    response.headers.append('Set-Cookie',clearCookie('nakna_setup_mode'));
    return response;
  }

  if (path === '/api/onboarding/claim-company' && method === 'POST') {
    await ensureCoreSchema(env.DB);
    const body = await safeJson(request);
    const claimable = await getClaimableLegacyCompany(env.DB);
    if (!claimable || Number(body.client_id) !== Number(claimable.id)) return json({ error: 'Workspace นี้ไม่สามารถรับช่วงได้แล้ว' }, 409);
    await env.DB.prepare(`INSERT OR IGNORE INTO company_members (client_id, user_id, role, status) VALUES (?1,?2,'owner','active')`).bind(Number(claimable.id), Number(auth.user.id)).run();
    await env.DB.prepare('UPDATE auth_sessions SET selected_client_id=?1 WHERE token_hash=?2').bind(Number(claimable.id), auth.sessionHash).run();
    await safeAudit(env.DB, Number(claimable.id), 'user', String(auth.user.id), 'company.claim', 'client', String(claimable.id), null);
    await ensureV100P5Ready(env.DB);
    await ensurePhase5Defaults(env.DB, Number(claimable.id));
    return withCookie(json({ ok: true, company: claimable }), companyCookie(claimable.id));
  }

  if (path === '/api/session/company' && method === 'POST') {
    const body = await safeJson(request);
    const nextClientId = Number(body.client_id);
    const member = await env.DB.prepare(`SELECT role FROM company_members WHERE user_id=?1 AND client_id=?2 AND status='active'`).bind(Number(auth.user.id), nextClientId).first();
    if (!member) return json({ error: 'คุณไม่มีสิทธิ์เข้าบริษัทนี้' }, 403);
    // Keep the selected workspace consistent across desktop/mobile sessions for the same account.
    await env.DB.prepare(`UPDATE auth_sessions SET selected_client_id=?1, last_seen_at=CURRENT_TIMESTAMP WHERE user_id=?2 AND expires_at>CURRENT_TIMESTAMP`)
      .bind(nextClientId, Number(auth.user.id)).run();
    AUTH_CACHE.clear();
    return withCookie(json({ ok: true, client_id: nextClientId, synced_sessions: true }), companyCookie(nextClientId));
  }

  if (path === '/api/company-access' && method === 'GET') {
    if (!clientId) return json({ error: 'COMPANY_REQUIRED' }, 409);
    if (!(await canManageWorkspaceAccess(env.DB,clientId,auth.user.id))) return json({ error: 'เฉพาะ Primary Owner หรือ Co-Owner เท่านั้นที่จัดการสิทธิ์ระดับ Workspace ได้' }, 403);
    await ensureLineBusinessOnboardingReady(env.DB);
    const members = (await env.DB.prepare(`
      SELECT m.user_id,m.role,m.status,m.created_at,u.name,u.email,u.picture_url,u.line_user_id,u.line_provider_scope,u.auth_provider
      FROM company_members m
      JOIN users u ON u.id=m.user_id
      WHERE m.client_id=?1 AND m.status='active' AND m.role IN ('owner','co_owner','hr_admin','hr','payroll_admin','manager','approver')
      ORDER BY CASE m.role WHEN 'owner' THEN 0 ELSE 1 END,m.id
    `).bind(clientId).all()).results || [];
    const employees = (await env.DB.prepare(`
      SELECT e.id,e.employee_code,e.first_name,e.last_name,e.nickname,e.email,e.avatar_url,e.line_user_id,e.line_provider_scope,e.line_display_name,e.line_picture_url,e.status,
        COALESCE(
          (SELECT u.id FROM users u WHERE u.status='active' AND e.line_user_id IS NOT NULL AND u.line_user_id=e.line_user_id AND COALESCE(u.line_provider_scope,'default')=COALESCE(e.line_provider_scope,'default') LIMIT 1),
          (SELECT u.id FROM users u WHERE u.status='active' AND e.email IS NOT NULL AND TRIM(e.email)<>'' AND LOWER(u.email)=LOWER(e.email) LIMIT 1)
        ) AS account_user_id
      FROM employees e
      WHERE e.client_id=?1 AND e.status!='deleted'
      ORDER BY COALESCE(e.nickname,e.first_name),e.id
    `).bind(clientId).all()).results || [];
    const primaryOwnerUserId=await getPrimaryOwnerUserId(env.DB,clientId);
    const effectiveMembers=members.map(row=>{
      const stored=String(row.role||'');
      const effective=(stored==='owner'&&Number(row.user_id)!==Number(primaryOwnerUserId))?'co_owner':stored;
      return {...row,stored_role:stored,role:effective,is_primary_owner:Number(row.user_id)===Number(primaryOwnerUserId),is_me:Number(row.user_id)===Number(auth.user.id)};
    });
    const roleByUser = new Map(effectiveMembers.map(row => [Number(row.user_id), String(row.role || '')]));
    return json({
      members: effectiveMembers,
      eligible_employees: employees.map(row => ({
        ...row,
        current_role: row.account_user_id ? roleByUser.get(Number(row.account_user_id)) || null : null,
        linked: Boolean(row.account_user_id || row.line_user_id),
        account_backfill_needed: Boolean(row.line_user_id && !row.account_user_id),
      })),
      role_catalog:[
        {value:'co_owner',label:'Co-Owner · เจ้าของร่วม',description:'ดูแลได้เกือบทั้งหมด ยกเว้นลบบริษัท เปลี่ยน Billing และโอนเจ้าของหลัก'},
        {value:'hr_admin',label:'HR Admin · ผู้ดูแล HR',description:'พนักงาน เวลา ลา Recruitment เอกสาร Learning และงาน HR'},
        {value:'payroll_admin',label:'Payroll Admin · ผู้ดูแลเงินเดือน',description:'Payroll ภาษี SSO Payslip และเอกสารเงินเดือน'},
        {value:'manager',label:'Manager · หัวหน้าทีม',description:'ดูทีม เวลา KPI และคำขอในขอบเขตทีม'},
        {value:'approver',label:'Approver · ผู้อนุมัติ',description:'อนุมัติคำขอที่ได้รับมอบหมาย โดยไม่แก้การตั้งค่าบริษัท'}
      ],
      current_user_id: Number(auth.user.id),
      primary_owner_user_id:Number(primaryOwnerUserId||0)||null,
    });
  }

  if (path === '/api/company-access' && method === 'POST') {
    if (!clientId) return json({ error: 'COMPANY_REQUIRED' }, 409);
    if (!(await canManageWorkspaceAccess(env.DB,clientId,auth.user.id))) return json({ error: 'เฉพาะ Primary Owner หรือ Co-Owner เท่านั้นที่เพิ่มสิทธิ์ระดับ Workspace ได้' }, 403);
    await ensureLineBusinessOnboardingReady(env.DB);
    const body = await safeJson(request);
    const employeeId = Number(body.employee_id || 0);
    const requestedRole=String(body.role||'').toLowerCase();
    const role=requestedRole==='owner'?'co_owner':requestedRole;
    if(!GRANTABLE_WORKSPACE_ROLES.has(role)) return json({error:'ระดับสิทธิ์ไม่ถูกต้อง'},400);
    const employee = await env.DB.prepare(`SELECT * FROM employees WHERE id=?1 AND client_id=?2 AND status!='deleted'`).bind(employeeId,clientId).first();
    if (!employee) return json({ error: 'ไม่พบพนักงานในบริษัทนี้' }, 404);
    const targetUser = await ensureEmployeeNaknaUser(env.DB, employee);
    if (!targetUser?.id) return json({ error: 'พนักงานคนนี้ยังไม่ได้เชื่อม LINE หรือ Google กับนากนะ กรุณาเชื่อมบัญชีก่อน แล้วค่อยเพิ่มสิทธิ์ Owner' }, 409);
    await env.DB.prepare(`INSERT INTO company_members (client_id,user_id,role,status,created_at,updated_at)
      VALUES (?1,?2,?3,'active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      ON CONFLICT(client_id,user_id) DO UPDATE SET role=excluded.role,status='active',updated_at=CURRENT_TIMESTAMP`)
      .bind(clientId,Number(targetUser.id),role).run();
    // Access grant means joining this existing Workspace, not creating a new business.
    // Point every active session of the recipient to this Workspace so mobile/desktop land in the same company.
    await env.DB.prepare(`UPDATE auth_sessions SET selected_client_id=?1,last_seen_at=CURRENT_TIMESTAMP WHERE user_id=?2 AND expires_at>CURRENT_TIMESTAMP`).bind(clientId,Number(targetUser.id)).run().catch(()=>{});
    await safeAudit(env.DB,clientId,'user',String(auth.user.id),'company.access.grant','user',String(targetUser.id),{role,employee_id:employeeId}).catch(()=>{});
    // Tell the recipient immediately in LINE so the new access is not invisible.
    // This is best-effort: granting access must still succeed even when LINE push is unavailable.
    await notifyCompanyAccessGranted(env,{clientId,targetUser,employee,role}).catch(error=>{
      console.warn(JSON.stringify({level:'warn',event:'company_access_notify_failed',client_id:clientId,user_id:Number(targetUser.id),message:String(error?.message||error)}));
    });
    AUTH_CACHE.clear();
    return json({ ok:true, user_id:Number(targetUser.id), role, notified_line:Boolean(employee.line_user_id||targetUser.line_user_id) });
  }

  const companyAccessDeleteMatch = path.match(/^\/api\/company-access\/(\d+)$/);
  if (companyAccessDeleteMatch && method === 'DELETE') {
    if (!clientId) return json({ error: 'COMPANY_REQUIRED' }, 409);
    if (!(await canManageWorkspaceAccess(env.DB,clientId,auth.user.id))) return json({ error: 'เฉพาะ Primary Owner หรือ Co-Owner เท่านั้นที่ถอนสิทธิ์ระดับ Workspace ได้' }, 403);
    const targetUserId = Number(companyAccessDeleteMatch[1]);
    const primaryOwnerUserId=await getPrimaryOwnerUserId(env.DB,clientId);
    if (targetUserId === Number(primaryOwnerUserId)) return json({ error: 'ไม่สามารถถอน Primary Owner ได้ กรุณาโอนความเป็นเจ้าของก่อน' }, 400);
    const target = await env.DB.prepare(`SELECT * FROM company_members WHERE client_id=?1 AND user_id=?2 AND status='active' LIMIT 1`).bind(clientId,targetUserId).first();
    if (!target) return json({ error:'ไม่พบสิทธิ์ของบัญชีนี้' },404);
    await env.DB.prepare(`UPDATE company_members SET status='revoked',updated_at=CURRENT_TIMESTAMP WHERE client_id=?1 AND user_id=?2`).bind(clientId,targetUserId).run();
    await safeAudit(env.DB,clientId,'user',String(auth.user.id),'company.access.revoke','user',String(targetUserId),{previous_role:target.role}).catch(()=>{});
    AUTH_CACHE.clear();
    return json({ok:true});
  }


  const companyDeleteMatch = path.match(/^\/api\/companies\/(\d+)$/);
  if (companyDeleteMatch && method === 'DELETE') {
    const deleteClientId = Number(companyDeleteMatch[1]);
    const body = await safeJson(request);
    const row = await env.DB.prepare(`SELECT c.id,c.name,m.role,(SELECT COUNT(*) FROM employees e WHERE e.client_id=c.id AND e.status!='deleted') AS employee_count FROM clients c JOIN company_members m ON m.client_id=c.id WHERE c.id=?1 AND m.user_id=?2 AND m.status='active' LIMIT 1`)
      .bind(deleteClientId, Number(auth.user.id)).first();
    if (!row) return json({ error: 'ไม่พบบริษัทหรือคุณไม่มีสิทธิ์' }, 404);
    if (!(await isPrimaryWorkspaceOwner(env.DB,deleteClientId,auth.user.id))) return json({ error: 'เฉพาะ Primary Owner เท่านั้นที่ลบบริษัทได้' }, 403);
    const confirmName=String(body.confirm_name||'').trim();
    if (confirmName !== String(row.name||'').trim()) return json({ error: 'กรุณาพิมพ์ชื่อบริษัทให้ตรงเพื่อยืนยันการลบ' }, 400);
    await safeAudit(env.DB,deleteClientId,'user',String(auth.user.id),'company.delete','client',String(deleteClientId),{name:row.name,employee_count:Number(row.employee_count||0)}).catch(()=>{});
    await env.DB.prepare('DELETE FROM clients WHERE id=?1').bind(deleteClientId).run();
    const next = await env.DB.prepare(`SELECT client_id FROM company_members WHERE user_id=?1 AND status='active' ORDER BY id DESC LIMIT 1`).bind(Number(auth.user.id)).first();
    const nextClientId=next?.client_id?Number(next.client_id):null;
    await env.DB.prepare(`UPDATE auth_sessions SET selected_client_id=?1,last_seen_at=CURRENT_TIMESTAMP WHERE user_id=?2 AND expires_at>CURRENT_TIMESTAMP`)
      .bind(nextClientId,Number(auth.user.id)).run();
    AUTH_CACHE.clear();
    const response=json({ok:true,deleted_client_id:deleteClientId,next_client_id:nextClientId});
    response.headers.append('Set-Cookie', nextClientId ? companyCookie(nextClientId) : clearCookie('nakna_company'));
    return response;
  }

  if (path === '/api/company-profile' && method === 'GET') {
    await ensureV100P7Ready(env.DB);
    const client = await getClient(env.DB, clientId);
    if (!client) return json({ error: 'ไม่พบบริษัท' }, 404);
    const asset=await env.DB.prepare('SELECT logo_data_url FROM company_assets WHERE client_id=?1').bind(clientId).first();
    return json({ company: {...publicCompanyProfile(client),logo_data_url:asset?.logo_data_url||''} });
  }

  if (path === '/api/company-profile' && method === 'PATCH') {
    if (!['owner','co_owner','hr_admin','hr'].includes(String(auth.role || ''))) return json({ error: 'ไม่มีสิทธิ์แก้ข้อมูลบริษัท' }, 403);
    const body = await safeJson(request);
    const name = String(body.name || '').trim();
    const timezone = String(body.timezone || 'Asia/Bangkok').trim() || 'Asia/Bangkok';
    const workStart = normalizeTimeHM(body.work_start) || '09:00';
    const workEnd = normalizeTimeHM(body.work_end) || '18:00';
    const lateGrace = Math.max(0, Math.min(180, Number(body.late_grace_minutes ?? 10) || 0));
    if (name.length < 2) return json({ error: 'กรุณาใส่ชื่อบริษัท' }, 400);
    await env.DB.prepare(`UPDATE clients SET name=?1,timezone=?2,work_start=?3,work_end=?4,late_grace_minutes=?5 WHERE id=?6`)
      .bind(name, timezone, workStart, workEnd, lateGrace, clientId).run();
    await safeAudit(env.DB, clientId, 'user', String(auth.user.id), 'company.profile.update', 'client', String(clientId), { name, timezone, work_start: workStart, work_end: workEnd, late_grace_minutes: lateGrace });
    const client = await getClient(env.DB, clientId);
    const asset=await env.DB.prepare('SELECT logo_data_url FROM company_assets WHERE client_id=?1').bind(clientId).first();
    return json({ ok: true, company: {...publicCompanyProfile(client),logo_data_url:asset?.logo_data_url||''} });
  }

  if (path === '/api/company-logo' && method === 'PUT') {
    if (!['owner','co_owner','hr_admin','hr'].includes(String(auth.role || ''))) return json({ error: 'ไม่มีสิทธิ์แก้โลโก้บริษัท' }, 403);
    await ensureV100P7Ready(env.DB); const body=await safeJson(request); const dataUrl=String(body.data_url||'');
    if(!/^data:image\/(png|jpeg|webp);base64,/i.test(dataUrl))return json({error:'รองรับเฉพาะ PNG, JPG และ WebP'},400);
    if(dataUrl.length>700000)return json({error:'โลโก้มีขนาดใหญ่เกิน 512 KB'},413);
    await env.DB.prepare(`INSERT INTO company_assets (client_id,logo_data_url,updated_at) VALUES (?1,?2,CURRENT_TIMESTAMP) ON CONFLICT(client_id) DO UPDATE SET logo_data_url=excluded.logo_data_url,updated_at=CURRENT_TIMESTAMP`).bind(clientId,dataUrl).run();
    return json({ok:true,logo_data_url:dataUrl});
  }
  if (path === '/api/company-logo' && method === 'DELETE') {
    if (!['owner','co_owner','hr_admin','hr'].includes(String(auth.role || ''))) return json({ error: 'ไม่มีสิทธิ์แก้โลโก้บริษัท' }, 403);
    await ensureV100P7Ready(env.DB); await env.DB.prepare('DELETE FROM company_assets WHERE client_id=?1').bind(clientId).run(); return json({ok:true});
  }

  if (path === '/api/integrations/google-workspace/mobile-handoff' && method === 'POST') {
    if (!clientId) return json({ error: 'COMPANY_REQUIRED' }, 409);
    if (!canManageIntegrations(auth.role)) return json({ error: 'เฉพาะ Owner หรือ HR Admin ที่เชื่อม Google ได้' }, 403);
    await ensureV100P7Ready(env.DB);
    const token=randomToken(40), tokenHash=await sha256Hex(token), expiresAt=new Date(Date.now()+10*60*1000).toISOString();
    await env.DB.prepare(`DELETE FROM line_web_login_tokens WHERE user_id=?1 AND purpose='google_oauth_handoff' AND used_at IS NULL`).bind(Number(auth.user.id)).run();
    await env.DB.prepare(`INSERT INTO line_web_login_tokens (token_hash,user_id,client_id,purpose,expires_at) VALUES (?1,?2,?3,'google_oauth_handoff',?4)`).bind(tokenHash,Number(auth.user.id),clientId,expiresAt).run();
    const base=String(env.APP_BASE_URL||appOrigin(request,env)).replace(/\/$/,'');
    return json({ok:true,url:`${base}/auth/line/start?token=${encodeURIComponent(token)}&openExternalBrowser=1`,expires_at:expiresAt});
  }

  if (path === '/api/integrations/google-workspace' && method === 'GET') {
    await ensureV063Ready(env.DB);
    const row = await env.DB.prepare(`SELECT id,client_id,email,scopes,gmail_enabled,drive_enabled,sheets_enabled,drive_folder_id,leave_evidence_folder_id,spreadsheet_id,status,last_sync_at,last_error,connected_at,updated_at FROM google_workspace_integrations WHERE client_id=?1 AND status='connected'`).bind(clientId).first();
    return json({ connected: Boolean(row), integration: row ? publicGoogleWorkspaceIntegration(row) : null });
  }

  if (path === '/api/integrations/google-workspace' && method === 'DELETE') {
    if (!canManageIntegrations(auth.role)) return json({ error: 'เฉพาะ Owner หรือ HR Admin ที่ยกเลิก Google ได้' }, 403);
    await ensureV063Ready(env.DB);
    await env.DB.prepare('DELETE FROM google_workspace_integrations WHERE client_id=?1').bind(clientId).run();
    await safeAudit(env.DB, clientId, 'user', String(auth.user.id), 'google_workspace.disconnect', 'google_workspace', String(clientId), null);
    return json({ ok: true });
  }

  if (path === '/api/integrations/google-workspace/sync' && method === 'POST') {
    if (!canManageIntegrations(auth.role)) return json({ error: 'เฉพาะ Owner หรือ HR Admin ที่สั่ง Sync Google ได้' }, 403);
    await ensureV063Ready(env.DB);
    const row = await env.DB.prepare(`SELECT * FROM google_workspace_integrations WHERE client_id=?1 AND status='connected'`).bind(clientId).first();
    if (!row) return json({ error: 'ยังไม่ได้เชื่อม Google' }, 404);
    try {
      const accessToken = await getWorkspaceGoogleAccessToken(env, row);
      const result = await syncWorkspaceSnapshotToSheet(env, clientId, row, accessToken);
      await env.DB.prepare(`UPDATE google_workspace_integrations SET last_sync_at=CURRENT_TIMESTAMP,last_error=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?1`).bind(Number(row.id)).run();
      return json({ ok: true, ...result });
    } catch (error) {
      await env.DB.prepare(`UPDATE google_workspace_integrations SET last_error=?1,updated_at=CURRENT_TIMESTAMP WHERE id=?2`).bind(String(error?.message || error).slice(0,300), Number(row.id)).run();
      return json({ error: safeGoogleWorkspaceError(error) }, 400);
    }
  }

  if (path === '/api/integrations/gmail' && method === 'GET') {
    const row = await env.DB.prepare(`SELECT email, scopes, access_expires_at, connected_at, updated_at FROM gmail_connections WHERE user_id=?1`).bind(Number(auth.user.id)).first();
    return json({ connected: Boolean(row), account: row || null });
  }

  if (path === '/api/integrations/gmail' && method === 'DELETE') {
    await env.DB.prepare('DELETE FROM gmail_connections WHERE user_id=?1').bind(Number(auth.user.id)).run();
    return json({ ok: true });
  }

  if (path === '/api/integrations/line' && method === 'GET') {
    await ensureV060Ready(env.DB);
    const integration = await getWorkspaceLineIntegration(env, clientId, false);
    if (integration) {
      let live = null;
      try {
        const creds = await decryptLineIntegrationCredentials(env, integration);
        live = await getLineWebhookInfo(creds.access_token);
        if (live) await env.DB.prepare('UPDATE line_integrations SET webhook_active=?1,updated_at=CURRENT_TIMESTAMP WHERE id=?2').bind(live.active ? 1 : 0, Number(integration.id)).run();
      } catch {}
      return json({ mode: 'dedicated', connected: true, integration: publicLineIntegration(integration, live, canManageIntegrations(auth.role)) });
    }
    let defaultBot = null;
    if (env.LINE_CHANNEL_ACCESS_TOKEN) { try { defaultBot = await getLineBotInfo(env.LINE_CHANNEL_ACCESS_TOKEN); } catch {} }
    return json({ mode: 'nakna_default', connected: false, default_available: Boolean(env.LINE_CHANNEL_ACCESS_TOKEN && env.LINE_CHANNEL_SECRET), bot: defaultBot ? { basic_id: defaultBot.basicId || null, display_name: defaultBot.displayName || 'นากนะ' } : null });
  }

  if (path === '/api/integrations/line' && method === 'PUT') {
    if (!canManageIntegrations(auth.role)) return json({ error: 'เฉพาะ Owner หรือ HR Admin ที่เชื่อม LINE OA ได้' }, 403);
    await ensureV060Ready(env.DB);
    const body = await safeJson(request);
    const channelSecret = String(body.channel_secret || '').trim();
    const accessToken = String(body.access_token || '').trim();
    const channelId = String(body.channel_id || '').trim() || null;
    if (channelSecret.length < 16 || accessToken.length < 20) return json({ error: 'กรุณาใส่ Channel Secret และ Channel Access Token ให้ครบ' }, 400);
    try {
      const saved = await saveWorkspaceLineIntegration(env, { clientId, userId: Number(auth.user.id), channelId, channelSecret, accessToken });
      await safeAudit(env.DB, clientId, 'user', String(auth.user.id), 'line.integration.connect', 'line_integration', String(saved.id), { bot: saved.bot_display_name });
      return json({ ok: true, integration: publicLineIntegration(saved) });
    } catch (error) {
      return json({ error: safeLineIntegrationError(error) }, 400);
    }
  }

  if (path === '/api/integrations/line/test' && method === 'POST') {
    if (!canManageIntegrations(auth.role)) return json({ error: 'ไม่มีสิทธิ์ทดสอบ LINE Integration' }, 403);
    await ensureV060Ready(env.DB);
    const integration = await getWorkspaceLineIntegration(env, clientId, false);
    if (!integration) return json({ error: 'ยังไม่ได้เชื่อม LINE Official Account' }, 404);
    try {
      const creds = await decryptLineIntegrationCredentials(env, integration);
      const [bot, webhook, test] = await Promise.all([getLineBotInfo(creds.access_token), getLineWebhookInfo(creds.access_token), testLineWebhook(creds.access_token, integration.webhook_url)]);
      const ok = Boolean(test?.success);
      await env.DB.prepare('UPDATE line_integrations SET webhook_active=?1,last_test_at=CURRENT_TIMESTAMP,last_error=?2,updated_at=CURRENT_TIMESTAMP WHERE id=?3')
        .bind(webhook?.active ? 1 : 0, ok ? null : String(test?.reason || test?.detail || 'webhook_test_failed'), Number(integration.id)).run();
      return json({ ok, bot: { display_name: bot.displayName, basic_id: bot.basicId }, webhook: { ...webhook, test } });
    } catch (error) {
      await env.DB.prepare('UPDATE line_integrations SET last_test_at=CURRENT_TIMESTAMP,last_error=?1,updated_at=CURRENT_TIMESTAMP WHERE id=?2').bind(String(error?.message || error).slice(0,300), Number(integration.id)).run();
      return json({ error: safeLineIntegrationError(error) }, 400);
    }
  }

  if (path === '/api/integrations/line' && method === 'DELETE') {
    if (!canManageIntegrations(auth.role)) return json({ error: 'เฉพาะ Owner หรือ HR Admin ที่ยกเลิก LINE Integration ได้' }, 403);
    const integration = await getWorkspaceLineIntegration(env, clientId, false);
    if (integration) {
      await env.DB.prepare('DELETE FROM line_integrations WHERE id=?1 AND client_id=?2').bind(Number(integration.id),clientId).run();
      await safeAudit(env.DB, clientId, 'user', String(auth.user.id), 'line.integration.disconnect', 'line_integration', String(integration.id), null);
    }
    return json({ ok: true, fallback: Boolean(env.LINE_CHANNEL_ACCESS_TOKEN && env.LINE_CHANNEL_SECRET) });
  }

  if (path === '/api/people-core' && method === 'GET') {
    await ensureV100P1Ready(env.DB);
    // P7.58: positions are company-wide, not department-specific.
    await env.DB.prepare('UPDATE positions SET department_id=NULL WHERE client_id=?1 AND department_id IS NOT NULL').bind(clientId).run();
    const [departments, positions, schedules, holidays, client] = await Promise.all([
      env.DB.prepare(`SELECT d.*,m.nickname AS manager_nickname,m.first_name AS manager_first_name,m.last_name AS manager_last_name,
        (SELECT COUNT(*) FROM employees e WHERE e.department_id=d.id AND e.client_id=d.client_id AND e.status='active') AS employee_count
        FROM departments d LEFT JOIN employees m ON m.id=d.manager_employee_id
        WHERE d.client_id=?1 ORDER BY COALESCE(d.sort_order,0),d.name`).bind(clientId).all(),
      env.DB.prepare(`SELECT p.*,d.name AS department_name,(SELECT COUNT(*) FROM employees e WHERE e.position_id=p.id AND e.client_id=p.client_id AND e.status='active') AS employee_count FROM positions p LEFT JOIN departments d ON d.id=p.department_id WHERE p.client_id=?1 ORDER BY d.name,p.name`).bind(clientId).all(),
      env.DB.prepare(`SELECT * FROM work_schedule_rules WHERE client_id=?1 ORDER BY CASE scope_type WHEN 'company' THEN 1 WHEN 'department' THEN 2 ELSE 3 END,scope_id,weekday`).bind(clientId).all(),
      env.DB.prepare(`SELECT * FROM company_holidays WHERE client_id=?1 ORDER BY holiday_date`).bind(clientId).all(),
      getClient(env.DB,clientId),
    ]);
    return json({
      departments: departments.results||[],
      positions: positions.results||[],
      schedules: schedules.results||[],
      holidays: holidays.results||[],
      attendance_policy: { allow_checkout_outside_geofence: Boolean(Number(client?.allow_checkout_outside_geofence||0)) },
    });
  }

  if (path === '/api/departments' && method === 'POST') {
    if (!canManagePeopleAdmin(auth.role)) return json({error:'ไม่มีสิทธิ์จัดการแผนก'},403);
    await ensureV100P1Ready(env.DB);
    const body=await safeJson(request); const name=String(body.name||'').trim(); if(name.length<2)return json({error:'กรุณาใส่ชื่อแผนก'},400);
    const code=slugCode(body.code||name)||`dept_${Date.now()}`; const parentId=body.parent_department_id?Number(body.parent_department_id):null; const managerId=body.manager_employee_id?Number(body.manager_employee_id):null;
    if(parentId){const row=await env.DB.prepare('SELECT id FROM departments WHERE id=?1 AND client_id=?2').bind(parentId,clientId).first();if(!row)return json({error:'แผนกแม่ไม่อยู่ในบริษัทนี้'},400);}
    if(managerId){const row=await getEmployeeForClient(env.DB,managerId,clientId);if(!row)return json({error:'หัวหน้าแผนกไม่อยู่ในบริษัทนี้'},400);}
    const result=await env.DB.prepare(`INSERT INTO departments(client_id,name,code,manager_employee_id,parent_department_id,sort_order) VALUES(?1,?2,?3,?4,?5,?6)`).bind(clientId,name,code,managerId,parentId,Number(body.sort_order||0)).run();
    await safeAudit(env.DB,clientId,'user',String(auth.user.id),'department.create','department',String(result.meta.last_row_id),{name,manager_id:managerId,parent_id:parentId});
    return json({ok:true,id:result.meta.last_row_id},201);
  }

  const departmentCoreMatch=path.match(/^\/api\/departments\/(\d+)$/);
  if(departmentCoreMatch && method==='PATCH'){
    if(!canManagePeopleAdmin(auth.role))return json({error:'ไม่มีสิทธิ์จัดการแผนก'},403);
    await ensureV100P1Ready(env.DB); const id=Number(departmentCoreMatch[1]); const existing=await env.DB.prepare('SELECT * FROM departments WHERE id=?1 AND client_id=?2').bind(id,clientId).first(); if(!existing)return json({error:'ไม่พบแผนก'},404);
    const body=await safeJson(request); const name=String(body.name??existing.name).trim(); const managerId=body.manager_employee_id===null||body.manager_employee_id===''?null:(body.manager_employee_id===undefined?existing.manager_employee_id:Number(body.manager_employee_id)); const parentId=body.parent_department_id===null||body.parent_department_id===''?null:(body.parent_department_id===undefined?existing.parent_department_id:Number(body.parent_department_id));
    if(parentId===id)return json({error:'แผนกไม่สามารถเป็นแผนกแม่ของตัวเองได้'},400);
    if(parentId){
      const parent=await env.DB.prepare('SELECT id FROM departments WHERE id=?1 AND client_id=?2').bind(parentId,clientId).first();
      if(!parent)return json({error:'แผนกแม่ไม่อยู่ในบริษัทนี้'},400);
      if(await departmentParentCreatesCycle(env.DB,clientId,id,parentId))return json({error:'ลำดับแผนกไม่ถูกต้อง เพราะจะทำให้เกิดการวนลูปของโครงสร้าง'},400);
    }
    if(managerId){const row=await getEmployeeForClient(env.DB,managerId,clientId);if(!row)return json({error:'หัวหน้าแผนกไม่อยู่ในบริษัทนี้'},400);}
    await env.DB.prepare(`UPDATE departments SET name=?1,manager_employee_id=?2,parent_department_id=?3,sort_order=?4 WHERE id=?5 AND client_id=?6`).bind(name,managerId,parentId,Math.max(0,Number(body.sort_order??existing.sort_order??0)||0),id,clientId).run();
    return json({ok:true});
  }

  if(path==='/api/positions' && method==='POST'){
    if(!canManagePeopleAdmin(auth.role))return json({error:'ไม่มีสิทธิ์จัดการตำแหน่ง'},403);
    const body=await safeJson(request); const name=String(body.name||'').trim(); if(name.length<2)return json({error:'กรุณาใส่ชื่อตำแหน่ง'},400);
    const existingRows=(await env.DB.prepare('SELECT id,name FROM positions WHERE client_id=?1 ORDER BY id').bind(clientId).all()).results||[];
    const same=existingRows.find(row=>String(row.name||'').trim().toLocaleLowerCase()===name.toLocaleLowerCase());
    if(same){await env.DB.prepare('UPDATE positions SET department_id=NULL WHERE id=?1 AND client_id=?2').bind(Number(same.id),clientId).run();return json({ok:true,id:Number(same.id),reused:true});}
    const result=await env.DB.prepare('INSERT INTO positions(client_id,department_id,name) VALUES(?1,NULL,?2)').bind(clientId,name).run(); return json({ok:true,id:result.meta.last_row_id,reused:false},201);
  }

  const positionCoreMatch=path.match(/^\/api\/positions\/(\d+)$/);
  if(positionCoreMatch && method==='PATCH'){
    if(!canManagePeopleAdmin(auth.role))return json({error:'ไม่มีสิทธิ์จัดการตำแหน่ง'},403);
    const id=Number(positionCoreMatch[1]); const existing=await env.DB.prepare('SELECT * FROM positions WHERE id=?1 AND client_id=?2').bind(id,clientId).first(); if(!existing)return json({error:'ไม่พบตำแหน่ง'},404);
    const body=await safeJson(request); const name=String(body.name??existing.name).trim(); if(name.length<2)return json({error:'กรุณาใส่ชื่อตำแหน่ง'},400);
    await env.DB.prepare('UPDATE positions SET name=?1,department_id=NULL WHERE id=?2 AND client_id=?3').bind(name,id,clientId).run(); return json({ok:true});
  }
  if(positionCoreMatch && method==='DELETE'){
    if(!canManagePeopleAdmin(auth.role))return json({error:'ไม่มีสิทธิ์จัดการตำแหน่ง'},403);
    const id=Number(positionCoreMatch[1]); const used=await env.DB.prepare('SELECT COUNT(*) AS c FROM employees WHERE client_id=?1 AND position_id=?2').bind(clientId,id).first(); if(Number(used?.c||0)>0)return json({error:'ตำแหน่งนี้ยังถูกใช้โดยพนักงาน กรุณาย้ายพนักงานก่อน'},409);
    await env.DB.prepare('DELETE FROM positions WHERE id=?1 AND client_id=?2').bind(id,clientId).run(); return json({ok:true});
  }

  const departmentAssignMatch=path.match(/^\/api\/departments\/(\d+)\/assign$/);
  if(departmentAssignMatch && method==='POST'){
    if(!canManagePeopleAdmin(auth.role))return json({error:'ไม่มีสิทธิ์จัดคนเข้าแผนก'},403);
    const departmentId=Number(departmentAssignMatch[1]);
    const department=await env.DB.prepare('SELECT id,name FROM departments WHERE id=?1 AND client_id=?2').bind(departmentId,clientId).first();
    if(!department)return json({error:'ไม่พบแผนก'},404);
    const body=await safeJson(request);
    const employeeIds=[...new Set((Array.isArray(body.employee_ids)?body.employee_ids:[]).map(Number).filter(Number.isFinite))];
    for(const employeeId of employeeIds){
      const employee=await getEmployeeForClient(env.DB,employeeId,clientId);
      if(!employee)return json({error:'มีพนักงานที่ไม่อยู่ในบริษัทนี้'},400);
    }
    const current=(await env.DB.prepare('SELECT id FROM employees WHERE client_id=?1 AND department_id=?2 AND status=\'active\'').bind(clientId,departmentId).all()).results||[];
    const selected=new Set(employeeIds);
    for(const row of current){
      if(selected.has(Number(row.id)))continue;
      await env.DB.prepare('UPDATE employees SET department_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND client_id=?2').bind(Number(row.id),clientId).run();
    }
    for(const employeeId of employeeIds){
      await env.DB.prepare('UPDATE employees SET department_id=?1,updated_at=CURRENT_TIMESTAMP WHERE id=?2 AND client_id=?3').bind(departmentId,employeeId,clientId).run();
    }
    await safeAudit(env.DB,clientId,'user',String(auth.user.id),'department.assign','department',String(departmentId),{employee_ids:employeeIds});
    return json({ok:true,department_id:departmentId,assigned_count:employeeIds.length,position_reset_count:0});
  }

  const positionAssignMatch=path.match(/^\/api\/positions\/(\d+)\/assign$/);
  if(positionAssignMatch && method==='POST'){
    if(!canManagePeopleAdmin(auth.role))return json({error:'ไม่มีสิทธิ์จัดคนเข้าตำแหน่ง'},403);
    const positionId=Number(positionAssignMatch[1]);
    const position=await env.DB.prepare('SELECT id,department_id,name FROM positions WHERE id=?1 AND client_id=?2').bind(positionId,clientId).first();
    if(!position)return json({error:'ไม่พบตำแหน่ง'},404);
    const body=await safeJson(request);
    const employeeIds=[...new Set((Array.isArray(body.employee_ids)?body.employee_ids:[]).map(Number).filter(Number.isFinite))];
    for(const employeeId of employeeIds){
      const employee=await getEmployeeForClient(env.DB,employeeId,clientId);
      if(!employee)return json({error:'มีพนักงานที่ไม่อยู่ในบริษัทนี้'},400);
    }
    const current=(await env.DB.prepare('SELECT id FROM employees WHERE client_id=?1 AND position_id=?2').bind(clientId,positionId).all()).results||[];
    const selected=new Set(employeeIds);
    for(const row of current){
      if(!selected.has(Number(row.id))) await env.DB.prepare('UPDATE employees SET position_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND client_id=?2 AND position_id=?3').bind(Number(row.id),clientId,positionId).run();
    }
    for(const employeeId of employeeIds){
      await env.DB.prepare('UPDATE employees SET position_id=?1,updated_at=CURRENT_TIMESTAMP WHERE id=?2 AND client_id=?3').bind(positionId,employeeId,clientId).run();
    }
    await safeAudit(env.DB,clientId,'user',String(auth.user.id),'position.assign','position',String(positionId),{employee_ids:employeeIds});
    return json({ok:true,position_id:positionId,assigned_count:employeeIds.length});
  }

  if(path==='/api/work-schedules' && method==='PUT'){
    if(!canManagePeopleAdmin(auth.role))return json({error:'ไม่มีสิทธิ์จัดการเวลาทำงาน'},403);
    await ensureV100P1Ready(env.DB); const body=await safeJson(request); const scopeType=String(body.scope_type||'company'); let scopeId=Number(body.scope_id||0); if(!['company','department','employee'].includes(scopeType))return json({error:'Scope ไม่ถูกต้อง'},400); if(scopeType==='company')scopeId=0;
    if(scopeType==='department'){const row=await env.DB.prepare('SELECT id FROM departments WHERE id=?1 AND client_id=?2').bind(scopeId,clientId).first();if(!row)return json({error:'ไม่พบแผนก'},404);}
    if(scopeType==='employee'){const row=await getEmployeeForClient(env.DB,scopeId,clientId);if(!row)return json({error:'ไม่พบพนักงาน'},404);}
    const rules=Array.isArray(body.rules)?body.rules:[]; if(!rules.length)return json({error:'กรุณาเลือกอย่างน้อย 1 วัน'},400);
    for(const rule of rules){const weekday=Number(rule.weekday);if(weekday<1||weekday>7)continue;const isWorkday=rule.is_workday===false?0:1;const start=isWorkday?(normalizeTimeHM(rule.start_time)||'09:00'):null;const end=isWorkday?(normalizeTimeHM(rule.end_time)||'18:00'):null;const grace=Math.max(0,Math.min(180,Number(rule.late_grace_minutes??10)||0));await env.DB.prepare(`INSERT INTO work_schedule_rules(client_id,scope_type,scope_id,weekday,is_workday,start_time,end_time,late_grace_minutes) VALUES(?1,?2,?3,?4,?5,?6,?7,?8) ON CONFLICT(client_id,scope_type,scope_id,weekday) DO UPDATE SET is_workday=excluded.is_workday,start_time=excluded.start_time,end_time=excluded.end_time,late_grace_minutes=excluded.late_grace_minutes,updated_at=CURRENT_TIMESTAMP`).bind(clientId,scopeType,scopeId,weekday,isWorkday,start,end,grace).run();}
    await safeAudit(env.DB,clientId,'user',String(auth.user.id),'work_schedule.update',scopeType,String(scopeId),{rules}); return json({ok:true});
  }

  const scheduleResetMatch=path.match(/^\/api\/work-schedules\/(company|department|employee)\/(\d+)$/);
  if(scheduleResetMatch && method==='DELETE'){
    if(!canManagePeopleAdmin(auth.role))return json({error:'ไม่มีสิทธิ์จัดการเวลาทำงาน'},403);
    const scopeType=scheduleResetMatch[1]; const scopeId=scopeType==='company'?0:Number(scheduleResetMatch[2]);
    await env.DB.prepare('DELETE FROM work_schedule_rules WHERE client_id=?1 AND scope_type=?2 AND scope_id=?3').bind(clientId,scopeType,scopeId).run();
    return json({ok:true});
  }

  if(path==='/api/company-holidays' && method==='POST'){
    if(!canManagePeopleAdmin(auth.role))return json({error:'ไม่มีสิทธิ์จัดการวันหยุด'},403);
    await ensureV100P1Ready(env.DB); const body=await safeJson(request); const date=String(body.holiday_date||'').trim(); const name=String(body.name||'').trim(); if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||name.length<2)return json({error:'กรุณาใส่วันที่และชื่อวันหยุด'},400);
    try{const result=await env.DB.prepare(`INSERT INTO company_holidays(client_id,holiday_date,name,holiday_type,is_paid,notes) VALUES(?1,?2,?3,?4,?5,?6)`).bind(clientId,date,name,String(body.holiday_type||'traditional'),body.is_paid===false?0:1,body.notes||null).run();return json({ok:true,id:result.meta.last_row_id},201);}catch(e){return json({error:'วันนี้มีวันหยุดอยู่แล้ว'},409);}
  }

  const holidayDeleteMatch=path.match(/^\/api\/company-holidays\/(\d+)$/);
  if(holidayDeleteMatch && method==='DELETE'){
    if(!canManagePeopleAdmin(auth.role))return json({error:'ไม่มีสิทธิ์จัดการวันหยุด'},403); await env.DB.prepare('DELETE FROM company_holidays WHERE id=?1 AND client_id=?2').bind(Number(holidayDeleteMatch[1]),clientId).run(); return json({ok:true});
  }

  if(path==='/api/attendance-policy' && method==='PATCH'){
    if(!canManagePeopleAdmin(auth.role))return json({error:'ไม่มีสิทธิ์แก้นโยบายลงเวลา'},403); await ensureV100P1Ready(env.DB); const body=await safeJson(request); const allow=body.allow_checkout_outside_geofence?1:0; await env.DB.prepare('UPDATE clients SET allow_checkout_outside_geofence=?1 WHERE id=?2').bind(allow,clientId).run(); return json({ok:true,allow_checkout_outside_geofence:Boolean(allow)});
  }

  const peopleProfileMatch=path.match(/^\/api\/employees\/(\d+)\/people-profile$/);
  if(peopleProfileMatch && method==='PATCH'){
    if(!canManagePeopleAdmin(auth.role))return json({error:'ไม่มีสิทธิ์แก้ข้อมูลพนักงาน'},403); await ensureV100P1Ready(env.DB); const id=Number(peopleProfileMatch[1]); const employee=await getEmployeeForClient(env.DB,id,clientId); if(!employee)return json({error:'ไม่พบพนักงาน'},404); const body=await safeJson(request);
    const allowedStatuses=['candidate','interview','offer','probation','employee','leave_of_absence','resigned','terminated','alumni','inactive']; const peopleStatus=allowedStatuses.includes(String(body.people_status))?String(body.people_status):String(employee.people_status||'employee'); const managerId=body.manager_employee_id?Number(body.manager_employee_id):null; const deptId=body.department_id?Number(body.department_id):null; const posId=body.position_id?Number(body.position_id):null;
    if(managerId && managerId===id)return json({error:'พนักงานเป็นหัวหน้าตัวเองไม่ได้'},400); if(managerId){const m=await getEmployeeForClient(env.DB,managerId,clientId);if(!m)return json({error:'หัวหน้าไม่อยู่ในบริษัทนี้'},400);}
    const runtimeStatus=['leave_of_absence','resigned','terminated','alumni','inactive'].includes(peopleStatus)?'inactive':'active';
    await env.DB.prepare(`UPDATE employees SET department_id=?1,position_id=?2,manager_employee_id=?3,people_status=?4,status=?5,probation_end_date=?6,confirmed_at=?7,end_date=?8,end_reason=?9,updated_at=CURRENT_TIMESTAMP WHERE id=?10 AND client_id=?11`).bind(deptId,posId,managerId,peopleStatus,runtimeStatus,body.probation_end_date||null,body.confirmed_at||null,body.end_date||null,body.end_reason||null,id,clientId).run();
    if(Array.isArray(body.location_ids)){
      const locationIds=[...new Set(body.location_ids.map(Number).filter(Number.isFinite))];
      for(const locationId of locationIds){const wl=await env.DB.prepare('SELECT id FROM work_locations WHERE id=?1 AND client_id=?2 AND is_active=1').bind(locationId,clientId).first();if(!wl)return json({error:'มี Work Location ที่ไม่อยู่ในบริษัทนี้'},400);}
      await env.DB.prepare('DELETE FROM employee_work_locations WHERE employee_id=?1').bind(id).run();
      for(const locationId of locationIds) await env.DB.prepare('INSERT OR IGNORE INTO employee_work_locations(employee_id,location_id) VALUES(?1,?2)').bind(id,locationId).run();
    }
    await safeAudit(env.DB,clientId,'user',String(auth.user.id),'employee.people_profile.update','employee',String(id),{people_status:peopleStatus,manager_id:managerId,location_ids:Array.isArray(body.location_ids)?body.location_ids:undefined}); return json({ok:true});
  }

  const teamPlacementMatch=path.match(/^\/api\/employees\/(\d+)\/team-placement$/);
  if(teamPlacementMatch && method==='PATCH'){
    if(!canManagePeopleAdmin(auth.role))return json({error:'ไม่มีสิทธิ์จัดทีมพนักงาน'},403);
    const id=Number(teamPlacementMatch[1]); const employee=await getEmployeeForClient(env.DB,id,clientId); if(!employee)return json({error:'ไม่พบพนักงาน'},404);
    const body=await safeJson(request); const deptId=body.department_id?Number(body.department_id):null; const posId=body.position_id?Number(body.position_id):null;
    if(deptId){const d=await env.DB.prepare('SELECT id FROM departments WHERE id=?1 AND client_id=?2').bind(deptId,clientId).first();if(!d)return json({error:'ไม่พบแผนกนี้ในบริษัท'},400);}
    if(posId){const p=await env.DB.prepare('SELECT id FROM positions WHERE id=?1 AND client_id=?2').bind(posId,clientId).first();if(!p)return json({error:'ไม่พบตำแหน่งนี้ในบริษัท'},400);}
    await env.DB.prepare('UPDATE employees SET department_id=?1,position_id=?2,updated_at=CURRENT_TIMESTAMP WHERE id=?3 AND client_id=?4').bind(deptId,posId,id,clientId).run();
    await safeAudit(env.DB,clientId,'user',String(auth.user.id),'employee.team_placement.update','employee',String(id),{department_id:deptId,position_id:posId});
    return json({ok:true,department_id:deptId,position_id:posId});
  }

  const hireCandidateMatch=path.match(/^\/api\/candidates\/(\d+)\/hire$/);
  if(hireCandidateMatch && method==='POST'){
    if(!canManagePeopleAdmin(auth.role))return json({error:'ไม่มีสิทธิ์รับพนักงาน'},403); const candidate=await env.DB.prepare('SELECT * FROM candidates WHERE id=?1 AND client_id=?2').bind(Number(hireCandidateMatch[1]),clientId).first(); if(!candidate)return json({error:'ไม่พบผู้สมัคร'},404); const body=await safeJson(request); const code=String(body.employee_code||'').trim() || await generateEmployeeCode(env.DB,clientId); const start=body.start_date||dateInBangkok();
    await assertSeatCapacity(env.DB,clientId,1); const result=await env.DB.prepare(`INSERT INTO employees(client_id,employee_code,first_name,last_name,nickname,email,phone,start_date,probation_end_date,department_id,position_id,employment_type,status,people_status) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,'active','probation')`).bind(clientId,code,candidate.first_name,candidate.last_name,candidate.nickname,candidate.email,candidate.phone,start,body.probation_end_date||null,body.department_id||null,body.position_id||null,body.employment_type||'full_time').run(); await env.DB.prepare(`UPDATE candidates SET stage='hired',updated_at=CURRENT_TIMESTAMP,last_activity_at=CURRENT_TIMESTAMP WHERE id=?1`).bind(Number(candidate.id)).run(); await autoAssignLearningForEmployee(env.DB,clientId,Number(result.meta.last_row_id),Number(auth.user.id)); return json({ok:true,employee_id:result.meta.last_row_id},201);
  }


  if (path === '/api/team-work-log' && method === 'GET') {
    const url = new URL(request.url);
    const modeRaw = String(url.searchParams.get('mode') || 'today').trim();
    const mode = ['today','day','week','month','range'].includes(modeRaw) ? modeRaw : 'today';
    const today = dateInBangkok();
    const datePattern=/^\d{4}-\d{2}-\d{2}$/;
    const key = d => `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
    let anchor = String(url.searchParams.get('date') || today).trim();
    if (!datePattern.test(anchor)) anchor = today;
    if (mode === 'today') anchor = today;
    let start = anchor, end = anchor;
    const [ay,am,ad] = anchor.split('-').map(Number);
    if (mode === 'week') {
      const dt = new Date(Date.UTC(ay,am-1,ad));
      const jsDay = dt.getUTCDay();
      const back = (jsDay + 6) % 7;
      const monday = new Date(dt); monday.setUTCDate(dt.getUTCDate()-back);
      const sunday = new Date(monday); sunday.setUTCDate(monday.getUTCDate()+6);
      start = key(monday); end = key(sunday);
    } else if (mode === 'month') {
      let month = String(url.searchParams.get('month') || today.slice(0,7)).trim();
      if (!/^\d{4}-\d{2}$/.test(month)) month=today.slice(0,7);
      const [my,mm]=month.split('-').map(Number);
      if(mm<1||mm>12)return json({error:'เดือนไม่ถูกต้อง'},400);
      start=`${my}-${String(mm).padStart(2,'0')}-01`;
      const last=new Date(Date.UTC(my,mm,0)); end=key(last); anchor=start;
    } else if (mode === 'range') {
      start=String(url.searchParams.get('start')||'').trim(); end=String(url.searchParams.get('end')||'').trim();
      if(!datePattern.test(start)||!datePattern.test(end))return json({error:'กรุณาระบุช่วงวันที่ให้ครบ'},400);
      if(start>end)return json({error:'วันที่เริ่มต้องไม่มากกว่าวันสิ้นสุด'},400);
      const startDt=new Date(`${start}T00:00:00Z`), endDtCheck=new Date(`${end}T00:00:00Z`);
      const days=Math.floor((endDtCheck-startDt)/86400000)+1;
      if(days>366)return json({error:'เลือกช่วงวันที่ได้สูงสุด 366 วัน'},400);
      anchor=start;
    }
    const employeeRes = await env.DB.prepare(`SELECT e.id,e.employee_code,e.first_name,e.last_name,e.nickname,e.department_id,e.position_id,d.name AS department_name,p.name AS position_name FROM employees e LEFT JOIN departments d ON d.id=e.department_id LEFT JOIN positions p ON p.id=e.position_id WHERE e.client_id=?1 AND e.status='active' ORDER BY e.first_name,e.id`).bind(clientId).all();
    const attendanceRes = await env.DB.prepare(`SELECT * FROM attendance WHERE client_id=?1 AND work_date BETWEEN ?2 AND ?3 ORDER BY work_date,employee_id`).bind(clientId,start,end).all();
    const leaveRes = await env.DB.prepare(`SELECT lr.*,lp.name AS leave_name FROM leave_requests lr LEFT JOIN leave_policies lp ON lp.id=lr.policy_id WHERE lr.client_id=?1 AND lr.start_date<=?3 AND lr.end_date>=?2 AND lr.status IN ('approved','pending','awaiting_evidence') ORDER BY lr.id DESC`).bind(clientId,start,end).all();
    const attendanceMap = new Map((attendanceRes.results||[]).map(r=>[`${Number(r.employee_id)}|${r.work_date}`,r]));
    const leaves = leaveRes.results||[];
    const dates=[]; const cursor=new Date(`${start}T00:00:00Z`), endDt=new Date(`${end}T00:00:00Z`);
    const dateKey=d=>`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
    while(cursor<=endDt){dates.push(dateKey(cursor));cursor.setUTCDate(cursor.getUTCDate()+1);}
    const dayNames=['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'];
    const rows=[];
    for (const date of dates) {
      const dateObj=new Date(`${date}T00:00:00Z`);
      for (const e of (employeeRes.results||[])) {
        const a=attendanceMap.get(`${Number(e.id)}|${date}`)||{};
        const lr=leaves.find(x=>Number(x.employee_id)===Number(e.id)&&date>=x.start_date&&date<=x.end_date)||null;
        const isFuture=date>today;
        rows.push({...e,work_date:date,day_label:dayNames[dateObj.getUTCDay()],check_in_at:a.check_in_at||null,check_out_at:a.check_out_at||null,attendance_status:a.status||null,late_minutes:Number(a.late_minutes||0),leave_name:lr?.leave_name||lr?.leave_type||null,leave_status:lr?.status||null,approved_leave:lr?.status==='approved',is_future:isFuture});
      }
    }
    const effectiveRows=rows.filter(r=>!r.is_future);
    const summary={checked_in:effectiveRows.filter(r=>r.check_in_at).length,late:effectiveRows.filter(r=>r.check_in_at&&Number(r.late_minutes)>0).length,leave:effectiveRows.filter(r=>r.approved_leave&&!r.check_in_at).length,missing:effectiveRows.filter(r=>!r.check_in_at&&!r.approved_leave).length};
    const thDate=d=>new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Bangkok'}).format(new Date(`${d}T12:00:00+07:00`));
    return json({mode,date:anchor,start_date:start,end_date:end,range_label:start===end?thDate(start):`${thDate(start)} – ${thDate(end)}`,summary,rows});
  }

  if (path === '/api/dashboard' && method === 'GET') {
    return json(await getDashboard(env.DB, clientId, { includeHrCases: canManagePeopleAdmin(auth.role), userId: Number(auth.user.id) }));
  }

  if (path === '/api/dashboard/attention/read' && method === 'POST') {
    await ensureDashboardAttentionReady(env.DB);
    const body=await safeJson(request);
    const allowed=new Set(['missing','leave_pending','probation','contract','candidate','hr_private','request']);
    const key=String(body.key||'');
    if(!allowed.has(key)) return json({error:'ประเภทแจ้งเตือนไม่ถูกต้อง'},400);
    const itemKeys=[...new Set((Array.isArray(body.item_keys)?body.item_keys:[]).map(v=>String(v||'').trim()).filter(Boolean))].slice(0,500);
    if(!itemKeys.length) return json({ok:true,read_count:0});
    const statements=itemKeys.map(itemKey=>env.DB.prepare(`INSERT INTO dashboard_attention_reads(client_id,user_id,attention_key,item_key,read_at) VALUES(?1,?2,?3,?4,CURRENT_TIMESTAMP) ON CONFLICT(client_id,user_id,attention_key,item_key) DO UPDATE SET read_at=CURRENT_TIMESTAMP`).bind(clientId,Number(auth.user.id),key,itemKey));
    await env.DB.batch(statements);
    return json({ok:true,read_count:itemKeys.length});
  }

  if (path === '/api/employees' && method === 'GET') {
    await ensureV100P3Ready(env.DB);
    const result = await env.DB.prepare(`
      SELECT e.*, d.name AS department_name, p.name AS position_name,
             (SELECT COUNT(*) FROM employee_documents ed WHERE ed.client_id=e.client_id AND ed.employee_id=e.id) AS document_count,
             (SELECT COUNT(*) FROM employee_documents ed WHERE ed.client_id=e.client_id AND ed.employee_id=e.id AND ed.document_type='employment_contract') AS contract_document_count,
             mgr.nickname AS manager_nickname, mgr.first_name AS manager_first_name, mgr.last_name AS manager_last_name,
             ap.nickname AS leave_approver_nickname, ap.first_name AS leave_approver_first_name, ap.last_name AS leave_approver_last_name,
             pp.base_salary, pp.bank_name, pp.bank_account_name, pp.bank_account_no, pp.social_security_enabled, pp.tax_enabled,
             GROUP_CONCAT(DISTINCT wl.name) AS work_location_names, GROUP_CONCAT(DISTINCT wl.id) AS work_location_ids
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN positions p ON p.id = e.position_id
      LEFT JOIN employees mgr ON mgr.id=e.manager_employee_id
      LEFT JOIN employees ap ON ap.id=e.leave_approver_employee_id
      LEFT JOIN employee_payroll_profiles pp ON pp.employee_id=e.id AND pp.client_id=e.client_id
      LEFT JOIN employee_work_locations ewl ON ewl.employee_id=e.id
      LEFT JOIN work_locations wl ON wl.id=ewl.location_id AND wl.is_active=1
      WHERE e.client_id = ?1
      GROUP BY e.id
      ORDER BY e.status = 'active' DESC, e.first_name ASC
    `).bind(clientId).all();
    return json({ data: result.results });
  }

  if (path === '/api/employees' && method === 'POST') {
    const body = await safeJson(request);
    const required = ['first_name', 'last_name', 'start_date'];
    for (const key of required) if (!body[key]) return json({ error: `Missing ${key}` }, 400);
    const employeeCode = String(body.employee_code || '').trim() || await generateEmployeeCode(env.DB, clientId);
    const departmentId = body.department_id ? Number(body.department_id) : null;
    const positionId = body.position_id ? Number(body.position_id) : null;
    if(departmentId){const d=await env.DB.prepare('SELECT id FROM departments WHERE id=?1 AND client_id=?2').bind(departmentId,clientId).first();if(!d)return json({error:'ไม่พบแผนกนี้ในบริษัท'},400);}
    if(positionId){const p=await env.DB.prepare('SELECT id FROM positions WHERE id=?1 AND client_id=?2').bind(positionId,clientId).first();if(!p)return json({error:'ไม่พบตำแหน่งนี้ในบริษัท'},400);}
    await assertSeatCapacity(env.DB,clientId,1);

    const result = await env.DB.prepare(`
      INSERT INTO employees (
        client_id, employee_code, first_name, last_name, nickname, email, phone,
        birth_date, start_date, probation_end_date, contract_end_date,
        contract_type, contract_number, contract_start_date, contract_signed_date,
        department_id, position_id, employment_type, status, people_status
      ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,'active',?19)
    `).bind(
      clientId, employeeCode, body.first_name, body.last_name, body.nickname || null,
      body.email || null, body.phone || null, body.birth_date || null, body.start_date,
      body.probation_end_date || null, body.contract_end_date || null,
      body.contract_type || null, body.contract_number || null, body.contract_start_date || body.start_date || null, body.contract_signed_date || null,
      departmentId, positionId, body.employment_type || 'full_time',
      body.people_status || (body.probation_end_date ? 'probation' : 'employee')
    ).run();

    const newEmployeeId = Number(result.meta.last_row_id);
    if (body.national_id) await env.DB.prepare('UPDATE employees SET national_id=?1 WHERE id=?2 AND client_id=?3').bind(String(body.national_id).trim() || null,newEmployeeId,clientId).run();
    if (['bank_name','bank_account_name','bank_account_no','base_salary'].some(key => body[key] != null && body[key] !== '')) {
      await ensureV100P3Ready(env.DB);
      await env.DB.prepare(`INSERT INTO employee_payroll_profiles (client_id,employee_id,base_salary,social_security_enabled,tax_enabled,personal_allowance,extra_annual_deductions,bank_name,bank_account_name,bank_account_no,effective_from)
        VALUES (?1,?2,?3,1,1,60000,0,?4,?5,?6,?7)
        ON CONFLICT(employee_id) DO UPDATE SET base_salary=excluded.base_salary,bank_name=excluded.bank_name,bank_account_name=excluded.bank_account_name,bank_account_no=excluded.bank_account_no,updated_at=CURRENT_TIMESTAMP`)
        .bind(clientId,newEmployeeId,Math.max(0,Number(body.base_salary||0)),body.bank_name||null,body.bank_account_name||null,body.bank_account_no||null,body.contract_start_date||body.start_date).run();
    }
    await audit(env.DB, clientId, 'user', String(auth.user.id), 'employee.create', 'employee', String(newEmployeeId), { ...body, employee_code: employeeCode });
    await autoAssignLearningForEmployee(env.DB, clientId, newEmployeeId, Number(auth.user.id));
    return json({ ok: true, id: newEmployeeId }, 201);
  }

  const employeeManageMatch = path.match(/^\/api\/employees\/(\d+)$/);
  if (employeeManageMatch && method === 'PATCH') {
    if (!canManagePeopleAdmin(auth.role)) return json({ error: 'ไม่มีสิทธิ์แก้ไขพนักงาน' }, 403);
    const employeeId = Number(employeeManageMatch[1]);
    const existing = await env.DB.prepare('SELECT * FROM employees WHERE id=?1 AND client_id=?2').bind(employeeId, clientId).first();
    if (!existing) return json({ error: 'ไม่พบพนักงาน' }, 404);
    const body = await safeJson(request);
    const firstName = String(body.first_name ?? existing.first_name ?? '').trim();
    const lastName = String(body.last_name ?? existing.last_name ?? '').trim();
    const startDate = String(body.start_date ?? existing.start_date ?? '').trim();
    if (!firstName || !lastName || !startDate) return json({ error: 'กรุณากรอกชื่อ นามสกุล และวันเริ่มงานให้ครบ' }, 400);
    const employeeCode = String(body.employee_code ?? existing.employee_code ?? '').trim();
    if (!employeeCode) return json({ error: 'รหัสพนักงานต้องไม่ว่าง' }, 400);
    const duplicate = await env.DB.prepare('SELECT id FROM employees WHERE client_id=?1 AND employee_code=?2 AND id<>?3').bind(clientId, employeeCode, employeeId).first();
    if (duplicate) return json({ error: 'รหัสพนักงานนี้ถูกใช้แล้ว' }, 409);
    const departmentId = body.department_id ? Number(body.department_id) : null;
    const positionId = body.position_id ? Number(body.position_id) : null;
    if (departmentId) {
      const d = await env.DB.prepare('SELECT id FROM departments WHERE id=?1 AND client_id=?2').bind(departmentId, clientId).first();
      if (!d) return json({ error: 'ไม่พบแผนกนี้ในบริษัท' }, 400);
    }
    if (positionId) {
      const pos = await env.DB.prepare('SELECT id FROM positions WHERE id=?1 AND client_id=?2').bind(positionId, clientId).first();
      if (!pos) return json({ error: 'ไม่พบตำแหน่งนี้ในบริษัท' }, 400);
    }
    await env.DB.prepare(`UPDATE employees SET
      employee_code=?1, nickname=?2, first_name=?3, last_name=?4, email=?5, phone=?6,
      birth_date=?7, start_date=?8, probation_end_date=?9, contract_end_date=?10,
      department_id=?11, position_id=?12, national_id=?13,
      contract_type=?14, contract_number=?15, contract_start_date=?16, contract_signed_date=?17,
      updated_at=CURRENT_TIMESTAMP
      WHERE id=?18 AND client_id=?19`).bind(
        employeeCode, body.nickname || null, firstName, lastName, body.email || null, body.phone || null,
        body.birth_date || null, startDate, body.probation_end_date || null, body.contract_end_date || null,
        departmentId, positionId, body.national_id || null,
        body.contract_type || null, body.contract_number || null, body.contract_start_date || startDate || null, body.contract_signed_date || null,
        employeeId, clientId
      ).run();
    if (['bank_name','bank_account_name','bank_account_no','base_salary'].some(key => Object.prototype.hasOwnProperty.call(body,key))) {
      const currentPayroll = await env.DB.prepare('SELECT * FROM employee_payroll_profiles WHERE employee_id=?1 AND client_id=?2').bind(employeeId,clientId).first();
      const baseSalary = body.base_salary === '' || body.base_salary == null ? Number(currentPayroll?.base_salary || 0) : Math.max(0, Number(body.base_salary || 0));
      await env.DB.prepare(`INSERT INTO employee_payroll_profiles (client_id,employee_id,base_salary,social_security_enabled,tax_enabled,personal_allowance,extra_annual_deductions,monthly_tax_override,bank_name,bank_account_name,bank_account_no,payroll_note,effective_from)
        VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)
        ON CONFLICT(employee_id) DO UPDATE SET base_salary=excluded.base_salary,bank_name=excluded.bank_name,bank_account_name=excluded.bank_account_name,bank_account_no=excluded.bank_account_no,updated_at=CURRENT_TIMESTAMP`)
        .bind(clientId,employeeId,baseSalary,Number(currentPayroll?.social_security_enabled ?? 1),Number(currentPayroll?.tax_enabled ?? 1),Number(currentPayroll?.personal_allowance ?? 60000),Number(currentPayroll?.extra_annual_deductions ?? 0),currentPayroll?.monthly_tax_override ?? null,body.bank_name ?? currentPayroll?.bank_name ?? null,body.bank_account_name ?? currentPayroll?.bank_account_name ?? null,body.bank_account_no ?? currentPayroll?.bank_account_no ?? null,currentPayroll?.payroll_note ?? null,currentPayroll?.effective_from ?? startDate).run();
    }
    await audit(env.DB, clientId, 'user', String(auth.user.id), 'employee.update', 'employee', String(employeeId), { before: existing, after: body });
    return json({ ok: true, id: employeeId });
  }

  if (employeeManageMatch && method === 'DELETE') {
    if (!canManagePeopleAdmin(auth.role)) return json({ error: 'ไม่มีสิทธิ์ลบพนักงาน' }, 403);
    const employeeId = Number(employeeManageMatch[1]);
    const existing = await env.DB.prepare('SELECT id,employee_code,first_name,last_name,nickname,line_user_id FROM employees WHERE id=?1 AND client_id=?2').bind(employeeId, clientId).first();
    if (!existing) return json({ error: 'ไม่พบพนักงาน' }, 404);
    await audit(env.DB, clientId, 'user', String(auth.user.id), 'employee.delete', 'employee', String(employeeId), existing);
    await env.DB.batch([
      env.DB.prepare('UPDATE employees SET manager_employee_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE client_id=?1 AND manager_employee_id=?2').bind(clientId, employeeId),
      env.DB.prepare('UPDATE employees SET leave_approver_employee_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE client_id=?1 AND leave_approver_employee_id=?2').bind(clientId, employeeId),
      env.DB.prepare('UPDATE departments SET manager_employee_id=NULL WHERE client_id=?1 AND manager_employee_id=?2').bind(clientId, employeeId),
      env.DB.prepare("UPDATE leave_requests SET approver_employee_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE client_id=?1 AND approver_employee_id=?2 AND status='pending'").bind(clientId, employeeId),
    ]);
    await env.DB.prepare('DELETE FROM employees WHERE id=?1 AND client_id=?2').bind(employeeId, clientId).run();
    return json({ ok: true, deleted_id: employeeId });
  }


  const employeeDocumentsMatch = path.match(/^\/api\/employees\/(\d+)\/documents$/);
  if (employeeDocumentsMatch && method === 'GET') {
    if (!canManagePeopleAdmin(auth.role) && !canManagePayroll(auth.role)) return json({ error: 'ไม่มีสิทธิ์ดูเอกสารพนักงาน' }, 403);
    await ensureV100P3Ready(env.DB);
    const employeeId = Number(employeeDocumentsMatch[1]);
    const employee = await env.DB.prepare('SELECT id,employee_code,first_name,last_name,nickname FROM employees WHERE id=?1 AND client_id=?2').bind(employeeId,clientId).first();
    if (!employee) return json({ error: 'ไม่พบพนักงาน' }, 404);
    const rows = await env.DB.prepare(`SELECT id,document_type,title,file_name,storage_provider,drive_url,content_type,document_date,expires_at,visibility,note,created_at FROM employee_documents WHERE client_id=?1 AND employee_id=?2 ORDER BY created_at DESC`).bind(clientId,employeeId).all();
    return json({ employee, data: rows.results || [] });
  }

  if (employeeDocumentsMatch && method === 'POST') {
    if (!canManagePeopleAdmin(auth.role)) return json({ error: 'ไม่มีสิทธิ์เพิ่มเอกสารพนักงาน' }, 403);
    await ensureV100P3Ready(env.DB);
    const employeeId = Number(employeeDocumentsMatch[1]);
    const employee = await env.DB.prepare('SELECT id,employee_code,first_name,last_name,nickname FROM employees WHERE id=?1 AND client_id=?2').bind(employeeId,clientId).first();
    if (!employee) return json({ error: 'ไม่พบพนักงาน' }, 404);
    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file.arrayBuffer !== 'function' || !file.name) return json({ error: 'กรุณาเลือกไฟล์' }, 400);
    if (Number(file.size || 0) > 10 * 1024 * 1024) return json({ error: 'ไฟล์ต้องไม่เกิน 10 MB' }, 413);
    const allowedTypes = new Set(['employment_contract','id_card_copy','bank_book_copy','social_security','tax_document','education_certificate','other']);
    const documentType = allowedTypes.has(String(form.get('document_type') || '')) ? String(form.get('document_type')) : 'other';
    const labels = {employment_contract:'สัญญาจ้างงาน',id_card_copy:'สำเนาบัตรประชาชน',bank_book_copy:'หน้าสมุดบัญชี',social_security:'เอกสารประกันสังคม',tax_document:'เอกสารภาษี',education_certificate:'วุฒิการศึกษา',other:'เอกสารพนักงาน'};
    const title = String(form.get('title') || '').trim() || labels[documentType] || 'เอกสารพนักงาน';
    const documentDate = String(form.get('document_date') || '').trim() || null;
    const expiresAt = String(form.get('expires_at') || '').trim() || null;
    const note = String(form.get('note') || '').trim() || null;
    const visibility = ['employee','hr_only','manager'].includes(String(form.get('visibility'))) ? String(form.get('visibility')) : 'hr_only';
    const workspace = await env.DB.prepare(`SELECT * FROM google_workspace_integrations WHERE client_id=?1 AND status='connected'`).bind(clientId).first();
    if (!workspace?.drive_folder_id) return json({ error: 'กรุณาเชื่อม Google Drive ก่อนอัปโหลดเอกสารพนักงาน' }, 409);
    const accessToken = await getWorkspaceGoogleAccessToken(env,workspace);
    const rootFolder = await ensureDriveChildFolder(accessToken,workspace.drive_folder_id,'Employee Documents');
    const empFolder = await ensureDriveChildFolder(accessToken,rootFolder,`${employee.employee_code} - ${employee.nickname || employee.first_name}`);
    const privateFolder = await ensureDriveChildFolder(accessToken,empFolder,'HR & Contracts');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const uploaded = await uploadGoogleDriveFile(accessToken,{folderId:privateFolder,fileName:file.name,contentType:file.type || 'application/octet-stream',bytes});
    const result = await env.DB.prepare(`INSERT INTO employee_documents (client_id,employee_id,document_type,title,file_name,storage_provider,drive_file_id,drive_url,content_type,document_date,expires_at,visibility,note,created_by_user_id) VALUES (?1,?2,?3,?4,?5,'google_drive',?6,?7,?8,?9,?10,?11,?12,?13)`).bind(clientId,employeeId,documentType,title,file.name,uploaded.id,uploaded.webViewLink || null,file.type || 'application/octet-stream',documentDate,expiresAt,visibility,note,Number(auth.user.id)).run();
    await safeAudit(env.DB,clientId,'user',String(auth.user.id),'employee.document.upload','employee',String(employeeId),{document_type:documentType,file_name:file.name});
    return json({ ok:true, id:Number(result.meta.last_row_id), drive_url:uploaded.webViewLink || null },201);
  }

  const employeeDocumentDeleteMatch = path.match(/^\/api\/employee-documents\/(\d+)$/);
  if (employeeDocumentDeleteMatch && method === 'DELETE') {
    if (!canManagePeopleAdmin(auth.role)) return json({ error: 'ไม่มีสิทธิ์ลบเอกสารพนักงาน' }, 403);
    await ensureV100P3Ready(env.DB);
    const id = Number(employeeDocumentDeleteMatch[1]);
    const row = await env.DB.prepare('SELECT * FROM employee_documents WHERE id=?1 AND client_id=?2').bind(id,clientId).first();
    if (!row) return json({ error:'ไม่พบเอกสาร' },404);
    await env.DB.prepare('DELETE FROM employee_documents WHERE id=?1 AND client_id=?2').bind(id,clientId).run();
    await safeAudit(env.DB,clientId,'user',String(auth.user.id),'employee.document.delete','employee_document',String(id),{employee_id:row.employee_id,file_name:row.file_name});
    return json({ok:true});
  }

  const employeeLinkMatch = path.match(/^\/api\/employees\/(\d+)\/line-link-code$/);
  if (employeeLinkMatch && method === 'POST') {
    const employeeId = Number(employeeLinkMatch[1]);
    const employee = await env.DB.prepare('SELECT id, client_id, line_user_id FROM employees WHERE id = ?1').bind(employeeId).first();
    if (!employee || Number(employee.client_id) !== clientId) return json({ error: 'Employee not found' }, 404);
    if (employee.line_user_id) return json({ error: 'Employee already linked to LINE' }, 409);

    const token = randomDigits(6);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await env.DB.prepare(`
      INSERT INTO line_link_tokens (token, employee_id, expires_at)
      VALUES (?1, ?2, ?3)
      ON CONFLICT(token) DO UPDATE SET employee_id = excluded.employee_id, expires_at = excluded.expires_at, used_at = NULL
    `).bind(token, employeeId, expiresAt).run();
    return json({ ok: true, token, expires_at: expiresAt, instruction: `ส่งข้อความ LINK ${token} ไปที่ LINE OA` });
  }

  if (path === '/api/lookups' && method === 'GET') {
    const [departments, positions, locations] = await env.DB.batch([
      env.DB.prepare('SELECT id,name,code FROM departments WHERE client_id=?1 ORDER BY name').bind(clientId),
      env.DB.prepare('SELECT id,department_id,name FROM positions WHERE client_id=?1 ORDER BY name').bind(clientId),
      env.DB.prepare('SELECT id,name,address,latitude,longitude,radius_m,is_active FROM work_locations WHERE client_id=?1 AND is_active=1 ORDER BY name').bind(clientId),
    ]);
    return json({
      departments: departments.results || [],
      positions: positions.results || [],
      locations: locations.results || [],
    });
  }

  if (path === '/api/invites' && method === 'GET') {
    const result = await env.DB.prepare(`
      SELECT i.id, i.token_value, i.token_hint, i.employee_role, i.start_date, i.expires_at, i.max_uses, i.used_count, i.status, i.created_at,
             d.name AS department_name, p.name AS position_name,
             GROUP_CONCAT(DISTINCT wl.name) AS location_names
      FROM employee_invites i
      LEFT JOIN departments d ON d.id=i.department_id
      LEFT JOIN positions p ON p.id=i.position_id
      LEFT JOIN employee_invite_locations eil ON eil.invite_id=i.id
      LEFT JOIN work_locations wl ON wl.id=eil.location_id
      WHERE i.client_id=?1
      GROUP BY i.id
      ORDER BY i.created_at DESC
      LIMIT 100
    `).bind(clientId).all();
    return json({ data: (result.results || []).map(row => ({
      ...row,
      invite_url: row.token_value ? `${appOrigin(request, env)}/invite.html?token=${encodeURIComponent(row.token_value)}` : null,
      token_value: undefined,
    })) });
  }

  if (path === '/api/invites' && method === 'POST') {
    if (!canManagePeople(auth.role)) return json({ error: 'ไม่มีสิทธิ์สร้างลิงก์เชิญ' }, 403);
    const body = await safeJson(request);
    const maxUses = Math.max(1, Math.min(100, Number(body.max_uses || 1)));
    const expiresDays = Math.max(1, Math.min(30, Number(body.expires_days || 7)));
    const departmentId = body.department_id ? Number(body.department_id) : null;
    const positionId = body.position_id ? Number(body.position_id) : null;
    const startDate = body.start_date || null;
    const locationIds = [...new Set((Array.isArray(body.location_ids) ? body.location_ids : []).map(Number).filter(Number.isFinite))];

    if (departmentId) {
      const row = await env.DB.prepare('SELECT id FROM departments WHERE id=?1 AND client_id=?2').bind(departmentId, clientId).first();
      if (!row) return json({ error: 'แผนกไม่อยู่ในบริษัทนี้' }, 400);
    }
    if (positionId) {
      const row = await env.DB.prepare('SELECT id FROM positions WHERE id=?1 AND client_id=?2').bind(positionId, clientId).first();
      if (!row) return json({ error: 'ตำแหน่งไม่อยู่ในบริษัทนี้' }, 400);
    }
    for (const locationId of locationIds) {
      const row = await env.DB.prepare('SELECT id FROM work_locations WHERE id=?1 AND client_id=?2 AND is_active=1').bind(locationId, clientId).first();
      if (!row) return json({ error: 'มี Work Location ที่ไม่อยู่ในบริษัทนี้' }, 400);
    }

    const token = randomToken(24);
    const tokenHash = await sha256Hex(token);
    const expiresAt = new Date(Date.now() + expiresDays * 86400000).toISOString();
    const result = await env.DB.prepare(`
      INSERT INTO employee_invites (client_id,token_hash,token_value,token_hint,department_id,position_id,employee_role,start_date,expires_at,max_uses,used_count,status,created_by_user_id)
      VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,0,'active',?11)
    `).bind(clientId, tokenHash, token, token.slice(-6), departmentId, positionId, body.employee_role || 'employee', startDate, expiresAt, maxUses, Number(auth.user.id)).run();
    const inviteId = Number(result.meta.last_row_id);
    for (const locationId of locationIds) {
      await env.DB.prepare('INSERT OR IGNORE INTO employee_invite_locations (invite_id,location_id) VALUES (?1,?2)').bind(inviteId, locationId).run();
    }
    await safeAudit(env.DB, clientId, 'user', String(auth.user.id), 'employee_invite.create', 'employee_invite', String(inviteId), { max_uses: maxUses, location_ids: locationIds });
    return json({
      ok: true,
      id: inviteId,
      invite_url: `${appOrigin(request, env)}/invite.html?token=${encodeURIComponent(token)}`,
      expires_at: expiresAt,
      max_uses: maxUses,
    }, 201);
  }

  const revokeInviteMatch = path.match(/^\/api\/invites\/(\d+)\/revoke$/);
  if (revokeInviteMatch && method === 'POST') {
    if (!canManagePeople(auth.role)) return json({ error: 'ไม่มีสิทธิ์ยกเลิกลิงก์เชิญ' }, 403);
    const id = Number(revokeInviteMatch[1]);
    await env.DB.prepare("UPDATE employee_invites SET status='revoked',updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND client_id=?2").bind(id, clientId).run();
    return json({ ok: true });
  }

  if (path === '/api/work-locations' && method === 'GET') {
    const result = await env.DB.prepare('SELECT * FROM work_locations WHERE client_id=?1 ORDER BY is_active DESC,name').bind(clientId).all();
    return json({ data: result.results || [] });
  }

  if (path === '/api/work-locations' && method === 'POST') {
    if (!canManagePeople(auth.role)) return json({ error: 'ไม่มีสิทธิ์จัดการ Work Location' }, 403);
    const body = await safeJson(request);
    const name = String(body.name || '').trim();
    const lat = Number(body.latitude);
    const lng = Number(body.longitude);
    const radius = Math.max(30, Math.min(5000, Number(body.radius_m || 150)));
    if (name.length < 2 || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return json({ error: 'กรุณาใส่ชื่อและพิกัด Work Location ให้ครบ' }, 400);
    }
    const result = await env.DB.prepare(`INSERT INTO work_locations (client_id,name,address,latitude,longitude,radius_m,is_active) VALUES (?1,?2,?3,?4,?5,?6,1)`)
      .bind(clientId, name, body.address || null, lat, lng, radius).run();
    return json({ ok: true, id: result.meta.last_row_id }, 201);
  }

  const locationMatch = path.match(/^\/api\/work-locations\/(\d+)$/);
  if (locationMatch && method === 'PATCH') {
    if (!canManagePeople(auth.role)) return json({ error: 'ไม่มีสิทธิ์จัดการ Work Location' }, 403);
    const id = Number(locationMatch[1]);
    const body = await safeJson(request);
    const existing = await env.DB.prepare('SELECT * FROM work_locations WHERE id=?1 AND client_id=?2').bind(id, clientId).first();
    if (!existing) return json({ error: 'ไม่พบ Work Location' }, 404);
    await env.DB.prepare(`UPDATE work_locations SET name=?1,address=?2,latitude=?3,longitude=?4,radius_m=?5,is_active=?6,updated_at=CURRENT_TIMESTAMP WHERE id=?7 AND client_id=?8`)
      .bind(
        String(body.name ?? existing.name).trim(),
        body.address ?? existing.address,
        Number(body.latitude ?? existing.latitude),
        Number(body.longitude ?? existing.longitude),
        Math.max(30, Math.min(5000, Number(body.radius_m ?? existing.radius_m))),
        body.is_active == null ? Number(existing.is_active) : (body.is_active ? 1 : 0),
        id, clientId
      ).run();
    return json({ ok: true });
  }

  if (path === '/api/candidates' && method === 'GET') {
    const result = await env.DB.prepare(`
      SELECT * FROM candidates WHERE client_id = ?1
      ORDER BY CASE stage
        WHEN 'new' THEN 1 WHEN 'screening' THEN 2 WHEN 'hr_interview' THEN 3
        WHEN 'manager_interview' THEN 4 WHEN 'assignment' THEN 5 WHEN 'offer' THEN 6
        WHEN 'hired' THEN 7 ELSE 8 END, updated_at DESC
    `).bind(clientId).all();
    return json({ data: result.results });
  }

  if (path === '/api/candidates' && method === 'POST') {
    const body = await safeJson(request);
    if (!body.first_name || !body.last_name || !body.position_name) return json({ error: 'Missing candidate name or position' }, 400);
    const result = await env.DB.prepare(`
      INSERT INTO candidates (
        client_id, first_name, last_name, nickname, email, phone, position_name,
        source, expected_salary, available_start_date, stage, notes
      ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)
    `).bind(
      clientId, body.first_name, body.last_name, body.nickname || null, body.email || null,
      body.phone || null, body.position_name, body.source || null, body.expected_salary || null,
      body.available_start_date || null, body.stage || 'new', body.notes || null
    ).run();
    return json({ ok: true, id: result.meta.last_row_id }, 201);
  }

  const candidateStageMatch = path.match(/^\/api\/candidates\/(\d+)\/stage$/);
  if (candidateStageMatch && method === 'PATCH') {
    const body = await safeJson(request);
    const allowed = ['new','screening','hr_interview','manager_interview','assignment','offer','hired','rejected'];
    if (!allowed.includes(body.stage)) return json({ error: 'Invalid stage' }, 400);
    await env.DB.prepare(`
      UPDATE candidates SET stage = ?1, last_activity_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?2 AND client_id = ?3
    `).bind(body.stage, Number(candidateStageMatch[1]), clientId).run();
    return json({ ok: true });
  }

  if (path === '/api/approver-access' && method === 'GET') {
    await ensureV061Ready(env.DB);
    if (!canManageApproverAccess(auth.role)) return json({ error: 'ไม่มีสิทธิ์ดูหรือจัดการสิทธิ์ผู้อนุมัติ' }, 403);
    const rows = await env.DB.prepare(`
      SELECT e.id,e.employee_code,e.first_name,e.last_name,e.nickname,e.status,e.line_user_id,e.line_display_name,e.line_picture_url,
             d.name AS department_name, GROUP_CONCAT(ep.permission_key) AS permission_keys
      FROM employees e
      LEFT JOIN departments d ON d.id=e.department_id
      LEFT JOIN employee_permissions ep ON ep.employee_id=e.id AND ep.client_id=e.client_id
      WHERE e.client_id=?1 AND e.status='active'
      GROUP BY e.id
      ORDER BY e.first_name,e.last_name
    `).bind(clientId).all();
    return json({ data:(rows.results||[]).map(row=>({ ...row, permissions:String(row.permission_keys||'').split(',').filter(Boolean) })), catalog:approverPermissionCatalog() });
  }

  const approverAccessMatch = path.match(/^\/api\/approver-access\/(\d+)$/);
  if (approverAccessMatch && method === 'PUT') {
    await ensureV061Ready(env.DB);
    if (!canManageApproverAccess(auth.role)) return json({ error: 'ไม่มีสิทธิ์จัดการสิทธิ์ผู้อนุมัติ' }, 403);
    const employeeId=Number(approverAccessMatch[1]);
    const employee=await getEmployeeForClient(env.DB,employeeId,clientId);
    if(!employee) return json({error:'ไม่พบพนักงาน'},404);
    const body=await safeJson(request);
    const requested=[...new Set((Array.isArray(body.permissions)?body.permissions:[]).map(String).filter(key=>APPROVER_PERMISSION_KEYS.has(key)))];
    const previous=(await env.DB.prepare('SELECT permission_key FROM employee_permissions WHERE client_id=?1 AND employee_id=?2').bind(clientId,employeeId).all()).results||[];
    const previousKeys=new Set(previous.map(row=>row.permission_key));
    const statements=[env.DB.prepare('DELETE FROM employee_permissions WHERE client_id=?1 AND employee_id=?2').bind(clientId,employeeId)];
    for(const key of requested) statements.push(env.DB.prepare('INSERT INTO employee_permissions (client_id,employee_id,permission_key,granted_by_user_id) VALUES (?1,?2,?3,?4)').bind(clientId,employeeId,key,Number(auth.user.id)));
    await env.DB.batch(statements);
    if(previousKeys.has('leave.approve')&&!requested.includes('leave.approve')){
      await env.DB.batch([
        env.DB.prepare('UPDATE employees SET leave_approver_employee_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE client_id=?1 AND leave_approver_employee_id=?2').bind(clientId,employeeId),
        env.DB.prepare("UPDATE leave_requests SET approver_employee_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE client_id=?1 AND approver_employee_id=?2 AND status='pending'").bind(clientId,employeeId)
      ]);
    }
    await safeAudit(env.DB,clientId,'user',String(auth.user.id),'approver.permissions.update','employee',String(employeeId),{permissions:requested});
    return json({ok:true,employee_id:employeeId,permissions:requested});
  }

  if (path === '/api/leave-policies' && method === 'GET') {
    await ensureDefaultLeavePolicies(env.DB, clientId);
    const result = await env.DB.prepare(`SELECT * FROM leave_policies WHERE client_id=?1 ORDER BY sort_order,name`).bind(clientId).all();
    return json({ data: result.results || [] });
  }

  if (path === '/api/leave-policies' && method === 'POST') {
    if (!canManagePeople(auth.role)) return json({ error: 'ไม่มีสิทธิ์จัดการนโยบายลา' }, 403);
    const body = await safeJson(request);
    const name = String(body.name || '').trim();
    const code = slugCode(body.code || name);
    if (name.length < 2 || !code) return json({ error: 'กรุณาใส่ชื่อประเภทลา' }, 400);
    const result = await env.DB.prepare(`
      INSERT INTO leave_policies (client_id,code,name,default_entitlement_days,is_unlimited,requires_reason,evidence_required_after_days,notice_days,allow_negative,is_active,sort_order,available_during_probation)
      VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,1,?10,?11)
    `).bind(clientId, code, name, num(body.default_entitlement_days,0), body.is_unlimited?1:0, body.requires_reason===false?0:1,
      nullableNum(body.evidence_required_after_days), Math.max(0,Math.floor(num(body.notice_days,0))), body.allow_negative?1:0, Math.floor(num(body.sort_order,100)), body.available_during_probation?1:0).run();
    return json({ ok:true, id:result.meta.last_row_id },201);
  }

  const leavePolicyMatch = path.match(/^\/api\/leave-policies\/(\d+)$/);
  if (leavePolicyMatch && method === 'PATCH') {
    if (!canManagePeople(auth.role)) return json({ error: 'ไม่มีสิทธิ์จัดการนโยบายลา' }, 403);
    const id=Number(leavePolicyMatch[1]);
    const existing=await env.DB.prepare('SELECT * FROM leave_policies WHERE id=?1 AND client_id=?2').bind(id,clientId).first();
    if(!existing) return json({error:'ไม่พบนโยบายลา'},404);
    const body=await safeJson(request);
    await env.DB.prepare(`UPDATE leave_policies SET name=?1,default_entitlement_days=?2,is_unlimited=?3,requires_reason=?4,evidence_required_after_days=?5,notice_days=?6,allow_negative=?7,is_active=?8,sort_order=?9,available_during_probation=?10,updated_at=CURRENT_TIMESTAMP WHERE id=?11 AND client_id=?12`)
      .bind(String(body.name ?? existing.name).trim(),num(body.default_entitlement_days,existing.default_entitlement_days),body.is_unlimited==null?Number(existing.is_unlimited):(body.is_unlimited?1:0),body.requires_reason==null?Number(existing.requires_reason):(body.requires_reason?1:0),body.evidence_required_after_days===undefined?existing.evidence_required_after_days:nullableNum(body.evidence_required_after_days),Math.max(0,Math.floor(num(body.notice_days,existing.notice_days))),body.allow_negative==null?Number(existing.allow_negative):(body.allow_negative?1:0),body.is_active==null?Number(existing.is_active):(body.is_active?1:0),Math.floor(num(body.sort_order,existing.sort_order)),body.available_during_probation==null?Number(existing.available_during_probation||0):(body.available_during_probation?1:0),id,clientId).run();
    return json({ok:true});
  }

  const employeeLeaveProfileMatch = path.match(/^\/api\/employees\/(\d+)\/leave-profile$/);
  if (employeeLeaveProfileMatch && method === 'GET') {
    const employeeId=Number(employeeLeaveProfileMatch[1]);
    const employee=await getEmployeeForClient(env.DB,employeeId,clientId);
    if(!employee) return json({error:'ไม่พบพนักงาน'},404);
    const year=Math.floor(num(url.searchParams.get('year'), new Date().getFullYear()));
    return json(await getEmployeeLeaveProfile(env.DB,employeeId,clientId,year));
  }
  if (employeeLeaveProfileMatch && method === 'PUT') {
    if (!canManagePeople(auth.role)) return json({ error: 'ไม่มีสิทธิ์จัดการสิทธิ์ลา' }, 403);
    const employeeId=Number(employeeLeaveProfileMatch[1]);
    const employee=await getEmployeeForClient(env.DB,employeeId,clientId);
    if(!employee) return json({error:'ไม่พบพนักงาน'},404);
    const body=await safeJson(request);
    const approverId=body.leave_approver_employee_id ? Number(body.leave_approver_employee_id) : null;
    if(approverId){ const approver=await getEmployeeForClient(env.DB,approverId,clientId); if(!approver) return json({error:'ผู้อนุมัติไม่อยู่ในบริษัทนี้'},400); if(!await employeeHasPermission(env.DB,clientId,approverId,'leave.approve')) return json({error:'พนักงานคนนี้ยังไม่มีสิทธิ์ “อนุมัติการลา” กรุณาเพิ่มสิทธิ์ผู้อนุมัติก่อน'},409); }
    let leaveAccessOverride = body.leave_access_override === null || body.leave_access_override === '' || body.leave_access_override === undefined ? null : (Number(body.leave_access_override) ? 1 : 0);
    let autoUnlocked=false;
    // If HR explicitly changes a per-person entitlement, that is an intentional override.
    // Do not leave the employee silently locked by the company probation rule.
    if(leaveAccessOverride===null && Array.isArray(body.entitlements) && body.entitlements.length){
      const policyRows=(await env.DB.prepare('SELECT id,default_entitlement_days FROM leave_policies WHERE client_id=?1').bind(clientId).all()).results||[];
      const policyMap=new Map(policyRows.map(row=>[Number(row.id),row]));
      const hasManualEntitlement=body.entitlements.some(item=>{
        const policy=policyMap.get(Number(item.policy_id)); if(!policy)return false;
        return Math.abs(num(item.entitlement_days,0)-num(policy.default_entitlement_days,0))>0.0001 || Math.abs(num(item.adjustment_days,0))>0.0001;
      });
      if(hasManualEntitlement){leaveAccessOverride=1;autoUnlocked=true;}
    }
    await env.DB.prepare('UPDATE employees SET leave_approver_employee_id=?1,leave_access_override=?2,updated_at=CURRENT_TIMESTAMP WHERE id=?3 AND client_id=?4').bind(approverId,leaveAccessOverride,employeeId,clientId).run();
    if(approverId){
      const waiting=(await env.DB.prepare("SELECT id FROM leave_requests WHERE employee_id=?1 AND client_id=?2 AND status='pending' AND approver_employee_id IS NULL").bind(employeeId,clientId).all()).results||[];
      await env.DB.prepare("UPDATE leave_requests SET approver_employee_id=?1,updated_at=CURRENT_TIMESTAMP WHERE employee_id=?2 AND client_id=?3 AND status='pending' AND approver_employee_id IS NULL").bind(approverId,employeeId,clientId).run();
      for(const requestRow of waiting) await notifyLeaveApprover(env,Number(requestRow.id));
    }
    const year=Math.floor(num(body.year,new Date().getFullYear()));
    for(const item of Array.isArray(body.entitlements)?body.entitlements:[]){
      const policyId=Number(item.policy_id); if(!policyId) continue;
      const policy=await env.DB.prepare('SELECT id FROM leave_policies WHERE id=?1 AND client_id=?2').bind(policyId,clientId).first(); if(!policy) continue;
      await env.DB.prepare(`INSERT INTO employee_leave_entitlements (client_id,employee_id,leave_policy_id,year,entitlement_days,adjustment_days,note,updated_by_user_id) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)
        ON CONFLICT(employee_id,leave_policy_id,year) DO UPDATE SET entitlement_days=excluded.entitlement_days,adjustment_days=excluded.adjustment_days,note=excluded.note,updated_by_user_id=excluded.updated_by_user_id,updated_at=CURRENT_TIMESTAMP`)
        .bind(clientId,employeeId,policyId,year,num(item.entitlement_days,0),num(item.adjustment_days,0),item.note||null,Number(auth.user.id)).run();
    }
    await safeAudit(env.DB,clientId,'user',String(auth.user.id),'leave.entitlement.update','employee',String(employeeId),{year,approver_id:approverId,auto_unlocked:autoUnlocked});
    return json({ok:true,auto_unlocked:autoUnlocked,profile:await getEmployeeLeaveProfile(env.DB,employeeId,clientId,year)});
  }

  const evidenceMatch = path.match(/^\/api\/leave-evidence\/(\d+)$/);
  if (evidenceMatch && method === 'GET') {
    await ensureV063Ready(env.DB);
    const row=await env.DB.prepare(`SELECT ev.* FROM leave_request_evidence ev JOIN leave_requests lr ON lr.id=ev.leave_request_id WHERE ev.id=?1 AND ev.client_id=?2`).bind(Number(evidenceMatch[1]),clientId).first();
    if(!row) return json({error:'ไม่พบหลักฐาน'},404);
    return await serveStoredEvidence(env,row,'private, max-age=60');
  }

  // Phase 3 — Payroll + Documents (Thailand)
  if (path === '/api/payroll/overview' && method === 'GET') {
    if (!canManagePayroll(auth.role)) return json({ error: 'เฉพาะ HR/Payroll ที่ดู Payroll ได้' }, 403);
    await ensurePayrollDefaults(env.DB, clientId);
    const [settings, periods, profiles, rules, documents] = await Promise.all([
      env.DB.prepare('SELECT * FROM payroll_settings WHERE client_id=?1').bind(clientId).first(),
      env.DB.prepare(`SELECT * FROM payroll_periods WHERE client_id=?1 ORDER BY period_start DESC,id DESC LIMIT 24`).bind(clientId).all(),
      env.DB.prepare(`SELECT e.id,e.employee_code,e.first_name,e.last_name,e.nickname,e.people_status,e.status,d.name AS department_name,p.name AS position_name,
        pp.base_salary,pp.social_security_enabled,pp.tax_enabled,pp.monthly_tax_override,pp.bank_name,pp.bank_account_name,pp.bank_account_no,pp.effective_from
        FROM employees e LEFT JOIN departments d ON d.id=e.department_id LEFT JOIN positions p ON p.id=e.position_id
        LEFT JOIN employee_payroll_profiles pp ON pp.employee_id=e.id
        WHERE e.client_id=?1 AND e.status='active' ORDER BY e.first_name,e.last_name`).bind(clientId).all(),
      env.DB.prepare(`SELECT * FROM payroll_rule_versions WHERE (client_id=?1 OR client_id IS NULL) ORDER BY rule_key,effective_from DESC`).bind(clientId).all(),
      env.DB.prepare(`SELECT pd.*,e.employee_code,e.first_name,e.last_name,e.nickname,pp.period_key FROM payroll_documents pd JOIN employees e ON e.id=pd.employee_id JOIN payroll_periods pp ON pp.id=pd.period_id WHERE pd.client_id=?1 ORDER BY pd.created_at DESC LIMIT 12`).bind(clientId).all(),
    ]);
    const profileRows=profiles.results||[];
    return json({
      settings,
      periods: periods.results||[],
      profiles: profileRows,
      rules: rules.results||[],
      recent_documents: documents.results||[],
      readiness: { employees:profileRows.length, salary_ready:profileRows.filter(r=>Number(r.base_salary||0)>0).length, bank_ready:profileRows.filter(r=>r.bank_account_no).length }
    });
  }

  if (path === '/api/payroll/settings' && method === 'PATCH') {
    if (!canManagePayroll(auth.role)) return json({ error: 'ไม่มีสิทธิ์แก้ Payroll Settings' }, 403);
    await ensurePayrollDefaults(env.DB,clientId);
    const body=await safeJson(request);
    const current=await env.DB.prepare('SELECT * FROM payroll_settings WHERE client_id=?1').bind(clientId).first();
    const payDay=Math.max(1,Math.min(31,Math.floor(num(body.pay_day,current.pay_day||28))));
    const divisor=Math.max(1,num(body.daily_rate_divisor,current.daily_rate_divisor||30));
    const latePerMinute=Math.max(0,num(body.late_deduction_per_minute,current.late_deduction_per_minute||0));
    await env.DB.prepare(`UPDATE payroll_settings SET pay_day=?1,daily_rate_divisor=?2,absence_deduction_enabled=?3,late_deduction_enabled=?4,late_deduction_per_minute=?5,social_security_enabled=?6,tax_enabled=?7,updated_at=CURRENT_TIMESTAMP WHERE client_id=?8`)
      .bind(payDay,divisor,body.absence_deduction_enabled?1:0,body.late_deduction_enabled?1:0,latePerMinute,body.social_security_enabled===false?0:1,body.tax_enabled===false?0:1,clientId).run();
    await safeAudit(env.DB,clientId,'user',String(auth.user.id),'payroll.settings.update','client',String(clientId),{pay_day:payDay,daily_rate_divisor:divisor});
    return json({ok:true,settings:await env.DB.prepare('SELECT * FROM payroll_settings WHERE client_id=?1').bind(clientId).first()});
  }

  const payrollProfileMatch=path.match(/^\/api\/employees\/(\d+)\/payroll-profile$/);
  if (payrollProfileMatch && method === 'GET') {
    if (!canManagePayroll(auth.role)) return json({error:'ไม่มีสิทธิ์ดูข้อมูลเงินเดือน'},403);
    await ensurePayrollDefaults(env.DB,clientId);
    const employeeId=Number(payrollProfileMatch[1]);
    const employee=await getEmployeeForClient(env.DB,employeeId,clientId); if(!employee)return json({error:'ไม่พบพนักงาน'},404);
    const profile=await env.DB.prepare('SELECT * FROM employee_payroll_profiles WHERE employee_id=?1 AND client_id=?2').bind(employeeId,clientId).first();
    return json({employee:{id:employee.id,employee_code:employee.employee_code,first_name:employee.first_name,last_name:employee.last_name,nickname:employee.nickname,email:employee.email},profile:profile||null});
  }
  if (payrollProfileMatch && method === 'PUT') {
    if (!canManagePayroll(auth.role)) return json({error:'ไม่มีสิทธิ์แก้ข้อมูลเงินเดือน'},403);
    await ensurePayrollDefaults(env.DB,clientId);
    const employeeId=Number(payrollProfileMatch[1]);
    const employee=await getEmployeeForClient(env.DB,employeeId,clientId); if(!employee)return json({error:'ไม่พบพนักงาน'},404);
    const body=await safeJson(request);
    const salary=Math.max(0,num(body.base_salary,0));
    await env.DB.prepare(`INSERT INTO employee_payroll_profiles (client_id,employee_id,base_salary,social_security_enabled,tax_enabled,personal_allowance,extra_annual_deductions,monthly_tax_override,bank_name,bank_account_name,bank_account_no,payroll_note,effective_from)
      VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)
      ON CONFLICT(employee_id) DO UPDATE SET base_salary=excluded.base_salary,social_security_enabled=excluded.social_security_enabled,tax_enabled=excluded.tax_enabled,personal_allowance=excluded.personal_allowance,extra_annual_deductions=excluded.extra_annual_deductions,monthly_tax_override=excluded.monthly_tax_override,bank_name=excluded.bank_name,bank_account_name=excluded.bank_account_name,bank_account_no=excluded.bank_account_no,payroll_note=excluded.payroll_note,effective_from=excluded.effective_from,updated_at=CURRENT_TIMESTAMP`)
      .bind(clientId,employeeId,salary,body.social_security_enabled===false?0:1,body.tax_enabled===false?0:1,Math.max(0,num(body.personal_allowance,60000)),Math.max(0,num(body.extra_annual_deductions,0)),body.monthly_tax_override===''||body.monthly_tax_override==null?null:Math.max(0,num(body.monthly_tax_override,0)),body.bank_name||null,body.bank_account_name||null,body.bank_account_no||null,body.payroll_note||null,body.effective_from||employee.start_date||dateInBangkok()).run();
    await safeAudit(env.DB,clientId,'user',String(auth.user.id),'payroll.profile.update','employee',String(employeeId),{base_salary:salary});
    return json({ok:true,profile:await env.DB.prepare('SELECT * FROM employee_payroll_profiles WHERE employee_id=?1').bind(employeeId).first()});
  }

  if (path === '/api/payroll/periods' && method === 'POST') {
    if (!canManagePayroll(auth.role)) return json({error:'ไม่มีสิทธิ์สร้างรอบเงินเดือน'},403);
    await ensurePayrollDefaults(env.DB,clientId);
    const body=await safeJson(request);
    const periodKey=String(body.period_key||dateInBangkok().slice(0,7));
    if(!/^\d{4}-\d{2}$/.test(periodKey)) return json({error:'รอบเงินเดือนต้องเป็น YYYY-MM'},400);
    const [year,month]=periodKey.split('-').map(Number);
    const periodStart=body.period_start||`${periodKey}-01`;
    const lastDay=new Date(Date.UTC(year,month,0)).getUTCDate();
    const periodEnd=body.period_end||`${periodKey}-${String(lastDay).padStart(2,'0')}`;
    const settings=await env.DB.prepare('SELECT * FROM payroll_settings WHERE client_id=?1').bind(clientId).first();
    const payDay=Math.min(lastDay,Number(settings?.pay_day||28));
    const payDate=body.pay_date||`${periodKey}-${String(payDay).padStart(2,'0')}`;
    try{
      const result=await env.DB.prepare(`INSERT INTO payroll_periods (client_id,period_key,period_start,period_end,pay_date,status,created_by_user_id) VALUES (?1,?2,?3,?4,?5,'draft',?6)`).bind(clientId,periodKey,periodStart,periodEnd,payDate,Number(auth.user.id)).run();
      const id=Number(result.meta.last_row_id);
      await recalculatePayrollPeriod(env,clientId,id);
      return json({ok:true,id,period:await getPayrollPeriodDetail(env.DB,clientId,id)},201);
    }catch(error){ if(/UNIQUE/i.test(String(error?.message||error))) return json({error:'มีรอบเงินเดือนเดือนนี้แล้ว'},409); throw error; }
  }

  const payrollPeriodMatch=path.match(/^\/api\/payroll\/periods\/(\d+)$/);
  if(payrollPeriodMatch && method==='GET'){
    if(!canManagePayroll(auth.role))return json({error:'ไม่มีสิทธิ์ดู Payroll'},403);
    await ensurePayrollDefaults(env.DB,clientId);
    const detail=await getPayrollPeriodDetail(env.DB,clientId,Number(payrollPeriodMatch[1]));
    if(!detail.period)return json({error:'ไม่พบรอบเงินเดือน'},404);
    return json(detail);
  }

  const payrollRecalcMatch=path.match(/^\/api\/payroll\/periods\/(\d+)\/recalculate$/);
  if(payrollRecalcMatch && method==='POST'){
    if(!canManagePayroll(auth.role))return json({error:'ไม่มีสิทธิ์คำนวณ Payroll'},403);
    const id=Number(payrollRecalcMatch[1]); const period=await env.DB.prepare('SELECT * FROM payroll_periods WHERE id=?1 AND client_id=?2').bind(id,clientId).first();
    if(!period)return json({error:'ไม่พบรอบเงินเดือน'},404); if(['locked','published','void'].includes(period.status))return json({error:'รอบนี้ Lock แล้ว ไม่สามารถคำนวณใหม่ได้'},409);
    await recalculatePayrollPeriod(env,clientId,id);
    return json({ok:true,...await getPayrollPeriodDetail(env.DB,clientId,id)});
  }

  const payrollAdjustmentMatch=path.match(/^\/api\/payroll\/periods\/(\d+)\/adjustments$/);
  if(payrollAdjustmentMatch && method==='POST'){
    if(!canManagePayroll(auth.role))return json({error:'ไม่มีสิทธิ์เพิ่มรายการเงินเดือน'},403);
    const periodId=Number(payrollAdjustmentMatch[1]); const period=await env.DB.prepare('SELECT * FROM payroll_periods WHERE id=?1 AND client_id=?2').bind(periodId,clientId).first();
    if(!period)return json({error:'ไม่พบรอบเงินเดือน'},404); if(['locked','published','void'].includes(period.status))return json({error:'รอบนี้ Lock แล้ว'},409);
    const body=await safeJson(request); const employeeId=Number(body.employee_id); const employee=await getEmployeeForClient(env.DB,employeeId,clientId); if(!employee)return json({error:'ไม่พบพนักงาน'},404);
    const adjustmentType=body.adjustment_type==='deduction'?'deduction':'earning'; const amount=Math.max(0,num(body.amount,0)); const category=String(body.category||'other').trim(); if(!amount||!category)return json({error:'กรุณาใส่ประเภทและจำนวนเงิน'},400);
    await env.DB.prepare(`INSERT INTO payroll_adjustments (client_id,period_id,employee_id,adjustment_type,category,amount,taxable,sso_contributable,note,created_by_user_id) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)`).bind(clientId,periodId,employeeId,adjustmentType,category,amount,body.taxable===false?0:1,body.sso_contributable?1:0,body.note||null,Number(auth.user.id)).run();
    await recalculatePayrollPeriod(env,clientId,periodId);
    return json({ok:true,...await getPayrollPeriodDetail(env.DB,clientId,periodId)});
  }

  const payrollAdjustmentDeleteMatch=path.match(/^\/api\/payroll\/adjustments\/(\d+)$/);
  if(payrollAdjustmentDeleteMatch && method==='DELETE'){
    if(!canManagePayroll(auth.role))return json({error:'ไม่มีสิทธิ์ลบรายการเงินเดือน'},403);
    const row=await env.DB.prepare(`SELECT a.*,p.status FROM payroll_adjustments a JOIN payroll_periods p ON p.id=a.period_id WHERE a.id=?1 AND a.client_id=?2`).bind(Number(payrollAdjustmentDeleteMatch[1]),clientId).first();
    if(!row)return json({error:'ไม่พบรายการ'},404); if(['locked','published','void'].includes(row.status))return json({error:'รอบนี้ Lock แล้ว'},409);
    await env.DB.prepare('DELETE FROM payroll_adjustments WHERE id=?1 AND client_id=?2').bind(Number(row.id),clientId).run(); await recalculatePayrollPeriod(env,clientId,Number(row.period_id)); return json({ok:true});
  }

  const payrollReviewMatch=path.match(/^\/api\/payroll\/periods\/(\d+)\/review$/);
  if(payrollReviewMatch && method==='POST'){
    if(!canManagePayroll(auth.role))return json({error:'ไม่มีสิทธิ์ Review Payroll'},403); const id=Number(payrollReviewMatch[1]);
    await env.DB.prepare(`UPDATE payroll_periods SET status='review',updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND client_id=?2 AND status='draft'`).bind(id,clientId).run(); return json({ok:true});
  }

  const payrollLockMatch=path.match(/^\/api\/payroll\/periods\/(\d+)\/lock$/);
  if(payrollLockMatch && method==='POST'){
    if(!canManagePayroll(auth.role))return json({error:'ไม่มีสิทธิ์ Lock Payroll'},403); const id=Number(payrollLockMatch[1]);
    const period=await env.DB.prepare('SELECT * FROM payroll_periods WHERE id=?1 AND client_id=?2').bind(id,clientId).first(); if(!period)return json({error:'ไม่พบรอบเงินเดือน'},404); if(period.status==='published')return json({error:'รอบนี้ Publish แล้ว'},409);
    const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM payroll_items WHERE period_id=?1').bind(id).first(); if(!Number(count?.n||0))return json({error:'ยังไม่มีรายการ Payroll ให้ Lock'},409);
    await env.DB.prepare(`UPDATE payroll_periods SET status='locked',locked_by_user_id=?1,locked_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?2 AND client_id=?3`).bind(Number(auth.user.id),id,clientId).run();
    await env.DB.prepare(`UPDATE payroll_items SET status='locked',updated_at=CURRENT_TIMESTAMP WHERE period_id=?1`).bind(id).run();
    const settings=await env.DB.prepare(`SELECT * FROM payroll_settings WHERE client_id=?1`).bind(clientId).first();
    let payslipQueued=false,payslipWarning=null;
    if(Number(settings?.auto_payslip_on_lock ?? 1)===1){
      const workspace=await env.DB.prepare(`SELECT * FROM google_workspace_integrations WHERE client_id=?1 AND status='connected'`).bind(clientId).first();
      if(workspace?.drive_folder_id){
        const task=publishPayrollPeriod(env,clientId,id,{notify:false}).catch(error=>console.error(JSON.stringify({level:'error',event:'payroll_auto_payslip_failed',period_id:id,message:String(error?.message||error)})));
        if(ctx?.waitUntil)ctx.waitUntil(task); else await task;
        payslipQueued=true;
      }else payslipWarning='Lock สำเร็จ แต่ยังไม่ได้สร้างสลิปอัตโนมัติ เพราะยังไม่ได้เชื่อม Google Drive';
    }
    await safeAudit(env.DB,clientId,'user',String(auth.user.id),'payroll.lock','payroll_period',String(id),{auto_payslip:payslipQueued});
    return json({ok:true,payslip_queued:payslipQueued,warning:payslipWarning});
  }


  const payrollGeneratePayslipMatch=path.match(/^\/api\/payroll\/periods\/(\d+)\/generate-payslips$/);
  if(payrollGeneratePayslipMatch && method==='POST'){
    if(!canManagePayroll(auth.role))return json({error:'ไม่มีสิทธิ์สร้าง Payslip'},403);
    const id=Number(payrollGeneratePayslipMatch[1]);
    const period=await env.DB.prepare('SELECT * FROM payroll_periods WHERE id=?1 AND client_id=?2').bind(id,clientId).first();
    if(!period)return json({error:'ไม่พบรอบเงินเดือน'},404);
    if(!['locked','published'].includes(period.status))return json({error:'ต้อง Lock Payroll ก่อนสร้าง Payslip'},409);
    const workspace=await env.DB.prepare(`SELECT * FROM google_workspace_integrations WHERE client_id=?1 AND status='connected'`).bind(clientId).first();
    if(!workspace?.drive_folder_id)return json({error:'กรุณาเชื่อม Google Drive ก่อนสร้าง Payslip'},409);
    const task=publishPayrollPeriod(env,clientId,id,{notify:false}).catch(error=>console.error(JSON.stringify({level:'error',event:'payroll_generate_payslip_failed',period_id:id,message:String(error?.message||error)})));
    if(ctx?.waitUntil)ctx.waitUntil(task); else await task;
    return json({ok:true,queued:true,message:'กำลังสร้าง Payslip อัตโนมัติลง Google Drive'});
  }

  const payrollPublishMatch=path.match(/^\/api\/payroll\/periods\/(\d+)\/publish$/);
  if(payrollPublishMatch && method==='POST'){
    if(!canManagePayroll(auth.role))return json({error:'ไม่มีสิทธิ์ Publish Payroll'},403); const id=Number(payrollPublishMatch[1]);
    const period=await env.DB.prepare('SELECT * FROM payroll_periods WHERE id=?1 AND client_id=?2').bind(id,clientId).first(); if(!period)return json({error:'ไม่พบรอบเงินเดือน'},404); if(period.status!=='locked')return json({error:'ต้อง Lock Payroll ก่อน Publish'},409);
    const workspace=await env.DB.prepare(`SELECT * FROM google_workspace_integrations WHERE client_id=?1 AND status='connected'`).bind(clientId).first(); if(!workspace?.drive_folder_id)return json({error:'กรุณาเชื่อม Google ก่อน Publish Payslip'},409);
    await env.DB.prepare(`UPDATE payroll_periods SET status='published',published_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND client_id=?2`).bind(id,clientId).run();
    await env.DB.prepare(`UPDATE payroll_items SET status='published',updated_at=CURRENT_TIMESTAMP WHERE period_id=?1`).bind(id).run();
    await safeAudit(env.DB,clientId,'user',String(auth.user.id),'payroll.publish','payroll_period',String(id),null);
    const task=publishPayrollPeriod(env,clientId,id).catch(error=>console.error(JSON.stringify({level:'error',event:'payroll_publish_background_failed',period_id:id,message:String(error?.message||error)})));
    if(ctx?.waitUntil)ctx.waitUntil(task); else await task;
    return json({ok:true,queued:true,message:'กำลังสร้าง Payslip ลง Drive และแจ้งพนักงาน'});
  }

  if(path==='/api/documents' && method==='GET'){
    if(!canManagePayroll(auth.role))return json({error:'ไม่มีสิทธิ์ดูเอกสารพนักงาน'},403); await ensureV100P3Ready(env.DB);
    const rows=await env.DB.prepare(`SELECT d.*,e.employee_code,e.first_name,e.last_name,e.nickname FROM employee_documents d LEFT JOIN employees e ON e.id=d.employee_id WHERE d.client_id=?1 ORDER BY d.created_at DESC LIMIT 200`).bind(clientId).all();
    const payslips=await env.DB.prepare(`SELECT pd.*,e.employee_code,e.first_name,e.last_name,e.nickname,pp.period_key FROM payroll_documents pd JOIN employees e ON e.id=pd.employee_id JOIN payroll_periods pp ON pp.id=pd.period_id WHERE pd.client_id=?1 ORDER BY pd.created_at DESC LIMIT 200`).bind(clientId).all();
    return json({data:rows.results||[],payslips:payslips.results||[]});
  }

  if(path==='/api/documents/generate' && method==='POST'){
    if(!canManagePayroll(auth.role))return json({error:'ไม่มีสิทธิ์ออกเอกสาร'},403); await ensureV100P3Ready(env.DB); const body=await safeJson(request); const employeeId=Number(body.employee_id); const employee=await getEmployeeForClient(env.DB,employeeId,clientId); if(!employee)return json({error:'ไม่พบพนักงาน'},404);
    const type=['salary_certificate','employment_certificate'].includes(String(body.document_type))?String(body.document_type):'employment_certificate';
    const document=await generateEmployeeCertificate(env,clientId,employeeId,type,Number(auth.user.id),body.note||null); return json({ok:true,document},201);
  }

  // Phase 4 — Learning / Onboarding
  if (path === '/api/learning/overview' && method === 'GET') {
    if (!canManageLearning(auth.role)) return json({ error: 'ไม่มีสิทธิ์ดู Learning' }, 403);
    await ensureV100P4Ready(env.DB);
    return json(await getLearningOverview(env.DB, clientId, auth));
  }

  if (path === '/api/learning/courses' && method === 'POST') {
    if (!canManageLearningAdmin(auth.role)) return json({ error: 'ไม่มีสิทธิ์สร้างหลักสูตร' }, 403);
    await ensureV100P4Ready(env.DB);
    const body = await safeJson(request);
    const title = String(body.title || '').trim();
    if (title.length < 2) return json({ error: 'กรุณาใส่ชื่อหลักสูตร' }, 400);
    const audience = ['manual','all','department','probation'].includes(String(body.audience_type)) ? String(body.audience_type) : 'manual';
    const result = await env.DB.prepare(`INSERT INTO learning_courses (client_id,title,description,audience_type,audience_department_id,required,estimated_minutes,passing_score,created_by_user_id) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)`)
      .bind(clientId,title,String(body.description||'').trim()||null,audience,body.audience_department_id?Number(body.audience_department_id):null,body.required===false?0:1,Math.max(0,Number(body.estimated_minutes||0)),Math.max(0,Math.min(100,Number(body.passing_score||80))),Number(auth.user.id)).run();
    await safeAudit(env.DB,clientId,'user',String(auth.user.id),'learning.course.create','learning_course',String(result.meta.last_row_id),{title});
    return json({ ok:true, id:Number(result.meta.last_row_id) },201);
  }

  const learningCourseMatch = path.match(/^\/api\/learning\/courses\/(\d+)$/);
  if (learningCourseMatch && method === 'PATCH') {
    if (!canManageLearningAdmin(auth.role)) return json({ error: 'ไม่มีสิทธิ์แก้หลักสูตร' }, 403);
    await ensureV100P4Ready(env.DB); const id=Number(learningCourseMatch[1]); const body=await safeJson(request);
    const row=await env.DB.prepare('SELECT * FROM learning_courses WHERE id=?1 AND client_id=?2').bind(id,clientId).first(); if(!row)return json({error:'ไม่พบหลักสูตร'},404);
    const status=['draft','published','archived'].includes(String(body.status))?String(body.status):row.status;
    await env.DB.prepare(`UPDATE learning_courses SET title=?1,description=?2,audience_type=?3,audience_department_id=?4,required=?5,estimated_minutes=?6,passing_score=?7,status=?8,published_at=CASE WHEN ?8='published' AND published_at IS NULL THEN CURRENT_TIMESTAMP ELSE published_at END,updated_at=CURRENT_TIMESTAMP WHERE id=?9 AND client_id=?10`)
      .bind(String(body.title??row.title).trim(),String(body.description??row.description??'').trim()||null,['manual','all','department','probation'].includes(String(body.audience_type))?String(body.audience_type):row.audience_type,body.audience_department_id===undefined?row.audience_department_id:(body.audience_department_id?Number(body.audience_department_id):null),body.required===undefined?Number(row.required):(body.required?1:0),Math.max(0,Number((body.estimated_minutes ?? row.estimated_minutes) || 0)),Math.max(0,Math.min(100,Number((body.passing_score ?? row.passing_score) || 80))),status,id,clientId).run();
    return json({ok:true});
  }

  const courseModuleMatch = path.match(/^\/api\/learning\/courses\/(\d+)\/modules$/);
  if (courseModuleMatch && method === 'POST') {
    if (!canManageLearningAdmin(auth.role)) return json({ error: 'ไม่มีสิทธิ์แก้หลักสูตร' }, 403);
    await ensureV100P4Ready(env.DB); const courseId=Number(courseModuleMatch[1]); const body=await safeJson(request);
    const course=await env.DB.prepare('SELECT id FROM learning_courses WHERE id=?1 AND client_id=?2').bind(courseId,clientId).first(); if(!course)return json({error:'ไม่พบหลักสูตร'},404);
    const type=['video','document','text','link','quiz'].includes(String(body.module_type))?String(body.module_type):'text'; const title=String(body.title||'').trim(); if(title.length<2)return json({error:'กรุณาใส่ชื่อบทเรียน'},400);
    const orderRow=await env.DB.prepare('SELECT COALESCE(MAX(sort_order),0)+10 AS next_order FROM learning_modules WHERE course_id=?1').bind(courseId).first();
    const result=await env.DB.prepare(`INSERT INTO learning_modules (client_id,course_id,sort_order,module_type,title,description,content_text,external_url,duration_seconds,required) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)`)
      .bind(clientId,courseId,Number(orderRow?.next_order||10),type,title,String(body.description||'').trim()||null,String(body.content_text||'').trim()||null,String(body.external_url||'').trim()||null,Math.max(0,Number(body.duration_seconds||0)),body.required===false?0:1).run();
    return json({ok:true,id:Number(result.meta.last_row_id)},201);
  }

  const moduleMediaMatch = path.match(/^\/api\/learning\/modules\/(\d+)\/media$/);
  if (moduleMediaMatch && method === 'POST') {
    if (!canManageLearningAdmin(auth.role)) return json({error:'ไม่มีสิทธิ์อัปโหลดสื่อ'},403);
    await ensureV100P4Ready(env.DB); const moduleId=Number(moduleMediaMatch[1]);
    const module=await env.DB.prepare(`SELECT m.*,c.title AS course_title FROM learning_modules m JOIN learning_courses c ON c.id=m.course_id WHERE m.id=?1 AND m.client_id=?2`).bind(moduleId,clientId).first(); if(!module)return json({error:'ไม่พบบทเรียน'},404);
    const form=await request.formData(); const file=form.get('file'); if(!(file instanceof File))return json({error:'กรุณาเลือกไฟล์'},400); if(file.size>250*1024*1024)return json({error:'ไฟล์ใหญ่เกิน 250 MB'},413);
    const workspace=await env.DB.prepare(`SELECT * FROM google_workspace_integrations WHERE client_id=?1 AND status='connected'`).bind(clientId).first(); if(!workspace?.drive_folder_id)return json({error:'กรุณาเชื่อม Google ก่อนอัปโหลดสื่อ'},409);
    const accessToken=await getWorkspaceGoogleAccessToken(env,workspace); const trainingRoot=await ensureDriveChildFolder(accessToken,workspace.drive_folder_id,'Onboarding Training'); const courseFolder=await ensureDriveChildFolder(accessToken,trainingRoot,`Course-${module.course_id} - ${String(module.course_title).slice(0,60)}`); const uploaded=await uploadGoogleDriveFile(accessToken,{folderId:courseFolder,fileName:file.name,contentType:file.type||'application/octet-stream',bytes:new Uint8Array(await file.arrayBuffer())});
    await env.DB.prepare(`UPDATE learning_modules SET drive_file_id=?1,drive_url=?2,file_name=?3,content_type=?4,updated_at=CURRENT_TIMESTAMP WHERE id=?5 AND client_id=?6`).bind(uploaded.id,uploaded.webViewLink||null,file.name,file.type||'application/octet-stream',moduleId,clientId).run();
    return json({ok:true,drive_file_id:uploaded.id,drive_url:uploaded.webViewLink||null});
  }

  const moduleQuestionMatch = path.match(/^\/api\/learning\/modules\/(\d+)\/questions$/);
  if (moduleQuestionMatch && method === 'POST') {
    if (!canManageLearningAdmin(auth.role)) return json({error:'ไม่มีสิทธิ์เพิ่มข้อสอบ'},403);
    await ensureV100P4Ready(env.DB); const moduleId=Number(moduleQuestionMatch[1]); const body=await safeJson(request);
    const module=await env.DB.prepare(`SELECT * FROM learning_modules WHERE id=?1 AND client_id=?2 AND module_type='quiz'`).bind(moduleId,clientId).first(); if(!module)return json({error:'ไม่พบ Quiz'},404);
    const question=String(body.question_text||'').trim(); if(question.length<3)return json({error:'กรุณาใส่คำถาม'},400);
    const options=Array.isArray(body.options)?body.options.map(x=>String(x).trim()).filter(Boolean):[]; const correct=Array.isArray(body.correct_answers)?body.correct_answers.map(Number):[]; if(options.length<2||!correct.length)return json({error:'กรุณาใส่ตัวเลือกและคำตอบที่ถูก'},400);
    const orderRow=await env.DB.prepare('SELECT COALESCE(MAX(sort_order),0)+10 AS next_order FROM learning_quiz_questions WHERE module_id=?1').bind(moduleId).first(); const result=await env.DB.prepare(`INSERT INTO learning_quiz_questions (client_id,module_id,sort_order,question_text,question_type,options_json,correct_json,points,explanation) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)`).bind(clientId,moduleId,Number(orderRow?.next_order||10),question,String(body.question_type||'single'),JSON.stringify(options),JSON.stringify(correct),Math.max(.1,Number(body.points||1)),String(body.explanation||'').trim()||null).run();
    return json({ok:true,id:Number(result.meta.last_row_id)},201);
  }

  const courseAssignMatch = path.match(/^\/api\/learning\/courses\/(\d+)\/assign$/);
  if (courseAssignMatch && method === 'POST') {
    if (!canManageLearningAdmin(auth.role)) return json({error:'ไม่มีสิทธิ์ Assign หลักสูตร'},403);
    await ensureV100P4Ready(env.DB); const courseId=Number(courseAssignMatch[1]); const body=await safeJson(request); const course=await env.DB.prepare('SELECT * FROM learning_courses WHERE id=?1 AND client_id=?2').bind(courseId,clientId).first(); if(!course)return json({error:'ไม่พบหลักสูตร'},404);
    const employees=await resolveLearningAudience(env.DB,clientId,body); if(!employees.length)return json({error:'ไม่พบพนักงานในกลุ่มที่เลือก'},400); let count=0;
    for(const e of employees){const r=await env.DB.prepare(`INSERT OR IGNORE INTO learning_assignments (client_id,course_id,employee_id,required,due_date,assigned_by_user_id) VALUES (?1,?2,?3,?4,?5,?6)`).bind(clientId,courseId,Number(e.id),course.required,body.due_date||null,Number(auth.user.id)).run(); if(Number(r.meta?.changes||0)>0)count++;}
    await env.DB.prepare(`UPDATE learning_courses SET status='published',published_at=COALESCE(published_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE id=?1`).bind(courseId).run();
    const notifyTask=notifyLearningAssignments(env,clientId,course,employees).catch(error=>console.error(JSON.stringify({level:'warn',event:'learning_assignment_notify_failed',course_id:courseId,message:String(error?.message||error)})));
    if(ctx?.waitUntil)ctx.waitUntil(notifyTask);else await notifyTask;
    return json({ok:true,assigned:count,total:employees.length});
  }

  // Phase 4 — Performance / KPI / 1:1 / Probation
  if (path === '/api/performance/overview' && method === 'GET') {
    if (!canManagePerformance(auth.role)) return json({ error: 'ไม่มีสิทธิ์ดู Performance' }, 403);
    await ensureV100P4Ready(env.DB); return json(await getPerformanceOverview(env.DB,clientId,auth));
  }

  if (path === '/api/performance/cycles' && method === 'POST') {
    if (!canManagePerformanceAdmin(auth.role)) return json({error:'ไม่มีสิทธิ์สร้างรอบประเมิน'},403); await ensureV100P4Ready(env.DB); const body=await safeJson(request); const name=String(body.name||'').trim(); if(name.length<2)return json({error:'กรุณาใส่ชื่อรอบ'},400); if(!body.start_date||!body.end_date)return json({error:'กรุณาใส่ช่วงวันที่'},400);
    const r=await env.DB.prepare(`INSERT INTO performance_cycles (client_id,name,cycle_type,start_date,end_date,status,created_by_user_id) VALUES (?1,?2,?3,?4,?5,'active',?6)`).bind(clientId,name,['probation','monthly','quarterly','annual','custom'].includes(String(body.cycle_type))?String(body.cycle_type):'monthly',body.start_date,body.end_date,Number(auth.user.id)).run(); return json({ok:true,id:Number(r.meta.last_row_id)},201);
  }

  if (path === '/api/performance/goals' && method === 'POST') {
    if (!canManagePerformance(auth.role)) return json({error:'ไม่มีสิทธิ์สร้าง KPI'},403); await ensureV100P4Ready(env.DB); const body=await safeJson(request); const employeeId=Number(body.employee_id); if(!await canActOnPerformanceEmployee(env.DB,auth,clientId,employeeId))return json({error:'คุณดูแลพนักงานคนนี้ไม่ได้'},403); const title=String(body.title||'').trim(); if(title.length<2)return json({error:'กรุณาใส่ชื่อ KPI'},400);
    const r=await env.DB.prepare(`INSERT INTO kpi_goals (client_id,cycle_id,employee_id,title,description,metric_type,target_value,target_text,unit,weight,update_frequency,status,created_by_user_id) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,'active',?12)`).bind(clientId,body.cycle_id?Number(body.cycle_id):null,employeeId,title,String(body.description||'').trim()||null,['number','percent','currency','text','boolean'].includes(String(body.metric_type))?String(body.metric_type):'number',body.target_value===''||body.target_value==null?null:Number(body.target_value),String(body.target_text||'').trim()||null,String(body.unit||'').trim()||null,Math.max(0,Number(body.weight||0)),['daily','weekly','monthly','once'].includes(String(body.update_frequency))?String(body.update_frequency):'monthly',Number(auth.user.id)).run(); return json({ok:true,id:Number(r.meta.last_row_id)},201);
  }

  const goalUpdateMatch=path.match(/^\/api\/performance\/goals\/(\d+)\/updates$/);
  if(goalUpdateMatch && method==='POST'){
    if(!canManagePerformance(auth.role))return json({error:'ไม่มีสิทธิ์อัปเดต KPI'},403); await ensureV100P4Ready(env.DB); const goal=await env.DB.prepare('SELECT * FROM kpi_goals WHERE id=?1 AND client_id=?2').bind(Number(goalUpdateMatch[1]),clientId).first(); if(!goal)return json({error:'ไม่พบ KPI'},404); if(!await canActOnPerformanceEmployee(env.DB,auth,clientId,Number(goal.employee_id)))return json({error:'คุณดูแลพนักงานคนนี้ไม่ได้'},403); const body=await safeJson(request); const progress=calculateKpiProgress(goal,body.actual_value,body.progress_pct); const r=await env.DB.prepare(`INSERT INTO kpi_updates (client_id,goal_id,employee_id,update_date,period_key,actual_value,actual_text,progress_pct,note,source) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,'hr')`).bind(clientId,Number(goal.id),Number(goal.employee_id),body.update_date||dateInBangkok(),body.period_key||null,body.actual_value===''||body.actual_value==null?null:Number(body.actual_value),String(body.actual_text||'').trim()||null,progress,String(body.note||'').trim()||null).run(); if(Number(progress||0)>=100)await awardEventRules(env.DB,clientId,Number(goal.employee_id),'kpi_complete',Number(goal.id),`KPI สำเร็จ · ${goal.title}`); return json({ok:true,id:Number(r.meta.last_row_id),progress_pct:progress},201);
  }

  if(path==='/api/performance/one-on-ones' && method==='POST'){
    if(!canManagePerformance(auth.role))return json({error:'ไม่มีสิทธิ์สร้าง 1:1'},403); await ensureV100P4Ready(env.DB); const body=await safeJson(request); const employeeId=Number(body.employee_id); if(!await canActOnPerformanceEmployee(env.DB,auth,clientId,employeeId))return json({error:'คุณดูแลพนักงานคนนี้ไม่ได้'},403); const employee=await getEmployeeForClient(env.DB,employeeId,clientId); if(!employee)return json({error:'ไม่พบพนักงาน'},404); const managerId=body.manager_employee_id?Number(body.manager_employee_id):(employee.manager_employee_id?Number(employee.manager_employee_id):null); const r=await env.DB.prepare(`INSERT INTO one_on_ones (client_id,employee_id,manager_employee_id,scheduled_at,occurred_at,status,employee_notes,manager_notes,action_items,next_followup_at,created_by_user_id) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)`).bind(clientId,employeeId,managerId,body.scheduled_at||null,body.occurred_at||null,['scheduled','completed','cancelled','missed'].includes(String(body.status))?String(body.status):'scheduled',String(body.employee_notes||'').trim()||null,String(body.manager_notes||'').trim()||null,String(body.action_items||'').trim()||null,body.next_followup_at||null,Number(auth.user.id)).run(); return json({ok:true,id:Number(r.meta.last_row_id)},201);
  }

  if(path==='/api/performance/probation-reviews' && method==='POST'){
    if(!canManagePerformance(auth.role))return json({error:'ไม่มีสิทธิ์ประเมิน Probation'},403); await ensureV100P4Ready(env.DB); const body=await safeJson(request); const employeeId=Number(body.employee_id); if(!await canActOnPerformanceEmployee(env.DB,auth,clientId,employeeId))return json({error:'คุณดูแลพนักงานคนนี้ไม่ได้'},403); const employee=await getEmployeeForClient(env.DB,employeeId,clientId); if(!employee)return json({error:'ไม่พบพนักงาน'},404); const status=['pending','submitted','passed','extended','not_passed'].includes(String(body.status))?String(body.status):'submitted'; const r=await env.DB.prepare(`INSERT INTO probation_reviews (client_id,employee_id,reviewer_employee_id,review_date,status,score,strengths,improvements,manager_comment,hr_comment,recommendation,extension_end_date,submitted_at,decided_at,created_by_user_id) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,CURRENT_TIMESTAMP,CASE WHEN ?5 IN ('passed','extended','not_passed') THEN CURRENT_TIMESTAMP ELSE NULL END,?13)`).bind(clientId,employeeId,body.reviewer_employee_id?Number(body.reviewer_employee_id):(employee.manager_employee_id?Number(employee.manager_employee_id):null),body.review_date||dateInBangkok(),status,body.score===''||body.score==null?null:Number(body.score),String(body.strengths||'').trim()||null,String(body.improvements||'').trim()||null,String(body.manager_comment||'').trim()||null,String(body.hr_comment||'').trim()||null,String(body.recommendation||'').trim()||null,body.extension_end_date||null,Number(auth.user.id)).run();
    if(status==='passed')await env.DB.prepare(`UPDATE employees SET people_status='employee',confirmed_at=COALESCE(confirmed_at,?1),updated_at=CURRENT_TIMESTAMP WHERE id=?2 AND client_id=?3`).bind(body.review_date||dateInBangkok(),employeeId,clientId).run(); if(status==='extended'&&body.extension_end_date)await env.DB.prepare(`UPDATE employees SET probation_end_date=?1,updated_at=CURRENT_TIMESTAMP WHERE id=?2 AND client_id=?3`).bind(body.extension_end_date,employeeId,clientId).run(); return json({ok:true,id:Number(r.meta.last_row_id)},201);
  }

  if (path === '/api/attendance/today' && method === 'GET') {
    const client = await getClient(env.DB, clientId);
    if (!client) return json({ error: 'Client not found' }, 404);
    const workDate = dateInBangkok();
    const result = await env.DB.prepare(`
      SELECT e.id AS employee_id, e.employee_code, e.first_name, e.last_name, e.nickname,
             d.name AS department_name, a.check_in_at, a.check_out_at,
             CASE WHEN lr.id IS NOT NULL AND a.check_in_at IS NULL THEN 'leave' ELSE a.status END AS status, a.late_minutes,
             lr.id AS leave_request_id, lp.name AS leave_name,
             a.checkin_lat, a.checkin_lng, a.checkin_location_id, a.checkin_location_name, a.checkin_distance_m,
             a.checkout_lat, a.checkout_lng, a.checkout_location_id, a.checkout_location_name, a.checkout_distance_m,
             a.checkout_outside_geofence, a.scheduled_start, a.scheduled_end, a.schedule_source
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN attendance a ON a.employee_id = e.id AND a.work_date = ?1
      LEFT JOIN leave_requests lr ON lr.employee_id=e.id AND lr.status='approved' AND ?1 BETWEEN lr.start_date AND lr.end_date
      LEFT JOIN leave_policies lp ON lp.id=lr.policy_id
      WHERE e.client_id = ?2 AND e.status = 'active'
      ORDER BY e.first_name
    `).bind(workDate, clientId).all();
    return json({ work_date: workDate, data: result.results });
  }

  if (path === '/api/attendance/check-in' && method === 'POST') {
    const body = await safeJson(request);
    if (!body.employee_id) return json({ error: 'Missing employee_id' }, 400);
    try {
      const result = await checkIn(env.DB, Number(body.employee_id), body.lat, body.lng, body.source || 'dashboard');
      return json({ ok: true, ...result });
    } catch (e) {
      return json({ error: e.message }, e.status || 400);
    }
  }

  if (path === '/api/attendance/check-out' && method === 'POST') {
    const body = await safeJson(request);
    if (!body.employee_id) return json({ error: 'Missing employee_id' }, 400);
    try {
      const result = await checkOut(env.DB, Number(body.employee_id), body.lat, body.lng, body.source || 'dashboard');
      return json({ ok: true, ...result });
    } catch (e) {
      return json({ error: e.message }, e.status || 400);
    }
  }

  // Phase 2 — Leave settings + Employee Service
  if (path === '/api/employee-service' && method === 'GET') {
    await ensureV100P2Ready(env.DB);
    const [client, openCases, broadcasts, integration] = await Promise.all([
      getClient(env.DB,clientId),
      canManagePeopleAdmin(auth.role) ? env.DB.prepare(`SELECT COUNT(*) AS n FROM hr_cases WHERE client_id=?1 AND status NOT IN ('resolved','closed')`).bind(clientId).first() : Promise.resolve({n:0}),
      ['owner','co_owner','hr_admin','hr','manager'].includes(String(auth.role||'')) ? env.DB.prepare(`SELECT COUNT(*) AS n FROM broadcasts WHERE client_id=?1`).bind(clientId).first() : Promise.resolve({n:0}),
      getWorkspaceLineIntegration(env,clientId,false),
    ]);
    return json({
      leave_settings:{ lock_leave_during_probation:Boolean(Number(client?.lock_leave_during_probation ?? 1)) },
      hr_cases_open:Number(openCases?.n||0),
      broadcasts_total:Number(broadcasts?.n||0),
      rich_menu:{ configured:Boolean(integration?.rich_menu_id), rich_menu_id:integration?.rich_menu_id||null, updated_at:integration?.rich_menu_updated_at||null, dedicated_line:Boolean(integration) }
    });
  }

  if (path === '/api/leave-settings' && method === 'GET') {
    await ensureV100P2Ready(env.DB);
    const client=await getClient(env.DB,clientId);
    return json({ lock_leave_during_probation:Boolean(Number(client?.lock_leave_during_probation ?? 1)) });
  }
  if (path === '/api/leave-settings' && method === 'PATCH') {
    if(!canManagePeopleAdmin(auth.role)) return json({error:'ไม่มีสิทธิ์แก้นโยบายวันลา'},403);
    await ensureV100P2Ready(env.DB);
    const body=await safeJson(request);
    const locked=body.lock_leave_during_probation===false?0:1;
    await env.DB.prepare('UPDATE clients SET lock_leave_during_probation=?1 WHERE id=?2').bind(locked,clientId).run();
    await safeAudit(env.DB,clientId,'user',String(auth.user.id),'leave.settings.update','client',String(clientId),{lock_leave_during_probation:Boolean(locked)});
    return json({ok:true,lock_leave_during_probation:Boolean(locked)});
  }

  if (path === '/api/hr-cases' && method === 'GET') {
    if(!canManagePeopleAdmin(auth.role)) return json({error:'เฉพาะ HR เท่านั้นที่ดูเรื่องส่วนตัวของพนักงานได้'},403);
    await ensureV100P2Ready(env.DB);
    const rows=await env.DB.prepare(`SELECT c.*,e.employee_code,e.first_name,e.last_name,e.nickname,e.line_user_id,d.name AS department_name,u.name AS assigned_user_name
      FROM hr_cases c JOIN employees e ON e.id=c.employee_id
      LEFT JOIN departments d ON d.id=e.department_id LEFT JOIN users u ON u.id=c.assigned_user_id
      WHERE c.client_id=?1 ORDER BY CASE c.status WHEN 'open' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'waiting_employee' THEN 3 ELSE 4 END, c.updated_at DESC LIMIT 300`).bind(clientId).all();
    return json({data:rows.results||[]});
  }

  const hrCaseDetailMatch=path.match(/^\/api\/hr-cases\/(\d+)$/);
  if(hrCaseDetailMatch && method==='GET'){
    if(!canManagePeopleAdmin(auth.role)) return json({error:'เฉพาะ HR เท่านั้นที่ดูเรื่องส่วนตัวของพนักงานได้'},403);
    const id=Number(hrCaseDetailMatch[1]);
    const row=await env.DB.prepare(`SELECT c.*,e.employee_code,e.first_name,e.last_name,e.nickname,e.line_user_id,e.line_provider_scope,d.name AS department_name,u.name AS assigned_user_name
      FROM hr_cases c JOIN employees e ON e.id=c.employee_id LEFT JOIN departments d ON d.id=e.department_id LEFT JOIN users u ON u.id=c.assigned_user_id
      WHERE c.id=?1 AND c.client_id=?2`).bind(id,clientId).first();
    if(!row)return json({error:'ไม่พบเรื่องแจ้ง HR'},404);
    const [events,attachments]=await Promise.all([
      env.DB.prepare('SELECT * FROM hr_case_events WHERE case_id=?1 ORDER BY created_at').bind(id).all(),
      env.DB.prepare('SELECT id,file_name,content_type,file_size,storage_provider,drive_url,created_at FROM hr_case_attachments WHERE case_id=?1 ORDER BY created_at').bind(id).all()
    ]);
    return json({data:row,events:events.results||[],attachments:attachments.results||[]});
  }
  if(hrCaseDetailMatch && method==='PATCH'){
    if(!canManagePeopleAdmin(auth.role)) return json({error:'เฉพาะ HR เท่านั้นที่จัดการเรื่องนี้ได้'},403);
    const id=Number(hrCaseDetailMatch[1]); const existing=await env.DB.prepare('SELECT * FROM hr_cases WHERE id=?1 AND client_id=?2').bind(id,clientId).first(); if(!existing)return json({error:'ไม่พบเรื่องแจ้ง HR'},404);
    const body=await safeJson(request); const allowedStatus=['open','in_progress','waiting_employee','resolved','closed']; const allowedPriority=['low','normal','high','urgent'];
    const status=allowedStatus.includes(body.status)?body.status:existing.status; const priority=allowedPriority.includes(body.priority)?body.priority:existing.priority;
    const assigned=body.assigned_to_me?Number(auth.user.id):(body.assigned_user_id===null?null:(body.assigned_user_id===undefined?existing.assigned_user_id:Number(body.assigned_user_id)));
    await env.DB.prepare(`UPDATE hr_cases SET status=?1,priority=?2,assigned_user_id=?3,hr_note=?4,resolved_at=CASE WHEN ?1 IN ('resolved','closed') THEN COALESCE(resolved_at,CURRENT_TIMESTAMP) ELSE NULL END,updated_at=CURRENT_TIMESTAMP WHERE id=?5 AND client_id=?6`)
      .bind(status,priority,assigned,body.hr_note===undefined?existing.hr_note:String(body.hr_note||''),id,clientId).run();
    await env.DB.prepare(`INSERT INTO hr_case_events(client_id,case_id,actor_type,actor_user_id,action,message) VALUES(?1,?2,'user',?3,'status_update',?4)`).bind(clientId,id,Number(auth.user.id),`status=${status}; priority=${priority}`).run();
    return json({ok:true});
  }

  const hrCaseReplyMatch=path.match(/^\/api\/hr-cases\/(\d+)\/reply$/);
  if(hrCaseReplyMatch && method==='POST'){
    if(!canManagePeopleAdmin(auth.role)) return json({error:'เฉพาะ HR เท่านั้นที่ตอบเรื่องนี้ได้'},403);
    const id=Number(hrCaseReplyMatch[1]); const body=await safeJson(request); const message=String(body.message||'').trim(); if(message.length<2)return json({error:'กรุณาใส่ข้อความตอบกลับ'},400);
    const row=await env.DB.prepare(`SELECT c.*,e.line_user_id,e.line_provider_scope,e.first_name,e.nickname FROM hr_cases c JOIN employees e ON e.id=c.employee_id WHERE c.id=?1 AND c.client_id=?2`).bind(id,clientId).first(); if(!row)return json({error:'ไม่พบเรื่องแจ้ง HR'},404);
    await env.DB.batch([
      env.DB.prepare(`UPDATE hr_cases SET last_reply_to_employee=?1,status=CASE WHEN status IN ('open','in_progress') THEN 'waiting_employee' ELSE status END,updated_at=CURRENT_TIMESTAMP WHERE id=?2`).bind(message,id),
      env.DB.prepare(`INSERT INTO hr_case_events(client_id,case_id,actor_type,actor_user_id,action,message) VALUES(?1,?2,'user',?3,'reply',?4)`).bind(clientId,id,Number(auth.user.id),message)
    ]);
    if(row.line_user_id){
      const token=await getAccessTokenForProviderScope(env,clientId,row.line_provider_scope); if(token) await pushLineMessages(token,row.line_user_id,[buildHrCaseReplyFlex({...row,message})]);
    }
    return json({ok:true,delivered_to_line:Boolean(row.line_user_id)});
  }

  if(path==='/api/broadcasts' && method==='GET'){
    if(!canManagePeople(auth.role)) return json({error:'ไม่มีสิทธิ์ดูประกาศ'},403);
    await ensureV100P2Ready(env.DB);
    const rows=await env.DB.prepare(`SELECT b.*,u.name AS created_by_name FROM broadcasts b LEFT JOIN users u ON u.id=b.created_by_user_id WHERE b.client_id=?1 ORDER BY b.created_at DESC LIMIT 200`).bind(clientId).all();
    return json({data:rows.results||[]});
  }
  if(path==='/api/broadcasts' && method==='POST'){
    if(!canManagePeopleAdmin(auth.role)) return json({error:'เฉพาะ HR ที่ส่งประกาศได้'},403);
    await ensureV100P2Ready(env.DB);
    const body=await safeJson(request); const title=String(body.title||'').trim(); const message=String(body.message||'').trim(); if(title.length<2||message.length<2)return json({error:'กรุณาใส่หัวข้อและข้อความประกาศ'},400);
    const audienceType=['all','department','employees'].includes(body.audience_type)?body.audience_type:'all';
    let audienceValue=null;
    if(audienceType==='department'){const id=Number(body.department_id);const d=await env.DB.prepare('SELECT id FROM departments WHERE id=?1 AND client_id=?2').bind(id,clientId).first();if(!d)return json({error:'ไม่พบแผนก'},400);audienceValue=String(id);}
    if(audienceType==='employees'){const ids=[...new Set((Array.isArray(body.employee_ids)?body.employee_ids:[]).map(Number).filter(Boolean))];if(!ids.length)return json({error:'กรุณาเลือกพนักงาน'},400);audienceValue=JSON.stringify(ids);}
    const result=await env.DB.prepare(`INSERT INTO broadcasts(client_id,title,message,audience_type,audience_value,channel_line,status,created_by_user_id) VALUES(?1,?2,?3,?4,?5,1,'draft',?6)`).bind(clientId,title,message,audienceType,audienceValue,Number(auth.user.id)).run();
    const id=Number(result.meta.last_row_id);
    if(body.send_now!==false){const sent=await sendBroadcastNow(env,id,clientId);return json({ok:true,id,...sent},201);}
    return json({ok:true,id,status:'draft'},201);
  }
  const broadcastSendMatch=path.match(/^\/api\/broadcasts\/(\d+)\/send$/);
  if(broadcastSendMatch && method==='POST'){
    if(!canManagePeopleAdmin(auth.role)) return json({error:'เฉพาะ HR ที่ส่งประกาศได้'},403);
    try{return json({ok:true,...await sendBroadcastNow(env,Number(broadcastSendMatch[1]),clientId)});}catch(e){return json({error:e.message},e.status||400);}
  }

  if(path==='/api/integrations/line/rich-menu' && method==='GET'){
    const integration=await getWorkspaceLineIntegration(env,clientId,false);
    return json({configured:Boolean(integration?.rich_menu_id),rich_menu_id:integration?.rich_menu_id||null,updated_at:integration?.rich_menu_updated_at||null,dedicated_line:Boolean(integration)});
  }
  if(path==='/api/integrations/line/rich-menu' && method==='POST'){
    if(!canManageIntegrations(auth.role))return json({error:'เฉพาะ Owner หรือ HR Admin ที่ตั้ง Rich Menu ได้'},403);
    const integration=await getWorkspaceLineIntegration(env,clientId,false); if(!integration)return json({error:'กรุณาเชื่อม LINE OA ของบริษัทก่อนตั้ง Rich Menu'},409);
    try{return json({ok:true,...await setupWorkspaceRichMenu(env,integration)});}catch(e){return json({error:`ตั้ง Rich Menu ไม่สำเร็จ: ${e.message}`},400);}
  }
  if(path==='/api/integrations/line/rich-menu' && method==='DELETE'){
    if(!canManageIntegrations(auth.role))return json({error:'เฉพาะ Owner หรือ HR Admin ที่ลบ Rich Menu ได้'},403);
    const integration=await getWorkspaceLineIntegration(env,clientId,false); if(!integration?.rich_menu_id)return json({ok:true});
    try{await deleteWorkspaceRichMenu(env,integration);return json({ok:true});}catch(e){return json({error:`ลบ Rich Menu ไม่สำเร็จ: ${e.message}`},400);}
  }


  if (path === '/api/leave-report' && method === 'GET') {
    const url = new URL(request.url);
    const monthRaw = String(url.searchParams.get('month') || '').trim();
    const nowBkk = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const fallbackMonth = `${nowBkk.getUTCFullYear()}-${String(nowBkk.getUTCMonth()+1).padStart(2,'0')}`;
    const month = /^\d{4}-\d{2}$/.test(monthRaw) ? monthRaw : fallbackMonth;
    const [yy,mm] = month.split('-').map(Number);
    if (mm < 1 || mm > 12) return json({error:'รูปแบบเดือนไม่ถูกต้อง'},400);
    const startDate = `${yy}-${String(mm).padStart(2,'0')}-01`;
    const nextY = mm === 12 ? yy + 1 : yy;
    const nextM = mm === 12 ? 1 : mm + 1;
    const nextMonth = `${nextY}-${String(nextM).padStart(2,'0')}-01`;
    const endObj = new Date(Date.UTC(nextY,nextM-1,1)); endObj.setUTCDate(endObj.getUTCDate()-1);
    const endDate = `${endObj.getUTCFullYear()}-${String(endObj.getUTCMonth()+1).padStart(2,'0')}-${String(endObj.getUTCDate()).padStart(2,'0')}`;

    const result = await env.DB.prepare(`
      SELECT l.*,e.first_name,e.last_name,e.nickname,e.employee_code,
             d.name AS department_name,p.name AS position_name,
             lp.name AS leave_type_name,
             ap.nickname AS approver_nickname,ap.first_name AS approver_first_name,ap.last_name AS approver_last_name
      FROM leave_requests l
      JOIN employees e ON e.id=l.employee_id
      LEFT JOIN departments d ON d.id=e.department_id
      LEFT JOIN positions p ON p.id=e.position_id
      LEFT JOIN leave_policies lp ON lp.id=l.policy_id
      LEFT JOIN employees ap ON ap.id=l.approver_employee_id
      WHERE l.client_id=?1
        AND l.start_date < ?3
        AND l.end_date >= ?2
      ORDER BY l.start_date DESC,l.id DESC
    `).bind(clientId,startDate,nextMonth).all();
    const rows = result.results || [];
    const approved = rows.filter(r => r.status === 'approved');
    const employeesWithLeave = new Set(approved.map(r => Number(r.employee_id))).size;
    const approvedDays = approved.reduce((sum,r)=>sum+Number(r.duration_days||0),0);
    const pendingRequests = rows.filter(r=>r.status==='pending'||r.status==='awaiting_evidence').length;

    const typeMap = new Map();
    for (const r of approved) {
      const key = r.leave_type_name || r.leave_type || 'ไม่ระบุ';
      const item = typeMap.get(key) || {name:key,days:0,requests:0};
      item.days += Number(r.duration_days||0); item.requests += 1; typeMap.set(key,item);
    }
    const personMap = new Map();
    for (const r of approved) {
      const key = Number(r.employee_id);
      const item = personMap.get(key) || {employee_id:key,first_name:r.first_name,last_name:r.last_name,nickname:r.nickname,employee_code:r.employee_code,department_name:r.department_name,days:0,requests:0};
      item.days += Number(r.duration_days||0); item.requests += 1; personMap.set(key,item);
    }
    const monthLabel = new Intl.DateTimeFormat('th-TH',{month:'long',year:'numeric',timeZone:'Asia/Bangkok'}).format(new Date(`${startDate}T12:00:00+07:00`));
    return json({
      month,
      start_date:startDate,
      end_date:endDate,
      range_label:monthLabel,
      summary:{
        employees_with_leave:employeesWithLeave,
        requests:rows.length,
        approved_requests:approved.length,
        approved_days:Math.round(approvedDays*100)/100,
        pending_requests:pendingRequests,
        rejected_requests:rows.filter(r=>r.status==='rejected').length
      },
      by_type:[...typeMap.values()].sort((a,b)=>b.days-a.days),
      top_people:[...personMap.values()].sort((a,b)=>b.days-a.days).slice(0,8),
      rows
    });
  }

  if (path === '/api/leaves' && method === 'GET') {
    const result = await env.DB.prepare(`
      SELECT l.*, e.first_name,e.last_name,e.nickname,e.employee_code,
             lp.name AS leave_type_name, lp.code AS leave_policy_code,
             ap.nickname AS approver_nickname,ap.first_name AS approver_first_name,ap.last_name AS approver_last_name,
             (SELECT COUNT(*) FROM leave_request_evidence ev WHERE ev.leave_request_id=l.id) AS evidence_count
      FROM leave_requests l
      JOIN employees e ON e.id=l.employee_id
      LEFT JOIN leave_policies lp ON lp.id=l.policy_id
      LEFT JOIN employees ap ON ap.id=l.approver_employee_id
      WHERE l.client_id=?1 ORDER BY l.created_at DESC LIMIT 300
    `).bind(clientId).all();
    return json({ data: result.results || [] });
  }

  if (path === '/api/leaves' && method === 'POST') {
    if (!canManagePeople(auth.role)) return json({error:'ไม่มีสิทธิ์สร้างคำขอลาแทนพนักงาน'},403);
    const body=await safeJson(request);
    try{
      const requestRow=await createLeaveRequest(env,{
        clientId,employeeId:Number(body.employee_id),policyId:Number(body.policy_id||0),leaveType:body.leave_type,
        startDate:body.start_date,endDate:body.end_date,dayPart:body.day_part||'full',reason:String(body.reason||'').trim(),submittedVia:'dashboard',submittedByUserId:Number(auth.user.id)
      });
      await safeAudit(env.DB,clientId,'user',String(auth.user.id),'leave.create','leave_request',String(requestRow.id),null);
      if(requestRow.status==='pending') await notifyLeaveApprover(env,requestRow.id);
      else if(requestRow.status==='awaiting_evidence') await notifyEmployeeEvidenceRequired(env,requestRow.id);
      return json({ok:true,id:requestRow.id,status:requestRow.status},201);
    }catch(e){ return json({error:e.message},e.status||400); }
  }

  const leaveStatusMatch = path.match(/^\/api\/leaves\/(\d+)\/(approve|reject)$/);
  if (leaveStatusMatch && method === 'PATCH') {
    if(!canOverrideLeave(auth.role)) return json({error:'การอนุมัติแทนใน Dashboard จำกัดเฉพาะ Owner/HR · ผู้อนุมัติปกติกดผ่าน LINE'},403);
    const body=await safeJson(request);
    try{
      const result=await decideLeaveRequest(env,Number(leaveStatusMatch[1]),leaveStatusMatch[2]==='approve'?'approved':'rejected',{
        actorType:'user',actorUserId:Number(auth.user.id),reason:String(body.reason||'').trim(),clientId
      });
      return json({ok:true,status:result.status});
    }catch(e){return json({error:e.message},e.status||400);}
  }

  const leaveEvidenceUploadMatch=path.match(/^\/api\/leaves\/(\d+)\/evidence$/);
  if(leaveEvidenceUploadMatch && method==='POST'){
    if(!canManagePeople(auth.role)) return json({error:'ไม่มีสิทธิ์อัปโหลดหลักฐาน'},403);
    const requestId=Number(leaveEvidenceUploadMatch[1]); const row=await getLeaveRequestDetail(env.DB,requestId,clientId); if(!row) return json({error:'ไม่พบคำขอลา'},404);
    const form=await request.formData(); const file=form.get('file'); if(!file||typeof file.arrayBuffer!=='function') return json({error:'กรุณาเลือกไฟล์'},400);
    if(Number(file.size||0)>10*1024*1024) return json({error:'ไฟล์ใหญ่เกิน 10 MB'},413);
    await storeLeaveEvidenceBinary(env,{clientId,requestId,employeeId:null,bytes:await file.arrayBuffer(),fileName:file.name||'evidence',contentType:file.type||'application/octet-stream',fileSize:Number(file.size||0),source:'dashboard'});
    await env.DB.prepare("UPDATE leave_requests SET status=CASE WHEN status='awaiting_evidence' THEN 'pending' ELSE status END,evidence_count=(SELECT COUNT(*) FROM leave_request_evidence WHERE leave_request_id=?1),updated_at=CURRENT_TIMESTAMP WHERE id=?1").bind(requestId).run();
    await notifyLeaveApprover(env,requestId);
    return json({ok:true});
  }

  const leaveDetailMatch=path.match(/^\/api\/leaves\/(\d+)$/);
  if(leaveDetailMatch && method==='GET'){
    const id=Number(leaveDetailMatch[1]);
    const row=await getLeaveRequestDetail(env.DB,id,clientId); if(!row) return json({error:'ไม่พบคำขอลา'},404);
    const [evidence,events]=await env.DB.batch([
      env.DB.prepare('SELECT id,file_name,content_type,file_size,source,created_at FROM leave_request_evidence WHERE leave_request_id=?1 ORDER BY created_at').bind(id),
      env.DB.prepare('SELECT * FROM leave_approval_events WHERE leave_request_id=?1 ORDER BY created_at').bind(id)
    ]);
    return json({data:row,evidence:evidence.results||[],events:events.results||[]});
  }

  // Phase 5 — Engagement / Rewards / People Analytics / SaaS Billing
  if (path === '/api/engagement/overview' && method === 'GET') {
    if (!canViewEngagement(auth.role)) return json({error:'ไม่มีสิทธิ์ดู Engagement'},403);
    await ensurePhase5Defaults(env.DB,clientId);
    return json(await getEngagementOverview(env.DB,clientId));
  }

  if (path === '/api/engagement/settings' && method === 'PATCH') {
    if (!canManageEngagement(auth.role)) return json({error:'ไม่มีสิทธิ์แก้ Engagement Settings'},403);
    await ensurePhase5Defaults(env.DB,clientId); const body=await safeJson(request);
    await env.DB.prepare(`UPDATE engagement_settings SET points_enabled=?1,leaderboard_enabled=?2,birthday_moment_enabled=?3,anniversary_moment_enabled=?4,updated_at=CURRENT_TIMESTAMP WHERE client_id=?5`)
      .bind(body.points_enabled===false?0:1,body.leaderboard_enabled===false?0:1,body.birthday_moment_enabled===false?0:1,body.anniversary_moment_enabled===false?0:1,clientId).run();
    return json({ok:true,settings:await env.DB.prepare('SELECT * FROM engagement_settings WHERE client_id=?1').bind(clientId).first()});
  }

  if (path === '/api/engagement/rules' && method === 'POST') {
    if (!canManageEngagement(auth.role)) return json({error:'ไม่มีสิทธิ์สร้างกติกาแต้ม'},403);
    await ensurePhase5Defaults(env.DB,clientId); const body=await safeJson(request); const name=String(body.name||'').trim();
    if(name.length<2)return json({error:'กรุณาใส่ชื่อกติกา'},400); const eventType=['attendance_streak','learning_complete','kpi_complete','birthday','work_anniversary','manual','custom'].includes(String(body.event_type))?String(body.event_type):'manual';
    const code=(String(body.code||name).toLowerCase().replace(/[^a-z0-9ก-๙]+/g,'-').replace(/^-|-$/g,'').slice(0,50)||`rule-${Date.now()}`);
    try{const r=await env.DB.prepare(`INSERT INTO point_rules (client_id,code,name,description,event_type,points,cash_value,threshold_count,window_days,is_active,effective_from,created_by_user_id) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)`)
      .bind(clientId,code,name,String(body.description||'').trim()||null,eventType,Math.max(0,num(body.points,0)),Math.max(0,num(body.cash_value,0)),Math.max(1,Math.floor(num(body.threshold_count,1))),body.window_days?Math.max(1,Math.floor(num(body.window_days,30))):null,body.is_active?1:0,body.effective_from||dateInBangkok(),Number(auth.user.id)).run(); return json({ok:true,id:Number(r.meta.last_row_id)},201);}catch(e){if(/UNIQUE/i.test(String(e?.message||e)))return json({error:'รหัสกติกาซ้ำ'},409);throw e;}
  }

  const engagementRuleMatch=path.match(/^\/api\/engagement\/rules\/(\d+)$/);
  if(engagementRuleMatch && method==='PATCH'){
    if(!canManageEngagement(auth.role))return json({error:'ไม่มีสิทธิ์แก้กติกาแต้ม'},403); await ensurePhase5Defaults(env.DB,clientId); const id=Number(engagementRuleMatch[1]); const row=await env.DB.prepare('SELECT * FROM point_rules WHERE id=?1 AND client_id=?2').bind(id,clientId).first(); if(!row)return json({error:'ไม่พบกติกา'},404); const body=await safeJson(request);
    await env.DB.prepare(`UPDATE point_rules SET name=?1,description=?2,event_type=?3,points=?4,cash_value=?5,threshold_count=?6,window_days=?7,is_active=?8,effective_from=?9,updated_at=CURRENT_TIMESTAMP WHERE id=?10 AND client_id=?11`)
      .bind(String(body.name??row.name).trim(),String(body.description??row.description??'').trim()||null,['attendance_streak','learning_complete','kpi_complete','birthday','work_anniversary','manual','custom'].includes(String(body.event_type))?String(body.event_type):row.event_type,Math.max(0,num(body.points,row.points)),Math.max(0,num(body.cash_value,row.cash_value)),Math.max(1,Math.floor(num(body.threshold_count,row.threshold_count||1))),body.window_days===null?null:(body.window_days===undefined?row.window_days:Math.max(1,Math.floor(num(body.window_days,row.window_days||30)))),body.is_active===undefined?Number(row.is_active):(body.is_active?1:0),body.effective_from||row.effective_from||dateInBangkok(),id,clientId).run(); return json({ok:true});
  }

  if(path==='/api/engagement/award' && method==='POST'){
    if(!canManageEngagement(auth.role))return json({error:'ไม่มีสิทธิ์ให้แต้ม'},403); await ensurePhase5Defaults(env.DB,clientId); const body=await safeJson(request); const employeeId=Number(body.employee_id); const employee=await getEmployeeForClient(env.DB,employeeId,clientId); if(!employee)return json({error:'ไม่พบพนักงาน'},404); const points=num(body.points,0); if(!points)return json({error:'กรุณาระบุแต้ม'},400);
    const result=await addPointTransaction(env.DB,{clientId,employeeId,transactionType:points>=0?'earn':'adjust',points,cashValue:Math.max(0,num(body.cash_value,0)),referenceType:'manual',referenceId:null,idempotencyKey:null,note:String(body.note||'HR ให้แต้ม').trim(),createdByUserId:Number(auth.user.id)}); await safeAudit(env.DB,clientId,'user',String(auth.user.id),'engagement.points.manual','employee',String(employeeId),{points,cash_value:Number(body.cash_value||0)}); return json({ok:true,...result},201);
  }

  if(path==='/api/engagement/run-rules' && method==='POST'){
    if(!canManageEngagement(auth.role))return json({error:'ไม่มีสิทธิ์รันกติกา'},403); await ensurePhase5Defaults(env.DB,clientId); const result=await runEngagementAutomationForClient(env.DB,clientId); return json({ok:true,...result});
  }

  if(path==='/api/engagement/rewards' && method==='POST'){
    if(!canManageEngagement(auth.role))return json({error:'ไม่มีสิทธิ์เพิ่มของรางวัล'},403); await ensurePhase5Defaults(env.DB,clientId); const body=await safeJson(request); const title=String(body.title||'').trim(); if(title.length<2)return json({error:'กรุณาใส่ชื่อของรางวัล'},400); const type=['gift','cash','leave','perk','custom'].includes(String(body.reward_type))?String(body.reward_type):'gift'; const r=await env.DB.prepare(`INSERT INTO reward_catalog (client_id,title,description,reward_type,points_cost,cash_value,stock_qty,status,created_by_user_id) VALUES (?1,?2,?3,?4,?5,?6,?7,'active',?8)`).bind(clientId,title,String(body.description||'').trim()||null,type,Math.max(0,num(body.points_cost,0)),Math.max(0,num(body.cash_value,0)),body.stock_qty===''||body.stock_qty==null?null:Math.max(0,Math.floor(num(body.stock_qty,0))),Number(auth.user.id)).run(); return json({ok:true,id:Number(r.meta.last_row_id)},201);
  }

  const rewardMatch=path.match(/^\/api\/engagement\/rewards\/(\d+)$/);
  if(rewardMatch && method==='PATCH'){
    if(!canManageEngagement(auth.role))return json({error:'ไม่มีสิทธิ์แก้ของรางวัล'},403); const id=Number(rewardMatch[1]); const row=await env.DB.prepare('SELECT * FROM reward_catalog WHERE id=?1 AND client_id=?2').bind(id,clientId).first(); if(!row)return json({error:'ไม่พบของรางวัล'},404); const body=await safeJson(request); await env.DB.prepare(`UPDATE reward_catalog SET title=?1,description=?2,reward_type=?3,points_cost=?4,cash_value=?5,stock_qty=?6,status=?7,updated_at=CURRENT_TIMESTAMP WHERE id=?8 AND client_id=?9`).bind(String(body.title??row.title).trim(),String(body.description??row.description??'').trim()||null,['gift','cash','leave','perk','custom'].includes(String(body.reward_type))?String(body.reward_type):row.reward_type,Math.max(0,num(body.points_cost,row.points_cost)),Math.max(0,num(body.cash_value,row.cash_value)),body.stock_qty===undefined?row.stock_qty:(body.stock_qty===''||body.stock_qty==null?null:Math.max(0,Math.floor(num(body.stock_qty,0)))),['active','inactive','archived'].includes(String(body.status))?String(body.status):row.status,id,clientId).run(); return json({ok:true});
  }

  const redemptionDecisionMatch=path.match(/^\/api\/engagement\/redemptions\/(\d+)\/(approve|reject|deliver)$/);
  if(redemptionDecisionMatch && method==='POST'){
    if(!canManageEngagement(auth.role))return json({error:'ไม่มีสิทธิ์จัดการการแลกของ'},403); await ensurePhase5Defaults(env.DB,clientId); const body=await safeJson(request); try{const result=await decideRewardRedemption(env,clientId,Number(redemptionDecisionMatch[1]),redemptionDecisionMatch[2],Number(auth.user.id),String(body.note||'').trim());return json({ok:true,...result});}catch(e){return json({error:e.message},e.status||400);}
  }

  if(path==='/api/analytics/overview' && method==='GET'){
    if(!canViewAnalytics(auth.role))return json({error:'ไม่มีสิทธิ์ดู People Analytics'},403); await ensureV100P5Ready(env.DB); return json(await getPeopleAnalytics(env.DB,clientId));
  }

  if(path==='/api/subscription' && method==='GET'){
    await ensurePhase5Defaults(env.DB,clientId); const overview=await getSubscriptionOverview(env.DB,clientId); return json({...overview,saas_admin:isNaknaSaasAdmin(env,auth.user?.email)});
  }

  if(path==='/api/subscription/plan' && method==='POST'){
    if(!(await isPrimaryWorkspaceOwner(env.DB,clientId,auth.user.id)))return json({error:'เฉพาะ Primary Owner ที่เปลี่ยนแพ็กเกจได้'},403); await ensurePhase5Defaults(env.DB,clientId); const body=await safeJson(request); const plan=await env.DB.prepare(`SELECT * FROM subscription_plans WHERE code=?1 AND status='active'`).bind(String(body.plan_code||'')).first(); if(!plan)return json({error:'ไม่พบแพ็กเกจ'},404); await env.DB.prepare(`UPDATE company_subscriptions SET plan_id=?1,status=CASE WHEN status='trialing' THEN 'trialing' ELSE 'active' END,billing_cycle=?2,updated_at=CURRENT_TIMESTAMP WHERE client_id=?3`).bind(Number(plan.id),body.billing_cycle==='annual'?'annual':'monthly',clientId).run(); return json({ok:true,...await getSubscriptionOverview(env.DB,clientId)});
  }

  if(path==='/api/subscription/invoices/generate' && method==='POST'){
    if(!(await isPrimaryWorkspaceOwner(env.DB,clientId,auth.user.id)))return json({error:'เฉพาะ Primary Owner ที่สร้างใบเรียกเก็บได้'},403); await ensurePhase5Defaults(env.DB,clientId); try{return json({ok:true,invoice:await generateBillingInvoice(env.DB,clientId)},201);}catch(e){return json({error:e.message},e.status||400);}
  }

  if(path==='/api/admin/saas/overview' && method==='GET'){
    if(!isNaknaSaasAdmin(env,auth.user?.email))return json({error:'NAKNA_ADMIN_REQUIRED'},403); await ensureV100P5Ready(env.DB); return json(await getSaasAdminOverview(env.DB));
  }

  const adminPlanMatch=path.match(/^\/api\/admin\/saas\/plans\/(\d+)$/);
  if(adminPlanMatch && method==='PATCH'){
    if(!isNaknaSaasAdmin(env,auth.user?.email))return json({error:'NAKNA_ADMIN_REQUIRED'},403); const id=Number(adminPlanMatch[1]); const body=await safeJson(request); const row=await env.DB.prepare('SELECT * FROM subscription_plans WHERE id=?1').bind(id).first(); if(!row)return json({error:'ไม่พบแพ็กเกจ'},404); await env.DB.prepare(`UPDATE subscription_plans SET name=?1,description=?2,pricing_mode=?3,base_fee=?4,price_per_seat=?5,included_seats=?6,max_seats=?7,trial_days=?8,status=?9,updated_at=CURRENT_TIMESTAMP WHERE id=?10`).bind(String(body.name??row.name).trim(),String(body.description??row.description??'').trim()||null,['per_seat','flat','custom'].includes(String(body.pricing_mode))?String(body.pricing_mode):row.pricing_mode,Math.max(0,num(body.base_fee,row.base_fee)),Math.max(0,num(body.price_per_seat,row.price_per_seat)),Math.max(0,Math.floor(num(body.included_seats,row.included_seats))),body.max_seats===null?null:(body.max_seats===undefined?row.max_seats:Math.max(1,Math.floor(num(body.max_seats,row.max_seats||1)))),Math.max(0,Math.floor(num(body.trial_days,row.trial_days||30))),['active','inactive','archived'].includes(String(body.status))?String(body.status):row.status,id).run(); return json({ok:true});
  }

  const adminSubscriptionMatch=path.match(/^\/api\/admin\/saas\/subscriptions\/(\d+)\/status$/);
  if(adminSubscriptionMatch && method==='POST'){
    if(!isNaknaSaasAdmin(env,auth.user?.email))return json({error:'NAKNA_ADMIN_REQUIRED'},403); const body=await safeJson(request); const status=['trialing','active','past_due','expired','cancelled'].includes(String(body.status))?String(body.status):null; if(!status)return json({error:'สถานะไม่ถูกต้อง'},400); const client=await getClient(env.DB,Number(adminSubscriptionMatch[1])); if(!client)return json({error:'ไม่พบบริษัท'},404); await ensurePhase5Defaults(env.DB,Number(client.id)); await env.DB.prepare(`UPDATE company_subscriptions SET status=?1,updated_at=CURRENT_TIMESTAMP WHERE client_id=?2`).bind(status,Number(client.id)).run(); return json({ok:true});
  }

  const adminPaidMatch=path.match(/^\/api\/admin\/saas\/invoices\/(\d+)\/mark-paid$/);
  if(adminPaidMatch && method==='POST'){
    if(!isNaknaSaasAdmin(env,auth.user?.email))return json({error:'NAKNA_ADMIN_REQUIRED'},403); const invoice=await env.DB.prepare('SELECT * FROM billing_invoices WHERE id=?1').bind(Number(adminPaidMatch[1])).first(); if(!invoice)return json({error:'ไม่พบ Invoice'},404); const body=await safeJson(request); const amount=Math.max(0,num(body.amount,invoice.total)); await env.DB.prepare(`INSERT INTO billing_payments (client_id,invoice_id,amount,method,provider,provider_payment_id,note,created_by_user_id) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)`).bind(Number(invoice.client_id),Number(invoice.id),amount,String(body.method||'manual'),String(body.provider||'manual'),body.provider_payment_id||null,body.note||null,Number(auth.user.id)).run(); await env.DB.prepare(`UPDATE billing_invoices SET status='paid',paid_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?1`).bind(Number(invoice.id)).run(); await env.DB.prepare(`UPDATE company_subscriptions SET status='active',updated_at=CURRENT_TIMESTAMP WHERE client_id=?1`).bind(Number(invoice.client_id)).run(); return json({ok:true});
  }

  if (path === '/api/requests' && method === 'GET') {
    const result = await env.DB.prepare(`
      SELECT r.*, e.first_name, e.last_name, e.nickname
      FROM employee_requests r JOIN employees e ON e.id = r.employee_id
      WHERE r.client_id = ?1 ORDER BY r.created_at DESC
    `).bind(clientId).all();
    return json({ data: result.results });
  }

  return json({ error: 'API route not found' }, 404);
}

async function getDashboard(db, clientId, { includeHrCases=false, userId=null }={}) {
  const client = await getClient(db, clientId);
  if (!client) throw new Error('Client not found');
  const today = dateInBangkok();
  const nowIso = new Date().toISOString();

  const [employeesRes, attendanceRes, leaveRes, candidatesRes, requestsRes] = await db.batch([
    db.prepare(`SELECT e.*, d.name AS department_name, p.name AS position_name FROM employees e
                LEFT JOIN departments d ON d.id=e.department_id LEFT JOIN positions p ON p.id=e.position_id
                WHERE e.client_id=?1 AND e.status='active'`).bind(clientId),
    db.prepare(`SELECT * FROM attendance WHERE client_id=?1 AND work_date=?2`).bind(clientId, today),
    db.prepare(`SELECT l.*, e.nickname, e.first_name FROM leave_requests l JOIN employees e ON e.id=l.employee_id
                WHERE l.client_id=?1 AND l.status IN ('pending','awaiting_evidence')`).bind(clientId),
    db.prepare(`SELECT * FROM candidates WHERE client_id=?1`).bind(clientId),
    db.prepare(`SELECT r.*, e.nickname, e.first_name FROM employee_requests r JOIN employees e ON e.id=r.employee_id
                WHERE r.client_id=?1 AND r.status NOT IN ('ready','delivered','closed')`).bind(clientId),
  ]);

  const employees = employeesRes.results || [];
  const attendance = attendanceRes.results || [];
  const leaves = leaveRes.results || [];
  const candidates = candidatesRes.results || [];
  const requests = requestsRes.results || [];
  await ensureDashboardAttentionReady(db);
  const [hrCasesOpenRes,attentionReadRes]=await Promise.all([
    includeHrCases ? db.prepare(`SELECT id,created_at FROM hr_cases WHERE client_id=?1 AND status NOT IN ('resolved','closed')`).bind(clientId).all().catch(()=>({results:[]})) : Promise.resolve({results:[]}),
    userId ? db.prepare(`SELECT attention_key,item_key FROM dashboard_attention_reads WHERE client_id=?1 AND user_id=?2`).bind(clientId,Number(userId)).all().catch(()=>({results:[]})) : Promise.resolve({results:[]}),
  ]);
  const hrCasesOpen = hrCasesOpenRes.results || [];
  const attentionReadSet=new Set((attentionReadRes.results||[]).map(r=>`${String(r.attention_key)}|${String(r.item_key)}`));
  const attendanceByEmployee = new Map(attendance.map(a => [Number(a.employee_id), a]));

  const onLeaveTodayIds = new Set();
  const approvedLeaveToday = await db.prepare(`
    SELECT employee_id FROM leave_requests
    WHERE client_id=?1 AND status='approved' AND start_date <= ?2 AND end_date >= ?2
  `).bind(clientId, today).all();
  for (const row of approvedLeaveToday.results || []) onLeaveTodayIds.add(Number(row.employee_id));

  const weekday=weekdayBangkok(today);
  const [scheduleRows,holidayToday]=await Promise.all([
    db.prepare('SELECT * FROM work_schedule_rules WHERE client_id=?1 AND weekday=?2').bind(clientId,weekday).all(),
    db.prepare('SELECT * FROM company_holidays WHERE client_id=?1 AND holiday_date=?2 LIMIT 1').bind(clientId,today).first(),
  ]);
  const rules=scheduleRows.results||[];
  const employeeExpected=e=>{
    if(holidayToday)return false;
    const employeeRule=rules.find(r=>r.scope_type==='employee'&&Number(r.scope_id)===Number(e.id));
    const deptRule=rules.find(r=>r.scope_type==='department'&&Number(r.scope_id)===Number(e.department_id||0));
    const companyRule=rules.find(r=>r.scope_type==='company'&&Number(r.scope_id)===0);
    const rule=employeeRule||deptRule||companyRule;
    return rule?Boolean(Number(rule.is_workday)):weekday<=5;
  };
  const present = employees.filter(e => { const a=attendanceByEmployee.get(Number(e.id)); return Boolean(a?.check_in_at || ['present','late'].includes(a?.status)); }).length;
  const late = attendance.filter(a => a.status === 'late').length;
  const onLeave = employees.filter(e => onLeaveTodayIds.has(Number(e.id))).length;
  const expectedToday=employees.filter(employeeExpected);
  const missingEmployees = expectedToday.filter(e=>!attendanceByEmployee.get(Number(e.id))?.check_in_at&&!onLeaveTodayIds.has(Number(e.id)));
  const missing = missingEmployees.length;

  const birthdays = upcomingBirthdays(employees, today, Number(client.birthday_reminder_days || 7));
  const probation = employees.filter(e => e.probation_end_date && daysBetween(today, e.probation_end_date) >= 0 && daysBetween(today, e.probation_end_date) <= 14)
    .map(e => ({ id: e.id, name: displayName(e), date: e.probation_end_date, days: daysBetween(today, e.probation_end_date) }));
  const contracts = employees.filter(e => e.contract_end_date && daysBetween(today, e.contract_end_date) >= 0 && daysBetween(today, e.contract_end_date) <= 30)
    .map(e => ({ id: e.id, name: displayName(e), date: e.contract_end_date, days: daysBetween(today, e.contract_end_date) }));
  const staleCandidates = candidates.filter(c => !['hired','rejected'].includes(c.stage) && hoursBetween(c.last_activity_at, nowIso) >= 72)
    .map(c => ({ id: c.id, name: `${c.nickname || c.first_name} · ${c.position_name}`, stage: c.stage, hours: Math.floor(hoursBetween(c.last_activity_at, nowIso)), activity_at: c.last_activity_at || c.created_at }));

  const stages = {};
  for (const c of candidates) stages[c.stage] = (stages[c.stage] || 0) + 1;

  const unreadKeys=(key,keys)=>keys.filter(itemKey=>!attentionReadSet.has(`${key}|${itemKey}`));
  const attentionDefs = [
    { key: 'missing', level: 'danger', label: 'ยังไม่ Check-in', keys: missingEmployees.map(e=>`missing:${today}:${Number(e.id)}`) },
    { key: 'leave_pending', level: 'warning', label: 'ใบลารออนุมัติ', keys: leaves.map(l=>`leave_pending:${Number(l.id)}:${String(l.created_at||l.start_date||'')}`) },
    { key: 'probation', level: 'purple', label: 'Probation ใกล้ครบ', keys: probation.map(e=>`probation:${Number(e.id)}:${String(e.date||'')}`) },
    { key: 'contract', level: 'warning', label: 'สัญญาใกล้หมด', keys: contracts.map(e=>`contract:${Number(e.id)}:${String(e.date||'')}`) },
    { key: 'candidate', level: 'purple', label: 'Candidate รอ Action > 3 วัน', keys: staleCandidates.map(c=>`candidate:${Number(c.id)}:${String(c.activity_at||'')}`) },
    { key: 'hr_private', level: 'danger', label: 'แจ้งเรื่องส่วนตัวถึง HR', keys: hrCasesOpen.map(c=>`hr_private:${Number(c.id)}:${String(c.created_at||'')}`) },
    { key: 'request', level: 'info', label: 'HR Request ค้าง', keys: requests.map(r=>`request:${Number(r.id)}:${String(r.created_at||'')}`) },
  ];
  const attention = attentionDefs.map(def=>{
    const itemKeys=unreadKeys(def.key,def.keys);
    return {key:def.key,level:def.level,label:def.label,count:itemKeys.length,total_count:def.keys.length,item_keys:itemKeys};
  }).filter(x=>x.count>0);

  return {
    client: { id: client.id, name: client.name, work_start: client.work_start, timezone: client.timezone },
    today,
    summary: { employees: employees.length, scheduled_today: expectedToday.length, present, late, leave: onLeave, missing, holiday_name: holidayToday?.name || null },
    attention,
    birthdays,
    probation,
    contracts,
    stale_candidates: staleCandidates,
    recruitment: stages,
    pending_leaves: leaves.slice(0, 6),
    requests: requests.slice(0, 6),
    hr_cases_open: hrCasesOpen.length,
    recent_attendance: attendance.slice(0, 8),
  };
}

async function handleLineWebhook(request, env, ctx, integration = null) {
  const lineCtx = integration || defaultLineContext(env);
  if (!lineCtx?.channelSecret || !lineCtx?.accessToken) return json({ error: 'LINE integration not configured' }, 503);

  const signature = request.headers.get('x-line-signature') || '';
  const rawBody = await request.text();
  const valid = await verifyLineSignature(rawBody, signature, lineCtx.channelSecret);
  if (!valid) return json({ error: 'Invalid LINE signature' }, 401);

  let payload;
  try { payload = JSON.parse(rawBody); } catch { return json({ error: 'Invalid JSON' }, 400); }

  // Acknowledge LINE immediately. Schema preparation and event processing run
  // in waitUntil so LINE's webhook verification never waits on D1 migrations.
  const events = payload.events || [];
  const work = (async () => {
    if (!integration) await ensureLineBusinessOnboardingReady(env.DB);
    else await ensureCoreSchema(env.DB);
    await Promise.all(events.map(async event => {
      try {
        await processLineEvent(event, env, lineCtx);
      } catch (error) {
        console.error(JSON.stringify({level:'error',event:'line_event_failed',type:event?.type||null,message:String(error?.message||error),stack:String(error?.stack||'').slice(0,1600)}));
        if (event?.replyToken) {
          try { await replyLine(lineCtx.accessToken, event.replyToken, 'ระบบนากนะขัดข้องชั่วคราว กรุณาลองส่งข้อความอีกครั้ง'); } catch {}
        }
      }
    }));
  })();
  ctx.waitUntil(work);
  return json({ ok: true, events: events.length });
}

async function showLineLoadingAnimation(accessToken, lineUserId, seconds=5) {
  if (!accessToken || !lineUserId) return false;
  const loadingSeconds = Math.max(5, Math.min(60, Number(seconds) || 5));
  try {
    const response = await fetch('https://api.line.me/v2/bot/chat/loading/start', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ chatId: lineUserId, loadingSeconds }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function processLineEvent(event, env, lineCtx) {
  const lineUserId = event?.source?.userId;
  if (!lineUserId || !event.replyToken) return;
  const accessToken = lineCtx.accessToken;
  const providerScope = lineCtx.providerScope || 'default';
  const sessionKey = lineSessionKey(providerScope, lineUserId);

  // Flex Message buttons use postback actions. LINE's reply can take a moment while
  // D1 / permission / leave calculations run, so show LINE's native loading indicator
  // immediately after the tap. The API supports 5-60 seconds and disappears early
  // as soon as Nakna sends the next message.
  if (event.type === 'postback' && event.source?.type === 'user') {
    await showLineLoadingAnimation(accessToken, lineUserId, 5);
  }

  const employee = async () => {
    if (lineCtx.clientId) {
      return env.DB.prepare(`SELECT e.*, c.name AS company_name FROM employees e JOIN clients c ON c.id=e.client_id WHERE e.client_id=?1 AND e.line_user_id=?2 AND COALESCE(e.line_provider_scope,'default')=?3 AND e.status='active'`).bind(Number(lineCtx.clientId), lineUserId, providerScope).first();
    }

    // A LINE identity can legitimately exist in more than one Workspace.
    // Always prefer the Workspace currently selected by the same Nakna account,
    // otherwise the global OA can accidentally read leave balances from an old/duplicate Workspace.
    const rows=(await env.DB.prepare(`SELECT e.*, c.name AS company_name FROM employees e JOIN clients c ON c.id=e.client_id WHERE e.line_user_id=?1 AND COALESCE(e.line_provider_scope,'default')=?2 AND e.status='active' ORDER BY e.id DESC`).bind(lineUserId,providerScope).all()).results||[];
    if(rows.length<=1) return rows[0]||null;
    const user=await findLineBusinessUser(env.DB,providerScope,lineUserId).catch(()=>null);
    if(user?.id){
      const activeSession=await env.DB.prepare(`SELECT selected_client_id FROM auth_sessions WHERE user_id=?1 AND selected_client_id IS NOT NULL AND expires_at>CURRENT_TIMESTAMP ORDER BY last_seen_at DESC LIMIT 1`).bind(Number(user.id)).first();
      const selectedId=Number(activeSession?.selected_client_id||0);
      const selected=rows.find(row=>Number(row.client_id)===selectedId);
      if(selected) return selected;
      const memberships=(await env.DB.prepare(`SELECT client_id FROM company_members WHERE user_id=?1 AND status='active' ORDER BY id DESC`).bind(Number(user.id)).all()).results||[];
      for(const membership of memberships){const match=rows.find(row=>Number(row.client_id)===Number(membership.client_id));if(match)return match;}
    }
    return rows[0]||null;
  };

  if (event.type === 'message' && event.message?.type === 'text') {
    const text = String(event.message.text || '').trim();

    // LINE-first SaaS onboarding lives on Nakna's global Official Account.
    // It is intentionally handled before employee linking so a brand-new owner
    // can create a Workspace without already having a web account.
    if (!lineCtx.clientId) {
      const handledBusinessOnboarding = await handleLineBusinessOnboardingText({
        text, event, env, lineCtx, lineUserId, accessToken, sessionKey,
      });
      if (handledBusinessOnboarding) return;
    } else if (isBusinessConnectCommand(text)) {
      return replyLineMessages(accessToken, event.replyToken, [
        buildSimpleNoticeFlex('LINE นี้เชื่อมกับบริษัทอยู่แล้ว', 'ถ้าต้องการสร้างหรือเปิดธุรกิจในนากนะ ให้ใช้ LINE Official Account หลักของนากนะ แล้วพิมพ์ “เชื่อมธุรกิจ”', 'teal')
      ]);
    }

    const joinMatch = text.match(/^JOIN\s+([A-Za-z0-9_-]{20,})$/i);
    if (joinMatch) {
      const linked = await linkLineJoinToken(env.DB, accessToken, lineUserId, joinMatch[1], { providerScope, expectedClientId: lineCtx.clientId });
      return replyLineMessages(accessToken,event.replyToken,[
        linked.ok ? buildWelcomeFlex(linked.name,linked.company_name) : buildSimpleNoticeFlex('เชื่อม LINE ไม่สำเร็จ',linked.error,'error')
      ]);
    }
    const linkMatch = text.match(/^LINK\s+(\d{6})$/i);
    if (linkMatch) {
      const linked = await linkLineAccount(env.DB, lineUserId, linkMatch[1], { providerScope, expectedClientId: lineCtx.clientId, accessToken });
      return replyLineMessages(accessToken,event.replyToken,[linked.ok?buildWelcomeFlex(linked.name,linked.company_name||'บริษัทของคุณ'):buildSimpleNoticeFlex('เชื่อม LINE ไม่สำเร็จ',linked.error,'error')]);
    }

    // Owner commands must work even when the same LINE account is also linked
    // as an employee (or is not linked as an employee at all).
    if(isOwnerDashboardCommand(text)){
      const ownerAccess=await getLineOwnerDashboardAccess(env,lineCtx,lineUserId);
      if(ownerAccess) return replyLineMessages(accessToken,event.replyToken,[buildOwnerDashboardFlex(ownerAccess)]);
    }

    // HR/Owner may not have an employee row. Handle the reject-reason continuation
    // before employee-only routing so direct-to-HR leave approvals work for pure admin accounts.
    const adminSession=await getLineSession(env.DB,sessionKey);
    if(adminSession?.action==='leave_hr_reject_reason'){
      try{
        const requestId=Number(adminSession.payload?.request_id||0);
        const admin=await resolveLineLeaveAdmin(env,lineCtx,lineUserId,requestId);
        if(!admin) throw httpError('คุณไม่มีสิทธิ์จัดการคำขอลานี้',403);
        const result=await decideLeaveRequest(env,requestId,'rejected',{actorType:'user',actorUserId:Number(admin.user.id),reason:text,clientId:Number(admin.row.client_id),enforceApprover:false});
        await clearLineSession(env.DB,sessionKey);
        return replyLineMessages(accessToken,event.replyToken,[buildSimpleNoticeFlex('บันทึกผลเรียบร้อยแล้ว',`ไม่อนุมัติคำขอ #LV-${String(result.id).padStart(4,'0')} · ${text}`,'success')]);
      }catch(e){
        if(String(e?.message||'').includes('ไม่ได้รออนุมัติแล้ว')) await clearLineSession(env.DB,sessionKey);
        return replyLine(accessToken,event.replyToken,`❌ ${e.message}`);
      }
    }

    const emp=await employee();
    if(!emp) return replyLineMessages(accessToken,event.replyToken,[buildSimpleNoticeFlex('ยังไม่ได้เชื่อมบัญชี','ถ้าคุณเป็นเจ้าของบริษัทหรือ HR ให้พิมพ์ “เชื่อมธุรกิจ”\nถ้าคุณเป็นพนักงาน ให้เปิดลิงก์เชิญเข้าทีมที่ HR ส่งให้','warning')]);
    const session=await getLineSession(env.DB,sessionKey);

    if(session?.action==='leave_reason'){
      if(text.length<2) return replyLine(accessToken,event.replyToken,'ขอเหตุผลสั้น ๆ อย่างน้อย 2 ตัวอักษรนะ');
      try{
        const payload=session.payload||{};
        const requestRow=await createLeaveRequest(env,{clientId:Number(emp.client_id),employeeId:Number(emp.id),policyId:Number(payload.policy_id),startDate:payload.start_date,endDate:payload.end_date,dayPart:payload.day_part||'full',reason:text,submittedVia:'line'});
        await clearLineSession(env.DB,sessionKey);
        if(requestRow.status==='awaiting_evidence'){
          await setLineSession(env.DB,sessionKey,'leave_evidence',{request_id:requestRow.id,required:true});
          return replyEvidencePrompt(accessToken,event.replyToken,requestRow);
        }
        await notifyLeaveApprover(env,requestRow.id);
        return replyLineMessages(accessToken,event.replyToken,[buildLeaveSubmittedFlex(requestRow)]);
      }catch(e){ await clearLineSession(env.DB,sessionKey); return replyLine(accessToken,event.replyToken,`❌ ${e.message}`); }
    }

    if(session?.action==='leave_reject_reason'){
      try{
        const result=await decideLeaveRequest(env,Number(session.payload?.request_id),'rejected',{actorType:'employee',actorEmployeeId:Number(emp.id),reason:text,clientId:Number(emp.client_id),enforceApprover:true});
        await clearLineSession(env.DB,sessionKey);
        return replyLineMessages(accessToken,event.replyToken,[buildSimpleNoticeFlex('บันทึกผลเรียบร้อยแล้ว',`ไม่อนุมัติคำขอ · ${text}`,'success')]);
      }catch(e){return replyLine(accessToken,event.replyToken,`❌ ${e.message}`);}
    }

    if(session?.action==='hr_case_subject'){
      if(text.length<2) return replyLine(accessToken,event.replyToken,'ขอหัวข้อสั้น ๆ อย่างน้อย 2 ตัวอักษรนะ');
      await setLineSession(env.DB,sessionKey,'hr_case_detail',{subject:text.slice(0,120)});
      return replyLineMessages(accessToken,event.replyToken,[buildSimpleNoticeFlex('เล่ารายละเอียดให้ HR','พิมพ์รายละเอียดที่ต้องการแจ้งได้เลย เรื่องนี้จะแสดงเฉพาะ HR เท่านั้น','teal')]);
    }
    if(session?.action==='hr_case_detail'){
      if(text.length<3) return replyLine(accessToken,event.replyToken,'กรุณาใส่รายละเอียดเพิ่มอีกนิดนะ');
      const row=await createHrCaseFromLine(env,emp,String(session.payload?.subject||'แจ้ง HR'),text);
      await clearLineSession(env.DB,sessionKey);
      return replyLineMessages(accessToken,event.replyToken,[buildHrCaseSubmittedFlex(row)]);
    }

    if(session?.action==='leave_evidence' && ['ข้าม','skip'].includes(text.toLowerCase())){
      if(session.payload?.required) return replyLine(accessToken,event.replyToken,'คำขอนี้ต้องมีหลักฐาน กรุณาส่งรูปหรือไฟล์ก่อนนะ');
      await clearLineSession(env.DB,sessionKey);
      await notifyLeaveApprover(env,Number(session.payload?.request_id));
      return replyLineMessages(accessToken,event.replyToken,[buildSimpleNoticeFlex('ส่งคำขอแล้ว','นากนะส่งคำขอให้ผู้อนุมัติเรียบร้อยแล้ว','success')]);
    }

    const lower=text.toLowerCase();
    if(['เมนู','menu','help','ช่วยเหลือ'].includes(lower)) return replyLineMessages(accessToken,event.replyToken,[await buildEmployeeMenuForLine(env,lineCtx,lineUserId,emp)]);
    if(['ลา','ขอลา','leave','ขอลางาน'].includes(lower)) return sendLeaveTypeMenu(env,event.replyToken,emp,accessToken);
    if(['สิทธิ์ลา','วันลา','leave balance'].includes(lower)) return sendLeaveBalance(env,event.replyToken,emp,accessToken);
    if(['วันหยุด','holiday','holidays','วันหยุดบริษัท'].includes(lower)) return sendCompanyHolidays(env,event.replyToken,emp,accessToken);
    if(['คำขอของฉัน','my requests','คำขอ','สถานะคำขอ'].includes(lower)) return sendEmployeeServiceHistory(env,event.replyToken,emp,accessToken);
    if(['เรียน','เรียนรู้','onboarding','learning','kpi','kpi ของฉัน','เป้าหมาย'].includes(lower)) return sendLearningPortal(env,event.replyToken,emp,accessToken);
    if(['แต้ม','คะแนน','ของรางวัล','reward','rewards','points','อันดับ'].includes(lower)) return sendEngagementPortal(env,event.replyToken,emp,accessToken);
    if(['แจ้ง hr','แจ้งhr','hr','แจ้งปัญหา','ติดต่อ hr'].includes(lower)){
      return sendHrCaseForm(env,event.replyToken,emp,accessToken);
    }
    if(['เช็กอิน','checkin','check-in'].includes(lower)){
      const mustShareLocation=await employeeNeedsLocation(env.DB,emp);
      if(mustShareLocation){ await setLineSession(env.DB,sessionKey,'checkin'); return replyLineWithLocationQuickReply(accessToken,event.replyToken,'📍 แชร์ Location ปัจจุบันเพื่อเช็กอิน\nนากนะจะตรวจเฉพาะ Work Location ที่บริษัทอนุญาต'); }
      try{ const result=await checkIn(env.DB,Number(emp.id),null,null,'line'); return replyLineMessages(accessToken,event.replyToken,[buildAttendanceResultFlex('checkin',result)]);}catch(e){return replyLineMessages(accessToken,event.replyToken,[buildSimpleNoticeFlex('เช็กอินไม่สำเร็จ',e.message,'error')]);}
    }
    if(['เช็กเอาต์','checkout','check-out'].includes(lower)){
      const mustShareLocation=await employeeNeedsLocation(env.DB,emp);
      if(mustShareLocation){ await setLineSession(env.DB,sessionKey,'checkout'); return replyLineWithLocationQuickReply(accessToken,event.replyToken,'📍 แชร์ Location ปัจจุบันเพื่อเช็กเอาต์'); }
      try{const result=await checkOut(env.DB,Number(emp.id),null,null,'line');return replyLineMessages(accessToken,event.replyToken,[buildAttendanceResultFlex('checkout',result)]);}catch(e){return replyLineMessages(accessToken,event.replyToken,[buildSimpleNoticeFlex('เช็กเอาต์ไม่สำเร็จ',e.message,'error')]);}
    }
    if(lower==='สถานะ'){
      const a=await env.DB.prepare('SELECT * FROM attendance WHERE employee_id=?1 AND work_date=?2').bind(Number(emp.id),dateInBangkok()).first();
      return replyLineMessages(accessToken,event.replyToken,[buildEmployeeStatusFlex(emp,a)]);
    }
    return replyLineMessages(accessToken,event.replyToken,[await buildEmployeeMenuForLine(env,lineCtx,lineUserId,emp)]);
  }

  if (event.type==='message' && ['image','file'].includes(event.message?.type)){
    const emp=await employee(); if(!emp) return replyLine(accessToken,event.replyToken,'ยังไม่ได้เชื่อมบัญชีพนักงาน');
    const session=await getLineSession(env.DB,sessionKey);
    if(session?.action!=='leave_evidence') return replyLine(accessToken,event.replyToken,'ได้รับไฟล์แล้ว แต่ตอนนี้ยังไม่มีคำขอที่รอหลักฐาน\nพิมพ์ “ขอลา” เพื่อเริ่มคำขอ');
    try{
      const requestId=Number(session.payload?.request_id);
      await storeLineLeaveEvidence(env,{requestId,employeeId:Number(emp.id),clientId:Number(emp.client_id),message:event.message,accessToken});
      await clearLineSession(env.DB,sessionKey);
      await env.DB.prepare("UPDATE leave_requests SET status=CASE WHEN status='awaiting_evidence' THEN 'pending' ELSE status END,evidence_count=(SELECT COUNT(*) FROM leave_request_evidence WHERE leave_request_id=?1),updated_at=CURRENT_TIMESTAMP WHERE id=?1").bind(requestId).run();
      await notifyLeaveApprover(env,requestId);
      const detail=await hydrateLeaveBalance(env.DB,await getLeaveRequestDetail(env.DB,requestId,Number(emp.client_id)));
      return replyLineMessages(accessToken,event.replyToken,[buildLeaveSubmittedFlex(detail)]);
    }catch(e){return replyLine(accessToken,event.replyToken,`❌ เก็บหลักฐานไม่สำเร็จ: ${e.message}`);}
  }

  if(event.type==='message' && event.message?.type==='location'){
    const emp=await employee(); if(!emp) return replyLine(accessToken,event.replyToken,'ยังไม่ได้เชื่อมบัญชีพนักงาน');
    const session=await getLineSession(env.DB,sessionKey);
    if(!session || new Date(session.expires_at).getTime()<=Date.now()) return replyLineMessages(accessToken,event.replyToken,[buildSimpleNoticeFlex('คำขอหมดเวลาแล้ว','กรุณาเริ่มเช็กอินหรือเช็กเอาต์ใหม่อีกครั้ง','warning')]);
    if(!['checkin','checkout'].includes(session.action)) return;
    try{
      const lat=Number(event.message.latitude),lng=Number(event.message.longitude);
      const result=session.action==='checkin'?await checkIn(env.DB,Number(emp.id),lat,lng,'line'):await checkOut(env.DB,Number(emp.id),lat,lng,'line');
      await clearLineSession(env.DB,sessionKey);
      const label=session.action==='checkin'?'Check-in':'Check-out'; const tm=session.action==='checkin'?result.check_in_at:result.check_out_at;
      return replyLineMessages(accessToken,event.replyToken,[buildAttendanceResultFlex(session.action,result)]);
    }catch(e){return replyLine(accessToken,event.replyToken,`❌ ${e.message}`);}
  }

  if(event.type==='postback'){
    const data=new URLSearchParams(event.postback?.data||''); const action=data.get('action');

    // Direct HR/Owner approval cards are account-level actions and must work even
    // when that administrator is not registered as an employee in this Workspace.
    if(action==='leave_hr_approve'||action==='leave_hr_reject'){
      const requestId=Number(data.get('id')||0);
      try{
        const admin=await resolveLineLeaveAdmin(env,lineCtx,lineUserId,requestId);
        if(!admin) throw httpError('คุณไม่มีสิทธิ์จัดการคำขอลานี้',403);
        if(action==='leave_hr_approve'){
          const result=await decideLeaveRequest(env,requestId,'approved',{actorType:'user',actorUserId:Number(admin.user.id),clientId:Number(admin.row.client_id),enforceApprover:false});
          return replyLineMessages(accessToken,event.replyToken,[buildSimpleNoticeFlex('อนุมัติเรียบร้อยแล้ว',`คำขอ #LV-${String(result.id).padStart(4,'0')} ถูกอนุมัติแล้ว`,'success')]);
        }
        await setLineSession(env.DB,sessionKey,'leave_hr_reject_reason',{request_id:requestId,client_id:Number(admin.row.client_id)});
        return replyLineMessages(accessToken,event.replyToken,[buildSimpleNoticeFlex('ระบุเหตุผลที่ไม่อนุมัติ','พิมพ์เหตุผลส่งเป็นข้อความถัดไป นากนะจะแจ้งกลับให้พนักงานทันที','coral')]);
      }catch(e){return replyLine(accessToken,event.replyToken,`❌ ${e.message}`);}
    }

    const emp=await employee(); if(!emp) return replyLine(accessToken,event.replyToken,'ยังไม่ได้เชื่อมบัญชีพนักงาน');
    if(action==='menu') return replyLineMessages(accessToken,event.replyToken,[await buildEmployeeMenuForLine(env,lineCtx,lineUserId,emp)]);
    if(action==='checkin'||action==='checkout'){ await setLineSession(env.DB,sessionKey,action); return replyLineWithLocationQuickReply(accessToken,event.replyToken,`📍 ส่ง Location ปัจจุบันมาเพื่อ${action==='checkin'?'เช็กอิน':'เช็กเอาต์'}`); }
    if(action==='leave_menu') return sendLeaveTypeMenu(env,event.replyToken,emp,accessToken);
    if(action==='leave_balance') return sendLeaveBalance(env,event.replyToken,emp,accessToken);
    if(action==='holidays') return sendCompanyHolidays(env,event.replyToken,emp,accessToken);
    if(action==='my_requests') return sendEmployeeServiceHistory(env,event.replyToken,emp,accessToken);
    if(action==='learning') return sendLearningPortal(env,event.replyToken,emp,accessToken);
    if(action==='rewards') return sendEngagementPortal(env,event.replyToken,emp,accessToken);
    if(action==='hr_case'){ return sendHrCaseForm(env,event.replyToken,emp,accessToken); }
    if(action==='leave_locked') return replyLineMessages(accessToken,event.replyToken,[buildSimpleNoticeFlex('สิทธิ์ลายังถูกล็อก','สิทธิ์ประเภทนี้จะเปิดหลังผ่านทดลองงาน หรือติดต่อ HR หากต้องการให้เปิดเป็นกรณีพิเศษ','warning')]);
    if(action==='status'){ const a=await env.DB.prepare('SELECT * FROM attendance WHERE employee_id=?1 AND work_date=?2').bind(Number(emp.id),dateInBangkok()).first(); return replyLineMessages(accessToken,event.replyToken,[buildEmployeeStatusFlex(emp,a)]); }
    if(action==='leave_type'){
      const policyId=Number(data.get('policy_id')); const policy=await env.DB.prepare('SELECT * FROM leave_policies WHERE id=?1 AND client_id=?2 AND is_active=1').bind(policyId,Number(emp.client_id)).first();
      if(!policy) return replyLine(accessToken,event.replyToken,'ไม่พบประเภทลานี้');
      await setLineSession(env.DB,sessionKey,'leave_start',{policy_id:policyId});
      return replyLineMessages(accessToken,event.replyToken,[buildDatePickerFlex('เลือกวันเริ่มลา','leave_start',policyId)]);
    }
    if(action==='leave_start'){
      const date=event.postback?.params?.date; const policyId=Number(data.get('policy_id')); if(!date) return replyLine(accessToken,event.replyToken,'กรุณาเลือกวันที่');
      await setLineSession(env.DB,sessionKey,'leave_end',{policy_id:policyId,start_date:date});
      return replyLineMessages(accessToken,event.replyToken,[buildDatePickerFlex(`เริ่ม ${formatThaiDateOnly(date)} · เลือกวันสุดท้าย`,'leave_end',policyId,date)]);
    }
    if(action==='leave_end'){
      const endDate=event.postback?.params?.date; const startDate=data.get('start')||endDate; const policyId=Number(data.get('policy_id'));
      if(!endDate||endDate<startDate) return replyLine(accessToken,event.replyToken,'วันสิ้นสุดต้องไม่น้อยกว่าวันเริ่มลา');
      if(startDate===endDate){
        await setLineSession(env.DB,sessionKey,'leave_daypart',{policy_id:policyId,start_date:startDate,end_date:endDate});
        return replyLineMessages(accessToken,event.replyToken,[buildLeaveDayPartFlex(policyId,startDate,endDate)]);
      }
      await setLineSession(env.DB,sessionKey,'leave_reason',{policy_id:policyId,start_date:startDate,end_date:endDate,day_part:'full'});
      return replyLineMessages(accessToken,event.replyToken,[buildLeaveReasonPromptFlex(startDate,endDate,'full')]);
    }
    if(action==='leave_daypart'){
      const policyId=Number(data.get('policy_id')); const startDate=data.get('start'); const endDate=data.get('end')||startDate; const dayPart=data.get('part')||'full';
      if(!policyId||!startDate) return replyLine(accessToken,event.replyToken,'ข้อมูลคำขอไม่ครบ กรุณาพิมพ์ “ขอลา” ใหม่');
      await setLineSession(env.DB,sessionKey,'leave_reason',{policy_id:policyId,start_date:startDate,end_date:endDate,day_part:dayPart});
      const partLabel=dayPart==='am'?'ครึ่งวันเช้า':dayPart==='pm'?'ครึ่งวันบ่าย':'เต็มวัน';
      return replyLineMessages(accessToken,event.replyToken,[buildLeaveReasonPromptFlex(startDate,endDate,dayPart)]);
    }
    if(action==='leave_attach'){
      const id=Number(data.get('id')); const row=await env.DB.prepare("SELECT * FROM leave_requests WHERE id=?1 AND employee_id=?2 AND status IN ('pending','awaiting_evidence')").bind(id,Number(emp.id)).first(); if(!row) return replyLine(accessToken,event.replyToken,'คำขอนี้แนบหลักฐานไม่ได้แล้ว');
      await setLineSession(env.DB,sessionKey,'leave_evidence',{request_id:id,required:Number(row.evidence_required)===1});
      return replyEvidencePrompt(accessToken,event.replyToken,row);
    }
    if(action==='leave_approve'){
      try{const result=await decideLeaveRequest(env,Number(data.get('id')),'approved',{actorType:'employee',actorEmployeeId:Number(emp.id),clientId:Number(emp.client_id),enforceApprover:true});return replyLineMessages(accessToken,event.replyToken,[buildSimpleNoticeFlex('อนุมัติเรียบร้อยแล้ว',`คำขอ #LV-${String(result.id).padStart(4,'0')} ถูกอนุมัติแล้ว`,'success')]);}catch(e){return replyLine(accessToken,event.replyToken,`❌ ${e.message}`);}
    }
    if(action==='leave_reject'){
      const id=Number(data.get('id')); const row=await env.DB.prepare("SELECT id FROM leave_requests WHERE id=?1 AND approver_employee_id=?2 AND status='pending'").bind(id,Number(emp.id)).first(); if(!row) return replyLine(accessToken,event.replyToken,'คำขอนี้ไม่ได้รอคุณอนุมัติแล้ว');
      await setLineSession(env.DB,sessionKey,'leave_reject_reason',{request_id:id});
      return replyLineMessages(accessToken,event.replyToken,[buildSimpleNoticeFlex('ระบุเหตุผลที่ไม่อนุมัติ','พิมพ์เหตุผลส่งเป็นข้อความถัดไป เพื่อแจ้งกลับให้พนักงาน','coral')]);
    }
  }
}

async function checkIn(db, employeeId, lat, lng, source) {
  const employee = await db.prepare(`
    SELECT e.*, c.work_start, c.work_end, c.late_grace_minutes, c.geofence_lat, c.geofence_lng, c.geofence_radius_m, c.geofence_name, c.allow_checkout_outside_geofence
    FROM employees e JOIN clients c ON c.id=e.client_id WHERE e.id=?1 AND e.status='active'
  `).bind(employeeId).first();
  if (!employee) throw httpError('Employee not found', 404);

  const now = new Date();
  const workDate = dateInBangkok(now);
  const existing = await db.prepare('SELECT * FROM attendance WHERE employee_id=?1 AND work_date=?2').bind(employeeId, workDate).first();
  if (existing?.check_in_at) throw httpError('วันนี้เช็กอินไปแล้ว', 409);

  const matchedLocation = await resolveAllowedWorkLocation(db, employee, lat, lng);
  const schedule = await resolveEffectiveWorkSchedule(db, employee, workDate);
  const lateMinutes = schedule.is_workday ? calculateLateMinutes(now, schedule.start_time, Number(schedule.late_grace_minutes || 0)) : 0;
  const status = lateMinutes > 0 ? 'late' : 'present';
  const nowIso = now.toISOString();

  await db.prepare(`
    INSERT INTO attendance (
      client_id, employee_id, work_date, check_in_at, checkin_lat, checkin_lng, source, status, late_minutes,
      checkin_location_id, checkin_location_name, checkin_distance_m,scheduled_start,scheduled_end,schedule_source
    ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)
    ON CONFLICT(employee_id, work_date) DO UPDATE SET
      check_in_at=excluded.check_in_at, checkin_lat=excluded.checkin_lat, checkin_lng=excluded.checkin_lng,
      source=excluded.source, status=excluded.status, late_minutes=excluded.late_minutes,
      checkin_location_id=excluded.checkin_location_id, checkin_location_name=excluded.checkin_location_name,
      checkin_distance_m=excluded.checkin_distance_m,scheduled_start=excluded.scheduled_start,scheduled_end=excluded.scheduled_end,schedule_source=excluded.schedule_source,updated_at=CURRENT_TIMESTAMP
  `).bind(
    Number(employee.client_id), employeeId, workDate, nowIso, lat ?? null, lng ?? null, source, status, lateMinutes,
    matchedLocation?.id || null, matchedLocation?.name || null, matchedLocation?.distance_m ?? null,
    schedule.start_time || null,schedule.end_time || null,schedule.source
  ).run();

  await audit(db, Number(employee.client_id), source, String(employeeId), 'attendance.check_in', 'attendance', `${employeeId}:${workDate}`, {
    lat, lng, late_minutes: lateMinutes, location_id: matchedLocation?.id || null, location_name: matchedLocation?.name || null,
  });
  return {
    check_in_at: nowIso, work_date: workDate, status, late_minutes: lateMinutes,
    distance_m: matchedLocation?.distance_m ?? null, location_id: matchedLocation?.id || null, location_name: matchedLocation?.name || null,
    scheduled_start: schedule.start_time, scheduled_end: schedule.end_time, schedule_source: schedule.source, is_workday: schedule.is_workday
  };
}

async function checkOut(db, employeeId, lat, lng, source) {
  const employee = await db.prepare(`
    SELECT e.*, c.geofence_lat, c.geofence_lng, c.geofence_radius_m, c.geofence_name, c.allow_checkout_outside_geofence
    FROM employees e JOIN clients c ON c.id=e.client_id WHERE e.id=?1 AND e.status='active'
  `).bind(employeeId).first();
  if (!employee) throw httpError('Employee not found', 404);

  const workDate = dateInBangkok();
  const existing = await db.prepare('SELECT * FROM attendance WHERE employee_id=?1 AND work_date=?2').bind(employeeId, workDate).first();
  if (!existing?.check_in_at) throw httpError('ยังไม่ได้เช็กอินวันนี้', 409);
  if (existing?.check_out_at) throw httpError('วันนี้เช็กเอาต์ไปแล้ว', 409);

  const matchedLocation = await resolveAllowedWorkLocation(db, employee, lat, lng, {allowOutside:Boolean(Number(employee.allow_checkout_outside_geofence||0))});
  const nowIso = new Date().toISOString();
  await db.prepare(`
    UPDATE attendance SET check_out_at=?1, checkout_lat=?2, checkout_lng=?3,
      checkout_location_id=?4, checkout_location_name=?5, checkout_distance_m=?6,checkout_outside_geofence=?7, updated_at=CURRENT_TIMESTAMP
    WHERE employee_id=?8 AND work_date=?9
  `).bind(
    nowIso, lat ?? null, lng ?? null, matchedLocation?.id || null, matchedLocation?.name || null,
    matchedLocation?.distance_m ?? null,matchedLocation?.outside?1:0, employeeId, workDate
  ).run();

  await audit(db, Number(employee.client_id), source, String(employeeId), 'attendance.check_out', 'attendance', `${employeeId}:${workDate}`, {
    lat, lng, location_id: matchedLocation?.id || null, location_name: matchedLocation?.name || null,
  });
  return {
    check_out_at: nowIso, work_date: workDate,
    distance_m: matchedLocation?.distance_m ?? null, location_id: matchedLocation?.id || null, location_name: matchedLocation?.name || null, outside_geofence:Boolean(matchedLocation?.outside)
  };
}

async function resolveEffectiveWorkSchedule(db, employee, workDate) {
  const weekday = weekdayBangkok(workDate);
  const rows = await db.prepare(`SELECT * FROM work_schedule_rules WHERE client_id=?1 AND weekday=?2 AND (
    (scope_type='employee' AND scope_id=?3) OR
    (scope_type='department' AND scope_id=?4) OR
    (scope_type='company' AND scope_id=0)
  ) ORDER BY CASE scope_type WHEN 'employee' THEN 1 WHEN 'department' THEN 2 ELSE 3 END LIMIT 1`).bind(Number(employee.client_id),weekday,Number(employee.id),Number(employee.department_id||0)).all();
  const rule=(rows.results||[])[0];
  const holiday=await db.prepare('SELECT id,name FROM company_holidays WHERE client_id=?1 AND holiday_date=?2 LIMIT 1').bind(Number(employee.client_id),workDate).first();
  if(holiday) return {is_workday:false,start_time:null,end_time:null,late_grace_minutes:0,source:'holiday',holiday_name:holiday.name,weekday};
  if(rule) return {is_workday:Boolean(Number(rule.is_workday)),start_time:rule.start_time,end_time:rule.end_time,late_grace_minutes:Number(rule.late_grace_minutes||0),source:rule.scope_type,weekday};
  return {is_workday:weekday<=5,start_time:employee.work_start||'09:00',end_time:employee.work_end||'18:00',late_grace_minutes:Number(employee.late_grace_minutes||0),source:'company_default',weekday};
}

function weekdayBangkok(dateKey){
  const d=new Date(`${dateKey}T12:00:00+07:00`); const js=d.getUTCDay(); return js===0?7:js;
}

async function employeeNeedsLocation(db, employee) {
  const assigned = await db.prepare(`
    SELECT COUNT(*) AS n FROM employee_work_locations ewl
    JOIN work_locations wl ON wl.id=ewl.location_id AND wl.is_active=1
    WHERE ewl.employee_id=?1
  `).bind(Number(employee.id)).first();
  if (Number(assigned?.n || 0) > 0) return true;
  const companyLocations = await db.prepare('SELECT COUNT(*) AS n FROM work_locations WHERE client_id=?1 AND is_active=1').bind(Number(employee.client_id)).first();
  if (Number(companyLocations?.n || 0) > 0) return true;
  return employee.geofence_lat != null && employee.geofence_lng != null;
}

async function resolveAllowedWorkLocation(db, employee, lat, lng, {allowOutside=false} = {}) {
  const assigned = await db.prepare(`
    SELECT wl.* FROM employee_work_locations ewl
    JOIN work_locations wl ON wl.id=ewl.location_id
    WHERE ewl.employee_id=?1 AND wl.is_active=1
    ORDER BY wl.name
  `).bind(Number(employee.id)).all();
  let locations = assigned.results || [];

  if (!locations.length) {
    const company = await db.prepare('SELECT * FROM work_locations WHERE client_id=?1 AND is_active=1 ORDER BY name').bind(Number(employee.client_id)).all();
    locations = company.results || [];
  }

  if (!locations.length && employee.geofence_lat != null && employee.geofence_lng != null) {
    locations = [{
      id: null,
      name: employee.geofence_name || 'จุดทำงาน',
      latitude: Number(employee.geofence_lat),
      longitude: Number(employee.geofence_lng),
      radius_m: Number(employee.geofence_radius_m || 250),
    }];
  }

  if (!locations.length) return null;
  if (lat == null || lng == null) throw httpError('ต้องแชร์ Location เพื่อเช็กอิน/เอาต์', 400);

  const ranked = locations.map(location => ({
    ...location,
    distance_m: haversineMeters(Number(location.latitude), Number(location.longitude), Number(lat), Number(lng)),
  })).sort((a,b) => a.distance_m - b.distance_m);
  const nearest = ranked[0];
  if (nearest.distance_m > Number(nearest.radius_m || 150)) {
    if(allowOutside) return {...nearest,outside:true};
    throw httpError(`อยู่นอกพื้นที่ ${nearest.name} · ห่าง ${Math.round(nearest.distance_m)} ม. (อนุญาต ${Number(nearest.radius_m || 150)} ม.)`, 403);
  }
  return {...nearest,outside:false};
}

async function getPublicInvite(db, token) {
  const tokenHash = await sha256Hex(token);
  const invite = await db.prepare(`
    SELECT i.*, c.name AS company_name, d.name AS department_name, p.name AS position_name
    FROM employee_invites i
    JOIN clients c ON c.id=i.client_id
    LEFT JOIN departments d ON d.id=i.department_id
    LEFT JOIN positions p ON p.id=i.position_id
    WHERE i.token_hash=?1
  `).bind(tokenHash).first();
  if (!invite) return json({ error: 'INVITE_NOT_FOUND' }, 404);
  const invalid = invite.status !== 'active' || new Date(invite.expires_at).getTime() <= Date.now() || Number(invite.used_count) >= Number(invite.max_uses);
  if (invalid) return json({ error: 'INVITE_EXPIRED', company_name: invite.company_name }, 410);
  const locations = await db.prepare(`
    SELECT wl.id,wl.name,wl.address FROM employee_invite_locations eil
    JOIN work_locations wl ON wl.id=eil.location_id AND wl.is_active=1
    WHERE eil.invite_id=?1 ORDER BY wl.name
  `).bind(Number(invite.id)).all();
  return json({
    invite: {
      company_name: invite.company_name,
      department_name: invite.department_name || null,
      position_name: invite.position_name || null,
      start_date: invite.start_date || null,
      expires_at: invite.expires_at,
      remaining_uses: Math.max(0, Number(invite.max_uses) - Number(invite.used_count)),
      locations: locations.results || [],
    },
  });
}

async function acceptPublicInvite(request, env, token) {
  const tokenHash = await sha256Hex(token);
  const invite = await env.DB.prepare(`
    SELECT i.*, c.name AS company_name FROM employee_invites i
    JOIN clients c ON c.id=i.client_id
    WHERE i.token_hash=?1
  `).bind(tokenHash).first();
  if (!invite) return json({ error: 'ลิงก์เชิญไม่ถูกต้อง' }, 404);
  if (invite.status !== 'active' || new Date(invite.expires_at).getTime() <= Date.now() || Number(invite.used_count) >= Number(invite.max_uses)) {
    return json({ error: 'ลิงก์เชิญหมดอายุหรือถูกใช้ครบแล้ว' }, 410);
  }

  const body = await safeJson(request);
  const firstName = String(body.first_name || '').trim();
  const lastName = String(body.last_name || '').trim();
  const nickname = String(body.nickname || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const phone = String(body.phone || '').trim();
  const birthDate = body.birth_date || null;
  if (firstName.length < 1 || lastName.length < 1 || phone.length < 8) return json({ error: 'กรุณากรอกชื่อ นามสกุล และเบอร์โทรให้ครบ' }, 400);

  const employeeCode = await generateEmployeeCode(env.DB, Number(invite.client_id));
  const startDate = invite.start_date || dateInBangkok();
  let result;
  try {
    await assertSeatCapacity(env.DB,Number(invite.client_id),1);
    result = await env.DB.prepare(`
      INSERT INTO employees (
        client_id,employee_code,first_name,last_name,nickname,email,phone,birth_date,start_date,
        department_id,position_id,employment_type,status,people_status,onboarding_source,emergency_contact_name,emergency_contact_phone
      ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,'full_time','active','probation','invite',?12,?13)
    `).bind(
      Number(invite.client_id), employeeCode, firstName, lastName, nickname || null, email || null, phone,
      birthDate, startDate, invite.department_id || null, invite.position_id || null,
      String(body.emergency_contact_name || '').trim() || null,
      String(body.emergency_contact_phone || '').trim() || null,
    ).run();
  } catch (error) {
    if (/UNIQUE constraint failed: employees\.email/i.test(String(error?.message || error)) && email) {
      return json({ error: 'อีเมลนี้มีอยู่ในบริษัทแล้ว กรุณาติดต่อ HR' }, 409);
    }
    throw error;
  }
  const employeeId = Number(result.meta.last_row_id);
  await ensureV100P4Ready(env.DB);
  await autoAssignLearningForEmployee(env.DB, Number(invite.client_id), employeeId, null);

  const locations = await env.DB.prepare('SELECT location_id FROM employee_invite_locations WHERE invite_id=?1').bind(Number(invite.id)).all();
  for (const row of locations.results || []) {
    await env.DB.prepare('INSERT OR IGNORE INTO employee_work_locations (employee_id,location_id) VALUES (?1,?2)').bind(employeeId, Number(row.location_id)).run();
  }

  const nextUsed = Number(invite.used_count) + 1;
  await env.DB.prepare(`UPDATE employee_invites SET used_count=?1,status=?2,updated_at=CURRENT_TIMESTAMP WHERE id=?3`)
    .bind(nextUsed, nextUsed >= Number(invite.max_uses) ? 'consumed' : 'active', Number(invite.id)).run();

  const lineToken = randomToken(24);
  const lineTokenHash = await sha256Hex(lineToken);
  const lineExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare('INSERT INTO line_join_tokens (token_hash,employee_id,expires_at) VALUES (?1,?2,?3)')
    .bind(lineTokenHash, employeeId, lineExpiresAt).run();

  let lineConnectUrl = null;
  try {
    const lineCtx = await getEffectiveLineContextForClient(env, Number(invite.client_id));
    const bot = lineCtx?.accessToken ? await getLineBotInfo(lineCtx.accessToken) : null;
    if (bot?.basicId) lineConnectUrl = `https://line.me/R/oaMessage/${encodeURIComponent(bot.basicId)}/?${encodeURIComponent(`JOIN ${lineToken}`)}`;
  } catch (error) {
    console.warn(JSON.stringify({ level: 'warn', event: 'line_bot_info_failed', message: String(error?.message || error) }));
  }

  await safeAudit(env.DB, Number(invite.client_id), 'public_invite', String(employeeId), 'employee.self_onboard', 'employee', String(employeeId), { invite_id: Number(invite.id) });
  return json({
    ok: true,
    employee: { id: employeeId, employee_code: employeeCode, name: nickname || firstName, company_name: invite.company_name },
    line_connect_url: lineConnectUrl,
    line_command: `JOIN ${lineToken}`,
    line_token_expires_at: lineExpiresAt,
  }, 201);
}

async function generateEmployeeCode(db, clientId) {
  for (let attempt=0; attempt<5; attempt++) {
    const code = `EMP-${String(clientId).padStart(2,'0')}-${randomToken(4).replace(/[-_]/g,'').slice(0,6).toUpperCase()}`;
    const exists = await db.prepare('SELECT id FROM employees WHERE client_id=?1 AND employee_code=?2').bind(clientId, code).first();
    if (!exists) return code;
  }
  return `EMP-${clientId}-${Date.now().toString(36).toUpperCase()}`;
}

async function getLineBotInfo(accessToken) {
  if (!accessToken) return null;
  const response = await fetch('https://api.line.me/v2/bot/info', { headers: { authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`LINE bot info failed ${response.status}`);
  return response.json();
}

async function getLineProfile(accessToken, userId) {
  if (!accessToken || !userId) return null;
  const response = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(userId)}`, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!response.ok) return null;
  return response.json();
}

async function linkLineJoinToken(db, accessToken, lineUserId, token, { providerScope='default', expectedClientId=null } = {}) {
  const tokenHash = await sha256Hex(token);
  const row = await db.prepare(`
    SELECT t.*, e.id AS employee_id,e.first_name,e.nickname,e.client_id,e.line_user_id,c.name AS company_name
    FROM line_join_tokens t
    JOIN employees e ON e.id=t.employee_id
    JOIN clients c ON c.id=e.client_id
    WHERE t.token_hash=?1 AND t.used_at IS NULL
  `).bind(tokenHash).first();
  if (!row) return { ok:false, error:'ลิงก์เชื่อม LINE ไม่ถูกต้องหรือถูกใช้แล้ว' };
  if (expectedClientId && Number(row.client_id) !== Number(expectedClientId)) return { ok:false, error:'ลิงก์นี้เป็นของคนละบริษัทกับ LINE Official Account นี้' };
  if (new Date(row.expires_at).getTime() <= Date.now()) return { ok:false, error:'ลิงก์เชื่อม LINE หมดอายุแล้ว กรุณาขอลิงก์เชิญใหม่จาก HR' };
  const used = await db.prepare("SELECT id FROM employees WHERE line_user_id=?1 AND COALESCE(line_provider_scope,'default')=?2").bind(lineUserId,providerScope).first();
  if (used && Number(used.id) !== Number(row.employee_id)) return { ok:false, error:'LINE นี้เชื่อมกับพนักงานคนอื่นอยู่แล้ว' };

  const profile = await getLineProfile(accessToken, lineUserId);
  await db.batch([
    db.prepare(`UPDATE employees SET line_user_id=?1,line_provider_scope=?2,line_display_name=?3,line_picture_url=?4,line_linked_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?5`)
      .bind(lineUserId, providerScope, profile?.displayName || null, profile?.pictureUrl || null, Number(row.employee_id)),
    db.prepare('UPDATE line_join_tokens SET used_at=CURRENT_TIMESTAMP WHERE token_hash=?1').bind(tokenHash),
  ]);
  const linkedEmployee = await db.prepare(`SELECT id,client_id,employee_code,first_name,last_name,nickname,email,line_user_id,line_provider_scope,line_display_name,line_picture_url,status FROM employees WHERE id=?1`).bind(Number(row.employee_id)).first();
  if (linkedEmployee) await ensureEmployeeNaknaUser(db, linkedEmployee).catch(error => console.warn(JSON.stringify({level:'warn',event:'employee_line_user_backfill_skip',employee_id:Number(row.employee_id),message:String(error?.message||error)})));
  await safeAudit(db, Number(row.client_id), 'line', lineUserId, 'employee.line_link_invite', 'employee', String(row.employee_id), null);
  return { ok:true, name:row.nickname || row.first_name, company_name:row.company_name };
}


function isBusinessConnectCommand(text){
  const normalized=String(text||'').trim().toLowerCase().replace(/\s+/g,' ');
  return ['เชื่อมธุรกิจ','เชื่อม บริษัท','เชื่อมบริษัท','business','connect business','เปิด hr','เปิดhr'].includes(normalized);
}

function isCreateBusinessCommand(text){
  const normalized=String(text||'').trim().toLowerCase().replace(/\s+/g,' ');
  return ['สร้างธุรกิจ','สร้างบริษัท','สร้าง workspace','create business','create company'].includes(normalized);
}

async function ensureLineBusinessOnboardingReady(db){
  if(SCHEMA_READY.has('line_business')) return;
  if(!db) throw new Error('D1 binding DB is not available');
  const usersReady = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").first();
  if(!usersReady) await db.exec(INIT_AUTH_SCHEMA_SQL);
  await ensureColumns(db,'users',[
    ['line_user_id','TEXT'],
    ['line_provider_scope','TEXT'],
    ['auth_provider',"TEXT NOT NULL DEFAULT 'google'"]
  ]);
  // Business onboarding uses the same short-lived LINE session table as leave flows.
  const lineSessionsReady = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='line_sessions'").first();
  if(!lineSessionsReady) {
    await db.prepare(`CREATE TABLE IF NOT EXISTS line_sessions (
      line_user_id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      payload_json TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`).run();
  } else {
    await ensureColumns(db,'line_sessions',[['payload_json','TEXT']]);
  }
  try{await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_line_identity ON users(line_provider_scope,line_user_id) WHERE line_user_id IS NOT NULL`).run();}catch(error){console.warn(JSON.stringify({level:'warn',event:'line_identity_index_skip',message:String(error?.message||error)}));}
  await db.prepare(`CREATE TABLE IF NOT EXISTS line_admin_login_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
  )`).run();
  try{await db.prepare(`CREATE INDEX IF NOT EXISTS idx_line_admin_login_expiry ON line_admin_login_tokens(user_id,expires_at,used_at)`).run();}catch{}
  SCHEMA_READY.add('line_business');
}

async function findLineBusinessUser(db,providerScope,lineUserId){
  await ensureLineBusinessOnboardingReady(db);
  return db.prepare(`SELECT * FROM users WHERE line_user_id=?1 AND COALESCE(line_provider_scope,'default')=?2 AND status='active' LIMIT 1`)
    .bind(String(lineUserId),String(providerScope||'default')).first();
}

async function ensureLineBusinessUser(env,lineCtx,lineUserId){
  const providerScope=String(lineCtx?.providerScope||'default');
  let user=await findLineBusinessUser(env.DB,providerScope,lineUserId);
  if(user) return user;
  const profile=await getLineProfile(lineCtx.accessToken,lineUserId).catch(()=>null);
  const identityHash=await sha256Hex(`${providerScope}:${lineUserId}`);
  const syntheticSub=`line:${identityHash}`;
  const syntheticEmail=`line-${identityHash.slice(0,32)}@nakna.local`;
  const displayName=String(profile?.displayName||'LINE Owner').trim()||'LINE Owner';
  await env.DB.prepare(`INSERT INTO users (google_sub,email,name,picture_url,locale,status,line_user_id,line_provider_scope,auth_provider)
    VALUES (?1,?2,?3,?4,'th','active',?5,?6,'line')
    ON CONFLICT(google_sub) DO UPDATE SET name=excluded.name,picture_url=excluded.picture_url,status='active',line_user_id=excluded.line_user_id,line_provider_scope=excluded.line_provider_scope,auth_provider='line',updated_at=CURRENT_TIMESTAMP`)
    .bind(syntheticSub,syntheticEmail,displayName,profile?.pictureUrl||null,String(lineUserId),providerScope).run();
  user=await env.DB.prepare('SELECT * FROM users WHERE google_sub=?1').bind(syntheticSub).first();
  if(!user?.id) throw new Error('LINE_OWNER_USER_CREATE_FAILED');
  return user;
}

async function getLineBusinessMemberships(db,userId){
  const rows=await db.prepare(`SELECT c.id,c.name,c.code,m.role,m.created_at FROM company_members m JOIN clients c ON c.id=m.client_id WHERE m.user_id=?1 AND m.status='active' ORDER BY m.id DESC`).bind(Number(userId)).all();
  return rows.results||[];
}

async function findLinkedEmployeeByLine(db,providerScope,lineUserId){
  return db.prepare(`SELECT e.id,e.client_id,e.employee_code,e.first_name,e.last_name,e.nickname,c.name AS company_name
    FROM employees e JOIN clients c ON c.id=e.client_id
    WHERE e.line_user_id=?1 AND COALESCE(e.line_provider_scope,'default')=?2 AND e.status='active'
    ORDER BY e.id DESC LIMIT 1`)
    .bind(String(lineUserId),String(providerScope||'default')).first();
}

async function ensureEmployeeNaknaUser(db, employee){
  if (!employee) return null;
  await ensureLineBusinessOnboardingReady(db);
  const lineUserId = String(employee.line_user_id || '').trim();
  const providerScope = String(employee.line_provider_scope || 'default');
  const employeeEmail = String(employee.email || '').trim().toLowerCase();

  // 1) Existing LINE identity is authoritative.
  if (lineUserId) {
    const byLine = await db.prepare(`SELECT * FROM users WHERE status='active' AND line_user_id=?1 AND COALESCE(line_provider_scope,'default')=?2 LIMIT 1`)
      .bind(lineUserId, providerScope).first();
    if (byLine?.id) return byLine;
  }

  // 2) If the employee already has a Google/Nakna account with the same email, attach LINE to that account.
  if (employeeEmail) {
    const byEmail = await db.prepare(`SELECT * FROM users WHERE status='active' AND LOWER(email)=?1 LIMIT 1`).bind(employeeEmail).first();
    if (byEmail?.id) {
      if (lineUserId && !byEmail.line_user_id) {
        try {
          await db.prepare(`UPDATE users SET line_user_id=?1,line_provider_scope=?2,auth_provider=CASE WHEN auth_provider LIKE '%google%' THEN 'google+line' ELSE 'line' END,name=COALESCE(NULLIF(?3,''),name),picture_url=COALESCE(NULLIF(?4,''),picture_url),updated_at=CURRENT_TIMESTAMP WHERE id=?5`)
            .bind(lineUserId,providerScope,String(employee.line_display_name||employee.nickname||employee.first_name||''),String(employee.line_picture_url||employee.avatar_url||''),Number(byEmail.id)).run();
        } catch (error) {
          // Another canonical account may already own the LINE identity; resolve it instead of failing the Owner flow.
          const canonical = await db.prepare(`SELECT * FROM users WHERE status='active' AND line_user_id=?1 AND COALESCE(line_provider_scope,'default')=?2 LIMIT 1`).bind(lineUserId,providerScope).first();
          if (canonical?.id) return canonical;
          throw error;
        }
        return db.prepare('SELECT * FROM users WHERE id=?1').bind(Number(byEmail.id)).first();
      }
      return byEmail;
    }
  }

  // 3) A LINE-linked employee is already authenticated enough for Workspace access.
  // Backfill the legacy users row so Owner/HR Admin can be granted without forcing another login.
  if (!lineUserId) return null;
  const identityHash = await sha256Hex(`${providerScope}:${lineUserId}`);
  const googleSub = `line:${identityHash}`;
  const email = employeeEmail || `line-${identityHash.slice(0,32)}@nakna.local`;
  const displayName = String(employee.line_display_name || employee.nickname || `${employee.first_name||''} ${employee.last_name||''}`.trim() || 'LINE Employee').trim();
  const picture = String(employee.line_picture_url || employee.avatar_url || '').trim() || null;
  try {
    await db.prepare(`INSERT INTO users (google_sub,email,name,picture_url,locale,status,line_user_id,line_provider_scope,auth_provider)
      VALUES (?1,?2,?3,?4,'th','active',?5,?6,'line')
      ON CONFLICT(google_sub) DO UPDATE SET name=excluded.name,picture_url=COALESCE(excluded.picture_url,users.picture_url),status='active',line_user_id=excluded.line_user_id,line_provider_scope=excluded.line_provider_scope,auth_provider=CASE WHEN users.auth_provider LIKE '%google%' THEN 'google+line' ELSE 'line' END,updated_at=CURRENT_TIMESTAMP`)
      .bind(googleSub,email,displayName,picture,lineUserId,providerScope).run();
  } catch (error) {
    // Email may belong to a Google account created between checks; attach to it instead.
    if (employeeEmail) {
      const raced = await db.prepare(`SELECT * FROM users WHERE status='active' AND LOWER(email)=?1 LIMIT 1`).bind(employeeEmail).first();
      if (raced?.id) {
        if (!raced.line_user_id) await db.prepare(`UPDATE users SET line_user_id=?1,line_provider_scope=?2,auth_provider='google+line',updated_at=CURRENT_TIMESTAMP WHERE id=?3`).bind(lineUserId,providerScope,Number(raced.id)).run();
        return db.prepare('SELECT * FROM users WHERE id=?1').bind(Number(raced.id)).first();
      }
    }
    throw error;
  }
  return db.prepare(`SELECT * FROM users WHERE status='active' AND line_user_id=?1 AND COALESCE(line_provider_scope,'default')=?2 LIMIT 1`).bind(lineUserId,providerScope).first();
}

function isOwnerDashboardCommand(text){
  const normalized=String(text||'').trim().toLowerCase().replace(/\s+/g,' ');
  return ['แดชบอร์ด','dashboard','เปิด dashboard','เปิดแดชบอร์ด','owner dashboard','เจ้าของ','โหมดเจ้าของ','จัดการบริษัท','ฝั่งบริหาร','โหมดบริหาร','ฝ่ายบริหาร','hr','hr admin','ผู้ดูแลระบบ'].includes(normalized);
}

const WORKSPACE_ACCESS_ROLE_META = Object.freeze({
  owner: { label:'Primary Owner', thai:'เจ้าของหลัก', level:100 },
  co_owner: { label:'Co-Owner', thai:'เจ้าของร่วม', level:90 },
  hr_admin: { label:'HR Admin', thai:'ผู้ดูแล HR', level:80 },
  hr: { label:'HR', thai:'HR', level:75 },
  payroll_admin: { label:'Payroll Admin', thai:'ผู้ดูแลเงินเดือน', level:70 },
  manager: { label:'Manager', thai:'หัวหน้าทีม', level:60 },
  approver: { label:'Approver', thai:'ผู้อนุมัติ', level:50 },
  employee: { label:'Employee', thai:'พนักงาน', level:20 },
  viewer: { label:'Viewer', thai:'ผู้ดู', level:10 },
});
const GRANTABLE_WORKSPACE_ROLES = new Set(['co_owner','hr_admin','payroll_admin','manager','approver']);
const DASHBOARD_ACCESS_ROLES = new Set(['owner','co_owner','hr_admin','hr','payroll_admin','manager','approver']);
function workspaceRoleLabel(role){
  const value=String(role||'').toLowerCase();
  const meta=WORKSPACE_ACCESS_ROLE_META[value];
  return meta ? meta.label : (value||'Member');
}
function workspaceRoleThai(role){
  const value=String(role||'').toLowerCase();
  const meta=WORKSPACE_ACCESS_ROLE_META[value];
  return meta ? meta.thai : 'สมาชิก';
}
function isDashboardAccessRole(role){ return DASHBOARD_ACCESS_ROLES.has(String(role||'').toLowerCase()); }
function canManageHrWorkspaceRole(role){ return ['owner','co_owner','hr_admin','hr'].includes(String(role||'').toLowerCase()); }
function canManagePayrollWorkspaceRole(role){ return ['owner','co_owner','hr_admin','hr','payroll_admin'].includes(String(role||'').toLowerCase()); }
async function getPrimaryOwnerUserId(db,clientId){
  const cid=Number(clientId||0); if(!cid) return null;
  const onboarding=await db.prepare(`SELECT owner_user_id FROM company_onboarding WHERE client_id=?1 LIMIT 1`).bind(cid).first().catch(()=>null);
  if(Number(onboarding?.owner_user_id||0)>0){
    const active=await db.prepare(`SELECT 1 AS ok FROM company_members WHERE client_id=?1 AND user_id=?2 AND role='owner' AND status='active' LIMIT 1`).bind(cid,Number(onboarding.owner_user_id)).first().catch(()=>null);
    if(active?.ok) return Number(onboarding.owner_user_id);
  }
  const first=await db.prepare(`SELECT user_id FROM company_members WHERE client_id=?1 AND role='owner' AND status='active' ORDER BY id LIMIT 1`).bind(cid).first().catch(()=>null);
  return Number(first?.user_id||0)||null;
}
async function isPrimaryWorkspaceOwner(db,clientId,userId){
  const primary=await getPrimaryOwnerUserId(db,clientId);
  return Boolean(primary && Number(primary)===Number(userId));
}
async function getEffectiveWorkspaceRole(db,clientId,userId){
  const row=await db.prepare(`SELECT role FROM company_members WHERE client_id=?1 AND user_id=?2 AND status='active' LIMIT 1`).bind(Number(clientId),Number(userId)).first().catch(()=>null);
  if(!row?.role) return null;
  const stored=String(row.role||'').toLowerCase();
  if(stored==='owner'){
    const primary=await getPrimaryOwnerUserId(db,clientId);
    return Number(primary)===Number(userId)?'owner':'co_owner';
  }
  return stored;
}
async function canManageWorkspaceAccess(db,clientId,userId){
  const role=await getEffectiveWorkspaceRole(db,clientId,userId);
  return ['owner','co_owner'].includes(String(role||''));
}
function lineManagementRoleLabel(role){
  const value=String(role||'').toLowerCase();
  if(value==='owner') return 'Primary Owner';
  if(value==='co_owner') return 'Co-Owner';
  if(value==='hr_admin') return 'HR Admin';
  if(value==='hr') return 'HR';
  if(value==='payroll_admin') return 'Payroll Admin';
  if(value==='manager') return 'Manager';
  if(value==='approver') return 'Approver';
  return 'ผู้ดูแล';
}

async function getLineOwnerDashboardAccess(env,lineCtx,lineUserId,preferredClientId=null){
  const providerScope=String(lineCtx?.providerScope||'default');
  let user=await findLineBusinessUser(env.DB,providerScope,lineUserId).catch(()=>null);

  // Legacy employee rows may have LINE linked before the Nakna account layer existed.
  // Backfill the account on demand so Owner/HR permissions are visible in the same LINE card.
  if(!user?.id){
    const params=[String(lineUserId),providerScope];
    let query=`SELECT e.* FROM employees e WHERE e.line_user_id=?1 AND COALESCE(e.line_provider_scope,'default')=?2 AND e.status='active'`;
    if(Number(preferredClientId||0)>0){ query+=` AND e.client_id=?3`; params.push(Number(preferredClientId)); }
    query+=` ORDER BY e.id DESC LIMIT 1`;
    const employeeRow=await env.DB.prepare(query).bind(...params).first().catch(()=>null);
    if(employeeRow) user=await ensureEmployeeNaknaUser(env.DB,employeeRow).catch(()=>null);
  }
  if(!user?.id) return null;

  const memberships=await getLineBusinessMemberships(env.DB,Number(user.id));
  const managed=memberships.filter(row=>isDashboardAccessRole(row.role));
  if(!managed.length) return null;

  const preferred=Number(preferredClientId||0)>0 ? managed.find(row=>Number(row.id)===Number(preferredClientId)) : null;
  const primary=preferred||managed[0];
  const dashboardUrl=await issueLineWebLoginLink(env,Number(user.id),{clientId:Number(primary.id),purpose:'dashboard'});
  return {
    user,
    primary,
    businesses:managed,
    dashboardUrl,
    role:String(primary.role||'').toLowerCase(),
    roleLabel:lineManagementRoleLabel(primary.role),
  };
}

async function buildEmployeeMenuForLine(env,lineCtx,lineUserId,emp){
  const [ownerAccess,portalToken]=await Promise.all([
    getLineOwnerDashboardAccess(env,lineCtx,lineUserId,Number(emp.client_id)).catch(()=>null),
    issueEmployeePortalToken(env.DB,Number(emp.client_id),Number(emp.id)).catch(()=>null),
  ]);
  const base=String(env.APP_BASE_URL||'https://hr-line.organization-23c.workers.dev').replace(/\/$/,'');
  const leaveFormUrl=portalToken?`${base}/leave.html?token=${encodeURIComponent(portalToken)}`:null;
  const hrCaseFormUrl=portalToken?`${base}/hr-case.html?token=${encodeURIComponent(portalToken)}`:null;
  return buildEmployeeMenuFlex(emp,ownerAccess,leaveFormUrl,hrCaseFormUrl);
}

async function createCompanyForLineOwner(env,user,name,lineUserId){
  let code=companyCode(name);
  for(let i=0;i<5;i++){
    const exists=await env.DB.prepare('SELECT id FROM clients WHERE code=?1').bind(code).first();
    if(!exists) break;
    code=`${companyCode(name).slice(0,12)}-${randomToken(3).toUpperCase()}`;
  }
  const created=await env.DB.prepare(`INSERT INTO clients (name,code,timezone,work_start,work_end) VALUES (?1,?2,'Asia/Bangkok','09:00','18:00')`).bind(name,code).run();
  const clientId=Number(created.meta.last_row_id);
  await env.DB.prepare(`INSERT INTO company_members (client_id,user_id,role,status) VALUES (?1,?2,'owner','active')`).bind(clientId,Number(user.id)).run();
  await safeAudit(env.DB,clientId,'line_owner',String(lineUserId),'company.create','client',String(clientId),{name,code,onboarding:'line'});
  // Defaults are best-effort here. /api/bootstrap will repair any module that
  // could not initialize during the webhook request.
  try{
    await ensureCoreSchema(env.DB);
    await ensureDefaultLeavePolicies(env.DB,clientId);
    await ensurePayrollDefaults(env.DB,clientId);
    await ensurePhase5Defaults(env.DB,clientId);
  }catch(error){
    console.error(JSON.stringify({level:'error',event:'line_company_defaults_failed',client_id:clientId,message:String(error?.message||error)}));
  }
  return {id:clientId,name,code,role:'owner'};
}

async function issueLineAdminLoginLink(env,userId,clientId){
  await ensureLineBusinessOnboardingReady(env.DB);
  const token=randomToken(40);
  const tokenHash=await sha256Hex(token);
  const expiresAt=new Date(Date.now()+15*60*1000).toISOString();
  await env.DB.prepare(`DELETE FROM line_admin_login_tokens WHERE user_id=?1 AND used_at IS NULL`).bind(Number(userId)).run();
  await env.DB.prepare(`INSERT INTO line_admin_login_tokens (token_hash,user_id,client_id,expires_at) VALUES (?1,?2,?3,?4)`)
    .bind(tokenHash,Number(userId),Number(clientId),expiresAt).run();
  const base=String(env.APP_BASE_URL||'https://hr-line.organization-23c.workers.dev').replace(/\/$/,'');
  return `${base}/auth/line/start?token=${encodeURIComponent(token)}`;
}

async function finishLineAdminLogin(request,env){
  await ensureLineBusinessOnboardingReady(env.DB);
  const url=new URL(request.url);
  const token=String(url.searchParams.get('token')||'');
  if(token.length<20) return redirectResponse(`${appOrigin(request,env)}/?auth_error=line_token`);
  const tokenHash=await sha256Hex(token);
  const row=await env.DB.prepare(`SELECT t.*,u.status AS user_status FROM line_admin_login_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=?1 AND t.used_at IS NULL`).bind(tokenHash).first();
  if(!row||row.user_status!=='active'||new Date(row.expires_at).getTime()<=Date.now()){
    if(row) await env.DB.prepare(`UPDATE line_admin_login_tokens SET used_at=CURRENT_TIMESTAMP WHERE token_hash=?1`).bind(tokenHash).run();
    return redirectResponse(`${appOrigin(request,env)}/?auth_error=line_token`);
  }
  const membership=await env.DB.prepare(`SELECT role FROM company_members WHERE user_id=?1 AND client_id=?2 AND status='active'`).bind(Number(row.user_id),Number(row.client_id)).first();
  if(!membership) return redirectResponse(`${appOrigin(request,env)}/?auth_error=line_membership`);
  const sessionToken=randomToken(40);
  const sessionHash=await sha256Hex(sessionToken);
  const sessionExpiresAt=new Date(Date.now()+30*24*60*60*1000).toISOString();
  await env.DB.batch([
    env.DB.prepare(`UPDATE line_admin_login_tokens SET used_at=CURRENT_TIMESTAMP WHERE token_hash=?1`).bind(tokenHash),
    env.DB.prepare(`INSERT INTO auth_sessions (token_hash,user_id,selected_client_id,expires_at) VALUES (?1,?2,?3,?4)`).bind(sessionHash,Number(row.user_id),Number(row.client_id),sessionExpiresAt),
  ]);
  const response=redirectResponse(`${appOrigin(request,env)}/?auth=line`,[sessionCookie(sessionToken),companyCookie(Number(row.client_id))]);
  return response;
}


async function issueLineWebLoginLink(env,userId,{clientId=null,purpose='business_setup'}={}){
  await ensureV100P7Ready(env.DB);
  const token=randomToken(40);
  const tokenHash=await sha256Hex(token);
  const expiresAt=new Date(Date.now()+15*60*1000).toISOString();
  // Keep other still-valid cards usable. Older code deleted every unused token
  // for the same purpose, which made Dashboard buttons in previous LINE cards
  // stop working as soon as a new menu was opened.
  await env.DB.prepare(`DELETE FROM line_web_login_tokens WHERE user_id=?1 AND (used_at IS NOT NULL OR expires_at<=?2)`).bind(Number(userId),new Date().toISOString()).run();
  await env.DB.prepare(`INSERT INTO line_web_login_tokens (token_hash,user_id,client_id,purpose,expires_at) VALUES (?1,?2,?3,?4,?5)`)
    .bind(tokenHash,Number(userId),clientId?Number(clientId):null,String(purpose),expiresAt).run();
  const base=String(env.APP_BASE_URL||'https://hr-line.organization-23c.workers.dev').replace(/\/$/,'');
  return `${base}/auth/line/start?token=${encodeURIComponent(token)}`;
}

async function finishLineWebLogin(request,env){
  await ensureV100P7Ready(env.DB);
  const url=new URL(request.url);
  const token=String(url.searchParams.get('token')||'');
  if(token.length<20) return redirectResponse(`${appOrigin(request,env)}/?auth_error=line_token`);
  const tokenHash=await sha256Hex(token);
  const row=await env.DB.prepare(`SELECT t.*,u.status AS user_status FROM line_web_login_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=?1 AND t.used_at IS NULL`).bind(tokenHash).first();
  if(!row){
    // Compatibility with short-lived P6 links while customers update the bot message.
    return finishLineAdminLogin(request,env);
  }
  if(row.user_status!=='active'||new Date(row.expires_at).getTime()<=Date.now()){
    await env.DB.prepare(`UPDATE line_web_login_tokens SET used_at=CURRENT_TIMESTAMP WHERE token_hash=?1`).bind(tokenHash).run();
    return redirectResponse(`${appOrigin(request,env)}/?auth_error=line_token`);
  }
  let selectedClientId=row.client_id?Number(row.client_id):null;
  if(selectedClientId){
    const membership=await env.DB.prepare(`SELECT role FROM company_members WHERE user_id=?1 AND client_id=?2 AND status='active'`).bind(Number(row.user_id),selectedClientId).first();
    if(!membership) selectedClientId=null;
  }
  const sessionToken=randomToken(40);
  const sessionHash=await sha256Hex(sessionToken);
  const sessionExpiresAt=new Date(Date.now()+30*24*60*60*1000).toISOString();
  await env.DB.batch([
    env.DB.prepare(`UPDATE line_web_login_tokens SET used_at=CURRENT_TIMESTAMP WHERE token_hash=?1`).bind(tokenHash),
    env.DB.prepare(`INSERT INTO auth_sessions (token_hash,user_id,selected_client_id,expires_at) VALUES (?1,?2,?3,?4)`).bind(sessionHash,Number(row.user_id),selectedClientId,sessionExpiresAt),
  ]);
  const purpose=String(row.purpose||'');
  const isBusinessSetup=purpose==='business_setup';
  const isGoogleHandoff=purpose==='google_oauth_handoff';
  const isWorkspaceAccess=purpose==='workspace_access';
  const cookies=[sessionCookie(sessionToken)];
  if(isBusinessSetup){cookies.push(clearCookie('nakna_company'));cookies.push(setupModeCookie('new'));}
  else{cookies.push(clearCookie('nakna_setup_mode'));if(selectedClientId)cookies.push(companyCookie(selectedClientId));}
  if(isGoogleHandoff)return redirectResponse(`${appOrigin(request,env)}/integrations/google-workspace/start?handoff=1`,cookies);
  const setup=isBusinessSetup?'&setup=new':'';
  const joined=isWorkspaceAccess?'&workspace=joined':'';
  return redirectResponse(`${appOrigin(request,env)}/?auth=line${setup}${joined}&fresh=p727`,cookies);
}

async function getPublicOnboardingConfig(env){
  const ctx=defaultLineContext(env);
  if(!ctx?.accessToken) return json({line_configured:false,command:'เชื่อมธุรกิจ',line_add_url:null,line_connect_url:null});
  try{
    const bot=await getLineBotInfo(ctx.accessToken);
    const basicId=bot?.basicId||null;
    return json({
      line_configured:Boolean(basicId),
      command:'เชื่อมธุรกิจ',
      basic_id:basicId,
      line_add_url:basicId?`https://line.me/R/ti/p/${encodeURIComponent(basicId)}`:null,
      line_connect_url:basicId?`https://line.me/R/oaMessage/${encodeURIComponent(basicId)}/?${encodeURIComponent('เชื่อมธุรกิจ')}`:null,
    });
  }catch(error){
    console.warn(JSON.stringify({level:'warn',event:'public_line_config_failed',message:String(error?.message||error)}));
    return json({line_configured:false,command:'เชื่อมธุรกิจ',line_add_url:null,line_connect_url:null});
  }
}

async function getPublicDiagnostics(env){
  const started=Date.now();
  const result={
    ok:true,
    version:'1.0-P7.62',
    db:{configured:Boolean(env.DB),ok:false,latency_ms:null},
    line:{secret_present:Boolean(env.LINE_CHANNEL_SECRET),token_present:Boolean(env.LINE_CHANNEL_ACCESS_TOKEN),bot_ok:false,basic_id:null,webhook_endpoint:null,webhook_active:false,error:null},
    google:{client_id_present:Boolean(env.GOOGLE_CLIENT_ID),client_secret_present:Boolean(env.GOOGLE_CLIENT_SECRET),encryption_key_present:Boolean(integrationEncryptionKey(env))}
  };
  if(env.DB){
    const t=Date.now();
    try{await env.DB.prepare('SELECT 1 AS ok').first();result.db.ok=true;}catch(error){result.db.error=safeDbErrorDetail(error);}finally{result.db.latency_ms=Date.now()-t;}
  }
  if(env.LINE_CHANNEL_ACCESS_TOKEN){
    try{
      const bot=await getLineBotInfo(env.LINE_CHANNEL_ACCESS_TOKEN);
      result.line.bot_ok=true;
      result.line.basic_id=bot?.basicId||null;
      const info=await getLineWebhookInfo(env.LINE_CHANNEL_ACCESS_TOKEN).catch(()=>null);
      if(info){result.line.webhook_endpoint=info.endpoint||null;result.line.webhook_active=Boolean(info.active);}
    }catch(error){result.line.error=String(error?.message||error).slice(0,180);}
  }
  result.elapsed_ms=Date.now()-started;
  return json(result);
}

async function handleLineBusinessOnboardingText({text,event,env,lineCtx,lineUserId,accessToken,sessionKey}){
  await ensureV100P7Ready(env.DB);
  const lower=String(text||'').trim().toLowerCase();
  const providerScope=String(lineCtx.providerScope||'default');

  if(isBusinessConnectCommand(text)||isCreateBusinessCommand(text)){
    // P7: LINE is only the identity + entry point. Business creation and Google
    // provisioning happen on the web so customers can see every step/status.
    await clearLineSession(env.DB,sessionKey).catch(()=>{});
    const user=await ensureLineBusinessUser(env,lineCtx,lineUserId);
    const businesses=await getLineBusinessMemberships(env.DB,Number(user.id));
    const linkedEmployee=await findLinkedEmployeeByLine(env.DB,providerScope,lineUserId).catch(()=>null);
    const setupUrl=await issueLineWebLoginLink(env,Number(user.id),{purpose:'business_setup'});
    let dashboardUrl=null;
    if(businesses.length){
      dashboardUrl=await issueLineWebLoginLink(env,Number(user.id),{clientId:Number(businesses[0].id),purpose:'dashboard'});
    }
    await replyLineMessages(accessToken,event.replyToken,[buildBusinessWebSetupFlex({businesses,linkedEmployee,setupUrl,dashboardUrl})]);
    return true;
  }

  if(['ฉันเป็นพนักงาน','เป็นพนักงาน','พนักงาน','employee'].includes(lower)){
    const linkedEmployee=await findLinkedEmployeeByLine(env.DB,providerScope,lineUserId).catch(()=>null);
    if(linkedEmployee){
      await replyLineMessages(accessToken,event.replyToken,[buildSimpleNoticeFlex(
        'บัญชีพนักงานพร้อมใช้งาน',
        `คุณเชื่อมกับ ${linkedEmployee.company_name||'บริษัท'} แล้ว\nใช้เมนู HR ด้านล่างเพื่อเช็กอิน ลา วันหยุด เรียนรู้ และดูข้อมูลของคุณ`,
        'teal'
      )]);
    }else{
      await replyLineMessages(accessToken,event.replyToken,[buildSimpleNoticeFlex(
        'สำหรับพนักงาน',
        'ให้ HR ส่งลิงก์เชิญเข้าทีมให้ก่อน แล้วเปิดลิงก์นั้นเพื่อผูก LINE กับข้อมูลพนักงานของบริษัท',
        'teal'
      )]);
    }
    return true;
  }

  return false;
}

function buildBusinessWebSetupFlex({businesses=[],linkedEmployee=null,setupUrl,dashboardUrl=null}={}){
  const hasBusiness=Array.isArray(businesses)&&businesses.length>0;
  const primaryBusiness=hasBusiness?businesses[0]:null;
  const companyName=primaryBusiness?.name||null;
  const roleLabel=primaryBusiness?lineManagementRoleLabel(primaryBusiness.role):null;
  const body=[];
  if(hasBusiness){
    body.push(lineInfoCard([
      lineInfoRow('บริษัท',companyName||'—'),
      lineInfoRow('สิทธิ์',roleLabel||'Member',LINE_CI.primary),
      ...(businesses.length>1?[lineInfoRow('Workspace ที่เข้าถึง',`${businesses.length} บริษัท`)]:[])
    ],'teal'));
    body.push(lineText('บัญชีนี้มีสิทธิ์ใน Workspace เดิมอยู่แล้ว กดเข้า Dashboard ได้ทันที ไม่ต้องตั้งค่าบริษัทหรือสร้างธุรกิจใหม่','xs',LINE_CI.primaryDark,'bold'));
  }else{
    body.push(lineInfoCard([
      lineInfoRow('1','สร้าง Workspace ใหม่'),
      lineInfoRow('2','เชื่อม Gmail + Drive + Sheets'),
      lineInfoRow('3','เริ่ม Free Trial 30 วัน')
    ],'teal'));
    body.push(lineText('ใช้เส้นทางนี้เฉพาะตอนคุณต้องการสร้างบริษัทใหม่ของตัวเองเท่านั้น','xs',LINE_CI.muted));
  }
  if(linkedEmployee) body.push(lineText(`LINE นี้เป็นพนักงานของ ${linkedEmployee.company_name||'บริษัท'} อยู่ด้วย บทบาทพนักงานกับบทบาทบริหารแยกจากกัน`,'xs',LINE_CI.muted));
  const footer=[];
  if(hasBusiness&&dashboardUrl) footer.push(linePrimaryButton('เปิด Workspace ที่มีสิทธิ์',{type:'uri',label:'เปิด Dashboard',uri:dashboardUrl}));
  if(hasBusiness) footer.push(lineSecondaryButton('สร้าง Workspace ใหม่',{type:'uri',label:'สร้าง Workspace ใหม่',uri:setupUrl},LINE_CI.mintSoft));
  else footer.push(linePrimaryButton('สร้าง Workspace ใหม่',{type:'uri',label:'สร้าง Workspace ใหม่',uri:setupUrl}));
  return {type:'flex',altText:hasBusiness?'เปิด Workspace ที่ได้รับสิทธิ์':'สร้าง Workspace ใหม่ใน Nakna HR',contents:lineBubble({
    eyebrow:hasBusiness?'NAKNA · YOUR WORKSPACE':'NAKNA · NEW WORKSPACE',
    title:hasBusiness?'เข้า Workspace เดิม':'สร้างบริษัทใหม่',
    subtitle:hasBusiness?'สิทธิ์พร้อมแล้ว · ไม่ต้องสร้างธุรกิจซ้ำ':'LINE → New Workspace → Google → HR Dashboard',
    status:hasBusiness?(roleLabel||'Member'):'30-day Trial',statusTone:'success',body,footer
  })};
}

function buildBusinessConnectEmployeeFlex(linkedEmployee){
  const companyName=linkedEmployee?.company_name||'บริษัทที่คุณทำงานอยู่';
  return {type:'flex',altText:'เชื่อมธุรกิจกับนากนะ',contents:lineBubble({
    eyebrow:'NAKNA · BUSINESS',title:'คุณเป็นพนักงานอยู่แล้ว',subtitle:`เชื่อมกับ ${companyName}`,
    body:[
      lineInfoCard([lineInfoRow('สถานะปัจจุบัน','พนักงาน'),lineInfoRow('บริษัท',companyName)],'teal'),
      lineText('ถ้าคุณมีธุรกิจของตัวเองด้วย สามารถสร้าง Workspace ใหม่ได้เลย บัญชี LINE เดียวเป็นได้ทั้งพนักงานและ Owner','xs',LINE_CI.muted)
    ],
    footer:[linePrimaryButton('สร้างธุรกิจใหม่',{type:'message',label:'สร้างธุรกิจใหม่',text:'สร้างธุรกิจ'}),lineSecondaryButton('ใช้ในฐานะพนักงาน',{type:'message',label:'ใช้ในฐานะพนักงาน',text:'ฉันเป็นพนักงาน'})]
  })};
}

function buildBusinessConnectStartFlex(){
  return {type:'flex',altText:'เชื่อมธุรกิจกับนากนะ',contents:lineBubble({
    eyebrow:'NAKNA · BUSINESS',title:'เชื่อมธุรกิจกับนากนะ',subtitle:'เริ่มจาก LINE แล้วค่อยเปิดระบบ HR',
    body:[
      lineInfoCard([lineInfoRow('1','สร้างธุรกิจ'),lineInfoRow('2','ระบบตั้งคุณเป็น Owner'),lineInfoRow('3','กดเปิด HR ได้ทันที')],'teal'),
      lineText('ถ้าคุณเป็นพนักงาน ไม่ต้องสร้างธุรกิจ ให้ใช้ลิงก์เชิญเข้าทีมจาก HR แทน','xs',LINE_CI.muted)
    ],
    footer:[linePrimaryButton('สร้างธุรกิจใหม่',{type:'message',label:'สร้างธุรกิจใหม่',text:'สร้างธุรกิจ'}),lineSecondaryButton('ฉันเป็นพนักงาน',{type:'message',label:'ฉันเป็นพนักงาน',text:'ฉันเป็นพนักงาน'})]
  })};
}

function buildBusinessReadyFlex(company,loginUrl,existing=false,totalCompanies=1){
  return {type:'flex',altText:`${existing?'เปิด':'สร้าง'} ${company.name} ใน Nakna HR`,contents:lineBubble({
    eyebrow:'NAKNA · HR WORKSPACE',title:existing?'ธุรกิจของคุณพร้อมใช้งาน':'สร้างธุรกิจเรียบร้อย 🎉',subtitle:company.name,status:'Owner',statusTone:'success',
    body:[
      lineInfoCard([lineInfoRow('บริษัท',company.name),lineInfoRow('สิทธิ์','Owner',LINE_CI.primary),lineInfoRow('Workspace',company.code||`#${company.id}`)],'teal'),
      ...(totalCompanies>1?[lineText(`บัญชีนี้มี ${totalCompanies} ธุรกิจ · เข้าเว็บแล้วสลับบริษัทได้จากเมนูด้านซ้าย`,'xs',LINE_CI.muted)]:[]),
      lineText('ลิงก์เปิดระบบมีอายุ 15 นาที และใช้ได้ครั้งเดียว เพื่อความปลอดภัย','xxs',LINE_CI.muted)
    ],
    footer:[linePrimaryButton('เปิดระบบ HR',{type:'uri',label:'เปิดระบบ HR',uri:loginUrl}),lineSecondaryButton('สร้างธุรกิจเพิ่ม',{type:'message',label:'สร้างธุรกิจเพิ่ม',text:'สร้างธุรกิจ'})]
  })};
}

function canManagePayroll(role){ return canManagePayrollWorkspaceRole(role); }

function roundMoney(value){ return Math.round((Number(value||0)+Number.EPSILON)*100)/100; }

async function getPayrollPeriodDetail(db,clientId,periodId){
  const period=await db.prepare('SELECT * FROM payroll_periods WHERE id=?1 AND client_id=?2').bind(Number(periodId),Number(clientId)).first();
  if(!period)return {period:null,items:[],adjustments:[]};
  const [items,adjustments,documents]=await db.batch([
    db.prepare(`SELECT pi.*,e.employee_code,e.first_name,e.last_name,e.nickname,e.email,d.name AS department_name,pos.name AS position_name,pp.bank_name,pp.bank_account_no
      FROM payroll_items pi JOIN employees e ON e.id=pi.employee_id LEFT JOIN departments d ON d.id=e.department_id LEFT JOIN positions pos ON pos.id=e.position_id LEFT JOIN employee_payroll_profiles pp ON pp.employee_id=e.id
      WHERE pi.period_id=?1 AND pi.client_id=?2 ORDER BY e.first_name,e.last_name`).bind(Number(periodId),Number(clientId)),
    db.prepare(`SELECT a.*,e.employee_code,e.first_name,e.last_name,e.nickname FROM payroll_adjustments a JOIN employees e ON e.id=a.employee_id WHERE a.period_id=?1 AND a.client_id=?2 ORDER BY a.employee_id,a.id`).bind(Number(periodId),Number(clientId)),
    db.prepare(`SELECT * FROM payroll_documents WHERE period_id=?1 AND client_id=?2`).bind(Number(periodId),Number(clientId)),
  ]);
  return {period,items:items.results||[],adjustments:adjustments.results||[],documents:documents.results||[]};
}

function dateKeysInclusive(startDate,endDate){
  const result=[]; const start=new Date(`${startDate}T12:00:00+07:00`); const end=new Date(`${endDate}T12:00:00+07:00`);
  for(let d=new Date(start);d<=end;d.setUTCDate(d.getUTCDate()+1)) result.push(d.toISOString().slice(0,10));
  return result;
}

function payrollScheduleFor(employee,dateKey,scheduleRows,holidayMap,client){
  const holiday=holidayMap.get(dateKey); if(holiday)return {is_workday:false,source:'holiday',start_time:null,end_time:null};
  const weekday=weekdayBangkok(dateKey);
  const candidates=scheduleRows.filter(r=>Number(r.weekday)===weekday && (
    (r.scope_type==='employee'&&Number(r.scope_id)===Number(employee.id)) ||
    (r.scope_type==='department'&&Number(r.scope_id)===Number(employee.department_id||0)) ||
    (r.scope_type==='company'&&Number(r.scope_id)===0)
  ));
  candidates.sort((a,b)=>({employee:1,department:2,company:3}[a.scope_type]-{employee:1,department:2,company:3}[b.scope_type]));
  const rule=candidates[0];
  if(rule)return {is_workday:Boolean(Number(rule.is_workday)),source:rule.scope_type,start_time:rule.start_time,end_time:rule.end_time};
  return {is_workday:weekday<=5,source:'company_default',start_time:client.work_start||'09:00',end_time:client.work_end||'18:00'};
}

function payrollTaxFromBrackets(netTaxable,brackets){
  let remaining=Math.max(0,Number(netTaxable||0)); let previous=0; let tax=0;
  for(const row of brackets||[]){
    const limit=row.up_to==null?Infinity:Number(row.up_to); const width=limit===Infinity?remaining:Math.max(0,limit-previous); const taxable=Math.min(remaining,width);
    tax+=taxable*Number(row.rate||0); remaining-=taxable; previous=limit; if(remaining<=0)break;
  }
  return roundMoney(tax);
}

async function effectivePayrollRules(db,clientId,period){
  const rows=(await db.prepare(`SELECT * FROM payroll_rule_versions WHERE (client_id=?1 OR client_id IS NULL) AND effective_from<=?2 AND (effective_to IS NULL OR effective_to>=?3) ORDER BY CASE WHEN client_id=?1 THEN 0 ELSE 1 END,effective_from DESC`).bind(Number(clientId),period.period_end,period.period_start).all()).results||[];
  const first=(key)=>rows.find(r=>r.rule_key===key);
  let tax={expense_rate:0.5,expense_cap:100000,personal_allowance:60000,brackets:[{up_to:150000,rate:0},{up_to:300000,rate:.05},{up_to:500000,rate:.10},{up_to:750000,rate:.15},{up_to:1000000,rate:.20},{up_to:2000000,rate:.25},{up_to:5000000,rate:.30},{up_to:null,rate:.35}]};
  let sso={employee_rate:.05,wage_floor:1650,wage_ceiling:17500};
  try{if(first('thai_personal_income_tax'))tax={...tax,...JSON.parse(first('thai_personal_income_tax').config_json)}}catch{}
  try{if(first('thai_social_security'))sso={...sso,...JSON.parse(first('thai_social_security').config_json)}}catch{}
  return {tax,sso,tax_version:first('thai_personal_income_tax')?.version||'TH-2026',sso_version:first('thai_social_security')?.version||'SSO-2026-2028'};
}

async function recalculatePayrollPeriod(env,clientId,periodId){
  await ensurePayrollDefaults(env.DB,clientId); const db=env.DB;
  const period=await db.prepare('SELECT * FROM payroll_periods WHERE id=?1 AND client_id=?2').bind(Number(periodId),Number(clientId)).first(); if(!period)throw httpError('ไม่พบรอบเงินเดือน',404);
  if(['locked','published','void'].includes(period.status))throw httpError('รอบ Payroll นี้ Lock แล้ว',409);
  await ensureV100P5Ready(db);
  await materializePointCashRewardsForPayroll(db,Number(clientId),period);
  const [client,settings,employeesRes,schedulesRes,holidaysRes,attendanceRes,leavesRes,adjustmentsRes,profilesRes,ytdRes]=await Promise.all([
    getClient(db,clientId),
    db.prepare('SELECT * FROM payroll_settings WHERE client_id=?1').bind(Number(clientId)).first(),
    db.prepare(`SELECT e.* FROM employees e WHERE e.client_id=?1 AND e.start_date<=?2 AND (e.end_date IS NULL OR e.end_date>=?3) AND COALESCE(e.people_status,'employee') NOT IN ('candidate') ORDER BY e.id`).bind(Number(clientId),period.period_end,period.period_start).all(),
    db.prepare('SELECT * FROM work_schedule_rules WHERE client_id=?1').bind(Number(clientId)).all(),
    db.prepare('SELECT * FROM company_holidays WHERE client_id=?1 AND holiday_date BETWEEN ?2 AND ?3').bind(Number(clientId),period.period_start,period.period_end).all(),
    db.prepare('SELECT * FROM attendance WHERE client_id=?1 AND work_date BETWEEN ?2 AND ?3').bind(Number(clientId),period.period_start,period.period_end).all(),
    db.prepare(`SELECT lr.*,lp.code AS policy_code,lp.name AS policy_name FROM leave_requests lr LEFT JOIN leave_policies lp ON lp.id=lr.policy_id WHERE lr.client_id=?1 AND lr.status='approved' AND lr.end_date>=?2 AND lr.start_date<=?3`).bind(Number(clientId),period.period_start,period.period_end).all(),
    db.prepare('SELECT * FROM payroll_adjustments WHERE client_id=?1 AND period_id=?2').bind(Number(clientId),Number(periodId)).all(),
    db.prepare('SELECT * FROM employee_payroll_profiles WHERE client_id=?1').bind(Number(clientId)).all(),
    db.prepare(`SELECT pi.employee_id,SUM(MAX(0,pi.gross_income-pi.attendance_deduction)) AS ytd_taxable,SUM(pi.withholding_tax) AS ytd_tax,SUM(pi.social_security) AS ytd_sso
      FROM payroll_items pi JOIN payroll_periods pp ON pp.id=pi.period_id WHERE pi.client_id=?1 AND pp.period_start>=?2 AND pp.period_end<?3 AND pp.status IN ('locked','published') GROUP BY pi.employee_id`).bind(Number(clientId),`${period.period_key.slice(0,4)}-01-01`,period.period_start).all(),
  ]);
  const rules=await effectivePayrollRules(db,clientId,period); const employees=employeesRes.results||[]; const schedules=schedulesRes.results||[]; const holidays=new Map((holidaysRes.results||[]).map(h=>[h.holiday_date,h]));
  const attendance=new Map((attendanceRes.results||[]).map(a=>[`${a.employee_id}:${a.work_date}`,a])); const profiles=new Map((profilesRes.results||[]).map(p=>[Number(p.employee_id),p])); const ytd=new Map((ytdRes.results||[]).map(r=>[Number(r.employee_id),r]));
  const adjustmentsByEmployee=new Map(); for(const a of adjustmentsRes.results||[]){const list=adjustmentsByEmployee.get(Number(a.employee_id))||[];list.push(a);adjustmentsByEmployee.set(Number(a.employee_id),list);}
  const leaveByEmployeeDate=new Map();
  for(const leave of leavesRes.results||[]){
    const from=leave.start_date<period.period_start?period.period_start:leave.start_date; const to=leave.end_date>period.period_end?period.period_end:leave.end_date;
    for(const date of dateKeysInclusive(from,to)) leaveByEmployeeDate.set(`${leave.employee_id}:${date}`,leave);
  }
  const dates=dateKeysInclusive(period.period_start,period.period_end); const cutoff=dateInBangkok()<period.period_end?dateInBangkok():period.period_end; const monthNum=Number(period.period_key.slice(5,7)); const monthsRemaining=Math.max(1,13-monthNum);
  const statements=[db.prepare('DELETE FROM payroll_items WHERE period_id=?1 AND client_id=?2').bind(Number(periodId),Number(clientId))]; let totals={gross:0,deductions:0,net:0,count:0};
  for(const employee of employees){
    const profile=profiles.get(Number(employee.id))||{}; const salary=Math.max(0,Number(profile.base_salary||0)); const divisor=Math.max(1,Number(settings?.daily_rate_divisor||30));
    const activeStart=employee.start_date>period.period_start?employee.start_date:period.period_start; const activeEnd=employee.end_date&&employee.end_date<period.period_end?employee.end_date:period.period_end; const activeCalendarDays=dateKeysInclusive(activeStart,activeEnd).length;
    const fullPeriod=activeStart===period.period_start&&activeEnd===period.period_end; const prorated=fullPeriod?salary:Math.min(salary,roundMoney((salary/divisor)*activeCalendarDays));
    let absentDays=0,lateMinutes=0,scheduledDays=0;
    for(const date of dates){
      if(date<activeStart||date>activeEnd)continue; const schedule=payrollScheduleFor(employee,date,schedules,holidays,client); if(!schedule.is_workday)continue; scheduledDays++;
      const att=attendance.get(`${employee.id}:${date}`); if(att?.check_in_at)lateMinutes+=Number(att.late_minutes||0);
      if(date<=cutoff && !att?.check_in_at){ const leave=leaveByEmployeeDate.get(`${employee.id}:${date}`); if(!leave || String(leave.policy_code||'').toLowerCase().includes('unpaid')) absentDays+=leave&&leave.start_date===leave.end_date&&['am','pm','half'].includes(String(leave.day_part||''))?.5:1; }
    }
    let attendanceDeduction=0; if(Number(settings?.absence_deduction_enabled))attendanceDeduction+=roundMoney((salary/divisor)*absentDays); if(Number(settings?.late_deduction_enabled))attendanceDeduction+=roundMoney(lateMinutes*Number(settings?.late_deduction_per_minute||0));
    let overtime=0,commission=0,incentive=0,allowance=0,bonus=0,otherEarnings=0,otherDeductions=0,taxableAdjustments=0,ssoAdjustments=0,taxManualAdjust=0;
    for(const a of adjustmentsByEmployee.get(Number(employee.id))||[]){const amt=Number(a.amount||0); const category=String(a.category||'other'); if(category==='tax_add'){taxManualAdjust+=amt;continue;} if(category==='tax_reduce'){taxManualAdjust-=amt;continue;} if(a.adjustment_type==='deduction'){otherDeductions+=amt;continue;} if(Number(a.taxable))taxableAdjustments+=amt;if(Number(a.sso_contributable))ssoAdjustments+=amt; switch(category){case'overtime':overtime+=amt;break;case'commission':commission+=amt;break;case'kpi':otherEarnings+=amt;break;case'incentive':incentive+=amt;break;case'allowance':allowance+=amt;break;case'bonus':bonus+=amt;break;default:otherEarnings+=amt;}}
    const gross=roundMoney(prorated+overtime+commission+incentive+allowance+bonus+otherEarnings); const taxableMonthly=Math.max(0,roundMoney(prorated+taxableAdjustments-attendanceDeduction));
    let sso=0; if(Number(settings?.social_security_enabled)&&Number(profile.social_security_enabled??1)){const contributable=Math.max(Number(rules.sso.wage_floor||0),Math.min(Number(rules.sso.wage_ceiling||17500),Math.max(0,prorated+ssoAdjustments))); if(prorated>0)sso=roundMoney(contributable*Number(rules.sso.employee_rate||.05));}
    let withholding=0; if(Number(settings?.tax_enabled)&&Number(profile.tax_enabled??1)){
      if(profile.monthly_tax_override!=null)withholding=Math.max(0,roundMoney(profile.monthly_tax_override)); else {const prior=ytd.get(Number(employee.id))||{}; const projectedIncome=Number(prior.ytd_taxable||0)+taxableMonthly*monthsRemaining; const projectedSso=Number(prior.ytd_sso||0)+sso*monthsRemaining; const expense=Math.min(projectedIncome*Number(rules.tax.expense_rate||.5),Number(rules.tax.expense_cap||100000)); const personal=Math.max(0,Number(profile.personal_allowance??rules.tax.personal_allowance??60000)); const extra=Math.max(0,Number(profile.extra_annual_deductions||0)); const netTaxable=Math.max(0,projectedIncome-expense-personal-extra-projectedSso); const annualTax=payrollTaxFromBrackets(netTaxable,rules.tax.brackets); withholding=roundMoney(Math.max(0,annualTax-Number(prior.ytd_tax||0))/monthsRemaining);}
    }
    withholding=Math.max(0,roundMoney(withholding+taxManualAdjust));
    const deductions=roundMoney(attendanceDeduction+sso+withholding+otherDeductions); const netPay=roundMoney(Math.max(0,gross-deductions)); const breakdown={scheduled_days:scheduledDays,active_calendar_days:activeCalendarDays,tax_rule:rules.tax_version,sso_rule:rules.sso_version,taxable_monthly:taxableMonthly};
    statements.push(db.prepare(`INSERT INTO payroll_items (client_id,period_id,employee_id,base_salary,prorated_salary,absent_days,late_minutes,attendance_deduction,overtime,commission,incentive,allowance,bonus,other_earnings,gross_income,social_security,withholding_tax,other_deductions,total_deductions,net_pay,breakdown_json,calculation_note,status) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,'preview')`).bind(Number(clientId),Number(periodId),Number(employee.id),salary,prorated,absentDays,lateMinutes,attendanceDeduction,overtime,commission,incentive,allowance,bonus,otherEarnings,gross,sso,withholding,otherDeductions,deductions,netPay,JSON.stringify(breakdown),'ภาษีเป็นประมาณการรายเดือนแบบ annualized; HR/Payroll ต้องตรวจสอบก่อน Lock'));
    totals.gross+=gross;totals.deductions+=deductions;totals.net+=netPay;totals.count++;
  }
  statements.push(db.prepare(`UPDATE payroll_periods SET employee_count=?1,gross_total=?2,deduction_total=?3,net_total=?4,updated_at=CURRENT_TIMESTAMP WHERE id=?5 AND client_id=?6`).bind(totals.count,roundMoney(totals.gross),roundMoney(totals.deductions),roundMoney(totals.net),Number(periodId),Number(clientId)));
  await db.batch(statements); return totals;
}

async function fetchNaknaPdfFont(env){
  const url=env.PAYSLIP_FONT_URL||'https://raw.githubusercontent.com/google/fonts/main/ofl/notosansthai/NotoSansThai%5Bwdth,wght%5D.ttf';
  const response=await fetch(url); if(!response.ok)throw new Error(`Payslip font fetch failed: ${response.status}`); return new Uint8Array(await response.arrayBuffer());
}

async function makePayrollPdf({client,employee,period,item,fontBytes,title='สลิปเงินเดือน'}){
  const pdf=await PDFDocument.create(); pdf.registerFontkit(fontkit); const font=await pdf.embedFont(fontBytes,{subset:true}); const page=pdf.addPage([595.28,841.89]); const {width,height}=page.getSize();
  const teal=rgb(22/255,125/255,127/255),dark=rgb(18/255,60/255,74/255),muted=rgb(107/255,120/255,122/255),border=rgb(228/255,234/255,231/255),soft=rgb(248/255,250/255,248/255);
  page.drawRectangle({x:0,y:height-112,width,height:112,color:soft}); page.drawText('นากนะ · NAKNA HR',{x:42,y:height-45,size:11,font,color:teal}); page.drawText(title,{x:42,y:height-78,size:24,font,color:dark}); page.drawText(String(client.name||''),{x:42,y:height-100,size:10,font,color:muted});
  const empName=`${employee.first_name||''} ${employee.last_name||''}`.trim(); page.drawText(empName,{x:42,y:height-148,size:15,font,color:dark}); page.drawText(`${employee.employee_code||''}  ·  ${period.period_key}`,{x:42,y:height-168,size:9,font,color:muted});
  const money=v=>`${Number(v||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})} บาท`; let y=height-214;
  const row=(label,value,{bold=false}={})=>{page.drawText(label,{x:48,y,size:9,font,color:muted});page.drawText(value,{x:360,y,size:bold?11:9,font,color:bold?dark:dark});y-=27;page.drawLine({start:{x:48,y:y+13},end:{x:548,y:y+13},thickness:.6,color:border});};
  page.drawText('รายได้',{x:42,y,size:12,font,color:teal});y-=28; row('เงินเดือนตามรอบ',money(item.prorated_salary)); if(Number(item.overtime))row('OT',money(item.overtime)); if(Number(item.commission))row('Commission',money(item.commission)); if(Number(item.incentive))row('Incentive',money(item.incentive)); if(Number(item.allowance))row('Allowance',money(item.allowance)); if(Number(item.bonus))row('Bonus',money(item.bonus)); if(Number(item.other_earnings))row('รายได้อื่น',money(item.other_earnings)); row('รายได้รวม',money(item.gross_income),{bold:true});
  y-=12;page.drawText('รายการหัก',{x:42,y,size:12,font,color:teal});y-=28; if(Number(item.attendance_deduction))row(`Attendance (${Number(item.absent_days||0)} วัน / สาย ${Number(item.late_minutes||0)} นาที)`,money(item.attendance_deduction)); row('ประกันสังคม',money(item.social_security)); row('ภาษีหัก ณ ที่จ่าย (ประมาณการ)',money(item.withholding_tax)); if(Number(item.other_deductions))row('รายการหักอื่น',money(item.other_deductions)); row('หักรวม',money(item.total_deductions),{bold:true});
  y-=8;page.drawRectangle({x:42,y:y-12,width:506,height:58,color:soft,borderColor:border,borderWidth:1});page.drawText('รับสุทธิ',{x:58,y:y+10,size:12,font,color:dark});page.drawText(money(item.net_pay),{x:350,y:y+7,size:18,font,color:teal});
  page.drawText('เอกสารนี้สร้างจากข้อมูล Payroll ของบริษัท กรุณาติดต่อ HR หากข้อมูลไม่ถูกต้อง',{x:42,y:38,size:7.5,font,color:muted}); return new Uint8Array(await pdf.save());
}

async function ensureDriveChildFolder(accessToken,parentId,name){
  const escaped=String(name).replace(/'/g,"\\'"); const q=`'${parentId}' in parents and name='${escaped}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const found=await googleApiJson(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=10`,accessToken); if(found.files?.[0]?.id)return found.files[0].id;
  const folder=await googleApiJson('https://www.googleapis.com/drive/v3/files?fields=id,name',accessToken,{method:'POST',body:JSON.stringify({name,mimeType:'application/vnd.google-apps.folder',parents:[parentId]})}); return folder.id;
}

async function sendGmailAttachment(accessToken,{to,subject,html,fileName,contentType,bytes}){
  const boundary=`nakna_mail_${randomToken(8)}`; const subjectEncoded=`=?UTF-8?B?${bytesToBase64(new TextEncoder().encode(subject))}?=`; const attachment=bytesToBase64(bytes).replace(/(.{76})/g,'$1\r\n');
  const raw=[`To: ${to}`,`Subject: ${subjectEncoded}`,'MIME-Version: 1.0',`Content-Type: multipart/mixed; boundary="${boundary}"`,'',`--${boundary}`,'Content-Type: text/html; charset=UTF-8','Content-Transfer-Encoding: 8bit','',html,'',`--${boundary}`,`Content-Type: ${contentType}; name="${fileName}"`,'Content-Transfer-Encoding: base64',`Content-Disposition: attachment; filename="${fileName}"`,'',attachment,'',`--${boundary}--`].join('\r\n');
  const response=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{authorization:`Bearer ${accessToken}`,'content-type':'application/json'},body:JSON.stringify({raw:bytesToBase64Url(new TextEncoder().encode(raw))})}); if(!response.ok){let t='';try{t=await response.text()}catch{}throw new Error(`Gmail send failed ${response.status}: ${t.slice(0,200)}`);} return true;
}

function buildPayslipReadyFlex(employee,period,netPay,shareUrl){
  return lineBubble({eyebrow:'PAYROLL',title:'สลิปเงินเดือนพร้อมแล้ว',subtitle:`รอบ ${period.period_key}`,status:'พร้อมดู',statusTone:'success',body:[lineInfoCard([lineInfoRow('พนักงาน',displayName(employee)),lineInfoRow('รับสุทธิ',`${Number(netPay||0).toLocaleString('th-TH',{minimumFractionDigits:2})} บาท`,LINE_CI.success)],'success'),lineText('เอกสารเป็นข้อมูลส่วนตัว กรุณาอย่าส่งต่อลิงก์นี้','xxs',LINE_CI.muted)],footer:[linePrimaryButton('เปิดสลิปเงินเดือน',{type:'uri',label:'เปิดสลิปเงินเดือน',uri:shareUrl})]});
}

async function publishPayrollPeriod(env,clientId,periodId,{notify=true}={}){
  await ensureV100P3Ready(env.DB); const db=env.DB; const detail=await getPayrollPeriodDetail(db,clientId,periodId); if(!detail.period)throw new Error('Payroll period not found'); const client=await getClient(db,clientId); const workspace=await db.prepare(`SELECT * FROM google_workspace_integrations WHERE client_id=?1 AND status='connected'`).bind(Number(clientId)).first(); if(!workspace)throw new Error('Google not connected');
  const accessToken=await getWorkspaceGoogleAccessToken(env,workspace); const fontBytes=await fetchNaknaPdfFont(env); const payrollRoot=await ensureDriveChildFolder(accessToken,workspace.drive_folder_id,'Payroll'); const periodFolder=await ensureDriveChildFolder(accessToken,payrollRoot,detail.period.period_key); const lineCtx=await getEffectiveLineContextForClient(env,clientId); const canEmail=String(workspace.scopes||'').includes('gmail.send');
  for(const item of detail.items){
    try{
      const employee=await db.prepare('SELECT * FROM employees WHERE id=?1 AND client_id=?2').bind(Number(item.employee_id),Number(clientId)).first(); if(!employee)continue; const pdfBytes=await makePayrollPdf({client,employee,period:detail.period,item,fontBytes}); const fileName=`Payslip-${detail.period.period_key}-${employee.employee_code}.pdf`; const uploaded=await uploadGoogleDriveFile(accessToken,{folderId:periodFolder,fileName,contentType:'application/pdf',bytes:pdfBytes}); const digest=await crypto.subtle.digest('SHA-256',pdfBytes); const sha=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join(''); const token=randomToken(32),tokenHash=await sha256Hex(token); const existing=await db.prepare(`SELECT * FROM payroll_documents WHERE period_id=?1 AND employee_id=?2 AND document_type='payslip'`).bind(Number(periodId),Number(employee.id)).first();
      if(existing){await db.prepare(`UPDATE payroll_documents SET payroll_item_id=?1,file_name=?2,drive_file_id=?3,drive_url=?4,sha256=?5,share_token_hash=?6,share_token_value=?7,created_at=CURRENT_TIMESTAMP WHERE id=?8`).bind(Number(item.id),fileName,uploaded.id,uploaded.webViewLink||null,sha,tokenHash,token,Number(existing.id)).run();}
      else await db.prepare(`INSERT INTO payroll_documents (client_id,period_id,payroll_item_id,employee_id,file_name,drive_file_id,drive_url,sha256,share_token_hash,share_token_value) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)`).bind(Number(clientId),Number(periodId),Number(item.id),Number(employee.id),fileName,uploaded.id,uploaded.webViewLink||null,sha,tokenHash,token).run();
      const shareUrl=`${env.APP_BASE_URL||'https://hr-line.organization-23c.workers.dev'}/payslip/${token}`;
      let emailSent=false,lineSent=false;
      if(notify){
        if(employee.email&&canEmail){try{await sendGmailAttachment(accessToken,{to:employee.email,subject:`สลิปเงินเดือน ${detail.period.period_key} · ${client.name}`,html:`<div style="font-family:Arial,sans-serif"><h2>สลิปเงินเดือน ${detail.period.period_key}</h2><p>สวัสดี ${employee.nickname||employee.first_name}</p><p>สลิปเงินเดือนของคุณพร้อมแล้ว เอกสาร PDF แนบมากับอีเมลนี้</p><p>เปิดเอกสารออนไลน์: <a href="${shareUrl}">ดูสลิปเงินเดือน</a></p><p>— Nakna HR</p></div>`,fileName,contentType:'application/pdf',bytes:pdfBytes});emailSent=true;}catch(error){console.error(JSON.stringify({level:'warn',event:'payslip_email_failed',employee_id:employee.id,message:String(error?.message||error)}));}}
        if(employee.line_user_id&&lineCtx?.accessToken){try{await pushLineMessages(lineCtx.accessToken,employee.line_user_id,[buildPayslipReadyFlex(employee,detail.period,item.net_pay,shareUrl)]);lineSent=true;}catch{}}
      }
      await db.prepare(`UPDATE payroll_documents SET email_sent_at=CASE WHEN ?1=1 THEN CURRENT_TIMESTAMP ELSE email_sent_at END,line_notified_at=CASE WHEN ?2=1 THEN CURRENT_TIMESTAMP ELSE line_notified_at END WHERE period_id=?3 AND employee_id=?4`).bind(emailSent?1:0,lineSent?1:0,Number(periodId),Number(employee.id)).run();
    }catch(error){console.error(JSON.stringify({level:'error',event:'payslip_generate_failed',period_id:periodId,employee_id:item.employee_id,message:String(error?.message||error)}));}
  }
  return {ok:true};
}

async function serveSharedPayrollDocument(env,token){
  const hash=await sha256Hex(token); const row=await env.DB.prepare(`SELECT pd.*,pp.period_key,e.employee_code FROM payroll_documents pd JOIN payroll_periods pp ON pp.id=pd.period_id JOIN employees e ON e.id=pd.employee_id WHERE pd.share_token_hash=?1`).bind(hash).first(); if(!row)return new Response('Payslip not found',{status:404}); const workspace=await env.DB.prepare(`SELECT * FROM google_workspace_integrations WHERE client_id=?1 AND status='connected'`).bind(Number(row.client_id)).first(); if(!workspace)return new Response('Document storage unavailable',{status:503}); const accessToken=await getWorkspaceGoogleAccessToken(env,workspace); const response=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(row.drive_file_id)}?alt=media`,{headers:{authorization:`Bearer ${accessToken}`}}); if(!response.ok)return new Response('Payslip not found',{status:404}); const headers=new Headers({'content-type':'application/pdf','cache-control':'private, no-store','content-disposition':`inline; filename="${row.file_name}"`,'x-robots-tag':'noindex,nofollow'}); return new Response(response.body,{headers});
}

async function generateEmployeeCertificate(env,clientId,employeeId,type,userId,note){
  const db=env.DB; const [client,employee,profile,workspace]=await Promise.all([getClient(db,clientId),db.prepare(`SELECT e.*,d.name AS department_name,p.name AS position_name FROM employees e LEFT JOIN departments d ON d.id=e.department_id LEFT JOIN positions p ON p.id=e.position_id WHERE e.id=?1 AND e.client_id=?2`).bind(Number(employeeId),Number(clientId)).first(),db.prepare('SELECT * FROM employee_payroll_profiles WHERE employee_id=?1').bind(Number(employeeId)).first(),db.prepare(`SELECT * FROM google_workspace_integrations WHERE client_id=?1 AND status='connected'`).bind(Number(clientId)).first()]); if(!employee)throw httpError('ไม่พบพนักงาน',404); if(!workspace?.drive_folder_id)throw httpError('กรุณาเชื่อม Google ก่อนออกเอกสาร',409); const accessToken=await getWorkspaceGoogleAccessToken(env,workspace); const fontBytes=await fetchNaknaPdfFont(env); const pdf=await PDFDocument.create(); pdf.registerFontkit(fontkit); const font=await pdf.embedFont(fontBytes,{subset:true}); const page=pdf.addPage([595.28,841.89]); const dark=rgb(18/255,60/255,74/255),teal=rgb(22/255,125/255,127/255),muted=rgb(107/255,120/255,122/255); const title=type==='salary_certificate'?'หนังสือรับรองเงินเดือน':'หนังสือรับรองการทำงาน'; page.drawText('NAKNA HR',{x:48,y:790,size:10,font,color:teal}); page.drawText(title,{x:48,y:748,size:22,font,color:dark}); page.drawText(client.name||'',{x:48,y:722,size:10,font,color:muted}); const name=`${employee.first_name} ${employee.last_name}`; const salary=Number(profile?.base_salary||0).toLocaleString('th-TH',{minimumFractionDigits:2}); const body=type==='salary_certificate'?`ขอรับรองว่า ${name} รหัสพนักงาน ${employee.employee_code} ปฏิบัติงานในตำแหน่ง ${employee.position_name||'-'} แผนก ${employee.department_name||'-'} และมีเงินเดือนประจำ ${salary} บาทต่อเดือน`:`ขอรับรองว่า ${name} รหัสพนักงาน ${employee.employee_code} ปฏิบัติงานกับ ${client.name} ตั้งแต่วันที่ ${employee.start_date||'-'} ในตำแหน่ง ${employee.position_name||'-'} แผนก ${employee.department_name||'-'}`; const lines=wrapTextSimple(body,78); let y=660; for(const line of lines){page.drawText(line,{x:58,y,size:11,font,color:dark});y-=24;} if(note){y-=15;for(const line of wrapTextSimple(`หมายเหตุ: ${note}`,75)){page.drawText(line,{x:58,y,size:9,font,color:muted});y-=20;}} page.drawText(`ออกเอกสารวันที่ ${dateInBangkok()}`,{x:58,y:140,size:9,font,color:muted}); page.drawText('เอกสารออกโดยระบบ Nakna HR',{x:58,y:118,size:8,font,color:muted}); const bytes=new Uint8Array(await pdf.save()); const docsRoot=await ensureDriveChildFolder(accessToken,workspace.drive_folder_id,'Employee Documents'); const empFolder=await ensureDriveChildFolder(accessToken,docsRoot,`${employee.employee_code} - ${employee.nickname||employee.first_name}`); const fileName=`${type}-${employee.employee_code}-${dateInBangkok()}.pdf`; const uploaded=await uploadGoogleDriveFile(accessToken,{folderId:empFolder,fileName,contentType:'application/pdf',bytes}); const result=await db.prepare(`INSERT INTO employee_documents (client_id,employee_id,document_type,title,file_name,drive_file_id,drive_url,content_type,document_date,visibility,note,created_by_user_id) VALUES (?1,?2,?3,?4,?5,?6,?7,'application/pdf',?8,'employee',?9,?10)`).bind(Number(clientId),Number(employeeId),type,title,fileName,uploaded.id,uploaded.webViewLink||null,dateInBangkok(),note||null,Number(userId)).run(); return {id:Number(result.meta.last_row_id),title,file_name:fileName,drive_url:uploaded.webViewLink||null};
}

function wrapTextSimple(text,maxChars){const words=String(text||'').split(/\s+/);const lines=[];let line='';for(const word of words){if((line+' '+word).trim().length>maxChars&&line){lines.push(line);line=word;}else line=(line+' '+word).trim();}if(line)lines.push(line);return lines;}


function canViewEngagement(role){ return ['owner','co_owner','hr_admin','hr','manager','viewer'].includes(String(role||'')); }
function canManageEngagement(role){ return ['owner','co_owner','hr_admin','hr'].includes(String(role||'')); }
function canViewAnalytics(role){ return ['owner','co_owner','hr_admin','hr','manager','viewer'].includes(String(role||'')); }
function isNaknaSaasAdmin(env,email){
  const allowed=String(env.NAKNA_ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  return Boolean(email&&allowed.includes(String(email).trim().toLowerCase()));
}

async function ensurePointWallet(db,clientId,employeeId){
  await db.prepare(`INSERT OR IGNORE INTO employee_point_wallets (client_id,employee_id) VALUES (?1,?2)`).bind(Number(clientId),Number(employeeId)).run();
  return db.prepare('SELECT * FROM employee_point_wallets WHERE client_id=?1 AND employee_id=?2').bind(Number(clientId),Number(employeeId)).first();
}

async function addPointTransaction(db,{clientId,employeeId,ruleId=null,transactionType='earn',points=0,cashValue=0,referenceType=null,referenceId=null,idempotencyKey=null,note=null,createdByUserId=null}){
  const cid=Number(clientId),eid=Number(employeeId),pts=Number(points||0),cash=Math.max(0,Number(cashValue||0));
  await ensurePointWallet(db,cid,eid);
  if(idempotencyKey){
    const existing=await db.prepare('SELECT id FROM point_transactions WHERE client_id=?1 AND idempotency_key=?2').bind(cid,String(idempotencyKey)).first();
    if(existing){const wallet=await ensurePointWallet(db,cid,eid);return {transaction_id:Number(existing.id),wallet,duplicate:true};}
  }
  const wallet=await ensurePointWallet(db,cid,eid);
  if(pts<0 && Number(wallet.balance||0)+pts<-.0001) throw httpError('แต้มไม่เพียงพอ',409);
  let result;
  try{
    result=await db.prepare(`INSERT INTO point_transactions (client_id,employee_id,rule_id,transaction_type,points,cash_value,reference_type,reference_id,idempotency_key,note,created_by_user_id) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)`)
      .bind(cid,eid,ruleId?Number(ruleId):null,transactionType,pts,cash,referenceType||null,referenceId==null?null:String(referenceId),idempotencyKey||null,note||null,createdByUserId?Number(createdByUserId):null).run();
  }catch(error){
    if(idempotencyKey&&/UNIQUE/i.test(String(error?.message||error))){const existing=await db.prepare('SELECT id FROM point_transactions WHERE client_id=?1 AND idempotency_key=?2').bind(cid,String(idempotencyKey)).first();return {transaction_id:Number(existing?.id||0),wallet:await ensurePointWallet(db,cid,eid),duplicate:true};}
    throw error;
  }
  await db.prepare(`UPDATE employee_point_wallets SET balance=balance+?1,lifetime_earned=lifetime_earned+CASE WHEN ?1>0 THEN ?1 ELSE 0 END,lifetime_spent=lifetime_spent+CASE WHEN ?1<0 THEN -?1 ELSE 0 END,updated_at=CURRENT_TIMESTAMP WHERE client_id=?2 AND employee_id=?3`).bind(pts,cid,eid).run();
  return {transaction_id:Number(result.meta.last_row_id),wallet:await ensurePointWallet(db,cid,eid),duplicate:false};
}

async function awardEventRules(db,clientId,employeeId,eventType,referenceId,note){
  await ensurePhase5Defaults(db,clientId);
  const rules=(await db.prepare(`SELECT * FROM point_rules WHERE client_id=?1 AND is_active=1 AND event_type=?2 ORDER BY id`).bind(Number(clientId),String(eventType)).all()).results||[];
  let awarded=0;
  for(const rule of rules){
    const key=`rule:${rule.id}:${eventType}:${employeeId}:${referenceId}`;
    const r=await addPointTransaction(db,{clientId,employeeId,ruleId:rule.id,transactionType:'earn',points:Number(rule.points||0),cashValue:Number(rule.cash_value||0),referenceType:eventType,referenceId,idempotencyKey:key,note:note||rule.name});
    if(!r.duplicate)awarded++;
  }
  return awarded;
}

async function runEngagementAutomationForClient(db,clientId){
  await ensurePhase5Defaults(db,clientId); const cid=Number(clientId),today=dateInBangkok(),year=today.slice(0,4);
  const rules=(await db.prepare(`SELECT * FROM point_rules WHERE client_id=?1 AND is_active=1 ORDER BY id`).bind(cid).all()).results||[];
  const employees=(await db.prepare(`SELECT id,birth_date,start_date,first_name,last_name,nickname FROM employees WHERE client_id=?1 AND status='active' AND COALESCE(people_status,'employee') IN ('probation','employee','leave_of_absence')`).bind(cid).all()).results||[];
  let awarded=0;
  for(const rule of rules){
    if(rule.event_type==='attendance_streak'){
      const threshold=Math.max(1,Number(rule.threshold_count||1)); const effective=rule.effective_from||'2000-01-01';
      for(const emp of employees){
        const countRow=await db.prepare(`SELECT COUNT(*) AS n FROM attendance WHERE client_id=?1 AND employee_id=?2 AND work_date>=?3 AND work_date<=?4 AND check_in_at IS NOT NULL AND COALESCE(late_minutes,0)=0 AND COALESCE(status,'present') NOT IN ('leave','absent')`).bind(cid,Number(emp.id),effective,today).first();
        const blocks=Math.floor(Number(countRow?.n||0)/threshold);
        for(let b=1;b<=blocks;b++){
          const r=await addPointTransaction(db,{clientId:cid,employeeId:emp.id,ruleId:rule.id,points:Number(rule.points||0),cashValue:Number(rule.cash_value||0),referenceType:'attendance_streak',referenceId:`block-${b}`,idempotencyKey:`rule:${rule.id}:attendance:${emp.id}:block:${b}`,note:`${rule.name} · ครั้งที่ ${b*threshold}`}); if(!r.duplicate)awarded++;
        }
      }
    }
    if(rule.event_type==='birthday'){
      for(const emp of employees){if(!emp.birth_date||String(emp.birth_date).slice(5)!==today.slice(5))continue;const r=await addPointTransaction(db,{clientId:cid,employeeId:emp.id,ruleId:rule.id,points:Number(rule.points||0),cashValue:Number(rule.cash_value||0),referenceType:'birthday',referenceId:year,idempotencyKey:`rule:${rule.id}:birthday:${emp.id}:${year}`,note:`${rule.name} ${emp.nickname||emp.first_name}`});if(!r.duplicate)awarded++;}
    }
    if(rule.event_type==='work_anniversary'){
      for(const emp of employees){if(!emp.start_date||String(emp.start_date).slice(5)!==today.slice(5)||String(emp.start_date).slice(0,4)>=year)continue;const years=Number(year)-Number(String(emp.start_date).slice(0,4));const r=await addPointTransaction(db,{clientId:cid,employeeId:emp.id,ruleId:rule.id,points:Number(rule.points||0),cashValue:Number(rule.cash_value||0),referenceType:'work_anniversary',referenceId:year,idempotencyKey:`rule:${rule.id}:anniversary:${emp.id}:${year}`,note:`${rule.name} · ${years} ปี`});if(!r.duplicate)awarded++;}
    }
  }
  return {awarded};
}

async function getEngagementOverview(db,clientId){
  const cid=Number(clientId); await ensurePhase5Defaults(db,cid); await runEngagementAutomationForClient(db,cid);
  const [settings,rules,rewards,redemptions,leaderboard,tx,pendingCash]=await Promise.all([
    db.prepare('SELECT * FROM engagement_settings WHERE client_id=?1').bind(cid).first(),
    db.prepare('SELECT * FROM point_rules WHERE client_id=?1 ORDER BY is_active DESC,id').bind(cid).all(),
    db.prepare('SELECT * FROM reward_catalog WHERE client_id=?1 ORDER BY status,id DESC').bind(cid).all(),
    db.prepare(`SELECT rr.*,rc.title AS reward_title,rc.reward_type,e.employee_code,e.first_name,e.last_name,e.nickname FROM reward_redemptions rr JOIN reward_catalog rc ON rc.id=rr.reward_id JOIN employees e ON e.id=rr.employee_id WHERE rr.client_id=?1 ORDER BY rr.requested_at DESC LIMIT 100`).bind(cid).all(),
    db.prepare(`SELECT w.*,e.employee_code,e.first_name,e.last_name,e.nickname,d.name AS department_name FROM employee_point_wallets w JOIN employees e ON e.id=w.employee_id LEFT JOIN departments d ON d.id=e.department_id WHERE w.client_id=?1 AND e.status='active' ORDER BY w.balance DESC,w.lifetime_earned DESC LIMIT 30`).bind(cid).all(),
    db.prepare(`SELECT t.*,e.employee_code,e.first_name,e.last_name,e.nickname,r.name AS rule_name FROM point_transactions t JOIN employees e ON e.id=t.employee_id LEFT JOIN point_rules r ON r.id=t.rule_id WHERE t.client_id=?1 ORDER BY t.created_at DESC LIMIT 100`).bind(cid).all(),
    db.prepare(`SELECT COALESCE(SUM(cash_value),0) AS amount,COUNT(*) AS n FROM point_transactions WHERE client_id=?1 AND cash_value>0 AND payroll_adjustment_id IS NULL`).bind(cid).first(),
  ]);
  const leaderboardRows=leaderboard.results||[]; const wallets=await db.prepare('SELECT COALESCE(SUM(balance),0) AS outstanding,COALESCE(SUM(lifetime_earned),0) AS earned FROM employee_point_wallets WHERE client_id=?1').bind(cid).first();
  return {settings,rules:rules.results||[],rewards:rewards.results||[],redemptions:redemptions.results||[],leaderboard:leaderboardRows,recent_transactions:tx.results||[],summary:{points_outstanding:Number(wallets?.outstanding||0),lifetime_earned:Number(wallets?.earned||0),active_rewards:(rewards.results||[]).filter(x=>x.status==='active').length,pending_redemptions:(redemptions.results||[]).filter(x=>x.status==='pending').length,pending_cash_payroll:Number(pendingCash?.amount||0),pending_cash_count:Number(pendingCash?.n||0)}};
}

async function requestRewardRedemption(db,clientId,employeeId,rewardId,note=''){
  const cid=Number(clientId),eid=Number(employeeId),rid=Number(rewardId); await ensurePhase5Defaults(db,cid);
  const reward=await db.prepare(`SELECT * FROM reward_catalog WHERE id=?1 AND client_id=?2 AND status='active'`).bind(rid,cid).first(); if(!reward)throw httpError('ไม่พบของรางวัลหรือปิดใช้งานแล้ว',404); if(reward.stock_qty!=null&&Number(reward.stock_qty)<=0)throw httpError('ของรางวัลหมดแล้ว',409);
  const wallet=await ensurePointWallet(db,cid,eid); const cost=Math.max(0,Number(reward.points_cost||0)); if(Number(wallet.balance||0)<cost)throw httpError(`แต้มไม่พอ ต้องใช้ ${cost.toLocaleString('th-TH')} แต้ม`,409);
  const insert=await db.prepare(`INSERT INTO reward_redemptions (client_id,employee_id,reward_id,points_cost,cash_value,status,employee_note) VALUES (?1,?2,?3,?4,?5,'pending',?6)`).bind(cid,eid,rid,cost,Number(reward.cash_value||0),note||null).run(); const redemptionId=Number(insert.meta.last_row_id);
  try{await addPointTransaction(db,{clientId:cid,employeeId:eid,transactionType:'spend',points:-cost,referenceType:'reward_redemption',referenceId:redemptionId,idempotencyKey:`redemption:${redemptionId}:spend`,note:`แลก ${reward.title}`});}
  catch(error){await db.prepare('DELETE FROM reward_redemptions WHERE id=?1').bind(redemptionId).run();throw error;}
  return {id:redemptionId,reward,wallet:await ensurePointWallet(db,cid,eid)};
}

async function decideRewardRedemption(env,clientId,redemptionId,action,userId,note=''){
  const db=env.DB,cid=Number(clientId),id=Number(redemptionId); const row=await db.prepare(`SELECT rr.*,rc.title,rc.reward_type,rc.stock_qty,rc.status AS reward_status,e.line_user_id,e.line_provider_scope,e.first_name,e.nickname FROM reward_redemptions rr JOIN reward_catalog rc ON rc.id=rr.reward_id JOIN employees e ON e.id=rr.employee_id WHERE rr.id=?1 AND rr.client_id=?2`).bind(id,cid).first(); if(!row)throw httpError('ไม่พบรายการแลก',404);
  if(action==='reject'){
    if(row.status!=='pending')throw httpError('รายการนี้ไม่ได้รออนุมัติแล้ว',409); await db.prepare(`UPDATE reward_redemptions SET status='rejected',hr_note=?1,decided_at=CURRENT_TIMESTAMP,decided_by_user_id=?2 WHERE id=?3`).bind(note||null,Number(userId),id).run(); await addPointTransaction(db,{clientId:cid,employeeId:row.employee_id,transactionType:'refund',points:Number(row.points_cost||0),referenceType:'reward_redemption',referenceId:id,idempotencyKey:`redemption:${id}:refund`,note:`คืนแต้มจาก ${row.title}`}); await notifyRewardDecision(env,row,'rejected',note); return {status:'rejected'};
  }
  if(action==='approve'){
    if(row.status!=='pending')throw httpError('รายการนี้ไม่ได้รออนุมัติแล้ว',409); if(row.stock_qty!=null&&Number(row.stock_qty)<=0)throw httpError('ของรางวัลหมดแล้ว',409); await db.prepare(`UPDATE reward_redemptions SET status='approved',hr_note=?1,decided_at=CURRENT_TIMESTAMP,decided_by_user_id=?2 WHERE id=?3`).bind(note||null,Number(userId),id).run(); if(row.stock_qty!=null)await db.prepare(`UPDATE reward_catalog SET stock_qty=MAX(0,stock_qty-1),updated_at=CURRENT_TIMESTAMP WHERE id=?1`).bind(Number(row.reward_id)).run(); if(Number(row.cash_value||0)>0){const tx=await addPointTransaction(db,{clientId:cid,employeeId:row.employee_id,transactionType:'earn',points:0,cashValue:Number(row.cash_value),referenceType:'reward_cash',referenceId:id,idempotencyKey:`redemption:${id}:cash`,note:`Cash reward · ${row.title}`,createdByUserId:userId}); await db.prepare(`UPDATE reward_redemptions SET payroll_adjustment_id=(SELECT payroll_adjustment_id FROM point_transactions WHERE id=?1) WHERE id=?2`).bind(Number(tx.transaction_id),id).run();}
    await notifyRewardDecision(env,row,'approved',note); return {status:'approved'};
  }
  if(action==='deliver'){
    if(!['approved','pending'].includes(String(row.status)))throw httpError('รายการนี้ส่งมอบไม่ได้',409); if(row.status==='pending')throw httpError('ต้องอนุมัติก่อนส่งมอบ',409); await db.prepare(`UPDATE reward_redemptions SET status='delivered',delivered_at=CURRENT_TIMESTAMP,hr_note=COALESCE(?1,hr_note) WHERE id=?2`).bind(note||null,id).run(); await notifyRewardDecision(env,row,'delivered',note); return {status:'delivered'};
  }
  throw httpError('Action ไม่ถูกต้อง',400);
}

async function notifyRewardDecision(env,row,status,note=''){
  if(!row.line_user_id)return false; const token=await getAccessTokenForProviderScope(env,Number(row.client_id),row.line_provider_scope); if(!token)return false; const title=status==='approved'?'อนุมัติของรางวัลแล้ว':status==='delivered'?'รับของรางวัลเรียบร้อย':'รายการแลกไม่ผ่าน'; const tone=status==='rejected'?'error':'success'; await pushLineMessages(token,row.line_user_id,[{type:'flex',altText:title,contents:lineBubble({eyebrow:'NAKNA REWARDS',title,subtitle:row.title,status:status==='rejected'?'ไม่อนุมัติ':status==='delivered'?'ส่งมอบแล้ว':'อนุมัติแล้ว',statusTone:tone,body:[lineText(note||'ตรวจสอบสถานะได้จากเมนู แต้ม & ของรางวัล','sm',LINE_CI.muted)]})}]); return true;
}

async function materializePointCashRewardsForPayroll(db,clientId,period){
  const rows=(await db.prepare(`SELECT * FROM point_transactions WHERE client_id=?1 AND cash_value>0 AND payroll_adjustment_id IS NULL AND date(created_at)>=?2 AND date(created_at)<=?3 ORDER BY id`).bind(Number(clientId),period.period_start,period.period_end).all()).results||[];
  for(const tx of rows){
    const r=await db.prepare(`INSERT INTO payroll_adjustments (client_id,period_id,employee_id,adjustment_type,category,amount,taxable,sso_contributable,note) VALUES (?1,?2,?3,'earning','incentive',?4,1,0,?5)`).bind(Number(clientId),Number(period.id),Number(tx.employee_id),Number(tx.cash_value),tx.note||'Nakna reward').run(); await db.prepare('UPDATE point_transactions SET payroll_adjustment_id=?1 WHERE id=?2').bind(Number(r.meta.last_row_id),Number(tx.id)).run(); if(tx.reference_type==='reward_cash')await db.prepare('UPDATE reward_redemptions SET payroll_adjustment_id=?1 WHERE id=?2').bind(Number(r.meta.last_row_id),Number(tx.reference_id)).run();
  }
  return rows.length;
}

async function assertSeatCapacity(db,clientId,additional=1){
  await ensurePhase5Defaults(db,clientId); await refreshSubscriptionState(db,clientId); const row=await db.prepare(`SELECT cs.status,sp.max_seats FROM company_subscriptions cs LEFT JOIN subscription_plans sp ON sp.id=cs.plan_id WHERE cs.client_id=?1`).bind(Number(clientId)).first(); if(['expired','cancelled'].includes(String(row?.status||'')))throw httpError('ช่วงทดลองใช้หมดแล้ว กรุณาเปิดใช้งานแพ็กเกจก่อนเพิ่มพนักงาน',402); const usage=await activeSeatUsage(db,clientId); if(row?.max_seats!=null&&Number(row.max_seats)>0&&usage.active_employee_seats+Number(additional)>Number(row.max_seats))throw httpError(`แพ็กเกจนี้รองรับสูงสุด ${Number(row.max_seats)} Active Employee Seats`,409); return usage;
}

async function activeSeatUsage(db,clientId){
  const row=await db.prepare(`SELECT COUNT(*) AS seats,SUM(CASE WHEN line_user_id IS NOT NULL THEN 1 ELSE 0 END) AS line_seats FROM employees WHERE client_id=?1 AND status='active' AND COALESCE(people_status,'employee') IN ('probation','employee','leave_of_absence')`).bind(Number(clientId)).first(); return {active_employee_seats:Number(row?.seats||0),line_connected_seats:Number(row?.line_seats||0)};
}
async function snapshotCompanyUsage(db,clientId,dateKey=dateInBangkok()){
  const u=await activeSeatUsage(db,clientId); await db.prepare(`INSERT INTO usage_snapshots (client_id,snapshot_date,active_employee_seats,line_connected_seats) VALUES (?1,?2,?3,?4) ON CONFLICT(client_id,snapshot_date) DO UPDATE SET active_employee_seats=excluded.active_employee_seats,line_connected_seats=excluded.line_connected_seats`).bind(Number(clientId),dateKey,u.active_employee_seats,u.line_connected_seats).run(); return u;
}

async function getSubscriptionOverview(db,clientId){
  await ensurePhase5Defaults(db,clientId); const cid=Number(clientId); await refreshSubscriptionState(db,cid); const subscription=await db.prepare(`SELECT cs.*,sp.code AS plan_code,sp.name AS plan_name,sp.description AS plan_description,sp.pricing_mode,sp.base_fee,sp.price_per_seat,sp.included_seats,sp.max_seats,sp.features_json FROM company_subscriptions cs LEFT JOIN subscription_plans sp ON sp.id=cs.plan_id WHERE cs.client_id=?1`).bind(cid).first(); const plans=(await db.prepare(`SELECT id,code,name,description,pricing_mode,base_fee,price_per_seat,included_seats,max_seats,trial_days,status FROM subscription_plans WHERE status='active' ORDER BY id`).all()).results||[]; const usage=await snapshotCompanyUsage(db,cid,dateInBangkok()); const invoices=(await db.prepare(`SELECT * FROM billing_invoices WHERE client_id=?1 ORDER BY created_at DESC LIMIT 24`).bind(cid).all()).results||[]; let daysRemaining=null; if(subscription?.status==='trialing'&&subscription.trial_ends_at)daysRemaining=Math.max(0,Math.ceil((new Date(subscription.trial_ends_at).getTime()-Date.now())/86400000)); const seatBillable=Math.max(0,usage.active_employee_seats-Number(subscription?.included_seats||0)); const monthlyEstimate=Number(subscription?.pricing_mode==='flat'?subscription.base_fee:Number(subscription?.base_fee||0)+seatBillable*Number(subscription?.price_per_seat||0)); return {subscription,plans,usage,invoices,trial:{days_remaining:daysRemaining},estimate:{billable_seats:seatBillable,monthly_amount:roundMoney(monthlyEstimate),pricing_configured:Boolean(Number(subscription?.base_fee||0)||Number(subscription?.price_per_seat||0)||subscription?.pricing_mode==='custom')},access_mode:['trialing','active'].includes(String(subscription?.status))?'full':'restricted'};
}

async function refreshSubscriptionState(db,clientId){
  const s=await db.prepare('SELECT * FROM company_subscriptions WHERE client_id=?1').bind(Number(clientId)).first(); if(!s)return; const now=Date.now(); if(s.status==='trialing'&&s.trial_ends_at&&new Date(s.trial_ends_at).getTime()<now)await db.prepare(`UPDATE company_subscriptions SET status='expired',updated_at=CURRENT_TIMESTAMP WHERE client_id=?1 AND status='trialing'`).bind(Number(clientId)).run(); await db.prepare(`UPDATE billing_invoices SET status='overdue',updated_at=CURRENT_TIMESTAMP WHERE client_id=?1 AND status='open' AND due_date IS NOT NULL AND due_date<?2`).bind(Number(clientId),dateInBangkok()).run();
}

async function generateBillingInvoice(db,clientId){
  await ensurePhase5Defaults(db,clientId); const cid=Number(clientId); const sub=await db.prepare(`SELECT cs.*,sp.code AS plan_code,sp.name AS plan_name,sp.pricing_mode,sp.base_fee,sp.price_per_seat,sp.included_seats FROM company_subscriptions cs LEFT JOIN subscription_plans sp ON sp.id=cs.plan_id WHERE cs.client_id=?1`).bind(cid).first(); if(!sub)throw httpError('ไม่พบ Subscription',404); if(sub.plan_code==='trial')throw httpError('กรุณาเลือกแพ็กเกจก่อนสร้างใบเรียกเก็บ',409); if(sub.pricing_mode==='custom')throw httpError('แพ็กเกจ Enterprise ต้องออกใบเสนอราคาจาก Admin',409); const today=dateInBangkok(),periodStart=`${today.slice(0,7)}-01`; const [y,m]=today.slice(0,7).split('-').map(Number); const periodEnd=`${today.slice(0,7)}-${String(new Date(Date.UTC(y,m,0)).getUTCDate()).padStart(2,'0')}`; const existing=await db.prepare(`SELECT * FROM billing_invoices WHERE client_id=?1 AND period_start=?2 AND period_end=?3 AND status!='void'`).bind(cid,periodStart,periodEnd).first(); if(existing)return existing; const usage=await snapshotCompanyUsage(db,cid,today); const billable=Math.max(0,usage.active_employee_seats-Number(sub.included_seats||0)); const base=Number(sub.base_fee||0),seatAmount=sub.pricing_mode==='flat'?0:billable*Number(sub.price_per_seat||0),subtotal=roundMoney(base+seatAmount),vatRate=0,vat=roundMoney(subtotal*vatRate),total=roundMoney(subtotal+vat); const sequence=Number((await db.prepare(`SELECT COUNT(*) AS n FROM billing_invoices WHERE client_id=?1`).bind(cid).first())?.n||0)+1; const invoiceNo=`NK-${today.slice(0,7).replace('-','')}-${String(cid).padStart(4,'0')}-${String(sequence).padStart(3,'0')}`; const due=new Date(`${today}T00:00:00+07:00`); due.setDate(due.getDate()+7); const dueDate=dateInBangkok(due); const r=await db.prepare(`INSERT INTO billing_invoices (client_id,subscription_id,invoice_no,period_start,period_end,active_seats,base_fee,seat_amount,subtotal,vat_rate,vat_amount,total,status,due_date) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,'open',?13)`).bind(cid,Number(sub.id),invoiceNo,periodStart,periodEnd,usage.active_employee_seats,base,roundMoney(seatAmount),subtotal,vatRate,vat,total,dueDate).run(); return db.prepare('SELECT * FROM billing_invoices WHERE id=?1').bind(Number(r.meta.last_row_id)).first();
}

async function getPeopleAnalytics(db,clientId){
  const cid=Number(clientId),today=dateInBangkok(); const dayAgo=n=>{const d=new Date(`${today}T12:00:00+07:00`);d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10);}; const start30=dayAgo(29),start90=dayAgo(89);
  const [employees,depts,attendance,leaves,candidates,kpiRows,learning]=await Promise.all([
    db.prepare(`SELECT e.id,e.department_id,e.people_status,e.status,e.start_date,e.end_date,e.birth_date,e.first_name,e.last_name,e.nickname,d.name AS department_name FROM employees e LEFT JOIN departments d ON d.id=e.department_id WHERE e.client_id=?1`).bind(cid).all(),
    db.prepare(`SELECT * FROM departments WHERE client_id=?1 ORDER BY sort_order,name`).bind(cid).all(),
    db.prepare(`SELECT a.*,e.department_id FROM attendance a JOIN employees e ON e.id=a.employee_id WHERE a.client_id=?1 AND a.work_date>=?2 AND a.work_date<=?3`).bind(cid,start90,today).all(),
    db.prepare(`SELECT l.*,e.department_id FROM leave_requests l JOIN employees e ON e.id=l.employee_id WHERE l.client_id=?1 AND l.status='approved' AND l.end_date>=?2 AND l.start_date<=?3`).bind(cid,start90,today).all(),
    db.prepare(`SELECT stage,COUNT(*) AS n FROM candidates WHERE client_id=?1 GROUP BY stage`).bind(cid).all(),
    db.prepare(`SELECT g.id,g.employee_id,e.department_id,(SELECT progress_pct FROM kpi_updates u WHERE u.goal_id=g.id ORDER BY u.update_date DESC,u.id DESC LIMIT 1) AS progress_pct FROM kpi_goals g JOIN employees e ON e.id=g.employee_id WHERE g.client_id=?1 AND g.status='active'`).bind(cid).all(),
    db.prepare(`SELECT la.status,e.department_id FROM learning_assignments la JOIN employees e ON e.id=la.employee_id WHERE la.client_id=?1`).bind(cid).all(),
  ]);
  const emp=employees.results||[],att=attendance.results||[],leave=leaves.results||[],active=emp.filter(e=>e.status==='active'&&['probation','employee','leave_of_absence'].includes(String(e.people_status||'employee'))),exits90=emp.filter(e=>e.end_date&&e.end_date>=start90&&e.end_date<=today),hires30=emp.filter(e=>e.start_date&&e.start_date>=start30&&e.start_date<=today); const late30=att.filter(a=>a.work_date>=start30&&Number(a.late_minutes||0)>0),outside30=att.filter(a=>a.work_date>=start30&&Number(a.checkout_outside_geofence||0)); const attendance30=att.filter(a=>a.work_date>=start30); const turnoverBase=Math.max(1,active.length+exits90.length/2); const months=[]; for(let i=5;i>=0;i--){const d=new Date(`${today.slice(0,7)}-01T12:00:00+07:00`);d.setMonth(d.getMonth()-i);const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;const monthEnd=new Date(d.getFullYear(),d.getMonth()+1,0);const end=`${monthEnd.getFullYear()}-${String(monthEnd.getMonth()+1).padStart(2,'0')}-${String(monthEnd.getDate()).padStart(2,'0')}`;const head=emp.filter(e=>(!e.start_date||e.start_date<=end)&&(!e.end_date||e.end_date>end)).length;const hires=emp.filter(e=>String(e.start_date||'').startsWith(key)).length;const exits=emp.filter(e=>String(e.end_date||'').startsWith(key)).length;months.push({month:key,headcount:head,hires,exits});}
  const deptRows=(depts.results||[]).map(d=>{const ids=new Set(active.filter(e=>Number(e.department_id)===Number(d.id)).map(e=>Number(e.id)));const datt=attendance30.filter(a=>Number(a.department_id)===Number(d.id));const dk=(kpiRows.results||[]).filter(k=>Number(k.department_id)===Number(d.id)&&k.progress_pct!=null);const dl=(learning.results||[]).filter(x=>Number(x.department_id)===Number(d.id));return {id:d.id,name:d.name,headcount:ids.size,probation:active.filter(e=>Number(e.department_id)===Number(d.id)&&e.people_status==='probation').length,late_records:datt.filter(a=>Number(a.late_minutes||0)>0).length,avg_kpi:dk.length?Math.round(dk.reduce((s,x)=>s+Number(x.progress_pct||0),0)/dk.length):null,learning_completion:dl.length?Math.round(dl.filter(x=>x.status==='completed').length/dl.length*100):null,exits_90:exits90.filter(e=>Number(e.department_id)===Number(d.id)).length};});
  const moments=upcomingPeopleMoments(active,today,30); return {range:{start_30:start30,start_90:start90,today},summary:{active_headcount:active.length,probation:active.filter(e=>e.people_status==='probation').length,hires_30:hires30.length,exits_90:exits90.length,turnover_90_pct:roundMoney(exits90.length/turnoverBase*100),late_records_30:late30.length,outside_checkout_30:outside30.length,approved_leave_requests_90:leave.length,attendance_records_30:attendance30.length},headcount_trend:months,departments:deptRows,recruitment:Object.fromEntries((candidates.results||[]).map(x=>[x.stage,Number(x.n||0)])),moments};
}

function upcomingPeopleMoments(employees,today,days=30){
  const base=new Date(`${today}T12:00:00+07:00`),out=[];
  for(const e of employees){for(const [type,date] of [['birthday',e.birth_date],['anniversary',e.start_date]]){if(!date)continue;const src=new Date(`${date}T12:00:00+07:00`);let next=new Date(base.getFullYear(),src.getMonth(),src.getDate(),12);if(next<base)next=new Date(base.getFullYear()+1,src.getMonth(),src.getDate(),12);const diff=Math.ceil((next-base)/86400000);if(diff>=0&&diff<=days){const years=type==='anniversary'?next.getFullYear()-src.getFullYear():null;if(type==='anniversary'&&years<1)continue;out.push({employee_id:e.id,name:e.nickname||e.first_name,type,date:next.toISOString().slice(0,10),days:diff,years});}}}return out.sort((a,b)=>a.days-b.days);
}

async function getSaasAdminOverview(db){
  const [plans,companies,invoices]=await Promise.all([
    db.prepare('SELECT * FROM subscription_plans ORDER BY id').all(),
    db.prepare(`SELECT c.id,c.name,c.code,c.created_at,cs.status,cs.trial_ends_at,cs.billing_cycle,sp.code AS plan_code,sp.name AS plan_name,sp.base_fee,sp.price_per_seat,sp.included_seats,(SELECT COUNT(*) FROM employees e WHERE e.client_id=c.id AND e.status='active' AND COALESCE(e.people_status,'employee') IN ('probation','employee','leave_of_absence')) AS active_seats FROM clients c LEFT JOIN company_subscriptions cs ON cs.client_id=c.id LEFT JOIN subscription_plans sp ON sp.id=cs.plan_id ORDER BY c.id DESC`).all(),
    db.prepare(`SELECT bi.*,c.name AS company_name FROM billing_invoices bi JOIN clients c ON c.id=bi.client_id ORDER BY bi.created_at DESC LIMIT 100`).all()
  ]); const rows=companies.results||[]; let mrr=0; for(const c of rows){if(c.status!=='active')continue;mrr+=Number(c.base_fee||0)+Math.max(0,Number(c.active_seats||0)-Number(c.included_seats||0))*Number(c.price_per_seat||0);} return {plans:plans.results||[],companies:rows,invoices:invoices.results||[],summary:{companies:rows.length,trialing:rows.filter(x=>x.status==='trialing').length,active:rows.filter(x=>x.status==='active').length,past_due:rows.filter(x=>['past_due','expired'].includes(String(x.status))).length,active_seats:rows.reduce((s,x)=>s+Number(x.active_seats||0),0),estimated_mrr:roundMoney(mrr)}};
}

async function runPhase5DailyAutomation(env){
  await ensureV100P5Ready(env.DB); const clients=(await env.DB.prepare('SELECT id FROM clients ORDER BY id').all()).results||[]; let awards=0;
  for(const c of clients){await ensurePhase5Defaults(env.DB,Number(c.id)); const r=await runEngagementAutomationForClient(env.DB,Number(c.id)); awards+=Number(r.awarded||0); await snapshotCompanyUsage(env.DB,Number(c.id),dateInBangkok()); await refreshSubscriptionState(env.DB,Number(c.id)); const sub=await env.DB.prepare(`SELECT cs.*,sp.code AS plan_code,sp.price_per_seat,sp.base_fee FROM company_subscriptions cs LEFT JOIN subscription_plans sp ON sp.id=cs.plan_id WHERE cs.client_id=?1`).bind(Number(c.id)).first(); if(sub?.status==='expired'&&sub.plan_code&&sub.plan_code!=='trial'&&(Number(sub.price_per_seat||0)>0||Number(sub.base_fee||0)>0)){try{await generateBillingInvoice(env.DB,Number(c.id));}catch{}} }
  return {clients:clients.length,awards};
}

function canManageLearning(role){ return ['owner','co_owner','hr_admin','hr','manager'].includes(String(role||'')); }
function canManageLearningAdmin(role){ return ['owner','co_owner','hr_admin','hr'].includes(String(role||'')); }
function canManagePerformance(role){ return ['owner','co_owner','hr_admin','hr','manager'].includes(String(role||'')); }
function canManagePerformanceAdmin(role){ return ['owner','co_owner','hr_admin','hr'].includes(String(role||'')); }

async function getLearningOverview(db,clientId,auth=null){
  const [coursesRes,modulesRes,questionsRes,assignmentsRes,progressRes] = await db.batch([
    db.prepare(`SELECT c.*,d.name AS audience_department_name FROM learning_courses c LEFT JOIN departments d ON d.id=c.audience_department_id WHERE c.client_id=?1 ORDER BY c.created_at DESC,c.id DESC`).bind(clientId),
    db.prepare(`SELECT * FROM learning_modules WHERE client_id=?1 ORDER BY course_id,sort_order,id`).bind(clientId),
    db.prepare(`SELECT q.* FROM learning_quiz_questions q WHERE q.client_id=?1 ORDER BY module_id,sort_order,id`).bind(clientId),
    db.prepare(`SELECT a.*,e.employee_code,e.first_name,e.last_name,e.nickname,d.name AS department_name FROM learning_assignments a JOIN employees e ON e.id=a.employee_id LEFT JOIN departments d ON d.id=e.department_id WHERE a.client_id=?1 ORDER BY a.assigned_at DESC`).bind(clientId),
    db.prepare(`SELECT p.* FROM learning_module_progress p WHERE p.client_id=?1`).bind(clientId),
  ]);
  const courses=coursesRes.results||[],modules=modulesRes.results||[],questions=questionsRes.results||[]; let assignments=assignmentsRes.results||[]; const progress=progressRes.results||[];
  if(String(auth?.role||'')==='manager'){const actor=await db.prepare(`SELECT id FROM employees WHERE client_id=?1 AND lower(email)=lower(?2) AND status='active' LIMIT 1`).bind(clientId,String(auth?.user?.email||'')).first();if(actor){const team=(await db.prepare(`SELECT id FROM employees WHERE client_id=?1 AND (id=?2 OR manager_employee_id=?2)`).bind(clientId,Number(actor.id)).all()).results||[];const ids=new Set(team.map(x=>Number(x.id)));assignments=assignments.filter(a=>ids.has(Number(a.employee_id)));}else assignments=[];}
  const qByModule=new Map(); for(const q of questions){const list=qByModule.get(Number(q.module_id))||[];list.push({...q,options:safeJsonParse(q.options_json,[]),correct_answers:safeJsonParse(q.correct_json,[])});qByModule.set(Number(q.module_id),list);}
  const mByCourse=new Map(); for(const m of modules){const list=mByCourse.get(Number(m.course_id))||[];list.push({...m,questions:qByModule.get(Number(m.id))||[]});mByCourse.set(Number(m.course_id),list);}
  const aByCourse=new Map(); for(const a of assignments){const list=aByCourse.get(Number(a.course_id))||[];list.push(a);aByCourse.set(Number(a.course_id),list);}
  const courseData=courses.map(c=>{const as=aByCourse.get(Number(c.id))||[];return {...c,modules:mByCourse.get(Number(c.id))||[],assignments:as,stats:{assigned:as.length,completed:as.filter(x=>x.status==='completed').length,in_progress:as.filter(x=>x.status==='in_progress').length,failed:as.filter(x=>x.status==='failed').length,avg_progress:as.length?Math.round(as.reduce((s,x)=>s+Number(x.progress_pct||0),0)/as.length):0}};});
  return {courses:courseData,assignments,progress,summary:{courses:courses.length,published:courses.filter(c=>c.status==='published').length,assigned:assignments.length,completed:assignments.filter(a=>a.status==='completed').length}};
}

async function resolveLearningAudience(db,clientId,body){
  const type=String(body.audience_type||'employees');
  if(type==='all') return (await db.prepare(`SELECT id FROM employees WHERE client_id=?1 AND status='active'`).bind(clientId).all()).results||[];
  if(type==='probation') return (await db.prepare(`SELECT id FROM employees WHERE client_id=?1 AND status='active' AND people_status='probation'`).bind(clientId).all()).results||[];
  if(type==='department'){const dept=Number(body.department_id);return (await db.prepare(`SELECT id FROM employees WHERE client_id=?1 AND status='active' AND department_id=?2`).bind(clientId,dept).all()).results||[];}
  const ids=Array.isArray(body.employee_ids)?body.employee_ids.map(Number).filter(Boolean):[]; if(!ids.length)return [];
  const rows=[]; for(const id of ids){const e=await db.prepare(`SELECT id FROM employees WHERE id=?1 AND client_id=?2 AND status='active'`).bind(id,clientId).first();if(e)rows.push(e);} return rows;
}

async function getPerformanceOverview(db,clientId,auth=null){
  const [cyclesRes,goalsRes,updatesRes,onesRes,reviewsRes] = await db.batch([
    db.prepare(`SELECT * FROM performance_cycles WHERE client_id=?1 ORDER BY start_date DESC,id DESC`).bind(clientId),
    db.prepare(`SELECT g.*,e.employee_code,e.first_name,e.last_name,e.nickname,d.name AS department_name,c.name AS cycle_name FROM kpi_goals g JOIN employees e ON e.id=g.employee_id LEFT JOIN departments d ON d.id=e.department_id LEFT JOIN performance_cycles c ON c.id=g.cycle_id WHERE g.client_id=?1 ORDER BY g.created_at DESC`).bind(clientId),
    db.prepare(`SELECT * FROM kpi_updates WHERE client_id=?1 ORDER BY update_date DESC,id DESC LIMIT 1000`).bind(clientId),
    db.prepare(`SELECT o.*,e.employee_code,e.first_name,e.last_name,e.nickname,m.nickname AS manager_nickname,m.first_name AS manager_first_name FROM one_on_ones o JOIN employees e ON e.id=o.employee_id LEFT JOIN employees m ON m.id=o.manager_employee_id WHERE o.client_id=?1 ORDER BY COALESCE(o.scheduled_at,o.created_at) DESC`).bind(clientId),
    db.prepare(`SELECT r.*,e.employee_code,e.first_name,e.last_name,e.nickname,m.nickname AS reviewer_nickname,m.first_name AS reviewer_first_name FROM probation_reviews r JOIN employees e ON e.id=r.employee_id LEFT JOIN employees m ON m.id=r.reviewer_employee_id WHERE r.client_id=?1 ORDER BY r.review_date DESC,r.id DESC`).bind(clientId),
  ]);
  const updates=updatesRes.results||[]; const latest=new Map(); for(const u of updates){if(!latest.has(Number(u.goal_id)))latest.set(Number(u.goal_id),u);}
  const goals=(goalsRes.results||[]).map(g=>({...g,latest_update:latest.get(Number(g.id))||null,current_progress:Number(latest.get(Number(g.id))?.progress_pct||0)}));
  let probationDue=(await db.prepare(`SELECT id,employee_code,first_name,last_name,nickname,probation_end_date,manager_employee_id FROM employees WHERE client_id=?1 AND status='active' AND people_status='probation' AND probation_end_date IS NOT NULL ORDER BY probation_end_date`).bind(clientId).all()).results||[]; let filteredGoals=goals, filteredOnes=onesRes.results||[], filteredReviews=reviewsRes.results||[];
  if(String(auth?.role||'')==='manager'){const actor=await db.prepare(`SELECT id FROM employees WHERE client_id=?1 AND lower(email)=lower(?2) AND status='active' LIMIT 1`).bind(clientId,String(auth?.user?.email||'')).first();if(actor){const team=(await db.prepare(`SELECT id FROM employees WHERE client_id=?1 AND (id=?2 OR manager_employee_id=?2)`).bind(clientId,Number(actor.id)).all()).results||[];const ids=new Set(team.map(x=>Number(x.id)));filteredGoals=goals.filter(g=>ids.has(Number(g.employee_id)));filteredOnes=filteredOnes.filter(o=>ids.has(Number(o.employee_id)));filteredReviews=filteredReviews.filter(r=>ids.has(Number(r.employee_id)));probationDue=probationDue.filter(e=>ids.has(Number(e.id)));}else{filteredGoals=[];filteredOnes=[];filteredReviews=[];probationDue=[];}}
  return {cycles:cyclesRes.results||[],goals:filteredGoals,updates,one_on_ones:filteredOnes,probation_reviews:filteredReviews,probation_due:probationDue,summary:{active_goals:filteredGoals.filter(g=>g.status==='active').length,kpi_on_track:filteredGoals.filter(g=>Number(g.current_progress)>=80).length,one_on_one_pending:filteredOnes.filter(o=>o.status==='scheduled').length,probation_due:probationDue.length}};
}

function calculateKpiProgress(goal,actualValue,manualProgress){
  if(manualProgress!==undefined&&manualProgress!==null&&manualProgress!=='')return Math.max(0,Math.min(100,Number(manualProgress)||0));
  if(['number','percent','currency'].includes(String(goal.metric_type))&&Number(goal.target_value)>0&&actualValue!==undefined&&actualValue!==null&&actualValue!=='') return Math.max(0,Math.min(100,roundMoney(Number(actualValue)/Number(goal.target_value)*100)));
  return null;
}

async function canActOnPerformanceEmployee(db,auth,clientId,employeeId){
  if(['owner','co_owner','hr_admin','hr'].includes(String(auth.role||'')))return true;
  if(String(auth.role||'')!=='manager')return false;
  const actor=await db.prepare(`SELECT id FROM employees WHERE client_id=?1 AND lower(email)=lower(?2) AND status='active' LIMIT 1`).bind(clientId,String(auth.user?.email||'')).first();
  if(!actor)return false;
  if(Number(actor.id)===Number(employeeId))return true;
  const target=await db.prepare(`SELECT id FROM employees WHERE id=?1 AND client_id=?2 AND manager_employee_id=?3`).bind(employeeId,clientId,Number(actor.id)).first(); return Boolean(target);
}

async function autoAssignLearningForEmployee(db,clientId,employeeId,userId=null){
  await ensureV100P4Ready(db); const employee=await db.prepare(`SELECT * FROM employees WHERE id=?1 AND client_id=?2`).bind(Number(employeeId),Number(clientId)).first(); if(!employee)return 0;
  const courses=(await db.prepare(`SELECT * FROM learning_courses WHERE client_id=?1 AND status='published' AND audience_type IN ('all','probation','department')`).bind(Number(clientId)).all()).results||[]; let count=0;
  for(const c of courses){if(c.audience_type==='probation'&&String(employee.people_status)!=='probation')continue;if(c.audience_type==='department'&&Number(c.audience_department_id)!==Number(employee.department_id||0))continue;const r=await db.prepare(`INSERT OR IGNORE INTO learning_assignments (client_id,course_id,employee_id,required,assigned_by_user_id) VALUES (?1,?2,?3,?4,?5)`).bind(Number(clientId),Number(c.id),Number(employeeId),Number(c.required||1),userId?Number(userId):null).run();if(Number(r.meta?.changes||0)>0)count++;} return count;
}

async function getPublicHrCaseForm(env,token){
  const access=await getEmployeePortalAccess(env.DB,token);
  if(!access)return json({error:'ลิงก์หมดอายุ กรุณากลับไปที่ LINE แล้วกด “แจ้ง HR” ใหม่'},401);
  return json({
    ok:true,
    employee:{id:Number(access.employee_id),name:access.nickname||access.first_name,full_name:`${access.first_name||''} ${access.last_name||''}`.trim(),employee_code:access.employee_code||'',company_name:access.company_name||''},
    categories:[
      {code:'work',name:'งานและการทำงาน'},
      {code:'manager',name:'หัวหน้า / การบริหารทีม'},
      {code:'coworker',name:'เพื่อนร่วมงาน / ทีม'},
      {code:'payroll',name:'เงินเดือน / สวัสดิการ'},
      {code:'policy',name:'กฎระเบียบ / นโยบาย'},
      {code:'safety',name:'ความปลอดภัย / การคุกคาม'},
      {code:'system',name:'อุปกรณ์ / ระบบงาน'},
      {code:'other',name:'อื่น ๆ'}
    ],
    max_files:3,max_file_mb:10
  });
}

async function submitPublicHrCaseForm(request,env,token,ctx=null){
  const access=await getEmployeePortalAccess(env.DB,token);
  if(!access)return json({error:'ลิงก์หมดอายุ กรุณากลับไปที่ LINE แล้วกด “แจ้ง HR” ใหม่'},401);

  const contentType=String(request.headers.get('content-type')||'').toLowerCase();
  let category='other',subject='',detail='',urgency='normal',contactPreference='line';
  if(contentType.includes('application/json')){
    let body;try{body=await request.json();}catch{return json({error:'อ่านข้อมูลไม่ได้ กรุณาลองใหม่'},400);}
    category=String(body.category||'other').trim().slice(0,40);
    subject=String(body.subject||'').trim().slice(0,120);
    detail=String(body.detail||'').trim().slice(0,4000);
    urgency=String(body.urgency||'normal');
    contactPreference=String(body.contact_preference||'line').slice(0,30);
  }else{
    let form;try{form=await request.formData();}catch{return json({error:'อ่านแบบฟอร์มไม่ได้ กรุณาลองใหม่'},400);}
    category=String(form.get('category')||'other').trim().slice(0,40);
    subject=String(form.get('subject')||'').trim().slice(0,120);
    detail=String(form.get('detail')||'').trim().slice(0,4000);
    urgency=String(form.get('urgency')||'normal');
    contactPreference=String(form.get('contact_preference')||'line').slice(0,30);
  }

  if(subject.length<3)return json({error:'กรุณาใส่หัวข้ออย่างน้อย 3 ตัวอักษร'},400);
  if(detail.length<5)return json({error:'กรุณาเล่ารายละเอียดเพิ่มอีกนิด'},400);
  const priority=['normal','high','urgent'].includes(urgency)?urgency:'normal';
  const result=await env.DB.prepare(`INSERT INTO hr_cases(client_id,employee_id,subject,detail,category,priority,status,confidential,submitted_via,contact_preference) VALUES(?1,?2,?3,?4,?5,?6,'open',1,'line_web',?7)`).bind(Number(access.client_id),Number(access.employee_id),subject,detail,category,priority,contactPreference).run();
  const caseId=Number(result.meta.last_row_id);
  await env.DB.prepare(`INSERT INTO hr_case_events(client_id,case_id,actor_type,actor_employee_id,action,message) VALUES(?1,?2,'employee',?3,'submitted',?4)`).bind(Number(access.client_id),caseId,Number(access.employee_id),detail).run();
  await safeAudit(env.DB,Number(access.client_id),'employee',String(access.employee_id),'hr_case.create','hr_case',String(caseId),{subject,category,priority,submitted_via:'line_web'});
  const row=await env.DB.prepare(`SELECT c.*,e.first_name,e.last_name,e.nickname,e.employee_code,e.line_user_id AS employee_line_user_id,e.line_provider_scope AS employee_line_provider_scope,cl.name AS company_name FROM hr_cases c JOIN employees e ON e.id=c.employee_id JOIN clients cl ON cl.id=c.client_id WHERE c.id=?1`).bind(caseId).first();

  const notifyTask=(async()=>{
    await notifyHrCaseRecipients(env,row).catch(error=>console.error(JSON.stringify({level:'error',event:'hr_case_notify_failed',case_id:caseId,message:String(error?.message||error)})));
    await pushHrCaseSubmittedConfirmation(env,row).catch(error=>console.error(JSON.stringify({level:'error',event:'hr_case_confirmation_failed',case_id:caseId,message:String(error?.message||error)})));
  })();
  if(ctx?.waitUntil)ctx.waitUntil(notifyTask);else await notifyTask;

  return json({ok:true,case:{id:caseId,code:`HR-${String(caseId).padStart(4,'0')}`,subject,status:'open',attachments:0}},201);
}

async function uploadPublicHrCaseAttachment(request,env,token){
  const access=await getEmployeePortalAccess(env.DB,token);
  if(!access)return json({error:'ลิงก์หมดอายุ กรุณากลับไปที่ LINE แล้วกด “แจ้ง HR” ใหม่'},401);
  let form;try{form=await request.formData();}catch{return json({error:'อ่านไฟล์ไม่ได้ กรุณาลองใหม่'},400);}
  const caseId=Number(form.get('case_id')||0);
  const file=form.get('attachment');
  if(!caseId||!file||typeof file!=='object'||typeof file.arrayBuffer!=='function'||Number(file.size||0)<=0)return json({error:'ไม่พบไฟล์ที่ต้องการอัปโหลด'},400);
  const row=await env.DB.prepare(`SELECT id FROM hr_cases WHERE id=?1 AND client_id=?2 AND employee_id=?3`).bind(caseId,Number(access.client_id),Number(access.employee_id)).first();
  if(!row)return json({error:'ไม่พบเรื่องแจ้ง HR นี้'},404);
  if(Number(file.size||0)>10*1024*1024)return json({error:`ไฟล์ ${file.name||''} ใหญ่เกิน 10 MB`},413);
  const allowed=String(file.type||'').startsWith('image/')||['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(String(file.type||''));
  if(!allowed)return json({error:`ไฟล์ ${file.name||''} ไม่รองรับ กรุณาใช้รูป, PDF, DOC หรือ DOCX`},415);
  const fileName=String(file.name||`attachment-${Date.now()}`);
  const fileSize=Number(file.size||0);
  const existing=await env.DB.prepare(`SELECT id,storage_provider FROM hr_case_attachments WHERE case_id=?1 AND file_name=?2 AND file_size=?3 ORDER BY id DESC LIMIT 1`).bind(caseId,fileName,fileSize).first().catch(()=>null);
  if(existing)return json({ok:true,attachment:{id:Number(existing.id),file_name:fileName,already_uploaded:true}});
  try{
    await storeHrCaseAttachmentBinary(env,{clientId:Number(access.client_id),caseId,bytes:await file.arrayBuffer(),fileName,contentType:String(file.type||'application/octet-stream'),fileSize});
  }catch(error){
    console.error(JSON.stringify({level:'error',event:'hr_case_attachment_failed',case_id:caseId,file:fileName,message:String(error?.message||error)}));
    return json({error:safeHrCaseUploadError(error)},503);
  }
  const saved=await env.DB.prepare(`SELECT id,storage_provider,drive_url FROM hr_case_attachments WHERE case_id=?1 AND file_name=?2 AND file_size=?3 ORDER BY id DESC LIMIT 1`).bind(caseId,fileName,fileSize).first().catch(()=>null);
  return json({ok:true,attachment:{id:Number(saved?.id||0),file_name:fileName,storage_provider:saved?.storage_provider||null,drive_url:saved?.drive_url||null}},201);
}

function safeHrCaseUploadError(error){
  const message=String(error?.message||error||'');
  if(/ยังไม่ได้เชื่อม Google Drive|ที่เก็บไฟล์สำรอง/i.test(message))return 'ส่งเรื่องสำเร็จแล้ว แต่ยังอัปโหลดไฟล์ไม่ได้ เพราะที่เก็บเอกสารยังไม่พร้อม กรุณาแจ้ง HR ให้ตรวจ Google Drive';
  if(/token|unauthor|invalid_grant|google/i.test(message))return 'ส่งเรื่องสำเร็จแล้ว แต่ Google Drive เชื่อมต่อมีปัญหา กรุณาให้ HR เชื่อม Google ใหม่';
  return 'ส่งเรื่องสำเร็จแล้ว แต่ไฟล์แนบอัปโหลดไม่สำเร็จ กรุณาลองแนบใหม่ภายหลังหรือติดต่อ HR';
}

async function storeHrCaseAttachmentBinary(env,{clientId,caseId,bytes,fileName,contentType,fileSize}){
  const integration=await env.DB.prepare(`SELECT * FROM google_workspace_integrations WHERE client_id=?1 AND status='connected'`).bind(Number(clientId)).first().catch(()=>null);
  if(integration?.drive_folder_id){
    const accessToken=await getWorkspaceGoogleAccessToken(env,integration);
    const root=await ensureDriveChildFolder(accessToken,integration.drive_folder_id,'HR Private Cases');
    const folder=await ensureDriveChildFolder(accessToken,root,`HR-${String(caseId).padStart(4,'0')}`);
    const uploaded=await uploadGoogleDriveFile(accessToken,{folderId:folder,fileName,contentType,bytes:new Uint8Array(bytes)});
    await env.DB.prepare(`INSERT INTO hr_case_attachments(client_id,case_id,file_name,content_type,file_size,storage_provider,drive_file_id,drive_url) VALUES(?1,?2,?3,?4,?5,'google_drive',?6,?7)`).bind(Number(clientId),Number(caseId),fileName,contentType,Number(fileSize||0),uploaded.id,uploaded.webViewLink||null).run();
    return;
  }
  if(!env.EVIDENCE_BUCKET)throw httpError('ยังไม่ได้เชื่อม Google Drive และที่เก็บไฟล์สำรองยังไม่พร้อม กรุณาส่งโดยไม่แนบไฟล์หรือติดต่อ HR',503);
  const key=`client-${clientId}/hr-case-${caseId}/${crypto.randomUUID()}-${String(fileName||'attachment').replace(/[^A-Za-z0-9._-]/g,'_')}`;
  await env.EVIDENCE_BUCKET.put(key,bytes,{httpMetadata:{contentType}});
  await env.DB.prepare(`INSERT INTO hr_case_attachments(client_id,case_id,file_name,content_type,file_size,storage_provider,storage_key) VALUES(?1,?2,?3,?4,?5,'r2',?6)`).bind(Number(clientId),Number(caseId),fileName,contentType,Number(fileSize||0),key).run();
}

function hrCaseCategoryLabel(code){return ({work:'งานและการทำงาน',manager:'หัวหน้า / การบริหารทีม',coworker:'เพื่อนร่วมงาน / ทีม',payroll:'เงินเดือน / สวัสดิการ',policy:'กฎระเบียบ / นโยบาย',safety:'ความปลอดภัย / การคุกคาม',system:'อุปกรณ์ / ระบบงาน',other:'อื่น ๆ'})[code]||'อื่น ๆ';}
function hrCasePriorityLabel(priority){return ({normal:'ปกติ',high:'สำคัญ',urgent:'เร่งด่วน'})[priority]||'ปกติ';}

async function notifyHrCaseRecipients(env,row){
  if(!row?.client_id)return;
  const recipients=(await env.DB.prepare(`SELECT DISTINCT u.id AS user_id,u.line_user_id,u.line_provider_scope,m.role FROM company_members m JOIN users u ON u.id=m.user_id WHERE m.client_id=?1 AND m.status='active' AND m.role IN ('owner','co_owner','hr_admin','hr') AND u.status='active' AND u.line_user_id IS NOT NULL`).bind(Number(row.client_id)).all()).results||[];
  const seen=new Set();
  for(const recipient of recipients){
    const scope=String(recipient.line_provider_scope||'default'),key=`${scope}:${recipient.line_user_id}`;if(seen.has(key))continue;seen.add(key);
    const token=await getAccessTokenForProviderScope(env,Number(row.client_id),scope);if(!token)continue;
    const dashboardUrl=await issueLineWebLoginLink(env,Number(recipient.user_id),{clientId:Number(row.client_id),purpose:'dashboard'}).catch(()=>null);
    const name=row.nickname||row.first_name||'พนักงาน';
    const body=[lineInfoCard([lineInfoRow('พนักงาน',name),lineInfoRow('หมวด',hrCaseCategoryLabel(row.category)),lineInfoRow('ความเร่งด่วน',hrCasePriorityLabel(row.priority)),lineInfoRow('หัวข้อ',row.subject)],row.priority==='urgent'?'coral':'teal'),lineText(String(row.detail||'').slice(0,220),'xs',LINE_CI.text)];
    const footer=dashboardUrl?[linePrimaryButton('เปิด HR Dashboard',{type:'uri',label:'เปิด HR Dashboard',uri:dashboardUrl})]:[];
    await pushLineMessages(token,recipient.line_user_id,[{type:'flex',altText:`มีเรื่องแจ้ง HR ใหม่จาก ${name}`,contents:lineBubble({eyebrow:`PRIVATE HR · #HR-${String(row.id).padStart(4,'0')}`,title:'มีเรื่องส่วนตัวแจ้งถึง HR',subtitle:row.company_name||'',status:hrCasePriorityLabel(row.priority),statusTone:row.priority==='urgent'?'error':'warning',body,footer})}]).catch(()=>{});
  }
}

async function pushHrCaseSubmittedConfirmation(env,row){
  if(!row?.employee_line_user_id)return false;
  const token=await getAccessTokenForProviderScope(env,Number(row.client_id),row.employee_line_provider_scope);if(!token)return false;
  const text=`✅ ส่งเรื่องถึง HR แล้ว\n#HR-${String(row.id).padStart(4,'0')} · ${row.subject}\nสถานะ: HR รับเรื่องแล้ว\nเรื่องนี้จะแสดงเฉพาะ Owner / HR ที่มีสิทธิ์`;
  await pushLineMessages(token,row.employee_line_user_id,[{type:'text',text}]);
  return true;
}

async function getPublicLeaveForm(env,token){
  const access=await getEmployeePortalAccess(env.DB,token);
  if(!access)return json({error:'ลิงก์หมดอายุ กรุณาเปิด “ขอลางาน” จาก LINE ใหม่'},401);
  await ensureDefaultLeavePolicies(env.DB,Number(access.client_id));
  const year=Number(dateInBangkok().slice(0,4));
  const profile=await getEmployeeLeaveProfile(env.DB,Number(access.employee_id),Number(access.client_id),year);
  const policies=(profile.balances||[]).map(b=>({
    id:Number(b.id),code:b.code,name:b.name,is_unlimited:Boolean(Number(b.is_unlimited)),
    entitlement_days:Number(b.entitlement_days||0),adjustment_days:Number(b.adjustment_days||0),
    used_days:Number(b.used_days||0),pending_days:Number(b.pending_days||0),remaining_days:Number(b.remaining_days||0),
    available_now:b.available_now!==false,lock_reason:b.lock_reason||null,requires_reason:Boolean(Number(b.requires_reason)),
    evidence_required_after_days:b.evidence_required_after_days==null?null:Number(b.evidence_required_after_days),
    notice_days:Number(b.notice_days||0),allow_negative:Boolean(Number(b.allow_negative)),
  }));
  return json({ok:true,employee:{id:Number(access.employee_id),name:access.nickname||access.first_name,full_name:`${access.first_name||''} ${access.last_name||''}`.trim(),employee_code:access.employee_code||'',company_name:access.company_name||''},year,policies,today:dateInBangkok(),max_files:3,max_file_mb:10});
}

async function submitPublicLeaveForm(request,env,token){
  const access=await getEmployeePortalAccess(env.DB,token);
  if(!access)return json({error:'ลิงก์หมดอายุ กรุณาเปิด “ขอลางาน” จาก LINE ใหม่'},401);
  let form;
  try{form=await request.formData();}catch{return json({error:'อ่านแบบฟอร์มไม่ได้ กรุณาลองใหม่'},400);}
  const policyId=Number(form.get('policy_id')||0);
  const startDate=String(form.get('start_date')||'').trim();
  const endDate=String(form.get('end_date')||startDate).trim();
  const dayPart=String(form.get('day_part')||'full');
  const reason=String(form.get('reason')||'').trim();
  const policy=await resolveLeavePolicy(env.DB,Number(access.client_id),policyId,null);
  if(!policy)return json({error:'ไม่พบประเภทลาที่เลือก'},400);
  const employee=await getEmployeeForClient(env.DB,Number(access.employee_id),Number(access.client_id));
  if(!employee)return json({error:'ไม่พบข้อมูลพนักงาน'},404);
  let duration;
  try{duration=await calculateEmployeeLeaveDuration(env.DB,employee,startDate,endDate,dayPart);}catch(e){return json({error:e.message},e.status||400);}
  const evidenceRequired=policy.evidence_required_after_days!=null&&duration>=Number(policy.evidence_required_after_days||0);
  const rawFiles=form.getAll('evidence').filter(f=>f&&typeof f==='object'&&typeof f.arrayBuffer==='function'&&Number(f.size||0)>0);
  if(rawFiles.length>3)return json({error:'แนบหลักฐานได้สูงสุด 3 ไฟล์'},400);
  const allowed=(file)=>String(file.type||'').startsWith('image/')||['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(String(file.type||''));
  for(const file of rawFiles){
    if(Number(file.size||0)>10*1024*1024)return json({error:`ไฟล์ ${file.name||''} ใหญ่เกิน 10 MB`},413);
    if(!allowed(file))return json({error:`ไฟล์ ${file.name||''} ไม่รองรับ กรุณาใช้รูป, PDF, DOC หรือ DOCX`},415);
  }
  if(evidenceRequired&&!rawFiles.length)return json({error:`${policy.name} ${duration} วัน ต้องแนบหลักฐานตามนโยบายบริษัท`},400);
  let row;
  try{
    row=await createLeaveRequest(env,{clientId:Number(access.client_id),employeeId:Number(access.employee_id),policyId,startDate,endDate,dayPart,reason,submittedVia:'line'});
    try{
      for(const file of rawFiles){
        await storeLeaveEvidenceBinary(env,{clientId:Number(access.client_id),requestId:Number(row.id),employeeId:Number(access.employee_id),bytes:await file.arrayBuffer(),fileName:String(file.name||`evidence-${Date.now()}`),contentType:String(file.type||'application/octet-stream'),fileSize:Number(file.size||0),source:'line_web'});
      }
    }catch(uploadError){
      // Do not leave a half-created request that blocks the employee from retrying the same dates.
      await env.DB.batch([
        env.DB.prepare(`DELETE FROM leave_ledger WHERE reference_type='leave_request' AND reference_id=?1`).bind(Number(row.id)),
        env.DB.prepare('DELETE FROM leave_requests WHERE id=?1 AND client_id=?2').bind(Number(row.id),Number(access.client_id)),
      ]).catch(()=>{});
      throw uploadError;
    }
    if(rawFiles.length){
      await env.DB.prepare("UPDATE leave_requests SET status=CASE WHEN status='awaiting_evidence' THEN 'pending' ELSE status END,evidence_count=(SELECT COUNT(*) FROM leave_request_evidence WHERE leave_request_id=?1),updated_at=CURRENT_TIMESTAMP WHERE id=?1").bind(Number(row.id)).run();
    }
    row=await hydrateLeaveBalance(env.DB,await getLeaveRequestDetail(env.DB,Number(row.id),Number(access.client_id)));
    await notifyLeaveApprover(env,Number(row.id)).catch(error=>console.error(JSON.stringify({level:'error',event:'leave_web_notify_approver_failed',request_id:Number(row.id),message:String(error?.message||error)})));
    await pushLeaveWebSubmittedConfirmation(env,row).catch(error=>console.error(JSON.stringify({level:'error',event:'leave_web_confirmation_failed',request_id:Number(row.id),message:String(error?.message||error)})));
    return json({ok:true,request:{id:Number(row.id),code:`LV-${String(row.id).padStart(4,'0')}`,status:row.status,leave_type:row.leave_type_name||row.leave_type,start_date:row.start_date,end_date:row.end_date,duration_days:Number(row.duration_days||0),evidence_count:Number(row.evidence_count||0)}} ,201);
  }catch(e){
    return json({error:e.message||'ส่งใบลาไม่สำเร็จ'},e.status||400);
  }
}

async function pushLeaveWebSubmittedConfirmation(env,row){
  if(!row?.employee_line_user_id)return false;
  const accessToken=await getAccessTokenForProviderScope(env,Number(row.client_id),row.employee_line_provider_scope);
  if(!accessToken)return false;
  const range=formatLeaveRange(row);
  const duration=Number(row.duration_days||0).toFixed(Number(row.duration_days||0)%1?1:0);
  const status=row.status==='pending'?'รออนุมัติ':row.status==='awaiting_evidence'?'รอหลักฐาน':'ส่งแล้ว';
  const message=`✅ ส่งใบลาแล้ว\n#LV-${String(row.id).padStart(4,'0')} · ${row.leave_type_name||row.leave_type}\n${range} · ${duration} วัน\nสถานะ: ${status}`;
  await pushLineMessages(accessToken,row.employee_line_user_id,[{type:'text',text:message}]);
  return true;
}

async function issueEmployeePortalToken(db,clientId,employeeId){
  const token=randomToken(40); const hash=await sha256Hex(token); const expires=new Date(Date.now()+30*24*60*60*1000).toISOString();
  await db.prepare(`DELETE FROM learning_access_tokens WHERE employee_id=?1 AND client_id=?2 AND datetime(expires_at)<CURRENT_TIMESTAMP`).bind(Number(employeeId),Number(clientId)).run();
  await db.prepare(`INSERT INTO learning_access_tokens (token_hash,client_id,employee_id,expires_at) VALUES (?1,?2,?3,?4)`).bind(hash,Number(clientId),Number(employeeId),expires).run(); return token;
}

async function getEmployeePortalAccess(db,token){
  const hash=await sha256Hex(token); const row=await db.prepare(`SELECT t.*,e.employee_code,e.first_name,e.last_name,e.nickname,e.email,e.department_id,e.position_id,e.people_status,e.status,c.name AS company_name FROM learning_access_tokens t JOIN employees e ON e.id=t.employee_id JOIN clients c ON c.id=t.client_id WHERE t.token_hash=?1 AND datetime(t.expires_at)>CURRENT_TIMESTAMP AND e.status='active'`).bind(hash).first();
  if(!row)return null; await db.prepare(`UPDATE learning_access_tokens SET last_used_at=CURRENT_TIMESTAMP WHERE token_hash=?1`).bind(hash).run(); return row;
}

async function getPublicLearningPortal(env,token){
  const access=await getEmployeePortalAccess(env.DB,token); if(!access)return json({error:'ลิงก์หมดอายุ กรุณาขอลิงก์ใหม่จาก LINE นากนะ'},401);
  const [assignRes,modulesRes,progressRes,goalsRes,updatesRes] = await env.DB.batch([
    env.DB.prepare(`SELECT a.*,c.title,c.description,c.estimated_minutes,c.passing_score,c.required AS course_required FROM learning_assignments a JOIN learning_courses c ON c.id=a.course_id WHERE a.employee_id=?1 AND a.client_id=?2 AND c.status='published' ORDER BY a.assigned_at DESC`).bind(Number(access.employee_id),Number(access.client_id)),
    env.DB.prepare(`SELECT m.* FROM learning_modules m JOIN learning_assignments a ON a.course_id=m.course_id WHERE a.employee_id=?1 AND a.client_id=?2 ORDER BY m.course_id,m.sort_order,m.id`).bind(Number(access.employee_id),Number(access.client_id)),
    env.DB.prepare(`SELECT p.* FROM learning_module_progress p JOIN learning_assignments a ON a.id=p.assignment_id WHERE a.employee_id=?1 AND a.client_id=?2`).bind(Number(access.employee_id),Number(access.client_id)),
    env.DB.prepare(`SELECT g.* FROM kpi_goals g WHERE g.employee_id=?1 AND g.client_id=?2 AND g.status='active' ORDER BY g.created_at DESC`).bind(Number(access.employee_id),Number(access.client_id)),
    env.DB.prepare(`SELECT u.* FROM kpi_updates u WHERE u.employee_id=?1 AND u.client_id=?2 ORDER BY u.update_date DESC,u.id DESC LIMIT 300`).bind(Number(access.employee_id),Number(access.client_id)),
  ]);
  const assignments=assignRes.results||[],modules=modulesRes.results||[],progress=progressRes.results||[]; const pMap=new Map(progress.map(p=>[Number(p.module_id),p]));
  const qModules=modules.filter(m=>m.module_type==='quiz').map(m=>Number(m.id)); let questions=[]; if(qModules.length){for(const id of qModules){const rows=(await env.DB.prepare(`SELECT id,module_id,sort_order,question_text,question_type,options_json,points FROM learning_quiz_questions WHERE module_id=?1 ORDER BY sort_order,id`).bind(id).all()).results||[]; questions.push(...rows.map(q=>({...q,options:safeJsonParse(q.options_json,[])})));}}
  const modulesByCourse=new Map(); for(const m of modules){const list=modulesByCourse.get(Number(m.course_id))||[];list.push({...m,progress:pMap.get(Number(m.id))||null,media_url:m.drive_file_id?`/api/public/learning/${token}/media/${m.id}`:null,questions:questions.filter(q=>Number(q.module_id)===Number(m.id))});modulesByCourse.set(Number(m.course_id),list);}
  const courses=assignments.map(a=>({...a,modules:modulesByCourse.get(Number(a.course_id))||[]}));
  const updates=updatesRes.results||[]; const latest=new Map(); for(const u of updates){if(!latest.has(Number(u.goal_id)))latest.set(Number(u.goal_id),u);} const goals=(goalsRes.results||[]).map(g=>({...g,latest_update:latest.get(Number(g.id))||null,current_progress:Number(latest.get(Number(g.id))?.progress_pct||0)}));
  await ensurePhase5Defaults(env.DB,Number(access.client_id));
  const [wallet,rewards,redemptions,leaderboard]=await Promise.all([
    ensurePointWallet(env.DB,Number(access.client_id),Number(access.employee_id)),
    env.DB.prepare(`SELECT id,title,description,reward_type,points_cost,cash_value,stock_qty FROM reward_catalog WHERE client_id=?1 AND status='active' AND (stock_qty IS NULL OR stock_qty>0) ORDER BY points_cost,id`).bind(Number(access.client_id)).all(),
    env.DB.prepare(`SELECT rr.id,rr.reward_id,rr.points_cost,rr.cash_value,rr.status,rr.requested_at,rr.decided_at,rr.delivered_at,rc.title AS reward_title FROM reward_redemptions rr JOIN reward_catalog rc ON rc.id=rr.reward_id WHERE rr.client_id=?1 AND rr.employee_id=?2 ORDER BY rr.requested_at DESC LIMIT 30`).bind(Number(access.client_id),Number(access.employee_id)).all(),
    env.DB.prepare(`SELECT w.employee_id,w.balance,e.nickname,e.first_name FROM employee_point_wallets w JOIN employees e ON e.id=w.employee_id WHERE w.client_id=?1 AND e.status='active' ORDER BY w.balance DESC LIMIT 10`).bind(Number(access.client_id)).all()
  ]);
  return json({employee:{id:access.employee_id,employee_code:access.employee_code,name:access.nickname||access.first_name,company_name:access.company_name,people_status:access.people_status},courses,goals,engagement:{wallet,rewards:rewards.results||[],redemptions:redemptions.results||[],leaderboard:leaderboard.results||[]},summary:{courses:courses.length,completed:courses.filter(c=>c.status==='completed').length,goals:goals.length,points:Number(wallet?.balance||0)}});
}

async function redeemPublicReward(request,env,token,rewardId){
  const access=await getEmployeePortalAccess(env.DB,token); if(!access)return json({error:'ลิงก์หมดอายุ'},401); const body=await safeJson(request); try{const result=await requestRewardRedemption(env.DB,Number(access.client_id),Number(access.employee_id),Number(rewardId),String(body.note||'').trim()); return json({ok:true,id:result.id,wallet:result.wallet},201);}catch(e){return json({error:e.message},e.status||400);}
}

async function getAssignmentForPublicModule(db,access,moduleId){
  return db.prepare(`SELECT a.*,m.course_id,m.module_type,m.required AS module_required,m.duration_seconds,c.passing_score FROM learning_modules m JOIN learning_assignments a ON a.course_id=m.course_id JOIN learning_courses c ON c.id=m.course_id WHERE m.id=?1 AND a.employee_id=?2 AND a.client_id=?3`).bind(Number(moduleId),Number(access.employee_id),Number(access.client_id)).first();
}

async function updatePublicLearningProgress(request,env,token,moduleId){
  const access=await getEmployeePortalAccess(env.DB,token); if(!access)return json({error:'ลิงก์หมดอายุ'},401); const assignment=await getAssignmentForPublicModule(env.DB,access,moduleId); if(!assignment)return json({error:'ไม่พบบทเรียนนี้'},404); const body=await safeJson(request); const watched=Math.max(0,Number(body.watched_seconds||0)); const pct=Math.max(0,Math.min(100,Number(body.progress_pct||0))); const completed=body.completed===true||pct>=95; const status=completed?'completed':(pct>0||watched>0?'in_progress':'not_started');
  await env.DB.prepare(`INSERT INTO learning_module_progress (client_id,assignment_id,module_id,status,progress_pct,watched_seconds,last_viewed_at,completed_at) VALUES (?1,?2,?3,?4,?5,?6,CURRENT_TIMESTAMP,CASE WHEN ?4='completed' THEN CURRENT_TIMESTAMP ELSE NULL END) ON CONFLICT(assignment_id,module_id) DO UPDATE SET status=excluded.status,progress_pct=MAX(learning_module_progress.progress_pct,excluded.progress_pct),watched_seconds=MAX(learning_module_progress.watched_seconds,excluded.watched_seconds),last_viewed_at=CURRENT_TIMESTAMP,completed_at=CASE WHEN excluded.status='completed' THEN COALESCE(learning_module_progress.completed_at,CURRENT_TIMESTAMP) ELSE learning_module_progress.completed_at END,updated_at=CURRENT_TIMESTAMP`).bind(Number(access.client_id),Number(assignment.id),moduleId,status,pct,watched).run();
  await refreshLearningAssignment(env.DB,Number(assignment.id)); return json({ok:true,status,progress_pct:pct});
}

async function submitPublicLearningQuiz(request,env,token,moduleId){
  const access=await getEmployeePortalAccess(env.DB,token); if(!access)return json({error:'ลิงก์หมดอายุ'},401); const assignment=await getAssignmentForPublicModule(env.DB,access,moduleId); if(!assignment||assignment.module_type!=='quiz')return json({error:'ไม่พบแบบทดสอบ'},404); const body=await safeJson(request); const answers=body.answers&&typeof body.answers==='object'?body.answers:{}; const questions=(await env.DB.prepare(`SELECT * FROM learning_quiz_questions WHERE module_id=?1 ORDER BY sort_order,id`).bind(moduleId).all()).results||[]; if(!questions.length)return json({error:'แบบทดสอบยังไม่มีคำถาม'},409); let score=0,max=0;
  for(const q of questions){const points=Number(q.points||1);max+=points;const correct=(safeJsonParse(q.correct_json,[])||[]).map(Number).sort((a,b)=>a-b);let actual=answers[String(q.id)]??answers[q.id]??[];actual=Array.isArray(actual)?actual.map(Number):[Number(actual)];actual=actual.filter(Number.isFinite).sort((a,b)=>a-b);if(JSON.stringify(actual)===JSON.stringify(correct))score+=points;}
  const scorePct=max?roundMoney(score/max*100):0; const passed=scorePct>=Number(assignment.passing_score||80); await env.DB.prepare(`INSERT INTO learning_quiz_attempts (client_id,assignment_id,module_id,employee_id,score,max_score,score_pct,passed,answers_json) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)`).bind(Number(access.client_id),Number(assignment.id),moduleId,Number(access.employee_id),score,max,scorePct,passed?1:0,JSON.stringify(answers)).run();
  await env.DB.prepare(`INSERT INTO learning_module_progress (client_id,assignment_id,module_id,status,progress_pct,last_viewed_at,completed_at) VALUES (?1,?2,?3,?4,?5,CURRENT_TIMESTAMP,CASE WHEN ?4='completed' THEN CURRENT_TIMESTAMP ELSE NULL END) ON CONFLICT(assignment_id,module_id) DO UPDATE SET status=excluded.status,progress_pct=excluded.progress_pct,last_viewed_at=CURRENT_TIMESTAMP,completed_at=CASE WHEN excluded.status='completed' THEN COALESCE(learning_module_progress.completed_at,CURRENT_TIMESTAMP) ELSE NULL END,updated_at=CURRENT_TIMESTAMP`).bind(Number(access.client_id),Number(assignment.id),moduleId,passed?'completed':'in_progress',passed?100:scorePct).run();
  await env.DB.prepare(`UPDATE learning_assignments SET attempts=attempts+1,score_pct=?1,updated_at=CURRENT_TIMESTAMP WHERE id=?2`).bind(scorePct,Number(assignment.id)).run(); await refreshLearningAssignment(env.DB,Number(assignment.id)); return json({ok:true,score,max_score:max,score_pct:scorePct,passed});
}

async function refreshLearningAssignment(db,assignmentId){
  const assignment=await db.prepare(`SELECT a.*,c.passing_score,c.title AS course_title FROM learning_assignments a JOIN learning_courses c ON c.id=a.course_id WHERE a.id=?1`).bind(assignmentId).first(); if(!assignment)return; const previousStatus=String(assignment.status||'assigned'); const modules=(await db.prepare(`SELECT * FROM learning_modules WHERE course_id=?1 ORDER BY id`).bind(Number(assignment.course_id)).all()).results||[]; if(!modules.length){await db.prepare(`UPDATE learning_assignments SET progress_pct=100,status='completed',started_at=COALESCE(started_at,CURRENT_TIMESTAMP),completed_at=COALESCE(completed_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE id=?1`).bind(assignmentId).run();if(previousStatus!=='completed')await awardEventRules(db,Number(assignment.client_id),Number(assignment.employee_id),'learning_complete',Number(assignment.course_id),`เรียนจบ · ${assignment.course_title||'หลักสูตร'}`);return;}
  const progress=(await db.prepare(`SELECT * FROM learning_module_progress WHERE assignment_id=?1`).bind(assignmentId).all()).results||[]; const map=new Map(progress.map(p=>[Number(p.module_id),p])); let completed=0,sum=0; for(const m of modules){const p=map.get(Number(m.id));const pct=Number(p?.progress_pct||0);sum+=pct;if(p?.status==='completed')completed++;} const totalPct=Math.round(sum/modules.length); const allRequired=modules.filter(m=>Number(m.required)).every(m=>map.get(Number(m.id))?.status==='completed'); const hasStarted=progress.some(p=>Number(p.progress_pct)>0); const status=allRequired?'completed':hasStarted?'in_progress':'assigned'; await db.prepare(`UPDATE learning_assignments SET progress_pct=?1,status=?2,started_at=CASE WHEN ?3=1 THEN COALESCE(started_at,CURRENT_TIMESTAMP) ELSE started_at END,completed_at=CASE WHEN ?2='completed' THEN COALESCE(completed_at,CURRENT_TIMESTAMP) ELSE NULL END,updated_at=CURRENT_TIMESTAMP WHERE id=?4`).bind(totalPct,status,hasStarted?1:0,assignmentId).run(); if(status==='completed'&&previousStatus!=='completed')await awardEventRules(db,Number(assignment.client_id),Number(assignment.employee_id),'learning_complete',Number(assignment.course_id),`เรียนจบ · ${assignment.course_title||'หลักสูตร'}`);
}

async function streamPublicLearningMedia(request,env,token,moduleId){
  const access=await getEmployeePortalAccess(env.DB,token); if(!access)return new Response('Link expired',{status:401}); const assignment=await getAssignmentForPublicModule(env.DB,access,moduleId); if(!assignment)return new Response('Not found',{status:404}); const module=await env.DB.prepare(`SELECT * FROM learning_modules WHERE id=?1 AND client_id=?2`).bind(moduleId,Number(access.client_id)).first(); if(!module?.drive_file_id)return new Response('Media not found',{status:404}); const workspace=await env.DB.prepare(`SELECT * FROM google_workspace_integrations WHERE client_id=?1 AND status='connected'`).bind(Number(access.client_id)).first(); if(!workspace)return new Response('Storage unavailable',{status:503}); const accessToken=await getWorkspaceGoogleAccessToken(env,workspace); const headers={authorization:`Bearer ${accessToken}`}; const range=request.headers.get('range'); if(range)headers.range=range; const r=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(module.drive_file_id)}?alt=media`,{headers}); if(!r.ok&&r.status!==206)return new Response('Media unavailable',{status:r.status}); const out=new Headers(); for(const key of ['content-type','content-length','content-range','accept-ranges','etag']){const v=r.headers.get(key);if(v)out.set(key,v);} out.set('cache-control','private, max-age=60'); out.set('content-disposition',`inline; filename*=UTF-8''${encodeURIComponent(module.file_name||'learning-media')}`); return new Response(r.body,{status:r.status,headers:out});
}

async function submitPublicKpiUpdate(request,env,token,goalId){
  const access=await getEmployeePortalAccess(env.DB,token); if(!access)return json({error:'ลิงก์หมดอายุ'},401); const goal=await env.DB.prepare(`SELECT * FROM kpi_goals WHERE id=?1 AND client_id=?2 AND employee_id=?3 AND status='active'`).bind(goalId,Number(access.client_id),Number(access.employee_id)).first(); if(!goal)return json({error:'ไม่พบ KPI'},404); const body=await safeJson(request); const progress=calculateKpiProgress(goal,body.actual_value,body.progress_pct); const result=await env.DB.prepare(`INSERT INTO kpi_updates (client_id,goal_id,employee_id,update_date,period_key,actual_value,actual_text,progress_pct,note,source) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,'line')`).bind(Number(access.client_id),goalId,Number(access.employee_id),body.update_date||dateInBangkok(),body.period_key||null,body.actual_value===''||body.actual_value==null?null:Number(body.actual_value),String(body.actual_text||'').trim()||null,progress,String(body.note||'').trim()||null).run(); if(Number(progress||0)>=100)await awardEventRules(env.DB,Number(access.client_id),Number(access.employee_id),'kpi_complete',goalId,`KPI สำเร็จ · ${goal.title}`); return json({ok:true,id:Number(result.meta.last_row_id),progress_pct:progress});
}

async function notifyLearningAssignments(env,clientId,course,employees){
  const lineCtx=await getEffectiveLineContextForClient(env,clientId); if(!lineCtx?.accessToken)return; const base=String(env.APP_BASE_URL||'https://hr-line.organization-23c.workers.dev').replace(/\/$/,'');
  for(const item of employees){const e=await env.DB.prepare(`SELECT * FROM employees WHERE id=?1 AND client_id=?2 AND status='active'`).bind(Number(item.id),Number(clientId)).first();if(!e?.line_user_id)continue;try{const token=await issueEmployeePortalToken(env.DB,clientId,Number(e.id));const url=`${base}/learn.html?token=${encodeURIComponent(token)}`;await pushLineMessages(lineCtx.accessToken,e.line_user_id,[{type:'flex',altText:`มีหลักสูตรใหม่: ${course.title}`,contents:lineBubble({eyebrow:'NEW LEARNING',title:'มีหลักสูตรใหม่ที่ต้องเรียน',subtitle:e.nickname||e.first_name,body:[lineInfoCard([lineInfoRow('หลักสูตร',course.title),lineInfoRow('สถานะ','มอบหมายแล้ว',LINE_CI.primary)]),lineText('เรียนวิดีโอ ทำ Quiz และดูความคืบหน้าได้จาก Employee Portal','xs',LINE_CI.muted)],footer:[linePrimaryButton('เริ่มเรียน',{type:'uri',label:'เริ่มเรียน',uri:url})]})}]);}catch{}}
}

async function sendLearningPortal(env,replyToken,emp,accessToken){
  await ensureV100P4Ready(env.DB); const token=await issueEmployeePortalToken(env.DB,Number(emp.client_id),Number(emp.id)); const base=String(env.APP_BASE_URL||'https://hr-line.organization-23c.workers.dev').replace(/\/$/,''); const url=`${base}/learn.html?token=${encodeURIComponent(token)}`; const [courses,goals]=await Promise.all([env.DB.prepare(`SELECT COUNT(*) AS total,SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed FROM learning_assignments WHERE client_id=?1 AND employee_id=?2`).bind(Number(emp.client_id),Number(emp.id)).first(),env.DB.prepare(`SELECT COUNT(*) AS total FROM kpi_goals WHERE client_id=?1 AND employee_id=?2 AND status='active'`).bind(Number(emp.client_id),Number(emp.id)).first()]);
  return replyLineMessages(accessToken,replyToken,[{type:'flex',altText:'Learning & KPI ของฉัน',contents:lineBubble({eyebrow:'GROW WITH NAKNA',title:'Learning & KPI ของฉัน',subtitle:emp.nickname||emp.first_name,body:[lineInfoCard([lineInfoRow('คอร์ส',`${Number(courses?.completed||0)}/${Number(courses?.total||0)} จบแล้ว`),lineInfoRow('KPI ที่ใช้งาน',`${Number(goals?.total||0)} รายการ`)]),lineText('เปิดหน้า Employee Portal เพื่อดูวิดีโอ ทำข้อสอบ และอัปเดต KPI ได้','xs',LINE_CI.muted)],footer:[linePrimaryButton('เปิด Learning Portal',{type:'uri',label:'เปิด Learning Portal',uri:url})]})}]);
}

async function sendEngagementPortal(env,replyToken,emp,accessToken){
  await ensurePhase5Defaults(env.DB,Number(emp.client_id)); const token=await issueEmployeePortalToken(env.DB,Number(emp.client_id),Number(emp.id)); const base=String(env.APP_BASE_URL||'https://hr-line.organization-23c.workers.dev').replace(/\/$/,''); const url=`${base}/learn.html?token=${encodeURIComponent(token)}#rewards`; const [wallet,rewards,rankRows]=await Promise.all([ensurePointWallet(env.DB,Number(emp.client_id),Number(emp.id)),env.DB.prepare(`SELECT COUNT(*) AS n FROM reward_catalog WHERE client_id=?1 AND status='active' AND (stock_qty IS NULL OR stock_qty>0)`).bind(Number(emp.client_id)).first(),env.DB.prepare(`SELECT employee_id,balance FROM employee_point_wallets WHERE client_id=?1 ORDER BY balance DESC,lifetime_earned DESC`).bind(Number(emp.client_id)).all()]); const rows=rankRows.results||[]; const rank=Math.max(1,rows.findIndex(r=>Number(r.employee_id)===Number(emp.id))+1);
  return replyLineMessages(accessToken,replyToken,[{type:'flex',altText:'แต้ม & ของรางวัล',contents:lineBubble({eyebrow:'NAKNA REWARDS',title:`${Number(wallet?.balance||0).toLocaleString('th-TH')} แต้ม`,subtitle:emp.nickname||emp.first_name,status:`อันดับ #${rank}`,statusTone:'warning',body:[lineInfoCard([lineInfoRow('แต้มคงเหลือ',`${Number(wallet?.balance||0).toLocaleString('th-TH')} แต้ม`,LINE_CI.warning),lineInfoRow('ได้สะสม',`${Number(wallet?.lifetime_earned||0).toLocaleString('th-TH')} แต้ม`),lineInfoRow('ของรางวัล',`${Number(rewards?.n||0)} รายการ`)]),lineText('เปิด Employee Portal เพื่อดูประวัติแต้ม แลกของรางวัล และดู Leaderboard','xs',LINE_CI.muted)],footer:[linePrimaryButton('เปิดแต้ม & ของรางวัล',{type:'uri',label:'เปิดของรางวัล',uri:url})]})}]);
}

function safeJsonParse(value,fallback=null){try{return JSON.parse(value);}catch{return fallback;}}

function canManagePeople(role) {
  return ['owner','co_owner','hr_admin','hr','manager'].includes(String(role || ''));
}
function canManagePeopleAdmin(role) {
  return ['owner','co_owner','hr_admin','hr'].includes(String(role || ''));
}

function canOverrideLeave(role) {
  return ['owner','co_owner','hr_admin','hr'].includes(String(role || ''));
}

function canManageIntegrations(role) {
  return ['owner','co_owner','hr_admin'].includes(String(role || ''));
}

function canManageApproverAccess(role) {
  return ['owner','co_owner','hr_admin','hr'].includes(String(role || ''));
}

function approverPermissionCatalog(){
  return [
    {key:'leave.approve',label:'อนุมัติการลา',description:'รับและตัดสินคำขอลาที่ถูกมอบหมายผ่าน LINE'},
    {key:'attendance.approve',label:'อนุมัติแก้เวลา',description:'สิทธิ์สำหรับ Flow แก้ไขเวลาเข้างาน/ออก'},
    {key:'ot.approve',label:'อนุมัติ OT',description:'เตรียมไว้สำหรับโมดูล OT'},
    {key:'hr_request.approve',label:'อนุมัติคำขอ HR',description:'เตรียมไว้สำหรับคำขอเอกสารและคำร้อง'},
    {key:'team.read',label:'ดูข้อมูลทีม',description:'ให้ผู้อนุมัติเห็นข้อมูลพื้นฐานของทีมที่เกี่ยวข้อง'}
  ];
}

async function employeeHasPermission(db,clientId,employeeId,key){
  if(!employeeId) return false;
  await ensureV061Ready(db);
  const row=await db.prepare('SELECT 1 AS ok FROM employee_permissions WHERE client_id=?1 AND employee_id=?2 AND permission_key=?3 LIMIT 1').bind(Number(clientId),Number(employeeId),String(key)).first();
  return Boolean(row);
}

async function linkLineAccount(db, lineUserId, token, { providerScope='default', expectedClientId=null, accessToken=null } = {}) {
  const row = await db.prepare(`
    SELECT t.*, e.first_name, e.nickname, e.client_id, c.name AS company_name
    FROM line_link_tokens t JOIN employees e ON e.id=t.employee_id JOIN clients c ON c.id=e.client_id
    WHERE t.token=?1 AND t.used_at IS NULL
  `).bind(token).first();
  if (!row) return { ok: false, error: 'รหัสไม่ถูกต้องหรือถูกใช้แล้ว' };
  if (expectedClientId && Number(row.client_id) !== Number(expectedClientId)) return { ok:false, error:'รหัสนี้เป็นของคนละบริษัทกับ LINE Official Account นี้' };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, error: 'รหัสหมดอายุแล้ว กรุณาขอรหัสใหม่จาก HR' };

  const used = await db.prepare("SELECT id FROM employees WHERE line_user_id=?1 AND COALESCE(line_provider_scope,'default')=?2").bind(lineUserId,providerScope).first();
  if (used && Number(used.id) !== Number(row.employee_id)) return { ok: false, error: 'LINE นี้เชื่อมกับพนักงานคนอื่นอยู่แล้ว' };

  await db.batch([
    db.prepare('UPDATE employees SET line_user_id=?1,line_provider_scope=?2,updated_at=CURRENT_TIMESTAMP WHERE id=?3').bind(lineUserId,providerScope,Number(row.employee_id)),
    db.prepare('UPDATE line_link_tokens SET used_at=CURRENT_TIMESTAMP WHERE token=?1').bind(token),
  ]);
  const linkedEmployee = await db.prepare(`SELECT id,client_id,employee_code,first_name,last_name,nickname,email,line_user_id,line_provider_scope,line_display_name,line_picture_url,status FROM employees WHERE id=?1`).bind(Number(row.employee_id)).first();
  if (linkedEmployee) await ensureEmployeeNaknaUser(db, linkedEmployee).catch(error => console.warn(JSON.stringify({level:'warn',event:'employee_line_user_backfill_skip',employee_id:Number(row.employee_id),message:String(error?.message||error)})));
  await audit(db, Number(row.client_id), 'line', lineUserId, 'employee.line_link', 'employee', String(row.employee_id), null);
  return { ok: true, name: row.nickname || row.first_name, company_name: row.company_name };
}

async function setLineSession(db,lineUserId,action,payload={}) {
  const expiresAt=new Date(Date.now()+30*60*1000).toISOString();
  await db.prepare(`INSERT INTO line_sessions (line_user_id,action,payload_json,expires_at) VALUES (?1,?2,?3,?4)
    ON CONFLICT(line_user_id) DO UPDATE SET action=excluded.action,payload_json=excluded.payload_json,expires_at=excluded.expires_at,created_at=CURRENT_TIMESTAMP`)
    .bind(lineUserId,action,JSON.stringify(payload||{}),expiresAt).run();
}
async function getLineSession(db,lineUserId){
  const row=await db.prepare('SELECT * FROM line_sessions WHERE line_user_id=?1').bind(lineUserId).first();
  if(!row) return null; if(new Date(row.expires_at).getTime()<=Date.now()){await clearLineSession(db,lineUserId);return null;}
  let payload={}; try{payload=JSON.parse(row.payload_json||'{}')}catch{}
  return {...row,payload};
}
async function clearLineSession(db,lineUserId){await db.prepare('DELETE FROM line_sessions WHERE line_user_id=?1').bind(lineUserId).run();}


function num(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
function nullableNum(value){if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)?n:null;}
function slugCode(value){return String(value||'').trim().toLowerCase().replace(/[^a-z0-9ก-๙]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40);}
async function departmentParentCreatesCycle(db,clientId,departmentId,parentId){
  let cursor=Number(parentId||0);
  const seen=new Set([Number(departmentId)]);
  while(cursor){
    if(seen.has(cursor)) return true;
    seen.add(cursor);
    const row=await db.prepare('SELECT parent_department_id FROM departments WHERE id=?1 AND client_id=?2').bind(cursor,clientId).first();
    if(!row) return false;
    cursor=row.parent_department_id?Number(row.parent_department_id):0;
  }
  return false;
}
function formatThaiDateOnly(date){try{return new Date(`${date}T12:00:00+07:00`).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit',timeZone:'Asia/Bangkok'});}catch{return date;}}

async function ensureDashboardAttentionReady(db){
  if(SCHEMA_READY.has('dashboard_attention_reads')) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS dashboard_attention_reads (
    client_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    attention_key TEXT NOT NULL,
    item_key TEXT NOT NULL,
    read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (client_id,user_id,attention_key,item_key)
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_dashboard_attention_reads_user ON dashboard_attention_reads(client_id,user_id,attention_key,read_at)`).run().catch(()=>{});
  SCHEMA_READY.add('dashboard_attention_reads');
}

async function ensureV050Ready(db){
  if(SCHEMA_READY.has('v050')) return;
  const ready=await db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('leave_policies','leave_evidence_share_tokens')").first();
  if(Number(ready?.n||0)<2) await ensureV050Schema(db);
  else {
    await ensureColumns(db,'line_sessions',[['payload_json','TEXT']]);
    await ensureColumns(db,'employees',[['leave_approver_employee_id','INTEGER']]);
  }
  SCHEMA_READY.add('v050');
}

async function ensureV050Schema(db){
  const statements=V050_SCHEMA_SQL.split(';').map(x=>x.trim()).filter(Boolean);
  for(const statement of statements){try{await db.prepare(statement).run();}catch(error){if(/CREATE INDEX/i.test(statement)){console.warn(JSON.stringify({level:'warn',event:'v050_index_skip',message:String(error?.message||error)}));continue;}throw error;}}
  for(const [column,type] of [['leave_approver_employee_id','INTEGER']]) await ensureColumn(db,'employees',column,type);
  for(const [column,type] of [['payload_json','TEXT']]) await ensureColumn(db,'line_sessions',column,type);
  const leaveCols=[['policy_id','INTEGER'],['duration_days','REAL'],['day_part','TEXT'],['evidence_required','INTEGER'],['evidence_count','INTEGER'],['decision_reason','TEXT'],['decided_by_employee_id','INTEGER'],['decided_by_user_id','INTEGER'],['submitted_via','TEXT']];
  for(const [column,type] of leaveCols) await ensureColumn(db,'leave_requests',column,type);
}

async function ensureV060Ready(db){
  if(SCHEMA_READY.has('v060')) return;
  const ready=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='line_integrations'").first();
  if(!ready){
    const statements=V060_SCHEMA_SQL.split(';').map(x=>x.trim()).filter(Boolean);
    for(const statement of statements){try{await db.prepare(statement).run();}catch(error){if(/CREATE INDEX/i.test(statement)){continue;}throw error;}}
  }
  await ensureColumns(db,'employees',[['line_provider_scope','TEXT']]);
  SCHEMA_READY.add('v060');
}

async function ensureV061Ready(db){
  if(SCHEMA_READY.has('v061')) return;
  await ensureV050Ready(db);
  const ready=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='employee_permissions'").first();
  if(!ready){
    const statements=V061_SCHEMA_SQL.split(';').map(x=>x.trim()).filter(Boolean);
    for(const statement of statements){try{await db.prepare(statement).run();}catch(error){if(/CREATE INDEX/i.test(statement))continue;throw error;}}
    await db.prepare(`INSERT OR IGNORE INTO employee_permissions (client_id,employee_id,permission_key)
      SELECT DISTINCT client_id,leave_approver_employee_id,'leave.approve' FROM employees WHERE leave_approver_employee_id IS NOT NULL`).run();
  }
  SCHEMA_READY.add('v061');
}

async function ensureV063Ready(db){
  if(SCHEMA_READY.has('v063')) return;
  const ready=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='google_workspace_integrations'").first();
  if(!ready){
    const statements=V063_SCHEMA_SQL.split(';').map(x=>x.trim()).filter(Boolean);
    for(const statement of statements){try{await db.prepare(statement).run();}catch(error){if(/CREATE INDEX/i.test(statement))continue;throw error;}}
  }
  await ensureColumns(db,'google_workspace_integrations',[['leave_evidence_folder_id','TEXT']]);
  await ensureColumns(db,'leave_request_evidence',[['drive_file_id','TEXT'],['drive_url','TEXT'],['storage_provider','TEXT']]);
  SCHEMA_READY.add('v063');
}


async function ensureV100P1Ready(db){
  if(SCHEMA_READY.has('p1')) return;
  const ready=await db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('work_schedule_rules','company_holidays')").first();
  if(Number(ready?.n||0)<2){
    const statements=V100P1_SCHEMA_SQL.split(';').map(x=>x.trim()).filter(Boolean);
    for(const statement of statements){try{await db.prepare(statement).run();}catch(error){if(/CREATE INDEX/i.test(statement))continue;throw error;}}
  }
  await ensureColumns(db,'departments',[['parent_department_id','INTEGER'],['sort_order','INTEGER NOT NULL DEFAULT 0']]);
  await ensureColumns(db,'employees',[['people_status',"TEXT NOT NULL DEFAULT 'employee'"],['confirmed_at','TEXT'],['end_date','TEXT'],['end_reason','TEXT']]);
  await ensureColumns(db,'clients',[['allow_checkout_outside_geofence','INTEGER NOT NULL DEFAULT 0']]);
  await ensureColumns(db,'attendance',[['checkout_outside_geofence','INTEGER NOT NULL DEFAULT 0'],['scheduled_start','TEXT'],['scheduled_end','TEXT'],['schedule_source','TEXT']]);
  SCHEMA_READY.add('p1');
}

async function ensureV100P2Ready(db){
  if(SCHEMA_READY.has('p2')) return;
  await ensureV100P1Ready(db);
  await ensureV050Ready(db);
  const ready=await db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('hr_cases','broadcasts','leave_ledger')").first();
  if(Number(ready?.n||0)<3){
    const statements=V100P2_SCHEMA_SQL.split(';').map(x=>x.trim()).filter(Boolean);
    for(const statement of statements){try{await db.prepare(statement).run();}catch(error){if(/CREATE INDEX/i.test(statement))continue;throw error;}}
  }
  await ensureColumns(db,'clients',[['lock_leave_during_probation','INTEGER NOT NULL DEFAULT 1']]);
  await ensureColumns(db,'employees',[['leave_access_override','INTEGER']]);
  await ensureColumns(db,'leave_policies',[['available_during_probation','INTEGER NOT NULL DEFAULT 0']]);
  await ensureColumns(db,'line_integrations',[['rich_menu_id','TEXT'],['rich_menu_updated_at','TEXT']]);
  await ensureColumns(db,'hr_cases',[['category','TEXT'],['contact_preference','TEXT']]);
  await db.prepare(`CREATE TABLE IF NOT EXISTS hr_case_attachments (id INTEGER PRIMARY KEY AUTOINCREMENT,client_id INTEGER NOT NULL,case_id INTEGER NOT NULL,file_name TEXT NOT NULL,content_type TEXT,file_size INTEGER,storage_provider TEXT,drive_file_id TEXT,drive_url TEXT,storage_key TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,FOREIGN KEY (case_id) REFERENCES hr_cases(id) ON DELETE CASCADE)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_hr_case_attachments_case ON hr_case_attachments(case_id,created_at)`).run().catch(()=>{});
  SCHEMA_READY.add('p2');
}

async function ensureV100P3Ready(db){
  if(SCHEMA_READY.has('p3')) return;
  await ensureV100P2Ready(db);
  const ready=await db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('payroll_periods','payroll_documents','employee_documents')").first();
  if(Number(ready?.n||0)<3){
    const statements=V100P3_SCHEMA_SQL.split(';').map(x=>x.trim()).filter(Boolean);
    for(const statement of statements){try{await db.prepare(statement).run();}catch(error){if(/CREATE INDEX/i.test(statement))continue;throw error;}}
  }
  await db.prepare(`ALTER TABLE payroll_settings ADD COLUMN auto_payslip_on_lock INTEGER NOT NULL DEFAULT 1`).run().catch(()=>{});
  SCHEMA_READY.add('p3');
}

async function ensureV100P4Ready(db){
  if(SCHEMA_READY.has('p4')) return;
  await ensureV100P3Ready(db);
  const ready=await db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('learning_courses','performance_cycles','kpi_goals')").first();
  if(Number(ready?.n||0)<3){
    const statements=V100P4_SCHEMA_SQL.split(';').map(x=>x.trim()).filter(Boolean);
    for(const statement of statements){try{await db.prepare(statement).run();}catch(error){if(/CREATE INDEX/i.test(statement))continue;throw error;}}
  }
  SCHEMA_READY.add('p4');
}

async function ensureV100P5Ready(db){
  if(SCHEMA_READY.has('p5')) return;
  await ensureV100P4Ready(db);
  const ready=await db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('engagement_settings','reward_catalog','company_subscriptions','billing_invoices')").first();
  if(Number(ready?.n||0)<4){
    const statements=V100P5_SCHEMA_SQL.split(';').map(x=>x.trim()).filter(Boolean);
    for(const statement of statements){
      try{await db.prepare(statement).run();}
      catch(error){if(/CREATE INDEX/i.test(statement))continue;throw error;}
    }
  }
  SCHEMA_READY.add('p5');
}


async function ensureV100P7Ready(db){
  if(SCHEMA_READY.has('p7')) return;
  await ensureV100P5Ready(db);
  const ready=await db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('line_web_login_tokens','company_onboarding','recruitment_email_settings','recruitment_email_messages','benefit_programs','employee_benefit_enrollments')").first();
  if(Number(ready?.n||0)<6){
    const statements=V100P7_SCHEMA_SQL.split(';').map(x=>x.trim()).filter(Boolean);
    for(const statement of statements){
      try{await db.prepare(statement).run();}
      catch(error){if(/CREATE INDEX/i.test(statement))continue;throw error;}
    }
  }
  await db.prepare(`CREATE TABLE IF NOT EXISTS company_assets (client_id INTEGER PRIMARY KEY, logo_data_url TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
  SCHEMA_READY.add('p7');
}

async function ensureP7CompanyDefaults(db,clientId,userId=null){
  await ensureV100P7Ready(db);
  const cid=Number(clientId);
  await db.prepare(`INSERT OR IGNORE INTO recruitment_email_settings (client_id,enabled,query,auto_sync) VALUES (?1,1,'newer_than:30d {สมัคร resume CV "job application"}',1)`).bind(cid).run();
  const defaults=[
    ['social-security','ประกันสังคม','social_security','สิทธิประกันสังคมสำหรับพนักงานตามเงื่อนไขที่บริษัทและกฎหมายกำหนด',0,0,'monthly',1],
    ['group-insurance','ประกันกลุ่ม','insurance','ประกันกลุ่มของบริษัท',0,0,'monthly',0],
    ['medical','ค่ารักษาพยาบาล','medical','วงเงินค่ารักษาพยาบาล / OPD / IPD ตามนโยบายบริษัท',0,0,'annual',0]
  ];
  for(const row of defaults){
    await db.prepare(`INSERT OR IGNORE INTO benefit_programs (client_id,code,name,benefit_type,description,employer_amount,employee_amount,frequency,is_statutory,status,created_by_user_id) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,'active',?10)`).bind(cid,...row,userId?Number(userId):null).run();
  }
}

async function ensurePhase5Defaults(db,clientId){
  await ensureV100P5Ready(db);
  const id=Number(clientId);
  await db.prepare(`INSERT OR IGNORE INTO engagement_settings (client_id) VALUES (?1)`).bind(id).run();
  const defaults=[
    ['attendance-10','มาตรงเวลา 10 ครั้ง','ให้แต้มเมื่อมี Attendance ตรงเวลาครบทุก 10 ครั้ง','attendance_streak',100,0,10,0],
    ['learning-complete','เรียนจบหลักสูตร','ให้แต้มเมื่อเรียนหลักสูตรที่ได้รับมอบหมายจบ','learning_complete',50,0,1,0],
    ['kpi-complete','KPI สำเร็จ','ให้แต้มเมื่อ KPI ถึง 100%','kpi_complete',100,0,1,0],
    ['birthday','Birthday Moment','แต้มวันเกิดพนักงาน','birthday',50,0,1,0],
    ['anniversary','Work Anniversary','แต้มครบรอบการทำงาน','work_anniversary',100,0,1,0]
  ];
  for(const r of defaults){
    await db.prepare(`INSERT OR IGNORE INTO point_rules (client_id,code,name,description,event_type,points,cash_value,threshold_count,is_active,effective_from) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)`).bind(id,...r,dateInBangkok()).run();
  }
  const trialPlan=await db.prepare(`SELECT id,trial_days FROM subscription_plans WHERE code='trial' LIMIT 1`).first();
  const existing=await db.prepare('SELECT id FROM company_subscriptions WHERE client_id=?1').bind(id).first();
  if(!existing){
    const start=new Date(); const end=new Date(start.getTime()+Number(trialPlan?.trial_days||30)*86400000);
    await db.prepare(`INSERT INTO company_subscriptions (client_id,plan_id,status,billing_cycle,trial_started_at,trial_ends_at,current_period_start,current_period_end) VALUES (?1,?2,'trialing','monthly',?3,?4,?3,?4)`).bind(id,trialPlan?.id||null,start.toISOString(),end.toISOString()).run();
  }
  await snapshotCompanyUsage(db,id,dateInBangkok());
}

async function ensurePayrollDefaults(db, clientId){
  await ensureV100P3Ready(db);
  await db.prepare(`INSERT OR IGNORE INTO payroll_settings (client_id) VALUES (?1)`).bind(Number(clientId)).run();
  const taxConfig = JSON.stringify({expense_rate:0.5,expense_cap:100000,personal_allowance:60000,brackets:[{up_to:150000,rate:0},{up_to:300000,rate:0.05},{up_to:500000,rate:0.10},{up_to:750000,rate:0.15},{up_to:1000000,rate:0.20},{up_to:2000000,rate:0.25},{up_to:5000000,rate:0.30},{up_to:null,rate:0.35}]});
  const ssoConfig = JSON.stringify({employee_rate:0.05,wage_floor:1650,wage_ceiling:17500});
  await db.prepare(`INSERT OR IGNORE INTO payroll_rule_versions (client_id,rule_key,version,effective_from,config_json,source_note,is_system) VALUES (?1,'thai_personal_income_tax','TH-2026','2026-01-01',?2,'กรมสรรพากร: เงินได้ ม.40(1) ค่าใช้จ่าย 50% สูงสุด 100,000 บาท; อัตราภาษี 0-35%',1)`).bind(Number(clientId),taxConfig).run();
  await db.prepare(`INSERT OR IGNORE INTO payroll_rule_versions (client_id,rule_key,version,effective_from,effective_to,config_json,source_note,is_system) VALUES (?1,'thai_social_security','SSO-2026-2028','2026-01-01','2028-12-31',?2,'เพดานค่าจ้างประกันสังคมช่วง พ.ศ. 2569-2571 = 17,500 บาท',1)`).bind(Number(clientId),ssoConfig).run();
}

function lineSessionKey(providerScope,lineUserId){return `${providerScope||'default'}:${lineUserId}`;}
function integrationEncryptionKey(env){return env.NAKNA_INTEGRATION_ENCRYPTION_KEY || env.GOOGLE_TOKEN_ENCRYPTION_KEY || null;}
function defaultLineContext(env){return env.LINE_CHANNEL_SECRET&&env.LINE_CHANNEL_ACCESS_TOKEN?{channelSecret:env.LINE_CHANNEL_SECRET,accessToken:env.LINE_CHANNEL_ACCESS_TOKEN,providerScope:'default',clientId:null,integrationId:null}:null;}

async function decryptLineIntegrationCredentials(env,row){
  const key=integrationEncryptionKey(env); if(!key) throw new Error('Integration encryption key is not configured');
  const data=await decryptJson(row.encrypted_credentials,key);
  if(!data?.channel_secret||!data?.access_token) throw new Error('LINE credentials are incomplete');
  return data;
}

async function getWorkspaceLineIntegration(env,clientId,withCredentials=false){
  if(!clientId)return null;
  const row=await env.DB.prepare("SELECT * FROM line_integrations WHERE client_id=?1 AND status='connected'").bind(Number(clientId)).first();
  if(!row)return null;
  if(withCredentials)return {...row,credentials:await decryptLineIntegrationCredentials(env,row)};
  return row;
}

async function getLineIntegrationByWebhookKey(env,webhookKey){
  const row=await env.DB.prepare("SELECT * FROM line_integrations WHERE webhook_key=?1 AND status='connected'").bind(webhookKey).first();
  if(!row)return null;
  const credentials=await decryptLineIntegrationCredentials(env,row);
  return {channelSecret:credentials.channel_secret,accessToken:credentials.access_token,providerScope:`integration:${row.id}`,clientId:Number(row.client_id),integrationId:Number(row.id),webhookKey:row.webhook_key};
}

async function getEffectiveLineContextForClient(env,clientId){
  await ensureV060Ready(env.DB);
  const row=await getWorkspaceLineIntegration(env,clientId,true);
  if(row)return {channelSecret:row.credentials.channel_secret,accessToken:row.credentials.access_token,providerScope:`integration:${row.id}`,clientId:Number(clientId),integrationId:Number(row.id),webhookKey:row.webhook_key};
  return defaultLineContext(env);
}

async function getAccessTokenForProviderScope(env,clientId,scope){
  const normalized=scope||'default';
  if(normalized==='default')return env.LINE_CHANNEL_ACCESS_TOKEN||null;
  const match=String(normalized).match(/^integration:(\d+)$/); if(!match)return null;
  const row=await env.DB.prepare("SELECT * FROM line_integrations WHERE id=?1 AND client_id=?2 AND status='connected'").bind(Number(match[1]),Number(clientId)).first();
  if(!row)return null;
  const creds=await decryptLineIntegrationCredentials(env,row); return creds.access_token;
}

function publicLineIntegration(row,live=null,includeWebhook=true){
  return {id:Number(row.id),channel_id:row.channel_id||null,bot_user_id:row.bot_user_id||null,bot_basic_id:row.bot_basic_id||null,bot_display_name:row.bot_display_name||null,bot_picture_url:row.bot_picture_url||null,webhook_url:includeWebhook?row.webhook_url:null,webhook_active:live?Boolean(live.active):Boolean(Number(row.webhook_active)),status:row.status,last_test_at:row.last_test_at||null,last_error:row.last_error||null,connected_at:row.created_at};
}

async function setLineWebhookEndpoint(accessToken,endpoint){
  const response=await fetch('https://api.line.me/v2/bot/channel/webhook/endpoint',{method:'PUT',headers:{authorization:`Bearer ${accessToken}`,'content-type':'application/json'},body:JSON.stringify({endpoint})});
  if(!response.ok)throw new Error(`LINE webhook setup failed ${response.status}`);
}
async function getLineWebhookInfo(accessToken){
  const response=await fetch('https://api.line.me/v2/bot/channel/webhook/endpoint',{headers:{authorization:`Bearer ${accessToken}`,'content-type':'application/json'}});
  if(response.status===404)return {endpoint:null,active:false};
  if(!response.ok)throw new Error(`LINE webhook info failed ${response.status}`); return response.json();
}
async function testLineWebhook(accessToken,endpoint){
  const response=await fetch('https://api.line.me/v2/bot/channel/webhook/test',{method:'POST',headers:{authorization:`Bearer ${accessToken}`,'content-type':'application/json'},body:JSON.stringify(endpoint?{endpoint}:{})});
  const data=await response.json().catch(()=>({})); if(!response.ok)throw new Error(`LINE webhook test failed ${response.status}`); return data;
}

async function saveWorkspaceLineIntegration(env,{clientId,userId,channelId,channelSecret,accessToken}){
  const key=integrationEncryptionKey(env); if(!key)throw new Error('NAKNA_INTEGRATION_ENCRYPTION_KEY_OR_GOOGLE_TOKEN_ENCRYPTION_KEY_MISSING');
  const bot=await getLineBotInfo(accessToken);
  const duplicate=bot?.userId ? await env.DB.prepare("SELECT client_id FROM line_integrations WHERE bot_user_id=?1 AND client_id<>?2 AND status='connected'").bind(bot.userId,Number(clientId)).first() : null;
  if(duplicate) throw new Error('LINE_OA_ALREADY_CONNECTED');
  let existing=await env.DB.prepare('SELECT * FROM line_integrations WHERE client_id=?1').bind(Number(clientId)).first();
  const webhookKey=existing?.webhook_key||randomToken(32);
  const base=String(env.APP_BASE_URL||'https://hr-line.organization-23c.workers.dev').replace(/\/$/,'');
  const webhookUrl=`${base}/webhooks/line/${webhookKey}`;
  await setLineWebhookEndpoint(accessToken,webhookUrl);
  const webhook=await getLineWebhookInfo(accessToken).catch(()=>({endpoint:webhookUrl,active:false}));
  const encrypted=await encryptJson({channel_secret:channelSecret,access_token:accessToken},key);
  await env.DB.prepare(`INSERT INTO line_integrations (client_id,channel_id,bot_user_id,bot_basic_id,bot_display_name,bot_picture_url,encrypted_credentials,webhook_key,webhook_url,webhook_active,status,last_test_at,last_error,connected_by_user_id)
    VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,'connected',CURRENT_TIMESTAMP,NULL,?11)
    ON CONFLICT(client_id) DO UPDATE SET channel_id=excluded.channel_id,bot_user_id=excluded.bot_user_id,bot_basic_id=excluded.bot_basic_id,bot_display_name=excluded.bot_display_name,bot_picture_url=excluded.bot_picture_url,encrypted_credentials=excluded.encrypted_credentials,webhook_key=excluded.webhook_key,webhook_url=excluded.webhook_url,webhook_active=excluded.webhook_active,status='connected',last_test_at=CURRENT_TIMESTAMP,last_error=NULL,connected_by_user_id=excluded.connected_by_user_id,updated_at=CURRENT_TIMESTAMP`)
    .bind(Number(clientId),channelId,bot.userId||null,bot.basicId||null,bot.displayName||null,bot.pictureUrl||null,encrypted,webhookKey,webhookUrl,webhook?.active?1:0,userId).run();
  return env.DB.prepare('SELECT * FROM line_integrations WHERE client_id=?1').bind(Number(clientId)).first();
}

function safeLineIntegrationError(error){
  const text=String(error?.message||error||'LINE integration failed');
  if(text.includes('bot info failed 401'))return 'Channel Access Token ไม่ถูกต้อง หรือถูกยกเลิกแล้ว';
  if(text.includes('LINE_OA_ALREADY_CONNECTED'))return 'LINE Official Account นี้ถูกเชื่อมกับ Workspace อื่นแล้ว';
  if(text.includes('webhook setup failed'))return 'ตั้ง Webhook ที่ LINE ไม่สำเร็จ กรุณาตรวจ Channel Access Token';
  if(text.includes('ENCRYPTION_KEY'))return 'ยังไม่มี Encryption Key สำหรับเก็บ LINE credentials';
  return 'เชื่อม LINE Official Account ไม่สำเร็จ กรุณาตรวจข้อมูลแล้วลองใหม่';
}

async function ensureDefaultLeavePolicies(db,clientId){
  if(!clientId) return;
  const defaults=[
    ['annual','ลาพักร้อน',6,0,1,null,1,0,10,0],
    ['sick','ลาป่วย',30,0,1,3,0,0,20,1],
    ['personal','ลากิจ',3,0,1,null,1,0,30,0],
    ['unpaid','ลาไม่รับค่าจ้าง',0,1,1,null,0,1,40,0],
  ];
  for(const d of defaults){await db.prepare(`INSERT OR IGNORE INTO leave_policies (client_id,code,name,default_entitlement_days,is_unlimited,requires_reason,evidence_required_after_days,notice_days,allow_negative,is_active,sort_order,available_during_probation) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,1,?10,?11)`).bind(clientId,...d).run();}
  await db.prepare(`UPDATE leave_policies SET available_during_probation=1 WHERE client_id=?1 AND code='sick'`).bind(clientId).run();
}

async function getEmployeeForClient(db,id,clientId){return db.prepare(`SELECT e.*,c.work_start,c.work_end,c.late_grace_minutes,c.timezone,c.lock_leave_during_probation FROM employees e JOIN clients c ON c.id=e.client_id WHERE e.id=?1 AND e.client_id=?2`).bind(id,clientId).first();}

function businessDaysInclusive(startDate,endDate,dayPart='full'){
  const start=new Date(`${startDate}T12:00:00+07:00`),end=new Date(`${endDate}T12:00:00+07:00`); if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<start) throw httpError('ช่วงวันลาไม่ถูกต้อง',400);
  let days=0; for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){const dow=d.getDay();if(dow!==0&&dow!==6)days++;}
  if(startDate===endDate&&['am','pm','half'].includes(dayPart)) days=0.5;
  return days|| (startDate===endDate?1:0);
}

async function calculateEmployeeLeaveDuration(db,employee,startDate,endDate,dayPart='full'){
  const start=new Date(`${startDate}T12:00:00+07:00`),end=new Date(`${endDate}T12:00:00+07:00`);
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<start) throw httpError('ช่วงวันลาไม่ถูกต้อง',400);
  let days=0;
  for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
    const date=new Date(d).toISOString().slice(0,10);
    const schedule=await resolveEffectiveWorkSchedule(db,employee,date);
    if(schedule.is_workday) days+=1;
  }
  if(startDate===endDate&&days>0&&['am','pm','half'].includes(dayPart)) days=0.5;
  return days;
}

async function leaveEligibility(db,employee,policy){
  const client=await getClient(db,Number(employee.client_id));
  if(Number(employee.leave_access_override)===0) return {allowed:false,reason:'HR ล็อกสิทธิ์การลาของบัญชีนี้อยู่'};
  if(Number(employee.leave_access_override)===1) return {allowed:true,source:'employee_override'};
  const probation=String(employee.people_status||'')==='probation' || (employee.probation_end_date && !employee.confirmed_at && String(employee.status)==='active');
  if(probation && Number(client?.lock_leave_during_probation ?? 1) && !Number(policy.available_during_probation||0)){
    return {allowed:false,reason:'สิทธิ์ลานี้จะเปิดหลังผ่านทดลองงาน กรุณาติดต่อ HR หากต้องการขออนุมัติเป็นกรณีพิเศษ'};
  }
  return {allowed:true,source:probation?'policy_probation_allowed':'normal'};
}

async function getEmployeeLeaveProfile(db,employeeId,clientId,year){
  await ensureDefaultLeavePolicies(db,clientId);
  const employee=await db.prepare(`SELECT e.*,ap.nickname AS approver_nickname,ap.first_name AS approver_first_name,ap.last_name AS approver_last_name,c.lock_leave_during_probation FROM employees e LEFT JOIN employees ap ON ap.id=e.leave_approver_employee_id JOIN clients c ON c.id=e.client_id WHERE e.id=?1 AND e.client_id=?2`).bind(employeeId,clientId).first();
  if(!employee) throw httpError('ไม่พบพนักงาน',404);
  const policies=(await db.prepare('SELECT * FROM leave_policies WHERE client_id=?1 AND is_active=1 ORDER BY sort_order,name').bind(clientId).all()).results||[];
  const ent=(await db.prepare('SELECT * FROM employee_leave_entitlements WHERE employee_id=?1 AND year=?2').bind(employeeId,year).all()).results||[];
  const requests=(await db.prepare(`SELECT policy_id,status,SUM(COALESCE(duration_days,0)) AS days FROM leave_requests WHERE employee_id=?1 AND substr(start_date,1,4)=?2 AND status IN ('approved','pending','awaiting_evidence') GROUP BY policy_id,status`).bind(employeeId,String(year)).all()).results||[];
  const balances=await Promise.all(policies.map(async policy=>{
    const override=ent.find(x=>Number(x.leave_policy_id)===Number(policy.id));
    const entitlement=override?num(override.entitlement_days):num(policy.default_entitlement_days); const adjustment=override?num(override.adjustment_days):0;
    const used=requests.filter(x=>Number(x.policy_id)===Number(policy.id)&&x.status==='approved').reduce((a,x)=>a+num(x.days),0);
    const pending=requests.filter(x=>Number(x.policy_id)===Number(policy.id)&&x.status!=='approved').reduce((a,x)=>a+num(x.days),0);
    const total=entitlement+adjustment; const remaining=Number(policy.is_unlimited)?null:Math.max(-999,total-used-pending);
    const eligibility=await leaveEligibility(db,employee,policy);
    return {...policy,entitlement_days:entitlement,adjustment_days:adjustment,total_days:total,used_days:used,pending_days:pending,remaining_days:remaining,note:override?.note||null,available_now:Boolean(eligibility.allowed),locked_reason:eligibility.allowed?null:eligibility.reason};
  }));
  return {employee,year,balances,leave_access:{override:employee.leave_access_override,lock_during_probation:Boolean(Number(employee.lock_leave_during_probation??1))}};
}

async function resolveLeavePolicy(db,clientId,policyId,leaveType){
  await ensureDefaultLeavePolicies(db,clientId);
  if(policyId) return db.prepare('SELECT * FROM leave_policies WHERE id=?1 AND client_id=?2 AND is_active=1').bind(policyId,clientId).first();
  if(leaveType) return db.prepare('SELECT * FROM leave_policies WHERE code=?1 AND client_id=?2 AND is_active=1').bind(leaveType,clientId).first();
  return null;
}

async function createLeaveRequest(env,{clientId,employeeId,policyId,leaveType,startDate,endDate,dayPart='full',reason='',submittedVia='line',submittedByUserId=null}){
  const employee=await getEmployeeForClient(env.DB,employeeId,clientId); if(!employee) throw httpError('ไม่พบพนักงาน',404);
  const policy=await resolveLeavePolicy(env.DB,clientId,policyId,leaveType); if(!policy) throw httpError('ไม่พบประเภทลา',400);
  if(!startDate||!endDate) throw httpError('กรุณาเลือกวันลาให้ครบ',400);
  const eligibility=await leaveEligibility(env.DB,employee,policy); if(!eligibility.allowed) throw httpError(eligibility.reason,409);
  const duration=await calculateEmployeeLeaveDuration(env.DB,employee,startDate,endDate,dayPart); if(duration<=0) throw httpError('ช่วงนี้ไม่มีวันทำงานให้ลา',400);
  if(Number(policy.requires_reason)&&String(reason).trim().length<2) throw httpError('กรุณาระบุเหตุผลการลา',400);
  const overlap=await env.DB.prepare("SELECT id FROM leave_requests WHERE employee_id=?1 AND status IN ('pending','awaiting_evidence','approved') AND NOT(end_date<?2 OR start_date>?3) LIMIT 1").bind(employeeId,startDate,endDate).first(); if(overlap) throw httpError('มีคำขอลาในช่วงวันที่นี้อยู่แล้ว',409);
  const profile=await getEmployeeLeaveProfile(env.DB,employeeId,clientId,Number(startDate.slice(0,4)));
  const bal=profile.balances.find(x=>Number(x.id)===Number(policy.id));
  if(!Number(policy.is_unlimited)&&!Number(policy.allow_negative)&&num(bal?.remaining_days)<duration) throw httpError(`สิทธิ์${policy.name}ไม่พอ · เหลือ ${num(bal?.remaining_days)} วัน`,409);
  if(submittedVia==='line' && num(policy.notice_days)>0){
    const today=dateInBangkok(); const minDate=new Date(`${today}T12:00:00+07:00`); minDate.setDate(minDate.getDate()+num(policy.notice_days));
    if(new Date(`${startDate}T12:00:00+07:00`)<minDate) throw httpError(`${policy.name} ต้องแจ้งล่วงหน้าอย่างน้อย ${policy.notice_days} วัน`,409);
  }
  const evidenceRequired=policy.evidence_required_after_days!=null && duration>=num(policy.evidence_required_after_days);
  let approverId=employee.leave_approver_employee_id||employee.manager_employee_id||null;
  if(approverId && !await employeeHasPermission(env.DB,clientId,Number(approverId),'leave.approve')) approverId=null;
  // No named approver is valid: the request falls back to the Owner/HR dashboard queue.
  // This matches Nakna's workflow where companies can choose manager approval OR direct HR approval.
  const status=evidenceRequired?'awaiting_evidence':'pending';
  const result=await env.DB.prepare(`INSERT INTO leave_requests (client_id,employee_id,leave_type,policy_id,start_date,end_date,reason,status,approver_employee_id,duration_days,day_part,evidence_required,evidence_count,submitted_via) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,0,?13)`)
    .bind(clientId,employeeId,policy.code,Number(policy.id),startDate,endDate,reason||null,status,approverId,duration,dayPart,evidenceRequired?1:0,submittedVia).run();
  const id=Number(result.meta.last_row_id);
  await env.DB.prepare(`INSERT INTO leave_approval_events (client_id,leave_request_id,action,actor_type,actor_employee_id,actor_user_id,reason) VALUES (?1,?2,'submitted',?3,?4,?5,?6)`).bind(clientId,id,submittedVia==='line'?'employee':'user',submittedVia==='line'?employeeId:null,submittedVia==='line'?null:submittedByUserId,reason||null).run();
  await env.DB.prepare(`INSERT OR IGNORE INTO leave_ledger(client_id,employee_id,leave_policy_id,year,entry_type,days,reference_type,reference_id,note) VALUES(?1,?2,?3,?4,'reserved',?5,'leave_request',?6,?7)`).bind(clientId,employeeId,Number(policy.id),Number(startDate.slice(0,4)),-duration,id,`จองสิทธิ์ ${policy.name}`).run();
  return hydrateLeaveBalance(env.DB,await getLeaveRequestDetail(env.DB,id,clientId));
}

async function hydrateLeaveBalance(db,row){
  if(!row?.employee_id||!row?.client_id||!row?.policy_id)return row;
  const year=Number(String(row.start_date||dateInBangkok()).slice(0,4));
  const profile=await getEmployeeLeaveProfile(db,Number(row.employee_id),Number(row.client_id),year);
  return {...row,balance:profile.balances.find(x=>Number(x.id)===Number(row.policy_id))||null};
}

async function getLeaveRequestDetail(db,id,clientId=null){
  return db.prepare(`SELECT l.*,e.first_name,e.last_name,e.nickname,e.employee_code,e.line_user_id AS employee_line_user_id,e.line_provider_scope AS employee_line_provider_scope,lp.name AS leave_type_name,lp.code AS leave_policy_code,lp.is_unlimited,ap.first_name AS approver_first_name,ap.last_name AS approver_last_name,ap.nickname AS approver_nickname,ap.line_user_id AS approver_line_user_id,ap.line_provider_scope AS approver_line_provider_scope,(SELECT COUNT(*) FROM leave_request_evidence ev WHERE ev.leave_request_id=l.id) AS evidence_count FROM leave_requests l JOIN employees e ON e.id=l.employee_id LEFT JOIN leave_policies lp ON lp.id=l.policy_id LEFT JOIN employees ap ON ap.id=l.approver_employee_id WHERE l.id=?1 ${clientId?'AND l.client_id=?2':''}`).bind(...(clientId?[id,clientId]:[id])).first();
}

async function decideLeaveRequest(env,id,status,{actorType,actorEmployeeId=null,actorUserId=null,reason='',clientId=null,enforceApprover=false}={}){
  const row=await getLeaveRequestDetail(env.DB,id,clientId); if(!row) throw httpError('ไม่พบคำขอลา',404); if(row.status!=='pending') throw httpError('คำขอนี้ไม่ได้รออนุมัติแล้ว',409);
  if(enforceApprover){ if(Number(row.approver_employee_id)!==Number(actorEmployeeId)) throw httpError('คุณไม่ใช่ผู้อนุมัติของคำขอนี้',403); if(!await employeeHasPermission(env.DB,Number(row.client_id),Number(actorEmployeeId),'leave.approve')) throw httpError('บัญชีพนักงานนี้ไม่มีสิทธิ์อนุมัติการลา กรุณาให้ HR เพิ่มสิทธิ์ผู้อนุมัติ',403); }
  if(status==='rejected'&&String(reason).trim().length<2) throw httpError('กรุณาระบุเหตุผลที่ไม่อนุมัติ',400);
  if(status==='approved'&&Number(row.evidence_required)&&Number(row.evidence_count||0)<1) throw httpError('คำขอนี้ยังไม่มีหลักฐานตาม Policy',409);
  await env.DB.batch([
    env.DB.prepare(`UPDATE leave_requests SET status=?1,approved_at=CASE WHEN ?1='approved' THEN CURRENT_TIMESTAMP ELSE approved_at END,decision_reason=?2,decided_by_employee_id=?3,decided_by_user_id=?4,updated_at=CURRENT_TIMESTAMP WHERE id=?5`).bind(status,reason||null,actorEmployeeId,actorUserId,id),
    env.DB.prepare(`INSERT INTO leave_approval_events (client_id,leave_request_id,action,actor_type,actor_employee_id,actor_user_id,reason) VALUES (?1,?2,?3,?4,?5,?6,?7)`).bind(Number(row.client_id),id,status,actorType||'user',actorEmployeeId,actorUserId,reason||null)
  ]);
  if(status==='approved') await syncApprovedLeaveToAttendance(env.DB,row);
  if(status==='approved'){
    await env.DB.batch([
      env.DB.prepare(`INSERT OR IGNORE INTO leave_ledger(client_id,employee_id,leave_policy_id,year,entry_type,days,reference_type,reference_id,note) VALUES(?1,?2,?3,?4,'released',?5,'leave_request',?6,'ย้ายสิทธิ์จองไปเป็นวันลาที่ใช้จริง')`).bind(Number(row.client_id),Number(row.employee_id),Number(row.policy_id),Number(String(row.start_date).slice(0,4)),Number(row.duration_days||0),id),
      env.DB.prepare(`INSERT OR IGNORE INTO leave_ledger(client_id,employee_id,leave_policy_id,year,entry_type,days,reference_type,reference_id,note) VALUES(?1,?2,?3,?4,'used',?5,'leave_request',?6,'อนุมัติวันลา')`).bind(Number(row.client_id),Number(row.employee_id),Number(row.policy_id),Number(String(row.start_date).slice(0,4)),-Number(row.duration_days||0),id)
    ]);
  }else{
    await env.DB.prepare(`INSERT OR IGNORE INTO leave_ledger(client_id,employee_id,leave_policy_id,year,entry_type,days,reference_type,reference_id,note) VALUES(?1,?2,?3,?4,'released',?5,'leave_request',?6,'คืนสิทธิ์จากคำขอที่ไม่อนุมัติ')`).bind(Number(row.client_id),Number(row.employee_id),Number(row.policy_id),Number(String(row.start_date).slice(0,4)),Number(row.duration_days||0),id).run();
  }
  const updated=await getLeaveRequestDetail(env.DB,id,Number(row.client_id));
  await notifyLeaveDecision(env,updated);
  if(enforceApprover) await notifyHrLeaveDecision(env,updated,actorEmployeeId);
  await safeAudit(env.DB,Number(row.client_id),actorType||'user',String(actorEmployeeId||actorUserId||''),`leave.${status}`,'leave_request',String(id),{reason:reason||null});
  return updated;
}

async function syncApprovedLeaveToAttendance(db,row){
  const start=new Date(`${row.start_date}T12:00:00+07:00`),end=new Date(`${row.end_date}T12:00:00+07:00`);
  const employee=await getEmployeeForClient(db,Number(row.employee_id),Number(row.client_id));
  if(!employee) return;
  for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
    const date=new Date(d).toISOString().slice(0,10);
    const schedule=await resolveEffectiveWorkSchedule(db,employee,date);
    if(!schedule.is_workday) continue;
    await db.prepare(`INSERT INTO attendance (client_id,employee_id,work_date,source,status,note,scheduled_start,scheduled_end,schedule_source) VALUES (?1,?2,?3,'leave','leave',?4,?5,?6,?7)
      ON CONFLICT(employee_id,work_date) DO UPDATE SET status=CASE WHEN attendance.check_in_at IS NULL THEN 'leave' ELSE attendance.status END,note=excluded.note,scheduled_start=COALESCE(attendance.scheduled_start,excluded.scheduled_start),scheduled_end=COALESCE(attendance.scheduled_end,excluded.scheduled_end),schedule_source=COALESCE(attendance.schedule_source,excluded.schedule_source),updated_at=CURRENT_TIMESTAMP`)
      .bind(Number(row.client_id),Number(row.employee_id),date,`${row.leave_type_name||row.leave_type} #LV-${String(row.id).padStart(4,'0')}`,schedule.start_time||null,schedule.end_time||null,schedule.source||null).run();
  }
}

async function storeLineLeaveEvidence(env,{requestId,employeeId,clientId,message,accessToken}){
  const row=await env.DB.prepare("SELECT * FROM leave_requests WHERE id=?1 AND employee_id=?2 AND client_id=?3 AND status IN ('pending','awaiting_evidence')").bind(requestId,employeeId,clientId).first(); if(!row) throw httpError('ไม่พบคำขอที่รอหลักฐาน',404);
  const response=await fetch(`https://api-data.line.me/v2/bot/message/${encodeURIComponent(message.id)}/content`,{headers:{authorization:`Bearer ${accessToken}`}}); if(!response.ok) throw httpError(`LINE content ${response.status}`,502);
  const contentType=response.headers.get('content-type')|| (message.type==='image'?'image/jpeg':'application/octet-stream');
  const size=Number(response.headers.get('content-length')||message.fileSize||0); if(size>10*1024*1024) throw httpError('ไฟล์ใหญ่เกิน 10 MB',413);
  const ext=contentType.includes('png')?'png':contentType.includes('jpeg')||contentType.includes('jpg')?'jpg':contentType.includes('pdf')?'pdf':'bin';
  const fileName=message.fileName||`evidence-${Date.now()}.${ext}`;
  return await storeLeaveEvidenceBinary(env,{clientId,requestId,employeeId,bytes:await response.arrayBuffer(),fileName,contentType,fileSize:size||null,source:'line'});
}

async function createEvidenceShareUrl(env,requestId){
  const evidence=await env.DB.prepare('SELECT id FROM leave_request_evidence WHERE leave_request_id=?1 ORDER BY created_at LIMIT 1').bind(requestId).first(); if(!evidence) return null;
  const token=randomToken(32); const hash=await sha256Hex(token); const expiresAt=new Date(Date.now()+24*60*60*1000).toISOString();
  await env.DB.prepare('INSERT INTO leave_evidence_share_tokens (token_hash,evidence_id,expires_at) VALUES (?1,?2,?3)').bind(hash,Number(evidence.id),expiresAt).run();
  const base=String(env.APP_BASE_URL||'https://hr-line.organization-23c.workers.dev').replace(/\/$/,''); return `${base}/evidence/${encodeURIComponent(token)}`;
}
async function serveSharedEvidence(env,token){
  await ensureV063Ready(env.DB);
  const hash=await sha256Hex(token); const row=await env.DB.prepare(`SELECT st.expires_at,ev.* FROM leave_evidence_share_tokens st JOIN leave_request_evidence ev ON ev.id=st.evidence_id WHERE st.token_hash=?1`).bind(hash).first();
  if(!row||new Date(row.expires_at).getTime()<=Date.now()) return new Response('Link expired',{status:410});
  return await serveStoredEvidence(env,row,'private, no-store');
}

async function notifyLeaveApprover(env,requestId){
  const row=await getLeaveRequestDetail(env.DB,requestId); if(!row||row.status!=='pending') return;
  const profile=await getEmployeeLeaveProfile(env.DB,Number(row.employee_id),Number(row.client_id),Number(String(row.start_date).slice(0,4)));
  const balance=profile.balances.find(x=>Number(x.id)===Number(row.policy_id));
  let evidenceUrl=null; if(Number(row.evidence_count)>0) evidenceUrl=await createEvidenceShareUrl(env,requestId);
  if(!row.approver_employee_id||!row.approver_line_user_id){
    console.info(JSON.stringify({level:'info',event:'leave_routed_to_hr_line',request_id:requestId,client_id:row.client_id}));
    await notifyDirectHrLeaveRequest(env,{...row,balance,evidence_url:evidenceUrl});
    return;
  }
  const token=await getAccessTokenForProviderScope(env,Number(row.client_id),row.approver_line_provider_scope); if(!token)return;
  await pushLineMessages(token,row.approver_line_user_id,[buildLeaveApprovalFlex({...row,balance,evidence_url:evidenceUrl})]);
}

async function resolveLineLeaveAdmin(env,lineCtx,lineUserId,requestId){
  const row=await getLeaveRequestDetail(env.DB,Number(requestId));
  if(!row||row.status!=='pending') throw httpError('คำขอนี้ไม่ได้รออนุมัติแล้ว',409);
  // These account-level cards are only for requests routed directly to HR/Owner.
  if(row.approver_employee_id) return null;
  const providerScope=String(lineCtx?.providerScope||'default');
  const user=await findLineBusinessUser(env.DB,providerScope,lineUserId).catch(()=>null);
  if(!user?.id) return null;
  const member=await env.DB.prepare(`SELECT role FROM company_members WHERE client_id=?1 AND user_id=?2 AND status='active' LIMIT 1`)
    .bind(Number(row.client_id),Number(user.id)).first();
  if(!member||!['owner','co_owner','hr_admin','hr'].includes(String(member.role||'').toLowerCase())) return null;
  return {row,user,role:String(member.role||'')};
}

async function notifyDirectHrLeaveRequest(env,row){
  const recipients=(await env.DB.prepare(`
    SELECT DISTINCT u.id AS user_id,u.line_user_id,u.line_provider_scope,m.role
    FROM company_members m
    JOIN users u ON u.id=m.user_id AND u.status='active'
    WHERE m.client_id=?1 AND m.status='active' AND m.role IN ('owner','co_owner','hr_admin','hr')
      AND u.line_user_id IS NOT NULL
  `).bind(Number(row.client_id)).all()).results||[];
  const seen=new Set();
  for(const recipient of recipients){
    const scope=String(recipient.line_provider_scope||'default');
    const key=`${scope}:${recipient.line_user_id}`;
    // Do not send a card that lets the requester approve their own leave.
    if(recipient.line_user_id===row.employee_line_user_id && scope===String(row.employee_line_provider_scope||'default')) continue;
    if(seen.has(key)) continue;
    seen.add(key);
    const token=await getAccessTokenForProviderScope(env,Number(row.client_id),scope); if(!token) continue;
    await pushLineMessages(token,recipient.line_user_id,[buildHrLeaveApprovalFlex(row,recipient.role)]).catch(error=>{
      console.warn(JSON.stringify({level:'warn',event:'leave_hr_push_failed',request_id:Number(row.id),user_id:Number(recipient.user_id),message:String(error?.message||error)}));
    });
  }
}

async function notifyEmployeeEvidenceRequired(env,requestId){
  const row=await getLeaveRequestDetail(env.DB,requestId); if(!row?.employee_line_user_id) return;
  const scope=row.employee_line_provider_scope||'default';
  const token=await getAccessTokenForProviderScope(env,Number(row.client_id),scope); if(!token)return;
  await setLineSession(env.DB,lineSessionKey(scope,row.employee_line_user_id),'leave_evidence',{request_id:requestId,required:true});
  await pushLineMessages(token,row.employee_line_user_id,[{type:'text',text:`📎 คำขอ ${row.leave_type_name||row.leave_type} ${row.duration_days} วัน ต้องแนบหลักฐานตาม Policy\nส่งรูปหรือไฟล์ในแชตนี้ได้เลย`,quickReply:{items:[{type:'action',action:{type:'cameraRoll',label:'เลือกรูป'}},{type:'action',action:{type:'camera',label:'ถ่ายรูป'}}]}}]);
}

async function notifyLeaveDecision(env,row){
  if(!row?.employee_line_user_id) return;
  const approved=row.status==='approved';
  const token=await getAccessTokenForProviderScope(env,Number(row.client_id),row.employee_line_provider_scope); if(!token)return;
  await pushLineMessages(token,row.employee_line_user_id,[buildLeaveDecisionFlex(row,approved)]);
}

async function notifyHrLeaveDecision(env,row,actorEmployeeId){
  const [employeeHr,accountHr]=await env.DB.batch([
    env.DB.prepare(`SELECT DISTINCT e.line_user_id,e.line_provider_scope FROM employees e
      JOIN employee_permissions p ON p.employee_id=e.id AND p.client_id=e.client_id
      WHERE e.client_id=?1 AND e.status='active' AND e.line_user_id IS NOT NULL AND p.permission_key='hr_request.approve' AND e.id<>?2`).bind(Number(row.client_id),Number(actorEmployeeId||0)),
    env.DB.prepare(`SELECT DISTINCT u.line_user_id,u.line_provider_scope FROM company_members m JOIN users u ON u.id=m.user_id
      WHERE m.client_id=?1 AND m.status='active' AND m.role IN ('owner','co_owner','hr_admin','hr') AND u.status='active' AND u.line_user_id IS NOT NULL`).bind(Number(row.client_id))
  ]);
  const recipients=[...(employeeHr.results||[]),...(accountHr.results||[])];
  const seen=new Set();
  for(const hr of recipients){
    const scope=String(hr.line_provider_scope||'default');
    const key=`${scope}:${hr.line_user_id}`;
    if(seen.has(key)) continue;
    seen.add(key);
    const token=await getAccessTokenForProviderScope(env,Number(row.client_id),scope); if(!token)continue;
    await pushLineMessages(token,hr.line_user_id,[buildHrLeaveDecisionNoticeFlex(row)]).catch(()=>{});
  }
}

async function createHrCaseFromLine(env,emp,subject,detail){
  await ensureV100P2Ready(env.DB);
  const result=await env.DB.prepare(`INSERT INTO hr_cases(client_id,employee_id,subject,detail,priority,status,confidential,submitted_via) VALUES(?1,?2,?3,?4,'normal','open',1,'line')`).bind(Number(emp.client_id),Number(emp.id),subject,detail).run();
  const id=Number(result.meta.last_row_id);
  await env.DB.prepare(`INSERT INTO hr_case_events(client_id,case_id,actor_type,actor_employee_id,action,message) VALUES(?1,?2,'employee',?3,'submitted',?4)`).bind(Number(emp.client_id),id,Number(emp.id),detail).run();
  await safeAudit(env.DB,Number(emp.client_id),'employee',String(emp.id),'hr_case.create','hr_case',String(id),{subject});
  return env.DB.prepare('SELECT * FROM hr_cases WHERE id=?1').bind(id).first();
}

async function getEmployeeServiceHistory(db,emp){
  const [leaves,cases]=await db.batch([
    db.prepare(`SELECT l.id,l.start_date,l.end_date,l.duration_days,l.status,l.decision_reason,lp.name AS leave_type_name FROM leave_requests l LEFT JOIN leave_policies lp ON lp.id=l.policy_id WHERE l.employee_id=?1 ORDER BY l.created_at DESC LIMIT 5`).bind(Number(emp.id)),
    db.prepare(`SELECT id,subject,status,last_reply_to_employee,updated_at FROM hr_cases WHERE employee_id=?1 ORDER BY updated_at DESC LIMIT 5`).bind(Number(emp.id))
  ]);
  return {leaves:leaves.results||[],cases:cases.results||[]};
}

async function sendEmployeeServiceHistory(env,replyToken,emp,accessToken){
  const history=await getEmployeeServiceHistory(env.DB,emp);
  return replyLineMessages(accessToken,replyToken,[buildEmployeeServiceHistoryFlex(history)]);
}
async function sendCompanyHolidays(env,replyToken,emp,accessToken){
  const year=Number(dateInBangkok().slice(0,4));
  const rows=(await env.DB.prepare(`SELECT * FROM company_holidays WHERE client_id=?1 AND substr(holiday_date,1,4)=?2 AND holiday_date>=?3 ORDER BY holiday_date LIMIT 10`).bind(Number(emp.client_id),String(year),dateInBangkok()).all()).results||[];
  return replyLineMessages(accessToken,replyToken,[buildCompanyHolidaysFlex(rows,year)]);
}

async function broadcastRecipients(db,broadcast){
  let sql=`SELECT id,first_name,nickname,line_user_id,line_provider_scope,department_id FROM employees WHERE client_id=? AND status='active'`;
  const binds=[Number(broadcast.client_id)];
  if(broadcast.audience_type==='department'){sql+=' AND department_id=?';binds.push(Number(broadcast.audience_value));}
  if(broadcast.audience_type==='employees'){
    let ids=[];try{ids=JSON.parse(broadcast.audience_value||'[]').map(Number).filter(Boolean)}catch{}
    if(!ids.length)return[];
    sql+=` AND id IN (${ids.map(()=>'?').join(',')})`; binds.push(...ids);
  }
  const stmt=db.prepare(sql).bind(...binds); const rows=await stmt.all(); return rows.results||[];
}

async function sendBroadcastNow(env,broadcastId,clientId){
  await ensureV100P2Ready(env.DB);
  const broadcast=await env.DB.prepare('SELECT * FROM broadcasts WHERE id=?1 AND client_id=?2').bind(Number(broadcastId),Number(clientId)).first();
  if(!broadcast)throw httpError('ไม่พบประกาศ',404);
  if(broadcast.status==='sent')throw httpError('ประกาศนี้ส่งไปแล้ว',409);
  const recipients=await broadcastRecipients(env.DB,broadcast);
  await env.DB.prepare(`UPDATE broadcasts SET status='sending',total_recipients=?1,delivered_count=0,failed_count=0,updated_at=CURRENT_TIMESTAMP WHERE id=?2`).bind(recipients.length,Number(broadcast.id)).run();
  let delivered=0,failed=0,skipped=0;
  for(const emp of recipients){
    if(!emp.line_user_id){
      skipped++;await env.DB.prepare(`INSERT OR REPLACE INTO broadcast_deliveries(broadcast_id,client_id,employee_id,channel,status,error) VALUES(?1,?2,?3,'line','skipped','LINE_NOT_CONNECTED')`).bind(Number(broadcast.id),Number(clientId),Number(emp.id)).run();continue;
    }
    try{
      const token=await getAccessTokenForProviderScope(env,Number(clientId),emp.line_provider_scope); if(!token)throw new Error('LINE_TOKEN_MISSING');
      const response=await fetch('https://api.line.me/v2/bot/message/push',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({to:emp.line_user_id,messages:[buildBroadcastFlex(broadcast)]})});
      if(!response.ok)throw new Error(`LINE_${response.status}`);
      delivered++;await env.DB.prepare(`INSERT OR REPLACE INTO broadcast_deliveries(broadcast_id,client_id,employee_id,channel,status,delivered_at) VALUES(?1,?2,?3,'line','delivered',CURRENT_TIMESTAMP)`).bind(Number(broadcast.id),Number(clientId),Number(emp.id)).run();
    }catch(error){failed++;await env.DB.prepare(`INSERT OR REPLACE INTO broadcast_deliveries(broadcast_id,client_id,employee_id,channel,status,error) VALUES(?1,?2,?3,'line','failed',?4)`).bind(Number(broadcast.id),Number(clientId),Number(emp.id),String(error?.message||error).slice(0,200)).run();}
  }
  const status=failed>0||skipped>0?(delivered>0?'partial':'failed'):'sent';
  await env.DB.prepare(`UPDATE broadcasts SET status=?1,delivered_count=?2,failed_count=?3,sent_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?4`).bind(status,delivered,failed+skipped,Number(broadcast.id)).run();
  return {status,total:recipients.length,delivered,failed,skipped};
}

function richMenuDefinition(){
  return {size:{width:2500,height:1686},selected:true,name:'Nakna Employee Menu',chatBarText:'เมนูพนักงาน',areas:[
    {bounds:{x:0,y:0,width:833,height:843},action:{type:'message',text:'เช็กอิน'}},
    {bounds:{x:833,y:0,width:834,height:843},action:{type:'message',text:'เช็กเอาต์'}},
    {bounds:{x:1667,y:0,width:833,height:843},action:{type:'message',text:'ขอลา'}},
    {bounds:{x:0,y:843,width:833,height:843},action:{type:'message',text:'สิทธิ์ลา'}},
    {bounds:{x:833,y:843,width:834,height:843},action:{type:'message',text:'วันหยุด'}},
    {bounds:{x:1667,y:843,width:833,height:843},action:{type:'message',text:'แจ้ง HR'}}
  ]};
}

async function setupWorkspaceRichMenu(env,integration){
  const creds=await decryptLineIntegrationCredentials(env,integration); const token=creds.access_token;
  if(integration.rich_menu_id){try{await fetch(`https://api.line.me/v2/bot/richmenu/${encodeURIComponent(integration.rich_menu_id)}`,{method:'DELETE',headers:{authorization:`Bearer ${token}`}});}catch{}}
  const create=await fetch('https://api.line.me/v2/bot/richmenu',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(richMenuDefinition())});
  const data=await create.json().catch(()=>({})); if(!create.ok||!data.richMenuId)throw new Error(data.message||`create ${create.status}`);
  const base=String(env.APP_BASE_URL||'https://hr-line.organization-23c.workers.dev').replace(/\/$/,'');
  const image=await fetch(`${base}/richmenu-nakna.png`); if(!image.ok)throw new Error('เปิดไฟล์ภาพ Rich Menu ไม่ได้'); const bytes=await image.arrayBuffer();
  const upload=await fetch(`https://api-data.line.me/v2/bot/richmenu/${encodeURIComponent(data.richMenuId)}/content`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'image/png'},body:bytes});
  if(!upload.ok){await fetch(`https://api.line.me/v2/bot/richmenu/${encodeURIComponent(data.richMenuId)}`,{method:'DELETE',headers:{authorization:`Bearer ${token}`}});throw new Error(`upload image ${upload.status}`);}
  const setDefault=await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${encodeURIComponent(data.richMenuId)}`,{method:'POST',headers:{authorization:`Bearer ${token}`}}); if(!setDefault.ok)throw new Error(`set default ${setDefault.status}`);
  await env.DB.prepare(`UPDATE line_integrations SET rich_menu_id=?1,rich_menu_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?2`).bind(data.richMenuId,Number(integration.id)).run();
  return {rich_menu_id:data.richMenuId,configured:true};
}
async function deleteWorkspaceRichMenu(env,integration){
  const creds=await decryptLineIntegrationCredentials(env,integration); const token=creds.access_token;
  if(integration.rich_menu_id)await fetch(`https://api.line.me/v2/bot/richmenu/${encodeURIComponent(integration.rich_menu_id)}`,{method:'DELETE',headers:{authorization:`Bearer ${token}`}});
  await env.DB.prepare(`UPDATE line_integrations SET rich_menu_id=NULL,rich_menu_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?1`).bind(Number(integration.id)).run();
}

function buildHrLeaveDecisionNoticeFlex(row){
  const approved=row.status==='approved';
  return {type:'flex',altText:'HR อัปเดตผลการลา',contents:lineBubble({eyebrow:'HR UPDATE',title:approved?'หัวหน้าอนุมัติวันลาแล้ว':'หัวหน้าปฏิเสธวันลา',body:[lineInfoCard([lineInfoRow('พนักงาน',row.nickname||row.first_name),lineInfoRow('ประเภท',row.leave_type_name||row.leave_type),lineInfoRow('ช่วง',formatLeaveRange(row)),lineInfoRow('ผล',approved?'อนุมัติ':'ไม่อนุมัติ')]),...(row.decision_reason?[lineText(`เหตุผล: ${row.decision_reason}`,'xs',LINE_CI.muted)]:[])],
  })};
}
function buildHrCaseSubmittedFlex(row){
  return {type:'flex',altText:'ส่งเรื่องให้ HR แล้ว',contents:lineBubble({eyebrow:'PRIVATE HR',title:'ส่งเรื่องให้ HR แล้ว',body:[lineChip('เฉพาะ HR เห็นเรื่องนี้','teal'),lineText(`#HR-${String(row.id).padStart(4,'0')} · ${row.subject}`,'md',LINE_CI.primaryDark,'bold'),lineText('HR จะเห็นเรื่องนี้ในกล่องงานส่วนตัว และสามารถตอบกลับคุณผ่าน LINE ได้','xs',LINE_CI.muted)]})};
}
function buildHrCaseReplyFlex(row){
  return {type:'flex',altText:'HR ตอบกลับเรื่องของคุณ',contents:lineBubble({eyebrow:'HR REPLY',title:'HR ตอบกลับเรื่องของคุณ',body:[lineText(`#HR-${String(row.id).padStart(4,'0')} · ${row.subject}`,'sm',LINE_CI.primaryDark,'bold'),lineInfoCard([lineText(row.message,'sm',LINE_CI.text,'regular')]),lineText('พิมพ์ “คำขอของฉัน” เพื่อเช็กสถานะล่าสุด','xxs',LINE_CI.muted)]})};
}
function buildBroadcastFlex(row){
  return {type:'flex',altText:`ประกาศ: ${String(row.title||'อัปเดตจากบริษัท').slice(0,80)}`,contents:lineBubble({eyebrow:'COMPANY UPDATE',title:row.title,body:[lineText(row.message,'sm',LINE_CI.text,'regular'),lineText('ประกาศจาก HR · Nakna','xxs',LINE_CI.muted)]})};
}
function leaveStatusLabel(status){return ({pending:'รออนุมัติ',awaiting_evidence:'รอหลักฐาน',approved:'อนุมัติแล้ว',rejected:'ไม่อนุมัติ',cancelled:'ยกเลิก'})[status]||status;}
function caseStatusLabel(status){return ({open:'HR รับเรื่องแล้ว',in_progress:'กำลังดำเนินการ',waiting_employee:'HR ตอบแล้ว',resolved:'แก้ไขแล้ว',closed:'ปิดเรื่อง'})[status]||status;}
function buildEmployeeServiceHistoryFlex(history){
  const contents=[];
  if(history.leaves.length){contents.push(lineText('คำขอลาล่าสุด','xs',LINE_CI.primaryDark,'bold'));for(const r of history.leaves.slice(0,4))contents.push(lineInfoCard([lineInfoRow(r.leave_type_name||'ลา',`${formatThaiDateOnly(r.start_date)} · ${Number(r.duration_days||0)} วัน`),lineInfoRow('สถานะ',leaveStatusLabel(r.status))]));}
  if(history.cases.length){contents.push(lineText('เรื่องที่แจ้ง HR','xs',LINE_CI.primaryDark,'bold',{margin:'md'}));for(const c of history.cases.slice(0,3))contents.push(lineInfoCard([lineInfoRow(`#HR-${String(c.id).padStart(4,'0')}`,c.subject),lineInfoRow('สถานะ',caseStatusLabel(c.status))]));}
  if(!contents.length)contents.push(lineText('ยังไม่มีคำขอหรือเรื่องที่แจ้ง HR','sm',LINE_CI.muted));
  return {type:'flex',altText:'คำขอของฉัน',contents:lineBubble({eyebrow:'MY REQUESTS',title:'คำขอของฉัน',body:contents})};
}
function buildCompanyHolidaysFlex(rows,year){
  const body=[lineText(`วันหยุดบริษัท ${year+543}`,'xs',LINE_CI.muted)];
  if(rows.length){for(const h of rows)body.push(lineInfoCard([lineInfoRow(formatThaiDateOnly(h.holiday_date),h.name),lineText(Number(h.is_paid)?'วันหยุดได้รับค่าจ้าง':'วันหยุดบริษัท','xxs',LINE_CI.muted)]));}
  else body.push(lineText('ยังไม่มีวันหยุดที่กำลังจะมาถึงในปีนี้','sm',LINE_CI.muted));
  return {type:'flex',altText:'วันหยุดของบริษัท',contents:lineBubble({eyebrow:'HOLIDAYS',title:'วันหยุดของบริษัท',body})};
}

const LINE_CI = {
  bg: '#F8FAF8',
  card: '#FFFFFF',
  primary: '#167D7F',
  primaryDark: '#123C4A',
  mint: '#8FD6C8',
  mintSoft: '#EFF8F5',
  coral: '#FF8A65',
  coralSoft: '#FFF2EE',
  text: '#202B2D',
  muted: '#6B787A',
  border: '#E4EAE7',
  success: '#2E9B68',
  successSoft: '#ECF8F1',
  warning: '#E6A23C',
  warningSoft: '#FFF7E8',
  error: '#D9534F',
  errorSoft: '#FDECEC',
  info: '#3B82F6',
  infoSoft: '#EFF6FF',
};

function lineText(text,size='sm',color=LINE_CI.text,weight='regular',extra={}){
  return { type:'text', text:String(text), size, color, weight, wrap:true, scaling:true, ...extra };
}
function lineTone(tone='neutral'){
  const map={
    success:{bg:LINE_CI.successSoft,fg:LINE_CI.success},
    warning:{bg:LINE_CI.warningSoft,fg:'#9A6700'},
    error:{bg:LINE_CI.errorSoft,fg:LINE_CI.error},
    info:{bg:LINE_CI.infoSoft,fg:LINE_CI.info},
    coral:{bg:LINE_CI.coralSoft,fg:'#C75B3C'},
    teal:{bg:LINE_CI.mintSoft,fg:LINE_CI.primary},
    neutral:{bg:'#F3F6F4',fg:LINE_CI.muted},
  };
  return map[tone]||map.neutral;
}
function lineChip(text,tone='teal'){
  const c=lineTone(tone);
  return {type:'box',layout:'vertical',paddingTop:'4px',paddingBottom:'4px',paddingStart:'9px',paddingEnd:'9px',cornerRadius:'10px',backgroundColor:c.bg,flex:0,contents:[lineText(text,'xxs',c.fg,'bold',{align:'center'})]};
}
function lineBrandHeader(eyebrow,title,subtitle=''){
  const contents=[
    {type:'box',layout:'horizontal',alignItems:'center',contents:[
      {type:'box',layout:'vertical',width:'8px',height:'8px',cornerRadius:'4px',backgroundColor:LINE_CI.mint,contents:[]},
      lineText(eyebrow||'นากนะ','xxs',LINE_CI.primary,'bold',{margin:'sm',flex:1}),
    ]},
    lineText(title,'xl',LINE_CI.primaryDark,'bold',{margin:'sm'}),
  ];
  if(subtitle) contents.push(lineText(subtitle,'xs',LINE_CI.muted,'regular',{margin:'xs'}));
  return {type:'box',layout:'vertical',paddingAll:'18px',backgroundColor:LINE_CI.bg,contents};
}
function lineInfoCard(contents,tone='neutral'){
  const c=lineTone(tone);
  return {type:'box',layout:'vertical',spacing:'sm',paddingAll:'12px',cornerRadius:'14px',backgroundColor:c.bg,borderWidth:'1px',borderColor:tone==='neutral'?LINE_CI.border:c.bg,contents};
}
function lineInfoRow(label,value,valueColor=LINE_CI.text){
  return {type:'box',layout:'horizontal',spacing:'md',alignItems:'flex-start',contents:[
    lineText(label,'xs',LINE_CI.muted,'regular',{flex:2}),
    lineText(value,'xs',valueColor,'bold',{flex:3,align:'end'}),
  ]};
}
function lineActionWithTapFeedback(label, action) {
  // Keep chat clean: do not echo a visible "กดแล้ว รอ 3 วินาที" message.
  // Postback actions still get LINE's native loading animation in processLineEvent().
  return action;
}
function linePrimaryButton(label,action){return {type:'button',style:'primary',height:'sm',color:LINE_CI.primary,action:lineActionWithTapFeedback(label,action)};}
function lineSecondaryButton(label,action,color=LINE_CI.mintSoft){return {type:'button',style:'secondary',height:'sm',color,action:lineActionWithTapFeedback(label,action)};}
function lineDangerButton(label,action){return {type:'button',style:'secondary',height:'sm',color:LINE_CI.errorSoft,action:lineActionWithTapFeedback(label,action)};}
function lineBubble({eyebrow='นากนะ',title,subtitle='',body=[],footer=[],status=null,statusTone='teal',size='mega'}){
  const bodyContents=[];
  if(status) bodyContents.push({type:'box',layout:'horizontal',contents:[lineChip(status,statusTone)]});
  bodyContents.push(...body);
  const bubble={
    type:'bubble',size,
    header:lineBrandHeader(eyebrow,title,subtitle),
    body:{type:'box',layout:'vertical',spacing:'md',paddingAll:'18px',backgroundColor:LINE_CI.card,contents:bodyContents},
    styles:{header:{backgroundColor:LINE_CI.bg},body:{backgroundColor:LINE_CI.card},footer:{backgroundColor:LINE_CI.card,separator:true}},
  };
  if(footer.length) bubble.footer={type:'box',layout:'vertical',spacing:'sm',paddingAll:'14px',contents:footer};
  return bubble;
}
function leavePolicyIcon(policy){
  const code=String(policy?.code||'').toLowerCase(); const name=String(policy?.name||'');
  if(code.includes('sick')||name.includes('ป่วย')) return '🤒';
  if(code.includes('annual')||name.includes('พักร้อน')) return '🏖';
  if(code.includes('personal')||name.includes('กิจ')) return '👤';
  if(code.includes('unpaid')||name.includes('ไม่รับ')) return '📄';
  return '🗓';
}
function formatLeaveRange(row){return `${formatThaiDateOnly(row.start_date)}${row.start_date!==row.end_date?` – ${formatThaiDateOnly(row.end_date)}`:''}`;}
function formatDayPart(part){return part==='am'?'ครึ่งวันเช้า':part==='pm'?'ครึ่งวันบ่าย':'เต็มวัน';}

function buildWelcomeFlex(name,company){
  return {type:'flex',altText:`ยินดีต้อนรับสู่ ${company}`,contents:lineBubble({
    eyebrow:'NAKNA · HR TECH',title:`ยินดีต้อนรับ ${name} 👋`,subtitle:'เชื่อม LINE กับบัญชีพนักงานเรียบร้อยแล้ว',status:'พร้อมใช้งาน',statusTone:'success',
    body:[lineInfoCard([lineInfoRow('บริษัท',company),lineInfoRow('ช่องทาง','LINE · เชื่อมแล้ว',LINE_CI.success)],'teal')],
    footer:[linePrimaryButton('เปิดเมนูพนักงาน',{type:'postback',label:'เปิดเมนูพนักงาน',data:'action=menu'})]
  })};
}
function buildEmployeeMenuFlex(emp,ownerAccess=null,leaveFormUrl=null,hrCaseFormUrl=null){
  const name=emp.nickname||emp.first_name;
  const hasManagement=Boolean(ownerAccess?.dashboardUrl&&ownerAccess?.primary);
  const managementCompany=ownerAccess?.primary?.name||emp.company_name||'';
  const roleLabel=ownerAccess?.roleLabel||lineManagementRoleLabel(ownerAccess?.role);
  const footer=hasManagement?[
    lineText('สำหรับผู้บริหาร / HR','xs',LINE_CI.primaryDark,'bold'),
    lineText(`${roleLabel} · ${managementCompany||'ธุรกิจของคุณ'}`,'xxs',LINE_CI.muted,'regular'),
    linePrimaryButton('เปิด HR Dashboard',{type:'uri',label:'เปิด HR Dashboard',uri:ownerAccess.dashboardUrl})
  ]:[];
  return {type:'flex',altText:hasManagement?`เมนูพนักงาน + ${roleLabel} · นากนะ`:'เมนูพนักงาน · นากนะ',contents:lineBubble({
    eyebrow:hasManagement?`นากนะ · EMPLOYEE + ${String(roleLabel).toUpperCase()}`:'นากนะ · EMPLOYEE',title:`สวัสดี ${name} 👋`,subtitle:emp.company_name||'',
    body:[
      lineText('เมนูพนักงาน','xs',LINE_CI.primaryDark,'bold'),
      lineText('จัดการเรื่องงานประจำวันได้จากตรงนี้','sm',LINE_CI.muted),
      linePrimaryButton('📍  เช็กอิน',{type:'postback',label:'เช็กอิน',data:'action=checkin'}),
      lineSecondaryButton('🏠  เช็กเอาต์',{type:'postback',label:'เช็กเอาต์',data:'action=checkout'}),
      lineSecondaryButton('🏖  ขอลางาน',leaveFormUrl?{type:'uri',label:'ขอลางาน',uri:leaveFormUrl}:{type:'postback',label:'ขอลางาน',data:'action=leave_menu'},'#F1F7F5'),
      lineSecondaryButton('📅  สิทธิ์ลา',{type:'postback',label:'สิทธิ์ลา',data:'action=leave_balance'},'#F7F9F8'),
      lineSecondaryButton('🎉  วันหยุดบริษัท',{type:'postback',label:'วันหยุดบริษัท',data:'action=holidays'},'#F7F9F8'),
      lineSecondaryButton('🗂  คำขอของฉัน',{type:'postback',label:'คำขอของฉัน',data:'action=my_requests'},'#F7F9F8'),
      lineSecondaryButton('🎓  Learning & KPI',{type:'postback',label:'Learning & KPI',data:'action=learning'},LINE_CI.mintSoft),
      lineSecondaryButton('🎁  แต้ม & ของรางวัล',{type:'postback',label:'แต้ม & ของรางวัล',data:'action=rewards'},'#FFF7E8'),
      lineSecondaryButton('🔒  แจ้งเรื่องส่วนตัวถึง HR',hrCaseFormUrl?{type:'uri',label:'แจ้ง HR',uri:hrCaseFormUrl}:{type:'postback',label:'แจ้ง HR',data:'action=hr_case'},LINE_CI.coralSoft),
    ],
    footer
  })};
}

function buildOwnerDashboardFlex(ownerAccess){
  const primary=ownerAccess?.primary||{};
  const count=Array.isArray(ownerAccess?.businesses)?ownerAccess.businesses.length:1;
  const roleLabel=ownerAccess?.roleLabel||lineManagementRoleLabel(ownerAccess?.role);
  return {type:'flex',altText:`${roleLabel} Dashboard · นากนะ`,contents:lineBubble({
    eyebrow:`นากนะ · ${String(roleLabel).toUpperCase()}`,title:'HR Dashboard',subtitle:primary.name||'ธุรกิจของคุณ',status:roleLabel,statusTone:'success',
    body:[
      lineInfoCard([
        lineInfoRow('ธุรกิจ',primary.name||'—'),
        lineInfoRow('สิทธิ์',roleLabel,LINE_CI.primary),
        ...(count>1?[lineInfoRow('ธุรกิจที่ดูแล',`${count} ธุรกิจ`)]:[])
      ],'teal'),
      lineText('เปิด Dashboard เพื่อจัดการพนักงาน เวลา การลา เอกสาร Payroll และการตั้งค่าตามสิทธิ์ของคุณ','xs',LINE_CI.muted)
    ],
    footer:[linePrimaryButton('เปิด HR Dashboard',{type:'uri',label:'เปิด HR Dashboard',uri:ownerAccess.dashboardUrl})]
  })};
}

function buildCompanyAccessGrantedFlex({companyName,role,dashboardUrl}){
  const value=String(role||'').toLowerCase();
  const roleLabel=workspaceRoleLabel(value);
  const detail={
    co_owner:'ดูแล Workspace ได้เกือบทั้งหมด แต่การลบบริษัท เปลี่ยนแพ็กเกจ และโอนเจ้าของหลักยังเป็นสิทธิ์ของ Primary Owner',
    hr_admin:'จัดการพนักงาน เวลา การลา Recruitment เอกสาร Learning และงาน HR ได้ โดยไม่แตะ Billing หรือการลบบริษัท',
    payroll_admin:'เข้าถึง Payroll ภาษี ประกันสังคม Payslip และเอกสารเงินเดือน โดยไม่เห็นการตั้งค่าบริษัทส่วนที่ไม่เกี่ยวข้อง',
    manager:'ดูแลทีม งาน KPI เวลา และคำขอของทีมตามขอบเขตที่ได้รับ',
    approver:'รับและอนุมัติคำขอที่ได้รับมอบหมาย เช่น การลา โดยไม่สามารถแก้การตั้งค่าบริษัท',
  }[value]||'คุณได้รับสิทธิ์เข้าจัดการ Workspace นี้ตามบทบาทที่กำหนด';
  return {type:'flex',altText:`คุณได้รับสิทธิ์ ${roleLabel} · ${companyName}`,contents:lineBubble({
    eyebrow:'WORKSPACE ACCESS',
    title:'ได้รับสิทธิ์เข้าบริษัทแล้ว 🎉',
    subtitle:companyName||'บริษัทของคุณ',
    status:roleLabel,
    statusTone:'success',
    body:[
      lineInfoCard([
        lineInfoRow('บริษัท',companyName||'—'),
        lineInfoRow('บทบาท',roleLabel,LINE_CI.primary)
      ],'teal'),
      lineText(detail,'xs',LINE_CI.muted),
      lineText('นี่คือการเข้าร่วม Workspace เดิมของบริษัท ไม่ต้องสร้างธุรกิจใหม่หรือตั้งค่าบริษัทใหม่','xxs',LINE_CI.primaryDark,'bold')
    ],
    footer:[linePrimaryButton('เข้า Workspace นี้',{type:'uri',label:'เข้า Workspace นี้',uri:dashboardUrl})]
  })};
}

function buildHrLeaveApprovalFlex(row,role='hr_admin'){
  const remaining=row.balance?.remaining_days;
  const body=[lineInfoCard([
    lineInfoRow('พนักงาน',row.nickname||row.first_name||'—'),
    lineInfoRow('ประเภท',row.leave_type_name||row.leave_type||'—'),
    lineInfoRow('ช่วง',formatLeaveRange(row)),
    lineInfoRow('จำนวน',`${Number(row.duration_days||0)} วัน`),
    ...(remaining==null?[]:[lineInfoRow('สิทธิ์คงเหลือหลังจอง',`${Number(remaining)} วัน`)]),
    lineInfoRow('ส่งถึง','HR / Owner',LINE_CI.primary)
  ],'teal')];
  if(row.reason) body.push(lineText(`เหตุผล: ${row.reason}`,'xs',LINE_CI.text));
  if(row.evidence_url) body.push(lineSecondaryButton('ดูหลักฐาน',{type:'uri',label:'ดูหลักฐาน',uri:row.evidence_url},LINE_CI.mintSoft));
  body.push(lineText('ไม่มีผู้อนุมัติรายบุคคล คำขอนี้จึงส่งตรงถึง Owner / HR Admin','xxs',LINE_CI.muted));
  return {type:'flex',altText:`คำขอลาใหม่จาก ${row.nickname||row.first_name}`,contents:lineBubble({
    eyebrow:`คำขอ #LV-${String(row.id).padStart(4,'0')}`,
    title:'มีคำขอลารอ HR อนุมัติ',
    subtitle:`${row.nickname||row.first_name} · ${row.leave_type_name||row.leave_type}`,
    status:String(role||'').toLowerCase()==='owner'?'Owner':'HR Admin',
    statusTone:'warning',
    body,
    footer:[
      linePrimaryButton('อนุมัติ',{type:'postback',label:'อนุมัติ',data:`action=leave_hr_approve&id=${row.id}`}),
      lineDangerButton('ไม่อนุมัติ',{type:'postback',label:'ไม่อนุมัติ',data:`action=leave_hr_reject&id=${row.id}`})
    ]
  })};
}

async function notifyCompanyAccessGranted(env,{clientId,targetUser,employee,role}){
  const lineUserId=employee?.line_user_id||targetUser?.line_user_id;
  if(!lineUserId) return false;
  const scope=String(employee?.line_provider_scope||targetUser?.line_provider_scope||'default');
  const token=await getAccessTokenForProviderScope(env,Number(clientId),scope); if(!token) return false;
  const company=await env.DB.prepare('SELECT name FROM clients WHERE id=?1').bind(Number(clientId)).first();
  const dashboardUrl=await issueLineWebLoginLink(env,Number(targetUser.id),{clientId:Number(clientId),purpose:'workspace_access'});
  await pushLineMessages(token,lineUserId,[buildCompanyAccessGrantedFlex({companyName:company?.name||'บริษัทของคุณ',role,dashboardUrl})]);
  return true;
}
function buildEmployeeStatusFlex(emp,a){
  const hasIn=Boolean(a?.check_in_at), hasOut=Boolean(a?.check_out_at), isLeave=a?.status==='leave';
  const status=isLeave?'วันนี้ลา':hasIn?(a?.status==='late'?'มาสาย':'มาทำงานแล้ว'):'ยังไม่เช็กอิน';
  const tone=isLeave?'info':hasIn?(a?.status==='late'?'warning':'success'):'warning';
  const rows=[];
  if(isLeave){ rows.push(lineInfoRow('สถานะ','ลางาน',LINE_CI.info)); }
  else {
    rows.push(lineInfoRow('เช็กอิน',hasIn?formatBangkokTime(a.check_in_at):'—',hasIn?LINE_CI.success:LINE_CI.muted));
    rows.push(lineInfoRow('เช็กเอาต์',hasOut?formatBangkokTime(a.check_out_at):'—'));
    if(Number(a?.late_minutes||0)>0) rows.push(lineInfoRow('มาสาย',`${a.late_minutes} นาที`,LINE_CI.warning));
  }
  return {type:'flex',altText:'สถานะวันนี้',contents:lineBubble({eyebrow:'ATTENDANCE',title:'สถานะวันนี้',subtitle:emp.nickname||emp.first_name,status,statusTone:tone,body:[lineInfoCard(rows,tone)]})};
}
async function sendHrCaseForm(env,replyToken,emp,accessToken){
  const token=await issueEmployeePortalToken(env.DB,Number(emp.client_id),Number(emp.id));
  const base=String(env.APP_BASE_URL||'https://hr-line.organization-23c.workers.dev').replace(/\/$/,'');
  const url=`${base}/hr-case.html?token=${encodeURIComponent(token)}`;
  return replyLineMessages(accessToken,replyToken,[{type:'flex',altText:'เปิดแบบฟอร์มแจ้ง HR',contents:lineBubble({
    eyebrow:'PRIVATE HR',title:'แจ้งเรื่องส่วนตัวถึง HR',subtitle:'กรอกในหน้าเดียว · เห็นเฉพาะ Owner / HR',
    body:[lineInfoCard([
      lineText('เลือกหมวด ใส่หัวข้อ รายละเอียด และแนบหลักฐานได้ในหน้าเดียว','sm',LINE_CI.text,'bold'),
      lineText('ส่งเสร็จแล้วนากนะจะแจ้งเลขเรื่องกลับมาใน LINE อัตโนมัติ','xxs',LINE_CI.muted)
    ],'teal')],
    footer:[linePrimaryButton('เปิดแบบฟอร์มแจ้ง HR',{type:'uri',label:'เปิดแบบฟอร์มแจ้ง HR',uri:url})]
  })}]);
}

async function sendLeaveTypeMenu(env,replyToken,emp,accessToken){
  const token=await issueEmployeePortalToken(env.DB,Number(emp.client_id),Number(emp.id));
  const base=String(env.APP_BASE_URL||'https://hr-line.organization-23c.workers.dev').replace(/\/$/,'');
  const url=`${base}/leave.html?token=${encodeURIComponent(token)}`;
  return replyLineMessages(accessToken,replyToken,[{type:'flex',altText:'เปิดแบบฟอร์มขอลางาน',contents:lineBubble({
    eyebrow:'LEAVE',title:'ขอลางาน',subtitle:'กรอกครั้งเดียวในหน้าเว็บ · แนบรูปหรือไฟล์ได้',
    body:[lineInfoCard([
      lineText('เลือกประเภทลา วันที่ เหตุผล และแนบหลักฐานในหน้าเดียว','sm',LINE_CI.text,'bold'),
      lineText('ส่งเสร็จแล้วนากนะจะแจ้งยืนยันกลับมาใน LINE อัตโนมัติ','xxs',LINE_CI.muted)
    ],'teal')],
    footer:[linePrimaryButton('เปิดแบบฟอร์มลางาน',{type:'uri',label:'เปิดแบบฟอร์มลางาน',uri:url})]
  })}]);
}
async function sendLeaveBalance(env,replyToken,emp,accessToken){
  const year=Number(dateInBangkok().slice(0,4));
  const profile=await getEmployeeLeaveProfile(env.DB,Number(emp.id),Number(emp.client_id),year);
  const rows=(profile.balances||[]).map(b=>{
    const remaining=Number(b.is_unlimited)?'ไม่จำกัด':`${Number(b.remaining_days).toFixed(Number(b.remaining_days)%1?1:0)} วัน`;
    const locked=b.available_now===false; const tone=locked?'warning':(!Number(b.is_unlimited)&&Number(b.remaining_days)<2?'error':'teal');
    return lineInfoCard([
      {type:'box',layout:'horizontal',alignItems:'center',contents:[lineText(`${leavePolicyIcon(b)} ${b.name}`,'sm',LINE_CI.primaryDark,'bold',{flex:1}),lineChip(locked?'🔒 รอผ่านโปร':remaining,tone)]},
      !Number(b.is_unlimited)?lineText(`ใช้แล้ว ${Number(b.used_days||0).toFixed(1).replace('.0','')} · รออนุมัติ ${Number(b.pending_days||0).toFixed(1).replace('.0','')} วัน`,'xxs',LINE_CI.muted):lineText('สิทธิ์ไม่จำกัดตามนโยบายบริษัท','xxs',LINE_CI.muted)
    ],'neutral');
  });
  if(!rows.length) return replyLineMessages(accessToken,replyToken,[buildSimpleNoticeFlex('ยังไม่มีสิทธิ์ลาที่เปิดใช้งาน','HR สามารถตั้งประเภทลาและสิทธิ์รายคนจากหน้า พนักงาน → สิทธิ์ลา','warning')]);
  const subtitle=[emp.nickname||emp.first_name,emp.company_name].filter(Boolean).join(' · ');
  return replyLineMessages(accessToken,replyToken,[{type:'flex',altText:'สิทธิ์ลาคงเหลือ',contents:lineBubble({eyebrow:'LEAVE BALANCE',title:`สิทธิ์ลา ${profile.year}`,subtitle,body:rows})}]);
}
function buildDatePickerFlex(title,action,policyId,start=null){
  const data=`action=${action}&policy_id=${policyId}${start?`&start=${start}`:''}`;
  return {type:'flex',altText:title,contents:lineBubble({eyebrow:'LEAVE · STEP',title,subtitle:'เลือกวันที่จากปฏิทิน',body:[lineInfoCard([lineText(start?`วันเริ่มลา ${formatThaiDateOnly(start)}`:'เลือกวันที่ที่ต้องการเริ่มลา','sm',LINE_CI.text,'bold')],'teal')],footer:[linePrimaryButton('เลือกวันที่',{type:'datetimepicker',label:'เลือกวันที่',data,mode:'date'})]})};
}
function buildLeaveDayPartFlex(policyId,startDate,endDate){
  const make=(label,part,primary=false)=>primary?linePrimaryButton(label,{type:'postback',label,data:`action=leave_daypart&policy_id=${policyId}&start=${startDate}&end=${endDate}&part=${part}`}):lineSecondaryButton(label,{type:'postback',label,data:`action=leave_daypart&policy_id=${policyId}&start=${startDate}&end=${endDate}&part=${part}`});
  return {type:'flex',altText:'เลือกรูปแบบวันลา',contents:lineBubble({eyebrow:'LEAVE · STEP',title:'เลือกรูปแบบวันลา',subtitle:formatThaiDateOnly(startDate),body:[make('เต็มวัน','full',true),make('ครึ่งวันเช้า','am'),make('ครึ่งวันบ่าย','pm')]})};
}
function buildLeaveReasonPromptFlex(startDate,endDate,dayPart='full'){
  const range=startDate===endDate?`${formatThaiDateOnly(startDate)} · ${formatDayPart(dayPart)}`:`${formatThaiDateOnly(startDate)} – ${formatThaiDateOnly(endDate)}`;
  return {type:'flex',altText:'ระบุเหตุผลการลา',contents:lineBubble({eyebrow:'LEAVE · STEP',title:'ระบุเหตุผลการลา',subtitle:'พิมพ์เหตุผลส่งเป็นข้อความถัดไป',body:[lineInfoCard([lineInfoRow('วันที่',range),lineText('ตัวอย่าง: มีธุระครอบครัว / มีไข้และไปพบแพทย์','xs',LINE_CI.muted)],'teal')]})};
}
function buildLeaveSubmittedFlex(row){
  const pending=row.status==='pending'; const awaiting=row.status==='awaiting_evidence';
  const tone=pending?'warning':awaiting?'coral':'success'; const status=pending?'รออนุมัติ':awaiting?'รอหลักฐาน':'ส่งแล้ว';
  const body=[lineInfoCard([
    lineInfoRow('ประเภท',row.leave_type_name||row.leave_type,LINE_CI.primaryDark),
    lineInfoRow('วันที่',formatLeaveRange(row)),
    lineInfoRow('จำนวน',`${Number(row.duration_days||0).toFixed(Number(row.duration_days||0)%1?1:0)} วัน`),
    row.balance?lineInfoRow('สิทธิ์คงเหลือ',row.balance.is_unlimited?'ไม่จำกัด':`${Number(row.balance.remaining_days||0).toFixed(Number(row.balance.remaining_days||0)%1?1:0)} วัน`,LINE_CI.primary):null,
    row.reason?{type:'separator',color:LINE_CI.border}:null,
    row.reason?lineText('เหตุผล','xxs',LINE_CI.muted,'bold'):null,
    row.reason?lineText(row.reason,'sm',LINE_CI.text):null,
  ].filter(Boolean),'neutral')];
  const footer=[];
  if(awaiting||Number(row.evidence_required)) footer.push(lineSecondaryButton('📎  แนบหลักฐาน',{type:'postback',label:'แนบหลักฐาน',data:`action=leave_attach&id=${row.id}`},LINE_CI.coralSoft));
  footer.push(lineSecondaryButton('ดูสิทธิ์ลา',{type:'postback',label:'ดูสิทธิ์ลา',data:'action=leave_balance'},LINE_CI.mintSoft));
  return {type:'flex',altText:`ส่งคำขอ${row.leave_type_name||row.leave_type}แล้ว`,contents:lineBubble({eyebrow:`คำขอ #LV-${String(row.id).padStart(4,'0')}`,title:'ส่งคำขอเรียบร้อยแล้ว',subtitle:'นากนะส่งต่อให้ผู้เกี่ยวข้องแล้ว',status,statusTone:tone,body,footer})};
}
function buildLeaveApprovalFlex(row){
  const before=row.balance?.is_unlimited?'ไม่จำกัด':row.balance?`${Number(row.balance.remaining_days||0)+Number(row.duration_days||0)} วัน`:'—';
  const after=row.balance?.is_unlimited?'ไม่จำกัด':row.balance?`${Number(row.balance.remaining_days||0)} วัน`:'—';
  const evidenceCount=Number(row.evidence_count||0);
  const body=[
    lineInfoCard([
      lineInfoRow('พนักงาน',`${row.nickname||row.first_name} ${row.last_name||''}`.trim(),LINE_CI.primaryDark),
      lineInfoRow('ประเภท',row.leave_type_name||row.leave_type),
      lineInfoRow('วันที่',formatLeaveRange(row)),
      lineInfoRow('จำนวน',`${Number(row.duration_days||0).toFixed(Number(row.duration_days||0)%1?1:0)} วัน`),
    ],'neutral'),
    lineInfoCard([lineText('เหตุผล','xxs',LINE_CI.muted,'bold'),lineText(row.reason||'—','sm',LINE_CI.text)],'teal'),
    {type:'box',layout:'horizontal',spacing:'sm',contents:[
      {type:'box',layout:'vertical',flex:1,paddingAll:'10px',cornerRadius:'12px',backgroundColor:LINE_CI.bg,contents:[lineText('ก่อนลา','xxs',LINE_CI.muted,'bold'),lineText(before,'sm',LINE_CI.primaryDark,'bold',{margin:'xs'})]},
      {type:'box',layout:'vertical',flex:1,paddingAll:'10px',cornerRadius:'12px',backgroundColor:LINE_CI.mintSoft,contents:[lineText('หลังอนุมัติ','xxs',LINE_CI.muted,'bold'),lineText(after,'sm',LINE_CI.primary,'bold',{margin:'xs'})]},
    ]},
    {type:'box',layout:'horizontal',alignItems:'center',contents:[lineText('หลักฐาน','xs',LINE_CI.muted,'bold',{flex:1}),lineChip(`${evidenceCount} ไฟล์`,Number(row.evidence_required)&&!evidenceCount?'error':evidenceCount?'success':'neutral')]}
  ];
  if(row.evidence_url) body.push(lineSecondaryButton('ดูหลักฐาน',{type:'uri',label:'ดูหลักฐาน',uri:row.evidence_url},LINE_CI.mintSoft));
  return {type:'flex',altText:`คำขอลาใหม่จาก ${row.nickname||row.first_name}`,contents:lineBubble({eyebrow:`คำขอ #LV-${String(row.id).padStart(4,'0')}`,title:'มีคำขอลารออนุมัติ',subtitle:`${row.nickname||row.first_name} · ${row.leave_type_name||row.leave_type}`,status:'รอคุณพิจารณา',statusTone:'warning',body,footer:[linePrimaryButton('อนุมัติ',{type:'postback',label:'อนุมัติ',data:`action=leave_approve&id=${row.id}`}),lineDangerButton('ไม่อนุมัติ',{type:'postback',label:'ไม่อนุมัติ',data:`action=leave_reject&id=${row.id}`})]})};
}
function buildLeaveDecisionFlex(row,approved){
  const body=[lineInfoCard([
    lineInfoRow('ประเภท',row.leave_type_name||row.leave_type),
    lineInfoRow('วันที่',formatLeaveRange(row)),
    lineInfoRow('จำนวน',`${Number(row.duration_days||0).toFixed(Number(row.duration_days||0)%1?1:0)} วัน`),
  ],'neutral')];
  if(!approved) body.push(lineInfoCard([lineText('เหตุผลที่ไม่อนุมัติ','xxs',LINE_CI.muted,'bold'),lineText(row.decision_reason||'ไม่ระบุ','sm',LINE_CI.text)],'error'));
  else body.push(lineText('ระบบอัปเดตสิทธิ์ลาและ Attendance ให้เรียบร้อยแล้ว','xs',LINE_CI.muted));
  return {type:'flex',altText:approved?'คำขอลาได้รับอนุมัติ':'คำขอลาไม่ผ่านการอนุมัติ',contents:lineBubble({eyebrow:'LEAVE UPDATE',title:approved?'อนุมัติคำขอแล้ว':'คำขอไม่ผ่านการอนุมัติ',subtitle:`#LV-${String(row.id).padStart(4,'0')}`,status:approved?'อนุมัติแล้ว':'ไม่อนุมัติ',statusTone:approved?'success':'error',body,footer:[lineSecondaryButton('กลับเมนู',{type:'postback',label:'กลับเมนู',data:'action=menu'},LINE_CI.mintSoft)]})};
}
function buildAttendanceResultFlex(kind,result){
  const checkin=kind==='checkin'; const late=checkin&&Number(result.late_minutes||0)>0;
  const tone=late?'warning':'success'; const status=checkin?(late?`สาย ${result.late_minutes} นาที`:'ตรงเวลา'):'บันทึกเวลาแล้ว';
  const tm=checkin?result.check_in_at:result.check_out_at;
  const rows=[lineInfoRow('เวลา',formatBangkokTime(tm),LINE_CI.primaryDark)];
  if(result.location_name) rows.push(lineInfoRow('สถานที่',result.location_name));
  if(result.distance_m!=null) rows.push(lineInfoRow('ระยะจากจุด',`${Math.round(result.distance_m)} ม.`));
  return {type:'flex',altText:checkin?'เช็กอินสำเร็จ':'เช็กเอาต์สำเร็จ',contents:lineBubble({eyebrow:'ATTENDANCE',title:checkin?'เช็กอินสำเร็จ':'เช็กเอาต์สำเร็จ',subtitle:'บันทึกเวลาเรียบร้อยแล้ว',status,statusTone:tone,body:[lineInfoCard(rows,tone)],footer:[lineSecondaryButton('ดูสถานะวันนี้',{type:'postback',label:'ดูสถานะวันนี้',data:'action=status'},LINE_CI.mintSoft)]})};
}
function buildLocationRequestFlex(action){
  const checkin=action==='checkin';
  return {type:'flex',altText:`ส่งตำแหน่งเพื่อ${checkin?'เช็กอิน':'เช็กเอาต์'}`,contents:lineBubble({eyebrow:'ATTENDANCE',title:`${checkin?'เช็กอิน':'เช็กเอาต์'}ด้วยตำแหน่ง`,subtitle:'นากนะจะใช้ตำแหน่งนี้เฉพาะการตรวจ Work Location',status:'รอตำแหน่ง',statusTone:'teal',body:[lineInfoCard([lineText('กด “ส่งตำแหน่งปัจจุบัน” ด้านล่าง แล้ว LINE จะให้คุณเลือกตำแหน่ง','sm',LINE_CI.text)],'teal')]})};
}
function buildSimpleNoticeFlex(title,message,tone='teal'){
  return {type:'flex',altText:title,contents:lineBubble({eyebrow:'นากนะ',title,body:[lineInfoCard([lineText(message,'sm',LINE_CI.text)],tone)],status:tone==='error'?'มีปัญหา':tone==='success'?'เรียบร้อย':null,statusTone:tone})};
}
async function replyEvidencePrompt(accessToken,replyToken,row){
  const message={type:'flex',altText:'แนบหลักฐานการลา',contents:lineBubble({eyebrow:'LEAVE · EVIDENCE',title:'แนบหลักฐานการลา',subtitle:row.leave_type_name||row.leave_type,status:'รอหลักฐาน',statusTone:'coral',body:[lineInfoCard([lineText('ส่งรูปหรือไฟล์ในแชตนี้ได้เลย เช่น ใบรับรองแพทย์หรือเอกสารประกอบ','sm',LINE_CI.text)],'coral')]})};
  message.quickReply={items:[{type:'action',action:{type:'cameraRoll',label:'เลือกรูป'}},{type:'action',action:{type:'camera',label:'ถ่ายรูป'}}]};
  return replyLineMessages(accessToken,replyToken,[message]);
}
async function replyLineMessages(accessToken,replyToken,messages){const response=await fetch('https://api.line.me/v2/bot/message/reply',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${accessToken}`},body:JSON.stringify({replyToken,messages})});if(!response.ok)console.error(JSON.stringify({level:'error',event:'line_reply_messages_failed',status:response.status,body:await response.text()}));}
async function pushLineMessages(accessToken,to,messages){if(!accessToken||!to)return;const response=await fetch('https://api.line.me/v2/bot/message/push',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${accessToken}`},body:JSON.stringify({to,messages})});if(!response.ok)console.error(JSON.stringify({level:'error',event:'line_push_messages_failed',status:response.status,body:await response.text()}));}

async function sendDailyHrBrief(env) {
  const clients = await env.DB.prepare('SELECT * FROM clients ORDER BY id').all();
  for (const client of clients.results || []) {
    const hrUsers = await env.DB.prepare(`
      SELECT DISTINCT e.line_user_id,e.line_provider_scope
      FROM employees e
      LEFT JOIN departments d ON d.id=e.department_id
      LEFT JOIN positions p ON p.id=e.position_id
      WHERE e.client_id=?1 AND e.status='active' AND e.line_user_id IS NOT NULL
        AND (UPPER(COALESCE(d.code,''))='HR' OR LOWER(COALESCE(p.name,'')) LIKE '%hr%')
    `).bind(Number(client.id)).all();
    if (!(hrUsers.results || []).length) continue;

    const dashboard = await getDashboard(env.DB, Number(client.id), { includeHrCases: true });
    const lines = [`☀️ HR Morning Brief — ${client.name}`, formatThaiShortDate(dashboard.today), ''];

    if (dashboard.attention.length) {
      lines.push('สิ่งที่ต้องจัดการ');
      for (const item of dashboard.attention) lines.push(`• ${item.label}: ${item.count}`);
      lines.push('');
    }

    if (dashboard.birthdays.length) {
      lines.push('🎂 Birthday Radar');
      for (const item of dashboard.birthdays.slice(0, 6)) {
        lines.push(`• ${item.name} — ${item.days === 0 ? 'วันนี้' : `อีก ${item.days} วัน`}`);
      }
      lines.push('');
    }

    if (dashboard.probation.length) {
      lines.push('⏳ Probation');
      for (const item of dashboard.probation.slice(0, 5)) lines.push(`• ${item.name} — อีก ${item.days} วัน`);
      lines.push('');
    }

    if (dashboard.contracts.length) {
      lines.push('📄 Contract');
      for (const item of dashboard.contracts.slice(0, 5)) lines.push(`• ${item.name} — อีก ${item.days} วัน`);
      lines.push('');
    }

    if (!dashboard.attention.length && !dashboard.birthdays.length && !dashboard.probation.length && !dashboard.contracts.length) {
      lines.push('✅ วันนี้ยังไม่มีเรื่องเร่งด่วนที่ระบบตรวจพบ');
    }

    const text = lines.join('\n').slice(0, 4900);
    for (const hr of hrUsers.results) {
      const token=await getAccessTokenForProviderScope(env,Number(client.id),hr.line_provider_scope);
      if(token) await pushLine(token, hr.line_user_id, text);
    }
  }
}

async function pushLine(accessToken, to, text) {
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
  });
  if (!response.ok) {
    console.error(JSON.stringify({ level: 'error', event: 'line_push_failed', status: response.status, body: await response.text() }));
  }
}

function formatThaiShortDate(isoDate) {
  const d = new Date(`${isoDate}T00:00:00+07:00`);
  return d.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
}

async function replyLineWithLocationQuickReply(accessToken, replyToken, text) {
  const action=String(text||'').includes('เช็กเอาต์')?'checkout':'checkin';
  const message=buildLocationRequestFlex(action);
  message.quickReply={items:[{type:'action',action:{type:'location',label:'ส่งตำแหน่งปัจจุบัน'}}]};
  return replyLineMessages(accessToken,replyToken,[message]);
}

async function replyLine(accessToken, replyToken, text) {
  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text: text.slice(0, 4900) }] }),
  });
  if (!response.ok) {
    console.error(JSON.stringify({ level: 'error', event: 'line_reply_failed', status: response.status, body: await response.text() }));
  }
}

async function verifyLineSignature(rawBody, signature, channelSecret) {
  if (!signature) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(channelSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expected = bytesToBase64(new Uint8Array(digest));
  return constantTimeEqual(expected, signature);
}

async function ensureCoreSchema(db) {
  if(SCHEMA_READY.has('core')) return;
  if (!db) throw new Error('D1 binding DB is not available');
  const requiredTables = [
    'departments','positions','employees','attendance','leave_requests','candidates','employee_requests',
    'line_link_tokens','line_sessions','audit_logs','work_locations','employee_work_locations','employee_invites',
    'employee_invite_locations','line_join_tokens'
  ];
  const placeholders = requiredTables.map(() => '?').join(',');
  const existing = await db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name IN (${placeholders})`)
    .bind(...requiredTables).all();
  const names = new Set((existing.results || []).map(row => row.name));
  const missing = requiredTables.filter(name => !names.has(name));

  if (missing.length) {
    console.log(JSON.stringify({ level: 'info', event: 'core_schema_repair_start', missing }));
    const statements = INIT_SCHEMA_SQL.split(';').map(statement => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      const tableMatch = statement.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([A-Za-z0-9_]+)/i);
      const indexMatch = statement.match(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+([A-Za-z0-9_]+)/i);
      const label = tableMatch?.[1] || indexMatch?.[1] || 'schema_statement';
      try {
        await db.prepare(statement).run();
      } catch (error) {
        if (indexMatch) {
          console.warn(JSON.stringify({ level: 'warn', event: 'core_schema_index_skipped', label, detail: safeDbErrorDetail(error) }));
          continue;
        }
        throw new Error(`CORE_SCHEMA_STEP:${label}:${String(error?.message || error)}`);
      }
    }
  }

  await ensureColumns(db,'employee_invites',[['token_value','TEXT']]);
  await ensureColumns(db,'employees',[
    ['line_display_name','TEXT'],['line_picture_url','TEXT'],['line_linked_at','TEXT'],['onboarding_source','TEXT'],
    ['emergency_contact_name','TEXT'],['emergency_contact_phone','TEXT'],['national_id','TEXT'],
    ['contract_type','TEXT'],['contract_number','TEXT'],['contract_start_date','TEXT'],['contract_signed_date','TEXT']
  ]);
  await ensureColumns(db,'attendance',[
    ['checkin_location_id','INTEGER'],['checkin_location_name','TEXT'],['checkin_distance_m','REAL'],['checkin_accuracy_m','REAL'],
    ['checkout_location_id','INTEGER'],['checkout_location_name','TEXT'],['checkout_distance_m','REAL'],['checkout_accuracy_m','REAL']
  ]);
  await ensureV050Ready(db);
  await ensureV060Ready(db);
  await ensureV061Ready(db);
  SCHEMA_READY.add('core');
  console.log(JSON.stringify({ level: 'info', event: 'core_schema_ready' }));
}

async function ensureColumn(db, table, column, type) {
  return ensureColumns(db, table, [[column,type]]);
}

async function ensureColumns(db, table, definitions) {
  const columns = await db.prepare(`PRAGMA table_info(${table})`).all();
  const names = new Set((columns.results || []).map(row => row.name));
  for (const [column,type] of definitions) {
    if (names.has(column)) continue;
    await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
    names.add(column);
  }
}

function safeCoreSchemaErrorDetail(error) {
  const text = String(error?.message || error || 'unknown');
  const step = text.match(/CORE_SCHEMA_STEP:([A-Za-z0-9_]+):(.*)$/);
  if (step) return `${step[1]}:${safeDbErrorDetail(new Error(step[2]))}`;
  return safeDbErrorDetail(error);
}

async function ensureDbReady(db) {
  if (!db) throw new Error('D1 binding DB is not available');
  const ready = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='clients'").first();
  if (!ready) {
    console.log(JSON.stringify({ level: 'info', event: 'database_bootstrap_start' }));
    await db.exec(INIT_SCHEMA_SQL);
    await db.exec(INIT_SEED_SQL);
    console.log(JSON.stringify({ level: 'info', event: 'database_bootstrap_complete' }));
  }
  const authReady = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").first();
  if (!authReady) await db.exec(INIT_AUTH_SCHEMA_SQL);
}

async function authorizeUser(request, env, { requireCompany = true } = {}) {
  const rawToken = getCookie(request, 'nakna_session');
  if (!rawToken) return { ok: false, status: 401, error: 'AUTH_REQUIRED' };
  const sessionHash = await sha256Hex(rawToken);
  const cookieClientId = Number(getCookie(request, 'nakna_company') || 0) || null;
  const setupMode = getCookie(request, 'nakna_setup_mode') === 'new';
  const cacheKey = `${sessionHash}:${setupMode ? 'setup' : (cookieClientId || 'auto')}`;
  const cached = AUTH_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    if (requireCompany && !cached.auth.clientId) return { ok: false, status: 409, error: 'COMPANY_REQUIRED' };
    return { ...cached.auth, ok: true };
  }
  if (cached) AUTH_CACHE.delete(cacheKey);

  // Normal requests used to perform: session read -> membership read ->
  // last_seen write. A dashboard fires many API calls, so that turned one page
  // load into dozens of D1 round trips/writes. Resolve the selected membership
  // in the session query, cache it briefly per Worker isolate, and only touch
  // last_seen periodically.
  const session = await env.DB.prepare(`
    SELECT s.token_hash, s.user_id, s.selected_client_id, s.expires_at, s.last_seen_at,
           u.google_sub, u.email, u.name, u.picture_url, u.locale, u.status,
           u.line_user_id, u.line_provider_scope, u.auth_provider,
           cm.role AS selected_role, cm.status AS selected_member_status
    FROM auth_sessions s
    JOIN users u ON u.id=s.user_id
    LEFT JOIN company_members cm
      ON cm.user_id=s.user_id
     AND cm.client_id=COALESCE(s.selected_client_id, ?2)
    WHERE s.token_hash=?1
  `).bind(sessionHash, cookieClientId).first();

  if (!session || session.status !== 'active' || new Date(session.expires_at).getTime() <= Date.now()) {
    if (session) await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash=?1').bind(sessionHash).run();
    AUTH_CACHE.delete(cacheKey);
    return { ok: false, status: 401, error: 'AUTH_REQUIRED' };
  }

  let clientId = setupMode ? null : (Number(session.selected_client_id || cookieClientId || 0) || null);
  let role = null;

  if (clientId && session.selected_member_status === 'active' && session.selected_role) {
    role = session.selected_role;
  } else if (clientId) {
    const member = await env.DB.prepare(`SELECT role FROM company_members WHERE user_id=?1 AND client_id=?2 AND status='active'`)
      .bind(Number(session.user_id), clientId).first();
    if (!member) clientId = null;
    else role = member.role;
  }

  if (!clientId && !setupMode) {
    const first = await env.DB.prepare(`SELECT client_id, role FROM company_members WHERE user_id=?1 AND status='active' ORDER BY id LIMIT 1`)
      .bind(Number(session.user_id)).first();
    if (first) {
      clientId = Number(first.client_id);
      role = first.role;
      await env.DB.prepare('UPDATE auth_sessions SET selected_client_id=?1, last_seen_at=CURRENT_TIMESTAMP WHERE token_hash=?2')
        .bind(clientId, sessionHash).run();
    }
  }

  if (requireCompany && !clientId) return { ok: false, status: 409, error: 'COMPANY_REQUIRED' };

  const lastSeen = Date.parse(String(session.last_seen_at || ''));
  if (!Number.isFinite(lastSeen) || Date.now() - lastSeen > 5 * 60 * 1000) {
    try {
      await env.DB.prepare('UPDATE auth_sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE token_hash=?1').bind(sessionHash).run();
    } catch {}
  }

  const auth = {
    sessionHash,
    clientId,
    role,
    setupMode: setupMode ? 'new' : null,
    user: {
      id: Number(session.user_id),
      google_sub: session.google_sub,
      email: session.email,
      name: session.name,
      picture_url: session.picture_url,
      locale: session.locale,
      line_user_id: session.line_user_id || null,
      line_provider_scope: session.line_provider_scope || null,
      auth_provider: session.auth_provider || (String(session.email||'').endsWith('@nakna.local') ? 'line' : 'google'),
    },
  };
  AUTH_CACHE.set(cacheKey, { expiresAt: Date.now() + AUTH_CACHE_TTL_MS, auth });
  if (AUTH_CACHE.size > 200) {
    const now = Date.now();
    for (const [key, value] of AUTH_CACHE) {
      if (value.expiresAt <= now) AUTH_CACHE.delete(key);
      if (AUTH_CACHE.size <= 120) break;
    }
  }
  return { ...auth, ok: true };
}

async function startGoogleLogin(request, env) {
  assertGoogleConfig(env);
  const state = randomToken(32);
  const url = new URL(request.url);
  const wantsLink = url.searchParams.get('link') === '1';
  let linkMode = false;
  if (wantsLink) {
    const current = await authorizeUser(request, env, { requireCompany: false }).catch(()=>null);
    linkMode = Boolean(current?.ok);
  }

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: oauthRedirectUri(request, env, '/auth/google/callback'),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  const cookies=[oauthStateCookie('nakna_oauth_state', state, 600)];
  if(linkMode) cookies.push(googleLinkModeCookie(600));
  return redirectResponse(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, cookies);
}

async function finishGoogleLogin(request, env) {
  assertGoogleConfig(env);
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = getCookie(request, 'nakna_oauth_state');

  if (!code || !state || !cookieState || !constantTimeEqual(state, cookieState)) {
    console.warn(JSON.stringify({ level: 'warn', event: 'google_oauth_failed', stage: 'state' }));
    return json({ error: 'GOOGLE_OAUTH_STATE_FAILED', stage: 'state' }, 400);
  }

  let tokens;
  try {
    tokens = await exchangeGoogleCode(code, oauthRedirectUri(request, env, '/auth/google/callback'), env);
  } catch (error) {
    const detail = safeOAuthErrorDetail(error);
    console.error(JSON.stringify({ level: 'error', event: 'google_oauth_failed', stage: 'token_exchange', detail }));
    return json({ error: 'GOOGLE_TOKEN_EXCHANGE_FAILED', stage: 'token_exchange', detail }, 500);
  }

  let profile;
  try {
    profile = await fetchGoogleProfile(tokens.access_token);
  } catch (error) {
    const detail = safeOAuthErrorDetail(error);
    console.error(JSON.stringify({ level: 'error', event: 'google_oauth_failed', stage: 'userinfo', detail }));
    return json({ error: 'GOOGLE_PROFILE_FAILED', stage: 'userinfo', detail }, 500);
  }

  if (!profile?.sub || !profile?.email || profile.email_verified === false) {
    console.warn(JSON.stringify({ level: 'warn', event: 'google_oauth_failed', stage: 'profile_validation' }));
    return json({ error: 'GOOGLE_PROFILE_INVALID', stage: 'profile_validation' }, 400);
  }

  const linkMode = getCookie(request,'nakna_google_link') === '1';
  if(linkMode){
    const currentAuth=await authorizeUser(request,env,{requireCompany:false}).catch(()=>null);
    if(currentAuth?.ok){
      try{
        const linked=await linkGoogleProfileToAccount(env,currentAuth,profile);
        const response=redirectResponse(`${appOrigin(request,env)}/?account=linked`,[clearCookie('nakna_oauth_state'),clearCookie('nakna_google_link')]);
        if(linked?.clientId) response.headers.append('Set-Cookie',companyCookie(linked.clientId));
        return response;
      }catch(error){
        console.error(JSON.stringify({level:'error',event:'google_account_link_failed',message:String(error?.message||error)}));
        return redirectResponse(`${appOrigin(request,env)}/?account_error=link`,[clearCookie('nakna_oauth_state'),clearCookie('nakna_google_link')]);
      }
    }
  }

  let user;
  try {
    await env.DB.prepare(`
      INSERT INTO users (google_sub, email, name, picture_url, locale, status)
      VALUES (?1,?2,?3,?4,?5,'active')
      ON CONFLICT(google_sub) DO UPDATE SET
        email=excluded.email, name=excluded.name, picture_url=excluded.picture_url,
        locale=excluded.locale, status='active', updated_at=CURRENT_TIMESTAMP
    `).bind(profile.sub, profile.email.toLowerCase(), profile.name || profile.email, profile.picture || null, profile.locale || null).run();
    user = await env.DB.prepare('SELECT * FROM users WHERE google_sub=?1').bind(profile.sub).first();
    if (!user?.id) throw new Error('USER_NOT_FOUND_AFTER_UPSERT');
  } catch (error) {
    const detail = safeDbErrorDetail(error);
    console.error(JSON.stringify({ level: 'error', event: 'google_oauth_failed', stage: 'db_user', detail }));
    return json({ error: 'DB_USER_UPSERT_FAILED', stage: 'db_user', detail }, 500);
  }

  let firstMembership = null;
  try {
    firstMembership = await env.DB.prepare(`SELECT client_id FROM company_members WHERE user_id=?1 AND status='active' ORDER BY id LIMIT 1`).bind(Number(user.id)).first();
  } catch (error) {
    const detail = safeDbErrorDetail(error);
    console.error(JSON.stringify({ level: 'error', event: 'google_oauth_failed', stage: 'db_membership', detail }));
    return json({ error: 'DB_MEMBERSHIP_LOOKUP_FAILED', stage: 'db_membership', detail }, 500);
  }

  const sessionToken = randomToken(40);
  const sessionHash = await sha256Hex(sessionToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  try {
    await env.DB.prepare(`INSERT INTO auth_sessions (token_hash, user_id, selected_client_id, expires_at) VALUES (?1,?2,?3,?4)`)
      .bind(sessionHash, Number(user.id), firstMembership ? Number(firstMembership.client_id) : null, expiresAt).run();
  } catch (error) {
    const detail = safeDbErrorDetail(error);
    console.error(JSON.stringify({ level: 'error', event: 'google_oauth_failed', stage: 'db_session', detail }));
    return json({ error: 'DB_SESSION_CREATE_FAILED', stage: 'db_session', detail }, 500);
  }

  const cookies = [sessionCookie(sessionToken), clearCookie('nakna_oauth_state'), clearCookie('nakna_google_link')];
  if (firstMembership) cookies.push(companyCookie(Number(firstMembership.client_id)));
  return redirectResponse(`${appOrigin(request, env)}/?auth=success`, cookies);
}

function safeOAuthErrorDetail(error) {
  const text = String(error?.message || error || 'unknown');
  const known = ['invalid_client', 'invalid_grant', 'redirect_uri_mismatch', 'access_denied', 'unauthorized_client'];
  for (const code of known) if (text.includes(code)) return code;
  if (text.includes('Google token exchange failed')) return 'token_exchange_failed';
  if (text.includes('Google userinfo failed')) return 'userinfo_failed';
  return 'oauth_failed';
}

function safeDbErrorDetail(error) {
  const text = String(error?.message || error || 'unknown');
  const table = text.match(/no such table:\s*([A-Za-z0-9_]+)/i);
  if (table) return `missing_table:${table[1]}`;
  if (/UNIQUE constraint failed/i.test(text)) return 'unique_constraint';
  if (/FOREIGN KEY constraint failed/i.test(text)) return 'foreign_key_constraint';
  if (/D1 binding DB is not available/i.test(text)) return 'db_binding_missing';
  if (/USER_NOT_FOUND_AFTER_UPSERT/i.test(text)) return 'user_missing_after_upsert';
  return 'db_operation_failed';
}

async function logoutSession(request, env) {
  const rawToken = getCookie(request, 'nakna_session');
  if (rawToken) await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash=?1').bind(await sha256Hex(rawToken)).run();
  const response = json({ ok: true });
  response.headers.append('Set-Cookie', clearCookie('nakna_session'));
  response.headers.append('Set-Cookie', clearCookie('nakna_company'));
  return response;
}


async function getWebOnboardingStatus(env,auth){
  await ensureV100P7Ready(env.DB);
  const clientId=auth.clientId?Number(auth.clientId):null;
  if(!clientId){
    return {completed:false,requires_company:true,current_step:'company',company:null,google:{connected:false},recruitment_gmail:{connected:false,enabled:true},trial:null};
  }
  const primaryOwner=await isPrimaryWorkspaceOwner(env.DB,clientId,auth.user?.id);
  if(!primaryOwner){
    const client=await getClient(env.DB,clientId);
    return {
      completed:true,
      access_joined:true,
      requires_company:false,
      current_step:'complete',
      company:client?publicCompanyProfile(client):null,
      google:{connected:null},
      recruitment_gmail:{connected:null,enabled:null},
      trial:null,
      message:'JOIN_EXISTING_WORKSPACE'
    };
  }
  const [client,onboarding,google,recruitment,subscription]=await Promise.all([
    getClient(env.DB,clientId),
    env.DB.prepare(`SELECT * FROM company_onboarding WHERE client_id=?1`).bind(clientId).first(),
    env.DB.prepare(`SELECT id,email,drive_folder_id,spreadsheet_id,status,last_sync_at,last_error FROM google_workspace_integrations WHERE client_id=?1 AND status='connected'`).bind(clientId).first(),
    env.DB.prepare(`SELECT * FROM recruitment_email_settings WHERE client_id=?1`).bind(clientId).first(),
    env.DB.prepare(`SELECT s.*,p.name AS plan_name,p.code AS plan_code FROM company_subscriptions s LEFT JOIN subscription_plans p ON p.id=s.plan_id WHERE s.client_id=?1`).bind(clientId).first(),
  ]);
  // Existing workspaces created before P7 must not get blocked by the new wizard.
  const legacyCompleted=!onboarding;
  const completed=legacyCompleted||Boolean(onboarding?.completed_at);
  let currentStep=completed?'complete':String(onboarding?.current_step||'google_workspace');
  if(!completed&&!google) currentStep='google_workspace';
  if(!completed&&google&&currentStep==='google_workspace') currentStep='recruitment_gmail';
  const trial=subscription?{
    status:subscription.status,plan_name:subscription.plan_name||'Free Trial',plan_code:subscription.plan_code||'trial',
    trial_started_at:subscription.trial_started_at,trial_ends_at:subscription.trial_ends_at,
    days_remaining:subscription.trial_ends_at?Math.max(0,Math.ceil((new Date(subscription.trial_ends_at)-new Date())/86400000)):null
  }:null;
  return {
    completed,legacy_completed:legacyCompleted,requires_company:false,current_step:currentStep,
    company:client?{...publicCompanyProfile(client),employee_estimate:Number(onboarding?.employee_estimate||0),legal_name:onboarding?.legal_name||client.name,tax_id:onboarding?.tax_id||null,phone:onboarding?.phone||null,address:onboarding?.address||null,province:onboarding?.province||null}:null,
    google:{connected:Boolean(google),email:google?.email||null,drive_folder_id:google?.drive_folder_id||null,spreadsheet_id:google?.spreadsheet_id||null,last_sync_at:google?.last_sync_at||null,last_error:google?.last_error||null},
    recruitment_gmail:{connected:Boolean(google),enabled:recruitment?Boolean(Number(recruitment.enabled)):Boolean(Number(onboarding?.recruitment_gmail_enabled??1)),query:recruitment?.query||onboarding?.recruitment_gmail_query||'newer_than:30d {สมัคร resume CV "job application"}',auto_sync:recruitment?Boolean(Number(recruitment.auto_sync)):true,last_sync_at:recruitment?.last_sync_at||null,last_error:recruitment?.last_error||null},
    trial
  };
}

async function getRecruitmentGmailStatus(env,clientId){
  await ensureV100P7Ready(env.DB);
  const [settings,workspace,count]=await Promise.all([
    env.DB.prepare(`SELECT * FROM recruitment_email_settings WHERE client_id=?1`).bind(Number(clientId)).first(),
    env.DB.prepare(`SELECT email,status,scopes FROM google_workspace_integrations WHERE client_id=?1 AND status='connected'`).bind(Number(clientId)).first(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM recruitment_email_messages WHERE client_id=?1`).bind(Number(clientId)).first(),
  ]);
  return {connected:Boolean(workspace),email:workspace?.email||null,enabled:settings?Boolean(Number(settings.enabled)):true,auto_sync:settings?Boolean(Number(settings.auto_sync)):true,query:settings?.query||'newer_than:30d {สมัคร resume CV "job application"}',last_sync_at:settings?.last_sync_at||null,last_error:settings?.last_error||null,imported_messages:Number(count?.n||0)};
}

function gmailHeader(message,name){
  const headers=message?.payload?.headers||[];
  const row=headers.find(h=>String(h.name||'').toLowerCase()===String(name||'').toLowerCase());
  return String(row?.value||'').trim();
}

function parseEmailIdentity(value){
  const raw=String(value||'').trim();
  const match=raw.match(/^(.*?)\s*<([^<>\s]+@[^<>\s]+)>$/);
  if(match) return {name:match[1].replace(/^"|"$/g,'').trim(),email:match[2].toLowerCase()};
  const email=(raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)||[])[0]||'';
  return {name:email?raw.replace(email,'').replace(/[<>"']/g,'').trim():'',email:email.toLowerCase()};
}

function candidateNameParts(displayName,email){
  const clean=String(displayName||'').replace(/\s+/g,' ').trim();
  if(clean){
    const parts=clean.split(' ').filter(Boolean);
    if(parts.length===1)return {first_name:parts[0].slice(0,80),last_name:'ไม่ระบุ'};
    return {first_name:parts.shift().slice(0,80),last_name:parts.join(' ').slice(0,120)};
  }
  const local=String(email||'candidate').split('@')[0].replace(/[._-]+/g,' ').trim()||'ผู้สมัคร';
  const parts=local.split(' ').filter(Boolean);
  return {first_name:(parts.shift()||'ผู้สมัคร').slice(0,80),last_name:(parts.join(' ')||'ไม่ระบุ').slice(0,120)};
}

function inferCandidatePosition(subject){
  const text=String(subject||'').replace(/\s+/g,' ').trim();
  const patterns=[/สมัคร(?:งาน|ตำแหน่ง)?\s*[:\-–]?\s*(.+)$/i,/application\s+(?:for|position)\s*[:\-–]?\s*(.+)$/i,/apply\s+(?:for)?\s*[:\-–]?\s*(.+)$/i];
  for(const p of patterns){const m=text.match(p);if(m?.[1])return m[1].slice(0,120);}
  return text&&text.length<=80?text.slice(0,120):'ไม่ระบุตำแหน่ง';
}

function gmailAttachmentNames(part,out=[]){
  if(!part)return out;
  if(part.filename)out.push(String(part.filename).slice(0,180));
  for(const child of part.parts||[])gmailAttachmentNames(child,out);
  return out;
}

async function syncRecruitmentGmailForClient(env,clientId,{limit=25}={}){
  await ensureV100P7Ready(env.DB);
  const cid=Number(clientId);
  const settings=await env.DB.prepare(`SELECT * FROM recruitment_email_settings WHERE client_id=?1`).bind(cid).first();
  if(settings&&Number(settings.enabled)===0)return {skipped:true,reason:'disabled',imported:0,linked:0,scanned:0};
  const workspace=await env.DB.prepare(`SELECT * FROM google_workspace_integrations WHERE client_id=?1 AND status='connected'`).bind(cid).first();
  if(!workspace)throw new Error('GOOGLE_WORKSPACE_REQUIRED');
  const accessToken=await getWorkspaceGoogleAccessToken(env,workspace);
  const query=String(settings?.query||'newer_than:30d {สมัคร resume CV "job application"}').trim();
  const listUrl=new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  listUrl.searchParams.set('maxResults',String(Math.max(1,Math.min(50,Number(limit)||25))));
  if(query)listUrl.searchParams.set('q',query);
  const listing=await googleApiJson(listUrl.toString(),accessToken);
  const messages=listing.messages||[];
  let imported=0,linked=0,skipped=0;
  for(const ref of messages){
    const gmailId=String(ref.id||''); if(!gmailId)continue;
    const seen=await env.DB.prepare(`SELECT id FROM recruitment_email_messages WHERE client_id=?1 AND gmail_message_id=?2`).bind(cid,gmailId).first();
    if(seen){skipped++;continue;}
    const msg=await googleApiJson(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(gmailId)}?format=full`,accessToken);
    const from=gmailHeader(msg,'From'); const subject=gmailHeader(msg,'Subject'); const dateHeader=gmailHeader(msg,'Date');
    const identity=parseEmailIdentity(from); const receivedAt=dateHeader&&!Number.isNaN(new Date(dateHeader).getTime())?new Date(dateHeader).toISOString():new Date(Number(msg.internalDate||Date.now())).toISOString();
    const attachments=gmailAttachmentNames(msg.payload,[]);
    let candidateId=null,importStatus='seen';
    if(identity.email){
      const existing=await env.DB.prepare(`SELECT id FROM candidates WHERE client_id=?1 AND lower(email)=lower(?2) ORDER BY id DESC LIMIT 1`).bind(cid,identity.email).first();
      if(existing){candidateId=Number(existing.id);linked++;importStatus='linked_existing';await env.DB.prepare(`UPDATE candidates SET last_activity_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?1`).bind(candidateId).run();}
      else{
        const names=candidateNameParts(identity.name,identity.email); const position=inferCandidatePosition(subject);
        const noteParts=[`นำเข้าจาก Gmail: ${subject||'(ไม่มีหัวข้อ)'}`]; if(attachments.length)noteParts.push(`ไฟล์แนบ: ${attachments.join(', ')}`);
        const created=await env.DB.prepare(`INSERT INTO candidates (client_id,first_name,last_name,email,position_name,source,stage,notes,last_activity_at) VALUES (?1,?2,?3,?4,?5,'Gmail','new',?6,CURRENT_TIMESTAMP)`).bind(cid,names.first_name,names.last_name,identity.email,position,noteParts.join('\n').slice(0,1500)).run();
        candidateId=Number(created.meta.last_row_id); imported++; importStatus='candidate_created';
      }
    }
    await env.DB.prepare(`INSERT INTO recruitment_email_messages (client_id,gmail_message_id,gmail_thread_id,sender_name,sender_email,subject,received_at,snippet,attachment_names,candidate_id,import_status) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)`).bind(cid,gmailId,msg.threadId||null,identity.name||null,identity.email||null,subject||null,receivedAt,String(msg.snippet||'').slice(0,500),attachments.length?JSON.stringify(attachments):null,candidateId,importStatus).run();
  }
  await env.DB.prepare(`INSERT INTO recruitment_email_settings (client_id,enabled,query,auto_sync,last_sync_at,last_error,updated_at) VALUES (?1,1,?2,1,CURRENT_TIMESTAMP,NULL,CURRENT_TIMESTAMP) ON CONFLICT(client_id) DO UPDATE SET last_sync_at=CURRENT_TIMESTAMP,last_error=NULL,updated_at=CURRENT_TIMESTAMP`).bind(cid,query).run();
  return {scanned:messages.length,imported,linked,skipped,query};
}

async function syncAllRecruitmentGmail(env){
  await ensureV100P7Ready(env.DB);
  const rows=await env.DB.prepare(`SELECT s.client_id FROM recruitment_email_settings s JOIN google_workspace_integrations g ON g.client_id=s.client_id AND g.status='connected' WHERE s.enabled=1 AND s.auto_sync=1 ORDER BY COALESCE(s.last_sync_at,'2000-01-01') ASC LIMIT 20`).all();
  const results=[];
  for(const row of rows.results||[]){
    try{results.push({client_id:Number(row.client_id),...(await syncRecruitmentGmailForClient(env,Number(row.client_id),{limit:20}))});}
    catch(error){await env.DB.prepare(`UPDATE recruitment_email_settings SET last_error=?1,updated_at=CURRENT_TIMESTAMP WHERE client_id=?2`).bind(String(error?.message||error).slice(0,300),Number(row.client_id)).run().catch(()=>{});results.push({client_id:Number(row.client_id),error:String(error?.message||error)});}
  }
  return results;
}

function safeRecruitmentGmailError(error){
  const text=String(error?.message||error||'');
  if(text.includes('GOOGLE_WORKSPACE_REQUIRED'))return 'กรุณาเชื่อม Google ก่อน';
  if(/401|invalid_grant|refresh/i.test(text))return 'สิทธิ์ Google หมดอายุ กรุณาเชื่อม Google ใหม่';
  if(/gmail/i.test(text))return 'อ่าน Gmail ไม่สำเร็จ กรุณาตรวจ Gmail API และสิทธิ์ OAuth';
  return 'Sync Gmail ผู้สมัครไม่สำเร็จ กรุณาลองใหม่';
}

async function startGoogleWorkspaceConnection(request, env) {
  assertGoogleConfig(env);
  if (!integrationEncryptionKey(env)) return json({ error: 'Integration encryption key is not configured' }, 500);
  const auth = await authorizeUser(request, env, { requireCompany: true });
  if (!auth.ok) return redirectResponse(`${appOrigin(request, env)}/?auth=required`);
  if (!canManageIntegrations(auth.role)) return redirectResponse(`${appOrigin(request, env)}/?google_workspace_error=permission`);
  await ensureV063Ready(env.DB);

  const state = randomToken(32);
  const stateHash = await sha256Hex(state);
  const purpose = `google_workspace:${Number(auth.clientId)}`;
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await env.DB.prepare(`INSERT INTO oauth_states (state_hash,purpose,user_id,expires_at) VALUES (?1,?2,?3,?4)`)
    .bind(stateHash, purpose, Number(auth.user.id), expiresAt).run();

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: oauthRedirectUri(request, env, '/integrations/google-workspace/callback'),
    response_type: 'code',
    scope: [
      'openid','email','profile',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/spreadsheets'
    ].join(' '),
    state,
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    login_hint: String(auth.user.email||'').endsWith('@nakna.local') ? '' : auth.user.email,
  });
  if (!params.get('login_hint')) params.delete('login_hint');
  return redirectResponse(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, [oauthStateCookie('nakna_google_workspace_state', state, 600)]);
}

async function finishGoogleWorkspaceConnection(request, env, ctx) {
  assertGoogleConfig(env);
  const key = integrationEncryptionKey(env);
  if (!key) return googleWorkspaceErrorRedirect(request, env, 'config');
  let auth = await authorizeUser(request, env, { requireCompany: true });
  if (!auth.ok) return redirectResponse(`${appOrigin(request, env)}/?auth=required`);
  if (!canManageIntegrations(auth.role)) return googleWorkspaceErrorRedirect(request, env, 'permission');
  await ensureV063Ready(env.DB);

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = getCookie(request, 'nakna_google_workspace_state');
  if (!code || !state || !cookieState || !constantTimeEqual(state, cookieState)) return googleWorkspaceErrorRedirect(request, env, 'state');
  const stateHash = await sha256Hex(state);
  const purpose = `google_workspace:${Number(auth.clientId)}`;
  const saved = await env.DB.prepare(`SELECT * FROM oauth_states WHERE state_hash=?1 AND purpose=?2 AND user_id=?3`).bind(stateHash,purpose,Number(auth.user.id)).first();
  if (!saved || new Date(saved.expires_at).getTime() <= Date.now()) return googleWorkspaceErrorRedirect(request, env, 'expired');
  await env.DB.prepare('DELETE FROM oauth_states WHERE state_hash=?1').bind(stateHash).run();

  try {
    const tokens = await exchangeGoogleCode(code, oauthRedirectUri(request, env, '/integrations/google-workspace/callback'), env);
    const profile = await fetchGoogleProfile(tokens.access_token);
    auth = await linkGoogleProfileToAccount(env,auth,profile).catch(error=>{console.warn(JSON.stringify({level:'warn',event:'workspace_account_link_skip',message:String(error?.message||error)}));return auth;});
    const current = await env.DB.prepare(`SELECT * FROM google_workspace_integrations WHERE client_id=?1`).bind(Number(auth.clientId)).first();
    let previous = null;
    if (current?.encrypted_tokens) { try { previous = await decryptJson(current.encrypted_tokens, key); } catch {} }
    const tokenPayload = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || previous?.refresh_token || null,
      token_type: tokens.token_type || 'Bearer',
      expires_at: new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString(),
    };
    if (!tokenPayload.refresh_token) return googleWorkspaceErrorRedirect(request, env, 'refresh_token');
    const client = await getClient(env.DB, Number(auth.clientId));
    const resources = await ensureGoogleWorkspaceResources(tokens.access_token, client, current);
    const encrypted = await encryptJson(tokenPayload, key);
    await env.DB.prepare(`
      INSERT INTO google_workspace_integrations (
        client_id,connected_by_user_id,google_sub,email,encrypted_tokens,scopes,
        gmail_enabled,drive_enabled,sheets_enabled,drive_folder_id,leave_evidence_folder_id,spreadsheet_id,status,last_error
      ) VALUES (?1,?2,?3,?4,?5,?6,1,1,1,?7,?8,?9,'connected',NULL)
      ON CONFLICT(client_id) DO UPDATE SET
        connected_by_user_id=excluded.connected_by_user_id,google_sub=excluded.google_sub,email=excluded.email,
        encrypted_tokens=excluded.encrypted_tokens,scopes=excluded.scopes,gmail_enabled=1,drive_enabled=1,sheets_enabled=1,
        drive_folder_id=excluded.drive_folder_id,leave_evidence_folder_id=excluded.leave_evidence_folder_id,spreadsheet_id=excluded.spreadsheet_id,status='connected',last_error=NULL,updated_at=CURRENT_TIMESTAMP
    `).bind(Number(auth.clientId),Number(auth.user.id),profile.sub||null,profile.email||auth.user.email,encrypted,tokens.scope||'',resources.drive_folder_id,resources.leave_evidence_folder_id,resources.spreadsheet_id).run();
    const row = await env.DB.prepare(`SELECT * FROM google_workspace_integrations WHERE client_id=?1`).bind(Number(auth.clientId)).first();
    const initialSync = (async () => {
      try {
        await syncWorkspaceSnapshotToSheet(env, Number(auth.clientId), row, tokens.access_token);
        await env.DB.prepare(`UPDATE google_workspace_integrations SET last_sync_at=CURRENT_TIMESTAMP,last_error=NULL WHERE id=?1`).bind(Number(row.id)).run();
      } catch (syncError) {
        await env.DB.prepare(`UPDATE google_workspace_integrations SET last_error=?1 WHERE id=?2`).bind(String(syncError?.message||syncError).slice(0,300),Number(row.id)).run();
      }
    })();
    if (ctx?.waitUntil) ctx.waitUntil(initialSync); else await initialSync;
    await safeAudit(env.DB, Number(auth.clientId), 'user', String(auth.user.id), 'google_workspace.connect', 'google_workspace', String(row.id), { email: profile.email, drive_folder_id: resources.drive_folder_id, spreadsheet_id: resources.spreadsheet_id });
    await ensureP7CompanyDefaults(env.DB,Number(auth.clientId),Number(auth.user.id));
    await env.DB.prepare(`UPDATE company_onboarding SET current_step='recruitment_gmail',updated_at=CURRENT_TIMESTAMP WHERE client_id=?1 AND completed_at IS NULL`).bind(Number(auth.clientId)).run().catch(()=>{});
    return redirectResponse(`${appOrigin(request, env)}/?google_workspace=connected&setup=1`, [clearCookie('nakna_google_workspace_state')]);
  } catch (error) {
    console.error(JSON.stringify({level:'error',event:'google_workspace_connect_failed',message:String(error?.message||error)}));
    return googleWorkspaceErrorRedirect(request, env, safeGoogleWorkspaceErrorCode(error));
  }
}

async function ensureGoogleWorkspaceResources(accessToken, client, current) {
  let driveFolderId = current?.drive_folder_id || null;
  let leaveEvidenceFolderId = current?.leave_evidence_folder_id || null;
  let spreadsheetId = current?.spreadsheet_id || null;
  const safeName = String(client?.name || 'Company').trim();
  if (!driveFolderId) {
    const folder = await googleApiJson('https://www.googleapis.com/drive/v3/files?fields=id,name', accessToken, {
      method: 'POST',
      body: JSON.stringify({ name: `Nakna HR - ${safeName}`, mimeType: 'application/vnd.google-apps.folder' }),
    });
    driveFolderId = folder.id;
  }
  if (!leaveEvidenceFolderId) {
    const evidenceFolder = await googleApiJson('https://www.googleapis.com/drive/v3/files?fields=id,name', accessToken, {
      method:'POST', body:JSON.stringify({ name:'Leave Evidence', mimeType:'application/vnd.google-apps.folder', parents:[driveFolderId] })
    });
    leaveEvidenceFolderId = evidenceFolder.id;
  }
  if (!spreadsheetId) {
    const sheetTitles = ['Employees','Candidates','Attendance','Leave Requests','Leave Balance','Leave Policy','Approvers','Work Locations','Departments','Positions','Invitations','Documents','Work Schedules','Company Holidays','HR Cases','Broadcasts','Leave Ledger','Payroll Profiles','Payroll Periods','Payroll Items','Payroll Adjustments','Payroll Documents','Employee Documents','Learning Courses','Learning Assignments','KPI Goals','KPI Updates','One on Ones','Probation Reviews','Points Wallet','Point Transactions','Point Rules','Reward Catalog','Reward Redemptions','Subscriptions','Usage Snapshots','Billing Invoices','Billing Payments','Recruitment Gmail','Benefits','Benefit Enrollments','Audit Log'];
    const spreadsheet = await googleApiJson('https://sheets.googleapis.com/v4/spreadsheets', accessToken, {
      method: 'POST',
      body: JSON.stringify({ properties: { title: `Nakna HR Database - ${safeName}` }, sheets: sheetTitles.map(title => ({ properties: { title } })) }),
    });
    spreadsheetId = spreadsheet.spreadsheetId;
    await moveGoogleFileToFolder(accessToken, spreadsheetId, driveFolderId);
    await initializeNaknaSheet(accessToken, spreadsheetId, client);
  }
  await ensureNaknaPhase2SheetTabs(accessToken, spreadsheetId);
  return { drive_folder_id: driveFolderId, leave_evidence_folder_id: leaveEvidenceFolderId, spreadsheet_id: spreadsheetId };
}

async function moveGoogleFileToFolder(accessToken, fileId, folderId) {
  const file = await googleApiJson(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=parents`, accessToken);
  const oldParents = (file.parents || []).join(',');
  const params = new URLSearchParams({ addParents: folderId, fields: 'id,parents' });
  if (oldParents) params.set('removeParents', oldParents);
  await googleApiJson(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params.toString()}`, accessToken, { method: 'PATCH' });
}

async function ensureNaknaPhase2SheetTabs(accessToken, spreadsheetId){
  const wanted=['Candidates','Work Schedules','Company Holidays','HR Cases','Broadcasts','Leave Ledger','Payroll Profiles','Payroll Periods','Payroll Items','Payroll Adjustments','Payroll Documents','Employee Documents','Learning Courses','Learning Assignments','KPI Goals','KPI Updates','One on Ones','Probation Reviews','Points Wallet','Point Transactions','Point Rules','Reward Catalog','Reward Redemptions','Subscriptions','Usage Snapshots','Billing Invoices','Billing Payments','Recruitment Gmail','Benefits','Benefit Enrollments'];
  const book=await googleApiJson(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`,accessToken);
  const existing=new Set((book.sheets||[]).map(s=>s.properties?.title).filter(Boolean));
  const requests=wanted.filter(title=>!existing.has(title)).map(title=>({addSheet:{properties:{title}}}));
  if(requests.length) await googleApiJson(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,accessToken,{method:'POST',body:JSON.stringify({requests})});
  const headers=googleSheetHeaders();
  const data=Object.entries(headers).map(([sheet,values])=>({range:`'${sheet}'!A1:${columnLetter(values.length)}1`,majorDimension:'ROWS',values:[values]}));
  await googleApiJson(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,accessToken,{method:'POST',body:JSON.stringify({valueInputOption:'RAW',data})});
}

async function initializeNaknaSheet(accessToken, spreadsheetId, client) {
  const headers = googleSheetHeaders();
  const data = Object.entries(headers).map(([sheet, values]) => ({ range: `'${sheet}'!A1:${columnLetter(values.length)}1`, majorDimension: 'ROWS', values: [values] }));
  data.push({ range: `'Audit Log'!A2:D2`, majorDimension:'ROWS', values:[[new Date().toISOString(),'system','workspace.created',`Client ${client?.id || ''}`]] });
  await googleApiJson(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`, accessToken, {
    method:'POST', body: JSON.stringify({ valueInputOption:'RAW', data })
  });
}

function googleSheetHeaders() {
  return {
    'Employees':['employee_id','employee_code','first_name','last_name','nickname','email','phone','department','position','manager_employee_id','people_status','runtime_status','start_date','probation_end_date','confirmed_at','end_date','end_reason','line_connected'],
    'Candidates':['candidate_id','first_name','last_name','nickname','email','phone','position_name','source','expected_salary','stage','available_start_date','last_activity_at','notes'],
    'Attendance':['attendance_id','employee_id','work_date','scheduled_start','scheduled_end','schedule_source','check_in_at','check_out_at','status','late_minutes','location_name','latitude','longitude','checkout_outside_geofence','source'],
    'Leave Requests':['leave_id','employee_id','leave_type','start_date','end_date','duration_days','reason','status','approver_employee_id','evidence_count','created_at'],
    'Leave Balance':['employee_id','year','leave_policy_id','entitlement_days','adjustment_days','used_days','pending_days','remaining_days'],
    'Leave Policy':['policy_id','code','name','default_entitlement_days','notice_days','evidence_required_after_days','is_active'],
    'Approvers':['employee_id','permission_key','granted_at'],
    'Work Locations':['location_id','name','address','latitude','longitude','radius_m','is_active'],
    'Departments':['department_id','name','code','manager_employee_id','parent_department_id','sort_order'],
    'Positions':['position_id','department_id','name'],
    'Invitations':['invite_id','token_preview','department_id','position_id','start_date','max_uses','used_count','expires_at','status'],
    'Documents':['document_id','employee_id','document_type','file_name','drive_file_id','drive_url','created_at'],
    'Work Schedules':['schedule_id','scope_type','scope_id','weekday','is_workday','start_time','end_time','late_grace_minutes','updated_at'],
    'Company Holidays':['holiday_id','holiday_date','name','holiday_type','is_paid','notes'],
    'HR Cases':['case_id','employee_id','subject','detail','priority','status','submitted_via','assigned_user_id','hr_note','last_reply_to_employee','created_at','updated_at'],
    'Broadcasts':['broadcast_id','title','message','audience_type','status','total_recipients','delivered_count','failed_count','sent_at','created_at'],
    'Leave Ledger':['ledger_id','employee_id','leave_policy_id','year','entry_type','days','reference_type','reference_id','note','created_at'],
    'Payroll Profiles':['employee_id','employee_code','name','base_salary','social_security_enabled','tax_enabled','personal_allowance','extra_annual_deductions','monthly_tax_override','bank_name','bank_account_name','bank_account_no','effective_from','updated_at'],
    'Payroll Periods':['period_id','period_key','period_start','period_end','pay_date','status','employee_count','gross_total','deduction_total','net_total','locked_at','published_at'],
    'Payroll Items':['item_id','period_id','employee_id','employee_code','name','base_salary','prorated_salary','absent_days','late_minutes','attendance_deduction','overtime','commission','incentive','allowance','bonus','other_earnings','gross_income','social_security','withholding_tax','other_deductions','total_deductions','net_pay','status'],
    'Payroll Adjustments':['adjustment_id','period_id','employee_id','type','category','amount','taxable','sso_contributable','note','created_at'],
    'Payroll Documents':['document_id','period_id','employee_id','document_type','file_name','drive_file_id','drive_url','email_sent_at','line_notified_at','created_at'],
    'Employee Documents':['document_id','employee_id','document_type','title','file_name','drive_file_id','drive_url','document_date','visibility','note','created_at'],
    'Learning Courses':['course_id','title','status','audience_type','required','estimated_minutes','passing_score','published_at','created_at'],
    'Learning Assignments':['assignment_id','course_id','employee_id','status','progress_pct','score_pct','attempts','due_date','assigned_at','completed_at'],
    'KPI Goals':['goal_id','cycle_id','employee_id','title','metric_type','target_value','target_text','unit','weight','update_frequency','status','created_at'],
    'KPI Updates':['update_id','goal_id','employee_id','update_date','period_key','actual_value','actual_text','progress_pct','note','source','created_at'],
    'One on Ones':['one_on_one_id','employee_id','manager_employee_id','scheduled_at','occurred_at','status','employee_notes','manager_notes','action_items','next_followup_at','created_at'],
    'Probation Reviews':['review_id','employee_id','reviewer_employee_id','review_date','status','score','strengths','improvements','manager_comment','hr_comment','recommendation','extension_end_date','created_at'],
    'Points Wallet':['employee_id','employee_code','name','balance','lifetime_earned','lifetime_spent','updated_at'],
    'Point Transactions':['transaction_id','employee_id','employee_code','name','rule_id','type','points','cash_value','reference_type','reference_id','note','payroll_adjustment_id','created_at'],
    'Point Rules':['rule_id','code','name','event_type','points','cash_value','threshold_count','window_days','is_active','effective_from','updated_at'],
    'Reward Catalog':['reward_id','title','reward_type','points_cost','cash_value','stock_qty','status','updated_at'],
    'Reward Redemptions':['redemption_id','employee_id','reward_id','points_cost','cash_value','status','employee_note','hr_note','requested_at','decided_at','delivered_at','payroll_adjustment_id'],
    'Subscriptions':['subscription_id','client_id','plan_id','status','billing_cycle','trial_started_at','trial_ends_at','current_period_start','current_period_end','provider','updated_at'],
    'Usage Snapshots':['snapshot_id','snapshot_date','active_employee_seats','line_connected_seats','storage_bytes','created_at'],
    'Billing Invoices':['invoice_id','invoice_no','period_start','period_end','active_seats','base_fee','seat_amount','subtotal','vat_rate','vat_amount','total','currency','status','due_date','paid_at','created_at'],
    'Billing Payments':['payment_id','invoice_id','amount','method','provider','provider_payment_id','note','paid_at'],
    'Recruitment Gmail':['message_id','gmail_message_id','thread_id','sender_name','sender_email','subject','received_at','attachment_names','candidate_id','import_status','created_at'],
    'Benefits':['benefit_id','code','name','benefit_type','description','employer_amount','employee_amount','frequency','is_statutory','status','enrolled_count','updated_at'],
    'Benefit Enrollments':['enrollment_id','benefit_id','benefit_name','employee_id','employee_code','employee_name','status','start_date','end_date','note','updated_at'],
    'Audit Log':['timestamp','actor','action','detail']
  };
}

async function getWorkspaceGoogleAccessToken(env, row) {
  const key = integrationEncryptionKey(env);
  if (!key) throw new Error('Integration encryption key is not configured');
  const tokens = await decryptJson(row.encrypted_tokens, key);
  if (tokens.access_token && (!tokens.expires_at || new Date(tokens.expires_at).getTime() > Date.now() + 60000)) return tokens.access_token;
  if (!tokens.refresh_token) throw new Error('Google refresh token missing');
  const refreshed = await refreshGoogleAccessToken(tokens.refresh_token, env);
  const next = { ...tokens, access_token: refreshed.access_token, expires_at: new Date(Date.now() + Number(refreshed.expires_in || 3600) * 1000).toISOString() };
  const encrypted = await encryptJson(next, key);
  await env.DB.prepare(`UPDATE google_workspace_integrations SET encrypted_tokens=?1,updated_at=CURRENT_TIMESTAMP WHERE id=?2`).bind(encrypted,Number(row.id)).run();
  return next.access_token;
}

async function refreshGoogleAccessToken(refreshToken, env) {
  const body = new URLSearchParams({ client_id:env.GOOGLE_CLIENT_ID, client_secret:env.GOOGLE_CLIENT_SECRET, refresh_token:refreshToken, grant_type:'refresh_token' });
  const response = await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(`Google token refresh failed: ${data.error || response.status}`);
  return data;
}

async function googleApiJson(url, accessToken, options={}) {
  const response = await fetch(url,{...options,headers:{authorization:`Bearer ${accessToken}`,'content-type':'application/json',...(options.headers||{})}});
  let data={}; try{data=await response.json();}catch{}
  if(!response.ok) throw new Error(`Google API failed ${response.status}: ${data?.error?.message || data?.error || 'unknown'}`);
  return data;
}

async function uploadGoogleDriveFile(accessToken,{folderId,fileName,contentType,bytes}){
  const boundary=`nakna_${randomToken(10)}`;
  const metadata=JSON.stringify({name:fileName,parents:[folderId]});
  const prefix=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${contentType||'application/octet-stream'}\r\n\r\n`;
  const suffix=`\r\n--${boundary}--`;
  const body=new Blob([prefix,new Uint8Array(bytes),suffix]);
  const response=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',{method:'POST',headers:{authorization:`Bearer ${accessToken}`,'content-type':`multipart/related; boundary=${boundary}`},body});
  const data=await response.json();
  if(!response.ok||!data.id)throw new Error(`Google Drive upload failed ${response.status}: ${data?.error?.message||'unknown'}`);
  return data;
}

async function storeLeaveEvidenceBinary(env,{clientId,requestId,employeeId,bytes,fileName,contentType,fileSize,source}){
  await ensureV063Ready(env.DB);
  const integration=await env.DB.prepare(`SELECT * FROM google_workspace_integrations WHERE client_id=?1 AND status='connected'`).bind(Number(clientId)).first();
  if(integration?.drive_folder_id){
    const accessToken=await getWorkspaceGoogleAccessToken(env,integration);
    const folderId=integration.leave_evidence_folder_id||integration.drive_folder_id;
    const uploaded=await uploadGoogleDriveFile(accessToken,{folderId,fileName,contentType,bytes});
    const r2Key=`drive:${uploaded.id}`;
    const result=await env.DB.prepare(`INSERT INTO leave_request_evidence (client_id,leave_request_id,uploaded_by_employee_id,r2_key,file_name,content_type,file_size,source,drive_file_id,drive_url,storage_provider) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,'google_drive')`).bind(Number(clientId),Number(requestId),employeeId?Number(employeeId):null,r2Key,fileName,contentType,fileSize||null,source||'line',uploaded.id,uploaded.webViewLink||null).run();
    return Number(result.meta.last_row_id);
  }
  if(!env.EVIDENCE_BUCKET)throw httpError('ยังไม่ได้เชื่อม Google Drive และ R2 fallback ไม่พร้อม',503);
  const key=`client-${clientId}/leave-${requestId}/${crypto.randomUUID()}-${String(fileName||'evidence').replace(/[^A-Za-z0-9._-]/g,'_')}`;
  await env.EVIDENCE_BUCKET.put(key,bytes,{httpMetadata:{contentType:contentType||'application/octet-stream'}});
  const result=await env.DB.prepare(`INSERT INTO leave_request_evidence (client_id,leave_request_id,uploaded_by_employee_id,r2_key,file_name,content_type,file_size,source,storage_provider) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,'r2')`).bind(Number(clientId),Number(requestId),employeeId?Number(employeeId):null,key,fileName,contentType,fileSize||null,source||'line').run();
  return Number(result.meta.last_row_id);
}

async function serveStoredEvidence(env,row,cacheControl='private, no-store'){
  if(row.drive_file_id||String(row.r2_key||'').startsWith('drive:')){
    const fileId=row.drive_file_id||String(row.r2_key).slice(6);
    const integration=await env.DB.prepare(`SELECT * FROM google_workspace_integrations WHERE client_id=?1 AND status='connected'`).bind(Number(row.client_id)).first();
    if(!integration)return json({error:'Google Drive ของบริษัทไม่ได้เชื่อมอยู่'},503);
    const accessToken=await getWorkspaceGoogleAccessToken(env,integration);
    const response=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,{headers:{authorization:`Bearer ${accessToken}`}});
    if(!response.ok)return new Response('Not found',{status:404});
    const headers=new Headers();headers.set('content-type',row.content_type||response.headers.get('content-type')||'application/octet-stream');headers.set('cache-control',cacheControl);headers.set('content-disposition',`inline; filename*=UTF-8''${encodeURIComponent(row.file_name||'evidence')}`);return new Response(response.body,{headers});
  }
  if(!env.EVIDENCE_BUCKET)return json({error:'Evidence storage ยังไม่พร้อม'},503);
  const object=await env.EVIDENCE_BUCKET.get(row.r2_key);if(!object)return new Response('Not found',{status:404});
  const headers=new Headers();object.writeHttpMetadata(headers);headers.set('cache-control',cacheControl);headers.set('content-disposition',`inline; filename*=UTF-8''${encodeURIComponent(row.file_name||'evidence')}`);return new Response(object.body,{headers});
}

async function syncWorkspaceSnapshotToSheet(env, clientId, integration, accessToken) {
  if (!integration?.spreadsheet_id) throw new Error('Google Sheet is not provisioned');
  const db=env.DB;
  await ensureV100P1Ready(db);
  await ensureV100P2Ready(db);
  await ensureV100P3Ready(db);
  await ensureV100P4Ready(db);
  await ensureV100P5Ready(db);
  await ensureV100P7Ready(db);
  await ensurePhase5Defaults(db,clientId);
  await ensureP7CompanyDefaults(db,clientId);
  await ensureNaknaPhase2SheetTabs(accessToken,integration.spreadsheet_id);
  const [employees,candidates,attendance,leaves,locations,departments,positions,invites,permissions,leavePolicies,leaveBalances,documents,schedules,holidays,hrCases,broadcasts,leaveLedger,payrollProfiles,payrollPeriods,payrollItems,payrollAdjustments,payrollDocuments,employeeDocuments,learningCourses,learningAssignments,kpiGoals,kpiUpdates,oneOnOnes,probationReviews,pointWallets,pointTransactions,pointRules,rewardCatalog,rewardRedemptions,subscriptions,usageSnapshots,billingInvoices,billingPayments,recruitmentEmails,benefitPrograms,benefitEnrollments] = await db.batch([
    db.prepare(`SELECT e.*,d.name AS department_name,p.name AS position_name FROM employees e LEFT JOIN departments d ON d.id=e.department_id LEFT JOIN positions p ON p.id=e.position_id WHERE e.client_id=?1 ORDER BY e.id`).bind(clientId),
    db.prepare(`SELECT * FROM candidates WHERE client_id=?1 ORDER BY id`).bind(clientId),
    db.prepare(`SELECT a.*,wl.name AS location_name FROM attendance a LEFT JOIN work_locations wl ON wl.id=a.checkin_location_id WHERE a.client_id=?1 ORDER BY a.work_date DESC,a.id DESC LIMIT 1000`).bind(clientId),
    db.prepare(`SELECT * FROM leave_requests WHERE client_id=?1 ORDER BY id`).bind(clientId),
    db.prepare(`SELECT * FROM work_locations WHERE client_id=?1 ORDER BY id`).bind(clientId),
    db.prepare(`SELECT * FROM departments WHERE client_id=?1 ORDER BY id`).bind(clientId),
    db.prepare(`SELECT * FROM positions WHERE client_id=?1 ORDER BY id`).bind(clientId),
    db.prepare(`SELECT * FROM employee_invites WHERE client_id=?1 ORDER BY id`).bind(clientId),
    db.prepare(`SELECT * FROM employee_permissions WHERE client_id=?1 ORDER BY employee_id,id`).bind(clientId),
    db.prepare(`SELECT * FROM leave_policies WHERE client_id=?1 ORDER BY sort_order,id`).bind(clientId),
    db.prepare(`SELECT * FROM employee_leave_entitlements WHERE client_id=?1 ORDER BY employee_id,year,leave_policy_id`).bind(clientId),
    db.prepare(`SELECT ev.* FROM leave_request_evidence ev WHERE ev.client_id=?1 ORDER BY ev.id`).bind(clientId),
    db.prepare(`SELECT * FROM work_schedule_rules WHERE client_id=?1 ORDER BY scope_type,scope_id,weekday`).bind(clientId),
    db.prepare(`SELECT * FROM company_holidays WHERE client_id=?1 ORDER BY holiday_date`).bind(clientId),
    db.prepare(`SELECT * FROM hr_cases WHERE client_id=?1 ORDER BY id`).bind(clientId),
    db.prepare(`SELECT * FROM broadcasts WHERE client_id=?1 ORDER BY id`).bind(clientId),
    db.prepare(`SELECT * FROM leave_ledger WHERE client_id=?1 ORDER BY id`).bind(clientId),
    db.prepare(`SELECT pp.*,e.employee_code,e.first_name,e.last_name,e.nickname FROM employee_payroll_profiles pp JOIN employees e ON e.id=pp.employee_id WHERE pp.client_id=?1 ORDER BY e.id`).bind(clientId),
    db.prepare(`SELECT * FROM payroll_periods WHERE client_id=?1 ORDER BY period_start,id`).bind(clientId),
    db.prepare(`SELECT pi.*,e.employee_code,e.first_name,e.last_name,e.nickname FROM payroll_items pi JOIN employees e ON e.id=pi.employee_id WHERE pi.client_id=?1 ORDER BY pi.period_id,e.id`).bind(clientId),
    db.prepare(`SELECT * FROM payroll_adjustments WHERE client_id=?1 ORDER BY period_id,employee_id,id`).bind(clientId),
    db.prepare(`SELECT * FROM payroll_documents WHERE client_id=?1 ORDER BY period_id,employee_id,id`).bind(clientId),
    db.prepare(`SELECT * FROM employee_documents WHERE client_id=?1 ORDER BY employee_id,id`).bind(clientId),
    db.prepare(`SELECT * FROM learning_courses WHERE client_id=?1 ORDER BY id`).bind(clientId),
    db.prepare(`SELECT * FROM learning_assignments WHERE client_id=?1 ORDER BY id`).bind(clientId),
    db.prepare(`SELECT * FROM kpi_goals WHERE client_id=?1 ORDER BY id`).bind(clientId),
    db.prepare(`SELECT * FROM kpi_updates WHERE client_id=?1 ORDER BY id`).bind(clientId),
    db.prepare(`SELECT * FROM one_on_ones WHERE client_id=?1 ORDER BY id`).bind(clientId),
    db.prepare(`SELECT * FROM probation_reviews WHERE client_id=?1 ORDER BY id`).bind(clientId),
    db.prepare(`SELECT w.*,e.employee_code,e.first_name,e.last_name,e.nickname FROM employee_point_wallets w JOIN employees e ON e.id=w.employee_id WHERE w.client_id=?1 ORDER BY e.id`).bind(clientId),
    db.prepare(`SELECT t.*,e.employee_code,e.first_name,e.last_name,e.nickname FROM point_transactions t JOIN employees e ON e.id=t.employee_id WHERE t.client_id=?1 ORDER BY t.id`).bind(clientId),
    db.prepare(`SELECT * FROM point_rules WHERE client_id=?1 ORDER BY id`).bind(clientId),
    db.prepare(`SELECT * FROM reward_catalog WHERE client_id=?1 ORDER BY id`).bind(clientId),
    db.prepare(`SELECT * FROM reward_redemptions WHERE client_id=?1 ORDER BY id`).bind(clientId),
    db.prepare(`SELECT * FROM company_subscriptions WHERE client_id=?1 ORDER BY id`).bind(clientId),
    db.prepare(`SELECT * FROM usage_snapshots WHERE client_id=?1 ORDER BY snapshot_date`).bind(clientId),
    db.prepare(`SELECT * FROM billing_invoices WHERE client_id=?1 ORDER BY id`).bind(clientId),
    db.prepare(`SELECT * FROM billing_payments WHERE client_id=?1 ORDER BY id`).bind(clientId),
    db.prepare(`SELECT * FROM recruitment_email_messages WHERE client_id=?1 ORDER BY received_at DESC,id DESC LIMIT 1000`).bind(clientId),
    db.prepare(`SELECT b.*,COUNT(CASE WHEN e.status='active' THEN 1 END) AS enrolled_count FROM benefit_programs b LEFT JOIN employee_benefit_enrollments e ON e.benefit_id=b.id WHERE b.client_id=?1 GROUP BY b.id ORDER BY b.id`).bind(clientId),
    db.prepare(`SELECT be.*,b.name AS benefit_name,e.employee_code,e.first_name,e.last_name,e.nickname FROM employee_benefit_enrollments be JOIN benefit_programs b ON b.id=be.benefit_id JOIN employees e ON e.id=be.employee_id WHERE be.client_id=?1 ORDER BY be.id`).bind(clientId),
  ]);
  const tableData = {
    'Employees': (employees.results||[]).map(e=>[e.id,e.employee_code,e.first_name,e.last_name,e.nickname,e.email,e.phone,e.department_name,e.position_name,e.manager_employee_id,e.people_status,e.status,e.start_date,e.probation_end_date,e.confirmed_at,e.end_date,e.end_reason,e.line_user_id?'yes':'no']),
    'Candidates': (candidates.results||[]).map(c=>[c.id,c.first_name,c.last_name,c.nickname,c.email,c.phone,c.position_name,c.source,c.expected_salary,c.stage,c.available_start_date,c.last_activity_at,c.notes]),
    'Attendance': (attendance.results||[]).map(a=>[a.id,a.employee_id,a.work_date,a.scheduled_start,a.scheduled_end,a.schedule_source,a.check_in_at,a.check_out_at,a.status,a.late_minutes,a.location_name,a.checkin_lat,a.checkin_lng,a.checkout_outside_geofence,a.source]),
    'Leave Requests': (leaves.results||[]).map(l=>[l.id,l.employee_id,l.leave_type,l.start_date,l.end_date,l.duration_days,l.reason,l.status,l.approver_employee_id,l.evidence_count,l.created_at]),
    'Work Locations': (locations.results||[]).map(w=>[w.id,w.name,w.address,w.latitude,w.longitude,w.radius_m,w.is_active]),
    'Departments': (departments.results||[]).map(d=>[d.id,d.name,d.code,d.manager_employee_id,d.parent_department_id,d.sort_order]),
    'Positions': (positions.results||[]).map(p=>[p.id,p.department_id,p.name]),
    'Invitations': (invites.results||[]).map(i=>[i.id,String(i.token_hint||''),i.department_id,i.position_id,i.start_date,i.max_uses,i.used_count,i.expires_at,i.status]),
    'Approvers': (permissions.results||[]).map(r=>[r.employee_id,r.permission_key,r.created_at]),
    'Leave Policy': (leavePolicies.results||[]).map(p=>[p.id,p.code,p.name,p.default_entitlement_days,p.notice_days,p.evidence_required_after_days,p.is_active]),
    'Leave Balance': (leaveBalances.results||[]).map(b=>{const related=(leaves.results||[]).filter(l=>Number(l.employee_id)===Number(b.employee_id)&&Number(l.policy_id)===Number(b.leave_policy_id)&&String(l.start_date||'').startsWith(String(b.year)));const used=related.filter(l=>l.status==='approved').reduce((s,l)=>s+Number(l.duration_days||0),0);const pending=related.filter(l=>['pending','awaiting_evidence'].includes(l.status)).reduce((s,l)=>s+Number(l.duration_days||0),0);return [b.employee_id,b.year,b.leave_policy_id,b.entitlement_days,b.adjustment_days,used,pending,(Number(b.entitlement_days||0)+Number(b.adjustment_days||0)-used-pending)];}),
    'Documents': (documents.results||[]).map(d=>[d.id,null,'leave_evidence',d.file_name,d.drive_file_id,d.drive_url,d.created_at]),
    'Work Schedules': (schedules.results||[]).map(s=>[s.id,s.scope_type,s.scope_id,s.weekday,s.is_workday,s.start_time,s.end_time,s.late_grace_minutes,s.updated_at]),
    'Company Holidays': (holidays.results||[]).map(h=>[h.id,h.holiday_date,h.name,h.holiday_type,h.is_paid,h.notes]),
    'HR Cases': (hrCases.results||[]).map(c=>[c.id,c.employee_id,c.subject,c.detail,c.priority,c.status,c.submitted_via,c.assigned_user_id,c.hr_note,c.last_reply_to_employee,c.created_at,c.updated_at]),
    'Broadcasts': (broadcasts.results||[]).map(b=>[b.id,b.title,b.message,b.audience_type,b.status,b.total_recipients,b.delivered_count,b.failed_count,b.sent_at,b.created_at]),
    'Leave Ledger': (leaveLedger.results||[]).map(l=>[l.id,l.employee_id,l.leave_policy_id,l.year,l.entry_type,l.days,l.reference_type,l.reference_id,l.note,l.created_at]),
    'Payroll Profiles': (payrollProfiles.results||[]).map(p=>[p.employee_id,p.employee_code,`${p.nickname||p.first_name||''} ${p.last_name||''}`.trim(),p.base_salary,p.social_security_enabled,p.tax_enabled,p.personal_allowance,p.extra_annual_deductions,p.monthly_tax_override,p.bank_name,p.bank_account_name,p.bank_account_no,p.effective_from,p.updated_at]),
    'Payroll Periods': (payrollPeriods.results||[]).map(p=>[p.id,p.period_key,p.period_start,p.period_end,p.pay_date,p.status,p.employee_count,p.gross_total,p.deduction_total,p.net_total,p.locked_at,p.published_at]),
    'Payroll Items': (payrollItems.results||[]).map(i=>[i.id,i.period_id,i.employee_id,i.employee_code,`${i.nickname||i.first_name||''} ${i.last_name||''}`.trim(),i.base_salary,i.prorated_salary,i.absent_days,i.late_minutes,i.attendance_deduction,i.overtime,i.commission,i.incentive,i.allowance,i.bonus,i.other_earnings,i.gross_income,i.social_security,i.withholding_tax,i.other_deductions,i.total_deductions,i.net_pay,i.status]),
    'Payroll Adjustments': (payrollAdjustments.results||[]).map(a=>[a.id,a.period_id,a.employee_id,a.adjustment_type,a.category,a.amount,a.taxable,a.sso_contributable,a.note,a.created_at]),
    'Payroll Documents': (payrollDocuments.results||[]).map(d=>[d.id,d.period_id,d.employee_id,d.document_type,d.file_name,d.drive_file_id,d.drive_url,d.email_sent_at,d.line_notified_at,d.created_at]),
    'Employee Documents': (employeeDocuments.results||[]).map(d=>[d.id,d.employee_id,d.document_type,d.title,d.file_name,d.drive_file_id,d.drive_url,d.document_date,d.visibility,d.note,d.created_at]),
    'Learning Courses': (learningCourses.results||[]).map(c=>[c.id,c.title,c.status,c.audience_type,c.required,c.estimated_minutes,c.passing_score,c.published_at,c.created_at]),
    'Learning Assignments': (learningAssignments.results||[]).map(a=>[a.id,a.course_id,a.employee_id,a.status,a.progress_pct,a.score_pct,a.attempts,a.due_date,a.assigned_at,a.completed_at]),
    'KPI Goals': (kpiGoals.results||[]).map(g=>[g.id,g.cycle_id,g.employee_id,g.title,g.metric_type,g.target_value,g.target_text,g.unit,g.weight,g.update_frequency,g.status,g.created_at]),
    'KPI Updates': (kpiUpdates.results||[]).map(u=>[u.id,u.goal_id,u.employee_id,u.update_date,u.period_key,u.actual_value,u.actual_text,u.progress_pct,u.note,u.source,u.created_at]),
    'One on Ones': (oneOnOnes.results||[]).map(o=>[o.id,o.employee_id,o.manager_employee_id,o.scheduled_at,o.occurred_at,o.status,o.employee_notes,o.manager_notes,o.action_items,o.next_followup_at,o.created_at]),
    'Probation Reviews': (probationReviews.results||[]).map(r=>[r.id,r.employee_id,r.reviewer_employee_id,r.review_date,r.status,r.score,r.strengths,r.improvements,r.manager_comment,r.hr_comment,r.recommendation,r.extension_end_date,r.created_at]),
    'Points Wallet': (pointWallets.results||[]).map(w=>[w.employee_id,w.employee_code,`${w.nickname||w.first_name||''} ${w.last_name||''}`.trim(),w.balance,w.lifetime_earned,w.lifetime_spent,w.updated_at]),
    'Point Transactions': (pointTransactions.results||[]).map(t=>[t.id,t.employee_id,t.employee_code,`${t.nickname||t.first_name||''} ${t.last_name||''}`.trim(),t.rule_id,t.transaction_type,t.points,t.cash_value,t.reference_type,t.reference_id,t.note,t.payroll_adjustment_id,t.created_at]),
    'Point Rules': (pointRules.results||[]).map(r=>[r.id,r.code,r.name,r.event_type,r.points,r.cash_value,r.threshold_count,r.window_days,r.is_active,r.effective_from,r.updated_at]),
    'Reward Catalog': (rewardCatalog.results||[]).map(r=>[r.id,r.title,r.reward_type,r.points_cost,r.cash_value,r.stock_qty,r.status,r.updated_at]),
    'Reward Redemptions': (rewardRedemptions.results||[]).map(r=>[r.id,r.employee_id,r.reward_id,r.points_cost,r.cash_value,r.status,r.employee_note,r.hr_note,r.requested_at,r.decided_at,r.delivered_at,r.payroll_adjustment_id]),
    'Subscriptions': (subscriptions.results||[]).map(s=>[s.id,s.client_id,s.plan_id,s.status,s.billing_cycle,s.trial_started_at,s.trial_ends_at,s.current_period_start,s.current_period_end,s.provider,s.updated_at]),
    'Usage Snapshots': (usageSnapshots.results||[]).map(u=>[u.id,u.snapshot_date,u.active_employee_seats,u.line_connected_seats,u.storage_bytes,u.created_at]),
    'Billing Invoices': (billingInvoices.results||[]).map(i=>[i.id,i.invoice_no,i.period_start,i.period_end,i.active_seats,i.base_fee,i.seat_amount,i.subtotal,i.vat_rate,i.vat_amount,i.total,i.currency,i.status,i.due_date,i.paid_at,i.created_at]),
    'Billing Payments': (billingPayments.results||[]).map(b=>[b.id,b.invoice_id,b.amount,b.method,b.provider,b.provider_payment_id,b.note,b.paid_at]),
    'Recruitment Gmail': (recruitmentEmails.results||[]).map(m=>[m.id,m.gmail_message_id,m.gmail_thread_id,m.sender_name,m.sender_email,m.subject,m.received_at,m.attachment_names,m.candidate_id,m.import_status,m.created_at]),
    'Benefits': (benefitPrograms.results||[]).map(b=>[b.id,b.code,b.name,b.benefit_type,b.description,b.employer_amount,b.employee_amount,b.frequency,b.is_statutory,b.status,b.enrolled_count,b.updated_at]),
    'Benefit Enrollments': (benefitEnrollments.results||[]).map(e=>[e.id,e.benefit_id,e.benefit_name,e.employee_id,e.employee_code,`${e.nickname||e.first_name||''} ${e.last_name||''}`.trim(),e.status,e.start_date,e.end_date,e.note,e.updated_at]),
  };
  const spreadsheetId=integration.spreadsheet_id;
  for(const [sheet,rows] of Object.entries(tableData)){
    await googleApiJson(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(`'${sheet}'!A2:Z`)}:clear`,accessToken,{method:'POST',body:'{}'});
    if(rows.length){
      await googleApiJson(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(`'${sheet}'!A2`)}?valueInputOption=RAW`,accessToken,{method:'PUT',body:JSON.stringify({majorDimension:'ROWS',values:rows})});
    }
  }
  return { spreadsheet_id:spreadsheetId, synced_at:new Date().toISOString() };
}

function columnLetter(count){ let n=Number(count)||1,s=''; while(n>0){n--;s=String.fromCharCode(65+(n%26))+s;n=Math.floor(n/26);} return s; }
function publicGoogleWorkspaceIntegration(row){return {email:row.email,scopes:row.scopes,gmail_enabled:Boolean(Number(row.gmail_enabled)),drive_enabled:Boolean(Number(row.drive_enabled)),sheets_enabled:Boolean(Number(row.sheets_enabled)),drive_folder_id:row.drive_folder_id,leave_evidence_folder_id:row.leave_evidence_folder_id,spreadsheet_id:row.spreadsheet_id,drive_url:row.drive_folder_id?`https://drive.google.com/drive/folders/${row.drive_folder_id}`:null,spreadsheet_url:row.spreadsheet_id?`https://docs.google.com/spreadsheets/d/${row.spreadsheet_id}/edit`:null,last_sync_at:row.last_sync_at,last_error:row.last_error,connected_at:row.connected_at,updated_at:row.updated_at};}
function safeGoogleWorkspaceErrorCode(error){const t=String(error?.message||error);if(/access_denied/i.test(t))return'access_denied';if(/refresh token/i.test(t))return'refresh_token';if(/Drive API|drive\/v3/i.test(t))return'drive_api';if(/sheets.googleapis/i.test(t))return'sheets_api';if(/gmail/i.test(t))return'gmail_api';return'connection_failed';}
function safeGoogleWorkspaceError(error){const code=safeGoogleWorkspaceErrorCode(error);return ({drive_api:'เชื่อม Google Drive ไม่สำเร็จ กรุณาตรวจว่าเปิด Drive API แล้ว',sheets_api:'เชื่อม Google Sheets ไม่สำเร็จ กรุณาตรวจว่าเปิด Sheets API แล้ว',gmail_api:'เชื่อม Gmail ไม่สำเร็จ กรุณาตรวจว่าเปิด Gmail API แล้ว',refresh_token:'Google ไม่ได้ส่ง Refresh Token กรุณาเชื่อมใหม่',connection_failed:'เชื่อม Google ไม่สำเร็จ กรุณาลองใหม่'})[code]||'เชื่อม Google ไม่สำเร็จ';}
function googleWorkspaceErrorRedirect(request,env,code){return redirectResponse(`${appOrigin(request,env)}/?google_workspace_error=${encodeURIComponent(code)}`,[clearCookie('nakna_google_workspace_state')]);}

async function startGmailConnection(request, env) {
  assertGoogleConfig(env);
  if (!env.GOOGLE_TOKEN_ENCRYPTION_KEY) return json({ error: 'GOOGLE_TOKEN_ENCRYPTION_KEY is not configured' }, 500);
  const auth = await authorizeUser(request, env, { requireCompany: false });
  if (!auth.ok) return redirectResponse(`${appOrigin(request, env)}/?auth=required`);

  const state = randomToken(32);
  const stateHash = await sha256Hex(state);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await env.DB.prepare(`INSERT INTO oauth_states (state_hash, purpose, user_id, expires_at) VALUES (?1,'gmail',?2,?3)`)
    .bind(stateHash, Number(auth.user.id), expiresAt).run();

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: oauthRedirectUri(request, env, '/integrations/gmail/callback'),
    response_type: 'code',
    scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
    state,
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    login_hint: String(auth.user.email||'').endsWith('@nakna.local') ? '' : auth.user.email,
  });
  if (!params.get('login_hint')) params.delete('login_hint');
  return redirectResponse(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, [oauthStateCookie('nakna_gmail_state', state, 600)]);
}

async function finishGmailConnection(request, env) {
  assertGoogleConfig(env);
  if (!env.GOOGLE_TOKEN_ENCRYPTION_KEY) return gmailErrorRedirect(request, env, 'config');
  const auth = await authorizeUser(request, env, { requireCompany: false });
  if (!auth.ok) return redirectResponse(`${appOrigin(request, env)}/?auth=required`);

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = getCookie(request, 'nakna_gmail_state');
  if (!code || !state || !cookieState || !constantTimeEqual(state, cookieState)) return gmailErrorRedirect(request, env, 'state');
  const stateHash = await sha256Hex(state);
  const saved = await env.DB.prepare(`SELECT * FROM oauth_states WHERE state_hash=?1 AND purpose='gmail' AND user_id=?2`).bind(stateHash, Number(auth.user.id)).first();
  if (!saved || new Date(saved.expires_at).getTime() <= Date.now()) return gmailErrorRedirect(request, env, 'expired');
  await env.DB.prepare('DELETE FROM oauth_states WHERE state_hash=?1').bind(stateHash).run();

  const tokens = await exchangeGoogleCode(code, oauthRedirectUri(request, env, '/integrations/gmail/callback'), env);
  const profile = await fetchGoogleProfile(tokens.access_token);
  const current = await env.DB.prepare('SELECT encrypted_tokens FROM gmail_connections WHERE user_id=?1').bind(Number(auth.user.id)).first();
  let previous = null;
  if (current?.encrypted_tokens) {
    try { previous = await decryptJson(current.encrypted_tokens, env.GOOGLE_TOKEN_ENCRYPTION_KEY); } catch {}
  }
  const payload = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || previous?.refresh_token || null,
    token_type: tokens.token_type || 'Bearer',
  };
  if (!payload.refresh_token) return gmailErrorRedirect(request, env, 'refresh_token');
  const encrypted = await encryptJson(payload, env.GOOGLE_TOKEN_ENCRYPTION_KEY);
  const accessExpiresAt = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString();

  await env.DB.prepare(`
    INSERT INTO gmail_connections (user_id, google_sub, email, encrypted_tokens, scopes, access_expires_at)
    VALUES (?1,?2,?3,?4,?5,?6)
    ON CONFLICT(user_id) DO UPDATE SET google_sub=excluded.google_sub, email=excluded.email,
      encrypted_tokens=excluded.encrypted_tokens, scopes=excluded.scopes,
      access_expires_at=excluded.access_expires_at, updated_at=CURRENT_TIMESTAMP
  `).bind(Number(auth.user.id), profile.sub || null, profile.email || auth.user.email, encrypted, tokens.scope || '', accessExpiresAt).run();

  return redirectResponse(`${appOrigin(request, env)}/?gmail=connected`, [clearCookie('nakna_gmail_state')]);
}

async function exchangeGoogleCode(code, redirectUri, env) {
  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(`Google token exchange failed: ${data.error || response.status}`);
  return data;
}

async function fetchGoogleProfile(accessToken) {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Google userinfo failed: ${response.status}`);
  return data;
}


const ACCOUNT_ROLE_PRIORITY={owner:100,co_owner:95,hr_admin:90,hr:80,payroll_admin:75,manager:60,approver:50,employee:20,viewer:10};
function strongerAccountRole(a,b){return (ACCOUNT_ROLE_PRIORITY[String(a||'')]||0)>=(ACCOUNT_ROLE_PRIORITY[String(b||'')]||0)?String(a||'employee'):String(b||'employee');}
function isSyntheticNaknaUser(user){return String(user?.email||'').endsWith('@nakna.local')||String(user?.google_sub||'').startsWith('line:');}

async function mergeUserAccounts(env,{sourceUserId,canonicalUserId,preferredClientId=null}={}){
  const sourceId=Number(sourceUserId),canonicalId=Number(canonicalUserId);
  if(!sourceId||!canonicalId||sourceId===canonicalId)return canonicalId;
  await ensureLineBusinessOnboardingReady(env.DB);
  const [source,canonical]=await Promise.all([
    env.DB.prepare('SELECT * FROM users WHERE id=?1').bind(sourceId).first(),
    env.DB.prepare('SELECT * FROM users WHERE id=?1').bind(canonicalId).first(),
  ]);
  if(!source||!canonical)throw new Error('ACCOUNT_MERGE_USER_NOT_FOUND');
  const memberships=(await env.DB.prepare(`SELECT client_id,role,status FROM company_members WHERE user_id=?1 AND status='active'`).bind(sourceId).all()).results||[];
  for(const row of memberships){
    const existing=await env.DB.prepare(`SELECT id,role FROM company_members WHERE user_id=?1 AND client_id=?2 LIMIT 1`).bind(canonicalId,Number(row.client_id)).first();
    if(existing){
      await env.DB.prepare(`UPDATE company_members SET role=?1,status='active',updated_at=CURRENT_TIMESTAMP WHERE id=?2`).bind(strongerAccountRole(existing.role,row.role),Number(existing.id)).run();
    }else{
      await env.DB.prepare(`INSERT INTO company_members (client_id,user_id,role,status) VALUES (?1,?2,?3,'active')`).bind(Number(row.client_id),canonicalId,String(row.role||'employee')).run();
    }
  }
  await env.DB.prepare(`UPDATE company_members SET status='merged',updated_at=CURRENT_TIMESTAMP WHERE user_id=?1 AND status='active'`).bind(sourceId).run();

  const sourceGmail=await env.DB.prepare(`SELECT id FROM gmail_connections WHERE user_id=?1`).bind(sourceId).first().catch(()=>null);
  if(sourceGmail){
    const canonicalGmail=await env.DB.prepare(`SELECT id FROM gmail_connections WHERE user_id=?1`).bind(canonicalId).first().catch(()=>null);
    if(canonicalGmail)await env.DB.prepare(`DELETE FROM gmail_connections WHERE user_id=?1`).bind(sourceId).run().catch(()=>{});
    else await env.DB.prepare(`UPDATE gmail_connections SET user_id=?1,updated_at=CURRENT_TIMESTAMP WHERE user_id=?2`).bind(canonicalId,sourceId).run().catch(()=>{});
  }

  const updateUserRefs=[
    ['auth_sessions','user_id'],['oauth_states','user_id'],['line_web_login_tokens','user_id'],['line_admin_login_tokens','user_id'],
    ['company_onboarding','owner_user_id'],['google_workspace_integrations','connected_by_user_id'],['line_integrations','connected_by_user_id']
  ];
  for(const [table,column] of updateUserRefs){
    try{await env.DB.prepare(`UPDATE ${table} SET ${column}=?1 WHERE ${column}=?2`).bind(canonicalId,sourceId).run();}catch{}
  }
  try{await env.DB.prepare(`UPDATE employee_permissions SET granted_by_user_id=?1 WHERE granted_by_user_id=?2`).bind(canonicalId,sourceId).run();}catch{}

  const lineUserId=canonical.line_user_id||source.line_user_id||null;
  const lineScope=canonical.line_provider_scope||source.line_provider_scope||null;
  const provider=lineUserId?'google+line':(canonical.auth_provider||'google');
  await env.DB.prepare(`UPDATE users SET line_user_id=?1,line_provider_scope=?2,auth_provider=?3,status='active',updated_at=CURRENT_TIMESTAMP WHERE id=?4`)
    .bind(lineUserId,lineScope,provider,canonicalId).run();
  await env.DB.prepare(`UPDATE users SET line_user_id=NULL,line_provider_scope=NULL,auth_provider='merged',status='merged',updated_at=CURRENT_TIMESTAMP WHERE id=?1`).bind(sourceId).run();

  let selected=preferredClientId?Number(preferredClientId):null;
  if(selected){
    const canUse=await env.DB.prepare(`SELECT 1 AS ok FROM company_members WHERE user_id=?1 AND client_id=?2 AND status='active'`).bind(canonicalId,selected).first();
    if(!canUse)selected=null;
  }
  if(!selected){
    const first=await env.DB.prepare(`SELECT client_id FROM company_members WHERE user_id=?1 AND status='active' ORDER BY id DESC LIMIT 1`).bind(canonicalId).first();
    selected=first?.client_id?Number(first.client_id):null;
  }
  await env.DB.prepare(`UPDATE auth_sessions SET selected_client_id=?1,last_seen_at=CURRENT_TIMESTAMP WHERE user_id=?2 AND expires_at>CURRENT_TIMESTAMP`).bind(selected,canonicalId).run();
  AUTH_CACHE.clear();
  return canonicalId;
}

async function promoteLineUserToGoogle(env,user,profile){
  const email=String(profile?.email||'').trim().toLowerCase();
  const sub=String(profile?.sub||'').trim();
  if(!email||!sub)throw new Error('GOOGLE_PROFILE_INVALID');
  await env.DB.prepare(`UPDATE users SET google_sub=?1,email=?2,name=COALESCE(?3,name),picture_url=COALESCE(?4,picture_url),locale=COALESCE(?5,locale),auth_provider=CASE WHEN line_user_id IS NOT NULL THEN 'google+line' ELSE 'google' END,status='active',updated_at=CURRENT_TIMESTAMP WHERE id=?6`)
    .bind(sub,email,profile.name||null,profile.picture||null,profile.locale||null,Number(user.id)).run();
  AUTH_CACHE.clear();
  return Number(user.id);
}

async function linkGoogleProfileToAccount(env,auth,profile){
  await ensureLineBusinessOnboardingReady(env.DB);
  const current=await env.DB.prepare('SELECT * FROM users WHERE id=?1').bind(Number(auth.user.id)).first();
  if(!current)throw new Error('CURRENT_USER_NOT_FOUND');
  const email=String(profile?.email||'').trim().toLowerCase();
  const sub=String(profile?.sub||'').trim();
  if(!email||!sub)throw new Error('GOOGLE_PROFILE_INVALID');
  const existing=await env.DB.prepare(`SELECT * FROM users WHERE id<>?1 AND status='active' AND (google_sub=?2 OR lower(email)=?3) ORDER BY CASE WHEN google_sub=?2 THEN 0 ELSE 1 END,id LIMIT 1`)
    .bind(Number(current.id),sub,email).first();
  let canonicalId;
  if(existing?.id){
    canonicalId=Number(existing.id);
    await mergeUserAccounts(env,{sourceUserId:Number(current.id),canonicalUserId:canonicalId,preferredClientId:auth.clientId});
    if(current.line_user_id&&!existing.line_user_id){
      await env.DB.prepare(`UPDATE users SET line_user_id=?1,line_provider_scope=?2,auth_provider='google+line',updated_at=CURRENT_TIMESTAMP WHERE id=?3`).bind(current.line_user_id,current.line_provider_scope||'default',canonicalId).run();
    }
  }else{
    canonicalId=await promoteLineUserToGoogle(env,current,profile);
  }
  await env.DB.prepare(`UPDATE users SET name=COALESCE(?1,name),picture_url=COALESCE(?2,picture_url),locale=COALESCE(?3,locale),status='active',updated_at=CURRENT_TIMESTAMP WHERE id=?4`)
    .bind(profile.name||null,profile.picture||null,profile.locale||null,canonicalId).run();
  const fresh=await env.DB.prepare('SELECT * FROM users WHERE id=?1').bind(canonicalId).first();
  const member=auth.clientId?await env.DB.prepare(`SELECT role FROM company_members WHERE user_id=?1 AND client_id=?2 AND status='active'`).bind(canonicalId,Number(auth.clientId)).first():null;
  AUTH_CACHE.clear();
  return {...auth,user:fresh,role:member?.role||auth.role,clientId:auth.clientId||null};
}

async function reconcileAccountIdentity(env,auth){
  await ensureLineBusinessOnboardingReady(env.DB);
  let current=await env.DB.prepare('SELECT * FROM users WHERE id=?1').bind(Number(auth.user.id)).first();
  if(!current)return auth;
  let resolvedClientId=auth.clientId?Number(auth.clientId):null;
  if(!isSyntheticNaknaUser(current)){
    const shadow=await env.DB.prepare(`SELECT u.id,g.client_id FROM google_workspace_integrations g JOIN users u ON u.id=g.connected_by_user_id WHERE u.id<>?1 AND u.status='active' AND (g.google_sub=?2 OR lower(g.email)=lower(?3)) ORDER BY g.updated_at DESC LIMIT 1`)
      .bind(Number(current.id),String(current.google_sub||''),String(current.email||'')).first().catch(()=>null);
    if(shadow?.id){
      resolvedClientId=Number(shadow.client_id||resolvedClientId||0)||null;
      await mergeUserAccounts(env,{sourceUserId:Number(shadow.id),canonicalUserId:Number(current.id),preferredClientId:resolvedClientId});
    }
  }else{
    const integration=await env.DB.prepare(`SELECT google_sub,email FROM google_workspace_integrations WHERE connected_by_user_id=?1 AND status='connected' ORDER BY updated_at DESC LIMIT 1`).bind(Number(current.id)).first().catch(()=>null);
    if(integration?.email&&integration?.google_sub){
      const profile={sub:integration.google_sub,email:integration.email,name:current.name,picture:current.picture_url,locale:current.locale};
      return await linkGoogleProfileToAccount(env,auth,profile);
    }
  }
  const fresh=await env.DB.prepare('SELECT * FROM users WHERE id=?1').bind(Number(current.id)).first();
  const member=resolvedClientId?await env.DB.prepare(`SELECT role FROM company_members WHERE user_id=?1 AND client_id=?2 AND status='active'`).bind(Number(current.id),resolvedClientId).first():null;
  return {...auth,user:fresh||auth.user,clientId:resolvedClientId,role:member?.role||auth.role};
}

async function getMemberships(db, userId) {
  // One D1 round-trip instead of CREATE TABLE + membership query + 2-3 owner
  // queries for every company. This endpoint sits on the startup critical path.
  let result;
  try {
    result = await db.prepare(`
      SELECT c.id, c.name, c.code, m.role,
             (SELECT logo_data_url FROM company_assets ca WHERE ca.client_id=c.id) AS logo_data_url,
             (SELECT COUNT(*) FROM employees e WHERE e.client_id=c.id AND e.status!='deleted') AS employee_count,
             (SELECT COUNT(*) FROM departments d WHERE d.client_id=c.id) AS department_count,
             COALESCE(
               (SELECT o.owner_user_id
                  FROM company_onboarding o
                 WHERE o.client_id=c.id
                   AND EXISTS (
                     SELECT 1 FROM company_members om
                      WHERE om.client_id=c.id AND om.user_id=o.owner_user_id
                        AND om.role='owner' AND om.status='active'
                   )
                 LIMIT 1),
               (SELECT om.user_id FROM company_members om
                 WHERE om.client_id=c.id AND om.role='owner' AND om.status='active'
                 ORDER BY om.id LIMIT 1)
             ) AS primary_owner_user_id
      FROM company_members m JOIN clients c ON c.id=m.client_id
      WHERE m.user_id=?1 AND m.status='active'
      ORDER BY m.id
    `).bind(Number(userId)).all();
  } catch (error) {
    // Old workspaces created before company_assets/onboarding existed still get
    // a fast session response instead of forcing runtime schema DDL on every open.
    result = await db.prepare(`
      SELECT c.id, c.name, c.code, m.role,
             NULL AS logo_data_url,
             (SELECT COUNT(*) FROM employees e WHERE e.client_id=c.id AND e.status!='deleted') AS employee_count,
             (SELECT COUNT(*) FROM departments d WHERE d.client_id=c.id) AS department_count,
             (SELECT om.user_id FROM company_members om
               WHERE om.client_id=c.id AND om.role='owner' AND om.status='active'
               ORDER BY om.id LIMIT 1) AS primary_owner_user_id
      FROM company_members m JOIN clients c ON c.id=m.client_id
      WHERE m.user_id=?1 AND m.status='active'
      ORDER BY m.id
    `).bind(Number(userId)).all();
  }
  const rows=result.results||[];
  const counts=new Map();
  for(const row of rows){const key=String(row.name||'').trim().toLowerCase();counts.set(key,(counts.get(key)||0)+1);}
  return rows.map(row=>{
    const primaryOwnerUserId=Number(row.primary_owner_user_id||0)||null;
    const storedRole=String(row.role||'');
    const effectiveRole=(storedRole==='owner'&&primaryOwnerUserId&&primaryOwnerUserId!==Number(userId))?'co_owner':storedRole;
    const {primary_owner_user_id,...publicRow}=row;
    return {...publicRow,stored_role:storedRole,role:effectiveRole,is_primary_owner:Boolean(primaryOwnerUserId&&primaryOwnerUserId===Number(userId)),duplicate_name:(counts.get(String(row.name||'').trim().toLowerCase())||0)>1};
  });
}

async function getClaimableLegacyCompany(db) {
  return db.prepare(`
    SELECT c.id, c.name, c.code
    FROM clients c
    LEFT JOIN company_members m ON m.client_id=c.id AND m.status='active'
    GROUP BY c.id
    HAVING COUNT(m.id)=0
    ORDER BY c.id
    LIMIT 1
  `).first();
}

async function createCompanyForUser(db, auth, name) {
  let code = companyCode(name);
  for (let i = 0; i < 5; i++) {
    const exists = await db.prepare('SELECT id FROM clients WHERE code=?1').bind(code).first();
    if (!exists) break;
    code = `${companyCode(name).slice(0, 12)}-${randomToken(3).toUpperCase()}`;
  }
  const created = await db.prepare(`INSERT INTO clients (name, code, timezone, work_start, work_end) VALUES (?1,?2,'Asia/Bangkok','09:00','18:00')`).bind(name, code).run();
  const clientId = Number(created.meta.last_row_id);
  await db.prepare(`INSERT INTO company_members (client_id, user_id, role, status) VALUES (?1,?2,'owner','active')`).bind(clientId, Number(auth.user.id)).run();
  await db.prepare('UPDATE auth_sessions SET selected_client_id=?1 WHERE token_hash=?2').bind(clientId, auth.sessionHash).run();
  await safeAudit(db, clientId, 'user', String(auth.user.id), 'company.create', 'client', String(clientId), { name, code });
  return { id: clientId, name, code, role: 'owner' };
}

function publicUser(user) {
  const email=String(user.email||'');
  const publicEmail=email.endsWith('@nakna.local')?null:email;
  return {
    id:user.id,
    email:publicEmail,
    name:user.name,
    picture_url:user.picture_url,
    locale:user.locale,
    auth_provider:user.auth_provider|| (publicEmail?'google':'line'),
    line_connected:Boolean(user.line_user_id),
    google_connected:Boolean(publicEmail && !String(user.google_sub||'').startsWith('line:')),
  };
}

function publicCompanyProfile(client){return {id:client.id,name:client.name,code:client.code,timezone:client.timezone,work_start:client.work_start,work_end:client.work_end,late_grace_minutes:Number(client.late_grace_minutes||0)};}
function normalizeTimeHM(value){const t=String(value||'').trim();const m=t.match(/^(\d{1,2}):(\d{2})/);if(!m)return null;const hh=Math.max(0,Math.min(23,Number(m[1]))),mm=Math.max(0,Math.min(59,Number(m[2])));return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;}

function assertGoogleConfig(env) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw new Error('Google OAuth is not configured');
}

function appOrigin(request, env) {
  return String(env.APP_ORIGIN || new URL(request.url).origin).replace(/\/$/, '');
}

function oauthRedirectUri(request, env, path) {
  return `${appOrigin(request, env)}${path}`;
}

function authErrorRedirect(request, env, code) {
  return redirectResponse(`${appOrigin(request, env)}/?auth_error=${encodeURIComponent(code)}`);
}

function gmailErrorRedirect(request, env, code) {
  return redirectResponse(`${appOrigin(request, env)}/?gmail_error=${encodeURIComponent(code)}`);
}

function redirectResponse(location, cookies = []) {
  const headers = new Headers({ location });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 302, headers });
}

function getCookie(request, name) {
  const cookie = request.headers.get('cookie') || '';
  for (const part of cookie.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return '';
}

function sessionCookie(token) {
  return `nakna_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`;
}

function companyCookie(clientId) {
  return `nakna_company=${encodeURIComponent(String(clientId))}; Path=/; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`;
}

function setupModeCookie(mode='new') {
  // Server-readable guard so Business Setup still works even if the browser has
  // a cached frontend bundle from a previous deployment.
  return `nakna_setup_mode=${encodeURIComponent(String(mode))}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 60}`;
}

function oauthStateCookie(name, state, maxAge) {
  return `${name}=${encodeURIComponent(state)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function googleLinkModeCookie(maxAge=600) {
  return `nakna_google_link=1; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function clearCookie(name) {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function withCookie(response, cookie) {
  response.headers.append('Set-Cookie', cookie);
  return response;
}

function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64Url(bytes) {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function encryptJson(value, secret) {
  const keyBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return `${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(ciphertext))}`;
}

async function decryptJson(value, secret) {
  const [ivPart, dataPart] = String(value).split('.');
  if (!ivPart || !dataPart) throw new Error('Invalid encrypted token');
  const keyBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64UrlToBytes(ivPart) }, key, base64UrlToBytes(dataPart));
  return JSON.parse(new TextDecoder().decode(plaintext));
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function companyCode(name) {
  const ascii = String(name).normalize('NFKD').replace(/[^A-Za-z0-9]+/g, '').toUpperCase().slice(0, 12);
  return ascii || `NAKNA-${randomToken(4).toUpperCase()}`;
}

async function getClient(db, id) {
  return db.prepare('SELECT * FROM clients WHERE id=?1').bind(id).first();
}

async function safeAudit(db, clientId, actorType, actorId, action, entityType, entityId, detail) {
  try {
    await audit(db, clientId, actorType, actorId, action, entityType, entityId, detail);
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'audit_write_failed', action, message: String(error?.message || error) }));
  }
}

async function audit(db, clientId, actorType, actorId, action, entityType, entityId, detail) {
  await db.prepare(`
    INSERT INTO audit_logs (client_id, actor_type, actor_id, action, entity_type, entity_id, detail_json)
    VALUES (?1,?2,?3,?4,?5,?6,?7)
  `).bind(clientId || null, actorType, actorId || null, action, entityType, entityId || null, detail ? JSON.stringify(detail) : null).run();
}

function upcomingBirthdays(employees, today, windowDays) {
  const year = Number(today.slice(0, 4));
  const todayDate = new Date(`${today}T00:00:00+07:00`);
  const out = [];
  for (const e of employees) {
    if (!e.birth_date) continue;
    const [, mm, dd] = e.birth_date.split('-').map(Number);
    let next = new Date(`${year}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}T00:00:00+07:00`);
    if (next < todayDate) next = new Date(`${year + 1}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}T00:00:00+07:00`);
    const days = Math.round((next - todayDate) / 86400000);
    if (days <= windowDays) out.push({ id: e.id, name: displayName(e), date: next.toISOString().slice(0,10), days });
  }
  return out.sort((a,b) => a.days - b.days);
}

function calculateLateMinutes(now, workStart, grace) {
  const [h, m] = String(workStart || '09:00').split(':').map(Number);
  const local = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const currentMinutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  return Math.max(0, currentMinutes - (h * 60 + m + grace));
}

function dateInBangkok(date = new Date()) {
  return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function formatBangkokTime(iso) {
  const d = new Date(iso);
  const local = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return `${String(local.getUTCHours()).padStart(2,'0')}:${String(local.getUTCMinutes()).padStart(2,'0')}`;
}

function daysBetween(a, b) {
  return Math.round((new Date(`${b}T00:00:00+07:00`) - new Date(`${a}T00:00:00+07:00`)) / 86400000);
}

function hoursBetween(a, b) {
  const normalize = value => /T|Z/.test(value) ? value : value.replace(' ', 'T') + 'Z';
  return (new Date(normalize(b)) - new Date(normalize(a))) / 3600000;
}

function displayName(e) {
  return e.nickname || e.first_name || e.employee_code || 'Employee';
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const r = 6371000;
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dp/2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function randomDigits(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => String(b % 10)).join('');
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function constantTimeEqual(a, b) {
  const aa = new TextEncoder().encode(String(a));
  const bb = new TextEncoder().encode(String(b));
  let diff = aa.length ^ bb.length;
  const len = Math.max(aa.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (aa[i % aa.length] || 0) ^ (bb[i % bb.length] || 0);
  return diff === 0;
}

function httpError(message, status) {
  const e = new Error(message); e.status = status; return e;
}

async function safeJson(request) {
  try { return await request.json(); } catch { return {}; }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}
