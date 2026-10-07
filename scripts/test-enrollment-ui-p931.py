"""Browser tests with production invite page / isolated production admin components.
Uses synthetic responses only. No credentials or real LINE requests. Pages are loaded in memory (no navigation).
Run: python scripts/test-enrollment-ui-p931.py (Playwright Chromium installed).
"""
import json, re
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
PUB=ROOT/'public'
RESULT=[]
def ok(label):RESULT.append(label);print('PASS:',label)
blocked={'allowed':False,'code':'TRIAL_EXPIRED','message':'บริษัทนี้หมดช่วงทดลองใช้ กรุณาแจ้ง HR ให้ผู้ดูแลนากนะต่อ Trial คุณไม่ต้องชำระเงินเอง'}
ready={'allowed':True,'code':'ENROLLMENT_READY','message':'พร้อมกรอกข้อมูลเข้าร่วมทีม'}
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':390,'height':844})
    page=context.new_page()
    state={'enrollment':blocked.copy(),'post_blocked':False,'requests':0,'network_error':False}
    invite={'company_name':'บริษัททดสอบเท่านั้น','position_name':'ทีมงาน','department_name':'Operations','start_date':'2026-10-07','locations':[]}
    page.route('**/*',lambda route:route.abort())
    html=(PUB/'invite.html').read_text()
    html=re.sub(r'<script[^>]*>.*?</script>','',html,flags=re.S)
    html=re.sub(r'<link[^>]*>','',html)
    page.set_content(html)
    page.add_style_tag(content=(PUB/'invite.css').read_text())
    page.add_script_tag(content='window.mockState='+json.dumps(state,ensure_ascii=False)+';window.mockInvite='+json.dumps(invite,ensure_ascii=False)+';window.mockBlocked='+json.dumps(blocked,ensure_ascii=False)+";"+r"""
      window.fetch=async(url,options={})=>{
        if((options.method||'GET')==='GET'){
          if(mockState.network_error)throw new Error('Simulated offline');
          return new Response(JSON.stringify({invite:mockInvite,enrollment:mockState.enrollment}),{status:200,headers:{'content-type':'application/json'}});
        }
        mockState.requests++;
        if(mockState.post_blocked)return new Response(JSON.stringify({error:mockBlocked.message,code:'TRIAL_EXPIRED',enrollment:mockBlocked}),{status:402,headers:{'content-type':'application/json'}});
        return new Response(JSON.stringify({ok:true,employee:{id:1,name:'ทดสอบ',employee_code:'TEST-001',company_name:mockInvite.company_name},line_command:'JOIN TEST-ONLY',line_token_expires_at:'2099-12-31T00:00:00Z',face_enrollment:{enabled:false}}),{status:201,headers:{'content-type':'application/json'}});
      };
    """)
    invite_script=(PUB/'invite.js').read_text().replace("const token = params.get('token') || '';", "const token = 'TEST-ONLY-FAKE-TOKEN-123456789';")
    page.add_script_tag(content=invite_script)
    page.wait_for_selector('#enrollmentNotice:not(.hidden)')
    assert page.locator('#submitBtn').is_disabled()
    assert 'ไม่ต้องชำระเงินเอง' in page.locator('#enrollmentMessage').inner_text()
    ok('Mobile invite shows company access problem before form submit; submit disabled')
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
    ok('390px mobile layout has no horizontal overflow')
    page.fill('[name=first_name]','ทดสอบ')
    page.fill('[name=last_name]','ข้อมูลสมมติ')
    page.fill('[name=phone]','0000000000')
    page.check('#confirmCheck')
    page.evaluate("document.querySelector('#employeeForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))")
    assert page.evaluate('mockState.requests')==0
    ok('Programmatic submit while blocked makes no POST')
    page.evaluate('mockState.network_error=true');page.click('#enrollmentRetry');page.wait_for_function("!document.querySelector('#enrollmentRetry').disabled")
    assert page.locator('#submitBtn').is_disabled()
    assert page.input_value('[name=first_name]')=='ทดสอบ'
    ok('Network error during recheck keeps block and preserves entered form values')
    page.evaluate('(value)=>{mockState.network_error=false;mockState.enrollment=value}',ready)
    page.click('#enrollmentRetry');page.wait_for_function("!document.querySelector('#submitBtn').disabled")
    assert page.input_value('[name=last_name]')=='ข้อมูลสมมติ'
    assert page.locator('#confirmCheck').is_checked()
    ok('After HR resolves entitlement, recheck enables submit without clearing fields/consent')
    page.evaluate('mockState.post_blocked=true')
    page.click('#submitBtn');page.wait_for_selector('#enrollmentNotice:not(.hidden)')
    assert page.locator('#submitBtn').is_disabled()
    assert page.input_value('[name=phone]')=='0000000000'
    ok('Subscription expiry between GET and POST displays inline issue and keeps form values')
    page.evaluate('mockState.post_blocked=false')
    page.click('#enrollmentRetry');page.wait_for_function("!document.querySelector('#submitBtn').disabled")
    page.click('#submitBtn');page.wait_for_selector('#successState:not(.hidden)')
    assert 'สร้างโปรไฟล์เรียบร้อย' in page.locator('#successState').inner_text()
    ok('Successful retry reaches original LINE connection success flow')
    # Isolated original admin components, with synthetic state and API.
    admin=browser.new_page(viewport={'width':1200,'height':900})
    admin.set_content('''<main><p id="subscriptionText"></p><b id="subscriptionBadge"></b><div id="subscriptionPlanKicker"></div><div id="subscriptionPlanName"></div><div id="subscriptionSeats"></div><div id="subscriptionSeatBar"></div><button id="subscriptionPlanBtn"></button><button id="generateInvoiceBtn"></button><div id="subscriptionInvoiceList"></div><button id="saasAdminNav"></button><div id="saasAdminSummary"></div><div id="saasPlansList"></div><div id="saasCompaniesList"></div><div id="saasInvoicesList"></div><dialog id="modal"><p id="modalEyebrow"></p><h2 id="modalTitle"></h2><p id="modalSubtitle"></p><div id="modalFields"></div><button id="modalSave"></button></dialog></main><style>.hidden{display:none}#modal{width:500px}.field{padding:12px}label,small{display:block}textarea{width:95%}p{white-space:normal}</style>''')
    source=(PUB/'app.js').read_text()
    modal=source[source.index('function openPhase5Form('):source.index('async function refreshPhase5(')]
    recovery=source[source.index('function renderSubscription('):source.index('function openSubscriptionPlan(')]
    renderer=source[source.index('function renderSaasAdmin('):source.index('window.editSaasPlan=')]
    init=r'''
    const $=s=>document.querySelector(s);const escapeHtml=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const money=x=>String(x);const formatDate=x=>String(x||'—');const isOwnerUi=()=>false;const emptyState=()=>'';
    const toast=(m)=>{window.lastToast=m;};
    const state={subscription:{saas_admin:true,can_change_plan:false,subscription:{client_id:1,plan_code:'trial',status:'expired',trial_ends_at:'2026-09-20T00:00:00Z'},enrollment:{allowed:false,message:'Trial หมดแล้ว'}},companyProfile:{name:'บริษัททดสอบ A'},saasAdmin:{companies:[{id:1,name:'บริษัททดสอบ A',code:'A',plan_code:'trial',status:'expired',trial_ends_at:'2026-09-20T00:00:00Z',active_seats:24}],plans:[],invoices:[]}};
    window.testState=state;window.calls=[];
    const api=async(path,options)=>{window.calls.push({path,options});if(path.endsWith('/extend-trial')){const data=JSON.parse(options.body);return {ok:true,trial_ends_at:data.end_date+'T16:59:59.000Z',enrollment:{allowed:true}};}if(path==='/api/subscription')return state.subscription;if(path==='/api/admin/saas/overview')return state.saasAdmin;throw new Error('unexpected API');};
    '''
    admin.add_script_tag(content=init+modal+recovery+renderer+'\nrenderSubscription();renderSaasAdmin();')
    assert admin.locator('button:has-text("ต่อทดลองใช้บริษัทนี้")').count()==1
    assert admin.locator('#saasCompaniesList button:has-text("ต่อทดลองใช้")').count()==1
    ok('Operator has recovery buttons on current subscription and company list')
    admin.click('button:has-text("ต่อทดลองใช้บริษัทนี้")')
    assert admin.locator('#modal').is_visible()
    assert 'บริษัททดสอบ A' in admin.locator('#modalFields').inner_text()
    admin.click('#modalSave')
    assert admin.evaluate('window.calls.length')==0
    assert 'เหตุผล' in admin.evaluate('window.lastToast')
    ok('Extension modal identifies target company and prevents empty-reason submission')
    admin.fill('#trialExtensionReason','ต่อทดลองใช้ตามคำขอของบริษัททดสอบ')
    admin.click('#modalSave');admin.wait_for_function('!document.querySelector("#modal").open')
    writes=admin.evaluate('window.calls.filter(c=>c.path.endsWith("/extend-trial"))')
    assert len(writes)==1 and writes[0]['path']=='/api/admin/saas/subscriptions/1/extend-trial'
    data=json.loads(writes[0]['options']['body']);assert data['reason']=='ต่อทดลองใช้ตามคำขอของบริษัททดสอบ'
    assert admin.evaluate('testState.subscription.subscription.status')=='trialing'
    ok('Explicit confirmation sends fixed end date and reason to selected company only')
    admin.evaluate('testState.subscription.saas_admin=false;renderSubscription()')
    assert admin.locator('button:has-text("ต่อทดลองใช้บริษัทนี้")').count()==0
    before=admin.evaluate('window.calls.length');admin.evaluate('window.extendSaasTrial(1)')
    assert admin.evaluate('window.calls.length')==before
    ok('Non-operator UI hides action and refuses direct client-side invocation')
    browser.close()
print(f'\n{len(RESULT)}/{len(RESULT)} browser checks passed. Mock responses; not production LINE or D1.')
