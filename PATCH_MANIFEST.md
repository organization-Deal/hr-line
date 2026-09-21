# NAKNA P8.12 — Document & Evidence Patch

ฐานเปรียบเทียบ: hr-line-main(2).zip ที่ผู้ใช้อัปโหลด
แพ็กนี้มีเฉพาะไฟล์ที่เพิ่มหรือแก้ไขเท่านั้น

## ADD
- migrations/0021_document_foundation.sql
- migrations/0022_document_system_complete.sql
- migrations/0023_document_delivery_reminders.sql
- migrations/0024_document_case_e2e.sql
- public/documents.css
- public/documents.html
- public/documents.js
- scripts/audit.mjs
- scripts/migration-smoke.mjs

## REPLACE
- app.js
- index.html
- index.js
- package.json
- public/app.js
- public/index.html
- public/styles.css
- src/index.js
- styles.css

## DELETE
- ไม่มี

## หมายเหตุ
- 50 ทวิยัง HOLD ไม่เปิดเป็น Production Ready
- ก่อนอัปจริงให้ Backup D1 ก่อน แล้ว apply migrations 0021–0024 ตามลำดับ
- หลัง deploy ต้อง smoke test Google Drive / LINE OA / iPhone LINE Browser จริง