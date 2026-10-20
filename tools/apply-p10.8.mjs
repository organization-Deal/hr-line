#!/usr/bin/env node
/** P10.8: inject two standalone UI assets. Never replace app.js or backend. */
import fs from 'node:fs';
import path from 'node:path';
const DRY=process.argv.includes('--dry-run');
const root=process.cwd();
const htmlPath=path.join(root,'public','index.html');
const uiDir=path.join(root,'public','ui');
const required=['p10-8-recruitment-simple.js','p10-8-recruitment-simple.css'];
const lines=[
 '<link rel="stylesheet" href="/ui/p10-8-recruitment-simple.css?v=P10.8-1" />',
 '<script defer src="/ui/p10-8-recruitment-simple.js?v=P10.8-1"></script>'
];
function fail(s){ console.error('P10.8:',s);process.exit(1); }
if (!fs.existsSync(htmlPath)) fail('ไม่พบ public/index.html ใน Repo นี้');
for (const f of required) if(!fs.existsSync(path.join(uiDir,f)))fail(`ยังไม่พบ public/ui/${f} กรุณาคัดลอกไฟล์จาก ZIP มาก่อน`);
const html=fs.readFileSync(htmlPath,'utf8');
if (!/<\/head>/i.test(html))fail('ไม่พบ </head> ใน public/index.html');
const count=lines.filter(x=>html.includes(x)).length;
if(count===2){console.log('P10.8 พร้อมใช้งานอยู่แล้ว (ไม่มีการแก้ซ้ำ)');process.exit(0)}
if(count===1)fail('พบ include P10.8 เพียง 1 บรรทัด: ตรวจ public/index.html ก่อนติดตั้งซ้ำ');
// Fail closed if there is a different P10.8 asset already present.
if(/p10-8-recruitment-simple\.(js|css)/.test(html))fail('พบไฟล์ P10.8 รูปแบบอื่นอยู่แล้ว กรุณาตรวจ diff ก่อน');
const patched=html.replace(/<\/head>/i,`  ${lines.join('\n  ')}\n</head>`);
if (DRY){console.log('P10.8 dry-run ผ่าน: จะเพิ่ม include CSS/JS 2 บรรทัดใน public/index.html; ไม่เปลี่ยน Backend');process.exit(0)}
const backup=path.join(root,'.nakna-p108-backup');
fs.mkdirSync(backup,{recursive:true});
fs.writeFileSync(path.join(backup,'index.html'),html,'utf8');
fs.writeFileSync(htmlPath,patched,'utf8');
console.log('P10.8 ติดตั้งสำเร็จ: เพิ่ม CSS+JS; สำรอง public/index.html ที่ .nakna-p108-backup/index.html');
