// Payslip delivery is explicit, employee scoped and independent of bank transfers.
export const PAYSLIP_DELIVERY_SCHEMA=`CREATE TABLE IF NOT EXISTS payroll_payslip_deliveries(client_id INTEGER NOT NULL,period_id INTEGER NOT NULL,employee_id INTEGER NOT NULL,retry_key TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',lease_token TEXT,lease_until INTEGER NOT NULL DEFAULT 0,error_code TEXT,accepted_at TEXT,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(client_id,period_id,employee_id))`;
const ready=new WeakMap();
export async function ensurePayslipDelivery(db){if(ready.has(db))return ready.get(db);const p=db.prepare(PAYSLIP_DELIVERY_SCHEMA).run();ready.set(db,p);try{await p;}catch(e){ready.delete(db);throw e;}}
const json=(data,status=200)=>Response.json(data,{status});
export function payslipRecipients(detail,ledger=[]){
 const docs=new Map((detail.documents||[]).filter(x=>x.document_type==='payslip').map(x=>[Number(x.employee_id),x]));
 const deliveries=new Map(ledger.map(x=>[Number(x.employee_id),x]));
 return (detail.items||[]).map(item=>{const id=Number(item.employee_id),doc=docs.get(id),delivery=deliveries.get(id),sent=Boolean(doc?.line_notified_at||delivery?.status==='accepted');return {employee_id:id,name:[item.nickname||item.first_name,item.last_name].filter(Boolean).join(' '),employee_code:item.employee_code||'',line_connected:Boolean(Number(item.line_connected)),document_ready:Boolean(doc?.drive_file_id&&doc?.sha256&&doc?.share_token_value),status:sent?'accepted':delivery?.status==='sending'&&Number(delivery.lease_until)>Date.now()?'sending':!Number(item.line_connected)?'no_line':delivery?.status==='failed'?'failed':'pending',accepted_at:doc?.line_notified_at||delivery?.accepted_at||null,error_code:delivery?.error_code||null};});
}
export async function payrollDeliveryApi(request,env,auth,pid,h){
 const db=env.DB,cid=Number(auth.clientId||0);pid=Number(pid);
 if(!cid)return json({error:'COMPANY_REQUIRED'},409);
 if(!h.canManagePayroll(auth.role))return json({error:'ไม่มีสิทธิ์ส่งสลิปเงินเดือน'},403);
 if(!['GET','POST'].includes(request.method))return json({error:'METHOD_NOT_ALLOWED'},405);
 const detail=await h.getDetail(db,cid,pid);
 if(!detail.period)return json({error:'ไม่พบรอบเงินเดือน'},404);
 await ensurePayslipDelivery(db);
 const ledger=()=>db.prepare('SELECT * FROM payroll_payslip_deliveries WHERE client_id=?1 AND period_id=?2').bind(cid,pid).all();
 if(request.method==='GET'){const line=await h.lineContext(env,cid);return json({period:{id:pid,status:detail.period.status,updated_at:detail.period.updated_at,net_total:detail.period.net_total},paid:Boolean(detail.payment_confirmation),line_ready:Boolean(line?.accessToken),recipients:payslipRecipients(detail,(await ledger()).results||[])});}
 if(!['locked','published'].includes(detail.period.status))return json({error:'กรุณายืนยันยอดเงินเดือนก่อนส่งสลิป'},409);
 if(!detail.payment_confirmation)return json({error:'กรุณาบันทึกว่าจ่ายเงินจริงแล้วก่อนส่งสลิป'},409);
 let input;try{input=await request.json();}catch{return json({error:'ข้อมูลไม่ถูกต้อง'},400);}
 if(input?.confirmed!==true||!Array.isArray(input.employee_ids)||!input.employee_ids.length||input.employee_ids.length>20||input.employee_ids.some(x=>!Number.isSafeInteger(x)||x<=0))return json({error:'กรุณาเลือกผู้รับ 1–20 คนต่อชุดและยืนยันการส่ง'},400);
 const ids=[...new Set(input.employee_ids)],members=new Set(detail.items.map(x=>Number(x.employee_id)));
 if(ids.some(id=>!members.has(id)))return json({error:'มีผู้รับที่ไม่ได้อยู่ในรอบเงินเดือนนี้'},400);
 if(input.expected_updated_at!==detail.period.updated_at||Number(input.expected_net_total)!==Number(detail.period.net_total))return json({error:'ข้อมูลรอบเปลี่ยนแล้ว กรุณาเปิดรายการส่งใหม่'},409);
 const line=await h.lineContext(env,cid);if(!line?.accessToken)return json({error:'ช่องทาง LINE ยังไม่พร้อม กรุณาตรวจการเชื่อมต่อ'},409);
 let current=detail;
 if(payslipRecipients(detail).some(x=>ids.includes(x.employee_id)&&x.line_connected&&!x.document_ready&&x.status!=='accepted')){
  await h.generate(env,cid,pid,{notify:false,employeeIds:ids});current=await h.getDetail(db,cid,pid);
 }
 current=await h.getDetail(db,cid,pid);
 if(!current.payment_confirmation||!['locked','published'].includes(current.period?.status)||current.period.updated_at!==input.expected_updated_at||Number(current.period.net_total)!==Number(input.expected_net_total))return json({error:'สถานะรอบหรือบันทึกการจ่ายเปลี่ยนแล้ว กรุณาเปิดรายการใหม่'},409);
 const docs=new Map((current.documents||[]).filter(x=>x.document_type==='payslip').map(x=>[Number(x.employee_id),x]));
 const results=[];
 for(const eid of ids){
  const employee=await db.prepare('SELECT id,first_name,last_name,nickname,line_user_id FROM employees WHERE client_id=?1 AND id=?2').bind(cid,eid).first(),doc=docs.get(eid),item=current.items.find(x=>Number(x.employee_id)===eid);
  if(!employee?.line_user_id){results.push({employee_id:eid,status:'no_line'});continue;}
  if(!doc?.drive_file_id||!doc?.sha256||!doc?.share_token_value){results.push({employee_id:eid,status:'failed',error_code:'DOCUMENT_NOT_READY'});continue;}
  if(doc.line_notified_at){results.push({employee_id:eid,status:'accepted',skipped:true});continue;}
  await db.prepare("INSERT OR IGNORE INTO payroll_payslip_deliveries(client_id,period_id,employee_id,retry_key) VALUES (?1,?2,?3,?4)").bind(cid,pid,eid,crypto.randomUUID()).run();
  const token=crypto.randomUUID(),now=Date.now();
  const claim=await db.prepare("UPDATE payroll_payslip_deliveries SET status='sending',lease_token=?4,lease_until=?5,error_code=NULL,updated_at=CURRENT_TIMESTAMP WHERE client_id=?1 AND period_id=?2 AND employee_id=?3 AND status!='accepted' AND (status!='sending' OR lease_until<=?6)").bind(cid,pid,eid,token,now+120000,now).run();
  if(Number(claim.meta?.changes)!==1){const previous=await db.prepare('SELECT status FROM payroll_payslip_deliveries WHERE client_id=?1 AND period_id=?2 AND employee_id=?3').bind(cid,pid,eid).first();results.push({employee_id:eid,status:previous?.status==='accepted'?'accepted':'sending',skipped:true});continue;}
  const job=await db.prepare('SELECT retry_key FROM payroll_payslip_deliveries WHERE client_id=?1 AND period_id=?2 AND employee_id=?3').bind(cid,pid,eid).first();
  try{
   const url=`${env.APP_BASE_URL||'https://hr-line.organization-23c.workers.dev'}/payslip/${doc.share_token_value}`;
   const accepted=await h.send(line.accessToken,employee.line_user_id,[h.card(employee,current.period,item.net_pay,url)],job.retry_key);
   if(!accepted)throw Error('LINE_REJECTED');
   await db.batch([
    db.prepare("UPDATE payroll_payslip_deliveries SET status='accepted',accepted_at=CURRENT_TIMESTAMP,lease_token=NULL,lease_until=0,updated_at=CURRENT_TIMESTAMP WHERE client_id=?1 AND period_id=?2 AND employee_id=?3 AND lease_token=?4").bind(cid,pid,eid,token),
    db.prepare('UPDATE payroll_documents SET line_notified_at=COALESCE(line_notified_at,CURRENT_TIMESTAMP) WHERE client_id=?1 AND period_id=?2 AND employee_id=?3 AND id=?4').bind(cid,pid,eid,doc.id)
   ]);
   results.push({employee_id:eid,status:'accepted'});
  }catch(error){
   const code=PAYSLIP_ERRORS.has(error?.code)?error.code:'LINE_SEND_FAILED';
   await db.prepare("UPDATE payroll_payslip_deliveries SET status='failed',error_code=?5,lease_token=NULL,lease_until=0,updated_at=CURRENT_TIMESTAMP WHERE client_id=?1 AND period_id=?2 AND employee_id=?3 AND lease_token=?4").bind(cid,pid,eid,token,code).run();
   results.push({employee_id:eid,status:'failed',error_code:code});
  }
 }
 const fresh=await h.getDetail(db,cid,pid),rows=payslipRecipients(fresh,(await ledger()).results||[]),complete=rows.length>0&&rows.every(x=>x.status==='accepted');
 if(complete&&fresh.period.status==='locked'){
  await db.prepare("UPDATE payroll_periods SET status='published',published_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE client_id=?1 AND id=?2 AND status='locked'").bind(cid,pid).run();
  await db.prepare("UPDATE payroll_items SET status='published',updated_at=CURRENT_TIMESTAMP WHERE client_id=?1 AND period_id=?2").bind(cid,pid).run();
  if(h.event)await h.event(db,cid,pid,Number(auth.user.id),'published',{line_accepted:rows.length});
 }
 if(h.event)await h.event(db,cid,pid,Number(auth.user.id),'payslips_sent_selected',{selected:ids.length,accepted:results.filter(x=>x.status==='accepted').length,failed:results.filter(x=>x.status==='failed').length});
 await h.audit(db,cid,'user',String(auth.user.id),'payroll.payslips_send','payroll_period',String(pid),{employee_ids:ids,accepted:results.filter(x=>x.status==='accepted').length,failed:results.filter(x=>x.status==='failed').length});
 return json({ok:true,complete,results,accepted_total:rows.filter(x=>x.status==='accepted').length,total:rows.length});
}

const PAYSLIP_ERRORS=new Set(['LINE_SEND_FAILED','LINE_PAYLOAD_INVALID','LINE_TOKEN_INVALID','LINE_FORBIDDEN','LINE_RECIPIENT_INVALID','LINE_MONTHLY_LIMIT','LINE_RATE_LIMIT','LINE_UNAVAILABLE','LINE_TIMEOUT','LINE_NETWORK_ERROR','LINE_REQUEST_INVALID']);
function deliveryError(code){const error=new Error(code);error.code=code;return error;}
export async function sendPayslipLine(accessToken,to,messages,retryKey){
 if(!Array.isArray(messages)||!messages.length||messages.length>5||messages.some(m=>m?.type!=='flex'||typeof m.altText!=='string'||!m.altText.trim()||m.altText.length>400||!['bubble','carousel'].includes(m.contents?.type)))throw deliveryError('LINE_PAYLOAD_INVALID');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch('https://api.line.me/v2/bot/message/push',{method:'POST',signal:controller.signal,headers:{'content-type':'application/json',authorization:`Bearer ${accessToken}`,'X-Line-Retry-Key':retryKey},body:JSON.stringify({to,messages})});
  if(response.ok||(response.status===409&&Boolean(response.headers.get('x-line-accepted-request-id'))))return true;
  let body={};try{body=await response.json();}catch{}
  if(response.status===401)throw deliveryError('LINE_TOKEN_INVALID');
  if(response.status===403)throw deliveryError('LINE_FORBIDDEN');
  if(response.status===429)throw deliveryError(/monthly|quota/i.test(String(body.message||''))?'LINE_MONTHLY_LIMIT':'LINE_RATE_LIMIT');
  if(response.status>=500)throw deliveryError('LINE_UNAVAILABLE');
  if(response.status===400){
   const properties=(Array.isArray(body.details)?body.details:[]).map(x=>String(x.property||''));
   if(properties.some(x=>x.startsWith('messages'))||/messages?\[|message object/i.test(String(body.message||'')))throw deliveryError('LINE_PAYLOAD_INVALID');
   if(properties.includes('to')||/invalid.*\bto\b|\bto\b.*invalid|user.?id|recipient/i.test(String(body.message||'')))throw deliveryError('LINE_RECIPIENT_INVALID');
  }
  throw deliveryError('LINE_REQUEST_INVALID');
 }catch(error){if(PAYSLIP_ERRORS.has(error?.code))throw error;throw deliveryError(controller.signal.aborted||error?.name==='AbortError'?'LINE_TIMEOUT':'LINE_NETWORK_ERROR');}finally{clearTimeout(timer);}
}
