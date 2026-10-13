import asyncio,json
from pathlib import Path
import os,shutil
from playwright.async_api import async_playwright
from harness import setup
QA=Path(__file__).resolve().parent
async def main():
 results=[];errors=[]
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path=os.environ.get('NAKNA_CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome'),args=['--no-sandbox']);page=await b.new_page(viewport={'width':390,'height':844},reduced_motion='reduce');await setup(page)
  page.on('pageerror',lambda e:errors.append(str(e)));page.set_default_timeout(2000)
  async def check(name,fn):
   try:
    d=await fn();assert d is not False
    results.append({'test':name,'pass':True,'detail':d});print('PASS',name,flush=True)
   except Exception as e:results.append({'test':name,'pass':False,'detail':str(e)});print('FAIL',name,str(e)[:100],flush=True)
  for w in [390,1440]:
   await page.set_viewport_size({'width':w,'height':900 if w>720 else 844})
   for cat in ['company','worktime','attendance','leave','approvals','integrations','payroll','billing']:
    async def catfn(c=cat):
     await page.evaluate('(c)=>{__NKQA.showView("settings");__NKQA.openSettingsCategory(c,{scroll:false})}',c);await page.wait_for_timeout(100)
     return await page.locator(f'[data-settings-category={c}]').is_visible() and await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
    await check(f'Settings {cat} at {w}px',catfn)
  await page.set_viewport_size({'width':390,'height':844})
  for cmd in ['openEmployeeModal()','openCandidateModal()','openDocumentGenerateModal()','openCourseModal()','openKpiModal()','openOneOnOneModal()','openProbationReviewModal()']:
   async def formfn(cmd=cmd):
    await page.evaluate('document.querySelectorAll("dialog[open]").forEach(d=>d.close())')
    await page.evaluate(cmd);await page.wait_for_timeout(100)
    result=await page.locator('dialog[open]').evaluate('''d=>({w:d.getBoundingClientRect().width,screen:innerWidth,label:!!(d.getAttribute('aria-labelledby')||d.getAttribute('aria-label')),inputs:d.querySelectorAll('input,select,textarea').length})''')
    return result['w']<=result['screen']+1 and result['label'] and result['inputs']>0
   await check('Original form opens and fits mobile: '+cmd,formfn)
  await page.evaluate('document.querySelectorAll("dialog[open]").forEach(d=>d.close());__NKQA.showView("payroll")');await page.wait_for_timeout(150)
  async def payedit():
   q=page.locator('.payroll-mobile-card').first
   await q.locator('.nk-payroll-edit>summary').click()
   inp=q.locator('input').first
   fn=await inp.get_attribute('onchange')
   await inp.fill('28.5')
   value=await inp.input_value()
   await inp.blur();await page.wait_for_timeout(350)
   return value=='28.5' and fn=='window.savePayrollManualCell(1,1,\'payable_days\',this)'
  await check('Payroll expandable edit retains input, decimal days and original handler',payedit)
  async def paylock():
   await page.evaluate('__NKQA.state.payrollDetail.period.status="locked";__NKQA.renderPayroll()');await page.wait_for_timeout(150)
   q=page.locator('.payroll-mobile-card').first
   return await q.locator('input').count()==0 and await q.get_by_text('ดูที่มาของตัวเลข',exact=True).is_visible()
  await check('Locked payroll hides editing using original logic; detail remains',paylock)
  await page.evaluate('__NKQA.state.payrollDetail.period.status="draft";__NKQA.renderPayroll()')
  async def grouphead():
   return await page.evaluate('''()=>{const t=document.querySelector('.payroll-sheet');const labels=NaknaUI.columnLabels(t);return labels.includes('วันคิดเงิน')&&labels.includes('เลขบัญชี')&&labels[0]==='พนักงาน'}''')
  await check('Grouped payroll colspan/rowspan column labels mapped correctly',grouphead)
  results.append({'test':'Runtime errors','pass':not errors,'detail':errors})
  (QA/'extended-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2));print('TOTAL',sum(x['pass'] for x in results),'/',len(results));print('errors',errors)
  await b.close()
asyncio.run(main())
