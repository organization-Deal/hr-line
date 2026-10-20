#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2);
const root = path.resolve(args.find(x => !x.startsWith('--')) || process.cwd());
const p = path.join(root, 'public/index.html');
const dry = args.includes('--dry-run');
const old = fs.readFileSync(p,'utf8');
const next = old.replace(/^[ \t]*<link rel="stylesheet" href="\/ui\/p10-7-recruitment-gmail\.css\?v=P10\.7-1" \/>[ \t]*\r?\n/gm,'')
                .replace(/^[ \t]*<script defer src="\/ui\/p10-7-recruitment-gmail\.js\?v=P10\.7-1"><\/script>[ \t]*\r?\n/gm,'');
if(!dry && next!==old) fs.writeFileSync(p,next);
console.log(`${dry?'DRY RUN':'ROLLBACK'}: ${next===old?'ไม่พบ include P10.7':'ลบเฉพาะ include P10.7'} (${p})`);
