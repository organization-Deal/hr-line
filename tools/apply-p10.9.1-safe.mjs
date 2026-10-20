#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(), dry=process.argv.includes('--dry-run');
const index=path.join(root,'public','index.html');
const files=[
['p10-5.css','P10.5-ux1'],['p10-5.js','P10.5-ux1'],
['p10-7-recruitment-gmail.css','P10.7-1'],['p10-7-recruitment-gmail.js','P10.7-1'],
['p10-8-recruitment-simple.css','P10.8-1'],['p10-8-recruitment-simple.js','P10.8-1'],
['p10-9-recruitment-quickstart.css','P10.9-1'],['p10-9-recruitment-quickstart.js','P10.9-1']
];
function die(s){console.error(s);process.exit(1)}
if(!fs.existsSync(index))die('ไม่พบ public/index.html ในโฟลเดอร์นี้');
for(const [file] of files) if(!fs.existsSync(path.join(root,'public','ui',file)))die(`ขาด public/ui/${file}`);
const old=fs.readFileSync(index,'utf8');
if(!old.includes('</head>'))die('ไม่พบ </head>');
let result=old,added=[];
for(const [name,version] of files){
 if(result.includes(`/ui/${name}`))continue;
 const u=`/ui/${name}?v=${version}`;
 const tag=name.endsWith('.css')?`  <link rel="stylesheet" href="${u}" />`:`  <script defer src="${u}"></script>`;
 result=result.replace('</head>',tag+'\n</head>'); added.push(name);
}
console.log(`มีไฟล์เสริมที่ต้องเพิ่ม ${added.length} รายการ: ${added.join(', ')||'ไม่มี'}`);
if(dry||result===old){console.log('ไม่ได้เปลี่ยนไฟล์');process.exit(0)}
const backup=path.join(root,'.nakna-p1091-backup');
fs.mkdirSync(backup,{recursive:true});fs.copyFileSync(index,path.join(backup,'index.html'));
fs.writeFileSync(index,result,'utf8');
console.log('อัปเดต index.html สำเร็จ; Backup: .nakna-p1091-backup/index.html');
