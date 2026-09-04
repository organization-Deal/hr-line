# P7.74 — Duplicate attendance clarity + fresh GPS

- Duplicate check-in/check-out no longer reuses the original location as if it were the employee current location.
- Quick Attendance shows original attendance point separately from the GPS point checked now.
- LINE duplicate notice says “วันนี้มีเช็กอินแล้ว / ไม่บันทึกซ้ำ” and shows both original and current locations.
- GPS acquisition uses fresh watchPosition fixes (maximumAge=0) and rejects stale browser fixes.
- Quick page separates actual attendance point from configured Work Location.

# P7.73 — Guaranteed Attendance Confirmation
- Quick Attendance now resolves place metadata before saving, so DB/web/LINE show the same location.
- Successful check-in/check-out waits for a LINE push attempt and reports delivery state on the web page.
- LINE push retries once and falls back to the company current OA integration if the employee provider scope is stale.
- Reopening Quick Attendance after an already-saved check-in now reads the saved attendance row and re-sends the confirmation card to LINE.
- Quick Attendance page explicitly shows “ระบบ HR: บันทึกแล้ว” and “LINE: ส่งข้อความแล้ว”.

# P7.72 — LINE Runtime Proof + Hard Remove Manual Location

- Added `/api/public/runtime` and LINE command `เวอร์ชัน` to verify the Worker actually running in production.
- Employee menu visibly stamps `P7.72` and `Quick Attendance`.
- Manual LINE Location handling is fully retired; stale sessions are cleared.
- Quick Attendance accepts the existing employee portal token as fallback if the dedicated attendance token table is unavailable.
- Check-in/out buttons never silently fall back to the legacy manual-location flow.
- Dedicated LINE webhook critical path is lighter.


## V1.0-P7.60
- แสดง Loading กลางหน้าจอสำหรับคำสั่งบันทึก/แก้ไข พร้อมสถานะสำเร็จ/ผิดพลาด
- ปุ่มบันทึก People Profile แสดง spinner และสถานะกำลังบันทึก
- ลดเวลาค้างของสถานะสำเร็จเพื่อให้ UI รู้สึกเร็วขึ้น
- ล้าง focus/text selection หลังบันทึก People Profile เพื่อป้องกัน caret กระพริบบนข้อความ
# Changelog

## V1.0-P7.54 — Department Member Assignment
- เพิ่มปุ่ม `+ พนักงาน` ในการ์ดแต่ละแผนกบนหน้าโครงสร้างทีม
- เลือกพนักงานที่มีอยู่แล้วแบบหลายคนเพื่อเพิ่ม/ย้ายเข้าแผนกได้ทันที
- แสดงคนที่อยู่ในแผนกปัจจุบันเป็นค่าเลือกไว้แล้ว และค้นหาด้วยชื่อ รหัส แผนก หรือตำแหน่งได้
- ป้องกันข้อมูลขัดกันโดยล้างตำแหน่งเดิมอัตโนมัติเมื่อย้ายคนไปแผนกใหม่และตำแหน่งเดิมผูกกับแผนกเก่า
- เพิ่ม API `POST /api/departments/:id/assign` พร้อมสิทธิ์ People Admin และ Audit Log

## V1.0-P7 — Web Business Setup
- เปลี่ยน LINE `เชื่อมธุรกิจ` ให้เปิด Business Setup บนเว็บแทนการพิมพ์ชื่อบริษัทในแชต
- เพิ่ม one-time LINE web login token สำหรับ setup / dashboard
- เพิ่ม onboarding state ต่อ Workspace และ Free Trial 30 วัน
- เพิ่ม Google Workspace setup step: Gmail + Drive + Sheets
- เพิ่ม Recruitment Gmail auto/manual sync + dedupe
- เพิ่ม Benefits catalog + enrollment รายพนักงาน
- เพิ่มหน้า Recruitment Gmail status และหน้าสวัสดิการ
- รองรับ LINE identity เดียวเป็น Employee และ Owner คนละ Workspace


## V1.0-P6 — LINE-first Business Onboarding + Resilient Loading

- ลูกค้าเริ่มจาก LINE OA: พิมพ์ `เชื่อมธุรกิจ` → สร้างธุรกิจ → ได้สิทธิ์ Owner → เปิด HR ด้วยลิงก์ครั้งเดียว
- เพิ่ม LINE magic login อายุ 15 นาที โดยไม่บังคับสมัคร Google ก่อน
- พนักงานไม่สร้าง Workspace เอง ใช้ลิงก์เชิญ/รหัสเชื่อมจาก HR
- เพิ่ม public onboarding config สำหรับปุ่มเปิด LINE จากหน้า Login
- Dashboard เปลี่ยนจาก `Promise.all()` แบบพังทั้งหน้าเป็น partial loading; API ตัวเดียวล้มไม่ทำให้ Skeleton ค้างทั้งระบบ
- เพิ่ม API timeout, visible error banner และปุ่ม Retry
- เพิ่ม migration `0017_line_first_onboarding.sql`


## V1.0-P5 — Engagement + People Analytics + SaaS Business
- Points wallet, rules, automatic attendance/learning/KPI/birthday/anniversary rewards
- Reward catalog, redemption workflow and Payroll incentive bridge
- Employee Portal Rewards + LINE points shortcut
- People Analytics and department health
- 30-day Trial + Active Employee Seat metering
- Subscription plans, invoices, payments and internal SaaS Admin Console
- Google Sheets Phase 5 tabs

## V1.0-P4 — Learning + Performance
- Includes all Phase 1, Phase 2 and Phase 3 features.
- Added Onboarding / Learning Course Builder.
- Added Google Drive video/document modules with private media streaming.
- Added employee Learning Portal opened from LINE.
- Added module progress and video completion tracking.
- Added Quiz Builder, attempts, scoring and pass/fail.
- Added course audience assignment and automatic onboarding assignment for new hires.
- Added KPI goals with daily/weekly/monthly update frequency.
- Added employee KPI updates from the Employee Portal.
- Added Performance Cycles, 1:1 and Probation Review.
- Passing probation updates People lifecycle; extension updates probation end date.
- Added Learning/Performance tabs to Google Sheet sync.

## V1.0-P2 — Leave + Employee Service
- Includes all V1.0-P1 Foundation + People Core features.
- Added company probation leave lock, per-policy probation availability and employee-level leave access override.
- Leave duration now follows effective company/department/employee work schedules and company holidays.
- Added Leave Ledger with pending reservation, release and used entries.
- Approved leave now syncs to Attendance on effective workdays and keeps schedule metadata.
- Employee LINE leave submission now shows remaining leave after the request.
- Added employee company-holiday view in LINE.
- Added `คำขอของฉัน` history in LINE.
- Added confidential `แจ้ง HR` workflow with HR-only dashboard inbox, case status, priority, notes and LINE reply.
- Added company Broadcast to LINE for all / department / selected employees with delivery tracking.
- Added company LINE Rich Menu provisioning from the dashboard using the bundled Nakna CI image.
- Added HR notification after assigned manager/approver decides a leave request.
- Extended Google Sheet sync with HR Cases, Broadcasts and Leave Ledger.

## V1.0-P1 — Foundation + People Core
- Promoted Nakna from V0.6.x patch series into Phase-based product releases.
- Added People lifecycle status and manager hierarchy.
- Added Organization Chart with parent departments and department managers.
- Added company / department / employee work schedule hierarchy.
- Attendance resolves effective schedule and stores schedule source.
- Added company policy to allow Check-out outside geofence with explicit audit flag.
- Added Company Holidays.
- Added Candidate → Employee Probation conversion.
- Extended Google Sheet sync with People Core fields, Work Schedules and Company Holidays.
- Preserved Google Workspace, LINE OA, leave control and approver permission features from V0.6.x.

## V1.0-P3 — Payroll + Documents
- Thailand payroll preview engine
- Salary/bank profile per employee
- Versioned tax + Social Security rules
- Attendance-aware payroll preview
- OT / Commission / Incentive / Allowance / Bonus / deductions
- Draft → Review → Lock → Publish
- Thai PDF payslip
- Google Drive payroll folders
- Gmail payslip attachment delivery
- LINE payslip notification
- Private payslip link
- Employment certificate
- Salary certificate
- Employee Document Center
- Payroll/Document Google Sheet tabs

## V1.0-P7.2 — QA & UX Stability Hotfix
- Prevent login page and restored dialogs from flashing during refresh/session restore.
- Fix every dialog Cancel/X button so HTML required validation cannot trap the user.
- Add missing leave-evidence upload frontend handler.
- Reset reusable modal save button state/label between features.
- Limit dashboard API fan-out to 6 concurrent requests to reduce D1/API pressure.
- Simplify visible Google wording for normal Gmail accounts (Gmail + Drive + Sheets).
- Make employee code optional on manual hire; backend generates a unique code automatically.
- Prefill new employee start date with today.
- Add reproducible static audit script (`npm run audit`).
- No database migration required.

## V1.0-P7.3 — Mobile Setup & Google OAuth Handoff
- Mobile Business Setup uses full-height scrolling instead of centered nested scroll cards.
- LINE mobile detects in-app browser and hands Google OAuth to Safari/Chrome with a one-time 10-minute token.
- Returning from the external browser refreshes Google connection state automatically.
- Boot screen shows a retry action after 7 seconds instead of appearing stuck forever.
- No database migration required.

## V1.0-P7.70 — Quick Attendance
- LINE employee menu Check-in / Check-out now opens a one-tap attendance page directly.
- Browser GPS is requested automatically; employees no longer need to send a LINE Location message.
- Public tokenized attendance endpoint validates employee access, Work Location/geofence, schedule, duplicates, and outside-area policy.
- Successful quick attendance returns immediately in the web UI, then enriches the location and pushes the confirmation Flex back to LINE in the background.
- Added GPS accuracy feedback and retry states for denied/weak location fixes.
- Legacy typed/postback Check-in/Check-out commands now return the quick-attendance entry instead of asking for a Location message.

## V1.0-P7.71 — Quick Attendance hardening
- Added dedicated `attendance_access_tokens` so one-tap attendance no longer depends on Learning token schema.
- Employee menu Check-in / Check-out now prefers direct URI one-tap flow reliably.
- Removed the legacy LINE location quick-reply from all compatibility code paths.
- Clears stale legacy attendance sessions before starting Quick Attendance.
- Added build marker `Quick Attendance P7.71` to the attendance page for deployment verification.
