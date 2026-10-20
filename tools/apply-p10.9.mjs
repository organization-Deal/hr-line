#!/usr/bin/env node
/** Inject Gmail recruitment account quick-start without touching app.js or src/index.js. */
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const DRY=process.argv.includes('--dry-run');
const doc=path.join(root,'public','index.html');
const assetDir=path.join(root,'public','ui');
const ASSETS=[
 'p10-8-recruitment-simple.css','p10-8-recruitment-simple.js',
 'p10-9-recruitment-quickstart.css','p10-9-recruitment-quickstart.js'
];
const TAGS=[
 ['p10-8-recruitment-simple.css','<link rel="stylesheet" href="/ui/p10-8-recruitment-simple.css?v=P10.8-1" />'],
 ['p10-8-recruitment-simple.js','<script defer src="/ui/p10-8-recruitment-simple.js?v=P10.8-1"></script>'],
 ['p10-9-recruitment-quickstart.css','<link rel="stylesheet" href="/ui/p10-9-recruitment-quickstart.css?v=P10.9-1" />'],
 ['p10-9-recruitment-quickstart.js','<script defer src="/ui/p10-9-recruitment-quickstart.js?v=P10.9-1"></script>']
];
function fail(msg){console.error('P10.9: '+msg);process.exit(1)}
if (!fs.existsSync(doc)) fail('ไม่พบ public/index.html กรุณารันจาก Root ของ Repo Nakna');
for(const file of ASSETS) if(!fs.existsSync(path.join(assetDir,file)))fail('คัดลอก public/ui/'+file+' จาก ZIP มาวางก่อน');
const original=fs.readFileSync(doc,'utf8');
if(!/<\/head>/i.test(original))fail('ไม่พบ </head> ใน HTML');
let current=original;const added=[];
for (const [file,tag] of TAGS){
  if (current.includes('/ui/'+file)) continue;
  current=current.replace(/<\/head>/i,'  '+tag+'\n</head>');
  added.push(file);
}
if (DRY){console.log(`P10.9 dry-run ผ่าน: เพิ่ม ${added.length} include; คง app.js/src/index.js/DB/API เดิม`);console.log(added);process.exit(0)}
if(current===original){console.log('P10.9 ติดตั้งอยู่แล้ว ไม่แก้ซ้ำ');process.exit(0)}
const backup=path.join(root,'.nakna-p109-backup');
fs.mkdirSync(backup,{recursive:true});
fs.writeFileSync(path.join(backup,'index.html'),original,'utf8');
fs.writeFileSync(doc,current,'utf8');
console.log('P10.9 ติดตั้งเรียบร้อย เพิ่ม '+added.length+' include ใน public/index.html');
console.log('สำรอง HTML เดิมไว้ที่ .nakna-p109-backup/index.html');
