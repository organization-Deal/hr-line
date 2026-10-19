# Nakna Recruitment — เลือกแหล่งอีเมลต่อ Gmail ได้

ชุดนี้ต่อจาก `Nakna-Recruitment-Bulk-Select-CHANGED-ONLY.zip` (Screening + Multi-Gmail)

## พฤติกรรมหลังติดตั้ง

- Gmail ที่ยังไม่เคยกด **เลือกแหล่งเมล** จะ **ไม่ Sync ใหม่** จนกว่า HR จะเลือกขอบเขตและบันทึกอย่างชัดเจน (รวมถึง Cron อัตโนมัติ) เพื่อไม่ดึงเมลส่วนตัวโดยไม่ตั้งใจ
- Gmail ที่ตั้งค่าแล้ว Sync ได้ตามปกติ มีสถานะเปิด/ปิดและ Auto Sync รายบัญชี
- บัญชี Gmail ใหม่เริ่มต้นโดย **ยังไม่เปิดให้อ่าน** และไม่ Auto Sync ต้องตั้งค่าก่อน
- ไม่ลบอีเมลเก่าที่เคยนำเข้า, ไม่แตะ Candidate ที่ HR รับแล้ว, ไม่ลบเมลต้นฉบับใน Gmail
- บัญชี Google หลักสำหรับ Drive/Sheets/Payroll ไม่เปลี่ยน และยังคงอ่านอีเมลสมัครงานจากบัญชีหลักเป็น "ปิด" หลังเชื่อม Dedicated Gmail แล้วตามกติกาเดิม

## ตั้งค่า

Nakna → Recruitment → บัญชี Gmail รับสมัครงานที่เชื่อม → **เลือกแหล่งเมล** หรือ **ตั้งค่า**

เลือกหนึ่งโหมดต่อ Gmail:

1. **เฉพาะอีเมลที่ส่งถึง** — เหมาะสุดเมื่อใช้ Gmail กล่องเดียวรับหลาย Alias เช่น `jobs@company.com, careers@company.com` (ตรวจ `To/Cc/Delivered-To` หลังดึงด้วยเพื่อกันเมลนอกเงื่อนไข)
2. **เฉพาะผู้ส่ง/โดเมน** — เช่น `jobs@jobboard.com, @jobthai.com` (เหมาะเมื่อแหล่งสมัครมาจาก Job Board ที่ระบุผู้ส่งได้แน่นอน, ไม่ควรใช้กับผู้สมัครที่ส่งตรงจาก Gmail ส่วนตัวหลายคน)
3. **เฉพาะ Gmail Label** — เช่น `Recruitment` ต้องสร้าง Label และ Gmail Filter ตามเกณฑ์ใน Gmail ไว้ก่อน, ระบบใช้ Gmail Search Label
4. **Gmail Query ขั้นสูง** — เช่น `newer_than:30d to:jobs@company.com` สำหรับผู้ที่คุ้นเคย Search ของ Gmail
5. **อ่านทั้ง Inbox** — ไม่แนะนำ, ต้องกดยืนยันเพิ่มเติม

แต่ละบัญชีเลือกย้อนหลัง 7 / 30 / 90 / 365 วันได้สำหรับโหมดที่ไม่ใช่ Query, เปิด/ปิด Inbox และ Auto Sync ได้อิสระกัน

**แนะนำกรณีบัญชีอีเมลส่วนตัว:** ถ้ามี Alias `jobs@...` ให้ใช้โหมด 1; ถ้าไม่มี ให้ตั้ง Filter ใน Gmail แล้วติด Label `Recruitment` จากนั้นใช้โหมด 3 หรือใช้บัญชี Gmail รับสมัครงานโดยเฉพาะ

กด **บันทึก** แล้วค่อย **Sync**; เข้าคิวคัดกรองและเลือกตัวกรอง **บัญชี Gmail** เพื่อดูข้อมูลเฉพาะบัญชีได้

ข้อสังเกต: ข้อความที่ส่งต่อ (Forward) หรือ BCC บางประเภทอาจไม่มีที่อยู่เป้าหมายใน `To/Cc/Delivered-To` ครบ ถ้าพบว่าตกหล่น ให้ใช้ Gmail Label หรือบัญชีรับสมัครเฉพาะแทน

## ติดตั้ง

1. เทียบ Diff กับ GitHub Commit ล่าสุดก่อนทับไฟล์ `src/index.js` / `public/app.js` / `public/index.html`
2. คัดลอกไฟล์ตามโครงสร้างใน ZIP ไปที่ Root repo `hr-line`
3. `node scripts/verify-recruitment-source-scope.mjs`
4. `npm run check`
5. `npx wrangler d1 migrations apply DB --remote` (ตรวจ Pending Migration ก่อนยืนยัน)
6. `npx wrangler deploy`

API สามารถสร้าง `recruitment_inbox_scopes` เมื่อเรียกใช้งานครั้งแรกด้วย `CREATE TABLE IF NOT EXISTS` แต่การใช้ migration ตามกระบวนการ Deploy ช่วยให้ตรวจสภาพ Schema ได้ล่วงหน้า

## ทดสอบ Production หลัง Deploy

- เข้าหน้า Recruitment: Gmail เดิมควรขึ้น "ตั้งแหล่งเมลก่อน" และปุ่ม Sync ปิดอยู่
- ตั้งค่าเฉพาะ `to:jobs@...`, บันทึก และ Sync → จำนวนที่นำเข้าเฉพาะขอบเขต ไม่เพิ่ม Candidate เอง
- ทดสอบอีเมลส่งถึงกล่องเดียวกันแต่เป็น `private@...` → ไม่ควรเข้าคิวใหม่
- เปลี่ยนเป็น Sender หรือ Label แล้ว Sync → ตรวจผลและประวัติในบัญชีนั้น
- เช็กว่าบัญชีอื่นไม่เปลี่ยน, Google หลัก/Drive/Sheets/Payroll และผู้สมัครเดิมยังใช้งานได้
- ถ้าเคยมี PEAK/Airbnb/Google ปนจากก่อนหน้า ให้ใช้ Bulk Select → คัดออก/ลบจากคิว (กู้คืนได้); การตั้ง Scope ใหม่ไม่ลบประวัติย้อนหลัง

## ขอบเขตการทดสอบ

ตรวจ `node --check`, `npm run check` (กับต้นฉบับเต็ม + ไฟล์ที่แก้), unit tests ของ query/recipient/sender/label/validation, SQLite Schema simulation, browser mock ของ modal ที่ความกว้าง 390/768/1440px ผ่านแล้ว

ยังไม่ได้ทดสอบ Gmail API จริง/Google OAuth/Cloudflare Production; ต้องลอง Sync หลัง Deploy กับ Gmail ที่มึงอนุญาตเอง
