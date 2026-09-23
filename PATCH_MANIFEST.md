# Nakna P9.04 — Payroll Mobile Redesign

Base: P9.03 Custom Payroll Cycle

## REPLACE
- `public/app.js`
- `public/styles.css`

## ADD / RUN
- ไม่มี migration ใหม่

## สิ่งที่เปลี่ยน
- ปรับหน้า Payroll บนมือถือใหม่ให้ดูง่ายขึ้น
- จากเดิมที่ตารางใหญ่เลื่อนยาก เปลี่ยนให้มือถือใช้ `Employee Cards`
- แต่ละการ์ดแสดง: ชื่อพนักงาน, แผนก/ตำแหน่ง, ฐานเงินเดือน, เงินเดือนรอบนี้, รายได้แปรผัน, รายการหัก, รับสุทธิ, Employer Cost และบัญชีรับเงิน
- ช่อง `Commission / KPI / Incentive / Bonus / อื่น ๆ / หักอื่น` ยังแก้ได้จากมือถือโดยตรง
- Search เดิมใช้ได้กับทั้งตาราง Desktop และการ์ด Mobile
- Desktop ยังเก็บตารางเต็มแบบเดิมไว้ ไม่กระทบ workflow ฝั่งคอม
- ปรับ action buttons, toolbar, hint และ spacing บนจอเล็กให้อ่านง่ายขึ้น
- Validation / Summary / Period detail จัดลำดับใหม่ให้เหมาะกับมือถือ

## วิธีอัป
1. Backup โปรเจกต์เดิม
2. Replace 2 ไฟล์ตามรายการด้านบน
3. Deploy
4. Hard refresh บนมือถืออีกครั้ง
