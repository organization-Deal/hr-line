// Nakna P10.17: tenant-scoped settings, durable outbox and scheduler.
export const NC_RELEASE='P10.17';
export const NC_TYPES={
 checkin:{title:'อย่าลืมเช็กอิน',time:'12:30',enabled:true,text:'สวัสดี {ชื่อ} หากเริ่มทำงานแล้ว อย่าลืมเช็กอินวันนี้นะครับ',employee:true,window:60},
 checkout:{title:'อย่าลืมเช็กเอาต์',time:'20:15',enabled:false,text:'สวัสดี {ชื่อ} หากเลิกงานแล้ว อย่าลืมเช็กเอาต์นะครับ',employee:true,window:60},
 hr_summary:{title:'สรุปประจำวัน HR',time:'13:00',enabled:true,text:'สรุปสถานะทีม {บริษัท} ประจำวันที่ {วันที่}',window:300},
 executive_summary:{title:'สรุปผู้บริหาร',time:'20:30',enabled:false,text:'ภาพรวมทีม {บริษัท} ประจำวันที่ {วันที่}',window:180},
 pending_approvals:{title:'งานรออนุมัติ',time:'16:00',enabled:false,text:'มีรายการรอตรวจสอบของ {บริษัท} กรุณาเปิด Dashboard เพื่อดำเนินการ',window:120}
};
export const NC_SCHEMA=[
 `CREATE TABLE IF NOT EXISTS notification_center_settings(client_id INTEGER NOT NULL,kind TEXT NOT NULL,enabled INTEGER NOT NULL,send_time TEXT NOT NULL,weekdays TEXT NOT NULL,message_text TEXT NOT NULL,recipient_keys TEXT NOT NULL DEFAULT 'null',updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(client_id,kind))`,
 `CREATE TABLE IF NOT EXISTS notification_center_outbox(id INTEGER PRIMARY KEY AUTOINCREMENT,client_id INTEGER NOT NULL,kind TEXT NOT NULL,send_date TEXT NOT NULL,recipient_key TEXT NOT NULL,recipient_label TEXT NOT NULL,provider_scope TEXT NOT NULL,line_user_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,retry_key TEXT NOT NULL,payload_json TEXT NOT NULL,lease_token TEXT,lease_until INTEGER NOT NULL DEFAULT 0,next_attempt_at INTEGER NOT NULL DEFAULT 0,http_status INTEGER,error_code TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(client_id,kind,send_date,recipient_key))`,
 `CREATE INDEX IF NOT EXISTS idx_nc_outbox_scope ON notification_center_outbox(client_id,send_date,kind,status)`,
 `CREATE TABLE IF NOT EXISTS notification_center_runtime(client_id INTEGER NOT NULL,runtime_key TEXT NOT NULL,value_json TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(client_id,runtime_key))`
];
const ready=new WeakMap();
export async function ensureNotificationCenter(db){
 if(ready.has(db))return ready.get(db);
 const job=(async()=>{for(const sql of NC_SCHEMA)await db.prepare(sql).run();})();ready.set(db,job);
 try{await job;}catch(e){ready.delete(db);throw e;}
}
export function ncClock(date=new Date()){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(x=>[x.type,x.value]));
 const key=`${p.year}-${p.month}-${p.day}`,day=new Date(key+'T12:00:00+07:00').getUTCDay();
 return {date:key,time:`${p.hour}:${p.minute}`,hour:Number(p.hour),minute:Number(p.minute),weekday:day||7};
}
export function ncMinutes(time){return Number(time.slice(0,2))*60+Number(time.slice(3));}
export function ncDue(setting,clock){const diff=ncMinutes(clock.time)-ncMinutes(setting.send_time);return setting.enabled&&setting.weekdays.includes(clock.weekday)&&diff>=0&&diff<NC_TYPES[setting.kind].window;}
export function ncTemplate(text,values){return String(text).replace(/\{([^{}]+)\}/g,(m,key)=>String(values[key]??m));}
function parse(value,fallback){try{return JSON.parse(value);}catch{return fallback;}}
export function ncRecipientKey(r){return r.user_id?'u:'+Number(r.user_id):'e:'+Number(r.employee_id||r.id);}
export function ncAllowedRecipients(kind,rows){return kind==='executive_summary'?rows.filter(r=>['owner','co_owner'].includes(r.role)):rows;}
export function ncNormalize(kind,input){
 if(!NC_TYPES[kind])throw new Error('ไม่พบประเภทแจ้งเตือน');
 if(typeof input.enabled!=='boolean')throw new Error('ระบุสถานะเปิดหรือปิด');
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.send_time||''))throw new Error('เวลาไม่ถูกต้อง');
 if(!Array.isArray(input.weekdays)||!input.weekdays.length||input.weekdays.some(d=>!Number.isInteger(d)||d<1||d>7))throw new Error('เลือกวันอย่างน้อยหนึ่งวัน');
 const text=String(input.message_text||'').trim();if(!text||text.length>300)throw new Error('ข้อความต้องมี 1–300 ตัวอักษร');
 const vars=new Set(['ชื่อ','บริษัท','วันที่','เวลา','name','company','date','time']);
 if([...text.matchAll(/\{([^{}]+)\}/g)].some(m=>!vars.has(m[1])))throw new Error('มีตัวแปรข้อความที่ไม่รองรับ');
 const recipients=NC_TYPES[kind].employee?null:input.recipient_keys;
 if(recipients!==null&&(!Array.isArray(recipients)||recipients.length>100||recipients.some(k=>!/^([ue]):[1-9]\d*$/.test(k))))throw new Error('ผู้รับไม่ถูกต้อง');
 if(input.enabled&&!NC_TYPES[kind].employee&&Array.isArray(recipients)&&!recipients.length)throw new Error('เลือกผู้รับก่อนเปิดการแจ้งเตือน');
 return {kind,enabled:input.enabled,send_time:input.send_time,weekdays:[...new Set(input.weekdays)].sort(),message_text:text,recipient_keys:recipients};
}
export async function ncSetting(db,client,kind){
 const row=await db.prepare('SELECT * FROM notification_center_settings WHERE client_id=?1 AND kind=?2').bind(Number(client.id),kind).first();
 const d=NC_TYPES[kind];
 return row?{kind,title:d.title,enabled:Boolean(row.enabled),send_time:row.send_time,weekdays:String(row.weekdays).split(',').map(Number),message_text:row.message_text,recipient_keys:parse(row.recipient_keys,null),updated_at:row.updated_at}:{kind,title:d.title,enabled:kind==='checkin'?client.attendance_reminder_enabled!==0:d.enabled,send_time:d.time,weekdays:[1,2,3,4,5,6],message_text:kind==='checkin'&&client.attendance_reminder_message?client.attendance_reminder_message:d.text,recipient_keys:null,updated_at:null};
}
async function runtime(db,cid,key,data){await db.prepare(`INSERT INTO notification_center_runtime(client_id,runtime_key,value_json) VALUES(?1,?2,?3) ON CONFLICT(client_id,runtime_key) DO UPDATE SET value_json=excluded.value_json,updated_at=CURRENT_TIMESTAMP`).bind(cid,key,JSON.stringify(data)).run();}
export async function ncPush(token,to,payload,retryKey,fetcher=fetch){
 if(!token)return {accepted:false,retryable:true,status:0,error:'LINE_TOKEN_MISSING'};
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{const res=await fetcher('https://api.line.me/v2/bot/message/push',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,'X-Line-Retry-Key':retryKey},body:JSON.stringify({to,messages:JSON.parse(payload)})});
 const accepted=res.ok||(res.status===409&&Boolean(res.headers.get('x-line-accepted-request-id')));
 return {accepted,retryable:[408,429].includes(res.status)||res.status>=500,status:res.status,error:accepted?null:'LINE_HTTP_'+res.status};
 }catch(e){return {accepted:false,retryable:true,status:0,error:e.name==='AbortError'?'LINE_TIMEOUT':'LINE_NETWORK_ERROR'};}finally{clearTimeout(timer);}
}
export function ncMessage(setting,client,recipient,clock,summary=null){
 const d=NC_TYPES[setting.kind],name=recipient.recipient_name||recipient.nickname||recipient.first_name||'คุณ';
 const vars={'ชื่อ':name,'บริษัท':client.name,'วันที่':clock.date,'เวลา':setting.send_time,name,company:client.name,date:clock.date,time:setting.send_time};
 const intro=ncTemplate(setting.message_text,vars);
 const contents=[{type:'text',text:d.title,weight:'bold',size:'lg',color:'#173D43',wrap:true},{type:'text',text:intro,wrap:true,size:'sm',color:'#5F7972',margin:'md'}];
 if(summary){for(const [label,value] of summary)contents.push({type:'box',layout:'horizontal',margin:'md',contents:[{type:'text',text:label,wrap:true,size:'sm',flex:3},{type:'text',text:String(value),align:'end',size:'sm',weight:'bold',flex:1}]});}
 const action=d.employee?{type:'postback',label:setting.kind==='checkin'?'เช็กอินตอนนี้':'เช็กเอาต์ตอนนี้',data:'action='+(setting.kind==='checkin'?'checkin':'checkout')}:{type:'postback',label:'เปิด Dashboard',data:'action=owner_dashboard&client_id='+Number(client.id)};
 return [{type:'flex',altText:(d.title+' · '+client.name).slice(0,200),contents:{type:'bubble',body:{type:'box',layout:'vertical',contents},footer:{type:'box',layout:'vertical',contents:[{type:'button',style:'primary',color:'#04878A',action}]}}}];
}
// A frozen payload and stable retry key are reused after network/LINE failures.
export async function ncDeliver(env,client,kind,key,recipient,date,messages,h){
 const db=env.DB;
 await db.prepare(`INSERT OR IGNORE INTO notification_center_outbox(client_id,kind,send_date,recipient_key,recipient_label,provider_scope,line_user_id,retry_key,payload_json) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)`).bind(client.id,kind,date,key,String(recipient.recipient_name||recipient.nickname||recipient.first_name||'ผู้รับ').slice(0,100),recipient.line_provider_scope||'default',recipient.line_user_id,crypto.randomUUID(),JSON.stringify(messages)).run();
 // Do not deliver a frozen retry to a LINE identity that has since been unbound/replaced.
 await db.prepare(`UPDATE notification_center_outbox SET status='cancelled',error_code='RECIPIENT_IDENTITY_CHANGED',payload_json='',updated_at=CURRENT_TIMESTAMP WHERE client_id=?1 AND kind=?2 AND send_date=?3 AND recipient_key=?4 AND status IN ('pending','retry') AND (line_user_id<>?5 OR provider_scope<>?6)`).bind(client.id,kind,date,key,recipient.line_user_id,recipient.line_provider_scope||'default').run();
 const now=Date.now(),lease=crypto.randomUUID();
 const claim=await db.prepare(`UPDATE notification_center_outbox SET status='sending',attempts=attempts+1,lease_token=?5,lease_until=?6,updated_at=CURRENT_TIMESTAMP WHERE client_id=?1 AND kind=?2 AND send_date=?3 AND recipient_key=?4 AND status IN ('pending','retry','sending') AND attempts<6 AND lease_until<=?7 AND next_attempt_at<=?7`).bind(client.id,kind,date,key,lease,now+90000,now).run();
 if(Number(claim.meta?.changes)!==1)return {skipped:true};
 const row=await db.prepare('SELECT * FROM notification_center_outbox WHERE client_id=?1 AND kind=?2 AND send_date=?3 AND recipient_key=?4 AND lease_token=?5').bind(client.id,kind,date,key,lease).first();
 let result;
 try{const token=await h.getAccessTokenForProviderScope(env,Number(client.id),row.provider_scope);result=await ncPush(token,row.line_user_id,row.payload_json,row.retry_key,h.fetcher||fetch);}catch{result={accepted:false,retryable:true,status:0,error:'LINE_PROVIDER_UNAVAILABLE'};}
 const retry=result.retryable&&row.attempts<6,status=result.accepted?'accepted':retry?'retry':'failed';
 await db.prepare(`UPDATE notification_center_outbox SET status=?2,http_status=?3,error_code=?4,next_attempt_at=?5,lease_until=0,lease_token=NULL,payload_json=CASE WHEN ?2='accepted' THEN '' ELSE payload_json END,updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND lease_token=?6`).bind(row.id,status,result.status,result.error,retry?now+Math.min(480000,30000*2**(row.attempts-1)):0,lease).run();
 return {...result,status};
}
async function employeeCandidates(db,client,kind,clock){
 const check=kind==='checkin'?`NOT EXISTS(SELECT 1 FROM attendance a WHERE a.client_id=e.client_id AND a.employee_id=e.id AND a.work_date=?2 AND (a.check_in_at IS NOT NULL OR a.status IN ('leave','holiday')))`:`EXISTS(SELECT 1 FROM attendance a WHERE a.client_id=e.client_id AND a.employee_id=e.id AND a.work_date=?2 AND a.check_in_at IS NOT NULL AND a.check_out_at IS NULL)`;
 const rows=await db.prepare(`SELECT e.*,c.work_start AS company_start,c.work_end AS company_end FROM employees e JOIN clients c ON c.id=e.client_id WHERE e.client_id=?1 AND e.status='active' AND COALESCE(e.people_status,'employee') IN ('employee','probation') AND trim(COALESCE(e.line_user_id,''))<>'' AND ${check} AND NOT EXISTS(SELECT 1 FROM leave_requests l WHERE l.client_id=e.client_id AND l.employee_id=e.id AND l.status IN ('approved','pending','awaiting_evidence') AND l.start_date<=?2 AND l.end_date>=?2) AND NOT EXISTS(SELECT 1 FROM notification_center_outbox o WHERE o.client_id=e.client_id AND o.kind=?3 AND o.send_date=?2 AND o.recipient_key='e:'||e.id AND (o.status IN ('accepted','failed','cancelled') OR o.next_attempt_at>?4 OR o.lease_until>?4)) ORDER BY e.id LIMIT 1000`).bind(client.id,clock.date,kind,Date.now()).all();
 return rows.results||[];
}
export async function runNotificationCenter(env,controller,h,{now=new Date(),maxSends=60}={}){
 await ensureNotificationCenter(env.DB);await h.ensureMissingCheckinReminderReady(env.DB);await h.ensureDailyHrStatusReady(env.DB);await h.ensureAttendanceRetroReady(env.DB);
 const clock=ncClock(now),db=env.DB;
 await db.prepare("UPDATE notification_center_outbox SET status='failed',error_code='RETRY_LIMIT_AFTER_INTERRUPTION',lease_token=NULL,lease_until=0,updated_at=CURRENT_TIMESTAMP WHERE status='sending' AND attempts>=6 AND lease_until<=?1").bind(Date.now()).run();
 await runtime(db,0,'scheduler',{release:NC_RELEASE,at:now.toISOString(),cron:controller?.cron||'manual',scheduled_at:controller?.scheduledTime||null});
 const clients=(await db.prepare('SELECT id,name,attendance_reminder_enabled,attendance_reminder_message FROM clients ORDER BY id').all()).results||[];
 let attempted=0;
 for(const client of clients){
  for(const kind of Object.keys(NC_TYPES)){
   try{
    const setting=await ncSetting(db,client,kind);if(!ncDue(setting,clock))continue;
    const holiday=await db.prepare('SELECT id FROM company_holidays WHERE client_id=?1 AND holiday_date=?2 LIMIT 1').bind(client.id,clock.date).first();
    if(holiday){await runtime(db,client.id,kind,{date:clock.date,time:clock.time,reason:'COMPANY_HOLIDAY',eligible:0});continue;}
    let eligible=0,sent=0,failed=0,reason=null;
    const d=NC_TYPES[kind];
    if(d.employee){
     const rows=await employeeCandidates(db,client,kind,clock);
     for(const e of rows){
      const schedule=await h.resolveEffectiveWorkSchedule(db,{...e,work_start:e.company_start,work_end:e.company_end},clock.date);
      if(!schedule.is_workday||!schedule.start_time||schedule.start_time>clock.time)continue;
      if(kind==='checkout'&&(!schedule.end_time||schedule.end_time<schedule.start_time||schedule.end_time>clock.time))continue;
      // Old accepted notifications still count after upgrading to this release.
      if(kind==='checkin'&&await db.prepare("SELECT id FROM attendance_reminder_logs WHERE client_id=?1 AND employee_id=?2 AND reminder_date=?3 AND status='sent'").bind(client.id,e.id,clock.date).first())continue;
      eligible++;if(attempted>=maxSends){reason='BATCH_CONTINUES_NEXT_TICK';break;}
      const result=await ncDeliver(env,client,kind,'e:'+e.id,e,clock.date,ncMessage(setting,client,e,clock),h);if(!result.skipped){attempted++;result.accepted?sent++:failed++;}
     }
     if(!eligible&&!reason)reason='NO_ELIGIBLE_EMPLOYEES';
    }else{
     let recipients=ncAllowedRecipients(kind,await h.getDailyHrLineRecipients(db,client.id));
     if(setting.recipient_keys!==null)recipients=recipients.filter(r=>setting.recipient_keys.includes(ncRecipientKey(r)));
     eligible=recipients.length;
     if(!eligible)reason='NO_AUTHORIZED_LINE_RECIPIENTS';
     if(eligible){
      const dashboard=await h.getDashboard(db,client.id,{includeHrCases:false});
      const retro=await db.prepare("SELECT COUNT(*) AS n FROM attendance_retro_requests WHERE client_id=?1 AND status='pending'").bind(client.id).first();
      const summary=dashboard.summary||{},pending=Number(h.dashboardAttentionTotal(dashboard,'leave_pending')||0)+Number(retro?.n||0)+Number(h.dashboardAttentionTotal(dashboard,'request')||0);
      const lines=kind==='pending_approvals'?[['ใบลารออนุมัติ',Number(h.dashboardAttentionTotal(dashboard,'leave_pending')||0)],['เช็กอินย้อนหลังรออนุมัติ',Number(retro?.n||0)],['คำขอรอตรวจสอบ',Number(h.dashboardAttentionTotal(dashboard,'request')||0)]]:[['มีตารางวันนี้',Number(summary.scheduled_today||0)],['เช็กอินแล้ว',Number(summary.scheduled_present??summary.present??0)],['มาสาย',Number(summary.late||0)],['ลาวันนี้',Number(summary.leave||0)],['ยังไม่เช็กอิน',Number(summary.missing||0)],['งานรอตรวจสอบ',pending]];
      if(kind==='pending_approvals'&&!pending)reason='NO_PENDING_TASKS';
      else for(const recipient of recipients){
       if(attempted>=maxSends){reason='BATCH_CONTINUES_NEXT_TICK';break;}
       if(kind==='hr_summary'&&await db.prepare("SELECT client_id FROM hr_daily_status_deliveries WHERE client_id=?1 AND summary_date=?2 AND status='accepted' AND provider_scope=?3 AND line_user_id=?4 LIMIT 1").bind(client.id,clock.date,recipient.line_provider_scope,recipient.line_user_id).first())continue;
       const result=await ncDeliver(env,client,kind,ncRecipientKey(recipient),recipient,clock.date,ncMessage(setting,client,recipient,clock,lines),h);if(!result.skipped){attempted++;result.accepted?sent++:failed++;}
      }
     }
    }
    await runtime(db,client.id,kind,{date:clock.date,time:clock.time,eligible,sent_now:sent,failed_now:failed,reason});
   }catch(e){await runtime(db,client.id,kind,{date:clock.date,time:clock.time,error:String(e.message||'JOB_FAILED').slice(0,180)}).catch(()=>{});console.error(JSON.stringify({event:'notification_center_job_failed',client_id:client.id,kind,error:String(e.message).slice(0,150)}));}
  }
 }
 return {release:NC_RELEASE,date:clock.date,attempted};
}
export async function notificationCenterApi(request,env,auth,h){
 const url=new URL(request.url),path=url.pathname,cid=Number(auth.clientId||0),db=env.DB;
 if(!cid)return Response.json({error:'COMPANY_REQUIRED'},{status:409});
 if(!h.canManagePeopleAdmin(auth.role))return Response.json({error:'ไม่มีสิทธิ์จัดการการแจ้งเตือน'},{status:403});
 await ensureNotificationCenter(db);await h.ensureMissingCheckinReminderReady(db);await h.ensureDailyHrStatusReady(db);
 const client=await db.prepare('SELECT id,name,attendance_reminder_enabled,attendance_reminder_message FROM clients WHERE id=?1').bind(cid).first();
 if(!client)return Response.json({error:'COMPANY_NOT_FOUND'},{status:404});
 const legacy=path==='/api/attendance-reminder-settings';
 if(request.method==='GET'){
  if(legacy){const s=await ncSetting(db,client,'checkin');return Response.json({ok:true,settings:{enabled:s.enabled,reminder_time:s.send_time,message_text:s.message_text,updated_at:s.updated_at}});}
  const settings=[];for(const kind of Object.keys(NC_TYPES))settings.push(await ncSetting(db,client,kind));
  const recipients=await h.getDailyHrLineRecipients(db,cid);
  const heart=await db.prepare("SELECT value_json FROM notification_center_runtime WHERE client_id=0 AND runtime_key='scheduler'").first();
  const runs=(await db.prepare('SELECT runtime_key,value_json FROM notification_center_runtime WHERE client_id=?1').bind(cid).all()).results||[];
  const logs=(await db.prepare('SELECT id,kind,send_date,recipient_label,status,attempts,http_status,error_code,updated_at FROM notification_center_outbox WHERE client_id=?1 ORDER BY id DESC LIMIT 80').bind(cid).all()).results||[];
  const missing=await db.prepare("SELECT COUNT(*) AS n FROM employees WHERE client_id=?1 AND status='active' AND trim(COALESCE(line_user_id,''))=''").bind(cid).first();
  return Response.json({ok:true,release:NC_RELEASE,timezone:'Asia/Bangkok',settings,recipients:recipients.map(r=>({key:ncRecipientKey(r),name:r.recipient_name||'ผู้รับ',role:r.role})),heartbeat:parse(heart?.value_json,null),runs:Object.fromEntries(runs.map(r=>[r.runtime_key,parse(r.value_json,{})])),logs,missing_employee_line:Number(missing?.n||0),today:ncClock().date});
 }
 if(request.method==='PATCH'){
  try{const input=await request.json(),kind=legacy?'checkin':input.kind;
   const before=NC_TYPES[kind]?await ncSetting(db,client,kind):null;
   const s=ncNormalize(kind,legacy?{...before,enabled:![false,0,'false','0'].includes(input.enabled),message_text:input.message_text}:input);
   if(s.recipient_keys!==null){const allowed=ncAllowedRecipients(kind,await h.getDailyHrLineRecipients(db,cid)).map(ncRecipientKey);if(s.recipient_keys.some(k=>!allowed.includes(k)))throw new Error('ผู้รับไม่มีสิทธิ์หรือยังไม่เชื่อม LINE');}
   await db.prepare(`INSERT INTO notification_center_settings(client_id,kind,enabled,send_time,weekdays,message_text,recipient_keys) VALUES(?1,?2,?3,?4,?5,?6,?7) ON CONFLICT(client_id,kind) DO UPDATE SET enabled=excluded.enabled,send_time=excluded.send_time,weekdays=excluded.weekdays,message_text=excluded.message_text,recipient_keys=excluded.recipient_keys,updated_at=CURRENT_TIMESTAMP`).bind(cid,kind,s.enabled?1:0,s.send_time,s.weekdays.join(','),s.message_text,JSON.stringify(s.recipient_keys)).run();
   if(kind==='checkin')await db.prepare('UPDATE clients SET attendance_reminder_enabled=?1,attendance_reminder_message=?2 WHERE id=?3').bind(s.enabled?1:0,s.message_text,cid).run();
   await h.safeAudit(db,cid,'user',String(auth.user.id),'notification.settings.update','notification',kind,{enabled:s.enabled,time:s.send_time,weekdays:s.weekdays,recipient_count:s.recipient_keys?.length??'all_authorized'});
   return Response.json({ok:true,settings:legacy?{enabled:s.enabled,reminder_time:s.send_time,message_text:s.message_text}:s});
  }catch(e){return Response.json({error:String(e.message||'บันทึกไม่สำเร็จ').slice(0,200)},{status:400});}
 }
 if(request.method==='POST'&&path==='/api/notification-center/test'){
  const recipients=await h.getDailyHrLineRecipients(db,cid),self=recipients.find(r=>Number(r.user_id)===Number(auth.user.id));
  if(!self)return Response.json({error:'บัญชีของคุณยังไม่มี LINE ที่ยืนยันสำหรับบริษัทนี้ กรุณาเข้าสู่ระบบผ่าน LINE หรือเชื่อมบัญชีให้ตรงกัน'},{status:400});
  const clock=ncClock(),slot=String(Math.floor(Date.now()/30000));
  const result=await ncDeliver(env,client,'test',ncRecipientKey(self)+':'+slot,self,clock.date,[{type:'text',text:`ข้อความทดสอบจากนากนะ ${NC_RELEASE}\nบริษัท ${client.name}\nเวลาไทย ${clock.date} ${clock.time}\nส่งถึงบัญชีผู้กดทดสอบเท่านั้น`}],h);
  const previous=result.skipped?await db.prepare("SELECT status,error_code FROM notification_center_outbox WHERE client_id=?1 AND kind='test' AND send_date=?2 AND recipient_key=?3").bind(cid,clock.date,ncRecipientKey(self)+':'+slot).first():null;
  return Response.json({ok:Boolean(result.accepted||(result.skipped&&previous?.status==='accepted')),status:result.skipped?(previous?.status==='accepted'?'already_attempted':previous?.status||'pending'):result.status,error:result.error||previous?.error_code||null});
 }
 return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405});
}

// Compatibility for the existing LINE "สถานะสรุป HR" command and status API.
export async function notificationCenterDiagnostics(db,cid,recipient,recipients){
 await ensureNotificationCenter(db);
 const client=await db.prepare('SELECT id,name,attendance_reminder_enabled,attendance_reminder_message FROM clients WHERE id=?1').bind(cid).first();
 const setting=await ncSetting(db,client,'hr_summary'),clock=ncClock();
 const heart=await db.prepare("SELECT value_json FROM notification_center_runtime WHERE client_id=0 AND runtime_key='scheduler'").first();
 const run=await db.prepare("SELECT value_json FROM notification_center_runtime WHERE client_id=?1 AND runtime_key='hr_summary'").bind(cid).first();
 const rows=(await db.prepare("SELECT provider_scope,line_user_id,status,attempts,http_status,error_code,updated_at,next_attempt_at FROM notification_center_outbox WHERE client_id=?1 AND kind='hr_summary' AND send_date=?2").bind(cid,clock.date).all()).results||[];
 const mine=recipient?rows.find(r=>r.provider_scope===(recipient.line_provider_scope||'default')&&r.line_user_id===recipient.line_user_id):null;
 const heartbeat=parse(heart?.value_json,null),lastRun=parse(run?.value_json,null),end=Math.min(1440,ncMinutes(setting.send_time)+NC_TYPES.hr_summary.window);
 const endTime=end===1440?'24:00':String(Math.floor(end/60)).padStart(2,'0')+':'+String(end%60).padStart(2,'0');
 return {release:NC_RELEASE,date:clock.date,time:clock.time,enabled:setting.enabled,weekdays:setting.weekdays,send_time:setting.send_time,catchup_until:endTime,scheduler:heartbeat?{...heartbeat,last_seen_at:heartbeat.at}:null,last_run:lastRun?.date===clock.date?lastRun:null,eligible:recipients.filter(r=>setting.recipient_keys===null||setting.recipient_keys.includes(ncRecipientKey(r))).length,accepted:rows.filter(r=>r.status==='accepted').length,failed:rows.filter(r=>r.status==='failed').length,retrying:rows.filter(r=>['retry','sending'].includes(r.status)).length,me:mine?{status:mine.status,attempts:mine.attempts,http_status:mine.http_status,error:mine.error_code,accepted_at:mine.status==='accepted'?mine.updated_at:null,next_attempt_at:mine.next_attempt_at}:null};
}
