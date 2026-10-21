# Nakna P10.10 — 12:30 + 13:00 LINE notification resilience

## ทำไมต้องทำรอบนี้

จากข้อมูลหน้าจอที่ส่งมา ไม่สามารถสรุปได้ว่าต้นเหตุคือ Cron ปิด, LINE quota/token, ไม่มีผู้รับเข้าเงื่อนไข หรือ D1 Error โดยไม่เห็น Production Logs / diagnostics จริง

ตรวจโค้ดฐาน P10.3 (ก่อนรุ่น Backend ปัจจุบัน) พบว่า:

- Reminder 12:30 ทำงานเมื่อเวลา `12:30` ตรงนาทีเดียว หาก cron ไม่มาถึงนาทีนั้น ไม่มี catch-up
- สรุป HR 13:00 มีระบบ retry อยู่แล้ว แต่ `429` จาก LINE ถูกบันทึกเป็น non-retryable
- หลังอัปเดตแบบทับ `src/index.js` ทั้งไฟล์ เคยมีกรณี holiday guard จาก P9.39/P10.6 หาย
- Live `wrangler.jsonc` บน GitHub ระบุ Cron ทุกนาที แต่ต้องตรวจ Cloudflare Runtime ว่า trigger active จริง

## สิ่งที่ P10.10 ทำ

1. ขยายช่วง reminder เป็น **12:30, 12:35, ..., 12:55** ตามเวลา Asia/Bangkok ไม่ส่งช้าข้ามไปช่วงบ่าย
2. ยังคงกรองตารางงาน/เวลาเริ่มกะ, เช็กอินแล้ว, คนลา, วันหยุดบริษัท, สถานะพนักงานและ LINE พร้อม **ข้ามวันอาทิตย์**
3. บันทึก retry key, immutable message และสถานะต่อพนักงานใน `attendance_reminder_logs` (เฉพาะวันที่แจ้งเตือน) เพื่อไม่ส่งซ้ำหาก LINE ยอมรับแล้ว
4. ถ้า LINE คืน `409 + x-line-accepted-request-id` กับ key เดิม ถือว่า accepted; ถ้า 429,408,5xx หรือ network error จะลองใหม่ใน window เดิมด้วย **key เดิม**; 400/401/403 ไม่ส่งซ้ำโดยอัตโนมัติ
5. ทำสรุป HR 13:00 ให้ retry กรณี `429` โดยใช้ retry key ของระบบเดิม และคงเงื่อนไขวันหยุด P10.6 หรือเติม holiday guard หากพบว่าถูกทับหาย
6. เพิ่ม GET `/api/hr/notification-health` (Owner/Co-Owner/HR ที่มีสิทธิ์เท่านั้น) เพื่อดู heartbeat, log จำนวนผู้รับ, สถานะ retry และส่งสำเร็จของบริษัทปัจจุบัน ไม่มี LINE ID/token หรือข้อความส่วนตัวใน response
7. ไม่เปลี่ยนหน้าเว็บ, ฟอร์ม, Leave, Payroll, Subscription, เชื่อม Gmail, API เดิม หรือ Data table ของธุรกิจ

## สำคัญ: นี่เป็น installer ไม่ใช่ src/index.js เก่าที่เอามาทับได้

ตัวติดตั้งแก้เฉพาะบล็อกส่วนแจ้งเตือนบน **ไฟล์ src/index.js ของ Repository ปัจจุบัน** หากโครงสร้างแตกต่างจากที่ตรวจไว้ จะ STOP ก่อนแก้ และไม่ทำให้ระบบย้อนเวอร์ชัน

### ตรวจสถานะแจ้งเตือนย้อนหลัง

หลัง Deploy บัญชี HR/Owner ที่ได้รับอนุญาตสามารถตรวจสถานะการส่ง **เฉพาะบริษัทของตน** ผ่าน:

`GET /api/hr/notification-health?date=2026-10-21` (ตัวอย่างเช็กวันที่ 21 ตุลาคม 2569)

สามารถระบุวันที่ย้อนหลังได้สูงสุด 14 วัน ระบบจะแสดงจำนวน reminder ที่ `sent/retry/failed` และสรุป HR ที่ `accepted/retry/failed` พร้อมสถานะ Cron ล่าสุด โดยไม่เปิดเผย LINE ID หรือ Token ทั้งนี้ `accepted` หมายถึง LINE API รับคำขอแล้ว ไม่ได้ยืนยันว่ามือถือได้รับ/อ่านข้อความ

### ติดตั้งบน Mac/PC (แนะนำ)

ใน Repository Nakna เวอร์ชันล่าสุด:

1. แตก ZIP แล้วคัดลอกโฟลเดอร์ `tools` และ `tests` เข้า Repository (ไม่แทนที่ไฟล์เดิมอื่น)
2. เปิด Terminal ที่ Root Repository
3. รัน:

```sh
node tools/apply-p10.10.mjs --dry-run
node tools/apply-p10.10.mjs
node tests/test-p10.10.mjs
npm run check
```

4. ตรวจ Diff ของ `src/index.js` แล้วอัปบน **Staging** ที่มี D1 และ LINE OA สำหรับทดสอบ
5. หลังตรวจรับ จึง Commit โค้ดและ Deploy ตามระบบเดิม

ตัวติดตั้งจะสำรองไฟล์เดิมไปที่ `.nakna-backups/p10.10-...` ก่อนเขียนทุกครั้ง

### หากใช้ GitHub Web อย่างเดียว ไม่ต้องเปิด Terminal

1. Upload `tools/apply-p10.10.mjs`, `tests/test-p10.10.mjs`, `.github/workflows/nakna-p1010-build-patch.yml` ขึ้น Repository ล่าสุด โดย **ยังไม่ต้องอัป src/index.js**
2. GitHub → **Actions** → `Build Nakna P10.10 Notification Patch (review only)` → Run workflow
3. ถ้าสีเขียว ดาวน์โหลด Artifact `Nakna-P10.10-patched-backend` ซึ่งมีไฟล์ `index.js` ที่แก้จากเวอร์ชัน GitHub ปัจจุบัน
4. ตรวจ Diff หรือทดลองบน Staging ก่อน จากนั้นค่อยอัป `index.js` ไปที่ `src/index.js` ใน GitHub และรอ Cloudflare Deploy
5. ถ้า Workflow แดง แปลว่าตัวติดตั้ง STOP เพราะฐานไม่ตรงหรือเช็กไม่ผ่าน: **อย่าฝืนเอา src/index.js จากแพตช์เก่าทับ** ให้ส่ง error log เพื่อแก้เฉพาะจุด

**Workflow นี้ไม่ Deploy หรือ Commit Backend อัตโนมัติ**

## วิธีตรวจหลัง Deploy

- ส่งคำสั่ง `สถานะสรุป HR` เข้า LINE ส่วนตัว: ดู Cron ล่าสุด / HR eligible / LINE status / HTTP errors
- หรือ Owner/HR ที่ล็อกอินอยู่ใช้ GET `/api/hr/notification-health` ผ่าน session ที่ได้รับอนุญาต
- Cloudflare → Workers & Pages → `hr-line` → Settings → Triggers → Cron ต้องมี `* * * * *`
- Cloudflare Worker Logs ต้องมี event `missing_checkin_reminder_complete` เวลา 12:30–12:55 และ `hr_daily_status_complete` ช่วง 13:00–17:59 (เวลาไทย)
- 13:00 วันอาทิตย์และวันหยุดบริษัท **ต้องไม่ส่ง**, แต่คำสั่งดูสรุปเองยังใช้ได้
- รายที่เช็กอินแล้ว, มีใบลาที่ pending/approved/awaiting_evidence, หรือเป็นวันหยุด ต้องไม่รับ Reminder
- วันที่มีคนต้องแจ้งและ LINE รับคำขอ ต้องมี log `sent` หนึ่งแถวต่อพนักงานต่อวัน

## ขอบเขตที่ยังไม่ยืนยัน

ยังไม่สามารถอ่านสถานะ Cron/LINE quota และ D1 Production จริงได้ เพราะการอ่าน Source Code จาก GitHub ไม่ได้ให้สิทธิ์เข้า Cloudflare Runtime จึงไม่รับประกันว่าหลัง Deploy แล้วจะส่งสำเร็จทันที หาก Cron trigger ไม่ถูกใช้งานจริง ต้องแก้ Cloudflare ก่อน

**ผมทดสอบ JS ด้วย mock ของ LINE และ SQLite ในเครื่องเท่านั้น ไม่ได้ยิงข้อความ LINE จริง ไม่ได้แตะข้อมูลพนักงาน และไม่ได้ Deploy**
