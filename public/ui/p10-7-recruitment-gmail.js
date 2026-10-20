/* Nakna P10.7 — Recruitment Gmail account picker bridge.
 * Presentation-only: NO API mutations, NO OAuth changes, NO automatic sync.
 * Adds already-connected recruitment inboxes to the message-source filter,
 * and an explicit link to the existing per-inbox source setup workflow.
 */
(() => {
  'use strict';
  const VERSION = 'P10.7-recruitment-gmail-1';
  if (window.NaknaRecruitmentMailbox?.version === VERSION) return;

  const FILTER_LABEL = 'กรองตามบัญชี Gmail ที่นำเข้า';
  const SELECTOR = `select[aria-label="${FILTER_LABEL}"]`;
  const ACCOUNT_ACTION = 'เลือกแหล่งเมล';
  const CLASS = 'nakna-gmail-account-help';
  const emailRE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  let observer;
  let scheduled = false;
  let connected = [];
  let lastSelect = null;
  let selectedAccount = '';

  function findSetupButtons() {
    return Array.from(document.querySelectorAll('button')).filter(b =>
      (b.textContent || '').trim() === ACCOUNT_ACTION &&
      !b.disabled && b.isConnected
    );
  }

  function oneAccountForButton(button) {
    let node = button.parentElement;
    for (let i = 0; node && i < 9; i++, node = node.parentElement) {
      const text = node.textContent || '';
      const mails = Array.from(new Set((text.match(emailRE) || []).map(x => x.toLowerCase())));
      if (mails.length === 1) {
        const account = mails[0];
        return {
          email: account,
          button,
          notConfigured: /ตั้งแหล่งเมลก่อน|ยังไม่ได้เลือก|ต้องตั้งค่าก่อน\s*Sync|ยังไม่เคย\s*Sync/i.test(text)
        };
      }
      // Reached multi-account parent. Never guess which mailbox this button owns.
      if (mails.length > 1) break;
    }
    return null;
  }

  function listConnectedAccounts() {
    const byEmail = new Map();
    findSetupButtons().forEach(button => {
      const account = oneAccountForButton(button);
      if (account) byEmail.set(account.email, account);
    });
    return Array.from(byEmail.values());
  }

  function getFilter() {
    return document.querySelector(SELECTOR);
  }

  function noteNodes(filter) {
    const id = 'naknaRecruitmentConnectedMailHelp';
    let note = document.getElementById(id);
    if (!note) {
      note = document.createElement('div');
      note.id = id;
      note.className = CLASS;
      note.setAttribute('role', 'group');
      note.setAttribute('aria-label', 'ตัวช่วยเลือก Gmail ที่เชื่อมแล้ว');
      const text = document.createElement('span');
      text.className = `${CLASS}__text`;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `${CLASS}__button`;
      const message = document.createElement('div');
      message.className = `${CLASS}__detail`;
      note.append(text, button, message);
      button.addEventListener('click', () => {
        // Never change account settings directly; invoke the original action.
        const account = connected.find(a => a.email === selectedAccount) || connected[0];
        if (!account?.button?.isConnected || account.button.disabled) return;
        account.button.click();
      });
    }
    // Keep the note *outside* the controls row to avoid squeezing the search field.
    let after = filter.parentElement;
    for (let i = 0; i < 3 && after?.parentElement; i++) {
      const siblings = after.querySelectorAll?.('select, input[type="search"]') || [];
      if (siblings.length >= 2) break;
      if (after.parentElement.querySelectorAll('select, input[type="search"]').length > 4) break;
      after = after.parentElement;
    }
    if (after && after.nextElementSibling !== note) after.insertAdjacentElement('afterend', note);
    return note;
  }

  function updateFilter(filter, accounts) {
    // Drop only options added by this patch if a connected account disappears
    // or the HR user switches Workspace. Never remove original imported options.
    const active = new Set(accounts.map(a => a.email));
    for (const opt of Array.from(filter.options)) {
      if (opt.dataset.naknaConnectedMailbox === '1' && !active.has(String(opt.value).toLowerCase())) opt.remove();
    }
    if (filter.selectedIndex < 0) filter.value = '';
    // A queue filter used to list only mailboxes from imported rows. Include
    // *connected* recruitment inboxes even before their first successful sync.
    const existing = new Set(Array.from(filter.options).map(o => String(o.value || '').toLowerCase()));
    for (const account of accounts) {
      if (existing.has(account.email)) continue;
      const opt = new Option(account.email, account.email);
      opt.dataset.naknaConnectedMailbox = '1';
      filter.add(opt);
      existing.add(account.email);
    }
  }

  function updateNote(note, filter, accounts) {
    const message = note.querySelector(`.${CLASS}__text`);
    const button = note.querySelector(`.${CLASS}__button`);
    const detail = note.querySelector(`.${CLASS}__detail`);
    const actualSelected = String(filter.value || '').toLowerCase();
    const current = accounts.find(a => a.email === actualSelected) || accounts[0];
    selectedAccount = current?.email || '';
    if (!current) {
      if (message.textContent !== 'ยังไม่พบบัญชี Gmail รับสมัครงานที่เชื่อมอยู่')
        message.textContent = 'ยังไม่พบบัญชี Gmail รับสมัครงานที่เชื่อมอยู่';
      button.hidden = true;
      detail.textContent = 'เชื่อมบัญชีรับสมัครงานจากด้านบนก่อน แล้วตั้งแหล่งเมล';
      return;
    }
    const msg = current.notConfigured
      ? `เชื่อม ${current.email} แล้ว แต่ยังไม่ได้ตั้งแหล่งเมล/Sync`
      : `เชื่อม Gmail รับสมัครงานแล้ว: ${current.email}`;
    if (message.textContent !== msg) message.textContent = msg;
    const btnText = `ตั้งค่าเมล ${current.email}`;
    if (button.textContent !== btnText) button.textContent = btnText;
    button.hidden = false;
    const tip = current.notConfigured
      ? 'กดตั้งค่าแหล่งเมลก่อน จากนั้นจึง Sync เพื่อให้คิวผู้สมัครมีข้อมูล'
      : 'ตัวเลือก Gmail นี้ใช้กรองคิวอีเมลที่ Sync มาแล้ว ไม่ใช่ปุ่มเชื่อมบัญชี';
    if (detail.textContent !== tip) detail.textContent = tip;
  }

  function enhance() {
    const filter = getFilter();
    if (!filter) {
      document.getElementById('naknaRecruitmentConnectedMailHelp')?.remove();
      lastSelect = null;
      return;
    }
    connected = listConnectedAccounts();
    updateFilter(filter, connected);
    if (!connected.length) {
      document.getElementById('naknaRecruitmentConnectedMailHelp')?.remove();
      selectedAccount = '';
      return;
    }
    // Preserve native filter event handlers: append <option> only.
    if (filter !== lastSelect) {
      filter.addEventListener('change', () => schedule());
      lastSelect = filter;
    }
    const note = noteNodes(filter);
    updateNote(note, filter, connected);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      // Never call app APIs or alter existing event handlers.
      try {
        if (observer) observer.disconnect();
        enhance();
      } catch (error) {
        console.warn('[Nakna P10.7] account selector enhancement skipped:', error);
      } finally {
        if (observer) observer.observe(document.body, {childList: true, subtree: true});
      }
    });
  }

  function init() {
    observer = new MutationObserver(() => schedule());
    observer.observe(document.body, {childList: true, subtree: true});
    schedule();
  }
  window.NaknaRecruitmentMailbox = {version: VERSION, refresh: schedule};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();
