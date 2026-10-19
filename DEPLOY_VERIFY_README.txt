Nakna HR — Documents redesign deployment verification, 19 October 2026

The screenshot still shows the old EMPLOYEE DOCUMENTS layout. Cloudflare's successful Worker deploy alone does not prove that the redesign files were included in the deployed commit.

IMPORTANT: Repo ROOT must contain (not nested under hr-line-main/ or a new folder):
  public/index.html
  public/app.js
  public/ui/nk-documents-redesign.css
  src/index.js
  scripts/verify-documents-release.mjs

1) Verify the Cloudflare production branch and commit hash against GitHub.
2) Replace/upload the four code files and one verification script from this ZIP preserving relative folders.
3) Commit them to the exact branch deployed by Cloudflare.
4) Cloudflare settings -> Deploy command:
   node scripts/verify-documents-release.mjs && npx wrangler deploy
5) Deploy; logs must show:
   ✅ Nakna Documents redesign source OK — ready to deploy.
6) Hard reload CTRL+SHIFT+R (or Incognito) and open Documents.
   Expected: DOCUMENT WORKSPACE and four tabs (all/action/templates/payslips).

Inspect Production assets to isolate the issue:
  https://hr-line.organization-23c.workers.dev/ui/nk-documents-redesign.css
  - 404 or HTML instead of CSS means new file is missing from Production.
  https://hr-line.organization-23c.workers.dev/app.js
  - Search for nkdocsRenderTable; missing means old app.js deployed.
  View source of https://hr-line.organization-23c.workers.dev/
  - Search DOCS20261019; missing means old index.html deployed.

This ZIP repeats the four edited files from the previous redesign release plus a new deploy verification script. It does NOT add migrations or alter live HR data. The verification script checks source file identity; it cannot verify live signing or LINE delivery.
