/** Nakna P10.5 installer: additive presentation layer; no business logic changes. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const source=path.resolve(here,'..');
const args=process.argv.slice(2);
const dry=args.includes('--dry-run');
const repo=path.resolve(args.find(a=>!a.startsWith('--'))||process.cwd());
const publicDir=path.join(repo,'public');
const html=path.join(publicDir,'index.html');
const main=path.join(publicDir,'app.js');
const script=path.join(source,'public/ui/p10-5.js');
const css=path.join(source,'public/ui/p10-5.css');
const entries=[['/ui/p10-5.css?v=P10.5-ux1','<link rel="stylesheet" href="/ui/p10-5.css?v=P10.5-ux1" />'],['/ui/p10-5.js?v=P10.5-ux1','<script defer src="/ui/p10-5.js?v=P10.5-ux1"></script>']];
function fail(msg){console.error('P10.5 refused:',msg);process.exit(1);}
if(!fs.existsSync(html)||!fs.existsSync(main))fail('ไม่พบ public/index.html หรือ public/app.js ใน Repository ที่ระบุ');
let markup=fs.readFileSync(html,'utf8');
if(!markup.includes('id="appShell"')||!markup.includes('id="view-employees"')||!markup.includes('id="view-payroll"')||!markup.includes('id="leaveUnifiedPanel"'))fail('โครงหน้าไม่ใช่ Nakna P10/P9.40 ที่รองรับ ไม่เขียนทับ');
if(!markup.includes('/ui/p10.js') && !markup.includes('attendance-p10.js'))fail('ยังไม่เห็น UI P10; ต้องติดตั้งฐาน P10 ก่อน');
if(!markup.includes('</head>'))fail('ไม่พบ </head>');
for(const [needle,tag] of entries)if(!markup.includes(needle))markup=markup.replace('</head>',`  ${tag}\n</head>`);
for(const file of [script,css])if(!fs.existsSync(file))fail('แพ็กไม่มีไฟล์ '+file);
const expected='/ui/p10-5.js?v=P10.5-ux1';
if((markup.match(new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))||[]).length!==1)fail('JS P10.5 ถูกแนบซ้ำ');
const required=['p10-5.js','p10-5.css'];
const changes=[...(fs.readFileSync(html,'utf8')===markup?[]:['public/index.html']),...required.map(n=>'public/ui/'+n)];
const digest=crypto.createHash('sha256').update(fs.readFileSync(main)).digest('hex').slice(0,12);
console.log('NAKNA P10.5',dry?'DRY RUN':'APPLY','repo=',repo,'main app hash=',digest);
console.log('Files:',changes.join(', '));
console.log('Backend/src, migrations, API and application handlers: untouched');
if(dry)process.exit(0);
const backupDir=path.join(repo,'.nakna-p105-backup');
fs.mkdirSync(backupDir,{recursive:true});
const previous=fs.readFileSync(html);
if(!fs.existsSync(path.join(backupDir,'index.before-p105.html')))fs.writeFileSync(path.join(backupDir,'index.before-p105.html'),previous);
const dest=path.join(publicDir,'ui');fs.mkdirSync(dest,{recursive:true});
for(const file of [script,css]){
 const target=path.join(dest,path.basename(file));
 if(fs.existsSync(target)&&!fs.existsSync(path.join(backupDir,path.basename(file)+'.before-p105')))fs.copyFileSync(target,path.join(backupDir,path.basename(file)+'.before-p105'));
 fs.copyFileSync(file,target);
}
fs.writeFileSync(html,markup);
console.log('Success. Run npm run check and then deploy staging.');
