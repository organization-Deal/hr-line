# Nakna HR — P9.00 Payroll Control Center

ฐานที่ใช้: P8.27 (รวม Document Signature Workflow และ GPS reliability patch เดิมไว้แล้ว)

## ไฟล์ที่ต้อง REPLACE
- `src/index.js`
- `public/app.js`
- `public/index.html`
- `public/styles.css`

## ไฟล์ที่ต้อง ADD / RUN
- `migrations/0031_payroll_control_center.sql`

## ลำดับ Deploy
1. Backup Cloudflare D1 ก่อน
2. Run migration `0031_payroll_control_center.sql`
3. Replace 4 ไฟล์ด้านบน
4. Deploy Worker / Pages ตาม workflow เดิม
5. Hard refresh หน้าเว็บ เพื่อให้โหลด `P9.00.0`

## ฟีเจอร์หลักที่เพิ่ม
- Spreadsheet-like Payroll Grid: 1 แถวต่อพนักงาน, ชื่ออยู่ฝั่งซ้าย, รายรับ/รายการหัก/ผลลัพธ์เป็นคอลัมน์
- Inline Commission / Incentive / Bonus / รายได้อื่น / รายการหักอื่น พร้อมคำนวณใหม่
- Custom payroll components และ recurring pay items รายพนักงาน
- Payroll Validation / Exception Center
- Previous-month Net variance warning
- Employer cost + Employer Social Security
- YTD Gross / Tax / SSO
- Maker–Checker approval (เปิด/ปิดได้)
- Lock / Unlock พร้อมเหตุผลและ Timeline
- Bulk adjustment หลายพนักงาน
- Employee Payroll Detail drawer
- Bank CSV export
- Accounting Journal CSV export
- Attendance / Commission cut-off settings
- Payroll audit timeline
- Payslip แสดง recurring component lines

## หมายเหตุ
- `50 ทวิ` และ compliance/export รูปแบบหน่วยงาน/ธนาคารเฉพาะราย ยังควรตรวจตามข้อกำหนดจริงก่อนเปิด Production
- Formula Builder ขั้นสูง, loan schedule และ off-cycle payroll เต็มรูปแบบยังไม่รวมใน P9.00 นี้
