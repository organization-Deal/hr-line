# Nakna P9.35 — Mutation Performance Sweep

## เป้าหมาย
ลดเวลารอหลังการกด Save / Submit / Approve / Archive / ตั้งค่าต่าง ๆ โดยไม่โหลด HR ทั้งระบบใหม่ทุกครั้ง

P9.35 รวมการแก้ของ P9.34 ไว้แล้ว ดังนั้นถ้าระบบปัจจุบันอยู่ P9.33 สามารถข้าม P9.34 แล้วใช้ไฟล์ `public/app.js` จาก P9.35 ได้โดยตรง

## ไฟล์ที่แก้
- `public/app.js`

ไม่มี Migration ใหม่ และไม่เปลี่ยน backend ของ P9.33

## สิ่งที่แก้

### 1) เอา full `loadAll()` ออกจากงานประจำวัน
หลัง mutation จะ refresh เฉพาะโมดูลที่เกี่ยวข้องแทน เช่น
- พนักงาน / Invite / Work Location / ตารางงาน / วันหยุด
- Leave / Leave Policy / หลักฐานการลา
- Recruitment
- Learning / KPI / 1:1
- Rewards / Analytics
- Payroll
- Documents
- Broadcast / Wellness / Google Workspace / LINE Rich Menu
- Attendance Retro / HR Case

`loadAll()` เหลือเฉพาะ boot / เปลี่ยน workspace / flow ที่จำเป็นต้องโหลด workspace ทั้งชุดจริง ๆ

### 2) Optimistic / background refresh
หลาย action จะแสดงผลสำเร็จก่อน แล้ว sync รายการที่เกี่ยวข้องด้านหลัง ลดความรู้สึกว่าหน้าค้างหลัง Save

### 3) Settings concurrency
แก้ request pool ให้เริ่ม network request ตามจำนวน concurrency จริง ไม่สร้าง Promise ทั้งหมดก่อนเข้า pool

### 4) Payroll refresh
เพิ่ม `refreshPayrollSnapshot()` เพื่อโหลด Payroll overview + period detail แบบขนาน แทนการโหลดต่อกันหลายรอบ

### 5) Heavy external operations
Google / Gmail / LINE / PDF / Publish ยังต้องรอ external operation จริง แต่ follow-up read ที่ไม่จำเป็นถูกย้ายเป็น background เมื่อทำได้

### 6) Performance instrumentation
เก็บ timing ของ API ล่าสุดที่

```js
window.__NAKNA_API_TIMINGS
```

ถ้า request ใช้เวลา >= 1.5 วินาที Console จะแสดง

```text
[Nakna] slow API
```

## วิธีติดตั้ง
ถ้า Production ปัจจุบันคือ P9.33:

1. เปิดโฟลเดอร์ `public/` ใน repo
2. นำไฟล์ `public/app.js` จากแพตช์นี้ไปทับ `public/app.js` เดิม
3. **อย่าอัปไปทับ `app.js` ที่ root repo** เพราะ Wrangler ใช้ assets จาก `public/`
4. Deploy

```bash
npx wrangler deploy
```

## Test สำคัญหลัง Deploy
1. เพิ่ม / แก้ / ลบพนักงาน
2. สร้าง / ยกเลิก Invite
3. เพิ่ม / แก้ Work Location, ตารางงาน, วันหยุด
4. แก้สิทธิลา / สร้างใบลา / policy / evidence
5. Upload และ Archive เอกสารพนักงาน
6. Payroll: settings, profile, grid edit, adjustment, recalc, review, lock, publish
7. Recruitment: add candidate / hire
8. Learning / KPI / Rewards
9. Broadcast / Wellness / Google sync / LINE Rich Menu
10. ตรวจ Console ว่ามี `[Nakna] slow API` ตัวไหนบ่อย

## Expected behavior
- กด Save เรื่องเล็ก ๆ แล้วไม่ควรขึ้น banner “ข้อมูลบางส่วนยังมาไม่ครบ” เพราะโมดูลอื่น timeout
- UI ไม่ควรรอโหลด Dashboard ทั้งบริษัทใหม่หลัง action เล็ก ๆ
- Google / Gmail / LINE / PDF อาจยังมี latency จริงจากบริการภายนอก แต่หน้าไม่ควร reload โมดูลที่ไม่เกี่ยวข้องตามหลัง

## ขอบเขตการทดสอบ
แพตช์นี้ผ่าน static/syntax checks ในสภาพแวดล้อมทดสอบ แต่ยังต้องทดสอบ latency จริงกับ Cloudflare Worker, D1, Google และ LINE หลัง Deploy
