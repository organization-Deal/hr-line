# NAKNA P10.3 — Leave Form 500 Hotfix

## สาเหตุที่ยืนยันจากโค้ด
1. `getEmployeeLeaveProfile()` มี SQL ที่อ้าง `dec.nickname`, `du.name`, `l.id` โดยไม่มี JOIN/alias ของตัวแปรเหล่านี้ใน Query นั้น โค้ด P9.40 ออก SQL error แล้วหน้าขอลาขึ้น "Internal server error" ก่อนกรอกฟอร์ม
2. `leaveEligibility()` ใช้ `Number(null)===0` ทำให้พนักงานที่ไม่ได้ตั้งสิทธิ์ลารายคน (`leave_access_override = NULL`) ถูกตีความว่า HR ล็อกสิทธิ์ลา ทั้งที่ต้องไปอ่านนโยบายบริษัท
3. เมื่อถูกล็อกสิทธิ์ ฟอร์ม API เคยอ่าน `lock_reason` แทน `locked_reason` จากโปรไฟล์ จึงไม่แสดงเหตุผลจริง

## แก้โค้ดอะไร
- เลือกเฉพาะข้อมูลพนักงาน + ผู้อนุมัติที่กำหนดจาก `employees` และ `clients` ใน `getEmployeeLeaveProfile()` โดยไม่อ้างตารางใบลาที่ไม่มีใน Query
- แยก `NULL` (ใช้นโยบายบริษัท) จาก `0` (HR ล็อก) และ `1` (HR เปิดสิทธิ์รายคน)
- ส่งข้อความเหตุผลที่สิทธิ์ถูกล็อกกลับไปใน `lock_reason` ที่ UI เดิมรองรับ
- ไม่เปลี่ยน URL, API schema, LINE, วันที่ลา, การอนุมัติ, ฐานข้อมูล, ฟอนต์ หรือ Frontend

## การติดตั้ง
1. ใช้ฐาน **src/index.js P9.40** ที่ใช้กับ P10.x Frontend; สำรองไฟล์ปัจจุบันก่อน
2. วางไฟล์ `src/index.js` จาก ZIP ทับเฉพาะไฟล์ตำแหน่งนี้ ไม่ทับ `index.js` ที่ Root
3. ถ้ามีการแก้ `src/index.js` เพิ่มหลัง P9.40 โดยทีมแล้ว ห้ามทับทั้งไฟล์ ให้ใช้ `PATCH_P10.3.diff` เพื่อรวมเฉพาะ 3 จุด และตรวจ conflict
4. รัน `npm run check` และ `npx wrangler deploy` (หรือ CI เดิม)
5. เปิดเมนูขอลาจาก LINE ใหม่และตรวจว่าเห็นสิทธิ์ลา เลือกลา และส่งคำขอทดสอบได้

**ไม่ต้องรัน Migration เพิ่ม** และไม่ได้แก้ข้อมูลประวัติเดิม

## QA / Regression
- `node --check src/index.js` ผ่าน
- `node --no-warnings tests/test-public-leave-form.mjs src/index.js`: **9/9 ผ่าน** กับ SQLite ในเครื่อง
- ทดสอบซ้ำว่า SQL ก่อนแก้ล้มด้วย undefined table aliases จริง และหลังแก้ GET ฟอร์มผ่านด้วย mock session
- ทดสอบจำนวนวันอนุมัติ/รอ, สิทธิ์รายบุคคล NULL/0/1, พนักงานทดลองงาน และ Token หมดอายุ
- ยังไม่ทดสอบกับ D1/LINE Production และยังไม่ได้ Deploy ให้ผู้ใช้

## แนวทางตรวจถ้ายังมี 500
ตรวจ Cloudflare Workers Logs (หรือรัน `npx wrangler tail`) แล้วจับ error เฉพาะ request GET `/api/public/leave/<token>` พร้อมเวลาและ SQL error เท่านั้น **อย่าแชร์ token หรือข้อมูลบุคคลของพนักงาน** เพราะอาจพบปัญหาโครงสร้าง D1 อื่นร่วมด้วย
