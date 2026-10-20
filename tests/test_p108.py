from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
JS=(ROOT/'public/ui/p10-8-recruitment-simple.js').read_text()
CSS=(ROOT/'public/ui/p10-8-recruitment-simple.css').read_text()
HTML='''<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;background:#f2f6f5;font:16px Arial,sans-serif}.modal{margin:3vh auto;max-width:780px;width:95vw;background:white;border-radius:16px}.modal-header{padding:20px;border-bottom:1px solid #ddd}.modal-body{padding:22px;display:grid;gap:14px}.modal-footer{border-top:1px solid #ddd;padding:15px 20px;text-align:right}label{display:block;padding:5px}select,textarea{display:block;width:90%;height:45px}button{padding:12px}</style></head><body>
<main><div role="dialog" aria-modal="true" class="modal" id="modal">
<header class="modal-header"><h2>เลือกอีเมลที่ Nakna อ่านจาก hr.info@dealinvests.com</h2><p>ไม่ต้องดึงเมลส่วนตัวทั้งหมด</p></header>
<section class="modal-body">
<div class="field"><label>อ่านอีเมลจากส่วนไหนของบัญชีนี้<select id="mode"><option value="recipient" selected>เฉพาะอีเมลที่ส่งถึงที่อยู่ที่ระบุ</option><option value="sender">ผู้ส่ง</option><option value="label">Label</option><option value="query">Query</option><option value="all">อีเมลทุกประเภทใน Inbox (ไม่แนะนำ)</option></select></label></div>
<div class="field"><label>ส่งถึงอีเมลเหล่านี้ (To)<textarea id="to">in:inbox to:hr.info@dealinvests.com newer_than:30d -category:promotions</textarea></label></div>
<div class="field"><label>ย้อนหลังเท่าไหร่<select id="back"><option value="7">7 วัน</option><option value="30">30 วัน</option><option value="90" selected>90 วัน</option><option value="365">365 วัน</option></select></label></div>
<div class="field"><label><input id="enabled" type="checkbox">เปิดให้อ่าน Inbox นี้</label></div>
<div class="field"><label><input id="auto" type="checkbox">Sync อัตโนมัติ (เฉพาะขอบเขตที่เลือก)</label></div>
<div class="field"><h4>ขอบเขตการ Sync</h4><p>newer_than:30d -category:social to:in:inbox to:hr.info@dealinvests.com</p></div>
</section>
<footer class="modal-footer"><button type="button">ยกเลิก</button><button type="button" id="save">บันทึก</button></footer>
</div></main>
<script>window.saved=[];document.getElementById('save').onclick=()=>{window.saved.push({mode:document.getElementById('mode').value,to:document.getElementById('to').value,back:document.getElementById('back').value,enabled:document.getElementById('enabled').checked,auto:document.getElementById('auto').checked});};</script>
</body></html>'''

def main():
  tests=[]
  with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for w in [320,390,430,768,1440]:
      page=browser.new_page(viewport={"width":w,"height":850})
      page.set_content(HTML)
      page.add_style_tag(content=CSS)
      page.add_script_tag(content=JS)
      page.locator('.p108-panel').wait_for()
      assert 'hr.info@dealinvests.com' in page.locator('.p108-panel').inner_text(),f'email absent width={w}'
      assert page.locator('#mode').is_hidden(),f'advanced source visible width={w}'
      assert page.locator('button[data-p108="enable"]').is_visible()
      # Panel cannot create page-wide overflow beyond viewport.
      assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'),f'overflow width={w}'
      page.locator('button[data-p108="enable"]').click()
      page.wait_for_timeout(200)
      saved=page.evaluate('window.saved')
      assert len(saved)==1,saved
      assert saved[0] == {'mode':'recipient','to':'hr.info@dealinvests.com','back':'30','enabled':True,'auto':True},saved
      page.locator('button[data-p108="advanced"]').click()
      assert page.locator('#mode').is_visible(),f'cannot access advanced width={w}'
      page.locator('button[data-p108="advanced"]').click()
      assert page.locator('#mode').is_hidden(),f'cannot close advanced width={w}'
      tests.append({'viewport':w,'result':'pass','saved':saved[0]})
      if w==390:
        page.screenshot(path=str(ROOT/'tests/preview_p108_390.png'),full_page=True)
      page.close()
    # Switching a previously configured sender-only inbox to the safe preset.
    page=browser.new_page(viewport={'width':390,'height':850})
    page.set_content(HTML.replace('<option value="recipient" selected>', '<option value="recipient">').replace('<option value="sender">', '<option value="sender" selected>'))
    page.add_style_tag(content=CSS)
    page.add_script_tag(content=JS)
    page.locator('[data-p108="enable"]').click()
    page.wait_for_timeout(150)
    record=page.evaluate('window.saved[0]')
    assert record['mode']=='recipient' and record['to']=='hr.info@dealinvests.com',record
    tests.append({'case':'sender-to-safe-preset','result':'pass'})
    page.close()
    # If required original Save is disabled, fail open and keep all original controls available.
    page=browser.new_page(viewport={'width':390,'height':850})
    page.set_content(HTML.replace('id="save">บันทึก', 'id="save" disabled>บันทึก'))
    page.add_style_tag(content=CSS)
    page.add_script_tag(content=JS)
    page.locator('[data-p108="enable"]').click()
    page.wait_for_timeout(150)
    assert page.locator('#mode').is_visible()
    assert page.evaluate('window.saved.length')==0
    assert 'ปุ่มบันทึก' in page.locator('[data-p108="status"]').inner_text()
    tests.append({'case':'disabled-save-safe-fallback','result':'pass'})
    page.close()
    # No Gmail account title => do not guess a mailbox or mutate UI
    page=browser.new_page(viewport={'width':390,'height':850})
    page.set_content(HTML.replace('hr.info@dealinvests.com</h2>', 'บัญชีไม่ทราบชื่อ</h2>'))
    page.add_script_tag(content=JS)
    page.wait_for_timeout(150)
    assert page.locator('.p108-panel').count() == 0
    tests.append({'case':'unknown-account','result':'pass'})
    browser.close()
  print('RESULTS',len(tests),'PASS')
  print(tests)
if __name__=='__main__':main()
