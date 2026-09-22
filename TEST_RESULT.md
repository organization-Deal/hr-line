# P8.22 Test Result

- `npm run check` — PASS
- `npm run audit` — PASS
- `npm run migration:smoke` — PASS
- Migration chain `0001 → 0026` — PASS
- Approval → Final → LINE delivery path — static gate PASS
- Manual resend endpoint — static gate PASS
- Employee portal keyword (`เอกสาร`, `เอกสารของฉัน`) — present
- Delivery evidence events (`line_sent`, `delivery_failed`, `viewed`) — present

Production test ที่ต้องทำหลัง Deploy:
1. กด `ส่งให้พนักงาน` กับเอกสาร Final ใบเดิม
2. ตรวจ LINE ของพนักงานได้รับ Card
3. กดเปิด `เอกสารของฉัน`
4. เปิด PDF แล้วตรวจว่า HR เห็น `พนักงานเปิดแล้ว`
5. ทดสอบเอกสารที่ต้องรับทราบ และกด `รับทราบ / ชี้แจง`
