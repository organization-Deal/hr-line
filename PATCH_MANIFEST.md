# Nakna HR P8.26 — Signature Workflow Engine

ฐานที่ใช้: P8.25 Two-signature Composition (รวม P8.23 GPS patch แล้ว)

## สำคัญ: ลำดับ Deploy
1. Backup D1 ก่อน
2. รัน `migrations/0030_signature_workflow_engine.sql` **ก่อน Deploy Worker/Frontend P8.26**
3. Replace ไฟล์ด้านล่าง
4. Deploy
5. Refresh/เปิดหน้าใหม่เพื่อให้ cache `P8.26.0` ทำงาน

## REPLACE
- `src/index.js`
- `public/app.js`
- `public/index.html`
- `public/styles.css`
- `public/documents.html`
- `public/documents.js`
- `public/documents.css`

## ADD
- `migrations/0030_signature_workflow_engine.sql`

## Workflow ใหม่
`Draft → HR ตรวจ → HR ลงลายเซ็น → ส่ง LINE → พนักงานตรวจ PDF ที่ HR เซ็นแล้ว → พนักงานลงลายเซ็น → Final PDF`

- HR ต้องกดลงนามจริงใน modal (ใช้ลายเซ็นที่บันทึกไว้ หรือเซ็นใหม่เฉพาะเอกสาร)
- หลัง HR เซ็น ระบบสร้าง PDF ฝั่งบริษัทก่อน
- เอกสารที่ต้องมี 2 ฝ่ายจะอยู่สถานะ `awaiting_employee_signature`
- พนักงานเปิดจาก LINE / เอกสารของฉัน แล้วลงลายเซ็น
- Final PDF ถูกสร้างเป็นไฟล์แยก ไม่เขียนทับ PDF ที่ HR เซ็นไว้
- Evidence เก็บ HR signed time, employee signed time, signature hash, version และ event timeline
- เอกสารรับรองการทำงาน/เงินเดือนใช้ข้อความ “รับเอกสาร”
- เอกสารผ่านทดลองงาน/ปรับเงินเดือน/ประกาศ/ใบเตือนใช้ข้อความ “รับทราบ”
- ใบเตือน/ประกาศยังระบุชัดว่าการรับทราบไม่เท่ากับยอมรับข้อกล่าวหา

## ไม่ต้อง Replace ไฟล์อื่น
Patch นี้จงใจส่งเฉพาะไฟล์ที่เพิ่ม/แก้จาก P8.25
