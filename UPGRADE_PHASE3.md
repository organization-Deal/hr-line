# Upgrade — Nakna HR V1.0-P3

V1.0-P3 is a **full project** containing Phase 1 + Phase 2 + Phase 3.

## 1. Backup D1
Create a Cloudflare D1 bookmark/backup first.

Do not delete the current:
- D1 database
- R2 bucket
- Google secrets
- LINE secrets
- Google Workspace integration
- LINE OA integrations

## 2. Replace repository contents
Use this ZIP as the full repository.

## 3. Install dependencies

```bash
npm install
npm run check
```

Phase 3 adds `pdf-lib` and `@pdf-lib/fontkit` for Thai PDF generation.

## 4. Migrate D1

```bash
npm run db:migrate:remote
```

New migrations:
- `0011_phase3_payroll.sql`
- `0012_phase3_documents.sql`

They only add new payroll/document tables. They do not DROP Phase 1/2 data.

## 5. Deploy

```bash
npm run deploy
```

## 6. Confirm health
Expected `/api/health` version: `1.0-P3`.

## 7. Reconnect Google Workspace once
Phase 3 needs `gmail.send` for automatic payslip email.

Settings → Google Workspace → **เพิ่มสิทธิ์ส่ง Gmail**

The redirect URI stays the same:
`/integrations/google-workspace/callback`

No new Google Cloud project is required.

## 8. Payroll setup order
1. Payroll → ตั้งค่า Payroll
2. Set salary profile for each employee
3. Check bank details
4. Create pay period
5. Review Attendance / absent / late data
6. Add OT / Commission / Incentive / Allowance / Bonus as needed
7. Recalculate
8. Review tax + Social Security preview
9. Lock
10. Publish
11. Confirm Drive PDF + Email + LINE

## Safe defaults
- Auto absence deduction: OFF
- Auto late deduction: OFF
- Tax preview: ON
- Social Security preview: ON

This prevents Nakna from automatically docking pay solely because of an Attendance status until HR explicitly enables the company's rule.
