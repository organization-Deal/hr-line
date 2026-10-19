import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=process.cwd();
const required=['public/index.html','public/app.js','public/ui/nk-growth-workspace.css'];
for(const f of required){if(!fs.existsSync(path.join(root,f)))throw new Error(`Missing ${f}: unzip at the repository root`);}
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'public/ui/nk-growth-workspace.css'),'utf8');
for(const id of ['performanceSummary','growthEmployeeSelect','growthActionList','growthProfile','learningCourseList','kpiGoalList','oneOnOneList','probationReviewList','createCourseBtn','createKpiBtn','createOneOnOneBtn','createProbationReviewBtn']){
 const count=(html.match(new RegExp(`id="${id}"`,'g'))||[]).length;
 if(count!==1)throw new Error(`Expected exactly 1 #${id}; found ${count}`);
}
for(const id of ['overview','kpi','learning','one','probation']){
 if(!html.includes(`data-growth-panel="${id}"`) || !html.includes(`data-growth-tab="${id}"`))throw new Error(`Missing ${id} tab/panel`);
}
if(!html.includes('/ui/nk-growth-workspace.css?v=GROWTH20261019A'))throw new Error('Stylesheet was not linked');
if(!html.includes('/app.js?v=NAKNA_GROWTH20261019A'))throw new Error('App version was not updated in HTML');
if(!js.includes('NAKNA_GROWTH_WORKSPACE_20261019A'))throw new Error('Growth controller missing');
if(!css.includes('#view-performance.nk-growth-view'))throw new Error('Scoped Growth CSS missing');
if(!html.includes('NAKNA_BOOT_RECOVERY_20261019')||!js.includes('NAKNA_BOOT_RECOVERY_20261019'))throw new Error('Expected Nakna Boot Recovery baseline absent: use the latest combined source before deploy');
execFileSync(process.execPath,['--check','public/app.js'],{cwd:root,stdio:'inherit'});
if(fs.existsSync(path.join(root,'src/index.js')))execFileSync(process.execPath,['--check','src/index.js'],{cwd:root,stdio:'inherit'});
console.log('✅ Nakna Growth Workspace: required files, route, tab/panel IDs, stylesheet, boot baseline and JS syntax verified');
console.log('ℹ️ This check does not verify production authentication, D1 data or live LINE notifications');
