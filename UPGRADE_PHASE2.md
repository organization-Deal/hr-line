# Upgrade to Nakna HR V1.0-P2

V1.0-P2 is a full project containing **Phase 1 + Phase 2**. It is designed to upgrade an existing V0.6.x or V1.0-P1 deployment without dropping existing HR data.

## 1. Backup D1 first
Create a D1 backup / bookmark in Cloudflare before applying migrations.

Do not delete:
- the existing D1 database
- `hr-line-evidence-bucket`
- Google OAuth secrets
- LINE secrets
- company Google Workspace connections
- company LINE OA connections

## 2. Replace repository with this ZIP
Use this whole project as the repository contents.

Cloudflare Worker remains:

`hr-line`

App URL remains:

`https://hr-line.organization-23c.workers.dev`

`wrangler.jsonc` keeps the known-working compatibility date `2026-08-20` and existing R2 binding.

## 3. Install + verify syntax

```bash
npm install
npm run check
```

## 4. Apply migrations

```bash
npm run db:migrate:remote
```

Phase 2 adds:
- `0009_phase2_employee_service.sql`
- `0010_phase2_leave_ledger.sql`

They add columns/tables only; they do not DROP Phase 1 tables.

New tables include:
- `hr_cases`
- `hr_case_events`
- `broadcasts`
- `broadcast_deliveries`
- `leave_ledger`

## 5. Deploy

```bash
npm run deploy
```

## 6. Verify health

Open:

`https://hr-line.organization-23c.workers.dev/api/health`

Expected:

```json
{
  "ok": true,
  "service": "Nakna HR",
  "version": "1.0-P2"
}
```

## 7. First login after deploy
The app calls `/api/bootstrap` and safely verifies Phase 2 schema/columns again.

Recommended test order:
1. Existing employees still appear
2. Existing LINE OA connection remains connected
3. Existing Google Workspace connection remains connected
4. Settings → leave during probation
5. Employee leave profile override
6. LINE → request leave
7. Manager approve / reject in LINE
8. LINE → `วันหยุด`
9. LINE → `คำขอของฉัน`
10. LINE → `แจ้ง HR`
11. Web → Employee Service → reply to private HR issue
12. Web → Broadcast → send test to selected employee
13. Web → Rich Menu → set on dedicated company OA
14. Google Workspace → Sync → verify HR Cases / Broadcasts / Leave Ledger tabs

## Google OAuth
Phase 2 does not add a new Google OAuth scope beyond the current company Google Workspace integration.

Keep registered redirect URIs:
- `/auth/google/callback`
- `/integrations/gmail/callback` (legacy personal Gmail route remains for backwards compatibility)
- `/integrations/google-workspace/callback`

Keep enabled APIs:
- Gmail API
- Google Drive API
- Google Sheets API

## Important Rich Menu behavior
The Workspace Rich Menu button intentionally requires a **dedicated company LINE Official Account**. It will not overwrite the shared Nakna default OA for one tenant.
