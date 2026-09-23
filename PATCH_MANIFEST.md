# Nakna P9.09 — HR Dashboard Command Center

Base: P9.08.1 Fast LINE Startup Build Fix

## REPLACE
- `src/index.js`
- `public/app.js`
- `public/index.html`
- `public/styles.css`

## Migration
- ไม่มี Migration ใหม่

## เปลี่ยนอะไร
- ออกแบบ Dashboard ใหม่ให้เป็น HR Command Center และลดการ์ด Empty State ขนาดใหญ่
- เพิ่ม Quick Actions: เวลาเข้างาน / การลา / เอกสาร / Payroll / ประกาศ
- KPI บนสุดเปลี่ยนเป็นข้อมูลรายวัน: พนักงานทั้งหมด / เช็กอินแล้ว / ลา / ยังไม่เช็กอิน / มาสาย
- เพิ่ม Attendance Snapshot พร้อม progress + ตัวเลขมา/ลา/ยังไม่มา/สาย
- เพิ่ม Payroll Snapshot จากรอบล่าสุดแบบ query เบา ๆ ใน Dashboard API
- เพิ่ม Document Snapshot: รอ HR เซ็น / รอพนักงานเซ็น / Final
- Recruitment ปรับเป็น compact funnel
- Upcoming รวมวันเกิด + Probation + Contract ใน timeline เดียว
- Empty State ของ Dashboard ใช้ compact status แทน mascot ขนาดใหญ่ซ้ำ ๆ
- Mobile: Quick Actions เป็น horizontal scroll และ widgets ย่อให้เห็นข้อมูลมากขึ้นต่อหนึ่งหน้าจอ
- Frontend cache key: P9.09.0

## หมายเหตุ Performance
- Payroll / Document Dashboard metrics ใช้ query สรุปขนาดเล็กเท่านั้น
- ไม่โหลด Payroll page หรือ Document page ทั้งโมดูลตอนเปิด Dashboard
