/* Nakna loading presentation: no requests, identity checks, or artificial percentages. */
(()=>{
  const records=new Map();
  const splash=()=>document.getElementById('bootSplash');
  let rescue=null;
  function status(message,retry=false){
    const el=document.getElementById('bootStatusText');if(el)el.textContent=message;
    document.getElementById('bootRetryBtn')?.classList.toggle('hidden',!retry);
    splash()?.classList.toggle('is-waiting',retry);
    const hint=document.getElementById('bootHint');if(hint)hint.textContent=retry?'คุณลองเชื่อมต่อใหม่ได้ โดยไม่ต้องปิดหน้านี้':'เมนูจะเปิดให้ใช้งานทันทีที่ตรวจสอบบัญชีเสร็จ';
  }
  function beginBoot(){clearTimeout(rescue);status('กำลังตรวจสอบบัญชีของคุณ');rescue=setTimeout(()=>{if(!splash()?.classList.contains('hidden'))status('เปิดระบบนานกว่าปกติ ลองเชื่อมต่ออีกครั้งได้',true);},12000);}
  function endBoot(){clearTimeout(rescue);rescue=null;}
  function clear(name){const rec=records.get(name);if(!rec)return;clearTimeout(rec.delay);clearTimeout(rec.slow);rec.frame?.remove();rec.view.classList.remove('nk-first-load');rec.view.setAttribute('aria-busy','false');records.delete(name);}
  function beginView(name,{first=false,label='กำลังโหลดข้อมูล',retry}={}){
    const view=document.getElementById('view-'+name);if(!view)return;
    clear(name);view.querySelector(':scope > .nk-load-error')?.remove();view.setAttribute('aria-busy','true');
    const rec={view,frame:null,delay:null,slow:null};records.set(name,rec);
    // Fast responses never flash a loader. Only an empty first visit uses skeletons.
    rec.delay=setTimeout(()=>{
      if(records.get(name)!==rec)return;
      const frame=document.createElement('div');frame.className='nk-loading-frame';frame.setAttribute('role','status');frame.setAttribute('aria-live','polite');
      const heading=document.createElement('p');heading.className='nk-loading-caption';heading.textContent=label;frame.append(heading);
      if(first){const shapes=document.createElement('div');shapes.className='nk-loading-shapes';shapes.setAttribute('aria-hidden','true');shapes.innerHTML='<div class="nk-loading-metrics"><i></i><i></i><i></i></div><div class="nk-loading-rows"><i></i><i></i><i></i><i></i></div>';frame.append(shapes);view.classList.add('nk-first-load');}
      view.prepend(frame);rec.frame=frame;
    },180);
    rec.slow=setTimeout(()=>{if(records.get(name)!==rec||!rec.frame)return;const message=rec.frame.querySelector('.nk-loading-caption');if(message)message.textContent='ข้อมูลตอบช้ากว่าปกติ กำลังรอการเชื่อมต่อ…';},7000);
  }
  function endView(name,{failed=false,retry}={}){
    const view=document.getElementById('view-'+name);clear(name);if(!view||!failed)return;
    view.querySelector(':scope > .nk-load-error')?.remove();
    const note=document.createElement('div');note.className='nk-load-error';note.setAttribute('role','alert');const text=document.createElement('span');text.textContent='โหลดข้อมูลได้ไม่ครบ ข้อมูลบางส่วนอาจยังไม่อัปเดต';note.append(text);
    if(retry){const button=document.createElement('button');button.type='button';button.className='secondary-btn';button.textContent='ลองอีกครั้ง';button.onclick=()=>{button.disabled=true;Promise.resolve().then(retry).catch(()=>{button.disabled=false;}).finally(()=>{if(button.isConnected)button.disabled=false;});};note.append(button);}view.prepend(note);
  }
  window.NaknaLoading={status,beginBoot,endBoot,beginView,endView};
  document.getElementById('bootRetryBtn')?.addEventListener('click',()=>window.location.reload());
  beginBoot();
})();
