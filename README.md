# HR LINE OS v0.1.0

HR Operating System แบบ LINE-first สำหรับบริษัทไทย

## มีอะไรใน V1 นี้

- HR Autopilot Dashboard / HR Radar
- Employee 360 (พื้นฐาน)
- Recruitment ATS + Candidate Pipeline
- Attendance Today
- Leave approve / reject
- HR Request Inbox
- Birthday Radar
- Daily HR Morning Brief ส่งเข้า LINE HR เวลา 08:00 น. (Cron 01:00 UTC)
- Probation & Contract Radar
- Multi-client schema ตั้งแต่ฐานข้อมูล
- LINE account linking ด้วย one-time code
- LINE Check-in / Check-out
- รองรับ GPS geofence
- LINE webhook signature verification (HMAC-SHA256)
- Audit log
- Admin API Token authentication

## Stack

- Cloudflare Workers + Static Assets
- Cloudflare D1
- Vanilla HTML/CSS/JS (ไม่มี build step ฝั่งหน้าเว็บ)
- LINE Messaging API webhook

## 1) ติดตั้ง

```bash
npm install
cp .dev.vars.example .dev.vars
```

แก้ `.dev.vars`:

```env
HR_ADMIN_TOKEN=ใส่-token-ที่เดายาก
LINE_CHANNEL_SECRET=...
LINE_CHANNEL_ACCESS_TOKEN=...
```

## 2) สร้าง D1

```bash
npx wrangler d1 create hr-line-os-db
```

เอา `database_id` ที่ได้ไปแทน `REPLACE_WITH_YOUR_D1_DATABASE_ID` ใน `wrangler.jsonc`

## 3) Migration + Seed

Local:

```bash
npm run db:migrate:local
npm run db:seed:local
```

Production:

```bash
npm run db:migrate:remote
npm run db:seed:remote
```

> seed.sql เป็นข้อมูล Demo เท่านั้น ไม่ต้องรัน Production ถ้ามีข้อมูลจริงแล้ว

## 4) ตั้ง Secret Production

```bash
npx wrangler secret put HR_ADMIN_TOKEN
npx wrangler secret put LINE_CHANNEL_SECRET
npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
```

## 5) Deploy

```bash
npm run deploy
```

หน้าเว็บจะอยู่ที่ URL ของ Worker เช่น:

`https://hr-line-os.<subdomain>.workers.dev`

LINE Webhook:

`https://hr-line-os.<subdomain>.workers.dev/webhooks/line`

## Daily HR Brief

Worker ตั้ง Cron `0 1 * * *` ซึ่ง Cloudflare รันเป็น UTC = 08:00 น. ประเทศไทย ระบบจะส่งสรุป HR Radar, Birthday, Probation และ Contract ไปยังพนักงานที่อยู่ Department code `HR` หรือ Position มีคำว่า `HR` และเชื่อม LINE แล้ว

## 6) เชื่อมพนักงานกับ LINE

1. HR เปิด Employees
2. กด “สร้างรหัส LINE”
3. ระบบออก code 6 หลัก อายุ 15 นาที
4. ให้พนักงานส่งใน LINE OA:

```text
LINK 123456
```

5. หลังเชื่อมแล้ว พนักงานพิมพ์:

```text
เช็กอิน
เช็กเอาต์
สถานะ
```

ถ้าบริษัทตั้ง geofence แล้ว Bot จะขอให้พนักงานส่ง Location ก่อนบันทึกเวลา

## ตั้ง Geofence

ตอนนี้ V0.1 ตั้งผ่าน D1 ก่อน เช่น:

```sql
UPDATE clients
SET geofence_name='DEAL Office',
    geofence_lat=13.000000,
    geofence_lng=100.000000,
    geofence_radius_m=250
WHERE id=1;
```

V0.2 ควรเพิ่มหน้า Company Settings ให้ HR ปักหมุดจาก UI

## Security ที่ใส่มาแล้ว

- LINE webhook ตรวจ `x-line-signature` จาก raw request body ก่อน parse JSON
- Secrets ไม่อยู่ใน source code
- API หลังบ้านต้อง Bearer token
- Link LINE ใช้รหัส one-time + expiry
- Audit log สำหรับ action สำคัญ
- D1 ใช้ prepared statements

## ฟีเจอร์ถัดไปที่ควรทำ

1. LINE Rich Menu + LIFF Check-in UX
2. Company Settings + map geofence
3. Onboarding Autopilot
4. Employee document center
5. Interview scheduling + scorecard
6. Manager approvals ผ่าน LINE
7. HR notification scheduler (birthday / probation / contract)
8. Payroll pre-flight
9. Asset + Offboarding
10. Role-based access แทน Admin token เดียว

