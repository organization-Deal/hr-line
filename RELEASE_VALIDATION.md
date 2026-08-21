# Release Validation — V1.0-P5

Validation performed before packaging:
- JavaScript syntax check: Worker + Dashboard + Invite + Employee Portal
- Fresh SQLite migration test: 0001 → 0016
- Upgrade migration test: P4 0001 → 0014, then P5 0015 → 0016
- Phase 5 subscription seed verified: trial / starter / business / enterprise
- HTML duplicate ID check
- Dashboard static selector check (dynamic modal selectors excluded)
- Employee Portal rewards route wired to P5 backend

Billing note: no external payment gateway is included in P5; invoice/payment ledger is manual until a provider is selected.
