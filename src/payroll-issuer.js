// Company issuer only. This is not an employee receipt or a payroll approval.
// The returned values are embedded in the PDF; existing PDFs are never re-signed.
export function payrollIssuer(settings={},issuedAt=new Date()){
  const name=String(settings?.signer_name||'').trim().slice(0,180);
  const position=String(settings?.signer_position||'').trim().slice(0,180);
  const signature=String(settings?.signer_signature_data_url||'').trim();
  if(!signature&&!name)return null;
  if(signature&&!name)throw new Error('กรุณาระบุชื่อ HR ผู้ออกเอกสารในตั้งค่าลายเซ็นก่อนสร้างสลิป');
  let image=null;
  if(signature){
    const match=signature.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/i);
    if(!match||signature.length>750000)throw new Error('ลายเซ็น HR ไม่ถูกต้อง กรุณาอัปโหลด PNG หรือ JPG ใหม่ในตั้งค่าลายเซ็น');
    try{image={type:match[1].toLowerCase(),bytes:Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0))};}
    catch{throw new Error('อ่านลายเซ็น HR ไม่ได้ กรุณาอัปโหลดลายเซ็นใหม่');}
  }
  const date=new Date(issuedAt);
  if(!Number.isFinite(date.getTime()))throw new Error('วันที่ออกสลิปไม่ถูกต้อง');
  return Object.freeze({name,position,image,issuedAt:date.toISOString(),dateLabel:date.toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'numeric'})});
}

export async function drawPayrollIssuer({pdf,page,font,issuer,top,colors,newPage}){
  if(!issuer)return {page,top};
  // Decode before drawing. A broken saved image must not silently become an
  // unsigned document that can subsequently be delivered as if signing worked.
  let image=null;
  if(issuer.image){
    try{image=issuer.image.type==='png'?await pdf.embedPng(issuer.image.bytes):await pdf.embedJpg(issuer.image.bytes);}
    catch{throw new Error('เปิดรูปลายเซ็น HR ไม่ได้ กรุณาอัปโหลด PNG หรือ JPG ใหม่ในตั้งค่าลายเซ็น');}
  }
  const x=340,width=208,center=x+width/2;
  const lines=(value,size)=>{
    const clean=String(value||'').replace(/[\r\n\t]/g,' ');
    const segments=[...new Intl.Segmenter('th',{granularity:'grapheme'}).segment(clean)].map(x=>x.segment);
    const result=[];let line='';
    for(const part of segments){if(line&&font.widthOfTextAtSize(line+part,size)>width){result.push(line.trim());line='';}line+=part;}
    if(line.trim())result.push(line.trim());return result;
  };
  const nameLines=lines(issuer.name,10),positionLines=lines(issuer.position,8.5);
  const height=116+Math.max(0,nameLines.length-1)*14+positionLines.length*14;
  if(top-height<80){page=newPage();top=page.getHeight()-170;}
  const text=(value,y,size=9,color=colors.dark)=>page.drawText(value,{x:center-font.widthOfTextAtSize(value,size)/2,y,size,font,color});
  text('ผู้ออกเอกสาร',top,9,colors.muted);
  if(image){const scale=Math.min(150/image.width,48/image.height,1);const w=image.width*scale,h=image.height*scale;page.drawImage(image,{x:center-w/2,y:top-58+(48-h)/2,width:w,height:h});}
  page.drawLine({start:{x:x+12,y:top-66},end:{x:x+width-12,y:top-66},thickness:.6,color:colors.border});
  let baseline=top-82;
  for(const line of nameLines){text(line,baseline,10);baseline-=14;}
  if(positionLines.length)baseline-=2;
  for(const line of positionLines){text(line,baseline,8.5,colors.muted);baseline-=14;}
  text(`ออกเอกสาร ${issuer.dateLabel}`,baseline-5,8,colors.muted);
  return {page,top:baseline-20};
}
