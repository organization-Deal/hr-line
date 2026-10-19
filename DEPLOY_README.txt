NAKNA HR — BOOT RECOVERY (19 Oct 2026)

Root cause found in previous REMOVE-COMPANY-LINE-OA patch:
- public/index.html removed element id="googleWorkspaceShortcut"
- public/app.js still used $('#googleWorkspaceShortcut').onclick in bindEvents()
- Browser error: Cannot set properties of null (setting 'onclick')
- bindEvents() ran before the boot try/catch, trapping startup on the splash screen.

This hotfix:
1. Guards the optional Google shortcut binding.
2. Preserves the removal of company-owned LINE OA configuration UI.
3. Preserves the previous removal of the wellness/stretch feature UI/runtime.
4. Keeps the central Nakna LINE channel and Google workspace features.
5. Adds startup error handling + retry feedback rather than infinite splash.
6. Cache-busts the app.js asset query to NAKNA_BOOT_FIX_20261019A.

FILES TO COPY INTO REPO ROOT (DO NOT NEST FOLDERS):
  public/app.js
  public/index.html
  scripts/verify-boot-fix.mjs

After committing the files to the branch deployed by Cloudflare Workers, use:
  node scripts/verify-boot-fix.mjs && npm run check && npx wrangler deploy

TESTING PERFORMED OFFLINE:
- node --check public/app.js: PASS
- npm run check in original project + patched web files: PASS
- node --test tests/document-management.test.mjs tests/test-public-leave-form.mjs: PASS 53/53
- Headless Chromium on *broken* prior build produced expected null-onclick pageerror.
- Headless Chromium on *fixed* build produced no JS pageerrors during startup, and removed boot splash.
  Smoke tests used no live user authentication or production API responses.

NOT TESTED:
- Real production sign-in or live workspace API, LINE delivery, Google OAuth.
- D1/R2 and secrets remain unchanged.

When the previous deployed site is unusable, optionally roll back to the last known-good
Cloudflare Worker version before deploying this patch.
