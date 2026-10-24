# P10.48 Payroll loading
ลงทับ P10.47 และเผยแพร่ทั้ง src/index.js (Worker backend) กับ public/ จากนั้น Ctrl+Shift+R ไม่ต้องรัน migration เพิ่ม

- Payroll แสดง overview และเริ่มโหลดรอบโดยไม่รอ /api/employees จบ
- ตรวจบริษัทก่อนใช้ผลโหลดทั้งสองรายการ
- ลดการ render รายละเอียดรอบซ้ำ
- Cold initialization ตรวจคอลัมน์ Payroll ผ่าน PRAGMA batch แทนลอง ALTER 23 คำสั่งที่มีอยู่แล้ว ใช้ ALTER เฉพาะคอลัมน์ที่ขาด รองรับ concurrent worker และไม่ซ่อน database error ที่ยังแก้ไม่ได้
- เตรียม default settings/rules/components 6 รายการใน batch เดียว ค่าธุรกิจและสูตรเดิมทั้งหมด

ผ่าน npm run check, test-release-version, test-p10.48-payroll-loading, test-p10.46-payroll-guide และ browser workflow P10.46
ทดสอบ simulated slow employees, existing/missing schema, retry หลัง DB failure และ company switch ไม่มีการส่ง LINE หรือ deploy ระหว่างทดสอบ
ยังไม่ได้วัด latency บน production จึงไม่มีคำรับรองเป็นจำนวนวินาที; initialization อื่นและ network/DB latency ยังมีผล
