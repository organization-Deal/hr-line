#!/usr/bin/env node
/** Remove P10.9 asset includes only. Leave P10.8 and all runtime data intact. */
import fs from 'node:fs';
import path from 'node:path';
const filename=path.join(process.cwd(),'public','index.html');
if(!fs.existsSync(filename)){console.error('ไม่พบ public/index.html');process.exit(1)}
const original=fs.readFileSync(filename,'utf8');
let updated=original;
updated=updated.replace(/^[\t ]*<link[^>]*href="\/ui\/p10-9-recruitment-quickstart\.css\?v=P10\.9-1"[^>]*>\r?\n/gm,'');
updated=updated.replace(/^[\t ]*<script[^>]*src="\/ui\/p10-9-recruitment-quickstart\.js\?v=P10\.9-1"[^>]*><\/script>\r?\n/gm,'');
if (original===updated){console.log('ไม่มี include ของ P10.9 ให้ย้อนกลับ');process.exit(0)}
fs.writeFileSync(filename,updated,'utf8');
console.log('ย้อนกลับ P10.9 แล้ว (P10.8, Backend และ DB ไม่เปลี่ยน)');
