#!/usr/bin/env node
/**
 * Nakna P10.10 — resilient scheduled LINE notifications.
 * Applies ONLY to src/index.js in the user's CURRENT checkout, not an old code snapshot.
 * Dry-run and syntax validation always happen before any write. A backup is created.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const VERSION='P10.10-DAILY-NOTIFICATION-RECOVERY';
const dry=process.argv.includes('--dry-run');
const paths=process.argv.filter((x,i)=>i>1 && !x.startsWith('--'));
const root=path.resolve(paths[0]||process.cwd());
const target=path.join(root,'src','index.js');
const fail=m=>{throw new Error(m)};
const ensure=(condition,message)=>{if(!condition)fail(message)};
const once=(source,needle,replacement,step)=>{
 const n=source.split(needle).length-1;
 ensure(n===1,`${step}: expected exactly 1 anchor; found ${n}. NO FILES CHANGED.`);
 return source.replace(needle,replacement);
};
const within=(source,begin,end,fn)=>{
 const a=source.indexOf(begin),b=source.indexOf(end,a+begin.length);
 ensure(a>=0&&b>a,`Cannot find safe boundaries ${begin} -> ${end}. NO FILES CHANGED.`);
 return source.slice(0,a)+fn(source.slice(a,b))+source.slice(b);
};
const sha=source=>crypto.createHash('sha256').update(source).digest('hex');

function transform(original){
 let source=original;
 if(source.includes(`// ${VERSION} INSTALLED`)){
  ensure(source.includes('runMissingCheckinReminderAutomation')&&source.includes('X-Line-Retry-Key'), 'Partial P10.10 installation detected. STOP.');
  return {source,already:true};
 }
 for(const needle of [
   'async scheduled(controller, env, ctx)',
   'function bangkokClock(date=new Date())',
   'async function runMissingCheckinReminderAutomation(env)',
   'async function pushDailyHrSummaryRequest(',
   'async function sendDailyHrStatusSummary(env)',
   'function dailyHrCommand(text)',
   'async function getDailyHrSummaryDiagnostics(env',
   'const clientId = auth.clientId ? Number(auth.clientId) : null;',
   'const MISSING_CHECKIN_REMINDER_TIME',
   'const DAILY_HR_STATUS_TIME'
 ])ensure(source.includes(needle),`This Nakna backend is not a supported version: ${needle}. STOP.`);

 source=once(source,
 `    if(clock.time===MISSING_CHECKIN_REMINDER_TIME){`,
 `    if(isNaknaP1010ReminderDue(clock)){`,
 'Schedule 12:30 catch-up');

 const helper=`// ${VERSION} INSTALLED
// Only between 12:30 and 12:59 Bangkok, once per 5-minute slot.
// Sunday is always skipped, even if there are employee-specific Sunday shifts.
// Daily per-employee acceptance logs prevent multiple LINE sends.
function isNaknaP1010ReminderDue(clock){
  return Boolean(clock && Number(clock.weekday)!==7 && clock.time>='12:30' && clock.time<'13:00' && Number(clock.minute)%5===0);
}

// LINE accepts retry keys for push; a 409 + accepted request ID means that the
// SAME notification was previously accepted (not necessarily displayed).
async function pushNaknaReliableReminderRequest(accessToken,to,payloadJson,retryKey){
  if(!accessToken)return {accepted:false,retryable:true,http_status:0,error:'LINE_TOKEN_MISSING'};
  const abort=new AbortController();
  const timer=setTimeout(()=>abort.abort(),10000);
  try{
    const response=await fetch('https://api.line.me/v2/bot/message/push',{
      method:'POST',signal:abort.signal,
      headers:{'content-type':'application/json',authorization:'Bearer '+accessToken,'X-Line-Retry-Key':retryKey},
      body:JSON.stringify({to,messages:JSON.parse(payloadJson)})
    });
    const accepted=response.ok||(response.status===409&&Boolean(response.headers.get('x-line-accepted-request-id')));
    const status=response.status;
    return {accepted,retryable:status===429||status===408||status>=500,http_status:status,
      error:accepted?null:'LINE_HTTP_'+status};
  }catch(error){
    return {accepted:false,retryable:true,http_status:0,
      error:error?.name==='AbortError'?'LINE_TIMEOUT':'LINE_NETWORK_ERROR'};
  }finally{clearTimeout(timer);}
}

`;
 source=once(source,'async function runMissingCheckinReminderAutomation(env){',helper+'async function runMissingCheckinReminderAutomation(env){','Add reliable reminder helpers');

 // Add retry state to the existing log table; preserve all old sent records.
 source=once(source,`  SCHEMA_READY.add('missing_checkin_reminders');`,
 `  await ensureColumns(db,'attendance_reminder_logs',[
    ['attempts','INTEGER NOT NULL DEFAULT 0'],
    ['lease_until','INTEGER NOT NULL DEFAULT 0'],
    ['next_attempt_at','INTEGER NOT NULL DEFAULT 0'],
    ['retry_key','TEXT'],
    ['message_json','TEXT'],
    ['http_status','INTEGER']
  ]);
  SCHEMA_READY.add('missing_checkin_reminders');`,
 'Durable reminder columns');

 const markerStart='async function runMissingCheckinReminderAutomation(env){';
 const markerEnd='function safeJsonParse(value,fallback=null)';
 source=within(source,markerStart,markerEnd,(section)=>{
  const queryMatch=section.match(/const result=await env\.DB\.prepare\(`([\s\S]*?)`\)\.bind\(lastEmployeeId,today,weekday,fallbackWorkday,MISSING_CHECKIN_REMINDER_TIME,MISSING_CHECKIN_REMINDER_DEFAULT_MESSAGE\)\.all\(\);/);
  ensure(queryMatch,'Attendance eligibility SQL not recognized. STOP rather than change scheduling rules.');
  ensure(queryMatch[0].includes('attendance_reminder_logs ar')&&queryMatch[0].includes('ar.reminder_date=?2'), 'Attendance log filter changed. STOP.');
  // Pending and retry rows remain eligible, accepted / permanently failed rows do not.
  const eligibility=queryMatch[0].replace('ar.reminder_date=?2',"ar.reminder_date=?2 AND ar.status IN ('sent','failed')");
  const replacement=`async function runMissingCheckinReminderAutomation(env){
  await ensureMissingCheckinReminderReady(env.DB);
  const clock=bangkokClock();
  if(!isNaknaP1010ReminderDue(clock))return {skipped:true,reason:'outside_time_or_sunday',time:clock.time};
  const today=clock.date,weekday=Number(clock.weekday||7),fallbackWorkday=weekday<=5?1:0;
  const tokenCache=new Map();
  let lastEmployeeId=0,eligible=0,sent=0,failed=0,retrying=0,attempted=0;
  while(true){
    ${eligibility}
    const rows=result.results||[];
    if(!rows.length)break;
    lastEmployeeId=Number(rows[rows.length-1].id||lastEmployeeId);
    eligible+=rows.length;
    const now=Date.now();
    let cursor=0;
    const handle=async()=>{
      while(cursor<rows.length){
        const row=rows[cursor++];
        const cid=Number(row.client_id),employeeId=Number(row.id),scope=String(row.line_provider_scope||'default');
        const recipient=String(row.line_user_id||'');
        const messageJson=JSON.stringify([buildMissingCheckinReminderFlex(row.reminder_message)]);
        try{
          await env.DB.prepare(\`INSERT OR IGNORE INTO attendance_reminder_logs
              (client_id,employee_id,reminder_date,reminder_time,provider_scope,status,retry_key,message_json)
              VALUES (?1,?2,?3,?4,?5,'pending',?6,?7)\`)
            .bind(cid,employeeId,today,MISSING_CHECKIN_REMINDER_TIME,scope,crypto.randomUUID(),messageJson).run();
          const lease=now+60000;
          const claim=await env.DB.prepare(\`UPDATE attendance_reminder_logs SET
             status='sending',attempts=COALESCE(attempts,0)+1,lease_until=?4
             WHERE client_id=?1 AND employee_id=?2 AND reminder_date=?3
             AND status IN ('pending','retry','sending') AND COALESCE(attempts,0)<5
             AND COALESCE(lease_until,0)<=?5 AND COALESCE(next_attempt_at,0)<=?5\`)
            .bind(cid,employeeId,today,lease,now).run();
          if(Number(claim.meta?.changes||0)!==1)continue;
          attempted++;
          const saved=await env.DB.prepare(\`SELECT retry_key,message_json,attempts FROM attendance_reminder_logs
            WHERE client_id=?1 AND employee_id=?2 AND reminder_date=?3\`)
            .bind(cid,employeeId,today).first();
          const tokenKey=scope==='default'?'default':cid+'|'+scope;
          if(!tokenCache.has(tokenKey))tokenCache.set(tokenKey,getAccessTokenForProviderScope(env,cid,scope).catch(()=>null));
          const token=await tokenCache.get(tokenKey);
          const response=await pushNaknaReliableReminderRequest(token,recipient,saved.message_json,saved.retry_key);
          const attempts=Number(saved.attempts||1),retry=response.retryable&&attempts<5;
          const status=response.accepted?'sent':retry?'retry':'failed';
          const next=retry?Date.now()+Math.min(8*60000,30000*2**(attempts-1)):0;
          await env.DB.prepare(\`UPDATE attendance_reminder_logs SET status=?4,http_status=?5,error_text=?6,
             lease_until=0,next_attempt_at=?7,sent_at=CASE WHEN ?4='sent' THEN CURRENT_TIMESTAMP ELSE sent_at END
             WHERE client_id=?1 AND employee_id=?2 AND reminder_date=?3 AND status='sending'\`)
            .bind(cid,employeeId,today,status,Number(response.http_status||0),response.error||null,next).run();
          if(response.accepted)sent++;else if(retry)retrying++;else failed++;
          if(!response.accepted)console.warn(JSON.stringify({event:'missing_checkin_delivery_failed',client_id:cid,
            http_status:response.http_status,error:response.error,attempts,retry}));
        }catch(error){
          failed++;
          console.error(JSON.stringify({event:'missing_checkin_delivery_store_failed',client_id:cid,
            message:String(error?.message||error).slice(0,250)}));
        }
      }
    };
    await Promise.all(Array.from({length:Math.min(4,rows.length)},handle));
    if(rows.length<1000)break;
  }
  try{
    await ensureDailyHrStatusReady(env.DB);
    await setDailyHrRuntime(env.DB,'missing_checkin_last_run',{
      date:today,time:clock.time,at:new Date().toISOString(),eligible,attempted,sent,failed,retrying,release:'P10.10'});
  }catch(error){console.warn(JSON.stringify({event:'missing_checkin_run_health_write_failed',message:String(error?.message||error)}));}
  console.log(JSON.stringify({event:'missing_checkin_reminder_complete',date:today,time:clock.time,eligible,attempted,sent,failed,retrying}));
  return {date:today,time:clock.time,eligible,attempted,sent,failed,retrying};
}

`;
  return replacement;
 });

 // Repair HR delivery rate-limit handling without changing existing tenant auth.
 source=once(source,'return {accepted,retryable:response.status>=500,status:response.status,',
  'return {accepted,retryable:response.status===429||response.status===408||response.status>=500,status:response.status,',
  'HR 429 retry correction');

 // Do not affect other notifications or 13:00 message content.
 // Add the P10.6-style guard if a previous full-file update silently removed it.
 if(!source.includes('getP106DailyHrDayOff')&&!source.includes('getDailyHrAutomaticDayOff')){
  const holidayGuard=`// P10.10: Safe automatic-only day-off guard. Manual HR summary is still accessible.
async function getNaknaP1010HrDayOff(db,clientId,clock){
  if(Number(clock.weekday)===7)return {skip:true,reason:'sunday'};
  const row=await db.prepare('SELECT name FROM company_holidays WHERE client_id=?1 AND holiday_date=?2 LIMIT 1')
    .bind(Number(clientId),clock.date).first();
  return row?{skip:true,reason:'company_holiday',name:String(row.name||'วันหยุดบริษัท')}:{skip:false};
}

`;
  source=once(source,'async function sendDailyHrStatusSummary(env){',holidayGuard+'async function sendDailyHrStatusSummary(env){','Holiday guard helper');
  source=within(source,'async function sendDailyHrStatusSummary(env){','function dailyHrCommand(text){',block=>{
    block=once(block,'  if(!isDailyHrSummaryDue(clock))return {sent:0,clients:0,skipped:true,time:clock.time};',
      "  if(!isDailyHrSummaryDue(clock))return {sent:0,clients:0,skipped:true,time:clock.time};\n  if(Number(clock.weekday)===7)return {sent:0,clients:0,skipped:true,reason:'sunday',date:clock.date};",'HR Sunday guard');
    block=once(block,'    try{\n      const recipients=await getDailyHrLineRecipients(env.DB,cid);',
      "    try{\n      const dayOff=await getNaknaP1010HrDayOff(env.DB,cid,clock);\n      if(dayOff.skip){await setDailyHrRuntime(env.DB,`client:${cid}`,{date:clock.date,time:clock.time,auto_skipped:true,skip_reason:dayOff.reason,error:null});continue;}\n      const recipients=await getDailyHrLineRecipients(env.DB,cid);",'HR holiday guard by client');
    return block;
  });
 }

 // Safe, tenant-scoped diagnostics endpoint: no LINE IDs/tokens or private employee names.
 const api=`  if(path==='/api/hr/notification-health' && method==='GET'){
    if(!clientId)return json({error:'COMPANY_REQUIRED'},409);
    if(!canManagePeopleAdmin(auth.role))return json({error:'ไม่มีสิทธิ์'},403);
    await ensureMissingCheckinReminderReady(env.DB);
    await ensureDailyHrStatusReady(env.DB);
    const clock=bangkokClock();
    const reportDate=String(url.searchParams.get('date')||clock.date);
    const oldest=new Date(Date.parse(clock.date+'T00:00:00Z')-14*86400000).toISOString().slice(0,10);
    if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(reportDate) || reportDate>clock.date || reportDate<oldest)
      return json({error:'INVALID_REPORT_DATE',hint:'ใช้ YYYY-MM-DD ไม่เกิน 14 วันย้อนหลัง'},400);
    const [settings,counts,summary,heartbeat,hrHistory,holiday]=await Promise.all([
      getMissingCheckinReminderSettings(env.DB,clientId),
      env.DB.prepare(\`SELECT status,COUNT(*) AS n,MAX(http_status) AS http_status
        FROM attendance_reminder_logs WHERE client_id=?1 AND reminder_date=?2 GROUP BY status\`)
        .bind(clientId,reportDate).all(),
      getDailyHrSummaryDiagnostics(env,clientId),
      env.DB.prepare(\`SELECT value_json FROM hr_daily_status_runtime WHERE runtime_key='missing_checkin_last_run'\`).first(),
      env.DB.prepare(\`SELECT status,COUNT(*) AS n,MAX(http_status) AS http_status
        FROM hr_daily_status_deliveries WHERE client_id=?1 AND summary_date=?2 GROUP BY status\`)
        .bind(clientId,reportDate).all(),
      env.DB.prepare('SELECT name FROM company_holidays WHERE client_id=?1 AND holiday_date=?2 LIMIT 1')
        .bind(clientId,reportDate).first()
    ]);
    const aggregate=rs=>Object.fromEntries((rs.results||[]).map(r=>[String(r.status),{
      count:Number(r.n||0),last_http_status:r.http_status||null}]));
    const lastReminderRun=safeJsonParse(heartbeat?.value_json,null);
    return json({ok:true,date:reportDate,time:clock.time,
      company_holiday:holiday?String(holiday.name||'วันหยุดบริษัท'):null,
      checkin_reminder:{enabled:Boolean(settings?.enabled),send_window:'12:30–12:59 (Bangkok)',
        deliveries:aggregate(counts),latest_automated_attempt:lastReminderRun?.date===reportDate?{
          at:lastReminderRun.at,time:lastReminderRun.time}:null},
      hr_summary_history:{date:reportDate,deliveries:aggregate(hrHistory)},
      hr_summary_today:summary});
  }

`;
 source=once(source,"  if(path==='/api/hr/daily-summary/status'&&method==='GET'){",api+"  if(path==='/api/hr/daily-summary/status'&&method==='GET'){",'Notification health API');

 return {source,already:false};
}

try{
 ensure(fs.existsSync(target),`Missing ${target}. Run from the actual Nakna repository root.`);
 const old=fs.readFileSync(target,'utf8');
 const result=transform(old);
 if(result.already){console.log('P10.10 already installed. No files changed.');process.exit(0);}
 const syntax=spawnSync(process.execPath,['--input-type=module','--check'],{input:result.source,encoding:'utf8'});
 ensure(syntax.status===0,`Generated source failed syntax validation: ${syntax.stderr}`);
 for(const x of ['isNaknaP1010ReminderDue','pushNaknaReliableReminderRequest','/api/hr/notification-health']){
   // Compatible with function naming used above, not a reason to touch the original code.
   ensure(result.source.includes(x),'Output validation failed '+x);
 }
 console.log(JSON.stringify({ok:true,patch:VERSION,old_sha256:sha(old),new_sha256:sha(result.source),bytes:result.source.length,dry_run:dry}));
 if(dry){console.log('Dry run: no files changed.');process.exit(0);}
 const backup=path.join(root,'.nakna-backups','p10.10-'+new Date().toISOString().replace(/[:.]/g,'-'));
 fs.mkdirSync(backup,{recursive:true});
 fs.copyFileSync(target,path.join(backup,'index.js'));
 fs.writeFileSync(path.join(backup,'manifest.json'),JSON.stringify({patch:VERSION,sha256:sha(old)},null,2));
 const tmp=target+'.p1010.tmp';fs.writeFileSync(tmp,result.source);fs.renameSync(tmp,target);
 console.log('Updated src/index.js only; original saved in',backup);
 console.log('Next: node tests/test-p10.10.mjs && npm run check; stage before Deploy.');
}catch(error){console.error('P10.10 STOPPED:',error.message);process.exitCode=1;}
