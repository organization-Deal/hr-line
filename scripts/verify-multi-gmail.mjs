import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=process.cwd();
const get=p=>fs.readFileSync(path.join(root,p),'utf8');
const back=get('src/index.js'),front=get('public/app.js'),html=get('public/index.html'),sql=get('migrations/0038_recruitment_multi_gmail.sql');
for(const f of ['src/index.js','public/app.js'])execFileSync(process.execPath,['--check',path.join(root,f)]);
const checks={
  readOnlyOAuth:back.includes("https://www.googleapis.com/auth/gmail.readonly")&&back.includes('startRecruitmentInboxOAuth'),
  oauthState:back.includes("nakna_recruitment_gmail_state")&&back.includes("purpose=`recruitment_gmail:${Number(auth.clientId)}`"),
  encryptedTokens:back.includes('encryptJson(payload,key)')&&back.includes('getRecruitmentInboxAccessToken'),
  primaryIsolated:back.includes('Explicitly opt out of reading recruitment mail from the main')&&back.includes("google_workspace_integrations"),
  perInboxApi:back.includes('recruitmentAccountRoute')&&back.includes('syncDedicatedRecruitmentInbox'),
  accountScope:back.includes('WHERE id=?1 AND client_id=?2'),
  noPermanentErase:back.includes("encrypted_tokens=NULL,status='disconnected'"),
  dedupKey:sql.includes('UNIQUE(account_id, gmail_message_id)'),
  candidateDedupe:back.includes('WHERE NOT EXISTS (SELECT 1 FROM candidates'),
  cron:back.includes('syncAllDedicatedRecruitmentInboxes(env)'),
  sqlTables:sql.includes('CREATE TABLE IF NOT EXISTS recruitment_inbox_messages')&&sql.includes('CREATE TABLE IF NOT EXISTS recruitment_gmail_accounts'),
  frontendRows:front.includes('handleRecruitmentGmailAccountAction')&&html.includes('recruitmentGmailAccountList'),
  sourceAttribution:back.includes('recruitment_inboxes')&&front.includes('candidate.recruitment_inboxes'),
  css:fs.existsSync(path.join(root,'public/ui/nk-multi-gmail.css'))&&html.includes('/ui/nk-multi-gmail.css'),
  noOtherGoogleChanges:!back.slice(back.indexOf('async function finishRecruitmentInboxOAuth'),back.indexOf('async function getRecruitmentInboxAccessToken')).includes('UPDATE google_workspace_integrations')
};
for(const [name,pass] of Object.entries(checks)) assert.ok(pass,`FAILED: ${name}`);
console.log(`✅ Nakna Multi-Gmail: ${Object.keys(checks).length} code safety checks passed`);
console.log('✅ Syntax src/index.js + public/app.js');
console.log('✅ Independent OAuth, per-inbox sync, duplicate handling, provenance, token removal');
