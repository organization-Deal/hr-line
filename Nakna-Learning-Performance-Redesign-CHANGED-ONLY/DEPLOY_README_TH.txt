NAKNA — Learning & Performance Workspace (19 Oct 2026)
CHANGED-ONLY FILES (3 production files):
 public/index.html
 public/app.js
 public/ui/nk-growth-workspace.css  [NEW]
QA helper:
 scripts/verify-growth-workspace.mjs

INSTALL
1) Backup/commit current repo, especially public/app.js and public/index.html.
2) Unzip so that public/ and scripts/ are at REPO ROOT. Do not place in a nested folder.
3) This release was based on Nakna-HR-BOOT-RECOVERY-CHANGED-ONLY.zip from this chat. The previous boot-recovery UI fixes MUST be present. If your current repo has changes newer than that snapshot, compare/diff rather than blindly overwriting.
4) Verify in Cloudflare build/deploy command:
   node scripts/verify-growth-workspace.mjs && npm run check && npx wrangler deploy
5) Commit/Push and confirm deploy. Hard reload the HR dashboard then enter Learning & KPI.

CHANGES
- Replaces four always-visible empty cards with priority work queue and tabbed modules.
- Adds per-employee profile and linked filter (KPI, Learning, 1:1, Probation) using CURRENT authorized overview endpoints.
- Uses existing buttons/modals for create/update and existing role restrictions.
- Shows recorded data and dates only; no invented approval status or AI scoring.
- No changes to backend, D1, migrations, Google Sheets, LINE API, or permission model.
- Tabs: Overview, KPI, Learning, 1:1, Probation.
- Mobile styling is responsive; no global observers or SPA DOM relocation.

TESTED
- npm run check: pass (all listed JavaScript syntax checks)
- Browser UI: desktop 1440, tablet 768, mobile 390; tabs, employee filters, populated and empty states; no horizontal overflow or pageerrors in isolated UI harness.
- Live Production login, full API data, notification and persistence: NOT TESTED.
- npm run audit fails in ORIGINAL repo because package.json references scripts/audit.mjs, while repository contains scripts/audit.js. This is an existing upstream issue not modified by this patch.

NOT IMPLEMENTED BY THIS UX UPDATE
- KPI approval/rejection workflow (backend does not have a distinct approval endpoint).
- Automated reminder jobs for KPI and learning; action queue uses existing returned data only.
- New database tables or automatic promotion/performance decisions.

ROLLBACK
Revert this commit's public/index.html and public/app.js, remove the new CSS link (and file), and redeploy. No database rollback needed.
