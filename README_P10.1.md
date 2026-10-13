# Nakna P10.1 — Attendance UX correction

**ฐานที่ต้องมี:** P10.0 Product UI บนระบบ P9.40 (โปรดตรวจว่า `/ui/p10.js` ถูกใช้อยู่)

## จุดที่แก้
- มือถือ: หน้าเวลาเข้างานไม่ขยายบัตรพนักงานเป็นแถว 10 ช่องของตารางใหญ่แล้ว
- สรุปรายพนักงานยุบเก็บเป็นค่าเริ่มต้น เปิดเพื่อดูรายการย่อ และแตะชื่อเพื่อดูข้อมูลทั้งหมด
- รายชื่อเวลาเข้างานแสดงเป็นรายการสั้น พร้อมสถานะตามผลจริง; รายวันมีเวลาเข้า–ออกและปุ่มดูพิกัดเดิม
- ตารางวัน × พนักงานยังอยู่ครบ แต่มือถือเปิดเมื่อกด “ดูตารางแบบละเอียดทุกวัน” เพื่อไม่ซ้อนกับรายการย่อ
- Desktop ยังคงตารางละเอียด CSV และตัวกรองเดิม
- Header เปลี่ยนเป็นพื้นขาวทึบ ป้องกันข้อความด้านหลังทะลุขณะเลื่อน
- วันที่ไม่มีตารางงานจะแสดงหมายเหตุบริบทหากข้อมูล `is_workday` รายงานว่าไม่มีตารางงานทั้งหมด
- คงปุ่ม วัน/สัปดาห์/เดือน/ช่วงวัน, กรองชื่อ แผนก สถานะ, ดูรายละเอียด GPS และ Export CSV ทุกปุ่ม

## ไฟล์ที่ต้องวางทับ / เพิ่ม

```text
public/app.js                  (ทับ)
public/index.html              (ทับ)
public/ui/p10.js               (ทับ)
public/ui/p10-attendance.css   (เพิ่มใหม่)
```

**ห้ามลบ `public/ui/p10.css`, `public/styles.css` หรือไฟล์เดิมอื่นใด** — CSS ใหม่เป็น override เฉพาะหน้าการเข้าออกงาน ไม่ใช่แทน `p10.css`.

## วิธี Deploy
1. สำรอง Branch ล่าสุดก่อนแก้
2. วางไฟล์ใน ZIP ตามตำแหน่งต้นไม้ด้านบน
3. ตรวจ `node --check public/app.js` และ `node --check public/ui/p10.js`
4. `npm run check` ที่ root ของ repo (ถ้ามีสคริปต์นี้ใน package)
5. `npx wrangler deploy`
6. เปิด LINE Browser ใหม่ (แนะนำปิดหน้าเว็บค้างก่อน) ตรวจ sidebar ต้องแสดง `UI P10.1`

## การทดสอบออฟไลน์
- Chromium widths 320/390/430/768/1440: ทดสอบผ่านการแสดงตาราง ไม่ล้นจอ และการเปิด–ปิดส่วนรายละเอียด
- HTML ตาราง original คงสองตารางเดิมไว้ (`attendance-person-summary-table`, `team-worklog-matrix`)
- ไม่แก้ endpoint, request payload, authentication, business logic, SQL, migration หรือ server source
- Mock 8 employees/1 day with present/late/leave/missing; **ไม่ใช่การทดสอบ D1/LINE จริง**

## ข้อจำกัด
- ไม่รับรองพฤติกรรม Safari/LINE WebView ทุกเวอร์ชันจาก Chromium อย่างเดียว
- หากมีข้อมูล 100+ พนักงาน/หลายเดือน ต้องทดสอบปริมาณข้อมูลบน staging ก่อนใช้ production
- ไม่แก้ปัญหา latency ของ API หรือความถูกต้องของข้อมูล backend

## Rollback
ใช้ `public/app.js`, `public/index.html`, `public/ui/p10.js` จาก P10.0 เดิมทับกลับ ลบ `public/ui/p10-attendance.css` ที่เพิ่ม แล้ว deploy อีกครั้ง
