import assert from 'node:assert/strict';
import {renderFlexPreview,flexNode,mountFullNotificationPreview} from '../public/notification-preview.js';
import {loadHrCardBuilder} from './hr-card-fixture.mjs';
let checks=0;const check=(value,label)=>{assert.ok(value,label);checks++;};
class Node{
 constructor(tag){this.tagName=tag.toUpperCase();this.style={};this.childNodes=[];this.attributes={};this.handlers={};this.classList={add:value=>this.className=(this.className||'')+' '+value};}
 append(node){this.childNodes.push(node);}
 replaceChildren(...nodes){this.childNodes=nodes;}
 setAttribute(key,value){this.attributes[key]=value;}
 addEventListener(event,fn){(this.handlers[event] ||= new Set()).add(fn);}
 removeEventListener(event,fn){this.handlers[event]?.delete(fn);}
 emit(event){for(const fn of this.handlers[event]||[])fn({});}
}
const doc={createElement:tag=>new Node(tag)},root=new Node('div');globalThis.document=doc;
const flatten=node=>[node,...node.childNodes.flatMap(flatten)];
const builder=loadHrCardBuilder(),dashboard={today:'2026-10-22',summary:{employees:27,scheduled_today:27,scheduled_present:21,leave:2,late:11,missing:4},missing_employees:[{name:'คน ก'},{name:'คน ข'}],attention:[{key:'leave_pending',count:1}],documents:{pending_hr_sign:2,pending_employee_sign:1}};
const card=builder({id:1,name:'บริษัทตัวอย่าง'},dashboard,0,{asOf:{date:'2026-10-22',time:'13:05'},sendTime:'13:00'});
renderFlexPreview([card],root,doc);const nodes=flatten(root),texts=nodes.map(x=>x.textContent||'').join('\n');
for(const text of ['สรุปทีมรอบ 13:00','NAKNA · HR DAILY','27 คน','21/27 คน','คนที่ยังไม่เช็กอิน','งาน HR ที่ยังค้าง','เอกสารรอ HR เซ็น','เปิด HR Dashboard','สถานะสรุป HR','ระบบแจ้งเตือนอัตโนมัติ'])check(texts.includes(text),'full preview includes '+text);
const buttons=nodes.filter(n=>n.tagName==='BUTTON');check(buttons.length===2&&buttons.every(b=>b.disabled),'all preview actions inert');
check(nodes.some(n=>n.style.backgroundColor==='#FFF7E8'),'original warning palette rendered');
const literal=flexNode({type:'text',text:'<img src=x onerror=alert(1)>',color:'url(https://evil.example)',size:'20px'},doc);check(literal.textContent.startsWith('<img')&&literal.childNodes.length===0,'text treated literally');check(!literal.style.color,'untrusted style rejected');
const action=flexNode({type:'button',action:{label:'เปิด',uri:'javascript:alert(1)'}},doc);check(action.disabled&&!action.attributes.href&&!action.onclick,'external actions not attached');
const before=JSON.stringify(card);renderFlexPreview([card],root,doc);check(JSON.stringify(card)===before,'renderer does not mutate shared message payload');
const scope=new Node('dialog'),status=new Node('p'),refresh=new Node('button'),preview=new Node('div');scope.querySelector=selector=>({'#ncFullCardPreview':preview,'#ncFullPreviewStatus':status,'#ncRefreshPreview':refresh})[selector];
const calls=[],resolvers=[];let current=true,draft={kind:'hr_summary',send_time:'13:00',message_text:'ต้นฉบับ'};
const response={messages:[card],as_of:{date:'2026-10-22',time:'13:05'},sent:false};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const controller=mountFullNotificationPreview({scope,readDraft:()=>draft,isCurrent:()=>current,api:(path,options)=>{calls.push({path,options});return new Promise(resolve=>resolvers.push(resolve));}});
await wait(700);check(calls.length===1&&calls[0].path.endsWith('/preview'),'preview loads automatically');check(calls[0].options.silentStatus===true,'read-only preview avoids save status UI');
draft={...draft,send_time:'14:00'};controller.schedule();resolvers[0](response);await wait(0);check(preview.childNodes.length===0,'outdated response discarded');
await wait(700);check(calls.length===2&&JSON.parse(calls[1].options.body).send_time==='14:00','debounced changes preview unsaved draft');resolvers[1](response);await wait(0);check(preview.childNodes.length===1&&status.textContent.includes('ยังไม่ได้ส่ง LINE'),'full card and no-send explanation shown');check(refresh.disabled===false,'refresh re-enabled');
controller.schedule();await wait(700);check(calls.length===3,'repeated update remains usable');scope.emit('close');resolvers[2](response);await wait(0);const visible=status.textContent;controller.schedule();await wait(700);check(calls.length===3&&status.textContent===visible,'closing cancels updates and discards late response');
check(calls.every(c=>c.path==='/api/notification-center/preview'&&c.options.method==='POST'),'preview never calls send/save endpoints');
console.log(`P10.20 full card preview: ${checks} checks PASS (full Flex structure, original colors, inert actions, safe text, unsaved drafts, debounce, stale-response and close guards)`);
