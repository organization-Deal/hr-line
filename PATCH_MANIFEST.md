# Nakna P9.03 — Company-specific Payroll Cycle

Base: P9.02 Payroll Inline Edit + Bank Split

## REPLACE
- `src/index.js`
- `public/app.js`
- `public/index.html`
- `public/styles.css`

## ADD / RUN
- `migrations/0032_payroll_custom_cycle.sql`

## สิ่งที่เปลี่ยน
- แต่ละบริษัทกำหนดรอบเงินเดือนของตัวเองได้
- ตั้ง Default ได้เป็น `วันเริ่ม + เดือนอ้างอิง` และ `วันสิ้นสุด + เดือนอ้างอิง`
- Preset: `1 → สิ้นเดือน`, `26 เดือนก่อน → 25 เดือนนี้`, `25 เดือนก่อน → 25 เดือนนี้`
- ตอนสร้างรอบ HR แก้ `เริ่มคิดรอบ / สิ้นสุดรอบ` เฉพาะรอบได้
- ระบบกัน Payroll period ที่มีช่วงวันทับกัน
- Attendance / Leave / Prorate ใช้ `period_start → period_end` จริง
- Sidebar และหัว Payroll แสดงช่วงวันที่จริงของรอบ
- ตาราง Payroll เพิ่ม Start date, รูปแบบเต็มเดือน/Prorate, วันคิดเงิน, KPI, ธนาคาร, เลขบัญชี, ชื่อบัญชี
- KPI แก้จาก Grid ได้โดยตรงและแสดงใน Payslip แยกจากรายได้อื่น
- Frontend cache version `P9.03.0`

## ตั้งค่าบริษัทตัวอย่าง 25/01/2026 → 25/02/2026
ไปที่ `ตั้งค่า Payroll` แล้วเลือก Preset `25 เดือนก่อน → 25 เดือนนี้` หนึ่งครั้ง จากนั้นรอบ Payroll เดือน 2026-02 จะสร้างช่วง `2026-01-25 → 2026-02-25` อัตโนมัติ
