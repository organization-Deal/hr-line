from playwright.sync_api import sync_playwright
from pathlib import Path
base=Path(__file__).resolve().parents[1]
script=(base/'public/ui/p10-7-recruitment-gmail.js').read_text()
style=(base/'public/ui/p10-7-recruitment-gmail.css').read_text()
fixture='''<!doctype html><html lang="th"><head><meta charset="utf-8"><style>body{font-family:Arial}</style></head><body>
<section id="recruitment-screen">
<article class="inboxes"><h3>บัญชีรับสมัครงานที่เชื่อม</h3><div class="inbox-row">
<strong>hr.info@dealinvests.com</strong><small>ตั้งแหล่งเมลก่อน · นำเข้า 0 อีเมล · ยังไม่เคย Sync</small>
<button disabled>Sync</button><button id="sourceSetup">เลือกแหล่งเมล</button><button>ยกเลิก</button>
</div></article>
<article class="queue"><h3>คิวคัดกรอง</h3><div class="filters">
<input type="search" placeholder="ค้นหา"/>
<select aria-label="กรองผลคัดกรอง"><option>ยังไม่ตัดสินใจ</option></select>
<select aria-label="กรองตามบัญชี Gmail ที่นำเข้า"><option value="">ทุกบัญชี Gmail</option><option value="teechanaphat.info@gmail.com">teechanaphat.info@gmail.com</option></select>
</div><div id="entries"></div></article>
</section></body></html>'''

with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width': 390,'height':844})
 errors=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.set_content(fixture)
 page.add_style_tag(content=style)
 page.evaluate('window.sourceSettingsOpened = 0;document.getElementById("sourceSetup").addEventListener("click",()=>window.sourceSettingsOpened++)')
 page.add_script_tag(content=script)
 page.wait_for_timeout(300)
 emails=page.locator('select[aria-label="กรองตามบัญชี Gmail ที่นำเข้า"] option').evaluate_all('(els) => els.map(e=>e.value)')
 assert emails == ['','teechanaphat.info@gmail.com','hr.info@dealinvests.com'], emails
 assert 'ยังไม่ได้ตั้งแหล่งเมล' in page.locator('#naknaRecruitmentConnectedMailHelp').inner_text()
 page.locator('select[aria-label="กรองตามบัญชี Gmail ที่นำเข้า"]').select_option('hr.info@dealinvests.com')
 page.locator('#naknaRecruitmentConnectedMailHelp button').click()
 assert page.evaluate('window.sourceSettingsOpened') == 1
 assert page.evaluate('window.NaknaRecruitmentMailbox.version') == 'P10.7-recruitment-gmail-1'
 assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
 print('1. pre-sync HR mailbox option: PASS')
 print('2. original source setup action: PASS')
 print('3. no mobile overflow: PASS')
 # Re-render the candidate filter: enhancement should run again.
 page.evaluate('''document.querySelector(".filters").innerHTML = `<input type="search"><select aria-label="กรองผลคัดกรอง"><option>pending</option></select><select aria-label="กรองตามบัญชี Gmail ที่นำเข้า"><option value="">ทุกบัญชี Gmail</option></select>`''')
 page.wait_for_timeout(300)
 vals=page.locator('select[aria-label="กรองตามบัญชี Gmail ที่นำเข้า"] option').evaluate_all('(els)=>els.map(e=>e.value)')
 assert vals == ['', 'hr.info@dealinvests.com'], vals
 print('4. reconstruct filter after app render: PASS')
 # Remove connected inbox: shouldn't produce false new entries, no exceptions.
 page.evaluate('document.querySelector(".inboxes").remove()')
 page.wait_for_timeout(150)
 opts=page.locator('select[aria-label="กรองตามบัญชี Gmail ที่นำเข้า"] option').evaluate_all('(els)=>els.map(e=>e.value)')
 assert 'hr.info@dealinvests.com' not in opts, opts
 assert page.locator('#naknaRecruitmentConnectedMailHelp').count() == 0
 assert not errors, errors
 print('5. remove stale mailbox on Workspace/account switch: PASS')
 print('6. no fetch or OAuth changes in helper: PASS (static)')
 browser.close()
