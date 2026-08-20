# Nakna HR V0.5.0 — Leave Control + LINE Approval

## เพิ่มในรุ่นนี้
- Leave Policy ต่อบริษัท: ประเภทลา, สิทธิ์เริ่มต้น, ต้องมีเหตุผล, หลักฐานตามจำนวนวัน, วันแจ้งล่วงหน้า, อนุญาตติดลบ/ไม่จำกัด
- สิทธิ์ลารายพนักงานต่อปี + Adjustment
- ระบุผู้อนุมัติเรื่องลารายพนักงาน
- LINE Flex Card: เมนูพนักงาน, ขอวันลา, ดูสิทธิ์ลา, การ์ดอนุมัติ/ไม่อนุมัติ
- LINE leave wizard: เลือกประเภท -> เลือกวัน -> เหตุผล -> หลักฐาน -> ส่งผู้อนุมัติ
- หลักฐานรูป/ไฟล์จาก LINE เก็บใน R2 (`EVIDENCE_BUCKET`)
- HR Leave Control Center + 14-day team calendar
- HR เปิดหลักฐานได้จาก Dashboard
- Approval audit trail + เหตุผล Reject
- Leave ที่อนุมัติ sync เข้า Attendance เพื่อไม่ขึ้น Missing
- LINK 6 หลักเดิมยังอยู่เป็น fallback

## ไฟล์ที่ต้องทับ
- `src/index.js`
- `public/index.html`
- `public/app.js`
- `public/styles.css`
- `wrangler.jsonc`
- `package.json`
- เพิ่ม `migrations/0004_leave_control.sql`

## Deploy
ใช้คำสั่งเดิม:

`npx wrangler deploy`

Wrangler จะ auto-provision R2 draft binding `EVIDENCE_BUCKET` ให้เมื่อ deploy หากยังไม่มี bucket ผูกกับ binding นี้

หลัง deploy ให้ Login เข้า Dashboard หนึ่งครั้ง `/api/bootstrap` จะซ่อม schema V0.5 แบบ idempotent และสร้าง Leave Policy เริ่มต้นของ Workspace ให้อัตโนมัติ

## ทดสอบ Flow
1. พนักงาน -> จัดการสิทธิ์ -> เลือกผู้อนุมัติที่เชื่อม LINE แล้ว -> บันทึกสิทธิ์
2. พนักงานพิมพ์ `เมนู` หรือ `ขอลา` ใน LINE
3. เลือกประเภท + วัน + เหตุผล
4. ถ้า Policy บังคับหลักฐาน ให้ส่งรูป/ไฟล์
5. ผู้อนุมัติจะได้ Flex Card พร้อมปุ่ม อนุมัติ / ไม่อนุมัติ
6. Reject ต้องพิมพ์เหตุผล
7. Dashboard -> การลา จะแสดงผู้อนุมัติ หลักฐาน สถานะ และ Calendar

> ค่า Leave Policy เริ่มต้นเป็น Template เพื่อทดสอบ Product ไม่ใช่คำแนะนำทางกฎหมาย บริษัทต้องตรวจ/ตั้งค่าให้ตรงกับ Policy และข้อกำหนดที่ใช้จริงก่อน Production

## เพิ่มเติมใน build สุดท้าย
- คำขอผ่าน LINE จะไม่ส่งได้ถ้ายังไม่ได้กำหนดผู้อนุมัติ เพื่อไม่ให้คำขอค้างแบบไม่มี Owner
- ลาวันเดียวเลือกได้: เต็มวัน / ครึ่งวันเช้า / ครึ่งวันบ่าย
- Manager/ผู้อนุมัติปกติอนุมัติผ่าน LINE และระบบตรวจว่าเป็นผู้อนุมัติที่กำหนดจริง
- ปุ่มอนุมัติใน Dashboard เป็น HR Override และ backend จำกัดไว้ที่ `owner / hr_admin / hr`
- Audit event ตอน HR บันทึกลาแทนจะเก็บ `actor_user_id`
