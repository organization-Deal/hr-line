/* Nakna P10.9 — one-click recruitment inbox activation in the connected Gmail card.
 * Presentation-only. Uses P10.8's existing safe configuration and original Save action.
 * No new endpoints, OAuth calls, auto-read or auto-sync without an explicit user click.
 */
(() => {
  'use strict';
  const VERSION = 'P10.9-recruitment-quickstart-1';
  if (window.NaknaRecruitmentQuickstart?.version === VERSION) return;
  const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const TRIGGER = 'เลือกแหล่งเมล';
  const NEEDS_SETUP = /ตั้งแหล่งเมลก่อน|ยังไม่ได้เลือก|ต้องตั้งค่าก่อน\s*Sync/i;
  const MAX_WAIT = 7000;
  const state = new WeakMap();
  let observer = null;
  let queued = false;

  function clean(el) { return String(el?.textContent || '').replace(/\s+/g, ' ').trim(); }
  function uniqueEmails(text) { return [...new Set((text.match(EMAIL_RE) || []).map(e => e.toLowerCase()))]; }
  function findCard(button) {
    // Keep account mapping local. Do not cross into parent containing >1 account.
    let n = button.parentElement;
    for (let i=0; n && n !== document.body && i<9; i++, n=n.parentElement) {
      const description = clean(n);
      const emails = uniqueEmails(description);
      if (emails.length > 1) return null;
      if (emails.length === 1 && NEEDS_SETUP.test(description) && n.querySelectorAll('button').length <= 8) {
        return {account: emails[0], card:n, original:button};
      }
    }
    return null;
  }
  function activeSetupPanel(email) {
    const panels = [...document.querySelectorAll('.p108-panel')].filter(p => p.isConnected);
    return panels.find(p => clean(p.querySelector('[data-p108="email"]')).toLowerCase() === email) || null;
  }
  function note(ui, message, error=false) {
    if (!ui?.isConnected) return;
    const n=ui.querySelector('.p109-note');
    if (n && n.textContent!==message) n.textContent=message;
    if (n) n.dataset.error=error?'1':'0';
  }
  function createUI(desc) {
    const {original,account}=desc;
    const bar=document.createElement('div');
    bar.className='p109-actions';
    bar.dataset.email=account;
    bar.innerHTML=`
      <button type="button" class="p109-start">เริ่มรับใบสมัคร</button>
      <button type="button" class="p109-advanced">ตั้งค่าเพิ่มเติม</button>
      <p class="p109-note" role="status" aria-live="polite">เชื่อม Gmail แล้ว · ยังไม่เปิดอ่านใบสมัคร</p>
    `;
    const start=bar.querySelector('.p109-start');
    const advanced=bar.querySelector('.p109-advanced');
    start.addEventListener('click',() => startSetup(desc,bar,start));
    advanced.addEventListener('click',() => openAdvanced(desc,bar));
    original.classList.add('p109-original-hidden');
    original.insertAdjacentElement('beforebegin',bar);
    state.set(original,{bar,account});
    return bar;
  }
  async function waitFor(predicate, timeout=MAX_WAIT) {
    const deadline=Date.now()+timeout;
    while (Date.now()<deadline) {
      const found=predicate(); if (found) return found;
      await new Promise(r=>setTimeout(r,90));
    }
    return null;
  }
  function isAccountCorrect(desc) {
    if (!desc.original?.isConnected) return false;
    const live=findCard(desc.original);
    return !!live && live.account===desc.account;
  }
  async function openModal(desc) {
    if (!isAccountCorrect(desc)) throw new Error('บัญชี Gmail นี้เปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่');
    desc.original.click();
    // Require P10.8 instead of guessing fields or changing account permissions.
    const p108=await waitFor(()=>activeSetupPanel(desc.account),MAX_WAIT);
    if (!p108) return null;
    return p108;
  }
  async function startSetup(desc,bar,start) {
    if(start.disabled) return;
    start.disabled=true;
    start.textContent='กำลังตั้งค่า…';
    note(bar,'กำลังเปิดฟอร์มตั้งค่าบัญชีที่เชื่อมแล้ว');
    try {
      const p108=await openModal(desc);
      if (!p108) throw new Error('ไม่พบหน้าตั้งค่าแบบง่าย P10.8; เปิดแบบฟอร์มเดิมให้แล้ว');
      const enable=p108.querySelector('button[data-p108="enable"]');
      if (!enable || enable.disabled) throw new Error('ปุ่มเปิดรับใบสมัครยังไม่พร้อม');
      enable.click();
      // Original Save handler is asynchronous. Do not claim success on clicking.
      note(bar,'ส่งคำขอตั้งค่าแล้ว · รอระบบบันทึก ก่อนกด Sync ครั้งแรก');
      // P10.8 may show a validation error without closing dialog.
      await new Promise(r=>setTimeout(r,400));
      const status=p108.querySelector('[data-p108="status"]');
      if(status?.dataset.level==='error') throw new Error(clean(status)||'ระบบยังไม่ยืนยันการบันทึก');
      if (!desc.original.isConnected) return; // Card refreshed after successful save.
      note(bar,'กำลังตรวจสถานะบันทึก · เมื่อปุ่ม Sync เปิดใช้งาน ให้กด Sync ครั้งแรก');
    } catch (e) {
      note(bar,`${e.message} · ใช้ปุ่มตั้งค่าเพิ่มเติมได้`,true);
      console.warn('[Nakna P10.9] quickstart could not complete:',e);
    } finally {
      if(start.isConnected){ start.disabled=false; start.textContent='เริ่มรับใบสมัคร'; }
    }
  }
  async function openAdvanced(desc,bar) {
    try {
      const p108=await openModal(desc);
      if(!p108) { note(bar,'เปิดฟอร์มตั้งค่าบัญชีแล้ว',false);return; }
      const advanced=p108.querySelector('[data-p108="advanced"]');
      if(advanced && !p108.classList.contains('p108-panel--advanced')) advanced.click();
    } catch(e){note(bar,e.message,true);}
  }
  function enhance() {
    const found=new Set();
    [...document.querySelectorAll('button')].filter(b=>clean(b)===TRIGGER).forEach(button=>{
      const desc=findCard(button);
      if(!desc) return;
      found.add(button);
      const old=state.get(button);
      if(old?.account===desc.account && old.bar.isConnected) return;
      if(old?.bar.isConnected) old.bar.remove();
      createUI(desc);
    });
    // Any account that has become configured must use the regular UI again.
    document.querySelectorAll('button.p109-original-hidden').forEach(button=>{
      if(found.has(button)) return;
      const old=state.get(button);
      old?.bar?.remove();
      button.classList.remove('p109-original-hidden');
      state.delete(button);
    });
  }
  function schedule() {
    if(queued) return;
    queued=true;
    requestAnimationFrame(()=>{
      queued=false;
      observer?.disconnect();
      try{ enhance(); } catch(e){ console.warn('[Nakna P10.9] enhancement skipped:',e); }
      finally{ observer?.observe(document.body,{subtree:true,childList:true,characterData:true}); }
    });
  }
  function init() {
    observer=new MutationObserver(schedule);
    observer.observe(document.body,{subtree:true,childList:true,characterData:true});
    schedule();
  }
  window.NaknaRecruitmentQuickstart={version:VERSION,refresh:schedule};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
