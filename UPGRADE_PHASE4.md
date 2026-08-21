# Upgrade to Nakna HR V1.0-P4

V1.0-P4 is a **full project release**. It already contains Phase 1, Phase 2 and Phase 3.

## Phase 4 adds
- Onboarding / Learning Course Builder
- Video & document media stored in the company's Google Drive
- Employee Learning Portal with private 30-day token links
- Video completion tracking
- Quiz Builder + automatic scoring + pass/fail
- Course assignment: all / probation / department / selected employees
- Automatic course assignment for new employees when a published course targets their audience
- LINE Learning & KPI menu + new-learning notification
- KPI goals with daily / weekly / monthly / one-time update frequency
- Employee KPI updates from the same LINE Employee Portal
- Performance cycles
- 1:1 notes + action items + follow-up
- Probation Review: pass / extend / not pass
- Passing probation automatically changes People status to Employee
- Extending probation updates probation end date
- Google Sheet sync tabs for Learning and Performance

## Safe upgrade from P3
1. Back up / bookmark the D1 database.
2. Replace the repository with this full ZIP.
3. Keep the existing Cloudflare secrets.
4. Run:

```bash
npm install
npm run check
npm run db:migrate:remote
npm run deploy
```

Only migrations `0013_phase4_learning.sql` and `0014_phase4_performance.sql` are new when upgrading from P3.

## Health check
Open `/api/health` and confirm `version` is `1.0-P4`.

## Google Workspace
No new OAuth scopes are required beyond the Phase 3 Google Workspace connection. Training videos/documents are stored in the existing Nakna HR Drive root under:

`Onboarding Training / Course-<id> - <course name>`

Media is streamed to the employee through Nakna using the company's Google Drive OAuth token. Drive files do not need to be made public.
