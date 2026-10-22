import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
class Element{
 constructor(id=''){this.id=id;this.hidden=false;this.dataset={};this.attrs={};this.handlers={};this.textContent='';this.innerHTML='';this.classList={contains:()=>false};}
 addEventListener(type,fn){this.handlers[type]=fn;}
 setAttribute(k,v){this.attrs[k]=v;}
 getAttribute(k){return this.attrs[k];}
 click(){this.handlers.click?.({target:this});}
 focus(){doc.activeElement=this;}
}
const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,new Element(id));return nodes.get(id);};
const tabs=['list','summary','matrix','queue'].map(key=>{const n=get('ndTab-'+key);n.dataset.ndTab=key;return n;});
const panes=['list','summary','matrix','queue'].map(key=>get('ndPane-'+key));
const modes=['today','day','week','month','range'].map(mode=>{const n=new Element();n.dataset.worklogMode=mode;n.click=()=>{active=n;};return n;});let active=modes[0];
get('teamWorkLogSummary').children=[{outerHTML:'<div><strong>12</strong></div>'}];
get('teamWorkLogDepartmentFilter').selectedOptions=[{textContent:'ทุกแผนก'}];
get('teamWorkLogStatusFilter').selectedOptions=[{textContent:'ทุกสถานะ'}];
get('attendanceRetroApprovalCount').textContent='2 รายการ';
get('ndFilterOptions').hidden=true;
const root={querySelector(selector){if(selector==='#teamWorkLogMode .active')return active;const m=selector.match(/data-worklog-mode="(.*?)"/);return m?modes.find(n=>n.dataset.worklogMode===m[1]):get(selector.slice(1));},querySelectorAll(s){return s==='[data-nd-tab]'?tabs:panes;}};
const doc={readyState:'complete',activeElement:tabs[0],querySelector:()=>root};let update;
vm.runInNewContext(fs.readFileSync('public/ui/attendance-p10.js','utf8'),{document:doc,MutationObserver:class{constructor(fn){update=fn;}observe(){}}});
assert.equal(panes[0].hidden,false);assert.equal(panes[1].hidden,true);
tabs[2].click();assert.equal(panes[2].hidden,false);assert.equal(panes[0].hidden,true);assert.equal(tabs[2].attrs['aria-selected'],'true');
get('ndTabs').handlers.keydown({key:'Home',preventDefault(){}});assert.equal(doc.activeElement,tabs[0]);
get('ndPeriodSelect').handlers.change({target:{value:'month'}});assert.equal(active.dataset.worklogMode,'month');
get('ndFilterToggle').click();assert.equal(get('ndFilterOptions').hidden,false);assert.equal(get('ndFilterToggle').attrs['aria-expanded'],'true');
assert.ok(get('ndMetricStrip').innerHTML.includes('12'));
tabs[3].click();assert.equal(get('ndSharedFilters').hidden,true);
get('attendanceRetroApprovalPanel').hidden=true;update();assert.equal(tabs[3].hidden,true);assert.equal(panes[0].hidden,false);
assert.equal(get('ndPendingCount').textContent,'2 รายการ');
console.log('PASS: attendance tabs, keyboard navigation, period control, filter expansion, metrics and role visibility');
