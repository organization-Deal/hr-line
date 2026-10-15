/** Remove only the P10.5 include tags. Never touches business logic or deletes user files. */
import fs from 'node:fs';
import path from 'node:path';
const args=process.argv.slice(2);
const repo=path.resolve(args.find(a=>!a.startsWith('--'))||process.cwd());
const file=path.join(repo,'public','index.html');
if(!fs.existsSync(file)){console.error('No public/index.html');process.exit(1);}
const text=fs.readFileSync(file,'utf8');
const next=text.replace(/^\s*<link rel="stylesheet" href="\/ui\/p10-5\.css\?v=P10\.5-ux1" \/>\s*\n?/m,'\n')
  .replace(/^\s*<script defer src="\/ui\/p10-5\.js\?v=P10\.5-ux1"><\/script>\s*\n?/m,'\n');
if(args.includes('--dry-run'))console.log('Would remove P10.5 includes:',text!==next);
else {fs.writeFileSync(file,next); console.log('P10.5 disabled. Old public/ui/p10-5.* files are harmless when not referenced.');}
