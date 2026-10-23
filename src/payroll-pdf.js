import {drawPayrollIssuer} from './payroll-issuer.js';
const clean=value=>String(value??'').replace(/[\r\n\t]+/g,' ').trim();
const num=value=>Number.isFinite(Number(value))?Number(value):0;
export function payrollSlipRows(item){
  let b={};try{b=typeof item.breakdown_json==='string'?JSON.parse(item.breakdown_json||'{}'):(item.breakdown_json||{});}catch{}
  const recurring=Array.isArray(b.recurring_components)?b.recurring_components:[];
  const earnings=[['เงินเดือนตามรอบ',num(item.prorated_salary)]],deductions=[];
  for(const c of recurring)if(c.type!=='deduction')earnings.push([clean(c.name)||'รายได้ประจำ',num(c.amount)]);
  for(const [label,value] of [['ค่าล่วงเวลา (OT)',item.overtime],['ค่าคอมมิชชัน',item.commission],['KPI',b.kpi],['เงินจูงใจ',item.incentive],['ค่าเบี้ยเลี้ยง',item.allowance],['โบนัส',item.bonus]])if(num(value))earnings.push([label,num(value)]);
  const recurringEarn=recurring.filter(c=>c.type!=='deduction').reduce((s,c)=>s+num(c.amount),0);
  const recurringDeduct=recurring.filter(c=>c.type==='deduction').reduce((s,c)=>s+num(c.amount),0);
  const otherEarn=Math.max(0,num(item.other_earnings)-recurringEarn),otherDeduct=Math.max(0,num(item.other_deductions)-recurringDeduct);
  if(otherEarn)earnings.push(['รายได้อื่น',otherEarn]);
  if(num(item.attendance_deduction))deductions.push(['หักขาดงาน / มาสาย',num(item.attendance_deduction)]);
  deductions.push(['ประกันสังคม',num(item.social_security)],['ภาษีหัก ณ ที่จ่าย (ประมาณการ)',num(item.withholding_tax)]);
  for(const c of recurring)if(c.type==='deduction')deductions.push([clean(c.name)||'รายการหักประจำ',num(c.amount)]);
  if(otherDeduct)deductions.push(['รายการหักอื่น',otherDeduct]);
  return {earnings,deductions};
}

export async function renderPayrollPdf({PDFDocument,fontkit,rgb,client={},companyBrand={},employee={},period={},item={},fontBytes,issuer=null,title='สลิปเงินเดือน'}){
  const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);const font=await pdf.embedFont(fontBytes,{subset:true});
  const W=595.28,H=841.89,L=36,R=W-36,CW=R-L,M=L+CW/2;
  const color={dark:rgb(.10,.24,.28),muted:rgb(.40,.47,.49),teal:rgb(.08,.48,.49),border:rgb(.82,.87,.87),soft:rgb(.95,.98,.98),white:rgb(1,1,1)};
  const amount=v=>num(v).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
  const date=v=>{const str=clean(v);if(!/^\d{4}-\d{2}-\d{2}$/.test(str))return '—';const d=new Date(str+'T00:00:00+07:00');return Number.isFinite(d.getTime())?d.toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'numeric'}):'—';};
  const segmenter=new Intl.Segmenter('th',{granularity:'grapheme'});
  const wrap=(value,width,size)=>{const out=[];let line='';for(const {segment} of segmenter.segment(clean(value))){if(line&&font.widthOfTextAtSize(line+segment,size)>width){out.push(line.trim());line='';}line+=segment;}if(line.trim())out.push(line.trim());return out.length?out:['—'];};
  let page,y,pageNo=0;
  const text=(value,x,baseline,size=9,c=color.dark)=>page.drawText(clean(value),{x,y:baseline,size,font,color:c});
  const right=(value,x,baseline,size=9,c=color.dark)=>text(value,x-font.widthOfTextAtSize(clean(value),size),baseline,size,c);
  const block=(value,x,top,width,size=9,lineHeight=13,c=color.dark)=>{const lines=wrap(value,width,size);lines.forEach((line,i)=>text(line,x,top-i*lineHeight,size,c));return lines.length*lineHeight;};
  const line=(x1,y1,x2,y2,c=color.border)=>page.drawLine({start:{x:x1,y:y1},end:{x:x2,y:y2},thickness:.6,color:c});
  const rect=(x,top,width,height,fill=color.white,border=true)=>page.drawRectangle({x,y:top-height,width,height,color:fill,...(border?{borderColor:color.border,borderWidth:.6}:{})});
  const empName=clean(`${employee.first_name||item.first_name||''} ${employee.last_name||item.last_name||''}`)||'—';
  const code=clean(employee.employee_code||item.employee_code)||'—';
  const periodKey=clean(period.period_key)||'—';
  const documentNo=`PAY-${periodKey}-${code}`;
  const footer=()=>{line(L,48,R,48);text('เอกสารส่วนบุคคล · กรุณาติดต่อ HR หากข้อมูลไม่ถูกต้อง',L,33,7,color.muted);right(`Nakna HR · ${pageNo}`,R,33,7,color.muted);};
  const nextPage=()=>{if(page)footer();page=pdf.addPage([W,H]);pageNo++;text(title,L,H-40,15);right(`${periodKey} · ${code}`,R,H-38,8.5,color.muted);line(L,H-54,R,H-54);block(empName,L,H-72,CW,8,11,color.muted);y=H-96;return page;};
  page=pdf.addPage([W,H]);pageNo=1;
  let logo=null;const raw=clean(companyBrand.logo_data_url);
  const logoMatch=raw.length<=3000000&&raw.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/i);
  if(logoMatch){try{const bytes=Uint8Array.from(atob(logoMatch[2]),c=>c.charCodeAt(0));logo=logoMatch[1].toLowerCase()==='png'?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);}catch{/* Optional logo never blocks a financial document. */}}
  let companyX=L;
  if(logo){const scale=Math.min(40/logo.width,40/logo.height);page.drawImage(logo,{x:L,y:H-78,width:logo.width*scale,height:logo.height*scale});companyX+=52;}
  const companyWidth=M-12-companyX;
  const companyName=companyBrand.legal_name||companyBrand.name||client.name||'—';
  const nameHeight=block(companyName,companyX,H-43,companyWidth,11.5,15);
  let companyY=H-43-nameHeight-2;
  if(companyBrand.tax_id){text(`เลขประจำตัวผู้เสียภาษี ${clean(companyBrand.tax_id)}`,companyX,companyY,7.5,color.muted);companyY-=13;}
  if(companyBrand.address)companyY-=block(companyBrand.address,companyX,companyY,companyWidth,7.5,11,color.muted);
  right(title,R,H-44,18,color.teal);right('PAYSLIP',R,H-62,8,color.muted);right(`งวด ${periodKey}`,R,H-82,10);
  const headerBottom=Math.min(H-104,companyY-10);line(L,headerBottom,R,headerBottom,color.teal);
  text(`เลขที่เอกสาร ${documentNo}`,L,headerBottom-19,8,color.muted);right('หน่วย: บาท',R,headerBottom-19,8,color.muted);
  const pairs=[['พนักงาน',empName,'รหัสพนักงาน',code],['แผนก',item.department_name||employee.department_name||'—','ตำแหน่ง',item.position_name||employee.position_name||'—'],['รอบคำนวณ',`${date(period.period_start)} – ${date(period.period_end)}`,'กำหนดจ่าย',date(period.pay_date)]];
  let bank=clean(item.bank_name||employee.bank_name),account=clean(item.bank_account_no||employee.bank_account_no).replace(/\s/g,'');
  if(bank||account)pairs.push(['รับผ่าน',bank||'—','บัญชีลงท้าย',account?`•••• ${account.slice(-4)}`:'—']);
  y=headerBottom-33;
  const metaTop=y;let metaHeight=0;
  const metaRows=pairs.map(pair=>{const left=wrap(pair[1],CW/2-80,9),rightLines=wrap(pair[3],CW/2-80,9);const h=Math.max(left.length,rightLines.length)*13+10;metaHeight+=h;return {pair,left,rightLines,h};});
  rect(L,metaTop,CW,metaHeight+10,color.soft,false);y-=17;
  for(const {pair,left,rightLines,h} of metaRows){text(pair[0],L+10,y,8,color.muted);left.forEach((t,i)=>text(t,L+76,y-i*13,9));text(pair[2],M+10,y,8,color.muted);rightLines.forEach((t,i)=>text(t,M+76,y-i*13,9));y-=h;}
  y=metaTop-metaHeight-30;
  const tableHeader=()=>{rect(L,y,CW,27,color.soft);text('รายได้',L+10,y-17,10,color.teal);right('จำนวนเงิน',M-10,y-17,8,color.muted);text('รายการหัก',M+10,y-17,10,color.teal);right('จำนวนเงิน',R-10,y-17,8,color.muted);line(M,y,M,y-27);y-=27;};
  const rows=payrollSlipRows(item);const rowCount=Math.max(4,rows.earnings.length,rows.deductions.length);
  tableHeader();
  for(let i=0;i<rowCount;i++){
    const a=rows.earnings[i],b=rows.deductions[i];const la=a?wrap(a[0],CW/2-100,8.5):[],lb=b?wrap(b[0],CW/2-100,8.5):[];const h=Math.max(1,la.length,lb.length)*12+13;
    if(y-h<82){nextPage();tableHeader();}
    rect(L,y,CW,h,i%2?color.soft:color.white);line(M,y,M,y-h);
    la.forEach((t,j)=>text(t,L+10,y-16-j*12,8.5));lb.forEach((t,j)=>text(t,M+10,y-16-j*12,8.5));
    if(a)right(amount(a[1]),M-10,y-16,9);if(b)right(amount(b[1]),R-10,y-16,9);y-=h;
  }
  // Keep the totals, annual summary and company issuer together when possible.
  if(y<390)nextPage();
  rect(L,y,CW,29,color.soft);line(M,y,M,y-29);text('รายได้รวม',L+10,y-19,9);right(amount(item.gross_income),M-10,y-19,10);text('รายการหักรวม',M+10,y-19,9);right(amount(item.total_deductions),R-10,y-19,10);y-=41;
  rect(L,y,CW,48,color.teal,false);text('เงินรับสุทธิ',L+14,y-29,12,color.white);right(`${amount(item.net_pay)} บาท`,R-14,y-31,21,color.white);y-=70;
  const year=/^\d{4}/.test(periodKey)?Number(periodKey.slice(0,4))+543:'—';text(`ยอดสะสมปี ${year} · ถึงรอบนี้`,L,y,9,color.teal);y-=12;
  const annual=[['รายได้สะสม',item.ytd_gross],['ภาษีหัก ณ ที่จ่ายสะสม',item.ytd_tax],['ประกันสังคมสะสม',item.ytd_sso]];
  const cellW=CW/3;
  annual.forEach(([label,value],i)=>{const x=L+i*cellW;rect(x,y,cellW,43);text(label,x+10,y-14,7.5,color.muted);text(value==null?'—':amount(value),x+10,y-32,11);});y-=63;
  await drawPayrollIssuer({pdf,page,font,issuer,top:y,colors:color,newPage:nextPage});
  footer();return new Uint8Array(await pdf.save());
}
