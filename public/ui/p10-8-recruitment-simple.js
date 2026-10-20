/* Nakna P10.8 — recruitment Gmail simple setup.
 * No direct API / Google operations. Saves exclusively through the existing
 * Recruitment Gmail settings button, retaining server-side validation and
 * authorization. Does NOT auto-sync/read mail on page load.
 */
(() => {
  'use strict';
  const VERSION = 'P10.8-simple-gmail-1';
  if (window.NaknaRecruitmentSimple?.version === VERSION) return;

  const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
  const TITLE_RE = /เลือกอีเมลที่\s*Nakna\s*อ่านจาก/i;
  const OPEN_TEXT = /เปิดให้อ่าน\s*Inbox/i;
  const AUTO_TEXT = /Sync\s*อัตโนมัติ/i;
  const originalHiddenClass = 'p108-advanced-hidden';
  let observer, queued = false;
  let current = null;
  let lastError = null;

  function visible(el) {
    if (!el || !el.isConnected) return false;
    if (!el.getClientRects().length) return false;
    let n = el;
    while (n && n.nodeType === 1) {
      if (n.hidden || n.getAttribute('aria-hidden') === 'true') return false;
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
      n = n.parentElement;
    }
    return true;
  }
  function text(el) { return (el?.textContent || '').replace(/\s+/g, ' ').trim(); }
  function event(el, type) { el.dispatchEvent(new Event(type, { bubbles: true })); }
  function saveButton(root) {
    return [...root.querySelectorAll('button')].find(b => /^(บันทึก|save)$/i.test(text(b)) && b.isConnected);
  }
  function findDialog() {
    const headers = [...document.querySelectorAll('h1,h2,h3,h4,h5,[role="heading"]')];
    for (const title of headers) {
      if (!TITLE_RE.test(text(title)) || !visible(title)) continue;
      let node = title;
      for (let i = 0; node && i < 12; i++, node = node.parentElement) {
        if (node === document.body || node === document.documentElement) break;
        const source = node.querySelector('select:has(option[value="recipient"]):has(option[value="all"])');
        const date = node.querySelector('select:has(option[value="30"]):has(option[value="90"])');
        const save = saveButton(node);
        if (source && date && save) {
          const match = text(title).match(EMAIL_RE);
          // Only take mailbox address from the title, not an example or recipient list.
          if (!match) return null;
          return { root: node, title, source, date, save, email: match[0].toLowerCase() };
        }
      }
    }
    return null;
  }
  function findRecipient(root) {
    // The original UI has one recipient textarea in `recipient` mode. Don't
    // guess in modes with multiple textareas; source may re-render this field.
    const candidates = [...root.querySelectorAll('textarea')];
    if (candidates.length === 1) return candidates[0];
    const labeled = candidates.filter(x => {
      let n = x.parentElement;
      for (let i=0; n && i<3; i++, n=n.parentElement) {
        if (/ส่งถึงอีเมลเหล่านี้|\(To\)/i.test(text(n).slice(0,220))) return true;
      }
      return false;
    });
    return labeled.length === 1 ? labeled[0] : null;
  }
  function checkboxes(root) {
    const boxes=[...root.querySelectorAll('input[type="checkbox"]')];
    function byLabel(regex) {
      return boxes.find(x => {
        const label = x.closest('label') || x.parentElement;
        return regex.test(text(label));
      }) || boxes.find(x => {
        const id=x.id; const label=id && root.querySelector(`label[for="${CSS.escape(id)}"]`);
        return regex.test(text(label));
      });
    }
    return { enabled:byLabel(OPEN_TEXT), automatic:byLabel(AUTO_TEXT) };
  }
  function closestConfigBody(desc) {
    const {root, source, date, title, save}=desc;
    let node=source.parentElement;
    while (node && node!==root) {
      if (node.contains(date) && !node.contains(title) && !node.contains(save)) {
        if (node.querySelectorAll('select,textarea,input').length<=16) return node;
      }
      node=node.parentElement;
    }
    return null;
  }
  function sectionFor(el, root) {
    if (!el) return null;
    let n=el;
    for (let i=0;n&&n!==root&&i<6;i++,n=n.parentElement) {
      const count=n.querySelectorAll('input,select,textarea').length;
      if (count===1 && (n.querySelector('label') || /ส่งถึง|ย้อนหลังเท่าไหร่|เปิดให้อ่าน|Sync อัตโนมัติ/.test(text(n).slice(0,150))))
        return n;
    }
    return null;
  }
  function markHidden(el, state) {
    if (!el || state.hiddenNodes.has(el)) return;
    state.hiddenNodes.add(el);
    el.classList.add(originalHiddenClass);
  }
  function hideOriginal(desc, state) {
    state.hiddenNodes.forEach(x=>x.classList.remove(originalHiddenClass));
    state.hiddenNodes.clear();
    const body=closestConfigBody(desc);
    if (body) {
      markHidden(body,state);
    } else {
      markHidden(sectionFor(desc.source,desc.root),state);
      markHidden(sectionFor(desc.date,desc.root),state);
      const recipient=findRecipient(desc.root);
      markHidden(sectionFor(recipient,desc.root),state);
      const c=checkboxes(desc.root);
      markHidden(sectionFor(c.enabled,desc.root),state);
      markHidden(sectionFor(c.automatic,desc.root),state);
    }
    markHidden(desc.save,state);
  }
  function showOriginal(state) {
    state.hiddenNodes.forEach(x=>x.classList.remove(originalHiddenClass));
    state.hiddenNodes.clear();
    state.advanced=true;
    state.panel.classList.add('p108-panel--advanced');
    state.panel.querySelector('[data-p108="advanced"]').textContent='กลับโหมดง่าย';
  }
  function hideAgain(state, desc) {
    state.advanced=false;
    state.panel.classList.remove('p108-panel--advanced');
    state.panel.querySelector('[data-p108="advanced"]').textContent='ตัวเลือกขั้นสูง';
    hideOriginal(desc,state);
  }
  function setStatus(state,message,level='info') {
    const el=state.panel.querySelector('[data-p108="status"]');
    if(el){ el.textContent=message; el.dataset.level=level; }
  }
  function makePanel(desc) {
    const panel=document.createElement('section');
    panel.className='p108-panel';
    panel.setAttribute('aria-label','ตั้งค่า Gmail รับสมัครงานแบบง่าย');
    panel.innerHTML = `
      <div class="p108-head"><span class="p108-step">ตั้งค่าแบบง่าย</span><strong>รับใบสมัครผ่าน Gmail</strong>
        <p>ไม่ต้องเขียน Query หรือเรียนรู้คำสั่ง Gmail</p></div>
      <div class="p108-email"><span class="p108-icon" aria-hidden="true">✉</span>
        <div><small>บัญชีที่เชื่อมอยู่</small><strong data-p108="email"></strong></div><span class="p108-dot">พร้อมตั้งค่า</span></div>
      <div class="p108-explain"><span aria-hidden="true">✓</span>
        <span>อ่านเฉพาะอีเมลที่ส่งถึงบัญชีนี้ย้อนหลัง <strong>30 วัน</strong><br>
        <small>อีเมลจะเข้าคิวให้ HR คัดกรองก่อนเป็นผู้สมัคร ไม่ส่งตอบอัตโนมัติ</small></span></div>
      <button class="p108-primary" data-p108="enable" type="button">เปิดรับใบสมัครจาก Gmail นี้</button>
      <button class="p108-secondary" data-p108="advanced" type="button">ตัวเลือกขั้นสูง</button>
      <p class="p108-status" data-p108="status" role="status" aria-live="polite"></p>
    `;
    panel.querySelector('[data-p108="email"]').textContent=desc.email;
    return panel;
  }
  function insertPanel(desc, panel) {
    const {title,root}=desc;
    const header=title.closest('header,.modal-head,.modal-header,.dialog-header,[class*="modal-head"],[class*="dialog-head"]') || title.parentElement;
    if (header && header !== root && root.contains(header)) header.insertAdjacentElement('afterend',panel);
    else root.insertBefore(panel,root.firstChild);
  }
  function cleanup() {
    if (!current) return;
    current.hiddenNodes.forEach(x=>x.classList.remove(originalHiddenClass));
    current.panel.remove();
    current=null;
  }
  function populate(desc) {
    const {root,email}=desc;
    if (!email || !EMAIL_RE.test(email)) return {ok:false,reason:'ไม่สามารถอ่านชื่อบัญชี Gmail ที่เชื่อมอยู่ได้'};
    let source=root.querySelector('select:has(option[value="recipient"]):has(option[value="all"])');
    if (!source) return {ok:false,reason:'ไม่พบตัวเลือกวิธีรับอีเมล'};
    if (source.value!=='recipient') {
      source.value='recipient';
      event(source,'input');event(source,'change');
    }
    // Some versions replace the recipient field in the same task on `change`.
    return {ok:true};
  }
  async function enable(state,desc) {
    if(state.saving) return;
    state.saving=true;
    const button=state.panel.querySelector('[data-p108="enable"]');
    button.disabled=true;
    setStatus(state,'กำลังตั้งค่าให้ ไม่ต้องกรอกช่องอื่น…');
    try {
      const selected=populate(desc);
      if(!selected.ok) throw new Error(selected.reason);
      // Wait a frame for vanilla DOM mode-switch handlers to update their fields.
      await new Promise(resolve=>requestAnimationFrame(resolve));
      const live=findDialog();
      if(!live || live.email!==desc.email) throw new Error('หน้าตั้งค่าถูกปิดระหว่างดำเนินการ');
      const area=findRecipient(live.root);
      if(!area) throw new Error('ไม่พบช่องตั้งค่าผู้รับอีเมล');
      // Critically: To is an ADDRESS LIST, NEVER a Gmail Search Query.
      // `in:inbox to:...` here would make a broken `to:in:inbox ...` query.
      area.value=live.email;
      event(area,'input');event(area,'change');
      const back=live.root.querySelector('select:has(option[value="30"]):has(option[value="90"])');
      if(!back?.querySelector('option[value="30"]')) throw new Error('ไม่มีช่วงย้อนหลัง 30 วัน');
      back.value='30';event(back,'input');event(back,'change');
      const c=checkboxes(live.root);
      if(!c.enabled || !c.automatic) throw new Error('ไม่พบตัวเลือกเปิด Inbox หรือ Sync อัตโนมัติ');
      if(!c.enabled.checked){ c.enabled.checked=true;event(c.enabled,'change'); }
      if(!c.automatic.checked){ c.automatic.checked=true;event(c.automatic,'change'); }
      const save=saveButton(live.root);
      if(!save || save.disabled) throw new Error('ปุ่มบันทึกยังใช้งานไม่ได้');
      setStatus(state,'กรอกให้อัตโนมัติแล้ว กำลังบันทึกด้วยระบบเดิม…');
      save.click();
      // Don't claim success before server confirmation; follow the original save result.
      setStatus(state,'ส่งคำขอบันทึกแล้ว หากสำเร็จหน้าตั้งค่าจะปิด จากนั้นกด Sync ครั้งแรกที่บัญชี Gmail');
    } catch(err) {
      lastError=err;
      setStatus(state,`${err.message} — เปิดตัวเลือกขั้นสูงเพื่อตรวจสอบ`,'error');
      showOriginal(state);
      console.warn('[Nakna P10.8] quick setup could not safely complete:',err);
    } finally {
      state.saving=false;
      button.disabled=false;
    }
  }
  function enhance() {
    const desc=findDialog();
    if(!desc){ cleanup();return; }
    if(current && (current.root!==desc.root || current.email!==desc.email || !current.panel.isConnected)) cleanup();
    if(current) return;
    const state={root:desc.root,email:desc.email,panel:makePanel(desc),hiddenNodes:new Set(),advanced:false,saving:false};
    insertPanel(desc,state.panel);
    current=state;
    hideOriginal(desc,state);
    state.panel.querySelector('[data-p108="advanced"]').addEventListener('click',()=>{
      if(state.advanced) hideAgain(state,findDialog()||desc);
      else showOriginal(state);
    });
    state.panel.querySelector('[data-p108="enable"]').addEventListener('click',()=>enable(state,findDialog()||desc));
  }
  function schedule() {
    if(queued) return;
    queued=true;
    requestAnimationFrame(()=>{
      queued=false;
      if(observer) observer.disconnect();
      try { enhance(); } catch(e){console.warn('[Nakna P10.8] UI enhancement skipped:',e);cleanup();}
      finally {if(observer) observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class','hidden']});}
    });
  }
  function init() {
    observer=new MutationObserver(schedule);
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class','hidden']});
    schedule();
  }
  window.NaknaRecruitmentSimple={version:VERSION,refresh:schedule,help:()=>lastError?.message||''};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
