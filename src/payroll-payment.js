// Manual payment confirmation only. No bank transfer and no payslip sending here.
export const PAYMENT_SCHEMA=[
`CREATE TABLE IF NOT EXISTS payroll_payment_confirmations(id INTEGER PRIMARY KEY AUTOINCREMENT,client_id INTEGER NOT NULL,period_id INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'confirmed',payment_date TEXT NOT NULL,reference TEXT NOT NULL,net_total REAL NOT NULL,item_count INTEGER NOT NULL,confirmed_by_user_id INTEGER NOT NULL,confirmed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,voided_by_user_id INTEGER,voided_at TEXT,void_reason TEXT)`,
`CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_payment_active ON payroll_payment_confirmations(client_id,period_id) WHERE status='confirmed'`
];
const ready=new WeakMap();
export async function ensurePayrollPayment(db){if(ready.has(db))return ready.get(db);const task=(async()=>{for(const sql of PAYMENT_SCHEMA)await db.prepare(sql).run();})();ready.set(db,task);try{await task;}catch(e){ready.delete(db);throw e;}}
export async function payrollPayment(db,cid,pid){await ensurePayrollPayment(db);return db.prepare("SELECT * FROM payroll_payment_confirmations WHERE client_id=?1 AND period_id=?2 AND status='confirmed'").bind(cid,pid).first();}
export async function payrollPeople(db,cid,period,items){
 const rows=(await db.prepare("SELECT e.id,e.first_name,e.last_name,e.nickname,e.start_date,e.end_date FROM employees e WHERE e.client_id=?1 AND e.start_date<=?2 AND (e.end_date IS NULL OR e.end_date>=?3) AND COALESCE(e.people_status,'employee') NOT IN ('candidate') ORDER BY e.id").bind(cid,period.period_end,period.period_start).all()).results||[];
 const included=new Set(items.map(i=>Number(i.employee_id)));
 return {eligible_count:rows.length,included_count:items.length,not_calculated:rows.filter(e=>!included.has(Number(e.id))).map(e=>({employee_id:e.id,name:e.nickname||[e.first_name,e.last_name].filter(Boolean).join(' '),reason:'ยังไม่มีผลคำนวณในรอบนี้ กรุณาตรวจโปรไฟล์และคำนวณใหม่'}))};
}
function validDate(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return false;const d=new Date(date+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===date;}
export async function payrollPaymentApi(request,env,auth,pid,h){
 const cid=Number(auth.clientId||0),db=env.DB;
 if(!cid)return Response.json({error:'COMPANY_REQUIRED'},{status:409});
 if(!h.canManagePayroll(auth.role))return Response.json({error:'ไม่มีสิทธิ์จัดการเงินเดือน'},{status:403});
 if(h.ensurePayrollDefaults)await h.ensurePayrollDefaults(db,cid);
 await ensurePayrollPayment(db);
 const period=await db.prepare('SELECT * FROM payroll_periods WHERE client_id=?1 AND id=?2').bind(cid,pid).first();if(!period)return Response.json({error:'ไม่พบรอบเงินเดือน'},{status:404});
 if(request.method==='GET')return Response.json({ok:true,payment:await payrollPayment(db,cid,pid)});
 if(!['POST','DELETE'].includes(request.method))return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405});
 let input;try{input=await request.json();}catch{return Response.json({error:'ข้อมูลไม่ถูกต้อง'},{status:400});}
 if(request.method==='DELETE'){
  if(!['owner','co_owner','hr_admin'].includes(auth.role))return Response.json({error:'เฉพาะเจ้าของหรือผู้ดูแล HR ที่แก้บันทึกการจ่ายได้'},{status:403});
  const reason=String(input.reason||'').trim();if(reason.length<5||reason.length>500)return Response.json({error:'กรุณาระบุเหตุผล 5–500 ตัวอักษร'},{status:400});
  const payment=await payrollPayment(db,cid,pid);if(!payment)return Response.json({error:'ไม่มีบันทึกการจ่ายที่ใช้งานอยู่'},{status:409});
  const result=await db.prepare("UPDATE payroll_payment_confirmations SET status='void',voided_by_user_id=?1,voided_at=CURRENT_TIMESTAMP,void_reason=?2 WHERE id=?3 AND client_id=?4 AND status='confirmed'").bind(auth.user.id,reason,payment.id,cid).run();
  if(result.meta?.changes!==1)return Response.json({error:'ข้อมูลเปลี่ยนแล้ว กรุณาโหลดใหม่'},{status:409});
  await h.recordPayrollPeriodEvent(db,cid,pid,auth.user.id,'payment_confirmation_voided',{confirmation_id:payment.id,reason});return Response.json({ok:true});
 }
 if(!['locked','published'].includes(period.status))return Response.json({error:'ต้องตรวจยอด อนุมัติ และปิดการแก้ไขก่อนบันทึกการจ่าย'},{status:409});
 if(input.confirmed!==true)return Response.json({error:'ยืนยันว่าโอนเงินจริงครบแล้วก่อนบันทึก'},{status:400});
 const date=String(input.payment_date||''),reference=String(input.reference||'').trim();
 if(!validDate(date)||date>h.today())return Response.json({error:'วันที่จ่ายต้องเป็นวันที่จริงและไม่เกินวันนี้'},{status:400});
 if(reference.length<3||reference.length>200)return Response.json({error:'ระบุเลขอ้างอิงหรือหมายเหตุการโอน 3–200 ตัวอักษร'},{status:400});
 const detail=await h.getPayrollPeriodDetail(db,cid,pid),items=detail.items||[];
 if(!items.length||(detail.exceptions||[]).some(x=>x.severity==='error'))return Response.json({error:'รอบนี้ยังมีข้อมูลที่ต้องแก้'},{status:409});
 const existing=await payrollPayment(db,cid,pid);if(existing)return Response.json({ok:true,payment:existing,already_confirmed:true});
 if(typeof input.expected_updated_at!=='string'||input.expected_updated_at!==period.updated_at||typeof input.expected_net_total!=='number'||Math.abs(input.expected_net_total-Number(period.net_total))>.005||input.expected_item_count!==items.length)return Response.json({error:'ยอดหรือรอบเงินเดือนเปลี่ยนแล้ว กรุณาโหลดข้อมูลและตรวจใหม่'},{status:409});
 const result=await db.prepare(`INSERT OR IGNORE INTO payroll_payment_confirmations(client_id,period_id,payment_date,reference,net_total,item_count,confirmed_by_user_id)
 SELECT client_id,id,?3,?4,net_total,?5,?6 FROM payroll_periods WHERE client_id=?1 AND id=?2 AND status IN ('locked','published') AND updated_at=?7 AND abs(net_total-?8)<0.005`).bind(cid,pid,date,reference,items.length,auth.user.id,period.updated_at,input.expected_net_total).run();
 if(result.meta?.changes!==1)return Response.json({error:'ข้อมูลเปลี่ยนหรือมีผู้ยืนยันแล้ว กรุณาโหลดใหม่'},{status:409});
 const payment=await payrollPayment(db,cid,pid);
 await h.recordPayrollPeriodEvent(db,cid,pid,auth.user.id,'payment_confirmed',{confirmation_id:payment.id,payment_date:date,reference,net_total:payment.net_total,item_count:items.length,source:'manual_confirmation'});
 return Response.json({ok:true,payment});
}
