/* NAKNA P10.5 — Progressive UX simplification (presentation-only).
   Keeps the canonical tables, actions, requests, authentication and business rules untouched.
   No external requests or persistence; every action delegates to existing UI controls. */
(() => {
  'use strict';
  if (window.NaknaSimplify) return;
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const create = (tag, cls, txt) => {
    const n=document.createElement(tag);
    if(cls)n.className=cls;
    if(txt !== undefined)n.textContent=txt;
    return n;
  };
  const action = (label, cls='nk105-action') => {
    const b=create('button',cls,label); b.type='button'; return b;
  };
  const small=window.matchMedia('(max-width: 720px)');
  let initialized=false;
  let peopleFrame=0, leaveFrame=0, semFrame=0, attendanceFrame=0, payrollFrame=0;
  const metrics={peopleRenders:0,leaveRenders:0,modifiedEndpoints:0,version:'P10.5-ux1'};
  function schedule(cb, type){
    let frame;
    if(type==='people'){if(peopleFrame)return;peopleFrame=requestAnimationFrame(()=>{peopleFrame=0;cb();});return;}
    if(type==='leave'){if(leaveFrame)return;leaveFrame=requestAnimationFrame(()=>{leaveFrame=0;cb();});return;}
    if(type==='semantic'){if(semFrame)return;semFrame=requestAnimationFrame(()=>{semFrame=0;cb();});return;}
    if(type==='attendance'){if(attendanceFrame)return;attendanceFrame=requestAnimationFrame(()=>{attendanceFrame=0;cb();});return;}
    if(type==='payroll'){if(payrollFrame)return;payrollFrame=requestAnimationFrame(()=>{payrollFrame=0;cb();});return;}
    frame=requestAnimationFrame(cb);return frame;
  }
  function observe(el, cb, options={childList:true,subtree:true}){
    if(!el)return;
    const mo=new MutationObserver(cb);mo.observe(el,options);return mo;
  }
  function makeHeading(label,sub){
    const wrap=create('div','nk105-list-heading');
    wrap.append(create('strong','',label));
    if(sub) wrap.append(create('small','',sub));
    return wrap;
  }
  function initDashboard(){
    const view=$('#view-dashboard');if(!view)return;
    const ops=$('.operations-dashboard-grid',view);
    const more=$('.secondary-dashboard-grid',view);
    const primary=$('.primary-dashboard-grid',view);
    if(ops&&primary&&!$('#nk105DashboardExtra')){
      const button=action('ดู Payroll, เอกสาร และรายงานอื่น','nk105-reveal');
      button.id='nk105DashboardExtra';button.setAttribute('aria-expanded','false');
      if(ops)ops.id='nk105DashboardOps';if(more)more.id='nk105DashboardSecondary';
      button.setAttribute('aria-controls','nk105DashboardOps nk105DashboardSecondary');
      const hint=create('span','nk105-reveal-icon','⌄');button.append(hint);
      primary.after(button);
      // Do not move/reparent existing module containers: their original handlers stay intact.
      button.addEventListener('click',()=>{
        const open=view.classList.toggle('nk105-dashboard-expanded');
        button.setAttribute('aria-expanded',String(open));
        button.firstChild.textContent=open?'ซ่อนรายงานเพิ่มเติม':'ดู Payroll, เอกสาร และรายงานอื่น';
      });
    }
    const summary=$('#summaryGrid');
    const att=$('#attendanceSnapshot');
    const fix=()=>schedule(()=>{
      $$('.summary-item',summary||document).forEach(card=>{
        const label=$('.summary-label',card);
        if(label && /ยังไม่เช็กอิน|ยังไม่มา/.test(label.textContent||'')){
          // Absence cannot be determined from a missing check-in alone.
          const dot=$('.summary-dot',label);
          const textNodes=Array.from(label.childNodes).filter(n=>n.nodeType===Node.TEXT_NODE);
          for(const n of textNodes){const newText=n.textContent.replace(/ยังไม่เช็กอิน|ยังไม่มา/g,'ยังไม่ลงเวลา');if(n.textContent!==newText)n.textContent=newText;}
          if(dot){dot.classList.remove('danger');dot.classList.add('neutral');}
          card.classList.add('nk105-neutral-missing');
        }
      });
      $$('.attendance-mini-grid >div',att||document).forEach(row=>{
        const span=$('span',row);
        if(span && span.textContent.trim()==='ยังไม่มา')span.textContent='ยังไม่ลงเวลา';
        if(row.classList.contains('warn') && /ยังไม่ลงเวลา/.test(row.textContent||''))row.classList.remove('warn');
      });
    },'semantic');
    observe(summary,fix);observe(att,fix);fix();
  }
  function renderPeopleList(){
    const body=$('#employeesBody'),out=$('#nk105PeopleList');if(!body||!out)return;
    metrics.peopleRenders++;
    const fragment=document.createDocumentFragment();
    const rows=$$('tr',body).filter(r=>r.cells?.length>1 && r.querySelector('.employee-row-actions'));
    if(!rows.length){
      const content=body.textContent?.trim()||'ยังไม่มีข้อมูลพนักงาน';
      fragment.append(create('p','nk105-empty',content.slice(0,200)));
    }
    for(const row of rows){
      const name=$('.person strong',row)?.textContent?.trim()||'พนักงาน';
      const code=$('.person small',row)?.textContent?.trim()||'';
      const cols=$$('td',row);
      const dept=cols[1]?.textContent?.trim()||'—';
      const position=cols[2]?.textContent?.trim()||'';
      const line=cols[20]?.textContent?.trim()||'';
      const status=$('.people-status',row)?.textContent?.trim()||'';
      const card=create('details','nk105-person');
      const head=create('summary','nk105-person-head');
      const avatar=create('span','nk105-person-avatar',(name||'?').charAt(0).toLocaleUpperCase('th-TH'));
      const text=create('span','nk105-person-main');
      text.append(create('strong','',name));
      text.append(create('small','',`${dept}${position&&position!=='—'?' · '+position:''}`));
      const meta=create('span','nk105-person-meta');
      if(/เชื่อมแล้ว/.test(line))meta.append(create('span','nk105-line-state is-connected','LINE ✓'));
      else if(/ยังไม่เชื่อม/.test(line))meta.append(create('span','nk105-line-state','ยังไม่เชื่อม'));
      const arrow=create('span','nk105-chevron','⌄');
      head.append(avatar,text,meta,arrow);card.append(head);
      const inner=create('div','nk105-person-details');
      if(code)inner.append(create('small','nk105-employee-code',code));
      if(status)inner.append(create('small','nk105-employee-status',status));
      const links=create('div','nk105-person-buttons');
      const original=$$('.employee-row-actions button',row).filter(btn=>!btn.disabled && !btn.classList.contains('nk-row-toggle'));
      const priority=['โปรไฟล์','เอกสาร','แก้ไข','ตั้งสิทธิ์ลา'];
      const uniq=new Set();
      const sorted=[...original].sort((a,b)=>{
        const pos=(b)=>{const ix=priority.indexOf(b.textContent?.trim());return ix<0?999:ix;};return pos(a)-pos(b);
      });
      for(const b of sorted){
        const label=b.textContent?.trim()||'';
        if(!label||uniq.has(label))continue;
        uniq.add(label);
        const el=action(label,`nk105-person-btn${/ลบ/.test(label)?' is-danger':''}`);
        el.addEventListener('click',()=>b.click());
        links.append(el);
      }
      inner.append(links);card.append(inner);fragment.append(card);
    }
    out.replaceChildren(fragment);
  }
  function initPeople(){
    const view=$('#view-employees'),body=$('#employeesBody');if(!view||!body)return;
    const wrap=body.closest('.employee-master-table-card');if(!wrap)return;
    if(!$('#nk105PeopleList')){
      const list=create('div','nk105-people-list');list.id='nk105PeopleList';
      list.setAttribute('aria-label','รายชื่อพนักงานแบบกระชับ');
      wrap.before(list);
    }
    const cb=()=>schedule(renderPeopleList,'people');observe(body,cb);
    cb();
  }
  function initAttendance(){
    const view=$('#view-attendance');if(!view)return;
    const date=$('#teamWorkLogSummary');
    if(date){
      const normalize=()=>schedule(()=>{
        const active=$('#teamWorkLogMode [data-worklog-mode].active');
        const singleDay=!active||['today','day'].includes(active.dataset.worklogMode);
        const cells=$$('#teamWorkLogSummary >div');
        const x=cells.find(el=>/ขาด\s*\/\s*ไม่ลงเวลา/.test(el.textContent||''));
        if(x){const title=$('span',x);
          if(title&&title.textContent!== (singleDay?'ยังไม่มีบันทึกเวลา':'ไม่มีบันทึกเวลา')) title.textContent=singleDay?'ยังไม่มีบันทึกเวลา':'ไม่มีบันทึกเวลา';
          // Not a confirmed absence; keep the count from the original report unchanged.
          x.classList.add('nk105-unconfirmed');
          const unit=$('small',x);
          if(unit && singleDay && unit.textContent.trim()==='วัน') unit.textContent='คน';
          x.setAttribute('title','ไม่มีรายการลงเวลา ไม่ได้ยืนยันว่าพนักงานขาดงาน');
        }
      },'attendance');
      observe(date,normalize);normalize();
      $$('#teamWorkLogMode [data-worklog-mode]').forEach(b=>b.addEventListener('click',normalize));
    }
    // Keep the complete original controls, just contextualize what the count does and doesn't prove.
    if(!$('#nk105AttendanceContext')){
      const hint=create('p','nk105-hint','ไม่มีรายการเช็กอิน ≠ ขาดงาน ต้องตรวจตารางเวร วันหยุด และคำขอย้อนหลังก่อนสรุป');
      hint.id='nk105AttendanceContext';
      const list=$('#nkTeamWorkLogMobile');if(list)list.before(hint);
    }
  }
  function renderLeavePeople(){
    const body=$('#leaveUnifiedPeople'),out=$('#nk105LeavePeople');if(!body||!out)return;
    metrics.leaveRenders++;
    const frag=document.createDocumentFragment();
    const rows=$$('tr',body).filter(r=>r.cells?.length===8);
    if(!rows.length){frag.append(create('p','nk105-empty',body.textContent?.trim()||'ไม่พบข้อมูล'));}
    for(const row of rows){
      const cols=$$('td',row);
      const name=$('strong',cols[0])?.textContent?.trim()||'พนักงาน';
      const dept=cols[1].textContent.trim(),times=cols[2].textContent.trim(),days=cols[3].textContent.trim();
      const card=create('details','nk105-leave-person');
      const header=create('summary','nk105-leave-person-head');
      const center=create('span','nk105-leave-person-name');center.append(create('strong','',name),create('small','',dept));
      const counts=create('span','nk105-leave-counts');counts.append(create('b','',times),create('small','',days));
      header.append(center,counts,create('span','nk105-chevron','⌄'));
      card.append(header);
      const info=create('div','nk105-leave-person-extra');
      const sub=[['แยกประเภท',4],['รออนุมัติ',5],['รอหลักฐาน',6],['ไม่อนุมัติ',7]];
      for(const [title,index] of sub){
        const item=create('div','nk105-detail-row');item.append(create('span','',title),create('span','',cols[index]?.textContent?.trim()||'—'));info.append(item);
      }
      const old=$('.nk-detail-button',row);
      if(old){const b=action('ดูประวัติการลา →','nk105-person-btn');b.addEventListener('click',()=>old.click());info.append(b);}
      card.append(info);frag.append(card);
    }
    out.replaceChildren(frag);
  }
  function initLeave(){
    const view=$('#view-leave'),body=$('#leaveUnifiedPeople');if(!view||!body)return;
    const wrap=body.closest('.leave-report-table-wrap');
    if(wrap&&!$('#nk105LeavePeople')){
      const list=create('div','nk105-leave-people-list');list.id='nk105LeavePeople';list.setAttribute('aria-label','สรุปการลารายพนักงาน');wrap.before(list);
    }
    observe(body,()=>schedule(renderLeavePeople,'leave'));
    schedule(renderLeavePeople,'leave');
    const charts=$('.leave-report-grid',view);
    if(charts&&!$('#nk105LeaveChartsToggle')){
      const button=action('ดูแยกประเภทลาและสถิติเพิ่มเติม','nk105-reveal');button.id='nk105LeaveChartsToggle';
      button.setAttribute('aria-controls','nk105LeaveCharts');button.setAttribute('aria-expanded','false');
      charts.id='nk105LeaveCharts';charts.before(button);
      button.addEventListener('click',()=>{
        const next=view.classList.toggle('nk105-leave-charts-open');button.setAttribute('aria-expanded',String(next));
        button.textContent=next?'ซ่อนสถิติเพิ่มเติม':'ดูแยกประเภทลาและสถิติเพิ่มเติม';
      });
    }
    const summary=$('#leaveUnifiedSummary');
    if(summary && !$('#nk105LeaveStatsToggle')){
      const button=action('ดูสถานะใบลาเพิ่มเติม','nk105-mini-reveal');
      button.id='nk105LeaveStatsToggle';button.setAttribute('aria-controls','leaveUnifiedSummary');
      button.setAttribute('aria-expanded','false');summary.after(button);
      button.addEventListener('click',()=>{
        const open=summary.classList.toggle('nk105-all-stats');button.setAttribute('aria-expanded',String(open));
        button.textContent=open?'ย่อสถานะใบลา':'ดูสถานะใบลาเพิ่มเติม';
      });
    }
    const filter=$('#nkLeaveFilterPanel');if(filter&&small.matches)filter.open=false;
    const tabs=$('#nkLeaveTabs');if(tabs) tabs.classList.add('nk105-leave-tabs');
  }
  function updatePayrollSummary(){
    const root=$('#payrollSummary');if(!root)return;
    const items=$$('.payroll-summary-card',root);
    const toggle=$('#nk105PayrollSummaryMore');if(toggle)toggle.hidden=items.length<=2;
    const periods=$$('#payrollPeriods .payroll-period-row');
    const withPeriod=periods.length>0;
    items.forEach((item,i)=>item.classList.toggle('nk105-payroll-secondary',withPeriod?![0,3].includes(i):![0,1].includes(i)));
    const detail=$('#payrollDetail');
    const hasDetails=Boolean(detail&&detail.querySelector('.payroll-detail-head'));
    const view=$('#view-payroll');if(view)view.classList.toggle('nk105-has-payroll-detail',hasDetails);
  }
  function initPayroll(){
    const view=$('#view-payroll');if(!view)return;
    const root=$('#payrollSummary'), periods=$('#payrollPeriods'),detail=$('#payrollDetail');
    if(root && !$('#nk105PayrollSummaryMore')){
      const more=action('ดูยอดและรายละเอียดอื่น','nk105-reveal');more.id='nk105PayrollSummaryMore';
      more.setAttribute('aria-expanded','false');more.setAttribute('aria-controls','payrollSummary');
      root.after(more);
      more.addEventListener('click',()=>{
        const expanded=root.classList.toggle('nk105-payroll-expanded');more.setAttribute('aria-expanded',String(expanded));
        more.textContent=expanded?'แสดงเฉพาะยอดสำคัญ':'ดูยอดและรายละเอียดอื่น';
      });
    }
    if(periods && !$('#nk105PayrollPeriodToggle')){
      const panel=periods.closest('.payroll-period-panel');
      const header=$('.panel-head',panel||document);
      if(header){
        const toggle=action('เปลี่ยนรอบเงินเดือน ⌄','nk105-period-toggle');toggle.id='nk105PayrollPeriodToggle';toggle.setAttribute('aria-expanded','false');
        toggle.setAttribute('aria-controls','payrollPeriods');header.append(toggle);
        toggle.addEventListener('click',()=>{
          const opened=view.classList.toggle('nk105-periods-open');toggle.setAttribute('aria-expanded',String(opened));
          toggle.textContent=opened?'ย่อรายการรอบเงินเดือน ⌃':'เปลี่ยนรอบเงินเดือน ⌄';
        });
      }
    }
    const cb=()=>schedule(updatePayrollSummary,'payroll');
    observe(root,cb);observe(periods,cb);observe(detail,cb);cb();
  }
  function init(){
    if(initialized||!$('#appShell'))return;
    initialized=true;
    document.documentElement.classList.add('nk105');
    initDashboard();initPeople();initAttendance();initLeave();initPayroll();
    window.NaknaSimplify={version:'P10.5-ux1',diagnostics:()=>({...metrics})};
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
