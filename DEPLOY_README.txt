Nakna HR — Remove Nakna Move / Stretch feature
Source base: hr-line-main (2).zip + latest available Nakna Documents Redesign patch.

Changed files:
  public/index.html       Remove sidebar entry and full HR dashboard view.
  public/app.js           Remove view handler, API polling, click handlers and UI renderer.
  public/wellness.html    Retire old links without starting camera or awarding points.
  src/index.js            Remove backend functionality, LINE menu and automated reminders;
                          existing old LINE actions respond with 'feature retired'.
  scripts/verify-move-retired.mjs   Pre-deploy verification script.

HOW TO DEPLOY
1. Extract the ZIP at the root of the hr-line repository (replace changed files).
2. Check: npm run check
3. Check: node scripts/verify-move-retired.mjs
4. For Cloudflare Builds use Deploy command:
   node scripts/verify-move-retired.mjs && npx wrangler deploy
5. Commit and push the changed files to the branch wired to Cloudflare.
6. Refresh the page (Ctrl+Shift+R) and refresh the LINE employee menu by sending 'เมนู'.

NOTE
- No D1 schema changes or destructive deletes; historical wellness/points remain stored.
- Cloudflare cron stays in place for daily HR briefs, attendance reminders and other HR tasks.
- Previously delivered LINE stretch cards can't be recalled, but their buttons no longer
  initiate any activity and they cannot grant new points.
- public/wellness.js and public/wellness.css are inert legacy assets. They are not linked
  from the retired route. They may be deleted in source control separately.
- This package has not been deployed to production. Test with a company account after deploy.
