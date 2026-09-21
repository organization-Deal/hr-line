# P8.19 Test Result

- `npm run check` — PASS
- `npm run audit` — PASS
- `npm run migration:smoke` — PASS
- Fresh migrations 0001 → 0026 — PASS
- No new migration in this patch

## Smoke test หลัง Deploy
1. ออกเอกสาร > รับรองการทำงาน > สร้าง Draft
2. Modal ปิดแล้ว Counter ต้องเปลี่ยนเป็น เอกสารทั้งหมด 1 / Draft 1 / รออนุมัติ 1
3. Action Center ต้องมีเอกสารที่เพิ่งสร้าง พร้อมปุ่ม ส่งกลับ / อนุมัติ
4. ส่วน “เอกสารพนักงาน” ต้องมี Draft เดียวกัน แม้ยังไม่มี PDF
5. กด Refresh หน้าแล้วข้อมูลต้องยังอยู่
6. เมื่อ Approve แล้วจึงสร้าง PDF/Drive ตาม Workflow
