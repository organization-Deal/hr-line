# P9.01 Test Result

- `node --check public/app.js` — PASS
- ตรวจ event handlers สำหรับ Search / Status filter — PASS (static)
- ตรวจ Salary Setup render เมื่อไม่มี Pay Period — PASS (static)
- ตรวจ Payroll Detail render เอา class `payroll-detail-empty` ออก — PASS (static)
- ไม่มี Backend/API schema change
- ไม่มี Migration ใหม่

## Smoke test หลัง Deploy
1. เปิด Payroll โดยยังไม่มีรอบเงินเดือน
2. ต้องเห็น KPI 4 ใบ: พนักงาน / ฐานเงินเดือน / บัญชี / ความพร้อม
3. ฝั่งซ้ายต้องเป็น Getting Started 3 ขั้น
4. ฝั่งขวาต้องเป็นตารางพนักงานเต็มพื้นที่ ไม่ใช่ card list แคบกลางหน้า
5. Search / Filter ต้องซ่อนแถวตามเงื่อนไข
6. กด `ตั้งค่า` ต้องเปิด Payroll Profile เดิม
7. สร้างรอบเงินเดือนแล้ว ต้องกลับไปใช้ Payroll Spreadsheet เดิมได้
