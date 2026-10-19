# NAKNA HR — Multi-Gmail Recruitment (20 ต.ค. 2569)

## เป้าหมาย
- รับใบสมัครจาก Gmail หลายบัญชีในบริษัทเดียวกัน
- Google Workspace หลักที่ใช้ Drive / Sheets / Payroll **ไม่ถูกเปลี่ยนหรือถอดการเชื่อมต่อ**
- Gmail แต่ละบัญชี OAuth ของตนเอง (scope `gmail.readonly`), Query, Auto Sync, Error และ Last Sync
- ผู้สมัครเข้า Pipeline เดียวกัน เช็ก Sender Email ซ้ำกับผู้สมัครเดิม
- เก็บที่มาของอีเมลตาม Inbox และคงประวัติแม้ยกเลิกบัญชี

## วางไฟล์ทับใน Repo `hr-line`
```
src/index.js
public/app.js
public/index.html
public/ui/nk-multi-gmail.css
migrations/0038_recruitment_multi_gmail.sql
scripts/verify-multi-gmail.mjs
```
ไฟล์นี้จัดทำจาก Snapshot โค้ดที่มีการแก้ Nakna ล่าสุดในแชต (รวมหน้า Rewards, Employee Service และ Leave/Holiday) ควรตรวจ `git diff` หากมี Commit ใหม่ใน Repo หลัง Snapshot นี้ **ห้ามวางทับไฟล์ขนาดใหญ่แบบไม่ตรวจ diff** เพราะอาจทำฟีเจอร์ล่าสุดหายได้

## Google OAuth — ต้องตั้งค่าก่อนเชื่อม Gmail
ใน Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client ของ Nakna:
เพิ่ม Authorized redirect URI (ตรงตัว):
```
https://hr-line.organization-23c.workers.dev/integrations/recruitment-gmail/callback
```
ถ้า deploy ผ่านโดเมนของตนเอง ต้องลงทะเบียน URL callback ของโดเมนนั้นเพิ่มตามค่า APP_BASE_URL ที่ใช้จริงด้วย
- เปิด Gmail API ของ Google Cloud project นั้น
- OAuth Consent Screen ต้องประกาศ Gmail readonly (restricted scope)
- หากเปิดให้ลูกค้าภายนอกใช้งานจริง อาจต้องผ่าน Google App Verification และ/หรือ Security Assessment ตามข้อกำหนด Google; Test Users ต้องถูกระบุไว้ก่อน หาก App ยังอยู่สถานะ Testing
- ใช้ GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / encryption secret ที่ระบบ Google หลักตั้งไว้อยู่แล้ว โดยไม่ใส่ค่าความลับลง Git

## Migration
`0038_recruitment_multi_gmail.sql` เพิ่ม 2 ตารางใหม่เท่านั้น ไม่มี DROP/UPDATE ตารางเก่า
- Worker มี safe lazy-create เมื่อเรียกใช้ Multi-Gmail ครั้งแรก เพื่อไม่ทำให้หน้าเว็บค้างถ้าลืมรัน Migration
- ถ้า Workflow DevOps ของบริษัทจัดการ D1 Migration แยก ให้ใช้ migration ของ Repo ก่อน Deploy ตามขั้นตอนปกติ
- ข้อมูล Google หลักและ Recruitment เดิมไม่ถูกลบ

## ตรวจและ Deploy
```
node scripts/verify-multi-gmail.mjs
npm run check
npx wrangler deploy
```

## ใช้จริง
1. เข้า `Recruitment` > `+ เชื่อม Gmail รับสมัครงาน`
2. เลือก Google account ที่ต้องการรับใบสมัคร (ต้องเป็น Chrome/Safari ปกติ ถ้า LINE in-app เปิดภายนอก)
3. เมื่อ Google ยินยอมแล้ว กลับไป Recruitment เห็นบัญชี Gmail ใหม่
4. ตั้ง Query และ Auto Sync แยกตามบัญชีได้
5. กด Sync ทดสอบครั้งแรก → ตรวจ Candidate แสดงที่มา `Gmail: <ชื่อบัญชี>`
6. เชื่อมบัญชีเพิ่มเติมได้เรื่อย ๆ แต่ควรจำกัดเฉพาะบัญชีงานที่ได้รับอนุญาต
7. กดยกเลิกเชื่อมต่อจะลบ Token ของบัญชีนั้นจาก DB แต่คงประวัติ Inbox/Candidate

**หมายเหตุ:** เมื่อเชื่อม Gmail รับสมัครงานแยกบัญชีแรกสำเร็จ ระบบปิดการอ่านใบสมัครจาก Google หลัก (`recruitment_email_settings.enabled=0`) แต่ยังใช้ Google หลักสำหรับ Drive, Sheets, Payroll ตามเดิม สามารถกลับไปเปิดการอ่านใบสมัครจาก Google หลักได้ที่ปุ่ม `ตั้งค่า Google หลัก`

## ความปลอดภัย
- OAuth state + SameSite HttpOnly cookie + DB state TTL 10 นาที
- เฉพาะ Owner / Co-Owner / HR Admin เชื่อม, ตั้งค่า, Sync และยกเลิกบัญชีเพิ่มเติมได้
- เก็บ refresh token แบบเข้ารหัสใน D1
- ใช้ Gmail readonly ไม่ขอ Gmail Send หรือ Full Gmail
- ใช้ account_id + Gmail Message ID ป้องกันซ้ำ; ใช้ sender email เชื่อม Candidate เดิม
- คำขอ Sync ซ้อนของ Inbox เดียวกันถูกกันด้วย 3 นาที lease
- เก็บแค่ metadata อีเมลที่เกี่ยวกับการสมัคร, snippet และชื่อไฟล์แนบตามโครงเดิม ไม่ดึงเนื้อหาเต็มหรือไฟล์แนบมาเก็บถาวร

## ข้อจำกัดและการทดสอบ Production
- ทดสอบ Code Check, SQLite schema/constraint, และ UI Fixture บน 390/768/1440px แล้ว
- **ยังไม่ได้ OAuth กับ Google ของจริง, ยังไม่ได้ Sync Production Gmail หรือ Deploy**
- หลัง Deploy ให้ทดสอบบัญชีใหม่ 2 บัญชี: เชื่อม/Sync/แยกแหล่งที่มา/หักซ้ำ/ตั้ง Query/Auto Sync/ยกเลิก/เชื่อมใหม่
- Auto Sync เดิมทำทุกวันเวลา 08:00 Asia/Bangkok และรับจำนวนอีเมลล่าสุดต่อ Inbox ตาม limit ใน Cron; สำหรับองค์กรรับสมัครจำนวนมาก ควรเพิ่ม Pagination/History cursor ก่อนใช้จริง
- หาก Google OAuth ในโหมด Testing, Google อาจจำกัดระยะเวลา Refresh Token ของ scope หรือการให้สิทธิ์; ทดสอบ Refresh หลังครบกำหนด
