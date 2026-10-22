const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'}});
const roles=new Set(['co_owner','hr_admin','payroll_admin','manager','approver']);
export async function accessManagementApi(request,env,auth,{kind,userId},h){
 const cid=Number(auth.clientId),actor=Number(auth.user.id);if(!cid)return response({error:'กรุณาเลือกบริษัท'},409);
 if(kind==='history'){
  const owner=await h.canManageWorkspaceAccess(env.DB,cid,actor);if(!owner&&!['hr_admin','hr'].includes(auth.role))return response({error:'ไม่มีสิทธิ์ดูประวัติ'},403);
  const rows=(await env.DB.prepare(`SELECT a.id,a.action,a.entity_type,a.detail_json,a.created_at,u.name AS actor_name,CASE WHEN a.entity_type='employee' THEN e.first_name ELSE t.name END AS target_name FROM audit_logs a LEFT JOIN users u ON CAST(u.id AS TEXT)=a.actor_id LEFT JOIN users t ON a.entity_type='user' AND CAST(t.id AS TEXT)=a.entity_id LEFT JOIN employees e ON a.entity_type='employee' AND e.client_id=a.client_id AND CAST(e.id AS TEXT)=a.entity_id WHERE a.client_id=?1 AND a.action IN ('company.access.grant','company.access.update','company.access.revoke','approver.permissions.update') ${owner?'':"AND a.action='approver.permissions.update'"} ORDER BY a.id DESC LIMIT 30`).bind(cid).all()).results||[];
  return response({data:rows.map(r=>{let detail={};try{detail=JSON.parse(r.detail_json||'{}');}catch{}return {id:r.id,action_label:({'company.access.grant':'เพิ่มหรือกำหนดบทบาท','company.access.update':'เปลี่ยนบทบาท','company.access.revoke':'ถอนสิทธิ์ผู้ดูแล','approver.permissions.update':'เปลี่ยนสิทธิ์ผู้อนุมัติ'})[r.action],actor_name:r.actor_name,target_name:r.target_name,created_at:r.created_at,role:detail.role||detail.previous_role||null,permissions:Array.isArray(detail.permissions)?detail.permissions:null};})});
 }
 if(!await h.canManageWorkspaceAccess(env.DB,cid,actor))return response({error:'เฉพาะเจ้าของหลักหรือเจ้าของร่วมเท่านั้น'},403);
 const primary=Number(await h.getPrimaryOwnerUserId(env.DB,cid));if(Number(userId)===primary||Number(userId)===actor)return response({error:'เปลี่ยนบทบาทเจ้าของหลักหรือบัญชีตนเองจากหน้านี้ไม่ได้'},400);
 const target=await env.DB.prepare("SELECT role FROM company_members WHERE client_id=?1 AND user_id=?2 AND status='active'").bind(cid,Number(userId)).first();if(!target)return response({error:'ไม่พบผู้ใช้งานในบริษัทนี้'},404);
 let body;try{body=await request.json();}catch{return response({error:'ข้อมูลไม่ถูกต้อง'},400);}
 if(!body||typeof body!=='object'||Array.isArray(body))return response({error:'ข้อมูลไม่ถูกต้อง'},400);
 if(!roles.has(body.role))return response({error:'บทบาทไม่ถูกต้อง'},400);
 if(body.expected_role!==target.role)return response({error:'สิทธิ์เปลี่ยนแล้ว กรุณาเปิดข้อมูลล่าสุด'},409);
 const changed=await env.DB.prepare("UPDATE company_members SET role=?1,updated_at=CURRENT_TIMESTAMP WHERE client_id=?2 AND user_id=?3 AND status='active' AND role=?4").bind(body.role,cid,Number(userId),target.role).run();if(!changed.meta?.changes)return response({error:'สิทธิ์เปลี่ยนแล้ว กรุณาเปิดข้อมูลล่าสุด'},409);
 await h.safeAudit(env.DB,cid,'user',String(actor),'company.access.update','user',String(userId),{previous_role:target.role,role:body.role});h.clearAuth();return response({ok:true,role:body.role});
}
