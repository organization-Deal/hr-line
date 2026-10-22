// One schedule population, three mutually exclusive states. No payroll data.
export function dashboardAttendance({employees=[],attendance=[],leaveIds=new Set(),expected=()=>true,today}){
 const byId=new Map();
 for(const row of attendance){const id=Number(row.employee_id),old=byId.get(id);const checked=r=>Boolean(r?.check_in_at||['present','late'].includes(r?.status));if(!old||(!checked(old)&&checked(row))||(checked(old)===checked(row)&&String(row.check_in_at||'')>String(old.check_in_at||'')))byId.set(id,row);}
 const isChecked=e=>Boolean(byId.get(Number(e.id))?.check_in_at||['present','late'].includes(byId.get(Number(e.id))?.status));
 const isLate=e=>isChecked(e)&&(byId.get(Number(e.id))?.status==='late'||Number(byId.get(Number(e.id))?.late_minutes||0)>0);
 const people=employees.filter(e=>(!e.start_date||String(e.start_date).slice(0,10)<=today)&&(!e.end_date||String(e.end_date).slice(0,10)>=today));
 const scheduled=people.filter(expected),checked=scheduled.filter(isChecked),leave=scheduled.filter(e=>!isChecked(e)&&leaveIds.has(Number(e.id))),missing=scheduled.filter(e=>!isChecked(e)&&!leaveIds.has(Number(e.id)));
 const outside=people.filter(e=>!expected(e)&&isChecked(e)),late=checked.filter(isLate),leaveAll=people.filter(e=>leaveIds.has(Number(e.id))),overlap=leaveAll.filter(isChecked);
 const groups={scheduled,checked,leave,missing,late,outside,all:people,leave_all:leaveAll,overlap};
 const name=e=>`${e.nickname||e.first_name||'พนักงาน'} ${e.last_name||''}`.trim();
 return {summary:{employees:people.length,scheduled_today:scheduled.length,scheduled_present:checked.length,scheduled_leave:leave.length,scheduled_late:late.length,present:people.filter(isChecked).length,late:people.filter(isLate).length,leave:leaveAll.length,missing:missing.length,outside_schedule_present:outside.length,leave_checked_in:overlap.length,attendance_definition_version:2},groups:Object.fromEntries(Object.entries(groups).map(([key,rows])=>[key,rows.map(e=>({id:Number(e.id),name:name(e),department:e.department_name||null,position:e.position_name||null}))]))};
}
