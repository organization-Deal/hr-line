# Nakna P8.14 Template Hotfix
Base: P8.13

REPLACE:
- public/app.js
- src/index.js

No database migration.

Changes:
- Standard document templates are ensured server-side when Document Center loads.
- Existing customized standard templates are NOT overwritten during normal loading.
- Manual Restore Standard Templates still restores defaults intentionally.
- Document modal no longer stays on “กำลังเตรียม Template มาตรฐาน”.
- If templates/API fail, the six document categories remain visible with a clear retry/error state.
- Preview shows the data source and workflow before Draft creation.
