import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('public/index.html');
const js = read('public/app.js');
const css = read('public/ui/nk-employee-service.css');
const view = html.match(/<section id="view-requests"[\s\S]*?<section id="view-payroll"/i)?.[0];
assert(view, 'Missing Employee Service view');
for (const id of ['requestCountBadge','createBroadcastBtn','hrCaseOpenCount','nkServiceUrgentCount','broadcastTotalCount','hrCasesList','requestsList','broadcastList','nkServicePanelCases','nkServicePanelBroadcast','nkServicePanelLine','nkServiceCaseSearch','nkServiceCaseStatus','nkServiceBroadcastSearch','nkServiceBroadcastStatus','richMenuStatusText','setupRichMenuBtn','removeRichMenuBtn']) {
  assert(view.includes(`id="${id}"`), `Missing existing binding: ${id}`);
}
for (const id of ['nkServiceTabCases','nkServiceTabBroadcast','nkServiceTabLine']) assert(view.includes(`id="${id}"`), `Missing service tab ${id}`);
assert(html.includes('/ui/nk-employee-service.css?v='),'Missing stylesheet cache-busted URL');
assert(/app\.js\?v=NAKNA_SERVICE/.test(html),'Missing app.js cache-busted URL');
assert(js.includes("window.nkServiceSelectTab=function(name)"),'Missing tab controller');
assert(js.includes('isHr?load(\'/api/hr-cases\''),'Private HR API must be role-restricted');
assert(js.includes('canReadBroadcasts?load(\'/api/broadcasts\''),'Missing broadcast refresh');
assert(css.includes('#hrInboxNav, #broadcastNav{display:none!important}'),'Duplicate sidebar navigation still visible');
assert(css.includes('.nk-service-view .nk-service-metric[hidden]'),'Role-aware private metrics styling missing');
assert(!view.includes('ตั้ง Rich Menu ให้ LINE บริษัท</button>'),'Deprecated company OA setup visible in workspace');
console.log('✅ Nakna Employee Service redesign: static release checks passed');
