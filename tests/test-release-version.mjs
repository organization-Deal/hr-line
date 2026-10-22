import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const code=fs.readFileSync('public/release.js','utf8');
for(const readyState of ['loading','complete']){
 let onReady;const nodes=[{},{}],root={dataset:{}};
 const ctx={window:{},document:{readyState,documentElement:root,querySelectorAll:()=>nodes,addEventListener(type,fn){assert.equal(type,'DOMContentLoaded');onReady=fn;}}};
 vm.runInNewContext(code,ctx);if(onReady)onReady();
 assert.equal(ctx.window.NaknaRelease.version,'P10.11');assert.ok(Object.isFrozen(ctx.window.NaknaRelease));assert.equal(root.dataset.naknaVersion,'P10.11');assert.ok(nodes.every(n=>n.textContent==='UI P10.11'));
}
const html=fs.readFileSync('public/index.html','utf8');
assert.ok(html.indexOf('/release.js')<html.indexOf('/ui/p10.js'));assert.ok(html.includes('data-nakna-version'));assert.ok(!html.includes('UI P10.1</span>'));
assert.ok(fs.readFileSync('public/ui/p10.js','utf8').includes("get version() { return window.NaknaRelease?.version || 'unknown'; }"));
assert.ok(fs.readFileSync('public/_headers','utf8').includes('/release.js\n  Cache-Control: no-store'));
console.log('PASS release label: early/late load, single source, UI binding, cache policy');
