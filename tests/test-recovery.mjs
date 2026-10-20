import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'nakna-p1092-'));
const badSource=path.resolve(process.argv[2]||'');
if(!fs.existsSync(badSource)) throw new Error('Pass path to the original P10.9.1 bad index.html');
const tool=path.resolve('tools/recover-p10.9.1.mjs');
function cmd(app,args,opt={}) {return execFileSync(app,args,{cwd:root,encoding:'utf8',...opt});}
function git(args){return cmd('git',args)}
function sha(s){return crypto.createHash('sha256').update(s).digest('hex');}
try {
 fs.mkdirSync(path.join(root,'public'),{recursive:true});
 git(['init','-q']);git(['config','user.email','test@example.com']);git(['config','user.name','Test']);
 const bad=fs.readFileSync(badSource,'utf8');
 const good=bad.replace('GMAIL INBOX','บัญชีรับสมัครงานที่เชื่อม · คิวคัดกรองอีเมล · เลือกแหล่งเมล');
 if (good===bad) throw Error('Fixture injection failed');
 const target=path.join(root,'public/index.html');
 const app=path.join(root,'public/app.js');
 fs.writeFileSync(target,good);
 fs.writeFileSync(app,'// untouched backend-bound frontend\n');
 git(['add','.']);git(['commit','-qm','Last good multi-account recruitment version']);
 fs.writeFileSync(target,bad);
 git(['add','.']);git(['commit','-qm','Add files via upload -- accidental P10.9.1 overwrite']);
 const preAppSha=sha(fs.readFileSync(app));
 const dry=cmd('node',[tool,'--dry-run']);
 if(!dry.includes('DRY RUN ONLY')) throw Error('Dry-run did not report no write');
 if(fs.readFileSync(target,'utf8')!==bad) throw Error('Dry-run modified HTML');
 const res=cmd('node',[tool,'--apply']);
 const restored=fs.readFileSync(target,'utf8');
 for(const value of ['บัญชีรับสมัครงานที่เชื่อม','คิวคัดกรองอีเมล','เลือกแหล่งเมล','p10-8-recruitment-simple.js','p10-9-recruitment-quickstart.js']){
  if(!restored.includes(value)) throw Error('Missing: '+value);
 }
 if(sha(fs.readFileSync(app))!==preAppSha) throw Error('Modified app.js');
 if(!res.includes('✅ Recovered')) throw Error('Missing success log');
 if(!fs.existsSync(path.join(root,'.nakna-recovery-p1092'))) throw Error('Backup folder missing');
 console.log('PASS: dry run, restore previous Recruitment UI, insert scripts, preserve app.js, create backup.');
} finally {fs.rmSync(root,{recursive:true,force:true});}
