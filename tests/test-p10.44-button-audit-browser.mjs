// Real dashboard markup/styles and progressive UI controllers; no production APIs.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.NAKNA_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve('public');
let html=fs.readFileSync(root+'/index.html','utf8')
 .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
 .replace(/<link\b[^>]*href="https:[^>]*>/gi,'');
html=html.replace('</body>',`<script>
 document.querySelector('#bootSplash')?.remove();
 document.querySelector('#appShell').classList.remove('hidden');
 document.querySelector('#appShell').hidden=false;
 document.querySelector('#leaveUnifiedSummary').innerHTML=Array.from({length:5},(_,i)=>'<article><small>สถานะ '+i+'</small><strong>'+i+'</strong><span>รายการ</span></article>').join('');
 document.querySelector('#payrollSummary').innerHTML=Array.from({length:4},(_,i)=>'<article class="payroll-summary-card"><strong>'+i+'</strong></article>').join('');
 document.querySelector('#leaveUnifiedPeople').innerHTML='<tr data-nk-employee-id="7"><td>สมชาย ทดสอบ</td><td>ทีมทดสอบ</td><td>2</td><td>3</td><td>ลากิจ</td><td>1</td><td>0</td><td>0</td></tr>';
 window.openLeaveDetail=()=>window.detailClicks=(window.detailClicks||0)+1;
 </script><script src="/ui/p10.js"></script><script src="/ui/p10-5.js"></script></body>`);
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://local');
 if(u.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html)}
 const file=path.resolve(root,'.'+u.pathname);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.statusCode=404;return res.end()}
 res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'image/png');res.end(fs.readFileSync(file));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.NAKNA_CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 const page=await browser.newPage();page.setDefaultTimeout(8000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.waitForFunction(()=>window.NaknaSimplify&&window.NaknaUI);
 const show=async id=>{await page.evaluate(id=>{document.querySelectorAll('.view').forEach(v=>{v.style.display=v.id===id?'block':'none';v.classList.toggle('active',v.id===id)});window.NaknaUI.refresh()},id);await page.evaluate(()=>new Promise(requestAnimationFrame))};
 const widths=[1440,1024,768,720,390,320];let scanned=0;
 for(const width of widths){
  await page.setViewportSize({width,height:1000});await show('view-leave');
  const toggle=page.locator('#nk105LeaveStatsToggle');
  assert.equal(await toggle.isVisible(),width<=720,`status button visibility at ${width}`);
  const fourth=page.locator('#leaveUnifiedSummary > article').nth(3);
  if(width<=720){
   assert(!(await fourth.isVisible()));await toggle.click();assert(await fourth.isVisible());assert.equal(await toggle.getAttribute('aria-expanded'),'true');
   await toggle.click();assert(!(await fourth.isVisible()));assert.equal(await toggle.getAttribute('aria-expanded'),'false');
   assert((await toggle.boundingBox()).height>=44);
   const overflow=await toggle.evaluate(el=>el.scrollWidth>el.clientWidth+1);assert(!overflow,`status button overflow ${width}`);
   await page.keyboard.press('Tab');await toggle.focus();assert.equal(await toggle.evaluate(el=>getComputedStyle(el).outlineStyle),'solid');await page.keyboard.press('Enter');assert(await fourth.isVisible());await page.keyboard.press('Space');assert(!(await fourth.isVisible()));
  }else assert(await fourth.isVisible());
  const ids=await page.locator('.view').evaluateAll(els=>els.map(e=>e.id));
  for(const id of ids){
   await show(id);
   const result=await page.locator('button').evaluateAll(els=>{
    const visible=els.filter(el=>el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden');
    return {count:visible.length,raw:visible.filter(el=>{const s=getComputedStyle(el);return s.borderStyle==='outset'}).map(el=>({id:el.id,text:el.textContent.trim()}))};
   });scanned+=result.count;assert.deepEqual(result.raw,[],`unstyled buttons ${id} at ${width}`);
  }
 }
 await page.setViewportSize({width:390,height:844});await show('view-payroll');
 const more=page.locator('#nk105PayrollSummaryMore');assert(await more.isVisible());assert((await more.boundingBox()).height>=44);
 await more.click();assert.equal(await more.getAttribute('aria-expanded'),'true');assert(await page.locator('.payroll-summary-card').nth(3).isVisible());
 // Representative shared buttons inside dialogs and table rows must retain touch targets.
 await page.evaluate(()=>{
  const dialog=document.querySelector('#leaveRequestModal')||document.querySelector('dialog');
  const sample=document.createElement('div');sample.id='buttonAudit';sample.innerHTML='<button class="secondary-btn">ทดสอบข้อความภาษาไทยที่ยาวและต้องขึ้นบรรทัดใหม่ได้</button><button class="text-btn danger" disabled>ไม่อนุมัติ</button><div class="nk-table"><table><tbody><tr><td><button class="nk-detail-button">ดูรายละเอียด</button></td></tr></tbody></table></div>';dialog.append(sample);dialog.showModal();
 });
 for(const el of await page.locator('#buttonAudit button').all())assert((await el.boundingBox()).height>=44);
 assert(await page.locator('#buttonAudit button:disabled').isDisabled());
 await page.evaluate(()=>document.querySelector('dialog[open]').close());
 await show('view-leave');
 await page.evaluate(()=>document.querySelector('#leaveUnifiedSummary').replaceChildren());
 await page.waitForFunction(()=>document.querySelector('#nk105LeaveStatsToggle').hidden);
 assert(!(await page.locator('#nk105LeaveStatsToggle').isVisible()));
 assert.deepEqual(errors,[]);
 console.log(`PASS P10.44: ${widths.length} viewport widths, ${scanned} button render checks across dashboard views; status disclosure, payroll disclosure, keyboard/focus, empty state, dialog/table touch targets, disabled state, no JS errors`);
}finally{await browser?.close();await new Promise(r=>server.close(r))}
