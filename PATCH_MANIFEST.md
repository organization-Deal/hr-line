# Nakna P8.20 — Approval Button Fix

Base: P8.19

## REPLACE
- public/app.js
- public/index.html

## Migration
- ไม่มี migration ใหม่

## Fix
- ปุ่ม อนุมัติ / ส่งกลับ ใน Action Center เรียกฟังก์ชันไม่ได้ เพราะ app.js รันแบบ ES module แต่ onclick อ้างฟังก์ชัน local ที่ไม่อยู่บน window
- expose approve/reject/quick HR case ให้ window และเปลี่ยน onclick ให้เรียก window.* ชัดเจน
- ปุ่มอนุมัติแสดงสถานะ `กำลังสร้าง PDF…` ระหว่างรอ Google Drive
- เพิ่ม timeout การอนุมัติเป็น 45 วินาที และ Bulk approve เป็น 90 วินาที
- Error ตอนอนุมัติจะแสดงสาเหตุจริง เช่น Google Drive ยังไม่เชื่อม / PDF สร้างไม่สำเร็จ
- bump cache key เป็น P8.20.0
