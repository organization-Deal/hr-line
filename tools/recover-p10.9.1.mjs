#!/usr/bin/env node
// NAKNA P10.9.2 — history-based surgical recovery for the bad P10.9.1 HTML upload.
// No backend, app.js, migrations or applicant data is changed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const BAD_SHA256 = 'e03dab7856b43c3d3d22ce02a65c14a72c87a665b3e13aead23701fb9935849d';
const HTML_PATH = 'public/index.html';
const markers = ['บัญชีรับสมัครงานที่เชื่อม', 'คิวคัดกรองอีเมล', 'เลือกแหล่งเมล'];
const patches = [
  ['p10-8-recruitment-simple.css', '<link rel="stylesheet" href="/ui/p10-8-recruitment-simple.css?v=P10.8-1">'],
  ['p10-8-recruitment-simple.js', '<script defer src="/ui/p10-8-recruitment-simple.js?v=P10.8-1"></script>'],
  ['p10-9-recruitment-quickstart.css', '<link rel="stylesheet" href="/ui/p10-9-recruitment-quickstart.css?v=P10.9-1">'],
  ['p10-9-recruitment-quickstart.js', '<script defer src="/ui/p10-9-recruitment-quickstart.js?v=P10.9-1"></script>'],
];
function bail(message) { console.error('⛔ '+message); process.exit(2); }
function git(args, options={}) {
  try {return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, ...options }).trimEnd();}
  catch (e) {bail(`Git error: git ${args.join(' ')}\n${String(e.stderr||e.message).slice(0,600)}`);}
}
function sha(s) {return crypto.createHash('sha256').update(s).digest('hex');}
function normalizeGitText(s){return s.replace(/\r\n/g,'\n');}
function fileFromCommit(commit) {return git(['show', `${commit}:${HTML_PATH}`]);}

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const outputIndex = args.indexOf('--output');
if (apply && outputIndex>=0) bail('Choose only --apply or --output PATH.');
if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node tools/recover-p10.9.1.mjs [--dry-run | --apply | --output PATH]');
  process.exit(0);
}
if (outputIndex>=0 && !args[outputIndex+1]) bail('Missing --output path.');
const root = git(['rev-parse','--show-toplevel']);
process.chdir(root);
const currentPath = path.join(root,HTML_PATH);
if (!fs.existsSync(currentPath)) bail(`Cannot find ${HTML_PATH}. Are you in the NAKNA repo?`);
const currentBuffer = fs.readFileSync(currentPath);
const current = normalizeGitText(currentBuffer.toString('utf8'));
const currentSha = sha(currentBuffer);
const history = git(['log','-n','35','--format=%H','--',HTML_PATH]).split(/\r?\n/).filter(Boolean);
if (!history.length) bail('Git history for public/index.html not found; cannot recover safely.');
let badCommit = null;
for (const c of history) {
  const contents = normalizeGitText(fileFromCommit(c));
  if (sha(contents)===BAD_SHA256 || (contents.includes('p10-9-recruitment-quickstart.js') && markers.filter(m=>contents.includes(m)).length===0 && contents.length>=220000 && contents.length<=250000)) {
    badCommit = c; break;
  }
}
if (!badCommit) bail('Did not find the P10.9.1 overwrite commit in last 35 changes to index.html. Stopping.');
if (badCommit !== history[0]) bail('There are newer commits editing public/index.html after P10.9.1; automatic recovery could discard those changes. Stop and review history manually.');
const good = normalizeGitText(fileFromCommit(`${badCommit}^`));
const matched = markers.filter(m=>good.includes(m));
if (matched.length < 2) bail('The version before P10.9.1 does not contain the expected multi-account Recruitment UI. Stopping rather than rolling back to another outdated file.');
if (!/<\/head\s*>/i.test(good)) bail('Recovered HTML has no </head>.');
if (sha(good)===BAD_SHA256) bail('The version before P10.9.1 is also the broken HTML.');

const isBadFile = currentSha===BAD_SHA256 || (current.includes('p10-9-recruitment-quickstart.js') && matched.some(x=>!current.includes(x)));
if (!isBadFile) bail(`Current ${HTML_PATH} is not recognized as P10.9.1 broken file (sha ${currentSha.slice(0,12)}). Your repo might already be fixed or have newer edits; review the Git history manually.`);
const dirty = git(['status','--porcelain','--',HTML_PATH]);
if (apply && dirty.trim()) bail('public/index.html has uncommitted edits. Commit/stash those before recovering.');

let restored = good;
const inserted=[];
for (const [name,tag] of patches) {
  if (!restored.includes(name)) {
    restored=restored.replace(/<\/head\s*>/i,`${tag}\n</head>`);
    inserted.push(name);
  }
}
if(markers.filter(m=>restored.includes(m)).length<2) bail('Recovery verification failed: Recruitment source markers absent.');
for(const [name] of patches){if(!restored.includes(name)) bail(`Recovery verification failed: ${name} missing.`);}
if (restored.includes('to:in:inbox')) console.warn('⚠️ There may still be an old Gmail recipient Query; review account settings after restoring.');
console.log('NAKNA P10.9.2 — Git history recovery');
console.log(`Current broken SHA-256: ${currentSha}`);
console.log(`Bad commit: ${badCommit}`);
console.log(`Pre-upload good HTML markers: ${matched.join(' | ')}`);
console.log(`Restored HTML chars: ${restored.length}; added tags: ${inserted.join(', ')||'none (already present)'}`);
if (!apply && outputIndex<0) {
  console.log('DRY RUN ONLY; no files changed. Use --apply to write or --output PATH to generate a file.');
  process.exit(0);
}
const out = outputIndex>=0 ? path.resolve(root, args[outputIndex+1]):currentPath;
if (out===currentPath) {
  const dir=path.join(root,'.nakna-recovery-p1092');
  fs.mkdirSync(dir,{recursive:true});
  const backup=path.join(dir,`index-before-recovery-${Date.now()}.html`);
  fs.copyFileSync(currentPath,backup);
  console.log(`Backup saved: ${path.relative(root,backup)}`);
} else fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,restored+'\n','utf8');
console.log(`✅ Recovered: ${path.relative(root,out)} (${sha(fs.readFileSync(out)).slice(0,12)})`);
console.log('Next: inspect git diff -- public/index.html; run npm run check; deploy only after reviewing the restored Recruitment screen.');
