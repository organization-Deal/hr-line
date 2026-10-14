/** Nakna P10.4: editable employee-file metadata; no changes to file bytes/signatures.
 * Existing DELETE remains a soft archive. All mutations are company-scoped and
 * write the document, history and audit log atomically using the D1 binding.
 */
const TYPES = new Set(['employment_contract','job_description','nda','id_card_copy','house_registration','bank_book_copy','social_security','tax_document','education_certificate','salary_certificate','employment_certificate','probation','salary_adjustment','performance','warning','resignation','asset_return','final_pay','other']);
const FIELDS = ['title','document_type','document_date','expires_at','visibility','confidentiality','note'];
const GUARDS = [...FIELDS,'status','updated_at','archived_at','version','source','workflow_status','hr_signature_status','hr_signed_at','employee_signature_status','employee_signed_at','acknowledgement_status','sha256','employee_id','drive_file_id','storage_key'];
const PUBLIC_FIELDS = ['id','employee_id','document_type','title','file_name','storage_provider','drive_url','content_type','file_size','document_date','expires_at','visibility','note','status','version','source','confidentiality','sha256','archived_at','supersedes_document_id','created_at','updated_at'];
const response = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'}});
const present = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
const normalized = value => value == null ? null : value;

export function employeeDocumentEditFields(row){
  if(String(row.status||'active') === 'archived') return [];
  // Uploaded originals may have a default workflow_status=final. That is not a signature.
  const sealed = (row.source && row.source !== 'upload') || row.hr_signed_at || row.employee_signed_at || row.hr_signature_status === 'signed' || row.employee_signature_status === 'signed' || ['acknowledged','responded'].includes(row.acknowledgement_status);
  return sealed ? ['note'] : [...FIELDS];
}
export async function employeeDocumentEditToken(row){
  const snapshot = JSON.stringify(GUARDS.map(k=>[k,normalized(row[k])]));
  const hash = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(snapshot));
  return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
}
export async function decorateEmployeeDocument(row,canEdit=false){
  const out={}; for(const k of PUBLIC_FIELDS) if(present(row,k)) out[k]=row[k];
  out.edit_token=await employeeDocumentEditToken(row);
  out.editable_fields=canEdit?employeeDocumentEditFields(row):[];
  out.can_archive=Boolean(canEdit&&String(row.status||'active')!=='archived');
  out.can_restore=Boolean(canEdit&&String(row.status||'')==='archived');
  out.metadata_only=true;
  return out;
}
export function validateEmployeeDocumentChanges(body,row){
  if(!body || typeof body!=='object' || Array.isArray(body)) throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');
  for(const key of Object.keys(body)) if(![...FIELDS,'edit_token','reason'].includes(key)) throw new Error(`ไม่อนุญาตให้แก้ฟิลด์ ${key}`);
  const edits={};
  for(const k of FIELDS){
    if(!present(body,k))continue;
    if(body[k]!==null && typeof body[k]!=='string') throw new Error('ข้อมูลเอกสารต้องเป็นข้อความ');
    let v=body[k]===null?'':body[k].trim();
    if(k==='title'&&(!v||v.length>200))throw new Error('กรุณาระบุชื่อเอกสารไม่เกิน 200 ตัวอักษร');
    if(k==='document_type'&&!TYPES.has(v))throw new Error('ประเภทเอกสารไม่ถูกต้อง');
    if(k==='visibility'&&!['hr_only','employee','manager'].includes(v))throw new Error('การมองเห็นไม่ถูกต้อง');
    if(k==='confidentiality'&&!['internal','confidential','restricted'].includes(v))throw new Error('ระดับความลับไม่ถูกต้อง');
    if(k==='note'&&v.length>4000)throw new Error('หมายเหตุต้องไม่เกิน 4,000 ตัวอักษร');
    if(['document_date','expires_at'].includes(k)&&v){
      const d=new Date(`${v}T00:00:00.000Z`);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==v)throw new Error('วันที่เอกสารหรือวันหมดอายุไม่ถูกต้อง');
    }
    if(['document_date','expires_at','note'].includes(k)&&!v)v=null;
    if(normalized(row[k])!==v)edits[k]=v;
  }
  const date=present(edits,'document_date')?edits.document_date:row.document_date;
  const expires=present(edits,'expires_at')?edits.expires_at:row.expires_at;
  if((present(edits,'document_date')||present(edits,'expires_at'))&&date&&expires&&expires<date)throw new Error('วันหมดอายุต้องไม่ก่อนวันที่เอกสาร');
  return edits;
}

export async function manageEmployeeDocument(request,db,{clientId,userId,canEdit},id,action){
  if(!canEdit)return response({error:'ไม่มีสิทธิ์แก้ไขหรือลบเอกสารพนักงาน'},403);
  if(!Number.isSafeInteger(clientId)||clientId<=0||!Number.isSafeInteger(userId)||userId<=0)return response({error:'กรุณาเลือกบริษัทและเข้าสู่ระบบใหม่'},403);
  if(!Number.isSafeInteger(id)||id<=0)return response({error:'ไม่พบเอกสาร'},404);
  let body={};
  const text=await request.text();
  if(text.length>20000)return response({error:'ข้อมูลเอกสารมีขนาดเกินกำหนด'},413);
  try{body=text?JSON.parse(text):{};}catch{return response({error:'รูปแบบข้อมูลไม่ถูกต้อง'},400);}
  if(!body||typeof body!=='object'||Array.isArray(body))return response({error:'รูปแบบข้อมูลไม่ถูกต้อง'},400);
  const row=await db.prepare('SELECT * FROM employee_documents WHERE id=?1 AND client_id=?2').bind(id,clientId).first();
  if(!row)return response({error:'ไม่พบเอกสาร'},404);
  const token=await employeeDocumentEditToken(row);
  const status=String(row.status||'active');
  // Repeating a completed archive is harmless, including an older UI's DELETE {}.
  if(action==='archive'&&status==='archived')return response({ok:true,archived:true,unchanged:true,document:await decorateEmployeeDocument(row,true)});
  if(action==='restore'&&status!=='archived')return response({error:'เอกสารนี้ไม่ได้อยู่ในรายการที่ลบ'},409);
  if(action==='edit'&&status==='archived')return response({error:'กรุณากู้คืนเอกสารก่อนแก้ไข'},409);
  if(action!=='archive'&&!body.edit_token)return response({error:'กรุณาเปิดเอกสารใหม่ก่อนบันทึก',code:'EDIT_TOKEN_REQUIRED'},428);
  if(body.edit_token&&body.edit_token!==token)return response({error:'มีผู้เปลี่ยนเอกสารนี้แล้ว กรุณาโหลดข้อมูลล่าสุดก่อนทำรายการ',code:'DOCUMENT_CONFLICT'},409);
  const rawReason=body.reason;
  if(rawReason!=null&&typeof rawReason!=='string')return response({error:'กรุณาระบุเหตุผลเป็นข้อความ'},400);
  const reason=String(rawReason||'').trim();
  if(reason.length>1000)return response({error:'เหตุผลต้องไม่เกิน 1,000 ตัวอักษร'},400);
  if(action!=='archive'&&!reason)return response({error:'กรุณาระบุเหตุผลในการเปลี่ยนแปลง'},400);
  if(!['edit','archive','restore'].includes(action))return response({error:'ไม่พบคำสั่ง'},404);
  let changes={};
  if(action==='edit'){
    try{changes=validateEmployeeDocumentChanges(body,row);}catch(error){return response({error:error.message},400);}
    if(Object.keys(changes).some(k=>!employeeDocumentEditFields(row).includes(k)))return response({error:'เอกสารที่สร้างจากระบบหรือผ่านการลงนามแล้ว แก้ได้เฉพาะหมายเหตุ กรุณาออกฉบับใหม่หากเนื้อหาไม่ถูกต้อง'},409);
    if(!Object.keys(changes).length)return response({ok:true,unchanged:true,document:await decorateEmployeeDocument(row,true)});
  }else{
    if(Object.keys(body).some(k=>!['edit_token','reason'].includes(k)))return response({error:'รูปแบบข้อมูลไม่ถูกต้อง'},400);
    changes={status:action==='archive'?'archived':'active',archived_at:action==='archive'?new Date().toISOString():null};
  }
  const timestamp=new Date().toISOString();
  const auditChange={}; for(const [k,v] of Object.entries(changes))auditChange[k]={before:normalized(row[k]),after:v};
  const eventType=action==='edit'?'metadata_edited':action==='archive'?'archived':'restored';
  const detail=JSON.stringify({reason:reason||'เก็บถาวรจากหน้ารุ่นเดิม',changes:auditChange,file_name:row.file_name||null,metadata_only:true});
  const values=[];
  const bind=v=>{values.push(normalized(v));return `?${values.length}`;};
  const set=Object.entries({...changes,updated_at:timestamp}).map(([k,v])=>`${k}=${bind(v)}`).join(',');
  const conditions=[`id=${bind(id)}`,`client_id=${bind(clientId)}`];
  // Compare the exact fields we read, even if another request passed the token check.
  for(const k of GUARDS)if(present(row,k))conditions.push(`${k} IS ${bind(row[k])}`);
  const results=await db.batch([
    db.prepare(`UPDATE employee_documents SET ${set} WHERE ${conditions.join(' AND ')}`).bind(...values),
    db.prepare(`INSERT INTO employee_document_events(client_id,document_id,employee_id,actor_type,actor_user_id,event_type,detail_json,created_at) SELECT ?1,?2,?3,'user',?4,?5,?6,?7 WHERE changes()=1`).bind(clientId,id,row.employee_id||null,userId,eventType,detail,timestamp),
    db.prepare(`INSERT INTO audit_logs(client_id,actor_type,actor_id,action,entity_type,entity_id,detail_json) SELECT ?1,'user',?2,?3,'employee_document',?4,?5 WHERE changes()=1`).bind(clientId,String(userId),`employee.document.${action}`,String(id),detail)
  ]);
  if(Number(results[0]?.meta?.changes)!==1)return response({error:'ข้อมูลเอกสารเปลี่ยนระหว่างบันทึก กรุณาโหลดข้อมูลล่าสุด',code:'DOCUMENT_CONFLICT'},409);
  const updated={...row,...changes,updated_at:timestamp};
  return response({ok:true,archived:action==='archive',restored:action==='restore',document:await decorateEmployeeDocument(updated,true)});
}
