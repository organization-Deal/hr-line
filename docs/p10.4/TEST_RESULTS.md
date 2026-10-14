# P10.4 — ผลตรวจจริงในเครื่อง

วันที่ 14 ตุลาคม 2026
ฐาน: Backend P10.3; Frontend P10.0 / P10.1 Attendance Workspace / P10.2 Attendance Experience ที่มีในแชต

| ชุดตรวจ | ผล | ขอบเขต |
|---|---:|---|
| Backend / SQLite / route integration | 52/52 | Metadata, dates, permissions, tenant isolation, token conflict, CAS race, transaction rollback, soft archive/restore, legacy DELETE, event/audit, file hash/identity unchanged |
| Chromium UI interaction | 40/40 | 4 widths: 320, 390, 768, 1440; เปิดรายการ/แก้ไข/คืนผลทันที/ประวัติ/ลบ/กู้คืน/sealed record/readonly/error draft retained/no modal overflow/no pageerror |
| Installer / source preservation | 19/19 | 3 frontend bases, dry-run, guarded apply, unchanged outside doc block, idempotence, exact rollback, refuses unknown local changes |
| Existing P10.3 leave-form regression | 9/9 | เคสเดิม getEmployeeLeaveProfile, public form, NULL/0/1 access, expired token |
| Syntax | ผ่าน | npm run check ของ repo ประกอบ, new module, installer และ frontend block |

## สิ่งที่วัดได้
ในการทดสอบ UI ที่แต่ละขนาด การแก้ metadata ส่ง PATCH เพียง 1 ครั้ง แล้วใช้ response ปรับรายการ ไม่ได้เรียกโหลดพนักงาน/HR ทั้งระบบตามหลัง
เก็บถาวรส่ง DELETE เพียง 1 ครั้ง; กู้คืนใช้ POST resource restore
ไม่มีการวัด P50/P95 Production หรืออ้างว่า latency ภายนอกเร็วขึ้นกี่เปอร์เซ็นต์

## วิธีทดสอบ
SQL ใช้ node:sqlite ใน Node 22.16 จำลอง D1 prepare/bind/first/all/batch; batch ใช้ transaction ในฐานจำลองและมีเคสตั้งใจให้ history insert ล้มเหลว
Browser ใช้ Chromium ผ่าน Playwright, HTML/CSS/app.js ของ repo ประกอบจริง หยุด boot ที่ต้อง login และ mock fetch เป็นข้อมูลทดสอบเพื่อไม่ส่ง mutation ไป Production
เปิด mobile dialog system เดิมระหว่างทดสอบ
Font ของ QA ใช้ fallback ที่มีในเครื่อง ไม่แจกไฟล์ฟอนต์

## ข้อจำกัด
ไม่ได้ทดสอบ iPhone LINE/Safari/WebKit บนอุปกรณ์จริง, D1 binding บน Cloudflare จริง, Google Drive/R2 ที่บริษัทใช้อยู่, การชำระเงิน หรือทดสอบโหลดหลายผู้ใช้
Upload/read-file service ยังเป็น implementation เดิม; browser tests ชุดหลักนี้เน้น metadata/archive/restore ไม่รับรอง external upload/delivery
ไม่ได้เปลี่ยนข้อมูลบริษัทจริงหรือ Deploy
