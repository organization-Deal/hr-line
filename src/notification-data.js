// Read aggregate facts only. Every query is scoped to the selected company.
const plusDays=(date,n)=>new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export async function notificationFeatureData(db,cid,kind,date){
 const horizon=n=>plusDays(date,n);
 let sql,args,key,label;
 switch(kind){
 case 'documents_expiring':key='เอกสารใกล้หมดอายุ';label='เอกสารหมดอายุภายใน 30 วัน';sql="SELECT COUNT(*) n FROM employee_documents WHERE client_id=?1 AND COALESCE(status,'active')='active' AND date(expires_at)>=?2 AND date(expires_at)<=?3";args=[cid,date,horizon(30)];break;
 case 'contracts_expiring':key='สัญญาใกล้สิ้นสุด';label='สัญญาจ้างสิ้นสุดภายใน 30 วัน';sql="SELECT COUNT(*) n FROM employees WHERE client_id=?1 AND status='active' AND date(contract_end_date)>=?2 AND date(contract_end_date)<=?3";args=[cid,date,horizon(30)];break;
 case 'probation_due':key='รอประเมินทดลองงาน';label='ครบกำหนดทดลองงาน / ภายใน 7 วัน';sql="SELECT COUNT(*) n FROM employees WHERE client_id=?1 AND status='active' AND people_status='probation' AND NULLIF(trim(confirmed_at),'') IS NULL AND date(probation_end_date)<=?2";args=[cid,horizon(7)];break;
 case 'learning_due':key='งานเรียนค้าง';label='งานเรียนภาคบังคับใกล้ครบกำหนด / เกินกำหนด';sql="SELECT COUNT(*) n FROM learning_assignments a JOIN learning_courses c ON c.id=a.course_id AND c.client_id=a.client_id AND c.status='published' JOIN employees e ON e.id=a.employee_id AND e.client_id=a.client_id WHERE a.client_id=?1 AND e.status='active' AND a.required=1 AND a.status IN ('assigned','in_progress','failed') AND date(a.due_date)<=?2";args=[cid,horizon(3)];break;
 case 'kpi_stale':key='KPIรออัปเดต';label='KPI ถึงรอบอัปเดต';sql=`SELECT COUNT(*) n FROM kpi_goals g JOIN employees e ON e.id=g.employee_id AND e.client_id=g.client_id WHERE g.client_id=?1 AND g.status='active' AND e.status='active' AND g.update_frequency IN ('daily','weekly','monthly') AND COALESCE((SELECT MAX(date(u.update_date)) FROM kpi_updates u WHERE u.client_id=g.client_id AND u.goal_id=g.id),date(g.created_at))<=date(?2,CASE g.update_frequency WHEN 'daily' THEN '-1 day' WHEN 'weekly' THEN '-7 days' ELSE '-1 month' END)`;args=[cid,date];break;
 case 'recruitment_pending':key='ผู้สมัครรอติดต่อ';label='ผู้สมัครใหม่ / รอคัดกรอง';sql="SELECT COUNT(*) n FROM candidates WHERE client_id=?1 AND stage IN ('new','screening')";args=[cid];break;
 case 'payroll_due':key='รอบเงินเดือนรอดำเนินการ';label='รอบเงินเดือนใกล้วันจ่าย / เกินกำหนด';sql="SELECT COUNT(*) n FROM payroll_periods WHERE client_id=?1 AND status IN ('draft','review','locked') AND date(pay_date)<=?2";args=[cid,horizon(3)];break;
 case 'birthdays':key='พนักงานวันเกิด';label='พนักงานวันเกิดวันนี้';sql="SELECT COUNT(*) n FROM employees WHERE client_id=?1 AND status='active' AND strftime('%m-%d',birth_date)=strftime('%m-%d',?2)";args=[cid,date];break;
 default:throw new Error('UNKNOWN_NOTIFICATION_SOURCE');
 }
 // Missing tables/columns are surfaced as source errors; never silently report zero.
 const row=await db.prepare(sql).bind(...args).first(),count=Number(row?.n||0);
 return {values:{[key]:count},lines:[[label,count]],count,source_date:date};
}
