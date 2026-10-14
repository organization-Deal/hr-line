#!/usr/bin/env node
/** Run from the target repository: node /path/to/patch/tools/apply-p10.4.mjs .
 * Uses exact guarded replacements, backs up originals outside the repository,
 * validates JS before writing, never deploys and never touches the database.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const toolDir=path.dirname(fileURLToPath(import.meta.url)),bundle=path.resolve(toolDir,'..');
const args=process.argv.slice(2),dry=args.includes('--dry-run');
const root=path.resolve(args.find(a=>!a.startsWith('--'))||process.cwd());
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const text=name=>fs.readFileSync(path.join(toolDir,'p10.4',name),'utf8');
const fail=message=>{throw new Error(message);};
const replaceOnce=(s,old,newText,label)=>{
 const count=s.split(old).length-1;
 if(count!==1)fail(`${label}: expected one matching block, found ${count}. STOP — no existing files changed.`);
 return s.replace(old,newText);
};
const syntax=(name,s)=>{
 const r=spawnSync(process.execPath,['--input-type=module','--check'],{input:s,encoding:'utf8'});
 if(r.status!==0)fail(`${name}: syntax error\n${r.stderr}`);
};
try{
 for(const f of ['src/index.js','public/app.js','public/index.html'])if(!fs.existsSync(path.join(root,f)))fail(`Target repo missing ${f}: ${root}`);
 const changes=new Map();
 const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
 let newApp=app;
 if(app.includes('// P10.4 EMPLOYEE DOCUMENTS START')){
   if(!app.includes(text('frontend-block.txt').trim()))fail('Frontend contains a different P10.4 patch. Review manually; nothing overwritten.');
 }else newApp=replaceOnce(app,text('frontend-old.txt'),text('frontend-block.txt'),'Employee documents frontend');
 const original=fs.readFileSync(path.join(root,'src/index.js'),'utf8');
 let backend=original;
 const importLine="import { decorateEmployeeDocument, manageEmployeeDocument } from './employee-document-management.js';\n";
 if(!backend.includes(importLine)){
   if(!backend.includes('// P10.3: A leave profile belongs to an employee'))fail('Install the P10.3 leave hotfix first. No file changed.');
   backend=replaceOnce(backend,text('backend-list-old.txt'),text('backend-list-new.txt'),'Employee documents GET');
   backend=replaceOnce(backend,text('backend-mutations-old.txt'),text('backend-mutations-new.txt'),'Employee documents mutations');
   backend=importLine+backend;
 }else if(!backend.includes(text('backend-list-new.txt').trim())||!backend.includes(text('backend-mutations-new.txt').trim()))fail('Backend P10.4 integration differs; review manually. No file changed.');
 const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
 let countScripts=0;
 const newHtml=html.replace(/(<script\b[^>]*\bsrc=["'])(\/app\.js(?:\?[^"']*)?)(["'])/g,(all,pre,src,post)=>{
   countScripts++;const url=new URL(src,'https://local.invalid');url.searchParams.set('ed','P10.4');return pre+url.pathname+url.search+post;
 });
 if(countScripts!==1)fail('Expected one /app.js script in public/index.html. Stop — no file changed.');
 if(newHtml!==html)changes.set('public/index.html',Buffer.from(newHtml));
 if(newApp!==app)changes.set('public/app.js',Buffer.from(newApp));
 if(backend!==original)changes.set('src/index.js',Buffer.from(backend));
 for(const f of ['src/employee-document-management.js','public/ui/employee-documents-p10_4.css']){
   const bytes=fs.readFileSync(path.join(bundle,f)),dest=path.join(root,f);
   if(fs.existsSync(dest)&&hash(fs.readFileSync(dest))!==hash(bytes))fail(`${f} already exists with different contents. Nothing overwritten.`);
   if(!fs.existsSync(dest))changes.set(f,bytes);
 }
 syntax('public/app.js',newApp);syntax('src/index.js',backend);syntax('src/employee-document-management.js',fs.readFileSync(path.join(bundle,'src/employee-document-management.js'),'utf8'));
 if(!changes.size){console.log('P10.4 already installed. No changes.');process.exit(0);}
 console.log('Validated. Only these paths will change:\n'+[...changes.keys()].join('\n'));
 if(dry){console.log('Dry run only — no files written.');process.exit(0);}
 const backup=path.resolve(root,'..',`nakna-backup-p10.4-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`);
 fs.mkdirSync(backup,{recursive:true});
 const manifest={root,created_at:new Date().toISOString(),files:[]};
 for(const [f,bytes] of changes){const dest=path.join(root,f),exists=fs.existsSync(dest);manifest.files.push({path:f,existed:exists,old_sha256:exists?hash(fs.readFileSync(dest)):null,new_sha256:hash(bytes)});if(exists){fs.mkdirSync(path.dirname(path.join(backup,f)),{recursive:true});fs.copyFileSync(dest,path.join(backup,f));}}
 fs.writeFileSync(path.join(backup,'manifest.json'),JSON.stringify(manifest,null,2));
 const written=[];
 try{for(const [f,bytes] of changes){const dest=path.join(root,f);fs.mkdirSync(path.dirname(dest),{recursive:true});const temp=dest+'.p104-tmp';fs.writeFileSync(temp,bytes);fs.renameSync(temp,dest);written.push(f);}}
 catch(error){for(const f of written){const m=manifest.files.find(x=>x.path===f);if(m.existed)fs.copyFileSync(path.join(backup,f),path.join(root,f));else fs.rmSync(path.join(root,f),{force:true});}throw error;}
 console.log(`P10.4 installed locally. Backup: ${backup}\nNext: npm run check\nThen deploy using your normal workflow. No database changes were made.`);
}catch(error){console.error(error.message);process.exitCode=1;}
