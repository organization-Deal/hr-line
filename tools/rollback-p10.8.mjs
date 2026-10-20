#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(), p=path.join(root,'public','index.html');
if(!fs.existsSync(p)){console.error('ไม่พบ public/index.html');process.exit(1)}
let s=fs.readFileSync(p,'utf8');
const before=s;
const block='  <link rel="stylesheet" href="/ui/p10-8-recruitment-simple.css?v=P10.8-1" />\n'+
'  <script defer src="/ui/p10-8-recruitment-simple.js?v=P10.8-1"></script>\n';
if(s.includes(block)) s=s.replace(block,'');
else {
 // Manual GitHub installs may have used different indentation.
 s=s.replace(/^[ \t]*<link rel="stylesheet" href="\/ui\/p10-8-recruitment-simple\.css\?v=P10\.8-1" \/>\r?\n/m,'');
 s=s.replace(/^[ \t]*<script defer src="\/ui\/p10-8-recruitment-simple\.js\?v=P10\.8-1"><\/script>\r?\n/m,'');
}
if(s===before){console.log('ไม่พบ include P10.8 ใน index.html');process.exit(0)}
fs.writeFileSync(p,s,'utf8');
console.log('ย้อนกลับการเรียกใช้ P10.8 แล้ว (เก็บไฟล์ UI ไว้ได้)');
