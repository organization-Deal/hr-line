import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const read=f=>fs.readFileSync(f,'utf8');
const src=read('src/index.js'),app=read('public/app.js'),html=read('public/index.html');
const mandatory=[
  [src.includes('NAKNA_RECRUITMENT_SCREENING_V1'), 'server screening classification'],
  [src.includes("path==='/api/recruitment/screening'"), 'GET Screening API'],
  [src.includes("path==='/api/recruitment/screening/decision'"), 'POST HR decision API'],
  [src.includes('ensureRecruitmentScreeningReady'), 'screening schema'],
  [src.includes("AND NOT (lower(COALESCE(c.source,''))='gmail'"), 'hide unreviewed legacy Gmail candidates'],
  [src.includes('const candidateId=null,importStatus=\'pending_review\'') && src.includes('const candidateId=null,importStatus=\'pending_review\';'), 'inbox staging only'],
  [src.includes('safeAudit(env.DB,clientId'), 'decision audit'],
  [app.includes('function renderRecruitmentScreening()'), 'screening UI'],
  [app.includes('handleRecruitmentScreeningAction'), 'screening actions'],
  [html.includes('nkScreeningPanel'), 'screening HTML'],
  [html.includes('nk-recruitment-screening.css?v='), 'screening CSS inclusion'],
  [fs.existsSync('public/ui/nk-recruitment-screening.css'), 'screening CSS file'],
  [fs.existsSync('migrations/0039_recruitment_screening.sql'), 'migration'],
];
for(const [test,label] of mandatory){console.log((test?'PASS':'FAIL'),label);assert(test,label)}
execFileSync(process.execPath,['--check','src/index.js'],{stdio:'inherit'});
execFileSync(process.execPath,['--check','public/app.js'],{stdio:'inherit'});
console.log('✅ Nakna Recruitment Screening release checks passed');
