import {ensurePayrollPayment} from './payroll-payment.js';
import {ensurePayslipDelivery} from './payroll-delivery.js';
const reply=(data,status=200)=>Response.json(data,{status});
export async function cancelPayrollApi(request,env,auth,pid,h){
 const cid=Number(auth.clientId||0),db=env.DB;
 if(!['owner','co_owner'].includes(auth.role))return reply({error:'เฉพาะเจ้าของหรือเจ้าของร่วมที่ยกเลิกรอบเงินเดือนได้'},403);
 if(!cid)return reply({error:'COMPANY_REQUIRED'},409);
 if(request.method!=='POST')return reply({error:'METHOD_NOT_ALLOWED'},405);
 let input;try{input=await request.json();}catch{return reply({error:'ข้อมูลไม่ถูกต้อง'},400);}
 const reason=String(input.reason||'').trim();
 if(reason.length<5||reason.length>500||input.confirmed!==true)return reply({error:'ระบุเหตุผล 5–500 ตัวอักษรและยืนยันผลของการยกเลิก'},400);
 await h.ensure(db,cid);await ensurePayrollPayment(db);await ensurePayslipDelivery(db);
 const p=await db.prepare('SELECT * FROM payroll_periods WHERE client_id=?1 AND id=?2').bind(cid,pid).first();
 if(!p)return reply({error:'ไม่พบรอบเงินเดือน'},404);
 if(p.status==='void')return reply({ok:true,already_cancelled:true});
 if(input.period_key!==p.period_key||input.expected_updated_at!==p.updated_at||input.expected_net_total!==Number(p.net_total))return reply({error:'ข้อมูลรอบเปลี่ยนแล้ว กรุณาเปิดใหม่และตรวจสอบก่อนยกเลิก'},409);
 const stamp=new Date().toISOString()+'#'+crypto.randomUUID(),archiveKey=`${p.period_key} (ยกเลิก #${pid})`,note=`\nยกเลิกรอบ ${p.period_key}: ${reason}`;
 const event=JSON.stringify({reason,original_period_key:p.period_key,previous_status:p.status,net_total:p.net_total,notice:'ยกเลิกข้อมูลในระบบ ไม่คืนเงินหรือเรียกคืนเอกสารที่ส่งออกไปแล้ว'});
 const guard="EXISTS(SELECT 1 FROM payroll_periods WHERE client_id=?1 AND id=?2 AND status='void' AND updated_at=?3)";
 const result=await db.batch([
 db.prepare(`UPDATE payroll_periods SET status='void',period_key=?4,payroll_note=COALESCE(payroll_note,'')||?5,updated_at=?3 WHERE client_id=?1 AND id=?2 AND status IN ('draft','review','locked','published') AND updated_at=?6 AND net_total=?7 AND NOT EXISTS(SELECT 1 FROM payroll_payslip_deliveries WHERE client_id=?1 AND period_id=?2 AND status='sending' AND lease_until>?8)`).bind(cid,pid,stamp,archiveKey,note,p.updated_at,Number(p.net_total),Date.now()),
 db.prepare(`UPDATE payroll_payment_confirmations SET status='void',voided_by_user_id=?4,voided_at=CURRENT_TIMESTAMP,void_reason=?5 WHERE client_id=?1 AND period_id=?2 AND status='confirmed' AND ${guard}`).bind(cid,pid,stamp,Number(auth.user.id),reason),
 db.prepare(`UPDATE payroll_items SET status='void',updated_at=CURRENT_TIMESTAMP WHERE client_id=?1 AND period_id=?2 AND ${guard}`).bind(cid,pid,stamp),
 db.prepare(`INSERT INTO payroll_period_events(client_id,period_id,actor_user_id,event_type,detail_json) SELECT ?1,?2,?4,'period_cancelled',?5 WHERE ${guard}`).bind(cid,pid,stamp,Number(auth.user.id),event)
 ]);
 if(Number(result[0].meta?.changes)!==1)return reply({error:'รอบเปลี่ยนหรือกำลังส่งสลิปอยู่ กรุณารอให้ส่งเสร็จแล้วโหลดใหม่'},409);
 return reply({ok:true,cancelled:true,original_period_key:p.period_key});
}
