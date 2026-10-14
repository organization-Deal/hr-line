import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
try{
 const backup=path.resolve(process.argv[2]||'');if(!process.argv[2])throw new Error('Usage: node tools/rollback-p10.4.mjs /path/to/nakna-backup-p10.4-...');
 const m=JSON.parse(fs.readFileSync(path.join(backup,'manifest.json'),'utf8'));
 const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
 for(const f of m.files){if(f.path.includes('..')||path.isAbsolute(f.path))throw new Error('Unsafe manifest');const dest=path.join(m.root,f.path);if(!fs.existsSync(dest)||hash(fs.readFileSync(dest))!==f.new_sha256)throw new Error(`Changed after P10.4: ${f.path}. Stop to avoid overwriting newer work.`);if(f.existed&&hash(fs.readFileSync(path.join(backup,f.path)))!==f.old_sha256)throw new Error('Backup integrity error');}
 for(const f of m.files){if(f.existed)fs.copyFileSync(path.join(backup,f.path),path.join(m.root,f.path));else fs.rmSync(path.join(m.root,f.path));}
 console.log('Local files restored. No database or remote deployment changed.');
}catch(error){console.error(error.message);process.exitCode=1;}
