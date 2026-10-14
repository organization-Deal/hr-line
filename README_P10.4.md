# Nakna P10.4 — แก้ไขและลบเอกสารรายพนักงาน

## สิ่งที่เพิ่ม
เข้า พนักงาน → เอกสาร → เลือกเอกสาร → แก้ไข / ลบเอกสาร / ประวัติ

- เอกสารอัปโหลดที่ยังไม่ผ่านการลงนาม: แก้ชื่อ ประเภท วันที่เอกสาร วันหมดอายุ การมองเห็น ระดับความลับ และหมายเหตุได้
- เว้นวันหมดอายุว่างได้; ตรวจวันที่จริงและไม่ยอมให้วันหมดอายุอยู่ก่อนวันที่เอกสาร
- ต้องระบุเหตุผลเมื่อแก้ไข; ประวัติแสดงบัญชีผู้แก้ เวลา ค่าเดิมและค่าใหม่
- ลบเอกสารจากรายการใช้งานโดยย้ายไปแท็บ “ลบ / เก็บถาวร”; ต้องยืนยันพร้อมเหตุผล
- ไฟล์ต้นฉบับและประวัติยังอยู่ ไม่ใช่การลบข้อมูลถาวรจาก Google Drive/R2
- ปุ่ม “กู้คืน” นำรายการกลับด้วยการมองเห็นเดิม มีประวัติ และไม่ส่ง LINE ซ้ำอัตโนมัติ
- เอกสารที่ระบบสร้าง/ผ่านการลงนาม: แก้ได้เฉพาะหมายเหตุ ไม่แก้ข้อมูลสำคัญทับเอกสารฉบับเดิม
- สิทธิ์แก้ไข/ลบเหมือน HR People Admin เดิม: owner, co_owner, hr_admin, hr; payroll_admin ดูได้แต่แก้ไม่ได้
- บันทึกข้อมูลกำกับ/ลบ/กู้คืนใช้ API คำขอเดียวและอัปเดตหน้าจอจากผลที่ Server ยืนยัน ไม่มี loadAll() และไม่อัปโหลดไฟล์ซ้ำ
- หากอัปโหลดสำเร็จแต่โหลดรายการต่อไม่สำเร็จ จะแจ้งว่าไฟล์บันทึกแล้ว ไม่ทำให้เข้าใจว่าต้องอัปโหลดซ้ำ

**สำคัญ:** การแก้วันที่คือแก้ข้อมูลกำกับเอกสารในนากนะ ไม่แก้ข้อความใน PDF/Word และไม่เปลี่ยน contract_end_date ของโปรไฟล์พนักงานอัตโนมัติ

## ฐานที่รองรับ
Backend ที่มี Leave Form Hotfix P10.3 แล้ว และ Frontend P10.0 / P10.1 Attendance Workspace / P10.2 Attendance Experience จากชุดในบทสนทนา

ชุดนี้ใช้ตัวติดตั้งแก้เฉพาะบล็อกเอกสาร ไม่ส่ง app.js/index.html ทั้งก้อนมาทับ เพราะมี Frontend หลายสายรุ่นในบทสนทนา ถ้าโค้ดของคุณเปลี่ยนในบริเวณเดียวกัน ตัวติดตั้งจะหยุดก่อนแก้ไฟล์ ไม่เดารวมโค้ดเอง

## ติดตั้ง — ต้องรันตัวติดตั้ง ไม่ใช่อัปโหลด ZIP อย่างเดียว
1. สำรอง/สร้าง branch ทดสอบจาก repo ล่าสุด
2. แตก ZIP แล้วรวมไฟล์เข้ารากของ repo เดิม ห้ามลบ src/public/tools เดิม
3. รันจากราก repo:

```bash
node tools/apply-p10.4.mjs --dry-run
node tools/apply-p10.4.mjs
npm run check
node --check src/employee-document-management.js
npx wrangler deploy
```

ทางเลือก: แตก ZIP ไว้นอก repo แล้วเรียก
```bash
node /path/to/extracted-patch/tools/apply-p10.4.mjs /path/to/your-repo
```
ตัวติดตั้งจะเพิ่มไฟล์ใหม่และแก้ไฟล์เดิมให้อัตโนมัติ พร้อมเก็บไฟล์สำรองในโฟลเดอร์ข้าง repo ซึ่งจะแสดงตำแหน่งบนหน้าจอ ไม่แตะฐานข้อมูลหรือ Deploy ให้เอง

สำหรับ workflow อัปไฟล์บน GitHub: รันตัวติดตั้งกับสำเนา repo ในเครื่องก่อน แล้วอัปเฉพาะ 5 ไฟล์ runtime ที่เปลี่ยนตามด้านล่างขึ้นตำแหน่งเดิม หรือ commit การเปลี่ยนแปลงจากเครื่อง อย่าอัปเฉพาะ CSS/โมดูลใหม่โดยยังไม่รันตัวติดตั้ง

## ไฟล์ runtime หลังติดตั้ง
แก้ 3 ไฟล์:
- public/app.js — เปลี่ยนเฉพาะบล็อก Employee Documents
- public/index.html — เพิ่ม cache-busting `ed=P10.4` เฉพาะ URL app.js ไม่เปลี่ยน layout
- src/index.js — เพิ่ม import และ route การจัดการเอกสารเท่านั้น

เพิ่ม 2 ไฟล์:
- public/ui/employee-documents-p10_4.css
- src/employee-document-management.js

ไม่มี Migration ใหม่ ไม่ต้องเพิ่ม Secret, dependency แอป หรือแก้ Wrangler
ไม่แก้ Payroll, Attendance, ใบลา, Subscription, Cron/LINE notification หรือหน้าอื่น

## API / การป้องกันข้อมูล
- GET /api/employees/:id/documents ใช้ endpoint เดิม เพิ่ม permissions, editable_fields และ edit_token; ข้อมูลเดิมยังอยู่
- PATCH /api/employee-documents/:id เพิ่มการแก้ metadata เฉพาะฟิลด์ที่อนุญาต
- DELETE /api/employee-documents/:id คง soft archive; client รุ่นเดิมที่ส่ง `{}` ยังใช้ได้
- POST /api/employee-documents/:id/restore เพิ่มการกู้คืน
- GET /api/employee-documents/:id/events และ /file ใช้เดิม
- ใช้ client_id จาก session ฝั่ง Server ไม่รับ client_id/employee_id/ตำแหน่งไฟล์จาก payload
- edit_token และคำสั่ง UPDATE ที่เทียบ snapshot เดิมช่วยกันการบันทึกทับจากหน้าที่เปิดค้าง
- UPDATE + document event + audit log ทำใน D1 batch เดียว ถ้าบันทึกประวัติล้มเหลว การแก้ metadata ไม่ควรถูก commit
- ไม่เปลี่ยน sha256, version, ไฟล์ต้นฉบับ หรือลายเซ็นเมื่อแก้ metadata
- ไม่ออกคำสั่ง Google Drive/R2 delete หรือส่ง LINE ในการแก้ไข/เก็บถาวร/กู้คืน

## ทดสอบก่อนให้ทีมใช้
- เปิดเอกสารของพนักงานทดสอบ → กดแก้ไขวันหมดอายุ → บันทึก → เปิดใหม่และตรวจค่าคงอยู่
- ดูประวัติว่ามีบัญชีผู้แก้ เหตุผล และค่าเดิม/ใหม่
- ลบเอกสารทดสอบ → ไม่อยู่ในใช้งาน → อยู่ในลบ/เก็บถาวร → กู้คืนได้
- ตรวจเอกสารที่ลงนามแล้วว่าแก้วันที่ไม่ได้ แต่หมายเหตุแก้ได้
- ทดลองบัญชีสิทธิ์ดูอย่างเดียว และตรวจว่าไม่สามารถ PATCH โดยตรงได้
- เปิด UI บน iPhone LINE/Safari และ Android จริงก่อน production rollout

## ย้อนกลับ
ใช้ไฟล์สำรองของ repo ตัวเอง ไม่ใช่แพ็กจากฐานอื่น:
```bash
node tools/rollback-p10.4.mjs /path/to/nakna-backup-p10.4-...
```
ตัว rollback ตรวจ hash ก่อนและจะไม่ทับงานใหม่ที่แก้หลัง P10.4 ต้อง Deploy เองอีกครั้งเพื่อย้อนหน้าเว็บ/Worker; ประวัติและ metadata ที่แก้ในฐานข้อมูลจะไม่ถูกย้อนหรือลบ

## ข้อจำกัดการตรวจ
ใช้ source ที่แนบในบทสนทนา ไม่ใช่การอ่าน repo Production ล่าสุดโดยตรง
ผล SQL/endpoint tests ใช้ SQLite จำลอง D1 และ Browser ใช้ Chromium/API mock ไม่ได้เชื่อม Google Drive, LINE หรือ D1 Production และยังไม่ได้ Deploy
การป้องกันสาขา/สิทธิ์และเงื่อนไขที่ทดสอบไม่ได้เท่ากับรับรองว่าไม่มีบั๊กทุกกรณี

อ้างอิงทางเทคนิค:
- Cloudflare D1 batch และ Workers binding: https://developers.cloudflare.com/d1/worker-api/d1-database/
- SQLite changes(): https://www.sqlite.org/lang_corefunc.html#changes
