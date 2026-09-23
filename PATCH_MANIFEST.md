# Nakna P9.08 — Fast LINE Startup

Base: P9.07 Payroll Period Manage

## REPLACE
- `src/index.js`
- `public/app.js`
- `public/index.html`

## Migration
- ไม่มี Migration ใหม่

## สิ่งที่แก้
- ปุ่ม Dashboard ที่สร้างใหม่จาก LINE ไม่ผ่าน flow เดิม `/auth/line/start -> 302 -> โหลดหน้าใหม่` แล้ว
- เปลี่ยนเป็นเปิดหน้า Nakna ครั้งเดียว แล้วแลก LINE one-time token ผ่าน `/api/public/line-session` ใน background
- `/api/public/line-session` ส่ง session cookie + ข้อมูล `/api/me` กลับมาใน request เดียว จึงไม่ต้องยิง `/api/me` ซ้ำใน LINE entry path
- เริ่ม auth/session request ก่อน bind event จำนวนมาก เพื่อลด critical-path startup
- เลื่อน Public LINE config และ Onboarding status ออกจาก first paint
- Dashboard first paint ยิง `/api/dashboard` เป็น request หลักก่อน แล้วค่อยโหลด Company Profile ภายหลัง
- Google Fonts เปลี่ยนเป็น non-blocking load เพื่อลดเวลาจอขาวใน LINE WebView
- เพิ่ม console timing `Nakna shell visible ...ms`
- Cache bust เป็น `P9.08.0`
- Worker release เป็น `P9.08-FAST-LINE-STARTUP`

## Compatibility
- ลิงก์ Dashboard เก่าที่สร้างก่อน P9.08 ยังเปิดได้ด้วย route เดิม แต่ยังใช้ redirect แบบเก่า
- หลัง Deploy ให้พิมพ์ `Dashboard` หรือ `เมนู` ใน LINE ใหม่ เพื่อให้ Bot สร้างลิงก์ P9.08 แบบเร็ว
