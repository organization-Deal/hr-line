# P8.26 Test Result

- `npm run check` — PASS
- `npm run audit` — PASS
- `npm run migration:smoke` — PASS
- `npm run release:check` — PASS
- Fresh migration chain `0001 → 0030` — PASS
- P8.23 GPS diagnostic code preserved — PASS (static verification)

## ต้อง Smoke Test หลัง Deploy
1. สร้าง Draft เอกสาร Test
2. กด `ตรวจและลงนาม`
3. HR เซ็นด้วยนิ้ว หรือเลือก Saved Signature
4. ตรวจว่า PDF หลัง HR เซ็นถูกสร้างบน Drive
5. ตรวจว่า LINE พนักงานได้รับข้อความ `HR ลงนามแล้ว · รอลายเซ็นคุณ`
6. พนักงานเปิด PDF ที่ HR เซ็นแล้ว
7. พนักงานลงลายเซ็น
8. ตรวจว่า Final PDF มีลายเซ็น 2 ฝ่าย
9. HR Dashboard ต้องขึ้น `Final · ลงนามครบ 2 ฝ่าย`
10. Employee Portal ต้องเปิด `Final PDF` ได้

Production LINE/Google Drive/iPhone runtime ยังต้องยืนยันบน environment จริง
