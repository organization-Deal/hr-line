# Nakna HR — V1.0-P6

**Phase 1 + Phase 2 + Thailand Payroll & Documents + Learning & Performance** for นากนะ (Nakna) by Otterwork Co., Ltd.

This is a **full project ZIP**. It already contains every Phase 1 and Phase 2 file/migration. Do not merge older ZIPs into it.

## V1.0-P6 — LINE-first + Dashboard recovery

ลูกค้าใหม่เริ่มจาก **LINE OA → พิมพ์ `เชื่อมธุรกิจ` → สร้างธุรกิจ → เปิดระบบ HR** โดยผู้สร้างถูกตั้งเป็น Owner อัตโนมัติ และเข้าเว็บด้วย one-time magic link อายุ 15 นาที ส่วนหน้า Dashboard จะไม่ค้าง Skeleton ทั้งหน้าเมื่อ API บางตัวล้มอีกต่อไป แต่จะแสดงข้อมูลที่โหลดได้พร้อม Error Banner + Retry.

ดูขั้นตอน Deploy ที่ `UPGRADE_P6_LINE_FIRST.md`.

## Included from Phase 1
- Google Login + Multi-company Workspace
- LINE OA per company + Nakna fallback OA
- Google Workspace per company: Gmail + Drive + Sheets
- Employee / Candidate database + lifecycle + probation
- Department / Position / Organization Chart / Manager
- Company → department → employee work schedules
- Work Location + geofence + Attendance + Company Holidays
- Approver permissions

## Included from Phase 2
- Leave Policy + entitlement + probation lock + employee override
- Leave Balance / Leave Ledger / half-day / evidence
- Google Drive leave evidence + R2 fallback
- Manager approve/reject in LINE + HR override
- Employee holiday / leave history in LINE
- Confidential HR Case
- Broadcast
- Nakna LINE Rich Menu

# Phase 3 — Thailand Payroll + Documents

## Payroll engine
- Salary profile per employee
- Bank data for payroll preparation
- Payroll period: Draft → Review → Locked → Published
- Attendance-aware preview
- Mid-month join/end proration
- Absence count + late-minute log from Attendance
- **Automatic absence/late deductions are OFF by default** and only activate when HR enables them
- Manual earning/deduction adjustments:
  - OT
  - Commission
  - Incentive
  - Allowance
  - Bonus
  - Other earning
  - Other deduction
- Social Security preview
- Withholding tax preview using a versioned Thai rule engine
- YTD locked/published payroll used in annualized tax estimate
- HR can override monthly withholding tax per employee
- Gross / deductions / net payroll totals
- Lock prevents recalculation and adjustment edits

## Thai defaults shipped in the rule engine
System defaults effective from 2026:
- Salary/wage expense deduction for personal income tax: 50%, capped at THB 100,000/year
- Personal allowance default: THB 60,000/year (employee profile can be adjusted)
- Progressive tax brackets: exempt first THB 150,000, then 5% → 35%
- Social Security section 33 default employee rate: 5%
- Social Security wage ceiling for 2026–2028: THB 17,500

These values live in `payroll_rule_versions`, not hard-coded into the UI, so future rule versions can be added by effective date.

> Payroll values are a **payroll preview / withholding estimate**. Nakna does not claim to be a certified tax filing engine. HR/Payroll should verify employee deductions, special cases, and official filing amounts before Lock/Publish.

## Payslip flow
`Payroll Preview → HR Review → Lock → Publish`

Publish will:
1. Generate a Thai PDF payslip
2. Create/use `Nakna HR / Payroll / YYYY-MM` in the company's Google Drive
3. Upload the PDF to Drive
4. Create a private random payslip link
5. Email the PDF through Gmail when the Google Workspace connection has `gmail.send`
6. Send a Nakna LINE Flex Card to the employee with a private payslip link
7. Store delivery timestamps in D1

The PDF uses a Thai font fetched at runtime from an open-source Noto font URL. Override with `PAYSLIP_FONT_URL` if required.

## Employee Document Center
- Payslip history
- Email delivery status
- LINE notification status
- Employment certificate PDF
- Salary certificate PDF
- Documents stored under the company's Google Drive

## Google Sheets sync adds
- Payroll Profiles
- Payroll Periods
- Payroll Items
- Payroll Adjustments
- Payroll Documents
- Employee Documents

All Phase 1/2 tabs remain.

## Storage model
- **D1** — transactions, tenant/session, payroll calculation state, permissions
- **Google Sheets** — client-readable HR/Payroll snapshot
- **Google Drive** — payslips and HR documents
- **Gmail** — payslip delivery
- **LINE** — employee notification and employee interface
- **R2** — leave evidence fallback

## Required Google APIs
- Gmail API
- Google Drive API
- Google Sheets API

Google Workspace OAuth now requests:
- `gmail.readonly`
- `gmail.send`
- `drive.file`
- `spreadsheets`

**Existing Phase 1/2 Google Workspace connections must click “เพิ่มสิทธิ์ส่ง Gmail” once after Phase 3 deploy** so payslips can be emailed.

## Dependencies
Phase 3 adds:
- `pdf-lib`
- `@pdf-lib/fontkit`

## Deploy

```bash
npm install
npm run check
npm run db:migrate:remote
npm run deploy
```

Health endpoint should return:

```json
{"ok":true,"service":"Nakna HR","version":"1.0-P6","auth":"line-first+google"}
```

Read `UPGRADE_PHASE3.md` and `TEST_CHECKLIST.md` before production use.


# Phase 4 — Learning & Performance

## Learning / Onboarding
- Course Builder
- Video and document storage in Google Drive
- Private Employee Learning Portal from LINE
- Video progress/completion tracking
- Quiz Builder + automatic score/pass/fail
- Assign by company / probation / department / employee
- Auto-assign published onboarding courses to new hires
- LINE notification when a new course is assigned

## KPI / Performance
- Performance cycles
- KPI goals and target progress
- Daily / weekly / monthly updates
- Employee KPI update through LINE Employee Portal
- Manager 1:1 + action items + follow-up
- Probation Review with pass / extend / not pass
- Pass updates employee lifecycle automatically

See `UPGRADE_PHASE4.md` and `PHASE4_TEST_CHECKLIST.md`.

### Manager team-scope note (Phase 4)
For team-scoped Performance / KPI / 1:1 access, the Manager's Nakna web login email should match the email stored on that Manager's employee record. Nakna uses that mapping to resolve the manager employee and restrict team data to self/direct reports.


# Phase 5 — Engagement + SaaS Business

P5 completes the first five-phase Nakna HR core release and contains all previous phases.

## Engagement
- Point wallets per employee
- Automated point rules for attendance streak, course completion, KPI completion, birthday and work anniversary
- Manual HR point award/adjustment
- Optional cash value on point awards; materialized into Payroll Incentive
- Reward catalog, stock, employee redemption, HR approval/reject/delivery and automatic refund on reject
- Employee leaderboard and rewards in the Employee Portal / LINE

## People Analytics
- Active headcount / probation / hires / exits / 90-day turnover
- Late attendance and outside-geofence checkout signals
- Six-month headcount trend
- Department health: headcount, probation, late records, KPI and learning completion
- Recruitment pipeline and upcoming birthday/work-anniversary moments

## Trial / Seats / Billing core
- 30-day default trial
- Active Employee Seat usage snapshots
- Starter / Business / Enterprise plan registry (prices intentionally start at 0)
- Seat limit enforcement on new active employees
- Invoice + payment ledger
- Internal Nakna SaaS Admin Console using `NAKNA_ADMIN_EMAILS`
- No external payment gateway yet; choose a provider before enabling automatic collection

See `UPGRADE_PHASE5.md` and `PHASE5_TEST_CHECKLIST.md`.
