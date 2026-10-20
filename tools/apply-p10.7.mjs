#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const dry = argv.includes('--dry-run');
const root = path.resolve(argv.find(arg => !arg.startsWith('--')) || process.cwd());
const htmlPath = path.join(root, 'public', 'index.html');
const jsPath = path.join(root, 'public', 'ui', 'p10-7-recruitment-gmail.js');
const cssPath = path.join(root, 'public', 'ui', 'p10-7-recruitment-gmail.css');
const tags = [
  '  <link rel="stylesheet" href="/ui/p10-7-recruitment-gmail.css?v=P10.7-1" />',
  '  <script defer src="/ui/p10-7-recruitment-gmail.js?v=P10.7-1"></script>'
];
for (const p of [htmlPath, jsPath, cssPath]) {
  if (!fs.existsSync(p)) throw new Error(`ไม่พบไฟล์ ${p} (แตก ZIP ทับโครง repo ก่อนรัน)`);
}
const html = fs.readFileSync(htmlPath, 'utf8');
if (!/<\/head>/i.test(html)) throw new Error('HTML ไม่มี </head> ไม่แก้ไฟล์');
if (!/recruitment/i.test(html)) throw new Error('HTML ไม่มี Recruitment — ตรวจว่าใช้ Repo Nakna ถูกตัว');
let next = html;
for (const tag of tags) {
  if (!next.includes(tag)) next = next.replace(/<\/head>/i, tag + '\n</head>');
}
if (dry) {
  console.log('DRY RUN — ไม่แก้ไฟล์');
  console.log(`Repo: ${root}`);
  console.log(`เพิ่ม include ที่ public/index.html: ${next !== html ? 'ต้องเพิ่ม' : 'มีอยู่แล้ว'}`);
} else {
  if (next !== html) {
    const backup = path.join(root, '.nakna-p107-backup');
    fs.mkdirSync(backup, {recursive: true});
    fs.writeFileSync(path.join(backup, 'index.html'), html);
    fs.writeFileSync(htmlPath, next);
  }
  console.log(`พร้อมแล้ว: P10.7 Gmail picker (${next === html ? 'ตรวจแล้ว ไม่เพิ่มซ้ำ' : 'เพิ่ม include'})`);
}
