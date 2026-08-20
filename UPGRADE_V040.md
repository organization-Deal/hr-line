# Nakna HR V0.4.0 — Invite-first onboarding

## ไฟล์ที่ต้องทับ/เพิ่ม
- `src/index.js`
- `public/index.html`
- `public/app.js`
- `public/styles.css`
- `public/invite.html` (ใหม่)
- `public/invite.js` (ใหม่)
- `public/invite.css` (ใหม่)
- `migrations/0003_invite_locations.sql` (เก็บไว้สำหรับ migration ระยะยาว)

## ไม่ต้องรัน SQL ด้วยมือในรอบนี้
หลัง Deploy ให้ Login เข้า Dashboard แล้ว frontend จะเรียก `/api/bootstrap` ซึ่ง V0.4.0 จะสร้างตาราง/คอลัมน์ใหม่ใน D1 แบบ idempotent ให้อัตโนมัติ

## Flow ใหม่
1. Settings → เพิ่ม Work Location (พิกัด + รัศมี)
2. พนักงาน → เชิญเข้าทีม
3. กำหนดแผนก/ตำแหน่ง/วันเริ่มงาน/Location/จำนวนคน/วันหมดอายุ
4. ส่ง URL `/invite.html?token=<secure-token>` ให้พนักงาน
5. พนักงานกรอกข้อมูลและยืนยันเอง
6. ระบบสร้าง Employee + ผูกบริษัท/Location
7. ปุ่ม “เชื่อม LINE” เปิด LINE OA พร้อมข้อความ `JOIN <one-time-token>` ให้กดส่งครั้งเดียว
8. LINE บันทึก display name / picture / linked_at ลง Employee
9. เวลา Check-in Bot แสดง Quick Reply “ส่งตำแหน่งปัจจุบัน” และตรวจ Work Location ที่อนุญาต
10. Dashboard Attendance แสดงชื่อ Location, ระยะ และลิงก์ดูพิกัดบน Google Maps

## Legacy
`LINK 123456` เดิมยังใช้ได้เป็น fallback แต่ไม่ใช่ Main Flow อีกแล้ว

## หมายเหตุ
Dashboard login ยังคง Google Login ได้จากทุกที่ ส่วน Location restriction ใน V0.4.0 ใช้กับ Check-in/Check-out ตาม Work Location ที่ HR กำหนด
