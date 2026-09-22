# Nakna P8.21 — Approval / PDF Storage Fix

Base: P8.20

## REPLACE
- src/index.js
- public/app.js
- public/index.html

## Migration
- ไม่มี migration ใหม่

## Fix
- อนุมัติเอกสารจะสร้าง PDF/เก็บไฟล์ให้สำเร็จก่อน แล้วจึงเปลี่ยนสถานะเป็น Final/Approved
- ไม่เกิดสถานะอนุมัติปลอมแล้ว rollback ภายหลัง
- แก้ API error handling ให้คืนข้อความจาก httpError จริง แทน Internal server error ทุกกรณี
- แยกข้อความ Google Drive ยังไม่เชื่อม / ต้องเชื่อมใหม่ / Worker Secret ไม่ครบ / upload fail / font fail
- ตัด query company_assets ที่ไม่ถูกใช้จากขั้นสร้าง PDF เพื่อลดจุดพังจาก schema เก่า
- Approval button ใช้ silent mutation status เพื่อไม่ให้ toast ทั่วไป "บันทึกไม่สำเร็จ" บัง error จริง
- timeout การสร้าง PDF เป็น 60 วินาที
- cache bust app.js เป็น P8.21.0
- runtime version เป็น 1.0-P8.21
