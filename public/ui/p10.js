/* NAKNA P10.0 — progressive presentation controller.
 * No fetch/XHR, no endpoint/payload changes, no employee data stored.
 * Moves/reuses existing nodes and calls existing UI handlers; never clones forms.
 */
(() => {
  'use strict';
  if (window.NaknaUI) return;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const small = window.matchMedia('(max-width: 720px)');
  const drawer = window.matchMedia('(max-width: 1000px)');
  const metrics = { flushes: 0, lastDurationMs: 0, annotatedTables: 0 };
  let observer, frame = 0, initialized = false, leaveTab = 'overview', wasDrawerOpen = false;
  let labelId = 0;
  const make = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  function button(className, text) {
    const el = make('button', className, text);
    el.type = 'button';
    return el;
  }
  function setAttr(el, key, value) { if (el && el.getAttribute(key) !== String(value)) el.setAttribute(key, String(value)); }
  function available(el) {
    return !!el && !el.closest('.hidden,[hidden]') && !el.disabled && getComputedStyle(el).display !== 'none';
  }
  // Header mapping supports colspan + rowspan without guessing payroll field names.
  function columnLabels(table) {
    const grid = [];
    Array.from(table.tHead?.rows || []).forEach((row, ri) => {
      grid[ri] ||= [];
      let col = 0;
      Array.from(row.cells).forEach(cell => {
        while (grid[ri][col] !== undefined) col++;
        const value = cell.textContent.replace(/\s+/g, ' ').trim();
        for (let r = 0; r < cell.rowSpan; r++) {
          grid[ri + r] ||= [];
          for (let c = 0; c < cell.colSpan; c++) grid[ri + r][col + c] = value;
        }
        if (!cell.hasAttribute('scope')) cell.scope = cell.colSpan > 1 ? 'colgroup' : 'col';
        col += cell.colSpan;
      });
    });
    const n = Math.max(0, ...grid.map(r => r.length));
    return Array.from({ length: n }, (_, c) => {
      const names = grid.map(r => r[c]).filter(Boolean);
      return names.at(-1) || '';
    });
  }
  function annotateTables(scope) {
    $$('table', scope).forEach(table => {
      if (table.closest('.document-a4-preview-sheet,[data-nk-no-enhance]')) return;
      const labels = columnLabels(table);
      if (!labels.length) return;
      const employee = table.tBodies[0]?.id === 'employeesBody';
      const matrix = !employee && (table.closest('#view-payroll') || /worklog-matrix|payroll-sheet|payroll-setup-table/.test(table.className));
      if (!table.classList.contains('nk-table')) metrics.annotatedTables++;
      table.classList.add('nk-table');
      table.classList.toggle('nk-people-table', employee);
      table.classList.toggle('nk-matrix', !!matrix);
      setAttr(table, 'role', 'table');
      if (!table.getAttribute('aria-label')) {
        setAttr(table, 'aria-label', $('h3,h2,h1', table.closest('article,section') || scope)?.textContent.trim() || 'ตารางข้อมูล');
      }
      let wrap = table.parentElement;
      if (!wrap || !/DIV|SECTION/.test(wrap.tagName) || wrap.children.length > 2) {
        wrap = make('div', 'nk-table-wrap');
        table.before(wrap); wrap.append(table);
      }
      wrap.classList.add('nk-table-wrap');
      wrap.classList.toggle('nk-matrix-wrap', !!matrix);
      if (matrix) {
        setAttr(wrap, 'tabindex', '0');
        setAttr(wrap, 'role', 'region');
        setAttr(wrap, 'aria-label', 'ตารางเลื่อนแนวนอนได้ เพื่อดูข้อมูลทุกคอลัมน์');
        if (!wrap.previousElementSibling?.classList.contains('nk-scroll-hint')) {
          const hint = make('div', 'nk-scroll-hint', 'เลื่อนในตารางเพื่อดูข้อมูลทั้งหมด ↔');
          wrap.before(hint);
        }
      }
      const essential = new Set(['พนักงาน', 'แผนก', 'ตำแหน่ง', 'LINE', 'จัดการ']);
      Array.from(table.tHead?.rows || []).forEach(row => {
        setAttr(row, 'role', 'row');
        Array.from(row.cells).forEach((c, i) => {
          if (employee && !essential.has(labels[i])) setAttr(c, 'data-nk-extra', '');
        });
      });
      for (const tbody of table.tBodies) {
        for (const row of tbody.rows) {
          setAttr(row, 'role', 'row');
          let col = 0;
          for (const cell of row.cells) {
            if (cell.colSpan === 1) {
              if (!cell.dataset.label) setAttr(cell, 'data-label', labels[col] || 'ข้อมูล');
              if (employee && !essential.has(labels[col])) setAttr(cell, 'data-nk-extra', '');
            }
            setAttr(cell, 'role', cell.tagName === 'TH' ? 'rowheader' : 'cell');
            col += cell.colSpan;
          }
          if (employee && row.cells.length > 1) enhanceEmployeeRow(row);
          if (tbody.id === 'leaveUnifiedDetails' && Number(row.dataset.nkLeaveId) > 0) addLeaveDetailButton(row);
          if (tbody.id === 'leaveUnifiedPeople' && Number(row.dataset.nkEmployeeId) > 0) addEmployeeHistoryButton(row);
        }
      }
      if (employee && !wrap.previousElementSibling?.classList.contains('nk-table-tools')) {
        const tools = make('div', 'nk-scroll-hint nk-table-tools');
        tools.append(make('span', '', 'แสดงข้อมูลหลัก · เปิดรายละเอียดได้รายคน'));
        const toggle = button('nk-table-mode', 'แสดงทุกคอลัมน์');
        toggle.setAttribute('aria-pressed', 'false');
        toggle.addEventListener('click', () => {
          const all = table.classList.toggle('nk-show-all');
          toggle.textContent = all ? 'แสดงข้อมูลหลัก' : 'แสดงทุกคอลัมน์';
          toggle.setAttribute('aria-pressed', String(all));
          wrap.classList.toggle('nk-matrix-wrap', all && !small.matches);
        });
        tools.append(toggle); wrap.before(tools);
      }
    });
  }
  function enhanceEmployeeRow(row) {
    const actions = $('.employee-row-actions', row);
    if (!actions) return;
    $$('button', actions).forEach(el => {
      if (el.classList.contains('nk-row-toggle')) return;
      const text = el.textContent.trim();
      if (!['โปรไฟล์', 'เอกสาร'].includes(text)) setAttr(el, 'data-nk-action-extra', '');
    });
    if (!$('.nk-row-toggle', row)) {
      const toggle = button('nk-row-toggle', 'เพิ่มเติม');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.addEventListener('click', () => {
        const expanded = row.classList.toggle('nk-expanded');
        toggle.textContent = expanded ? 'ย่อรายละเอียด' : 'เพิ่มเติม';
        toggle.setAttribute('aria-expanded', String(expanded));
      });
      actions.append(toggle);
    }
  }
  function addLeaveDetailButton(row) {
    if ($('.nk-detail-button', row)) return;
    const b = button('nk-detail-button', 'ดูรายละเอียด →');
    b.addEventListener('click', () => {
      if (typeof window.openLeaveDetail === 'function') window.openLeaveDetail(Number(row.dataset.nkLeaveId));
    });
    row.cells[0].append(b);
  }
  function addEmployeeHistoryButton(row) {
    if ($('.nk-detail-button', row)) return;
    const b = button('nk-detail-button', 'ดูประวัติ →');
    b.addEventListener('click', () => {
      const select = $('#leaveUnifiedEmployee');
      const id = String(Number(row.dataset.nkEmployeeId));
      if (select && Array.from(select.options).some(o => o.value === id)) {
        select.value = id;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        setLeaveTab('history');
        $('#nkLeaveTabs')?.scrollIntoView({ block: 'start', behavior: 'auto' });
      }
    });
    row.cells[0].append(b);
  }
  function updateFilterSummary() {
    const ids = ['leaveUnifiedPeriod', 'leaveUnifiedYear', 'leaveUnifiedMonth', 'leaveUnifiedDay', 'leaveUnifiedFrom', 'leaveUnifiedTo', 'leaveUnifiedEmployee', 'leaveUnifiedDepartment', 'leaveUnifiedStatus', 'leaveUnifiedType'];
    const values = ids.flatMap(id => {
      const el = $('#' + id);
      if (!el || el.closest('[hidden]')) return [];
      return [el.tagName === 'SELECT' ? el.selectedOptions[0]?.textContent.trim() : el.value].filter(Boolean);
    });
    const out = $('#nkLeaveFilterSummary');
    if (out && out.textContent !== values.join(' · ')) out.textContent = values.join(' · ');
  }
  function setLeaveTab(tab, focus = false) {
    if (!['overview', 'queue', 'history', 'calendar'].includes(tab)) return;
    leaveTab = tab;
    const report = $('#leaveUnifiedPanel');
    if (report) report.hidden = !['overview', 'history'].includes(tab);
    $$('[data-nk-leave-pane]').forEach(el => { el.hidden = el.dataset.nkLeavePane !== tab; });
    $$('[data-nk-leave-tab]').forEach(el => {
      const active = el.dataset.nkLeaveTab === tab;
      setAttr(el, 'aria-selected', active); el.tabIndex = active ? 0 : -1;
      if (active && focus) el.focus();
    });
    const title = $('#leaveUnifiedPanel .panel-head h3');
    if (title) title.textContent = tab === 'history' ? 'ประวัติและสถานะคำขอ' : 'สรุปการลา';
    schedule();
  }
  function initLeave() {
    const tabs = $('#nkLeaveTabs');
    if (!tabs) return;
    tabs.addEventListener('click', e => {
      const b = e.target.closest('[data-nk-leave-tab]');
      if (b) setLeaveTab(b.dataset.nkLeaveTab);
    });
    tabs.addEventListener('keydown', e => {
      const items = $$('[role=tab]', tabs);
      const i = items.indexOf(document.activeElement);
      if (i < 0) return;
      let next;
      if (e.key === 'ArrowRight') next = (i + 1) % items.length;
      if (e.key === 'ArrowLeft') next = (i + items.length - 1) % items.length;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = items.length - 1;
      if (next !== undefined) { e.preventDefault(); setLeaveTab(items[next].dataset.nkLeaveTab, true); }
    });
    $('#leaveUnifiedPanel')?.addEventListener('change', () => { updateFilterSummary(); });
    const filter = $('#nkLeaveFilterPanel');
    if (filter) filter.open = !small.matches;
    // Desktop always exposes the filter bar. Mobile starts closed; user may expand it.
    small.addEventListener('change', e => { if (filter && !e.matches) filter.open = true; schedule(); });
    setLeaveTab('overview');
  }
  function navSource(view) { return $(`.sidebar .nav-item[data-view="${view}"]`); }
  function initNavigation() {
    const shell = $('#appShell'), sidebar = $('.sidebar'), menu = $('#mobileMenuBtn');
    if (!shell || !sidebar || !menu) return;
    if (!sidebar.id) sidebar.id = 'nkSidebar';
    menu.setAttribute('aria-controls', sidebar.id);
    const close = button('nk-nav-close', '×');
    close.setAttribute('aria-label', 'ปิดเมนู');
    close.addEventListener('click', () => { document.body.classList.remove('mobile-nav-open'); menu.focus(); schedule(); });
    sidebar.append(close);
    const nav = make('nav', 'nk-bottom-nav');
    nav.id = 'nkBottomNav'; nav.setAttribute('aria-label', 'เมนูลัดบนมือถือ');
    [['dashboard', 'ภาพรวม'], ['employees', 'พนักงาน'], ['attendance', 'เข้างาน'], ['leave', 'การลา']].forEach(([view, label]) => {
      const b = button('', ''); b.dataset.nkView = view;
      const icon = $('svg', navSource(view) || document.createElement('div'));
      if (icon) { const copy = icon.cloneNode(true); copy.setAttribute('aria-hidden', 'true'); b.append(copy); }
      b.append(make('span', '', label));
      b.addEventListener('click', () => { const source = navSource(view); if (available(source)) source.click(); });
      nav.append(b);
    });
    const more = button('', '');
    more.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span>เมนู</span>';
    more.addEventListener('click', () => menu.click()); nav.append(more);shell.append(nav);
    document.addEventListener('keydown', e => {
      if (!drawer.matches || !document.body.classList.contains('mobile-nav-open')) return;
      if (e.key === 'Escape') { document.body.classList.remove('mobile-nav-open'); menu.focus(); schedule(); return; }
      if (e.key === 'Tab') {
        const controls = $$('button,a[href],input,select,[tabindex="0"]', sidebar).filter(available);
        const first = controls[0], last = controls.at(-1);
        if (!first) return;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    drawer.addEventListener('change', () => { document.body.classList.remove('mobile-nav-open'); schedule(); });
  }
  function syncNavigation() {
    const sidebar = $('.sidebar'), menu = $('#mobileMenuBtn'), main = $('#nkMain');
    const open = drawer.matches && document.body.classList.contains('mobile-nav-open');
    if (sidebar) { sidebar.inert = drawer.matches && !open; setAttr(sidebar, 'aria-hidden', drawer.matches && !open); }
    if (main) main.inert = open;
    setAttr(menu, 'aria-expanded', open);
    if (open && !wasDrawerOpen) $('.nk-nav-close')?.focus();
    wasDrawerOpen = open;
    const current = $('.view.active')?.id.replace(/^view-/, '') || '';
    $$('#nkBottomNav [data-nk-view]').forEach(b => {
      const source = navSource(b.dataset.nkView);
      const allowed = available(source);
      b.hidden = !allowed;
      if (b.dataset.nkView === current) setAttr(b, 'aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    const nav = $('#nkBottomNav');
    if (nav) nav.style.gridTemplateColumns = `repeat($$('button:not([hidden])', nav).length},minmax(0,1fr))`;
    // Collapse only a duplicated heading, never the description or primary action.
    const title = $('#pageTitle')?.textContent.trim();
    $$('.view.active>.page-intro h1').forEach(h => h.classList.toggle('nk-duplicate-title', h.textContent.trim() === title));
  }
  function enhanceForms(root) {
    $$('.field', root).forEach(field => {
      const label = $('label', field), input = $('input:not([type=hidden]),select,textarea', field);
      if (label && input && !label.htmlFor && !label.contains(input)) {
        if (!input.id) input.id = 'nkField-' + (++labelId);
        label.htmlFor = input.id;
      }
    });
    $$('dialog', root).forEach(dialog => {
      if (!dialog.hasAttribute('aria-labelledby') && !dialog.hasAttribute('aria-label')) {
        const title = $('.modal-head h2,.modal-head h3,h2,h3', dialog);
        if (title) { if (!title.id) title.id = 'nkDialogTitle-' + (++labelId); dialog.setAttribute('aria-labelledby', title.id); }
      }
    });
  }
  function observe() {
    if (!observer) return;
    const shell = $('#appShell');
    if (shell) observer.observe(shell, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden'] });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    $$('dialog').forEach(d => observer.observe(d, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] }));
  }
  function flush() {
    frame = 0;
    const started = performance.now();
    observer?.disconnect();
    try {
      syncNavigation();
      const active = $('.view.active');
      if (active) {
        annotateTables(active); enhanceForms(active);
        $$('.payroll-mobile-card', active).forEach(card => {
          const edit = $('.payroll-mobile-quick-edit', card);
          if (!edit || edit.closest('.nk-payroll-edit')) return;
          const details = make('details', 'nk-payroll-edit');
          details.append(make('summary', '', 'แก้วัน / เงินเดือน / รายได้เพิ่ม'));
          edit.before(details); details.append(edit);
        });
      }
      $$('dialog[open]').forEach(d => { annotateTables(d); enhanceForms(d); });
      updateFilterSummary();
      metrics.flushes++;
      metrics.lastDurationMs = Math.round((performance.now() - started) * 100) / 100;
    } finally { observe(); }
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(flush); }
  function init() {
    if (initialized || !$('#appShell')) return;
    initialized = true;
    document.documentElement.classList.add('nk-p10');
    initNavigation(); initLeave(); enhanceForms(document);
    // P10.1: reports start compact on phones; native buttons remain keyboard-accessible.
    const attendanceReport=$('#nkAttendanceReportContent');
    const attendanceToggle=$('#nkAttendanceReportToggle');
    const attendanceMatrix=$('#nkAttendanceMatrixContainer');
    const matrixToggle=$('#nkAttendanceMatrixToggle');
    let reportOpen=false, matrixOpen=false;
    const syncAttendanceSections=()=>{
      if(attendanceReport) attendanceReport.hidden=small.matches&&!reportOpen;
      if(attendanceMatrix) attendanceMatrix.classList.toggle('nk-att-matrix-open',small.matches&&matrixOpen);
      if(attendanceToggle){attendanceToggle.setAttribute('aria-expanded',String(!small.matches||reportOpen)); attendanceToggle.firstChild.textContent=reportOpen?'ย่อรายงาน':'ดูสรุปรายคน ';}
      if(matrixToggle){matrixToggle.setAttribute('aria-expanded',String(matrixOpen));matrixToggle.firstChild.textContent=matrixOpen?'ซ่อนตารางรายละเอียด ':'ดูตารางแบบละเอียดทุกวัน ';}
    };
    attendanceToggle?.addEventListener('click',()=>{reportOpen=!reportOpen;syncAttendanceSections();});
    matrixToggle?.addEventListener('click',()=>{matrixOpen=!matrixOpen;syncAttendanceSections();});
    small.addEventListener('change',syncAttendanceSections);
    syncAttendanceSections();
    const settings = $('#settingsDetail');
    if (settings && !$('.nk-settings-top', settings)) {
      const bar = make('div', 'nk-settings-top');
      const back = button('', '← หมวดการตั้งค่าทั้งหมด');
      back.addEventListener('click', () => {
        if (typeof window.showSettingsHome === 'function') window.showSettingsHome();
      });
      bar.append(back); settings.prepend(bar);
    }
    // First the numbers, then shortcuts; existing click handlers remain attached.
    const grid = $('#summaryGrid'), shortcuts = $('.dashboard-quick-actions');
    if (grid && shortcuts) shortcuts.before(grid);
    observer = new MutationObserver(records => {
      if (records.some(r => !r.target.closest?.('.nk-scroll-hint,.nk-bottom-nav') && !r.target.closest?.('svg'))) schedule();
    });
    observe(); schedule();
  }
  window.NaknaUI = Object.freeze({ version: 'P10.1-attendance', refresh: schedule, setLeaveTab, columnLabels, metrics });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
