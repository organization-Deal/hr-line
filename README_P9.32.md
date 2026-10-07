# Nakna P9.32 — Subscription Fast Load & Package Refresh

แก้ 3 จุด:
1. หน้า Settings ไม่รอ API อื่น 7–8 ตัวก่อนแสดง Subscription อีกต่อไป
2. GET /api/subscription เป็น read-only fast path ไม่ทำ schema/default/usage snapshot writes ทุกครั้ง
3. หลังเปลี่ยนแพ็กเกจ หน้า UI อัปเดตจากผล POST ทันที ไม่เรียก refreshPhase5 ชุดใหญ่ซ้ำ

ถ้ายังอยู่ใน Trial แต่เลือกแพ็กเกจถัดไปแล้ว UI จะแสดงชื่อแพ็กเกจที่เลือกไว้ชัดเจน
ถ้า Trial/Subscription เดิมหมดอายุ แล้ว Primary Owner เลือกแพ็กเกจจริง ระบบจะเปลี่ยนสถานะเป็น active ตาม logic เดิมและ enrollment จะตรวจใหม่ทันที

ไฟล์ที่แก้:
- src/index.js
- public/app.js

ไม่มี migration ใหม่

ติดตั้ง:
1. วาง 2 ไฟล์ทับของเดิม
2. npx wrangler deploy
3. เปิด Settings > Subscription ใหม่
4. ตรวจว่า release จาก /health หรือเมนู LINE เป็น P9.32-SUBSCRIPTION-FAST-LOAD
