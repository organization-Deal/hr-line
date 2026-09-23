# Nakna P9.02 — Payroll Inline Edit + Bank Split

Base: P9.01 Payroll UX Refresh

## REPLACE
- `public/app.js`
- `public/index.html`
- `public/styles.css`

## Migration
- ไม่มี Migration ใหม่
- ใช้ฐานข้อมูลเดิมต่อได้

## เปลี่ยนอะไร
- คลิกที่ช่อง `ฐานเงินเดือน` ได้เลย ไม่ต้องกดปุ่ม `ตั้งค่า`
- แยกคอลัมน์ `ธนาคาร` ออกจาก `เลขบัญชี` ชัดเจน
- เพิ่ม Quick Edit Modal สำหรับแก้ฐานเงินเดือน / ธนาคาร / ชื่อบัญชี / เลขบัญชี
- เก็บปุ่ม `ดูเต็ม` ไว้สำหรับเข้า modal โปรไฟล์เงินเดือนฉบับเต็ม
- ปรับ hint / microcopy ให้เข้าใจว่าแก้ไขจากตารางได้ทันที
- เพิ่ม cache busting เป็น `P9.02.0`
