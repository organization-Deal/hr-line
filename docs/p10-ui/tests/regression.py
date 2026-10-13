import asyncio,json
from pathlib import Path
import os,shutil
from playwright.async_api import async_playwright
from harness import setup
QA=Path(__file__).resolve().parent
async def main():
 results=[];errors=[]
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path=os.environ.get('NAKNA_CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome'),args=['--no-sandbox'])
  page=await b.new_page(viewport={'width':390,'height':844},reduced_motion='reduce')
  page.set_default_timeout(2500)
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('dialog',lambda d:asyncio.create_task(d.accept()))
  await setup(page)
  async def check(name,fn):
   try:
    val=await fn()
    if val is False:raise AssertionError('returned false')
    results.append({'test':name,'pass':True,'detail':val});print('PASS',name,flush=True)
   except Exception as e:results.append({'test':name,'pass':False,'detail':str(e)});print('FAIL',name,str(e)[:250],flush=True)
  async def js(s):return await page.evaluate(s)
  async def nav():
   await page.locator('#nkBottomNav [data-nk-view=employees]').click();await page.wait_for_timeout(80)
   return await page.locator('#view-employees').evaluate('(e)=>e.classList.contains("active")')
  await check('Bottom navigation calls the existing employees route',nav)
  async def drawer():
   await page.locator('#mobileMenuBtn').click();await page.wait_for_timeout(80)
   opened=await js('document.body.classList.contains("mobile-nav-open") && document.querySelector("#nkMain").inert')
   await page.keyboard.press('Escape');await page.wait_for_timeout(80)
   return opened and await js('!document.body.classList.contains("mobile-nav-open") && !document.querySelector("#nkMain").inert')
  await check('Mobile menu opens, Escape closes, background inert restored',drawer)
  async def employee():
   await page.locator('#employeeSearch').fill('DEMO-003');await page.wait_for_timeout(150)
   n=await page.locator('#employeesBody tr').count()
   await page.locator('#employeeSearch').fill('');await page.wait_for_timeout(150)
   row=page.locator('#employeesBody tr').first
   await row.locator('.nk-row-toggle').click();await page.wait_for_timeout(80)
   found=await row.get_by_text('0000000000',exact=True).count()
   await page.screenshot(path=str(QA/'employee-expanded-390.png'),full_page=False)
   return n==1 and found>0 and await row.get_by_text('แก้ไข',exact=True).is_visible()
  await check('Employee search and expanded original actions/data remain available',employee)
  async def employee_save():
   await page.evaluate('window.openEmployeeEdit(1)');await page.wait_for_timeout(150)
   await page.locator('#field-nickname').fill('ชื่อทดสอบ UI')
   preserved=await page.locator('#field-bank_account_no').input_value()
   title=await page.locator('#modal').get_attribute('aria-labelledby')
   await page.screenshot(path=str(QA/'employee-dialog-390.png'),full_page=False)
   await page.locator('#modalSave').click();await page.wait_for_timeout(250)
   saved=await js('window.__apiCalls.findLast(x=>x.url==="/api/employees/1" && x.method==="PATCH")')
   return bool(title and preserved=='0000000000' and saved and json.loads(saved['body'])['nickname']=='ชื่อทดสอบ UI')
  await check('Original employee Save PATCH endpoint/payload and bank zero preserved',employee_save)
  await page.evaluate('document.querySelectorAll("dialog[open]").forEach(d=>d.close())')
  await page.evaluate('__NKQA.showView("leave")');await page.wait_for_timeout(150)
  for tab in ['overview','queue','history','calendar']:
   async def tabfn(t=tab):
    n0=await js('window.__apiCalls.length')
    await page.locator(f'[data-nk-leave-tab={t}]').click();await page.wait_for_timeout(100)
    ok=await page.locator(f'[data-nk-leave-pane={t}]').is_visible()
    n1=await js('window.__apiCalls.length')
    return ok and n0==n1
   await check('Leave tab '+tab+' uses existing data without extra API call',tabfn)
  async def queue():
   await page.evaluate('NaknaUI.setLeaveTab("queue")');await page.wait_for_timeout(100)
   rows=await page.locator('#leaveBody tr').count()
   text=await page.locator('#leaveBody').inner_text()
   await page.screenshot(path=str(QA/'leave-queue-390.png'),full_page=False)
   return rows==2 and 'HR / Owner' not in text and 'อนุมัติ' in text
  await check('Pending queue excludes final history; pending actions still present',queue)
  async def empty_queue():
   await js('__NKQA.state.leaves=__NKFixture.leaves.filter(x=>!["pending","awaiting_evidence"].includes(x.status));__NKQA.renderLeaves()')
   await page.wait_for_timeout(100)
   empty='ไม่มีคำขอรอจัดการ' in await page.locator('#leaveBody').inner_text()
   await js('__NKQA.state.leaves=__NKFixture.leaves;__NKQA.renderLeaves()')
   return empty and await page.locator('#leaveUnifiedDetails tr').count()==8
  await check('Empty pending queue keeps approved/rejected/cancelled history intact',empty_queue)
  async def history():
   await js('NaknaUI.setLeaveTab("history")');await page.wait_for_timeout(100)
   text=await page.locator('#leaveUnifiedDetails').inner_text()
   await page.screenshot(path=str(QA/'leave-history-390.png'),full_page=False)
   return all(x in text for x in ['ลาป่วย','รออนุมัติ','อนุมัติ','ยกเลิก']) and await page.locator('#leaveUnifiedDetails .nk-detail-button').count()==8
  await check('History displays statuses and retains per-request detail entry points',history)
  async def filter(t):
   await page.locator('#nkLeaveFilterPanel').evaluate('(e)=>e.open=true')
   await page.locator('#leaveUnifiedMonth').evaluate('(e)=>e.value="2026-10"')
   await page.locator('#leaveUnifiedDay').evaluate('(e)=>e.value="2026-10-13"')
   await page.locator('#leaveUnifiedFrom').evaluate('(e)=>e.value="2026-10-01"')
   await page.locator('#leaveUnifiedTo').evaluate('(e)=>e.value="2026-10-31"')
   await page.locator('#leaveUnifiedPeriod').select_option(t);await page.wait_for_timeout(150)
   await js('__NKQA.loadLeaveUnified({force:true})')
   req=await js('window.__apiCalls.findLast(x=>x.url.includes("/api/leave-analytics?"))')
   return bool(req and 'period='+t in req['url'])
  for period in ['day','month','year','range','all']:
   await check('Original leave API filter period='+period,lambda t=period:filter(t))
  for cid,value,param in [('leaveUnifiedEmployee','2','employee_id=2'),('leaveUnifiedDepartment','1','department_id=1'),('leaveUnifiedStatus','approved','status=approved'),('leaveUnifiedType','ลาป่วย','type=')]:
   async def selectfn(cid=cid,value=value,param=param):
    await page.locator('#'+cid).select_option(value);await page.wait_for_timeout(150)
    req=await js('window.__apiCalls.findLast(x=>x.url.includes("/api/leave-analytics?"))')
    return param in req['url']
   await check('Original leave filter '+cid,selectfn)
  async def employee_history():
   await js('NaknaUI.setLeaveTab("overview")');await page.wait_for_timeout(80)
   await page.locator('#leaveUnifiedPeople .nk-detail-button').first.click();await page.wait_for_timeout(150)
   return await page.locator('[data-nk-leave-pane=history]').is_visible() and await page.locator('#leaveUnifiedEmployee').input_value()=='1'
  await check('Employee summary opens same report filtered to that employee',employee_history)
  async def labels():
   return await page.locator('#leaveUnifiedDetails tr').first.evaluate('''(r)=>[...r.cells].every(c=>c.dataset.label && getComputedStyle(c).fontSize!=='0px')''')
  await check('Every mobile history cell has a real header label and readable font',labels)
  async def errors_retry():
   await js('window.__savedFetch=fetch;window.fetch=async()=>new Response(JSON.stringify({error:"DEMO_TEST_FAILURE"}),{status:503,headers:{"content-type":"application/json"}})')
   await js('__NKQA.loadLeaveUnified({force:true})');await page.wait_for_timeout(100)
   visible=await page.locator('#leaveUnifiedRetryBtn').is_visible()
   await js('window.fetch=window.__savedFetch')
   await page.locator('#leaveUnifiedRetryBtn').click();await page.wait_for_timeout(100)
   return visible and await page.locator('#leaveUnifiedDetails tr').count()==8
  await check('Report 503 exposes Retry; success restores rows rather than fake zeros',errors_retry)
  async def idle():
   await page.wait_for_timeout(100)
   a=await js('NaknaUI.metrics.flushes');await page.wait_for_timeout(500)
   return await js('NaknaUI.metrics.flushes')==a
  await check('UI observer settles with no render feedback loop',idle)
  async def tabs_keyboard():
   await page.locator('[data-nk-leave-tab=overview]').focus();await page.keyboard.press('ArrowRight');await page.wait_for_timeout(100)
   return await js('document.activeElement.dataset.nkLeaveTab==="queue" && document.activeElement.getAttribute("aria-selected")==="true"')
  await check('ARIA tab keyboard navigation updates focused selected panel',tabs_keyboard)
  await js('__NKQA.showView("settings");__NKQA.showSettingsHome()')
  async def settings():
   await page.get_by_role('button',name='ตั้งค่าบริษัท',exact=False).filter(has=page.locator('.settings-category-copy')).first.click();await page.wait_for_timeout(80)
   visible=await page.locator('#companyProfileInline').is_visible()
   await page.locator('.nk-settings-top button').click();await page.wait_for_timeout(100)
   return visible and await page.locator('#settingsHome').is_visible()
  await check('Settings category opens original form and returns to category hub',settings)
  async def permissions():
   await js('document.querySelector(".sidebar .nav-item[data-view=employees]").classList.add("hidden")');await page.wait_for_timeout(120)
   ok=not await page.locator('#nkBottomNav [data-nk-view=employees]').is_visible()
   await js('document.querySelector(".sidebar .nav-item[data-view=employees]").classList.remove("hidden")')
   return ok
  await check('Mobile shortcut mirrors existing hidden permission state',permissions)
  async def no_fetch():
   a=await js('window.__apiCalls.length');await js('NaknaUI.refresh()');await page.wait_for_timeout(100)
   return await js('window.__apiCalls.length')==a
  await check('Presentation refresh adds zero fetch requests',no_fetch)
  async def ids():
   return await js('(()=>{const a=[...document.querySelectorAll("[id]")].map(e=>e.id);return a.length===new Set(a).size})()')
  await check('No duplicate DOM IDs after all UI interactions',ids)
  async def rm():
   return await js('matchMedia("(prefers-reduced-motion: reduce)").matches && getComputedStyle(document.querySelector(".primary-btn")).transitionDuration.split(",").every(x=>parseFloat(x)<.02)')
  await check('Reduced-motion preference respected',rm)
  results.append({'test':'Browser runtime errors','pass':not errors,'detail':errors})
  print('runtime errors',errors)
  (QA/'interaction-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
  print('TOTAL',sum(x['pass'] for x in results),'/',len(results))
  await b.close()
asyncio.run(main())
