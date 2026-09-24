# Nakna P9.14.1 — Face Route Hotfix

แก้กรณี Quick Attendance แสดง `API route not found` / `FACE_STATUS_FAILED` ก่อนเริ่ม Face Verification

## Root cause
Public Face API route ใช้ token matcher `{32,}` แต่ access validator รองรับ token ตั้งแต่ 20 ตัวขึ้นไป หาก token จาก LINE/portal ไม่เข้า matcher request จะหลุดไป authenticated `/api/` router และจบด้วย `API route not found` แทนที่จะเข้า Face Verification

## Changed files
- `src/index.js`
- `public/attendance.js`
- `public/attendance.html`

## Changes
- รวม Face endpoints เป็น public attendance matcher เดียว
- token matcher ใช้ `{20,}` ให้ตรงกับ `getQuickAttendanceAccess()`
- `gps-log`, `check-in`, `check-out` ใช้กฎ token เดียวกัน
- ไม่ปล่อย method ผิดหลุดเข้า `/api` router; ตอบ 405 โดยตรง
- Frontend แยก error `FACE_BACKEND_ROUTE_MISSING` หาก Worker backend ยังเป็นเวอร์ชันเก่า
- bump runtime เป็น `P9.14.1-FACE-ROUTE-HOTFIX`

## Deploy note
ต้องอัปเดต `src/index.js` จริง ไม่ใช่อัปเฉพาะ `public/*` เพราะ Face API อยู่ใน Worker backend
