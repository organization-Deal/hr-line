# Nakna P9.13 — Payroll Flow & Clarity UX

Base: P9.12 Smart Action Feedback

## REPLACE
- `public/app.js`
- `public/index.html`
- `public/styles.css`

## Migration
- ไม่มี Migration ใหม่

## สิ่งที่เปลี่ยน
- เพิ่ม Payroll Stepper 5 ขั้น: เตรียมข้อมูล → ตรวจสอบ → อนุมัติ → ปิดการแก้ไข → ออกสลิป
- เหลือ Primary Action หลักเพียงปุ่มเดียวตามสถานะของรอบ
- ย้าย Edit / Delete / Recalculate / Bulk / Export ไปไว้ใน `เครื่องมือเพิ่มเติม`
- แสดงช่วงรอบจริงเด่นขึ้น พร้อมปุ่มรอบก่อน / รอบถัดไป
- เพิ่ม Readiness สรุปจำนวนพนักงานที่พร้อม และสิ่งที่ยังขาด
- Validation ถ้าไม่มีปัญหาจะย่อเป็นแถบเล็ก ไม่กินพื้นที่
- เปลี่ยนศัพท์หลักเป็นภาษาไทยที่อ่านง่าย: รายได้รวมก่อนหัก / ยอดโอนสุทธิ / ต้นทุนบริษัท
- แยกช่อง `กรอกเอง` กับ `ระบบคำนวณ` ให้เห็นชัดใน Grid
- Net / Attendance / Tax กดดูที่มาของตัวเลขได้
- Employee Payroll Detail เพิ่ม Source Breakdown และรายการที่ HR ปรับในรอบ
- Mobile Payroll Card ย่อให้เห็น Gross / หัก / Net ก่อน แล้วค่อยกางรายละเอียด
- เพิ่ม Final Check ก่อนปิดรอบ แสดงยอดรวม ความพร้อม และจำนวนบัญชีธนาคาร
- ถ้ายังมี blocking exception จะกดยืนยันปิดรอบไม่ได้
- Frontend cache version `P9.13.0`
