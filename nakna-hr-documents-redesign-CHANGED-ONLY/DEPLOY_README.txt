Nakna HR — Documents Workspace Redesign (2026-10-19)

วิธีติดตั้ง
1. สำรอง/สร้าง Git commit ของซอร์สเดิมก่อน
2. แตก ZIP นี้แล้วคัดลอกโฟลเดอร์ public/ และ src/ ไปทับตำแหน่งเดิมใน Repo hr-line
3. Commit + Push โดยใช้การ deploy เดิมของโปรเจกต์ (wrangler deploy)
4. Hard reload หน้า Nakna HR และเปิดเมนู เอกสาร

เฉพาะไฟล์ที่เปลี่ยนจริง:
- public/index.html
- public/app.js
- public/ui/nk-documents-redesign.css (ไฟล์ใหม่)
- src/index.js

สิ่งที่แก้:
- ตารางเอกสาร HR + ค้นหา/กรองสถานะ/กรองประเภท/เรียงวันที่
- แท็บ เอกสารทั้งหมด, ต้องดำเนินการ, เทมเพลต, สลิปเงินเดือน
- Side detail ของแต่ละเอกสาร พร้อมผู้ออก/ผู้รับ วันเวลา รหัส เวอร์ชัน สถานะ และประวัติ
- Wizard ออกเอกสารใหม่ 4 ขั้น โดยเรียก API /api/document-workflows/create เดิม
- เพิ่มชื่อผู้ออกเอกสารใน GET /api/documents (LEFT JOIN users)
- เพิ่ม GET /api/employee-documents/:id/history พร้อมตรวจสิทธิ์และ tenant scope
- ลดการ์ดซ้ำ/พื้นที่ว่าง, Mobile-responsive, คงสี Nakna teal (#04878a)

ข้อจำกัดสำคัญ:
- ไม่มีการ Migration ฐานข้อมูลเพิ่มสำหรับ patch นี้ (ใช้ columns/tables ที่ระบบมีอยู่แล้ว)
- ไม่เปลี่ยน logic ลงนาม/สร้าง PDF/LINE/Payroll; ทดสอบจากระบบจริงหลัง Deploy อีกครั้ง
- GET /api/documents เดิมจำกัด 200 รายการ/ครั้ง; UI แจ้งเพดานนี้เมื่อถึง 200 (ยังไม่เพิ่ม Server pagination)
- ข้อมูล 'สร้างโดย' แสดงชื่อ users.name จากบัญชีที่ผูกกับ created_by_user_id หากไม่มีข้อมูล แสดง 'ไม่พบข้อมูลผู้สร้าง'
- คู่มือ release:check ใน ZIP ต้นทางเสียอยู่ก่อนแล้ว: package.json อ้าง scripts/audit.mjs และ scripts/migration-smoke.mjs ซึ่งไม่มีในซอร์ส
  และ scripts/audit.js เดิมตรวจพบ ID ที่ไม่มีใน index.html เดิม (companyProfileShortcut, attendanceFaceSaveBtn)
  จึงทดสอบ npm run check, node --test tests/document-management.test.mjs และ Playwright แยกต่างหาก

ผล QA ในเครื่อง (mock UI data ไม่ใช่บัญชีจริง):
- npm run check: PASS
- node --test tests/document-management.test.mjs: 52 PASS
- Chromium Playwright 390/768/1440 px: PASS
  (tabs, filters, detail modal, four-step wizard, no horizontal overflow)
- SQLite query smoke for creator and history metadata: PASS

ทดสอบบน Production อีก 1 รอบหลัง Deploy ก่อนให้ทีม HR ใช้ข้อมูลจริง:
- สร้าง Draft ทดสอบ 1 ใบ, ผู้รับ/ผู้สร้าง, ส่งอนุมัติ, ลงนาม HR,
  พนักงานลงนาม, สร้าง Final PDF, ส่ง LINE, เปิดอ่าน และตรวจ timeline
