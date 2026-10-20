# Nakna P10.9 — QA (offline)

- Chromium Playwright fixture: **8/8 PASS**
- Widths: 320, 390, 430, 768, 1440 CSS px
- P10.8 safe preset: `recipient`, To = `hr.info@dealinvests.com` (not a Gmail query), 30d, enabled, auto_sync
- Simulated server save/activation: successful; account card immediately shows Sync unlocked
- Multiple Gmail: configured account untouched; only clicked account receives activation
- No P10.8 script: no hidden write, original setup modal accessible
- Advanced settings accessible through existing modal
- Installer: dry-run, apply, repeated apply (idempotent), rollback **4/4 PASS**
- JS syntax: PASS

Limitations: All tests offline with mock data / mock Save callback. Real Cloudflare Worker, Gmail API, permissions and Production data were not accessed or changed. Server-side save errors must be inspected separately if card remains unconfigured.
