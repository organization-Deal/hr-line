import assert from 'node:assert/strict';
import {templateParts,templatePreview,serializeEditor,mountNotificationEditor} from '../public/notification-editor.js';
import {fieldsForKind,NOTIFICATION_TYPES as types,canonicalTemplate} from '../public/notification-catalog.js';
let checks=0;const check=(v,n)=>{assert.ok(v,n);checks++;};
const fields=fieldsForKind('hr_summary');
check(templateParts('สวัสดี {name}',fields)[1].label==='ชื่อผู้รับ','legacy aliases display Thai chip');
check(templatePreview('สวัสดี {ชื่อ} บริษัท {บริษัท}',fields,{'บริษัท':'ตัวอย่าง'}).includes('สมชาย บริษัท ตัวอย่าง'),'plain-language preview');
check(templateParts('<script>alert(1)</script> {ชื่อ}',fields)[0].text.startsWith('<script>'),'HTML treated as text');
check(canonicalTemplate('{company} {date}')==='{บริษัท} {วันที่}','canonical storage compatible');
for(const kind of Object.keys(types)){const f=fieldsForKind(kind),text=templatePreview(types[kind].text,f);check(!text.match(/\{[^{}]+\}/),kind+' recommendation resolves');}
class Node{
 constructor(tag='',text=''){this.nodeType=tag==='#text'?3:1;this.tagName=tag.toUpperCase();this.nodeValue=text;this.childNodes=[];this.dataset={};this.handlers={};this.classList={toggle(){}};this.hidden=false;this.attributes={};}
 append(...children){for(const child of children){if(child.tagName==='#FRAGMENT'){this.append(...[...child.childNodes]);continue;}child.parentNode?.removeChild(child);child.parentNode=this;this.childNodes.push(child);}}
 removeChild(child){this.childNodes=this.childNodes.filter(x=>x!==child);child.parentNode=null;}
 replaceChildren(...nodes){this.childNodes.forEach(x=>x.parentNode=null);this.childNodes=[];this.append(...nodes);}
 get lastChild(){return this.childNodes.at(-1)||null;}
 set textContent(v){this.replaceChildren(new Node('#text',String(v)));}
 get textContent(){return this.nodeType===3?this.nodeValue:this.childNodes.map(x=>x.textContent).join('');}
 focus(){}
 remove(){this.parentNode?.removeChild(this);}
 setAttribute(key,value){this.attributes[key]=value;}
 addEventListener(event,fn){this.handlers[event]=fn;}
 contains(node){return node===this||this.childNodes.some(x=>x.contains(node));}
 closest(selector){return selector==='.nc-token'&&this.dataset.ncField?this:selector==='.nc-token-remove'&&this.className==='nc-token-remove'?this:this.parentNode?.closest(selector)||null;}
}
const ids=Object.fromEntries(['ncRichMessage','ncMessage','ncMessagePreview','ncMessageCount','ncTime','ncFieldPicker','ncInsertField','ncUseSuggested'].map(id=>['#'+id,new Node('div')]));
ids['#ncTime'].value='12:30';ids['#ncFieldPicker'].hidden=true;
const fieldButtons=fieldsForKind('checkin').map(f=>{const node=new Node('button');node.dataset.ncFieldKey=f.key;return node;});
const scope={querySelector:s=>ids[s],querySelectorAll:()=>fieldButtons};
let selection={rangeCount:0,removeAllRanges(){this.rangeCount=0;},addRange(range){this.rangeCount=1;this.anchorNode=range.commonAncestorContainer;this.focusNode=this.anchorNode;this.range=range;},getRangeAt(){return this.range;}};
globalThis.window={getSelection:()=>selection};
globalThis.document={createElement:tag=>new Node(tag),createTextNode:s=>new Node('#text',s),createDocumentFragment:()=>new Node('#fragment'),createRange:()=>({commonAncestorContainer:null,selectNodeContents(node){this.commonAncestorContainer=node;},collapse(){},deleteContents(){},insertNode(node){this.commonAncestorContainer.append(node);},setStartAfter(node){this.commonAncestorContainer=node.parentNode;},cloneRange(){return {...this};}})};
const controller=mountNotificationEditor({scope,kind:'checkin',template:'สวัสดี {name}\nจาก {บริษัท}',companyName:'บริษัท ก'});
const editor=ids['#ncRichMessage'];
check(editor.childNodes.filter(x=>x.dataset.ncField).length===2,'initial known markers become atomic chips');
check(!editor.textContent.includes('{'),'no braces shown to user');
check(ids['#ncMessage'].value==='สวัสดี {ชื่อ}\nจาก {บริษัท}','hidden canonical value retained');
check(ids['#ncMessagePreview'].textContent.includes('บริษัท ก'),'company preview');
const chip=editor.childNodes.find(x=>x.dataset.ncField==='ชื่อ');editor.handlers.click({target:chip.lastChild});check(!controller.value().includes('{ชื่อ}'),'remove chip without leftover marker');
fieldButtons.find(b=>b.dataset.ncFieldKey==='ชื่อ').handlers.click();check(controller.value().endsWith('{ชื่อ}'),'insert Thai field');
let prevented=false;editor.handlers.paste({preventDefault(){prevented=true;},clipboardData:{getData:()=>'<img src=x onerror=alert(1)> {บริษัท}'}});check(prevented&&editor.childNodes.every(n=>n.tagName!=='IMG'),'paste strips active HTML');
check(controller.value().includes('<img src=x onerror=alert(1)>'),'pasted words preserved as literal text');
editor.handlers.compositionstart();editor.append(new Node('#text','ภาษาไทย'));editor.handlers.compositionend();check(ids['#ncMessage'].value.endsWith('ภาษาไทย'),'Thai IME composition sync');
ids['#ncTime'].value='11:00';ids['#ncTime'].handlers.input();
ids['#ncUseSuggested'].handlers.click();check(controller.value()===types.checkin.text,'recommended text resets safely');
editor.append(new Node('#text','x'.repeat(301)));editor.handlers.input();check(editor.attributes['aria-invalid']==='true','over-limit indicated');
const paragraph=new Node('div');paragraph.append(new Node('#text','บรรทัดสอง'));editor.replaceChildren(new Node('#text','บรรทัดแรก'),paragraph);check(serializeEditor(editor)==='บรรทัดแรก\nบรรทัดสอง','multiline serialization');
const clipboard={};const copied=document.createDocumentFragment();copied.nodeType=11;const fieldCopy=new Node('span');fieldCopy.dataset.ncField='ชื่อ';copied.append(new Node('#text','สวัสดี '),fieldCopy);
const range=document.createRange();range.selectNodeContents(editor);range.cloneContents=()=>copied;range.deleteContents=()=>editor.replaceChildren();
selection={rangeCount:1,isCollapsed:false,anchorNode:editor,focusNode:editor,getRangeAt:()=>range};
editor.handlers.copy({preventDefault(){},clipboardData:{setData:(type,value)=>clipboard[type]=value}});
check(clipboard['application/x-nakna-template']==='สวัสดี {ชื่อ}','copy preserves semantic field');
check(clipboard['text/plain']==='สวัสดี [ชื่อผู้รับ]','external clipboard uses readable Thai labels');
editor.handlers.cut({preventDefault(){},clipboardData:{setData(){}}});check(controller.value()==='','cut syncs saved content');
console.log(`P10.19 message editor: ${checks} checks PASS (Thai labels, canonical save, chips, preview, delete/insert, safe paste, IME, reset, length and line breaks)`);
