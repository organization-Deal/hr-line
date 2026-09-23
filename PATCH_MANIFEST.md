# Nakna P9.07 — Payroll Period Edit / Delete

Base: P9.06 Payroll Period Create Fix (รวม P9.04 Mobile Payroll + P9.05 LINE Owner/HR Access)

## REPLACE
- `src/index.js`
- `public/app.js`
- `public/index.html`

## Migration
- ไม่มี Migration ใหม่
- ต้องมี `0032_payroll_custom_cycle.sql` จาก P9.03 อยู่แล้ว

## เพิ่มอะไร
- รอบ Payroll สถานะ `Draft` / `รอตรวจ` มีปุ่ม `แก้ไขรอบ`
- แก้ `เดือน Payroll / วันที่จ่าย / วันเริ่มรอบ / วันสิ้นสุดรอบ` แล้วคำนวณใหม่ได้
- เมื่อแก้รอบที่อยู่ `รอตรวจ` ระบบจะกลับเป็น `Draft` เพื่อให้ตรวจใหม่ ลดความเสี่ยงอนุมัติข้อมูลเก่า
- รอบ Payroll สถานะ `Draft` / `รอตรวจ` มีปุ่ม `ลบรอบ`
- ลบแล้วลบ Preview / adjustment ของรอบนั้นและสร้างรอบใหม่เดือนเดิมได้ทันที
- บันทึก Audit Log ก่อนลบรอบ
- ไม่อนุญาตแก้/ลบ `Locked` หรือ `Published`
- ไม่อนุญาตลบรอบที่มี Payslip แล้ว
- ตรวจ period key ซ้ำและช่วงวันที่ overlap ตอนแก้
- cache bust `P9.07.0`

## Flow
สร้างรอบ → พบว่าช่วงวันผิด → `แก้ไขรอบ` → บันทึกและคำนวณใหม่

หรือ

สร้างรอบ → ต้องการเริ่มใหม่ → `ลบรอบ` → ยืนยัน → สร้างรอบใหม่ได้ทันที
