// Check static assets and mandatory DOM contracts. Optional/dynamically created
// elements are checked by their feature tests, not assumed to be static HTML.
import fs from 'node:fs';
import assert from 'node:assert/strict';
for(const name of ['index.html','attendance.html']){
 const html=fs.readFileSync('public/'+name,'utf8');
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(ids).size,ids.length,`${name}: duplicate DOM IDs`);
 for(const [,path] of html.matchAll(/(?:src|href)="(\/[^"?#]+)(?:[^\"]*)"/g)){
  assert.ok(fs.existsSync('public'+path),`${name}: missing static asset ${path}`);
 }
}
const html=fs.readFileSync('public/index.html','utf8');
const js=fs.readFileSync('public/app.js','utf8');
const bindBlock=js.match(/function bindEvents\(\) \{([\s\S]*?)\n\}/)?.[1]||'';
for(const [,id] of bindBlock.matchAll(/\$\('#([^']+)'\)\.(?:addEventListener|onclick|onchange|oninput)/g)){
 const guarded=bindBlock.split('\n').some(line=>line.includes(`if ($('#${id}'))`)||line.includes(`if($('#${id}'))`));
 if(!guarded)assert.ok(html.includes(`id="${id}"`),`Missing required event target ${id}`);
}
for(const id of ['recruitmentGmailAccountList','nkScreeningList','nkScreeningSourceFilter','nkTeamWorkLogMobile','nkAttendanceMobileSummary','ndTabs']){
 assert.ok(html.includes(`id="${id}"`),`Missing feature mount ${id}`);
}
console.log('PASS: asset references, unique IDs, mandatory event targets, restored UI mounts');
