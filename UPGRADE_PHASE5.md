# Upgrade to Nakna HR V1.0-P5

P5 is a **full project release** and already contains Phase 1–4. You do not need to merge older ZIPs.

## P5 adds
- Engagement point wallet, automatic point rules and leaderboard
- Rewards catalog + employee redemption + HR approval/delivery
- Cash-value rewards flow into Payroll as Incentive when the payroll period recalculates
- People Analytics: headcount, turnover, hiring/exits, attendance, department health, recruitment and people moments
- 30-day Free Trial + Active Employee Seat tracking
- Subscription plans, usage snapshots, invoice/payment ledger
- Internal Nakna SaaS Admin Console guarded by `NAKNA_ADMIN_EMAILS`
- Employee Portal Rewards tab and LINE shortcut
- Google Sheet tabs for Phase 5 data

## Database
When upgrading from P4, only these migrations are new:
- `0015_phase5_engagement.sql`
- `0016_phase5_saas.sql`

Always backup/bookmark D1 first, then run:

```bash
npm install
npm run check
npm run db:migrate:remote
npm run deploy
```

## Internal SaaS admin
Add a Worker secret/variable named `NAKNA_ADMIN_EMAILS` containing comma-separated Google account emails that are allowed to see the Nakna Admin Console.

Example value format only:
`owner@example.com,ops@example.com`

Do not commit real admin emails or secrets into the repository.

## Billing safety
P5 provides Trial, seat metering, plans, invoices and manual payment ledger. It does **not** connect a real payment gateway yet. Default plan prices are `0` intentionally; set pricing from Nakna Admin before issuing invoices.

VAT rate is not guessed automatically. Confirm Otterwork's actual VAT/billing requirements before production invoicing.

## Verify
Open `/api/health` after deploy and confirm `version` = `1.0-P5`.
