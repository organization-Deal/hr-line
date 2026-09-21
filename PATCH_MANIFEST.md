# Nakna P8.16 — Real Document Forms
Base: P8.15

REPLACE
- src/index.js
- public/app.js

No new migration. Migration 0025 from P8.15 must already be applied.

Fixes
- Real master body templates for 6 document types.
- Fallback catalog is selectable even when Company Template API initially returns empty.
- On Create Draft, system provisions Company Templates server-side and resolves selected master code.
- Company identity remains tenant-scoped at PDF materialization time.
- Document preview describes actual fields and workflow.
