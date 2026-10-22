// Product workflow derived from existing payroll data. Never recalculates money.
export function payrollTaskModel(detail,userId=0){
 const period=detail?.period||{},items=detail?.items||[],errors=new Map(),warnings=new Map();
 const put=(map,id,text)=>{id=Number(id);if(!map.has(id))map.set(id,[]);if(!map.get(id).includes(text))map.get(id).push(text);};
 for(const x of detail?.exceptions||[])put(x.severity==='error'?errors:warnings,x.employee_id,x.title);
 for(const item of items){if(Number(item.base_salary||0)<=0)put(errors,item.employee_id,'ยังไม่ได้ตั้งฐานเงินเดือน');if(!String(item.bank_account_no||'').trim())put(warnings,item.employee_id,'ยังไม่มีบัญชีรับเงิน');}
 for(const item of items){
  if(Number(item.prior_net_pay||0)>0&&Math.abs(Number(item.net_pay||0)-Number(item.prior_net_pay))>.005)put(warnings,item.employee_id,'ยอดรับสุทธิเปลี่ยนจากรอบก่อน');
  // No comparison history is information, not a warning.
  if(item.payable_days_override!=null||item.prorated_salary_override!=null)put(warnings,item.employee_id,'มีการปรับวันหรือยอดเฉพาะรอบนี้');
 }
 for(const adjustment of detail?.adjustments||[])put(warnings,adjustment.employee_id,'มีรายการพิเศษในรอบนี้');
 for(const person of detail?.workflow_people?.not_calculated||[])put(errors,person.employee_id,person.reason);
 const issues=new Set([...errors.keys(),...warnings.keys()]),ready=items.filter(x=>!errors.has(Number(x.employee_id))&&Boolean(String(x.bank_account_no||'').trim())).length;
 const paid=Boolean(detail?.payment_confirmation),published=period.status==='published',separate=Boolean(Number(detail?.settings?.require_separate_approver||0));
 const maker=separate&&Number(period.created_by_user_id)>0&&Number(period.created_by_user_id)===Number(userId);
 const step=['locked','published'].includes(period.status)||period.status==='review'?3:items.length?2:1;
 return {step,errors,warnings,issueIds:issues,ready,included:items.length,eligible:Number(detail?.workflow_people?.eligible_count??items.length),paid,published,maker,blocking:errors.size,warningPeople:warnings.size};
}
export function salaryExplanation(item,settings={}){
 let bd;try{bd=typeof item.breakdown_json==='string'?JSON.parse(item.breakdown_json):item.breakdown_json||{};}catch{bd={};}
 const mode=bd.salary_mode||'full',days=Number(bd.payable_days??bd.active_calendar_days??0),divisor=Number(settings.daily_rate_divisor||30);
 if(mode==='manual_salary')return {label:'ปรับยอดเฉพาะรอบนี้',detail:'HR ปรับยอดเงินเดือนของรอบนี้เอง ไม่ได้เปลี่ยนฐานเงินเดือนประจำ',amount:Number(item.prorated_salary||0),manual:true};
 if(mode==='manual_days')return {label:'ปรับจำนวนวันเฉพาะรอบนี้',detail:`HR กำหนด ${days} วัน ระบบใช้ตัวหาร ${divisor} และคำนวณตามกติกาของรอบ`,amount:Number(item.prorated_salary||0),manual:true};
 if(mode==='prorated')return {label:'คิดตามช่วงที่ทำงาน',detail:`เริ่มงานหรือสิ้นสุดงานระหว่างรอบ · วันตามข้อมูล ${days} วัน · ตัวหาร ${divisor} ระบบใช้ยอดที่บันทึกไว้ในผลคำนวณ`,amount:Number(item.prorated_salary||0),manual:false};
 return {label:'เงินเดือนเต็มรอบ',detail:'ทำงานครอบคลุมช่วงรอบเงินเดือน ใช้ฐานเงินเดือนตามโปรไฟล์',amount:Number(item.prorated_salary||0),manual:false};
}
export function nextPayrollMonth(key){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(key||''))return null;const [y,m]=key.split('-').map(Number),d=new Date(Date.UTC(y,m,1));return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;}
