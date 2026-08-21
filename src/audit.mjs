import fs from 'node:fs';

const html = fs.readFileSync('public/index.html', 'utf8');
const js = fs.readFileSync('public/app.js', 'utf8');
const fail = [];
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
if (duplicates.length) fail.push(`duplicate ids: ${[...new Set(duplicates)].join(', ')}`);

const bindBlock = js.match(/function bindEvents\(\) \{([\s\S]*?)\n\}/)?.[1] || '';
const boundIds = [...bindBlock.matchAll(/\$\('#([^']+)'\)/g)].map(m => m[1]);
const idSet = new Set(ids);
const missingBound = [...new Set(boundIds)].filter(id => !idSet.has(id));
if (missingBound.length) fail.push(`bindEvents missing DOM ids: ${missingBound.join(', ')}`);

const inlineHandlers = [...html.matchAll(/(?:onclick|onchange|oninput)="[^"]*window\.([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]);
const missingHandlers = [...new Set(inlineHandlers)].filter(name => !new RegExp(`window\\.${name}\\s*=`).test(js));
if (missingHandlers.length) fail.push(`inline window handlers missing definitions: ${missingHandlers.join(', ')}`);

const unsafeCancel = [...html.matchAll(/<button(?![^>]*\btype="button")[^>]*\bvalue="cancel"[^>]*>/g)].map(m => m[0]);
if (unsafeCancel.length) fail.push(`${unsafeCancel.length} dialog cancel buttons can trigger form validation`);

for (const required of ['id="bootSplash"','id="login" class="login-overlay hidden"','id="appShell" class="app-shell hidden"','window.uploadLeaveEvidence =']) {
  if (!(html.includes(required) || js.includes(required))) fail.push(`missing stability guard: ${required}`);
}

if (fail.length) {
  console.error('AUDIT FAILED');
  for (const item of fail) console.error(`- ${item}`);
  process.exit(1);
}
console.log(`AUDIT PASS · ${ids.length} DOM ids · ${new Set(boundIds).size} bound controls · ${new Set(inlineHandlers).size} inline handlers`);
