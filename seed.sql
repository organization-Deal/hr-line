PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO clients (
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
