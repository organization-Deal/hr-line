# Nakna Recruitment — เลือกหลายอีเมล / คัดออก / ลบออกจากคิว (กู้คืนได้)

ต่อยอดบน `Nakna-Recruitment-Screening-CHANGED-ONLY.zip` ที่ส่งก่อนหน้านี้

## ผลลัพธ์

- Checkbox ในแต่ละรายการ + เลือกทั้งหมดที่แสดง (ครั้งละไม่เกิน 50)
- ปุ่ม `คัดออกที่เลือก`: เปลี่ยนสถานะเป็น rejected ผ่าน API โดย **ไม่ลบข้อมูลต้นฉบับ**
- ปุ่ม `ลบออกจากคิว`: archive แบบย้อนกลับได้; ไม่แสดงในตัวกรองปกติ
- ตัวกรอง `ลบจากคิว (กู้คืนได้)` + `กู้คืนที่เลือก` และปุ่มกู้คืนทีละรายการ
- มี Confirmation ก่อนทำหลายรายการ; บันทึก Audit Log
- ไม่อนุญาต archive/reject รายการที่ผ่านการรับเป็น Candidate แล้ว
- ไม่ลบอีเมลจาก Gmail และไม่ลบ Candidate ที่เคยสร้างไว้
- ไม่มีการเปลี่ยนการ Sync Gmail / Pipeline / Google OAuth

## ไฟล์เปลี่ยน

- `src/index.js`
- `public/app.js`
- `public/index.html`
- `public/ui/nk-recruitment-screening.css`
- `migrations/0040_recruitment_screening_archives.sql` (เพิ่ม)
- `scripts/verify-screening-bulk.mjs` (เพิ่ม)

## Deploy

**ตรวจ Diff ก่อน Merge**: ไฟล์อิงชุด Screening V1 ที่เคยส่งไป และอาจไม่รวม Commit ใหม่ที่เกิดขึ้นทีหลัง หาก Repo ปัจจุบันมีการแก้ใหม่ให้ใช้ `recruitment-screening-bulk.patch` แบบตรวจ context หรือ merge เฉพาะจุด แทนการวางทับไฟล์ใหญ่ทั้งไฟล์

```
node scripts/verify-screening-bulk.mjs
npm run check
npx wrangler d1 migrations apply DB --remote
npx wrangler deploy
```

ตรวจว่ามี `0039_recruitment_screening.sql` ใน Repo อยู่ก่อนเสมอ เพราะ 0040 ต่อเนื่องจากระบบ Screening; ห้ามลบหรือ Reset D1 ข้อมูล Production

## ทดสอบใน Production (โดยใช้ Inbox ทดสอบ)

1. เปิด Recruitment > คิวคัดกรองอีเมล
2. เลือกอีเมลทั่วไป 2–3 รายการด้วย Checkbox
3. กด `คัดออกที่เลือก` -> รายการต้องหายจาก `ยังไม่ตัดสินใจ` ไปอยู่ `คัดออกแล้ว`
4. เลือกอีเมลอีกหนึ่งรายการ -> กด `ลบออกจากคิว` -> ต้องหายจากตัวกรองปกติ
5. เปิดตัวกรอง `ลบจากคิว (กู้คืนได้)` -> ติ๊กแล้วกด `กู้คืนที่เลือก`
6. ตรวจว่ารายการกลับเข้าคิวพร้อมสถานะเดิม
7. ตรวจว่าข้อมูล Candidate จริงและข้อความใน Gmail ไม่ถูกลบ
8. ทดสอบล็อกอิน Viewer หรือพนักงานธรรมดา: ไม่สามารถเรียก bulk API ได้ (403)

**หมายเหตุ:** การทดสอบที่รันในเครื่องเป็น syntax, logic แบบ mock และ SQLite migration; ยังไม่ได้ทดสอบผ่าน OAuth/Production จริงและไม่ได้แก้ฐานข้อมูลออนไลน์
