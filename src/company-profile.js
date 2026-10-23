// Company identity is edited here; legacy readers use synchronized onboarding
// and document settings rows. Existing issued documents remain immutable.
const roles=new Set(['owner','co_owner','hr_admin','hr']);
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const fields={legal_name:240,tax_id:13,address:2000,phone:80,province:120};
export async function companyIdentity(db,cid){
 const row=await db.prepare(`SELECT COALESCE(NULLIF(s.legal_name,''),o.legal_name,c.name) AS legal_name,COALESCE(NULLIF(s.tax_id,''),o.tax_id,'') AS tax_id,COALESCE(NULLIF(s.address,''),o.address,'') AS address,COALESCE(NULLIF(s.phone,''),o.phone,'') AS phone,COALESCE(o.province,'') AS province FROM clients c LEFT JOIN company_onboarding o ON o.client_id=c.id LEFT JOIN company_document_settings s ON s.client_id=c.id WHERE c.id=?1`).bind(cid).first();
 return row||{};
}
function validTaxId(id){if(!/^\d{13}$/.test(id)||/^0+$/.test(id))return false;let sum=0;for(let i=0;i<12;i++)sum+=Number(id[i])*(13-i);return (11-sum%11)%10===Number(id[12]);}
export async function companyProfileApi(request,db,auth,h){
 const cid=Number(auth.clientId),method=request.method;
 if(method!=='GET'&&method!=='PATCH')return reply({error:'Method not allowed'},405);
 if(method==='PATCH'&&!roles.has(String(auth.role||'')))return reply({error:'ไม่มีสิทธิ์แก้ข้อมูลบริษัท'},403);
 let body={};if(method==='PATCH'){try{body=await request.json();if(!body||typeof body!=='object'||Array.isArray(body))throw Error();}catch{return reply({error:'ข้อมูลไม่ถูกต้อง'},400);}
 if(body.expected_company_id!=null&&Number(body.expected_company_id)!==cid)return reply({error:'บริษัทเปลี่ยนแล้ว กรุณาโหลดข้อมูลใหม่'},409);}
 await h.ensure(db);
 const client=await h.getClient(db,cid);if(!client)return reply({error:'ไม่พบบริษัท'},404);
 const previous=await companyIdentity(db,cid);
 if(method==='PATCH'){
  const name=String(body.name??client.name??'').trim(),timezone=String(body.timezone??client.timezone??'Asia/Bangkok').trim()||'Asia/Bangkok';
  if(name.length<2||name.length>240)return reply({error:'ชื่อบริษัทต้องมี 2–240 ตัวอักษร'},400);
  try{new Intl.DateTimeFormat('en',{timeZone:timezone});}catch{return reply({error:'Timezone ไม่ถูกต้อง'},400);}
  const workStart=h.normalizeTime(body.work_start??client.work_start)||'09:00',workEnd=h.normalizeTime(body.work_end??client.work_end)||'18:00';
  const lateGrace=Math.max(0,Math.min(180,Number(body.late_grace_minutes??client.late_grace_minutes??10)||0));
  const identity={...previous};
  for(const [key,max] of Object.entries(fields))if(Object.hasOwn(body,key)){
   if(typeof body[key]!=='string')return reply({error:'ข้อมูลบริษัทต้องเป็นข้อความ'},400);
   const value=body[key].trim();if([...value].length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)||key!=='address'&&/[\r\n]/.test(value))return reply({error:'ข้อมูลบริษัทมีความยาวหรืออักขระไม่ถูกต้อง'},400);
   if(key==='legal_name'&&value.length<2)return reply({error:'กรุณาระบุชื่อบริษัทตามทะเบียน'},400);
   if(key==='tax_id'&&value&&!validTaxId(value))return reply({error:'เลขประจำตัวผู้เสียภาษีต้องเป็น 13 หลักที่ถูกต้อง'},400);
   identity[key]=value;
  }
  if(!identity.legal_name)identity.legal_name=name;
  const {legal_name,tax_id,address,phone,province}=identity;
  // D1 batch is atomic. Preserve owner, setup progress, signer, signature and footer.
  await db.batch([
   db.prepare('UPDATE clients SET name=?1,timezone=?2,work_start=?3,work_end=?4,late_grace_minutes=?5 WHERE id=?6').bind(name,timezone,workStart,workEnd,lateGrace,cid),
   db.prepare(`INSERT INTO company_onboarding(client_id,current_step,completed_at,legal_name,tax_id,address,phone,province) VALUES(?1,'complete',CURRENT_TIMESTAMP,?2,?3,?4,?5,?6) ON CONFLICT(client_id) DO UPDATE SET legal_name=excluded.legal_name,tax_id=excluded.tax_id,address=excluded.address,phone=excluded.phone,province=excluded.province,updated_at=CURRENT_TIMESTAMP`).bind(cid,legal_name,tax_id||'',address||'',phone||'',province||''),
   db.prepare(`INSERT INTO company_document_settings(client_id,legal_name,tax_id,address,phone) VALUES(?1,?2,?3,?4,?5) ON CONFLICT(client_id) DO UPDATE SET legal_name=excluded.legal_name,tax_id=excluded.tax_id,address=excluded.address,phone=excluded.phone,updated_at=CURRENT_TIMESTAMP`).bind(cid,legal_name,tax_id||'',address||'',phone||'')
  ]);
  await h.audit(db,cid,'user',String(auth.user.id),'company.profile.update','client',String(cid),{name,timezone,work_start:workStart,work_end:workEnd,late_grace_minutes:lateGrace,changed_identity_fields:Object.keys(fields).filter(k=>Object.hasOwn(body,k))});
 }
 const updated=method==='PATCH'?await h.getClient(db,cid):client;
 const [identity,asset]=await Promise.all([companyIdentity(db,cid),db.prepare('SELECT logo_data_url FROM company_assets WHERE client_id=?1').bind(cid).first()]);
 return reply({...(method==='PATCH'?{ok:true}:{}),company:{...h.publicProfile(updated),...identity,logo_data_url:asset?.logo_data_url||''}});
}
