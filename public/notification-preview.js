// Render the same safe Flex JSON returned by the read-only preview API.
// Actions are deliberately inert: preview never opens links or sends postbacks.
const sizes={xxs:10,xs:12,sm:14,md:16,lg:18,xl:22,xxl:28,none:0};
const space={none:0,xs:3,sm:6,md:12,lg:18,xl:24,xxl:30};
const length=value=>typeof value==='string'&&/^\d+(?:\.\d+)?px$/.test(value)?value:space[value]!==undefined?space[value]+'px':null;
const color=value=>typeof value==='string'&&/^#[a-f\d]{6}$/i.test(value)?value:null;
export function flexNode(node,doc=document){
 const el=doc.createElement(node.type==='button'?'button':'div');el.className='nc-flex-'+(node.type||'unknown');
 if(node.type==='text'){el.textContent=String(node.text||'');el.style.fontSize=(sizes[node.size]||14)+'px';el.style.fontWeight=node.weight==='bold'?'650':'400';el.style.whiteSpace='pre-wrap';el.style.overflowWrap='anywhere';el.style.textAlign=({end:'right',center:'center',start:'left'})[node.align]||'left';if(color(node.color))el.style.color=node.color;}
 else if(node.type==='button'){el.type='button';el.disabled=true;el.textContent=String(node.action?.label||'');el.setAttribute('aria-label',(node.action?.label||'ปุ่ม')+' — ตัวอย่างเท่านั้น');el.style.backgroundColor=color(node.color)||'#eff8f5';el.style.color=node.style==='primary'?'#fff':'#173d43';}
 else if(node.type==='box'){el.style.display='flex';el.style.flexDirection=node.layout==='horizontal'?'row':'column';el.style.gap=length(node.spacing)||'0';if(node.alignItems)el.style.alignItems=node.alignItems==='flex-start'?'flex-start':node.alignItems==='center'?'center':'stretch';for(const child of node.contents||[])el.append(flexNode(child,doc));}
 if(Number.isFinite(node.flex))el.style.flex=node.flex===0?'0 0 auto':String(node.flex)+' 1 0';
 if(length(node.margin))el.style.marginTop=length(node.margin);
 for(const [key,css] of [['paddingAll','padding'],['paddingTop','paddingTop'],['paddingBottom','paddingBottom'],['paddingStart','paddingLeft'],['paddingEnd','paddingRight'],['cornerRadius','borderRadius'],['width','width'],['height','height']])if(length(node[key]))el.style[css]=length(node[key]);
 if(color(node.backgroundColor))el.style.backgroundColor=node.backgroundColor;
 if(length(node.borderWidth)){el.style.borderWidth=length(node.borderWidth);el.style.borderStyle='solid';}if(color(node.borderColor))el.style.borderColor=node.borderColor;
 return el;
}
export function renderFlexPreview(messages,root,doc=document){
 root.replaceChildren();
 for(const message of messages||[]){if(message.type==='text'){const el=doc.createElement('p');el.textContent=message.text;root.append(el);continue;}const bubble=message.contents;if(message.type!=='flex'||bubble?.type!=='bubble')continue;
  const card=doc.createElement('article');card.className='nc-line-bubble';
  for(const part of ['header','body','footer'])if(bubble[part]){const section=flexNode(bubble[part],doc);section.classList.add('nc-line-'+part);if(bubble.styles?.[part]?.separator)section.style.borderTop='1px solid #e4eae7';card.append(section);}
  root.append(card);
 }
}
export function mountFullNotificationPreview({scope,api,readDraft,isCurrent}){
 const root=scope.querySelector('#ncFullCardPreview'),status=scope.querySelector('#ncFullPreviewStatus'),refresh=scope.querySelector('#ncRefreshPreview');if(!root||!status||!refresh)return {schedule(){},dispose(){}};
 let timer=null,sequence=0,disposed=false;
 async function update(force=false){
  if(disposed||!isCurrent())return;const draft=readDraft(),signature=JSON.stringify(draft);const ticket=++sequence;
  root.setAttribute('aria-busy','true');status.textContent='กำลังโหลดตัวอย่างการ์ดจากข้อมูลปัจจุบัน…';refresh.disabled=true;
  try{const result=await api('/api/notification-center/preview',{method:'POST',body:signature,timeoutMs:20000,silentStatus:true});if(disposed||ticket!==sequence||!isCurrent())return;
   renderFlexPreview(result.messages,root);
   status.textContent=`ข้อมูลล่าสุด ${result.as_of.date} ${result.as_of.time} น. · ${result.employee_name_is_example?'ชื่อพนักงานเป็นตัวอย่าง · ':''}${result.has_matching_items===false?'ตอนนี้ไม่มีรายการเข้าเงื่อนไข ระบบจะยังไม่ส่งรายการนี้ · ':''}พรีวิวเท่านั้น ยังไม่ได้ส่ง LINE`;
  }catch(error){if(disposed||ticket!==sequence||!isCurrent())return;root.replaceChildren();status.textContent='แสดงพรีวิวไม่ได้: '+(error.message||'กรุณาลองใหม่');}
  finally{if(!disposed&&ticket===sequence&&isCurrent()){root.setAttribute('aria-busy','false');refresh.disabled=false;}}
 }
 function schedule(){if(disposed)return;clearTimeout(timer);sequence++;root.setAttribute('aria-busy','true');status.textContent='กำลังอัปเดตตัวอย่างตามค่าที่แก้…';timer=setTimeout(()=>update(),650);}
 const refreshClick=()=>{clearTimeout(timer);update(true);};refresh.addEventListener('click',refreshClick);
 const close=()=>dispose();scope.addEventListener('close',close,{once:true});
 function dispose(){disposed=true;sequence++;clearTimeout(timer);scope.removeEventListener('close',close);refresh.removeEventListener('click',refreshClick);}
 schedule();return {schedule,dispose};
}
