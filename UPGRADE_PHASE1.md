# Upgrade to Nakna HR V1.0-P1

This release is designed to upgrade the current V0.6.x project **without deleting existing D1 data**.

## 1. Backup first
Before migration, create a D1 backup/bookmark from Cloudflare.

Do not delete the existing D1 database, R2 bucket, Google OAuth credentials or LINE secrets.

## 2. Replace repository files
Upload this full project over the current repository.

The Worker name remains:

`hr-line`

The production app base URL remains:

`https://hr-line.organization-23c.workers.dev`

## 3. Apply migrations
Run:

```bash
npm install
npm run db:migrate:remote
```

New migration:

`migrations/0008_phase1_people_core.sql`

It adds People Core columns and creates:
- `work_schedule_rules`
- `company_holidays`

It does not DROP existing HR tables.

## 4. Deploy

```bash
npm run deploy
```

## 5. Verify
Open:

`https://hr-line.organization-23c.workers.dev/api/health`

Expected:

```json
{
  "ok": true,
  "service": "Nakna HR",
  "version": "1.0-P1"
}
```

## 6. Log in and let Bootstrap run
After login the app calls `/api/bootstrap`. Runtime bootstrap also safely checks missing Phase 1 columns/tables for existing databases.

## 7. Phase 1 setup order
Recommended order inside Settings:
1. Company Profile
2. Google Workspace
3. LINE Official Account
4. Organization / Departments
5. Work Schedule
6. Work Location / Geofence
7. Company Holidays
8. Invite employees

## Google OAuth
Keep these redirect URIs registered:
- `/auth/google/callback`
- `/integrations/gmail/callback`
- `/integrations/google-workspace/callback`

Required APIs:
- Gmail API
- Google Drive API
- Google Sheets API

## Important
`wrangler.jsonc` in this ZIP preserves the known working R2 bucket binding and compatibility date used by the current project.
