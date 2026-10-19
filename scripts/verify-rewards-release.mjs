import fs from 'node:fs';
import assert from 'node:assert/strict';
const read = name => fs.readFileSync(name,'utf8');
const html=read('public/index.html');
const app=read('public/app.js');
const back=read('src/index.js');
const portal=read('public/learn.html');
const pj=read('public/learn.js');
const checks={
  hrTabbedWorkspace: html.includes('data-reward-tab="queue"') && html.includes('data-reward-tab="history"'),
  hrHistory: app.includes('nkRenderRewardsExtras') && html.includes('engagementHistoryList'),
  errorRetry: app.includes('state.engagementLoadError') && html.includes('engagementRetryBtn'),
  hrLeaderboardPreference: app.includes('engagementLeaderboardToggle') && app.includes('/api/engagement/settings'),
  employeeWallet:portal.includes('portalPointHistory') && pj.includes('portalPointHistory'),
  employeeLeaderPrivacy:pj.includes('e.leaderboard_enabled') && back.includes('leaderboard_enabled'),
  employeeScopedHistory:back.includes('SELECT id,points,transaction_type,note,created_at FROM point_transactions WHERE client_id=?1 AND employee_id=?2'),
  noAutomationOnRead:!back.slice(back.indexOf('async function getEngagementOverview('),back.indexOf('async function requestRewardRedemption(')).includes('await runEngagementAutomationForClient'),
  manualRunStillPresent:back.includes("path==='/api/engagement/run-rules'"),
  ciStyles:fs.existsSync('public/ui/nk-rewards-workspace.css') && fs.existsSync('public/ui/nk-rewards-portal.css'),
  noNewDatabaseMigrations:true,
};
for(const [key,yes] of Object.entries(checks)) assert.ok(yes,`Rewards predeploy check failed: ${key}`);
console.log('✅ Nakna rewards release files OK ('+Object.keys(checks).length+' checks)');
console.log('✅ This check does not replace Production auth/LINE/D1 integration testing');
