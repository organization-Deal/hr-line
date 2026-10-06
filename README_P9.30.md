# Nakna P9.30 — Leave Schema Hotfix

## ติดตั้ง

ใช้ต่อจาก P9.29 ที่ส่งในแชตนี้ สำรอง `src/index.js` เดิมก่อน แล้วนำ
`src/index.js` ในแพ็กนี้ไปวางทับตำแหน่งเดิมของโปรเจกต์:

```bash
npx wrangler deploy
```

ไฟล์ระบบที่เปลี่ยนมีเพียง `src/index.js` ไม่ต้องทับ public/, ไม่ต้องเปลี่ยน
wrangler.jsonc, ไม่ต้องเพิ่ม secret และไม่มีไฟล์ SQL migration ใหม่ในแพ็กนี้
โฟลเดอร์ scripts และเอกสารเป็นชุดทดสอบ/คำอธิบาย ไม่จำเป็นสำหรับการ Deploy

หลัง Deploy ให้เปิด “ขอลางาน” ผ่าน LINE หรือกดส่งแบบฟอร์มเดิมอีกครั้ง
เมื่อ token ยังใช้ได้ ตัวแก้จะตรวจและเติมช่องข้อมูลก่อนบันทึก ไม่ต้องกรอกวันลา
ปลอม ไม่ต้องเปลี่ยนวันที่เป็นย้อนหลัง และไม่ต้องลบฐานข้อมูล
หากลิงก์หมดอายุให้เปิดปุ่มขอลางานใหม่จาก LINE

## สาเหตุที่ยืนยันจากโค้ดและการจำลองข้อผิดพลาด

P9.29 เขียน `is_retroactive` และ `retro_reason` ใน INSERT ของใบลาทุกชนิด
แต่ฐานข้อมูลที่ยังไม่ได้ใช้ 0037 ไม่มีสองช่องนี้ ตัวตรวจ schema เดิมตรวจเฉพาะ
ตาราง/คอลัมน์ของรุ่นเก่า จึงไม่ป้องกันข้อผิดพลาดนี้ แม้พนักงานจะลาวันปัจจุบัน
หรือวันอนาคต การ INSERT ก็ล้มเหลวก่อนมีใบลาใหม่บันทึก

## การแก้ใน P9.30

- ตรวจ `PRAGMA table_info(leave_requests)` แล้วเพิ่มเฉพาะช่องที่ยังขาด:
  `is_retroactive INTEGER NOT NULL DEFAULT 0` และ `retro_reason TEXT`
- เพิ่ม index แบบ IF NOT EXISTS ตาม 0037 ไม่มี DROP/DELETE/rebuild ตาราง
- ใช้ guard ทั้งตอนเปิดฟอร์มที่ยืนยัน token แล้ว, ก่อน INSERT ในฟังก์ชัน
  createLeaveRequest ที่ทุกช่องทางใช้ร่วมกัน และก่อนอ่านประวัติการลาผ่าน LINE
- ใช้ Promise ร่วมสำหรับ request ที่มาพร้อมกัน และแยก cache ตาม DB binding
  ยอมรับเฉพาะ duplicate-column race ที่ตรวจแล้วว่าคอลัมน์มีอยู่จริง
- ถ้า D1 มีปัญหาอื่น ไม่แอบบันทึกว่าซ่อมสำเร็จ ไม่ลดเงื่อนไขอนุมัติ และไม่มี
  retry INSERT อัตโนมัติที่อาจทำใบลาซ้ำ; การเตรียม schema ล้มเหลวใช้รหัส
  `LEAVE_SCHEMA_NOT_READY` และเปิดให้ลองใหม่ได้
- ไม่เปลี่ยนยอดสิทธิ์ นโยบายหลักฐาน วันลาเดิม ไฟล์หลักฐาน ผู้อนุมัติ Payroll
  เมนูเช็กอินย้อนหลัง หรือสรุป HR 13:00

## การประสาน Migration 0037

หาก DB มีตาราง `d1_migrations` ตามค่าเริ่มต้นของ Wrangler จะบันทึกเฉพาะ
`0037_leave_retroactive.sql` เมื่อยืนยันแล้วว่าช่องข้อมูลและ index ครบจริง
ไม่เปลี่ยน record ของ migration อื่น และไม่เปลี่ยน applied_at ที่มีอยู่เดิม
การบันทึกนี้ทำให้การใช้ migrations apply ครั้งต่อไปไม่เพิ่มสองคอลัมน์ซ้ำ

หากไม่มี journal นี้ ตัวแก้จะไม่สร้าง journal ใหม่เอง; ระบบลายังใช้ได้ แต่ก่อน
นำ CLI migrations มาใช้ครั้งแรกต้องปรับประวัติ migration ให้ตรงกับ schema
ที่มีอยู่ ห้ามรัน SQL ALTER ของ 0037 ซ้ำโดยไม่ตรวจคอลัมน์ก่อน หากตั้งค่า
migrations_table เป็นชื่ออื่น ต้องประสาน journal ของชื่อนั้นด้วยตนเอง
(ไฟล์ wrangler.jsonc ฐานในแชตนี้ไม่ได้กำหนดชื่อ journal อื่น)

ไม่ควร Deploy/รัน migration ของ 0037 พร้อมกันระหว่างซ่อม ให้ Deploy แพ็กนี้
ก่อน แล้วเปิดฟอร์มลาหนึ่งครั้ง หลังจากนั้นจึงตรวจประวัติ migration ตามต้องการ

## วิธีตรวจหลัง Deploy

เปิด `/api/health` ของ Worker ต้องพบ release:
`P9.30-LEAVE-SCHEMA-HOTFIX`

ทดลองใบลาวันอนาคต 1 วัน: ต้องได้เลข LV และสถานะรออนุมัติ ไม่ใช่อนุมัติเอง
ทดลองวันที่ย้อนหลัง: ยังต้องใส่เหตุผลที่ไม่ได้ยื่นในวันนั้นและรอผู้อนุมัติเดิม
ให้ HR ตรวจว่าใบลาปรากฏในคิวและยอดสิทธิ์จองถูกต้อง

หากใช้ CLI อยู่แล้ว สามารถตรวจ schema แบบอ่านอย่างเดียวได้:

```bash
npx wrangler d1 execute DB --remote --command="PRAGMA table_info(leave_requests);"
npx wrangler d1 migrations list DB --remote
```

Log เมื่อมีการเติมช่อง: `leave_retro_schema_repaired`
Log เมื่อ schema ซ่อมไม่สำเร็จ: `leave_retro_schema_repair_failed`
Log เฉพาะ journal ยังไม่ประสาน: `leave_retro_migration_journal_pending`

## ผลทดสอบและข้อจำกัด

- `npm run check` ผ่าน (syntax ของ Worker และ JavaScript หน้าเว็บตาม package.json)
- ชุดทดสอบการลา P9.30 ผ่าน 30/30 รวม reproduction P9.29 ล้มเหลวตรงกับภาพ
- ชุด regression HR daily ผ่าน 26/26; คัดลอกชุด P9.28 แล้วปรับเฉพาะ
  assertion หมายเลขเวอร์ชันให้ตรวจ release ปัจจุบัน
- ทดสอบ actual Worker handlers ใน Node VM กับ SQLite จริงและข้อมูลสังเคราะห์
  ผ่าน adapter จำลอง D1 ไม่มีการเรียก LINE หรือเขียนฐาน production
- ชุดทดสอบใช้ migration ฐาน 0001–0036 และ bootstrap schema ของระบบรุ่นเดิม
  ทดสอบทั้งไม่มีคอลัมน์, มีบางคอลัมน์, มีครบ, การเรียกซ้ำ/พร้อมกัน, ข้อมูลเก่า,
  HR approval, token ไม่ถูกต้อง, ข้ามบริษัท, สิทธิ์ไม่พอ, หลักฐาน และครึ่งวัน
- ยังไม่ได้ Deploy เข้า Cloudflare ของผู้ใช้หรือยืนยันการรับข้อความ LINE จริง

รันในโปรเจกต์ฐานที่มี migration เก่าครบ (Node 22+):

```bash
node --test scripts/test-leave-schema-p930.mjs
node --test scripts/test-hr-daily-regression-p930.mjs
```

หากไม่มีตัวแปร P929_SOURCE / P927_SOURCE เคสทดสอบ reproduction ของโค้ดเก่า
จะถูก skip; การทดสอบอื่นยังรันตามปกติ

เอกสารอ้างอิงเทคนิค:
- Cloudflare D1 SQL statements: https://developers.cloudflare.com/d1/sql-api/sql-statements/
- Cloudflare D1 migrations: https://developers.cloudflare.com/d1/reference/migrations/
