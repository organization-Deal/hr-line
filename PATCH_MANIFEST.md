# Nakna P9.01 — Payroll UX Refresh

Base: P9.00 Payroll Control Center

## REPLACE
- `public/app.js`
- `public/index.html`
- `public/styles.css`

## Migration
- ไม่มี Migration ใหม่
- ใช้ฐานข้อมูลเดิมหลัง `0031_payroll_control_center.sql`

## เปลี่ยนอะไร
- แก้หน้าตั้งต้น Payroll จาก card list เป็น table-first UX
- แก้ bug `payroll-detail-empty` ที่ทำให้ Salary Setup ถูกบีบ/จัดกึ่งกลางผิด layout
- KPI ตอนยังไม่มีรอบ เปลี่ยนเป็นความพร้อมของพนักงาน/ฐานเงินเดือน/บัญชีรับเงิน
- เพิ่ม Getting Started progress + checklist
- เพิ่มตารางตั้งค่า Payroll รายพนักงาน พร้อม Search และ Status filter
- แสดง Department / Position / Base salary / Tax / SSO / Bank / Readiness ในหน้าเดียว
- เพิ่มปุ่มไปยังพนักงานที่ยังตั้งค่าไม่ครบ
- ปรับ hierarchy / spacing / empty-state / desktop + mobile responsive
- bump frontend cache key เป็น `P9.01.0`
