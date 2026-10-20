from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
P108=(ROOT/'public/ui/p10-8-recruitment-simple.js').read_text()
CSS108=(ROOT/'public/ui/p10-8-recruitment-simple.css').read_text()
P109=(ROOT/'public/ui/p10-9-recruitment-quickstart.js').read_text()
CSS109=(ROOT/'public/ui/p10-9-recruitment-quickstart.css').read_text()

HTML='''<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>body{margin:0;background:#f5f8f7;font-family:Arial,sans-serif}main{width:min(92%,1100px);margin:auto}.account{padding:16px;border:1px solid #d7e3e1;border-radius:18px;display:grid;gap:12px;background:white;margin:16px auto}.buttons{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.buttons button{min-height:40px}dialog{max-width:800px;width:90%;border:0;border-radius:20px}.modal-header,.modal-body,.modal-footer{padding:18px;display:grid;gap:12px}dialog label{display:block}dialog input,dialog select,dialog textarea{width:100%;max-width:100%;box-sizing:border-box}dialog input[type=checkbox]{width:auto}</style></head>
<body><main id="work">
<section class="account" id="hr-card"><div class="a-title"><b>hr.info@dealinvests.com</b><span id="hr-status"> ตั้งแหล่งเมลก่อน</span></div><div class="buttons"><button type="button" id="hr-sync" disabled>Sync</button><button type="button" id="hr-config">เลือกแหล่งเมล</button><button type="button">ยกเลิก</button></div></section>
<section class="account" id="other-card"><div><b>other@example.com</b> พร้อม Sync</div><div class="buttons"><button>Sync</button><button type="button" id="other-config">เลือกแหล่งเมล</button><button>ยกเลิก</button></div></section>
<dialog id="config" class="modal"><header class="modal-header"><h2 id="configTitle">เลือกอีเมลที่ Nakna อ่านจาก hr.info@dealinvests.com</h2></header>
<section class="modal-body"><div class="field"><label>อ่านอีเมลจากส่วนไหนของบัญชีนี้<select id="mode"><option value="recipient" selected>เฉพาะอีเมลที่ส่งถึงที่อยู่ที่ระบุ</option><option value="sender">ผู้ส่ง</option><option value="label">Label</option><option value="query">Query</option><option value="all">อีเมลทุกประเภทใน Inbox</option></select></label></div>
<div class="field"><label>ส่งถึงอีเมลเหล่านี้ (To)<textarea id="to">in:inbox to:hr.info@dealinvests.com newer_than:30d</textarea></label></div>
<div class="field"><label>ย้อนหลังเท่าไหร่<select id="back"><option value="7">7 วัน</option><option value="30">30 วัน</option><option value="90" selected>90 วัน</option></select></label></div>
<div class="field"><label><input id="enabled" type="checkbox">เปิดให้อ่าน Inbox นี้</label></div>
<div class="field"><label><input id="automatic" type="checkbox">Sync อัตโนมัติ (เฉพาะขอบเขตที่เลือก)</label></div>
<div class="field"><h4>ขอบเขตการ Sync</h4><p>newer_than:30d to:in:inbox ...</p></div></section>
<footer class="modal-footer"><button type="button" id="cancel">ยกเลิก</button><button type="button" id="save">บันทึก</button></footer></dialog>
</main>
<script>
window.saved=[];
const dialog=document.querySelector('#config');
document.querySelector('#hr-config').onclick=()=>dialog.showModal();
document.querySelector('#other-config').onclick=()=>{document.querySelector('#configTitle').textContent='เลือกอีเมลที่ Nakna อ่านจาก other@example.com';dialog.showModal();};
document.querySelector('#cancel').onclick=()=>dialog.close();
document.querySelector('#save').onclick=()=>{
  window.saved.push({mode:document.querySelector('#mode').value,to:document.querySelector('#to').value,back:document.querySelector('#back').value,enabled:document.querySelector('#enabled').checked,automatic:document.querySelector('#automatic').checked});
  setTimeout(()=>{document.querySelector('#hr-status').textContent=' พร้อม Sync';document.querySelector('#hr-sync').disabled=false;dialog.close();},90);
};
</script>
</body></html>'''

def main():
  report=[]
  with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width in [320,390,430,768,1440]:
      page=browser.new_page(viewport={'width':width,'height':900});page.set_content(HTML)
      page.add_style_tag(content=CSS108);page.add_style_tag(content=CSS109)
      page.add_script_tag(content=P108);page.add_script_tag(content=P109)
      page.locator('#hr-card .p109-start').wait_for(timeout=5000)
      assert page.locator('#other-card .p109-start').count()==0
      assert page.locator('#hr-config').is_hidden()
      assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'),f'overflow before {width}'
      page.locator('#hr-card .p109-start').click()
      page.wait_for_timeout(600)
      assert len(page.evaluate('window.saved'))==1,page.evaluate('window.saved')
      got=page.evaluate('window.saved[0]')
      assert got == {'mode':'recipient','to':'hr.info@dealinvests.com','back':'30','enabled':True,'automatic':True},got
      assert not page.locator('#hr-sync').is_disabled()
      assert page.locator('#hr-card .p109-start').count()==0,'quick action should disappear after configuration'
      assert page.locator('#hr-config').is_visible()
      assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'),f'overflow after {width}'
      report.append({'width':width,'case':'one-click-activation','result':'pass'})
      if width==390:page.screenshot(path=str(ROOT/'tests/p109_quickstart_mobile.png'),full_page=True)
      page.close()
    # No P10.8 installed: original dialog remains available. No write is attempted.
    page=browser.new_page(viewport={'width':390,'height':850});page.set_content(HTML)
    page.add_style_tag(content=CSS109);page.add_script_tag(content=P109)
    page.locator('.p109-start').click();page.wait_for_timeout(7400)
    assert page.locator('#config').is_visible(),'fallback original form should open'
    assert page.evaluate('window.saved.length')==0,'must not guess/silently save when P10.8 is unavailable'
    assert 'P10.8' in page.locator('#hr-card .p109-note').inner_text()
    report.append({'case':'missing-p108-safe-fallback','result':'pass'})
    page.close()
    # Manual advanced setup remains reachable.
    page=browser.new_page(viewport={'width':390,'height':850});page.set_content(HTML)
    page.add_style_tag(content=CSS108);page.add_style_tag(content=CSS109)
    page.add_script_tag(content=P108);page.add_script_tag(content=P109)
    page.locator('.p109-advanced').click();page.wait_for_timeout(300)
    assert page.locator('#config').is_visible()
    assert page.locator('#mode').is_visible()
    assert page.evaluate('window.saved.length')==0
    report.append({'case':'advanced-original-form','result':'pass'})
    page.close()
    # DOM with no unconfigured account => do not inject into unrelated UI.
    page=browser.new_page(viewport={'width':390,'height':850});page.set_content(HTML.replace(' ตั้งแหล่งเมลก่อน',' พร้อม Sync'))
    page.add_script_tag(content=P109);page.wait_for_timeout(100)
    assert page.locator('.p109-start').count()==0
    report.append({'case':'already-configured-no-duplicate','result':'pass'})
    page.close()
    browser.close()
  print({'tests':len(report),'passed':sum(t['result']=='pass' for t in report),'results':report})
if __name__=='__main__':main()
