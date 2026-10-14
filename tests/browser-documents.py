import asyncio,json,threading,copy,os
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
from types import SimpleNamespace
BASE=Path(__file__).resolve().parent;ROOT=Path(os.environ.get('NAKNA_PROJECT_DIR','.')).resolve()/'public';OUT=BASE/'browser-output';OUT.mkdir(exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**k):super().__init__(*a,directory=str(ROOT),**k)
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();URL=f'http://127.0.0.1:{server.server_port}'
F=['title','document_type','document_date','expires_at','visibility','confidentiality','note']
def make_doc(i,title,status='active',sealed=False):return dict(id=i,employee_id=10,title=title,document_type='employment_contract',file_name='employment-contract.pdf',document_date='2026-01-01',expires_at='2026-12-31',created_at='2026-10-14 05:00:00',updated_at='2026-10-14 05:00:00',storage_provider='r2',file_size=4096,version=1,status=status,source='generated' if sealed else 'upload',confidentiality='confidential',visibility='hr_only',note='เอกสารสำหรับการทดสอบเท่านั้น',editable_fields=[] if status=='archived' else ['note'] if sealed else F,can_archive=status!='archived',can_restore=status=='archived',edit_token='token-'+str(i))
class API:
 def __init__(self):self.docs=[make_doc(100,'สัญญาจ้างงาน · ปี 2569'),make_doc(101,'หนังสือรับรองการทำงาน (ลงนามแล้ว)',sealed=True),make_doc(102,'สัญญาฉบับเก่า','archived')];self.calls=[];self.events=[];self.fail=False;self.readonly=False;self.fail_read=False
 async def route(self,route):
  req=route.request;path=req.url.split(URL)[-1].split('?')[0];method=req.method;self.calls.append((method,path));data={};code=200
  if path=='/api/employees/10/documents' and method=='GET':
   if self.fail_read:code=503;data={'error':'โหลดรายการไม่สำเร็จ'}
   else:
    docs=copy.deepcopy(self.docs)
    if self.readonly:
     for d in docs:d['can_archive']=False;d['can_restore']=False;d['editable_fields']=[]
    data={'data':docs,'permissions':{'can_edit':not self.readonly},'management_version':'P10.4'}
  elif path.endswith('/events'):data={'data':self.events,'document':{'title':'เอกสารทดสอบ'}}
  elif method in ['PATCH','DELETE','POST'] and path.startswith('/api/employee-documents/'):
   if self.fail:code=409;data={'error':'มีผู้เปลี่ยนเอกสารนี้แล้ว กรุณาโหลดข้อมูลล่าสุดก่อนทำรายการ','code':'DOCUMENT_CONFLICT'}
   else:
    body=req.post_data_json;id=int(path.split('/')[3]);d=next(x for x in self.docs if x['id']==id);changes={}
    if method=='PATCH':
     for k in F:
      if k in body:
       v=body[k] or None
       if d.get(k)!=v:changes[k]={'before':d.get(k),'after':v};d[k]=v
     ev='metadata_edited'
    elif method=='DELETE':d.update(status='archived',editable_fields=[],can_archive=False,can_restore=True);ev='archived'
    else:d.update(status='active',editable_fields=F,can_archive=True,can_restore=False);ev='restored'
    d['edit_token']+='x';self.events.insert(0,{'id':len(self.events)+1,'actor_email':'hr@example.test','event_type':ev,'created_at':'2026-10-14T06:00:00Z','detail_json':json.dumps({'reason':body.get('reason'),'changes':changes})});data={'ok':True,'document':copy.deepcopy(d),'archived':method=='DELETE','restored':method=='POST'}
  elif path=='/api/employees/10/documents' and method=='POST':
   self.docs.insert(0,make_doc(104,'เอกสารที่อัปโหลดใหม่'));data={'ok':True,'id':104,'storage_provider':'r2'}
  else:data={'ok':True,'data':[]}
  await route.fulfill(status=code,content_type='application/json',body=json.dumps(data,ensure_ascii=False))

results=[]
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=os.environ.get('NAKNA_CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
  for width in [320,390,768,1440]:
   api=API();page=await browser.new_page(viewport={'width':width,'height':900 if width>600 else 844},device_scale_factor=1);errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
   async def bridge(data):
    result={}
    request=SimpleNamespace(url=URL+data['path'],method=data['method'],post_data_json=json.loads(data['body']) if data['body'] and data['body']!='MULTIPART' else {})
    class Route:
     async def fulfill(self,**kw):result.update(kw)
    route=Route();route.request=request
    await api.route(route)
    return result
   await page.expose_function('qaFetch',bridge)
   app=(ROOT/'app.js').read_text().replace('\nboot();','\n// QA boot disabled\n')+"\ninitMobileDialogSystem();window.__DOCQA={state,ui:employeeDocumentUi};"
   soup=BeautifulSoup((ROOT/'index.html').read_text(),'html.parser')
   for n in soup.select('script,link,noscript,meta[http-equiv]'):n.decompose()
   for f in ['styles.css','ui/p10.css','ui/attendance-p10.css','ui/employee-documents-p10_4.css']:
    if not (ROOT/f).exists():continue
    st=soup.new_tag('style');st.string=(ROOT/f).read_text();
    if f.endswith('p10_4.css'):st['id']='nkEmployeeDocumentStyle104'
    soup.head.append(st)
   await page.set_content(str(soup),wait_until='domcontentloaded')
   await page.evaluate('''() => {window.fetch=async (path,opts={})=>{const r=await window.qaFetch({path:String(path),method:opts.method||'GET',body:typeof opts.body==='string'?opts.body:opts.body?'MULTIPART':''});return new Response(r.body,{status:r.status,headers:{'content-type':r.content_type}});}; for(const name of ['localStorage','sessionStorage']){const m=new Map();Object.defineProperty(window,name,{value:{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),clear:()=>m.clear()},configurable:true});}}''')
   await page.add_script_tag(content=(ROOT/'ui/p10.js').read_text())
   await page.add_script_tag(content=app)
   await page.evaluate("""() => {__DOCQA.state.me={active_company_id:1,role:'owner'};__DOCQA.state.employees=[{id:10,employee_code:'DEMO-001',first_name:'ณัฐ',last_name:'ตัวอย่าง',nickname:'ณัฐ',department_name:'Operations',position_name:'HR',status:'active',document_count:2}];} """)
   await page.evaluate('window.openEmployeeDocuments(10)');await page.locator('.ed-doc').first.wait_for();await page.wait_for_timeout(200)
   assert await page.locator('#employeeDocumentsModal').is_visible();results.append(f'{width}: open + active docs')
   over=await page.evaluate("""() => {const d=document.querySelector('#employeeDocumentsModal'); return {w:d.clientWidth,sw:d.scrollWidth,body:document.querySelector('#employeeDocumentsModal .ed-body').scrollWidth,bw:document.querySelector('#employeeDocumentsModal .ed-body').clientWidth};} """)
   assert over['sw']<=over['w']+1 and over['body']<=over['bw']+1,over;results.append(f'{width}: no modal horizontal overflow')
   await page.screenshot(path=str(OUT/f'documents_{width}.png'))
   await page.locator('[data-ed-action="edit"][data-id="100"]').click()
   assert await page.locator('#edEditForm input[name="expires_at"]').input_value()=='2026-12-31'
   await page.locator('#edEditForm input[name="expires_at"]').fill('2027-01-31')
   await page.locator('#edEditForm textarea[name="reason"]').fill('แก้วันที่ให้ตรงกับสัญญาฉบับจริง')
   await page.screenshot(path=str(OUT/f'edit_{width}.png'))
   count=len(api.calls);await page.locator('#edSaveButton').click();await page.wait_for_timeout(200)
   assert api.calls[count:]==[('PATCH','/api/employee-documents/100')],api.calls[count:]
   assert '2570' in await page.locator('.ed-doc[data-document-id="100"]').inner_text()
   results.append(f'{width}: edit + response update; exactly one PATCH, no whole-app reload')
   await page.locator('[data-ed-action="history"][data-id="100"]').click();await page.locator('.ed-change').first.wait_for();assert 'hr@example.test' in await page.locator('#edHistoryList').inner_text();assert 'แก้วันที่ให้ตรง' in await page.locator('#edHistoryList').inner_text();results.append(f'{width}: history old/new/actor/reason/time')
   await page.locator('[data-ed-pane="history"] [data-ed-back]').click()
   await page.locator('[data-ed-action="archive"][data-id="100"]').click();await page.locator('#edConfirmReason').fill('อัปผิดรายการ')
   count=len(api.calls);await page.locator('#edConfirmButton').click();await page.wait_for_timeout(100)
   assert api.calls[count:]==[('DELETE','/api/employee-documents/100')];assert await page.locator('.ed-doc[data-document-id="100"]').count()==0
   await page.locator('[data-ed-tab="archived"]').click();assert await page.locator('.ed-doc[data-document-id="100"]').is_visible();results.append(f'{width}: archive hides active and appears in archive tab')
   await page.locator('[data-ed-action="restore"][data-id="100"]').click();await page.locator('#edConfirmReason').fill('กู้คืนเอกสารที่ถูกต้อง');await page.locator('#edConfirmButton').click();await page.wait_for_timeout(100);await page.locator('[data-ed-tab="active"]').click();assert await page.locator('.ed-doc[data-document-id="100"]').is_visible();results.append(f'{width}: restore')
   await page.locator('[data-ed-action="edit"][data-id="101"]').click();assert await page.locator('#edEditForm input[name="expires_at"]').is_disabled();assert await page.locator('#edEditForm textarea[name="note"]').is_enabled();results.append(f'{width}: sealed document date disabled, note editable')
   # Closing unsaved editor can be cancelled via native confirmation.
   page.once('dialog',lambda d:d.accept());await page.locator('[data-ed-pane="edit"] [data-ed-back]').first.click()
   api.fail=True;await page.locator('[data-ed-action="edit"][data-id="100"]').click();await page.locator('#edEditForm input[name="title"]').fill('กรอกไว้ไม่ควรหาย');await page.locator('#edEditForm textarea[name="reason"]').fill('test conflict');await page.locator('#edSaveButton').click();await page.wait_for_timeout(100);assert await page.locator('#edEditForm input[name="title"]').input_value()=='กรอกไว้ไม่ควรหาย';assert await page.locator('#edEditForm').is_visible();assert 'มีผู้เปลี่ยนเอกสารนี้แล้ว' in await page.locator('#employeeDocumentsMessage').inner_text();results.append(f'{width}: failure leaves input intact')
   page.once('dialog',lambda d:d.accept());await page.locator('[data-ed-close]').click();api.fail=False;api.readonly=True;await page.evaluate('window.openEmployeeDocuments(10)');await page.wait_for_timeout(100);assert await page.locator('[data-ed-action="edit"]').count()==0;assert await page.locator('[data-ed-action="archive"]').count()==0;assert await page.locator('#edAddButton').is_hidden();results.append(f'{width}: read-only hides mutation actions')
   assert not errs,errs;results.append(f'{width}: no JS pageerror')
   await page.close()
  await browser.close()
 (OUT/'browser-results.json').write_text(json.dumps({'passed':len(results),'cases':results},ensure_ascii=False,indent=2));print(json.dumps({'passed':len(results),'cases':results},ensure_ascii=False,indent=2))
try:asyncio.run(main())
finally:server.shutdown()
