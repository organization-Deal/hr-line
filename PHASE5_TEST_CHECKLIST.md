# Nakna HR V1.0-P5 Test Checklist

## Release
- [ ] `npm run check` passes
- [ ] D1 backup/bookmark created
- [ ] remote migrations 0015–0016 applied
- [ ] `/api/health` shows `1.0-P5`

## Engagement
- [ ] Engagement page loads
- [ ] Default point rules exist but start OFF
- [ ] Turn on an attendance rule
- [ ] Manual point award updates employee wallet
- [ ] Employee sees points in Employee Portal
- [ ] Employee can request a reward
- [ ] HR can approve / reject / deliver
- [ ] Reject refunds points exactly once
- [ ] Cash reward creates pending Payroll incentive

## Analytics
- [ ] Headcount matches active Probation/Employee/Leave of absence
- [ ] 6-month trend renders
- [ ] Department metrics render
- [ ] Birthdays / work anniversaries render when applicable

## Trial & Seats
- [ ] Workspace has a 30-day trial
- [ ] Active seat count matches people database
- [ ] Existing employees still work if trial expires
- [ ] Adding active employees is blocked after trial expiration
- [ ] Max seat rule blocks only new seat growth

## SaaS Admin
- [ ] Without `NAKNA_ADMIN_EMAILS`, Admin menu is hidden
- [ ] Authorized email sees Nakna Admin
- [ ] Plan price can be configured
- [ ] Subscription status can be changed
- [ ] Manual invoice payment changes invoice to paid and subscription to active

## Regression P1–P4
- [ ] Google Login
- [ ] LINE webhook / employee linking
- [ ] Check-in / check-out / geofence
- [ ] Leave request / approval / evidence
- [ ] Payroll Preview / Lock / Payslip
- [ ] Google Drive + Sheets sync
- [ ] Learning video / quiz
- [ ] KPI / 1:1 / Probation review
