# P9.15.2 — Face Scanner Visible + Cache Bust

## ปัญหาที่แก้
- บน LINE/iPhone หน้า Settings > การเช็กอิน บางครั้งไม่เห็นการ์ด Face Verification เลย แม้ Backend/Face API จะติดตั้งแล้ว
- P9.15.1 เปลี่ยน `app.js` แต่ `index.html` ยังอ้าง asset version `P9.15` ทำให้ LINE WebView / browser cache มีโอกาสโหลด HTML/JS คนละรุ่น
- ปุ่มเปิดสแกนหน้าถูกซ่อนอยู่ใน flow rollout ทำให้ผู้ใช้ไม่เห็นชัดว่าต้องกดตรงไหน

## วิธีแก้
- bump cache key ของ `index.html`, `app.js`, `styles.css`, `attendance.html`, `attendance.js` เป็น P9.15.2
- เพิ่ม meta no-cache/no-store ในหน้า HR
- เพิ่ม `ensureAttendanceFaceCard()` ใน `app.js`: ถ้า HTML ที่ client ถืออยู่ไม่มี Face card ระบบจะสร้างการ์ดกลับเข้า Settings ให้อัตโนมัติก่อน bind event
- เปลี่ยน CTA หลักเป็น **“สแกน / ลงทะเบียนใบหน้าของฉัน”** และทำให้เด่นบนมือถือ
- ปุ่มนี้เปิด `/face?...` โดยตรง จึงเปิดกล้องและ Face flow โดยไม่สร้าง Check-in ซ้ำ
- Worker `/face` และ LINE Face links bump เป็น P9.15.2 เพื่อกัน cache รุ่นเก่า

## ไฟล์ที่ต้อง Replace
- `src/index.js`
- `public/app.js`
- `public/index.html`
- `public/styles.css`
- `public/attendance.html`
- `public/attendance.js`

## Migration
ไม่มี

## หลัง Deploy
1. ปิดหน้า LINE WebView เดิมให้หมด แล้วเปิด Nakna ใหม่จาก LINE
2. เข้า ตั้งค่า > การเช็กอิน
3. ใต้ “เช็กอิน / เช็กเอาต์นอกพื้นที่” ต้องเห็นการ์ด “ยืนยันตัวตนด้วยใบหน้า” ก่อนการ์ดแจ้งเตือน 12:30
4. กด **สแกน / ลงทะเบียนใบหน้าของฉัน**
5. ระบบต้องเข้า `/face?...` และขึ้นปุ่ม **เริ่มสแกนใบหน้า** เพื่อเปิดกล้อง
