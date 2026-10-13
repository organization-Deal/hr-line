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
  page.on('pageerror',lambda e:errors.append(str(e)))
  await setup(page)
  views=await page.locator('.view[id]').evaluate_all('(es)=>es.map(e=>e.id.slice(5))')
  for w in [320,390,430,768,1024,1440]:
   await page.set_viewport_size({'width':w,'height':900 if w>720 else 844})
   for v in views:
    await page.evaluate('(v)=>__NKQA.showView(v)',v);await page.wait_for_timeout(80)
    item=await page.evaluate('''() => ({width:innerWidth,view:document.querySelector('.view.active')?.id,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth,height:document.querySelector('.view.active')?.getBoundingClientRect().height})''')
    item['pass']=item['scroll']<=w+1
    results.append(item)
    if not item['pass']:print('OVERFLOW',item,flush=True)
    if w in [390,1440] and v in ['dashboard','employees','leave','payroll','settings','organization','attendance','documents','recruitment','growth','engagement','analytics','wellness','broadcast','hr-inbox']:
     await page.screenshot(path=str(QA/f'{v}-{w}.png'),full_page=False)
   print('width',w,'complete',flush=True)
  print('errors',errors);print('render errors',await page.evaluate('window.__NKRenderErrors'))
  print('views',views)
  (QA/'viewport-results.json').write_text(json.dumps({'results':results,'page_errors':errors,'render_errors':await page.evaluate('window.__NKRenderErrors'),'views':views},ensure_ascii=False,indent=2))
  await b.close()
asyncio.run(main())
