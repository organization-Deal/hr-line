# Nakna HR P8.22 — Employee Document Delivery

Base: P8.21

## REPLACE
- `src/index.js`
- `public/app.js`
- `public/index.html`

## Migration
- ไม่มี Migration ใหม่

## สิ่งที่เพิ่ม
- เอกสาร Final ที่ `visibility=employee` จะ Push LINE ให้พนักงานอัตโนมัติหลัง HR อนุมัติ ไม่จำกัดเฉพาะเอกสารที่ต้องกดรับทราบ
- พนักงานกดจาก LINE เข้า `เอกสารของฉัน` และเปิด PDF ได้
- เอกสารที่ต้องรับทราบยังคงมีปุ่ม `รับทราบ / ชี้แจง`
- HR เห็นสถานะ `ส่ง LINE แล้ว / พนักงานเปิดแล้ว / ยังไม่เชื่อม LINE / ส่งไม่สำเร็จ`
- เพิ่มปุ่ม `ส่งให้พนักงาน` / `ส่งอีกครั้ง` ในรายการเอกสาร
- เพิ่ม API `POST /api/employee-documents/:id/send` สำหรับส่ง/ส่งซ้ำ
- เก็บ Evidence Event `line_sent`, `delivery_failed`, `viewed`
- ถ้าพนักงานยังไม่เชื่อม LINE การอนุมัติ PDF ยังสำเร็จ และ HR สามารถส่งใหม่ภายหลังได้
- เอกสาร Upload ที่ตั้ง Visibility เป็น Employee จะพยายามส่ง LINE อัตโนมัติด้วย
- Cache bust: `P8.22.0`
