# Nakna P8.17 — Document Form Fix

REPLACE
- public/app.js
- public/index.html
- src/index.js

ADD
- migrations/0026_document_form_data.sql

Deploy order
1. Replace the 3 files above.
2. Run migration 0026_document_form_data.sql.
3. Deploy Worker / Pages.
4. Hard refresh once. `public/index.html` now uses `app.js?v=P8.17.0`, so the browser must load the new frontend instead of the cached P8.15/P8.16 script.
