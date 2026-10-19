NAKNA — สิทธิ์ลา & วันหยุด · Holiday Visibility and UX Fix
==========================================================

สิ่งที่แก้
- แก้ปัญหาหน้า Settings ไม่วาดรายการวันหยุดซ้ำหลังได้รับ people-core
- เพิ่ม API GET /api/company-holidays ที่อ่านข้อมูลเฉพาะ client_id ปัจจุบัน
- โหลดวันหยุดแยกจาก People Core พร้อม Error State และปุ่ม Retry
- มีตัวเลือกปี พ.ศ. และแสดงข้อมูลเก่าถ้าไม่มีข้อมูลในปีปัจจุบัน
- เลือกปีที่มีข้อมูลโดยอัตโนมัติ เมื่อปีปัจจุบันไม่มีข้อมูล
- แยกหน้า Settings ให้เป็น 3 แท็บ: วันหยุดบริษัท / ประเภทลา / ทดลองงาน
- แสดงจำนวนวันหยุดและประเภทค่าจ้าง รวมถึงจัดกลุ่มรายการตามเดือน
- หลังเพิ่ม/ลบวันหยุด รีเฟรชจากฐานข้อมูลโดยตรง ไม่ต้องโหลดพนักงานใหม่

ไฟล์แก้ไข
public/app.js
public/index.html
public/ui/nk-leave-settings.css (ไฟล์ใหม่)
src/index.js
scripts/verify-holiday-settings.mjs (ไฟล์ตรวจ)

ติดตั้ง
1. เทียบ Diff กับ branch ล่าสุดของ Repo hr-line ก่อนวางทับ: ชุดนี้ต่อจาก
   Nakna-Employee-Service-UX-Redesign-CHANGED-ONLY.zip ซึ่งเป็นฐานที่มีอยู่
2. วางไฟล์ 4 ส่วนตามโครงสร้างเดิม (อย่าเพิ่มโฟลเดอร์ซ้อน)
3. ตรวจด้วย: node scripts/verify-holiday-settings.mjs
4. ตรวจ syntax: npm run check
5. Deploy ตาม workflow เดิม: npx wrangler deploy
6. เปิด Settings > สิทธิ์ลา & วันหยุด และตรวจปี พ.ศ.

สำคัญ
- ไม่ลบหรือแก้ข้อมูลวันหยุดที่เคยบันทึก ไม่ต้อง D1 migration
- ข้อมูลถูกแยกตาม client_id ของ Workspace; หากวันหยุดเก่าอยู่คนละ
  Workspace ต้องตรวจข้อมูลด้วยสิทธิ์ที่เหมาะสม ไม่ควรย้ายข้อมูลเดาเอง
- ไม่ใช่ระบบสร้างวันหยุดตามกฎหมายอัตโนมัติ HR ต้องตรวจประกาศบริษัทเอง
- ไม่ได้ทดสอบ D1 Production จริง
- UI browser smoke ผ่านที่หน้าจอ 390/768/1440px โดยใช้ข้อมูลจำลอง
- npm run check ผ่าน ส่วน legacy regression test p931 มี version assertion
  เก่าที่ไม่ตรงกับ release ปัจจุบัน (เดิม P9.31) ไม่ใช่การเปลี่ยนวันหยุด
