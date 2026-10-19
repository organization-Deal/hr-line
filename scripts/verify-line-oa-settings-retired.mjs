/** Release guard: private LINE OA settings removed, Nakna LINE preserved. */
import fs from 'node:fs';

const html = fs.readFileSync('public/index.html', 'utf8');
const js = fs.readFileSync('public/app.js', 'utf8');
const errors = [];
const mustNotExist = [
  [/id="lineIntegrationShortcut"/, 'LINE OA shortcut still visible'],
  [/class="company-line-section"/, 'LINE OA settings section still exists'],
  [/id="lineConfigureBtn"/, 'LINE OA connect button still exists'],
  [/id="lineIntegrationModal"/, 'LINE OA secret/token modal still exists'],
  [/id="statusLineAction"/, 'LINE OA setup action still exists'],
];
for (const [regex, message] of mustNotExist) if (regex.test(html)) errors.push(message);
for (const id of ['statusLineBadge', 'statusLineText', 'googleWorkspaceSection', 'sidebarLineTitle']) {
  if (!html.includes(`id="${id}"`)) errors.push(`Required UI missing: ${id}`);
}
for (const bad of ["$('#lineIntegrationShortcut')", "$('#lineConfigureBtn')", "$('#statusLineAction')", "$('#copyLineWebhookModalBtn')", 'function openLineIntegrationModal()']) {
  if (js.includes(bad)) errors.push(`Obsolete LINE OA frontend reference: ${bad}`);
}
if (!js.includes('line.default_available')) errors.push('Central LINE availability check missing');
if (!js.includes('NAKNA_OA_SETTINGS_REMOVED_20261019')) errors.push('Updated app.js missing');
if (!html.includes('NAKNA_OA_SETTINGS_REMOVED_20261019')) errors.push('Updated index.html missing');
if (errors.length) {
  console.error('❌ LINE OA removal verification failed:\n' + errors.map(v => ' - ' + v).join('\n'));
  process.exitCode = 1;
} else {
  console.log('✅ LINE OA ของบริษัทถูกนำออกจากหน้า Settings แล้ว');
  console.log('✅ สถานะ LINE นากนะ / Google / ระบบ HR เดิมยังอยู่');
  console.log('✅ ไม่พบปุ่มหรือ Modal เชื่อม OA บริษัท');
}
