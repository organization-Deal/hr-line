import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const manifest=JSON.parse(fs.readFileSync(path.join(here,'../docs/p10-ui/file-manifest.json'),'utf8'));
const root=path.resolve(process.argv[2]||process.cwd());
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
let before=0,after=0,bad=[];
for(const [name,m] of Object.entries(manifest.files)){
 const p=path.join(root,name);
 if(!fs.existsSync(p)){if(m.before===null)continue;bad.push(name+' (missing)');continue;}
 const s=hash(p);
 if(s===m.after)after++;
 else if(m.before && s===m.before)before++;
 else bad.push(name+' (different content; do not overwrite automatically)');
}
if(bad.length){console.error('BASELINE MISMATCH\n'+bad.join('\n'));process.exitCode=1;}
else if(before && after){console.error('MIXED FRONTEND VERSIONS: upload all public files as one set.');process.exitCode=1;}
else if(after===Object.keys(manifest.files).length){console.log('P10.0 frontend installed; all 13 file hashes verified.');}
else if(before===Object.values(manifest.files).filter(m=>m.before).length){console.log('P9.40 frontend baseline matches. Back up your repo before copying this patch.');}
else {console.error('Incomplete installation.');process.exitCode=1;}
console.log('Read-only check. Backend/API/database were not modified or validated against production.');
