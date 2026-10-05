# Nakna P9.29 — Retro Attendance + Retro Leave

## สิ่งที่แก้

1. ปุ่ม `ลืมเช็กอิน / เช็กอินย้อนหลัง` ใน LINE Employee Menu
   - ย้าย 3 ปุ่ม Attendance เข้า child box เดียว เพื่อไม่ชน limit จำนวน component ของ LINE Flex เมื่อเปิด Face Verification
   - เพิ่ม fallback command `เช็กอินย้อนหลัง`, `ลืมเช็กอิน`
   - แก้ fallback postback `mode=retro` ที่เดิมตกกลับไปเป็น check-in ปกติ

2. ลาย้อนหลังอยู่ในฟอร์ม `ขอลางาน` เดิม
   - เลือกวันที่ที่ผ่านมาได้โดยไม่ต้องมีปุ่มเมนูใหม่
   - เมื่อเลือกวันย้อนหลัง จะแสดงช่องบังคับ `ทำไมไม่ได้ยื่นลาในวันนั้น`
   - ใช้ Approval / Evidence / Leave balance เดิมทั้งหมด
   - ข้ามกฎแจ้งล่วงหน้าเฉพาะคำขอย้อนหลัง แต่ยังต้อง HR อนุมัติ

3. สถานะ Attendance ไม่เหมารวมเป็น `ยังไม่เช็กอิน`
   - มีคำขอเช็กอินย้อนหลังค้าง -> `รออนุมัติเช็กอินย้อนหลัง`
   - มีใบลาค้าง -> `รออนุมัติลา`
   - มีลาย้อนหลังค้าง -> `รออนุมัติลาย้อนหลัง`
   - ลาย้อนหลังอนุมัติแล้ว -> `ลาย้อนหลัง · อนุมัติแล้ว`

## ไฟล์ที่เปลี่ยน

- `src/index.js`
- `public/app.js`
- `public/leave.html`
- `public/leave.js`
- `public/leave.css`
- `migrations/0037_leave_retroactive.sql`

## ติดตั้ง

```bash
npx wrangler d1 migrations apply DB --remote
npx wrangler deploy
```

หลัง deploy ให้พิมพ์ `เมนู` ใหม่ใน LINE และตรวจ marker `P9.29-RETRO-ATTENDANCE-LEAVE`.
