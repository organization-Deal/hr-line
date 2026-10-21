#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root=process.argv[2]||process.cwd();
const code=fs.readFileSync(path.join(root,'src','index.js'),'utf8');
let checks=0;
const yes=(condition,msg)=>{assert.ok(condition,msg);checks++;};
for(const marker of ['// P10.10-DAILY-NOTIFICATION-RECOVERY INSTALLED','/api/hr/notification-health',"status IN ('sent','failed')",'X-Line-Retry-Key','P10.10','async function sendDailyHrStatusSummary(env)'])yes(code.includes(marker),marker);
const s=code.indexOf('function isNaknaP1010ReminderDue(clock){');
const e=code.indexOf('// LINE accepts retry keys',s);
yes(s>0&&e>s,'Clock function boundaries');
const sandbox={DAILY_HR_STATUS_TIME:'13:00'};
vm.createContext(sandbox);vm.runInContext(code.slice(s,e),sandbox);
const due=sandbox.isNaknaP1010ReminderDue;
for(const [time,weekday,min,exp] of [
 ['12:29',4,29,false],['12:30',4,30,true],['12:31',4,31,false],
 ['12:35',4,35,true],['12:55',5,55,true],['13:00',5,0,false],
 ['12:30',7,30,false],['12:35',7,35,false],['08:00',3,0,false]
]){
 const actual=due({time,weekday,minute:min});yes(actual===exp,`Bangkok ${time} wd=${weekday}: expected ${exp}`);
}
const hrStart=code.indexOf('function isDailyHrSummaryDue(clock){');
const hrEnd=code.indexOf('async function runDailyHrStatusTick(',hrStart);
yes(hrStart>0&&hrEnd>hrStart,'HR due boundaries');
vm.runInContext(code.slice(hrStart,hrEnd),sandbox);
for(const [time,exp] of [['12:59',false],['13:00',true],['17:59',true],['18:00',false]]){
 yes(sandbox.isDailyHrSummaryDue({time})===exp,'HR clock '+time);
}
yes(code.includes('retryable:response.status===429||response.status===408||response.status>=500'), 'HR retries HTTP 429');
yes(code.includes("reportDate=String(url.searchParams.get('date')||clock.date)"), 'historical 14-day diagnostic');
yes(code.includes('hr_summary_history:'),'historical summary status');
const fs1=code.indexOf('async function pushNaknaReliableReminderRequest(');
const fs2=code.indexOf('async function runMissingCheckinReminderAutomation(env){',fs1);
yes(fs1>0&&fs2>fs1,'Retry helper boundaries');
let mode=200,lastOptions=null;
const context={
 AbortController,
 setTimeout,clearTimeout,
 fetch:async(url,opts)=>{lastOptions=opts;
   if(mode==='network')throw Error('network');
   return {ok:mode===200, status:mode,headers:{get:key=>mode===409&&key==='x-line-accepted-request-id'?'already-accepted':null}};
 }
};
vm.createContext(context);vm.runInContext(code.slice(fs1,fs2),context);
const push=context.pushNaknaReliableReminderRequest;
const payload=JSON.stringify([{type:'text',text:'notification-fixture'}]);
for(const [m,a,r] of [[200,true,false],[409,true,false],[429,false,true],[503,false,true],[401,false,false],[400,false,false]]){
 mode=m;const resp=await push('test-token','test-user',payload,'123e4567-e89b-12d3-a456-426614174000');
 yes(resp.accepted===a&&resp.retryable===r,`LINE ${m}`);
 yes(lastOptions.headers['X-Line-Retry-Key']==='123e4567-e89b-12d3-a456-426614174000',`LINE ${m} stable retry key`);
 yes(JSON.parse(lastOptions.body).messages[0].text==='notification-fixture',`LINE ${m} immutable payload`);
}
mode='network';const network=await push('token','user',payload,'key');yes(!network.accepted&&network.retryable,'network failure retries');
const absent=await push(null,'user',payload,'key');yes(!absent.accepted&&absent.retryable,'missing token retries');
console.log(`P10.10 JS regression: ${checks}/${checks} PASS`);
