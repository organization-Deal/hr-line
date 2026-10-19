/* Nakna Documents Release Gate — prevents green deploys from the wrong source tree. */
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const failures = [];
const checks = [
  ['public/index.html', ['DOCUMENT WORKSPACE', 'id="nkdocs-panel-all"', '/ui/nk-documents-redesign.css?v=DOCS20261019', '/app.js?v=DOCS20261019']],
  ['public/app.js', ['const nkdocsUi=', 'function nkdocsRenderTable()', 'function nkdocsSelectTab(', 'window.openNaknaDocumentDetail', 'function nkdocsShowWizardStep(']],
  ['public/ui/nk-documents-redesign.css', ['nkdocs-table', 'nkdocs-tabs', '#view-documents']],
  ['src/index.js', ['documentHistoryMatch=', '/history$', 'created_by_name']],
];
for (const [filename, markers] of checks) {
  const file = path.join(root, filename);
  if (!fs.existsSync(file)) { failures.push(`${filename}: MISSING`); continue; }
  const source = fs.readFileSync(file, 'utf8');
  for (const marker of markers) {
    if (!source.includes(marker)) failures.push(`${filename}: missing ${JSON.stringify(marker)}`);
  }
  console.log(`[check] ${filename}: ${markers.every(m=>source.includes(m))?'OK':'INCOMPLETE'}`);
}
if (failures.length) {
  console.error('\n❌ Nakna Documents redesign source is incomplete. DEPLOY BLOCKED.');
  failures.forEach(x=>console.error('  - '+x));
  console.error('Check Cloudflare production branch and copy the provided public/ and src/ folders to the REPOSITORY ROOT.');
  process.exit(1);
}
console.log('\n✅ Nakna Documents redesign source OK — ready to deploy.');
