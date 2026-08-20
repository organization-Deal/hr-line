# HR LINE OS v0.1.1

HR Operating System แบบ LINE-first สำหรับบริษัทไทย

## Fix ใน v0.1.1

- เปลี่ยน Worker name ให้ตรงกับ Cloudflare project: `hr-line`
- เอา `database_id` placeholder ที่ทำให้ deploy error 10021 ออก
- ใช้ Cloudflare D1 automatic provisioning ผ่าน draft binding `DB`
- Worker bootstrap schema + demo seed อัตโนมัติเมื่อ API ถูกเรียกครั้งแรก
- ไม่ต้องสร้าง D1 UUID หรือแก้ `wrangler.jsonc` เองก่อน deploy

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
- Vanilla HTML/CSS/JS
- LINE Messaging API webhook

## Deploy ผ่าน Cloudflare Workers Builds

ใช้ Deploy command เดิมได้เลย:

```bash
npx wrangler deploy
```

Wrangler 4.124+ จะ provision D1 binding `DB` ให้อัตโนมัติในการ deploy ครั้งแรก

หลัง deploy ให้ไปที่ Worker > Settings > Variables and Secrets แล้วเพิ่ม:

```text
HR_ADMIN_TOKEN = token ที่เดายาก
LINE_CHANNEL_SECRET = ใส่ทีหลังเมื่อสร้าง LINE Bot แล้ว
LINE_CHANNEL_ACCESS_TOKEN = ใส่ทีหลังเมื่อสร้าง LINE Bot แล้ว
```

> LINE secrets ยังไม่ต้องมีเพื่อเปิด Dashboard แต่ `HR_ADMIN_TOKEN` ต้องมีเพื่อเรียก API หลังบ้าน

เมื่อเปิด Dashboard ครั้งแรกแล้ว login ด้วย `HR_ADMIN_TOKEN` ระบบจะสร้าง D1 tables และ demo data ให้อัตโนมัติถ้า database ยังว่าง

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

`.dev.vars`:

```env
HR_ADMIN_TOKEN=ใส่-token-ที่เดายาก
LINE_CHANNEL_SECRET=...
LINE_CHANNEL_ACCESS_TOKEN=...
```

## D1 migration commands (optional)

ระบบ bootstrap schema อัตโนมัติอยู่แล้ว แต่ยังเก็บ migration scripts ไว้สำหรับการอัปเกรด schema ในรุ่นต่อไป:

```bash
npm run db:migrate:local
npm run db:migrate:remote
npm run db:seed:local
npm run db:seed:remote
```

## LINE Webhook

หลังสร้าง LINE Messaging API channel แล้วตั้ง Webhook URL เป็น:

```text
https://hr-line.<your-subdomain>.workers.dev/webhooks/line
```

## เชื่อมพนักงานกับ LINE

1. HR เปิด Employees
2. กด “สร้างรหัส LINE”
3. ระบบออก code 6 หลัก อายุ 15 นาที
4. ให้พนักงานส่งใน LINE OA:

```text
LINK 123456
```

หลังเชื่อมแล้วพนักงานใช้:

```text
เช็กอิน
เช็กเอาต์
สถานะ
```

ถ้าบริษัทตั้ง geofence แล้ว Bot จะขอ Location ก่อนบันทึกเวลา

## ตั้ง Geofence

V0.1.1 ตั้งผ่าน D1 ก่อน เช่น:

```sql
UPDATE clients
SET geofence_name='DEAL Office',
    geofence_lat=13.000000,
    geofence_lng=100.000000,
    geofence_radius_m=250
WHERE id=1;
```

V0.2 จะเพิ่ม Company Settings ให้ HR ปักหมุดจาก UI

## Security

- LINE webhook ตรวจ `x-line-signature` จาก raw request bodyก่อน parse JSON
- Secrets ไม่อยู่ใน source code
- API หลังบ้านต้อง Bearer token
- Link LINE ใช้รหัส one-time + expiry
- Audit log สำหรับ action สำคัญ
- D1 ใช้ prepared statements สำหรับข้อมูลจากผู้ใช้

## Version

`V0.1.1 · 20 AUG 2026`
