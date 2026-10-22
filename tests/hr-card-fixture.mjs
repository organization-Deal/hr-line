import fs from 'node:fs';
import vm from 'node:vm';
import {ncClock} from '../src/notification-center.js';
export function loadHrCardBuilder(){
 const source=fs.readFileSync('src/index.js','utf8');
 const shared=source.slice(source.indexOf('const LINE_CI = {'),source.indexOf('function leavePolicyIcon('));
 const card=source.slice(source.indexOf('function dashboardAttentionTotal('),source.indexOf('async function sendDailyHrBrief('));
 const date=source.slice(source.indexOf('function formatThaiShortDate('),source.indexOf('async function replyLineWithLocationQuickReply('));
 const ctx={bangkokClock:ncClock,DAILY_HR_STATUS_TIME:'13:00'};
 vm.createContext(ctx);vm.runInContext(shared+card+date,ctx);
 return ctx.buildDailyHrStatusFlex;
}
