/* P10.11: connect the existing attendance renderer to its redesigned markup. */
(() => {
  const init=()=>{
    const root=document.querySelector('#view-attendance'); if(!root)return;
    const $=s=>root.querySelector(s);
    const tabs=[...root.querySelectorAll('[data-nd-tab]')];
    const selectTab=key=>{
      tabs.forEach(b=>{const on=b.dataset.ndTab===key;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});
      root.querySelectorAll('.nd-pane').forEach(p=>p.hidden=p.id!==`ndPane-${key}`);
      if($('#ndSharedFilters'))$('#ndSharedFilters').hidden=key==='queue';
    };
    tabs.forEach(b=>b.addEventListener('click',()=>selectTab(b.dataset.ndTab)));
    $('#ndTabs')?.addEventListener('keydown',e=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
      const visible=tabs.filter(b=>!b.hidden);let i=visible.indexOf(document.activeElement);if(i<0)return;
      e.preventDefault();i=e.key==='Home'?0:e.key==='End'?visible.length-1:(i+(e.key==='ArrowRight'?1:-1)+visible.length)%visible.length;
      visible[i].click();visible[i].focus();
    });
    $('#ndPeriodSelect')?.addEventListener('change',e=>{
      $(`#teamWorkLogMode [data-worklog-mode="${e.target.value}"]`)?.click();
    });
    $('#ndFilterToggle')?.addEventListener('click',()=>{
      const p=$('#ndFilterOptions');p.hidden=!p.hidden;$('#ndFilterToggle').setAttribute('aria-expanded',String(!p.hidden));
    });
    const sync=()=>{
      const active=$('#teamWorkLogMode .active')?.dataset.worklogMode;
      if(active&&$('#ndPeriodSelect'))$('#ndPeriodSelect').value=active;
      const strip=$('#ndMetricStrip'),summary=$('#teamWorkLogSummary');
      if(strip&&summary){
        const markup=[...summary.children].slice(0,4).map(n=>n.outerHTML).join('');
        if(strip.innerHTML!==markup)strip.innerHTML=markup;
      }
      const queue=$('#attendanceRetroApprovalPanel'),tab=$('#ndTab-queue');
      if(tab&&queue){tab.hidden=queue.hidden||queue.classList.contains('hidden');
        if(tab.hidden&&tab.getAttribute('aria-selected')==='true')selectTab('list');}
      const count=$('#attendanceRetroApprovalCount')?.textContent||'0';
      if($('#ndPendingCount'))$('#ndPendingCount').textContent=count;
      const dept=$('#teamWorkLogDepartmentFilter'),status=$('#teamWorkLogStatusFilter');
      if($('#ndFilterDescription'))$('#ndFilterDescription').textContent=[dept?.selectedOptions[0]?.textContent,status?.selectedOptions[0]?.textContent].filter(Boolean).join(' · ');
    };
    for(const id of ['teamWorkLogSummary','teamWorkLogMode','attendanceRetroApprovalPanel']){
      const node=$('#'+id);if(node)new MutationObserver(sync).observe(node,{subtree:true,childList:true,attributes:true,characterData:true});
    }
    for(const id of ['teamWorkLogDepartmentFilter','teamWorkLogStatusFilter'])$('#'+id)?.addEventListener('change',sync);
    selectTab('list');sync();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
