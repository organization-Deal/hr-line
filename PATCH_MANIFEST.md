# Nakna P8.23-GPS1 — Quick Attendance GPS Reliability Patch

Patch นี้ต่อจาก P8.22 และมีเฉพาะไฟล์ที่แก้/เพิ่ม

## REPLACE
- `src/index.js`
- `public/attendance.js`
- `public/attendance.html`

## ADD
- `migrations/0027_attendance_gps_diagnostics.sql`

## ต้องทำตอน Deploy
1. Replace 3 ไฟล์ข้างต้น
2. รัน migration `0027_attendance_gps_diagnostics.sql`
3. Deploy Worker + static assets
4. ปิดหน้า Check-in เดิมใน LINE แล้วเปิดจากเมนูใหม่ เพื่อให้ URL/cache version `P8.23-GPS1` ถูกโหลด

## ไม่ได้แก้
- Geofence rule
- เวลาเข้างาน
- LINE binding
- Document System
