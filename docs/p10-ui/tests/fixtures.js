(() => {
  const q=window.__NKQA, s=q.state;
  const emp=Array.from({length:8},(_,i)=>({id:i+1,first_name:['นรินทร์','กัญญา','ณัฐ','มินตรา','อาทิตย์','ธารา','พลอย','จิรา'][i],last_name:'ทีมตัวอย่าง',nickname:['นิน','ออย','นัท','มิน','อาร์ท','น้ำ','พลอย','จูน'][i],employee_code:'DEMO-'+String(i+1).padStart(3,'0'),department_id:i%3+1,department_name:['Operations','Accounting','Visionhub'][i%3],position_id:1,position_name:i%3?'ทีมงาน':'หัวหน้าทีม',status:'active',people_status:i===7?'probation':'employee',line_user_id:'DEMO-U'+i,line_display_name:'Demo '+i,base_salary:20000+i*1000,bank_name:'ธนาคารตัวอย่าง',bank_account_name:'บัญชีตัวอย่าง ห้ามโอนเงินจริง',bank_account_no:'000000000'+i,phone:'0000000000',email:'demo'+i+'@example.invalid',start_date:'2026-08-01',document_count:2,leave_access_override:1,contract_type:'permanent'}));
  const leaves=Array.from({length:8},(_,i)=>({...emp[i%8],id:100+i,employee_id:i%8+1,leave_type:'sick',leave_type_name:i%3===1?'ลากิจ':'ลาป่วย',start_date:'2026-10-12',end_date:'2026-10-12',duration_days:i%2?.5:1,period_days:i%2?.5:1,status:['pending','awaiting_evidence','approved','approved','approved','rejected','approved','cancelled'][i],created_at:'2026-10-11T08:30:00Z',reason:'ธุระส่วนตัว (ข้อมูลจำลอง)',approved_at:i>1?'2026-10-11T10:30:00Z':null,decision_at:i>1?'2026-10-11T10:30:00Z':null,decided_by_user_name:i>1?'ผู้ดูแลตัวอย่าง':null,evidence_count:i%2,approver_nickname:'ผู้ดูแล',approver_employee_id:i<2?1:null}));
  const people=emp.map((e,i)=>({...e,employee_id:e.id,approved_requests:i<6?i+1:0,approved_days:i<6?i+0.5:0,pending_requests:i===0?1:0,awaiting_evidence_requests:i===1?1:0,rejected_requests:i===5?1:0,types:i<6?[{name:'ลาป่วย',requests:i+1,days:i+.5}]:[]}));
  const report={ok:true,people,summary:{people_with_approved:6,approved_requests:21,approved_days:18,pending_requests:1,awaiting_evidence_requests:1,rejected_requests:1},by_type:[{name:'ลาป่วย',days:11,requests:13},{name:'ลากิจ',days:4,requests:5},{name:'ลาพักร้อน',days:3,requests:3}],details:leaves,total_requests:8,employee_options:emp,department_options:[{id:1,name:'Operations'},{id:2,name:'Accounting'},{id:3,name:'Visionhub'}],type_options:['ลาป่วย','ลากิจ','ลาพักร้อน']};
  const period={id:1,period_key:'2026-10',period_start:'2026-10-01',period_end:'2026-10-31',pay_date:'2026-10-31',status:'draft',employee_count:8,gross_total:188000,deduction_total:5000,net_total:183000,employer_cost:193000};
  Object.assign(s,{
    me:{id:1,user:{id:1,name:'ผู้ดูแลตัวอย่าง',email:'owner@example.invalid'},name:'ผู้ดูแลตัวอย่าง',email:'owner@example.invalid',active_company_id:1,companies:[{id:1,name:'บริษัท ตัวอย่าง จำกัด',role:'owner'}],is_saas_admin:false},
    employees:emp,leaves,leaveUnifiedReport:report,leaveUnifiedClientId:1,
    dashboard:{today:'2026-10-13',client:{id:1,name:'บริษัท ตัวอย่าง จำกัด'},summary:{employees:8,present:6,leave:1,missing:1,late:1,scheduled:8,scheduled_today:8},attention:[{key:'leave_pending',count:2},{key:'probation',count:1},{key:'request',count:2}],recruitment:{new:3,screening:1,hr_interview:2,manager_interview:0,offer:1,hired:2},birthdays:[],probation:[],contracts:[],documents:{pending_hr_sign:2,pending_employee_sign:1,final_total:12},payroll:period},
    candidates:[{id:1,first_name:'ผู้สมัคร',last_name:'ตัวอย่าง',position_applied:'Content Creator',stage:'new',email:'candidate@example.invalid',phone:'0000000000',source:'direct',created_at:'2026-10-12'}],
    lookups:{departments:report.department_options,positions:[{id:1,name:'ทีมงาน'}],locations:[]},
    peopleCore:{departments:report.department_options,positions:[{id:1,name:'ทีมงาน'}],schedules:[],holidays:[{id:1,holiday_date:'2026-10-13',name:'วันหยุดบริษัท'}],attendance_policy:{},attendance_reminder:{},attendance_face:{}},
    invites:[{id:1,title:'ทีมงานใหม่',status:'active',expires_at:'2027-01-01T00:00:00Z',used_count:2,max_uses:5,token:'demo-not-real-token'}],
    payroll:{periods:[period],readiness:{employees:8,salary_ready:8,bank_ready:8},settings:{},profiles:emp},activePayrollPeriodId:1,
    payrollDetail:{period,items:emp.map(e=>({...e,employee_id:e.id,prorated_salary:e.base_salary,gross_income:e.base_salary,net_pay:e.base_salary-600,social_security:600,withholding_tax:0,employer_social_security:600,breakdown_json:JSON.stringify({payable_days:30,auto_payable_days:30,daily_divisor:30})})),adjustments:[],settings:{},timeline:[]},
    companyProfile:{id:1,name:'บริษัท ตัวอย่าง จำกัด',work_start:'09:00',work_end:'18:00'},
    googleWorkspace:{connected:false},lineIntegration:{connected:true},subscription:{plan:{name:'Demo',code:'demo'},status:'active',usage:{active_employee_seats:8}},
    recruitmentGmail:{connected:false,settings:{},summary:{}},
    teamWorkLog:{employees:emp,rows:emp.map(e=>({...e,days:[]})),days:[],dates:['2026-10-13'],start_date:'2026-10-13',end_date:'2026-10-13',summary:{}},
    attendanceRetroRequests:[],
    benefits:{data:[{id:1,name:'ตรวจสุขภาพประจำปี',benefit_type:'health',description:'ข้อมูลตัวอย่าง',status:'active'}],enrollments:[]},
  });
  window.__NKFixture={emp,leaves,report,period,payroll:s.payroll,payrollDetail:s.payrollDetail};
  const renders=['renderIdentity','renderAll','renderLeaveUnified','renderHrInbox','renderBroadcastPage','renderWellness'];
  window.__NKRenderErrors=[];
  renders.forEach(name=>{try{q[name]()}catch(e){window.__NKRenderErrors.push(name+': '+e.stack)}});
  document.querySelector('#appShell').classList.remove('hidden');
  document.querySelector('#bootSplash').classList.add('hidden');
  document.querySelector('#login').classList.add('hidden');
  document.querySelector('#onboarding').classList.add('hidden');
  window.NaknaUI.refresh();
})();
