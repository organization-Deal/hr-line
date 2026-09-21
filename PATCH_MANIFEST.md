# Nakna P8.13 — Template & Document Workflow Patch

Apply on top of P8.12.

## REPLACE
- `src/index.js`
- `public/app.js`
- `public/index.html`
- `public/styles.css`

## What changed
- Standard document templates are auto-installed when a company has no templates.
- Standard template set expanded/refined: employment certificate, salary certificate, probation pass, salary adjustment, policy acknowledgement, warning.
- Document generator starts from "document type" cards instead of forcing HR to understand template IDs.
- Flow is now: choose document type → choose employee → review workflow preview → create Draft → HR approve → PDF Final/Drive → acknowledgement when required.
- Warning template clearly recommends HR Case as the source flow.
- Existing "Install standard template" action renamed to "Restore standard templates".

## No migration
P8.13 does not add a database migration. Existing P8.12 schema 0021–0024 is used.

## QA
Tested after applying P8.13 on top of the full P8.12/base project:
- npm run check: PASS
- npm run audit: PASS
- npm run migration:smoke: PASS
- fresh migration chain 0001–0024: PASS
