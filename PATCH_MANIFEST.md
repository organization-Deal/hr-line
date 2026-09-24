# P9.15.3 — Face Settings Render Lifecycle Fix

## เจอสาเหตุจริง
P9.08+ เปลี่ยนระบบเป็น lazy-load ตามหน้า แต่ `settings` render path เรียก `renderSettings()`, `renderWorkLocations()` และ `renderLeavePolicies()` เท่านั้น
ขณะที่ Attendance controls (`attendance policy`, `Face Verification`, `12:30 reminder`) ถูก render อยู่ท้าย `renderPeopleCore()` ซึ่งไม่ได้ถูกเรียกเมื่อเปิด Settings
ผลคือ status ค้าง “กำลังโหลด...” และ Face card อาจไม่ถูก hydrate/ผูก event โดยเฉพาะเมื่อ HTML cache เป็นคนละรุ่น

## แก้ใน P9.15.3
- สร้าง `renderAttendanceSettingsControls()` เป็น lifecycle กลางของ Attendance settings
- เรียกทุกครั้งที่:
  - Settings โหลดข้อมูลเสร็จ
  - เปิดหมวด “การเช็กอิน”
  - render Settings
  - render Work Location
- `ensureAttendanceFaceCard()` บังคับตำแหน่ง Face card ให้ต่อจาก geofence policy เสมอ
- ถ้า HTML เก่าไม่มี Face card, `app.js` สร้างกลับให้เอง
- ผูก event ของ Face controls ใหม่แบบ idempotent แม้ card ถูกสร้างภายหลัง
- ถ้า `/api/people-core` ไม่มี Face payload จะ fallback ไป `/api/attendance-face-settings` โดยตรง
- bump asset/cache key เป็น `P9.15.3`
- แสดง badge `FACE VERIFY · BETA · P9.15.3` เพื่อเช็กได้ทันทีว่าหน้าจอโหลดโค้ดใหม่จริง
- ใส่ root mirror + `public/` mirror เพราะ repo เดิมมีไฟล์ซ้ำสองชุด และ Cloudflare ใช้ `public/` ตาม wrangler config

## ไฟล์ที่ต้อง Replace
ไฟล์ที่ Cloudflare ใช้งานจริง:
- `public/app.js`
- `public/index.html`
- `public/styles.css`
- `public/attendance.js`
- `public/attendance.html`
- `src/index.js`

ใน ZIP มี root mirror (`app.js`, `index.html`, `styles.css`, `attendance.js`, `attendance.html`, `index.js`) ให้ด้วย เพื่อป้องกันสับสนกับโครง repo เก่า

## Migration
ไม่มี
