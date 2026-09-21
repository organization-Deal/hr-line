# Nakna P8.18 — Draft Save Fix

Apply on top of P8.17.

## REPLACE
- `src/index.js`
- `public/index.html`

## Migration
- No new migration.
- P8.18 adds a runtime schema guard for Document Workflow tables/columns so missing 0022/0025/0026 pieces are repaired automatically when the feature is used.

## Main fixes
- Self-heal Document Workflow DB schema before template provisioning / Draft creation.
- Draft creation is split into explicit stages: employee → schema → templates → template_lookup → sequence → document_insert → workflow_records.
- Server now returns a useful stage/detail instead of only `Internal server error`.
- Frontend cache key updated to P8.18.0.
