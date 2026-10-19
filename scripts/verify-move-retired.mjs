import fs from 'node:fs';
const read = (p) => fs.readFileSync(p, 'utf8');
const html = read('public/index.html');
const app = read('public/app.js');
const worker = read('src/index.js');
const oldPage = read('public/wellness.html');
const checks = {
  'sidebar ไม่มีเมนูพักยืด': !html.includes('data-view="wellness"'),
  'ไม่มีหน้า Wellness ใน Dashboard': !html.includes('id="view-wellness"'),
  'JS Dashboard ไม่เรียก wellness API': !app.includes('/api/wellness/overview'),
  'JS Dashboard ไม่ผูกปุ่ม wellness': !app.includes('renderWellness('),
  'API public ปิด (410)': worker.includes("url.pathname.startsWith('/api/public/wellness/')") && worker.includes("code:'WELLNESS_RETIRED'"),
  'API ภายในปิด (410)': worker.includes("path.startsWith('/api/wellness/')"),
  'Cron ไม่ส่งพักยืด': !worker.includes('runWellnessReminderAutomation(') && !worker.includes('runWellnessTestAutomation('),
  'LINE ไม่มีปุ่มพักยืด': !worker.includes("lineSecondaryButton('🧘  พักยืด 3 นาที'"),
  'LINE ไม่มีลิงก์ wellness': !worker.includes('wellnessUrl'),
  'ลิงก์เก่าไม่เปิดกล้อง': oldPage.includes('ปิดให้บริการแล้ว') && !oldPage.includes('wellness.js') && !oldPage.includes('<video'),
  'หน้าเอกสาร HR เดิมยังอยู่': html.includes('id="view-documents"'),
  'Payroll ยังอยู่': html.includes('id="view-payroll"'),
};
let failures = 0;
for (const [label, ok] of Object.entries(checks)) {
  console.log(`${ok ? '✅' : '❌'} ${label}`);
  if (!ok) failures += 1;
}
if (failures) {
  console.error(`❌ Nakna Move retirement verification failed: ${failures} checks`);
  process.exitCode = 1;
} else {
  console.log('✅ Nakna Move removed from live UI, LINE, API, and scheduled jobs.');
}
