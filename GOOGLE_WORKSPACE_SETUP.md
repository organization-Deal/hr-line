# Google Workspace Setup — Nakna HR V1.0-P3

Enable these APIs in the existing Google Cloud project:
- Gmail API
- Google Drive API
- Google Sheets API

Keep OAuth Client type: Web application.

Authorized redirect URI:
`https://hr-line.organization-23c.workers.dev/integrations/google-workspace/callback`

Phase 3 company Workspace scopes:
- `openid email profile`
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/drive.file`
- `https://www.googleapis.com/auth/spreadsheets`

Existing Google Workspace integrations from Phase 1/2 need to connect once again after deploy to grant `gmail.send`.

Nakna will keep the existing Drive folder and Spreadsheet IDs when reconnecting; it does not create a new HR database if the existing IDs are present.
