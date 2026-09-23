# P9.00 Test Result

## Automated gates
- `npm run check` — PASS
- `npm run audit` — PASS
- `npm run migration:smoke` — PASS
- `npm run release:check` — PASS
- Fresh migration chain `0001 → 0031` — PASS
- Existing DB upgrade simulation `0030 → 0031` with existing payroll settings/period preserved — PASS
- Payroll grid UPSERT key `(period_id, employee_id, source_key)` — PASS

## Smoke test หลัง Deploy
1. เปิด Payroll → ตั้ง Payroll Settings
2. ตั้งฐานเงินเดือนพนักงาน Test 1 คน + recurring component
3. สร้างรอบ Payroll Test
4. ใส่ Commission/Incentive ในตาราง
5. ตรวจ Gross / Tax / SSO / Net / Employer Cost
6. ดู Validation Center และ Employee Detail
7. ส่งตรวจ → Approve (ถ้า Maker–Checker เปิด) → Lock
8. Export Bank CSV + Accounting CSV
9. Generate/Publish Payslip → เปิดจากฝั่งพนักงาน
10. หากต้องแก้หลัง Lock ให้ทดสอบ Unlock พร้อมเหตุผลก่อนมี Payslip delivered

## ขอบเขตที่ต้องตรวจด้วยข้อมูลบริษัทจริง
- สูตรภาษี/ค่าลดหย่อนของพนักงานจริง
- Rule SSO ที่บริษัทใช้ในปีนั้น
- Bank file format เฉพาะธนาคาร (P9.00 ให้ CSV กลาง)
- Accounting mapping เข้าผังบัญชีจริง
