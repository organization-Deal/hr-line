# Nakna HR V1.0-P3 — Test Checklist

## Regression Phase 1/2
- [ ] Google login works
- [ ] Existing Workspace is visible
- [ ] Existing employees remain
- [ ] Existing LINE links remain
- [ ] Check-in / Check-out work
- [ ] Work Location / geofence works
- [ ] Leave request works
- [ ] Manager can approve/reject leave in LINE
- [ ] HR Cases still work
- [ ] Broadcast still works
- [ ] Google Sheet sync still works

## Payroll setup
- [ ] Payroll page opens for Owner / HR Admin / HR
- [ ] Manager cannot read payroll data
- [ ] Payroll Settings save
- [ ] Salary profile saves
- [ ] Salary/bank readiness count updates
- [ ] Tax override can be blank
- [ ] SSO/tax toggles work per employee

## Payroll period
- [ ] Create YYYY-MM period
- [ ] Duplicate period is blocked
- [ ] Preview generates one item per eligible employee
- [ ] Mid-month employee is prorated
- [ ] Company holiday is not counted as absent
- [ ] Approved paid leave is not counted as absent
- [ ] Unpaid leave can appear in absence count
- [ ] Future workdays are not treated as absence
- [ ] Late minutes come from Attendance
- [ ] No absence deduction occurs while auto deduction is OFF
- [ ] Add Commission
- [ ] Add OT
- [ ] Add Incentive
- [ ] Add Allowance / Bonus
- [ ] Add other deduction
- [ ] Recalculate updates totals

## Lock / Publish
- [ ] Draft → Review works
- [ ] Lock works
- [ ] Locked period cannot recalculate
- [ ] Locked period cannot add adjustment
- [ ] Publish requires Google Workspace
- [ ] Publish creates `Payroll/YYYY-MM` Drive folder
- [ ] PDF payslip generated with Thai text
- [ ] Private `/payslip/<token>` opens PDF
- [ ] Published employee receives LINE card
- [ ] Email sends after Gmail Send permission is granted
- [ ] Email includes PDF attachment
- [ ] Payslip delivery status appears in Document Center

## HR documents
- [ ] Generate employment certificate
- [ ] Generate salary certificate
- [ ] PDF saved to `Employee Documents` in Drive
- [ ] Document Center lists generated file

## Google Sheets
After Sync, verify tabs:
- [ ] Payroll Profiles
- [ ] Payroll Periods
- [ ] Payroll Items
- [ ] Payroll Adjustments
- [ ] Payroll Documents
- [ ] Employee Documents

## Final
- [ ] `/api/health` returns `1.0-P3`
- [ ] Browser console has no fatal error
- [ ] Cloudflare logs have no recurring 500 error
