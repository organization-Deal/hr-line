import {fieldsForKind,canonicalTemplate,NOTIFICATION_TYPES} from './notification-catalog.js?v=P10.24';
export function templateParts(text,fields){const keys=new Map(fields.map(f=>[f.key,f]));return canonicalTemplate(text).split(/(\{[^{}]+\})/g).filter(Boolean).map(part=>{const field=part.startsWith('{')?keys.get(part.slice(1,-1)):null;return field?{field:field.key,label:field.label}:{text:part};});}
export function templatePreview(text,fields,values={}){const lookup=Object.fromEntries(fields.map(f=>[f.key,values[f.key]??f.sample]));return canonicalTemplate(text).replace(/\{([^{}]+)\}/g,(m,key)=>String(lookup[key]??m));}
export function serializeEditor(root){
 const block=new Set(['DIV','P']);
 function read(node){if(node.nodeType===3)return node.nodeValue||'';if(node.nodeType!==1&&node.nodeType!==11)return '';if(node.dataset?.ncField)return '{'+node.dataset.ncField+'}';if(node.tagName==='BR')return '\n';if(['SCRIPT','STYLE'].includes(node.tagName))return '';let out='';for(const child of node.childNodes){const value=read(child);if(block.has(child.tagName)&&out&&!out.endsWith('\n'))out+='\n';out+=value;}return out;}
 return canonicalTemplate(read(root)).replaceAll('\u00a0',' ');
}
export function mountNotificationEditor({scope,kind,template,escapeHtml:e,companyName='',onChange=()=>{}}){
 const fields=fieldsForKind(kind),editor=scope.querySelector('#ncRichMessage'),hidden=scope.querySelector('#ncMessage'),preview=scope.querySelector('#ncMessagePreview'),count=scope.querySelector('#ncMessageCount'),time=scope.querySelector('#ncTime'),picker=scope.querySelector('#ncFieldPicker');
 if(!editor||!hidden)return;
 let lastRange=null,composing=false;
 const chip=field=>{const span=document.createElement('span');span.className='nc-token';span.contentEditable='false';span.dataset.ncField=field.key;span.append(document.createTextNode(field.label));const remove=document.createElement('button');remove.type='button';remove.className='nc-token-remove';remove.setAttribute('aria-label','ลบ '+field.label);remove.textContent='×';span.append(remove);return span;};
 function fragment(text){const frag=document.createDocumentFragment();for(const part of templateParts(text,fields))frag.append(part.field?chip(fields.find(f=>f.key===part.field)):document.createTextNode(part.text));return frag;}
 function sync(){hidden.value=serializeEditor(editor);const sample={'บริษัท':companyName||'บริษัทตัวอย่าง','เวลา':time?.value||'13:00'};if(preview)preview.textContent=templatePreview(hidden.value,fields,sample);count.textContent=hidden.value.length+'/300';count.classList.toggle('nc-over-limit',hidden.value.length>300);editor.setAttribute('aria-invalid',String(hidden.value.length>300));onChange();}
 function remember(){const selection=window.getSelection();if(selection?.rangeCount&&editor.contains(selection.anchorNode)&&editor.contains(selection.focusNode))lastRange=selection.getRangeAt(0).cloneRange();}
 function insert(text){editor.focus();const selection=window.getSelection();let range=lastRange;if(!range||!editor.contains(range.commonAncestorContainer)){range=document.createRange();range.selectNodeContents(editor);range.collapse(false);}range.deleteContents();const frag=fragment(text),tail=frag.lastChild;range.insertNode(frag);if(tail){range.setStartAfter(tail);range.collapse(true);selection.removeAllRanges();selection.addRange(range);lastRange=range.cloneRange();}sync();}
 editor.replaceChildren(fragment(template));sync();
 editor.addEventListener('input',()=>{if(!composing){sync();remember();}});
 editor.addEventListener('compositionstart',()=>composing=true);editor.addEventListener('compositionend',()=>{composing=false;sync();remember();});
 for(const event of ['keyup','mouseup','focusout'])editor.addEventListener(event,remember);
 editor.addEventListener('paste',event=>{event.preventDefault();remember();insert(event.clipboardData?.getData('application/x-nakna-template')||event.clipboardData?.getData('text/plain')||'');});
 for(const eventName of ['copy','cut'])editor.addEventListener(eventName,event=>{
  const selection=window.getSelection();if(!selection?.rangeCount||selection.isCollapsed||!editor.contains(selection.anchorNode)||!editor.contains(selection.focusNode))return;
  const range=selection.getRangeAt(0),value=serializeEditor(range.cloneContents());
  event.preventDefault();event.clipboardData.setData('application/x-nakna-template',value);
  const labels=Object.fromEntries(fields.map(f=>[f.key,'['+f.label+']']));
  event.clipboardData.setData('text/plain',value.replace(/\{([^{}]+)\}/g,(match,key)=>labels[key]||match));
  if(eventName==='cut'){range.deleteContents();lastRange=range.cloneRange();sync();}
 });
 editor.addEventListener('drop',event=>{event.preventDefault();});
 editor.addEventListener('click',event=>{const button=event.target.closest('.nc-token-remove');if(button){button.closest('.nc-token').remove();lastRange=null;sync();editor.focus();}});
 editor.addEventListener('beforeinput',event=>{if(event.inputType==='insertParagraph'){event.preventDefault();remember();insert('\n');}});
 time?.addEventListener('input',sync);
 scope.querySelector('#ncInsertField')?.addEventListener('pointerdown',event=>{remember();event.preventDefault();});
 scope.querySelector('#ncInsertField')?.addEventListener('click',()=>{picker.hidden=!picker.hidden;scope.querySelector('#ncInsertField').setAttribute('aria-expanded',String(!picker.hidden));});
 for(const button of scope.querySelectorAll('[data-nc-field-key]')){button.addEventListener('pointerdown',event=>{remember();event.preventDefault();});button.addEventListener('click',()=>{insert('{'+button.dataset.ncFieldKey+'}');picker.hidden=true;scope.querySelector('#ncInsertField').setAttribute('aria-expanded','false');});}
 scope.querySelector('#ncUseSuggested')?.addEventListener('click',()=>{editor.replaceChildren(fragment(NOTIFICATION_TYPES[kind].text));lastRange=null;sync();});
 return {sync,value:()=>serializeEditor(editor)};
}
