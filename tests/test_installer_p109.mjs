import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const target=fs.mkdtempSync(path.join(os.tmpdir(),'p109-'));
fs.mkdirSync(path.join(target,'public','ui'),{recursive:true});
const source='<html><head><meta charset="utf-8"></head><body>Hello</body></html>';
fs.writeFileSync(path.join(target,'public','index.html'),source);
for(const f of ['p10-8-recruitment-simple.css','p10-8-recruitment-simple.js','p10-9-recruitment-quickstart.css','p10-9-recruitment-quickstart.js']){
  fs.copyFileSync(path.join(root,'public','ui',f),path.join(target,'public','ui',f));
}
function run(file,...args){const r=spawnSync('node',[path.join(root,'tools',file),...args],{cwd:target,encoding:'utf8'});assert.equal(r.status,0,r.stdout+'\n'+r.stderr);return r.stdout;}
run('apply-p10.9.mjs','--dry-run');assert.equal(fs.readFileSync(path.join(target,'public','index.html'),'utf8'),source);
run('apply-p10.9.mjs');const updated=fs.readFileSync(path.join(target,'public','index.html'),'utf8');
assert.equal((updated.match(/p10-9-recruitment-quickstart\.js/g)||[]).length,1);
assert.equal((updated.match(/p10-8-recruitment-simple\.js/g)||[]).length,1);
run('apply-p10.9.mjs');assert.equal(fs.readFileSync(path.join(target,'public','index.html'),'utf8'),updated);
run('rollback-p10.9.mjs');const after=fs.readFileSync(path.join(target,'public','index.html'),'utf8');
assert.equal((after.match(/p10-9-recruitment-quickstart\.js/g)||[]).length,0);
assert.equal((after.match(/p10-8-recruitment-simple\.js/g)||[]).length,1);
fs.rmSync(target,{recursive:true,force:true});console.log('Installer dry-run / apply / idempotent / rollback: 4/4 PASS');
