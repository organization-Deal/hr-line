# P9.15.1 — Face Direct Page Fix

## ปัญหาที่แก้
ลิงก์ลงทะเบียน/ทดสอบ Face Verification บางครั้งเปิดใน LINE แล้วตกไปหน้า `index.html`/หน้า Login หลัก จึงเห็นข้อความให้ตั้งค่า LINE Official Account แทนหน้าสแกนใบหน้า

## วิธีแก้
- เพิ่มหน้า `/face` ที่ Worker เสิร์ฟ HTML สำหรับ Face Verification โดยตรง ไม่ผ่าน HR SPA/Login
- ลิงก์ “ลงทะเบียนใบหน้า”, “ใบหน้า & การยืนยันตัวตน” และ Self Test เปลี่ยนมาใช้ `/face?token=...`
- URL ฝั่งส่ง LINE ใช้ `APP_BASE_URL` ก่อน `APP_ORIGIN` เพื่อให้ลิงก์ชี้โดเมน public ที่ถูกต้อง
- เพิ่ม safety redirect ใน `app.js`: ถ้า Cloudflare/LINE เผลอเสิร์ฟ `index.html` ให้ลิงก์ Face ระบบจะกู้กลับไป `/face` อัตโนมัติก่อน boot หน้า Login
- Self Test บน LINE/มือถือใช้หน้าต่างเดิม ไม่ใช้ `window.open()` ซึ่งไม่เสถียรบน iOS LINE WebView

## ไฟล์ที่ต้อง Replace
- `src/index.js`
- `public/app.js`
- `public/attendance.js`

## Migration
ไม่มี

## หลัง Deploy
1. เปิดหน้า Settings > การเช็กอิน > Face Verification
2. กด “ลงทะเบียน / ทดสอบบัญชีของฉัน” หรือส่ง LINE ให้พนักงานที่ยังไม่ลงทะเบียน
3. URL ควรเข้า `/face?...`
4. หน้าจอต้องขึ้น “กำลังเตรียม Face Verification…” และปุ่ม “เริ่มสแกนใบหน้า” โดยไม่ผ่านหน้า Login/Business Setup
