import fs from 'node:fs';
const read = p => fs.readFileSync(p, 'utf8');
const index=read('public/index.html');
const app=read('public/app.js');
const worker=read('src/index.js');
const css=read('public/ui/nk-leave-settings.css');
const checks={
  htmlTabs:['data-nk-leave-tab="holidays"','data-nk-leave-tab="policies"','data-nk-leave-tab="probation"'].every(x=>index.includes(x)),
  yearFilter:index.includes('id="holidayYearSelect"'),
  reloadButton:index.includes('reloadCompanyHolidays()'),
  cssLoaded:index.includes('/ui/nk-leave-settings.css?v=LEAVE20261020A'),
  cacheBust:index.includes('/app.js?v=NAKNA_LEAVE20261020A'),
  directRead:worker.includes("path==='/api/company-holidays' && method==='GET'"),
  queryTenantScoped:worker.includes('FROM company_holidays WHERE client_id=?1 ORDER BY holiday_date,id'),
  directRefresh:app.includes("api('/api/company-holidays',{timeoutMs:15000,silentStatus:true})"),
  safeRenderOnSettings:app.includes('renderSettings(); renderSettingsSidebar(); renderCompanyHolidays();'),
  fallbackPreservation:app.includes('holidayUi.error=String(error?.message'),
  saveRefreshing:app.includes("await refreshCompanyHolidays();toast('เพิ่มวันหยุดบริษัทแล้ว')"),
  cssScoped:css.includes('.nk-leave-settings .nk-leave-panel'),
};
for(const [check,passed] of Object.entries(checks)) console.log(`${passed?'✓':'✗'} ${check}`);
if(Object.values(checks).some(x=>!x)){ console.error('❌ Nakna holiday patch missing required code. Do not deploy.');process.exit(1); }
console.log('✅ Nakna Leave Settings + Company Holidays verified');
