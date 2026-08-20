# นากนะ HR — V0.5.0

Thai-first HR Tech โดย Otterwork Co., Ltd.  
Google OAuth + Cloudflare Workers + D1 + LINE Messaging API + R2

## V0.5 Core
- SaaS Workspace / Google Login
- Employee Invite + Self Onboarding
- LINE auto-link + Employee LINE menu
- Work Location / Geofence Check-in & Check-out
- Leave Policy ต่อบริษัท
- สิทธิ์ลารายคนต่อปี + Adjustment
- ผู้อนุมัติเรื่องลารายพนักงาน
- LINE Flex Card ขอ/อนุมัติ/ไม่อนุมัติลา
- เหตุผล + หลักฐานรูป/ไฟล์ เก็บใน R2
- Leave Control Center + Team Calendar + Audit trail
- Approved leave sync เข้า Attendance
- Birthday / Probation / Contract / Recruitment / HR Inbox foundation

## Cloudflare Secrets
ตั้งเป็น Secret ใน Worker:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_TOKEN_ENCRYPTION_KEY
LINE_CHANNEL_SECRET
LINE_CHANNEL_ACCESS_TOKEN
```

`EVIDENCE_BUCKET` เป็น R2 binding ใน `wrangler.jsonc` ไม่ใช่ Secret

## Deploy

```bash
npm install
npx wrangler deploy
```

Static Assets ใช้ `public/` และ Worker หลักอยู่ที่ `src/index.js`.

หลัง deploy ให้ Login เข้า Dashboard หนึ่งครั้งเพื่อให้ `/api/bootstrap` อัปเกรด schema แบบ idempotent และสร้าง Leave Policy template สำหรับ Workspace.

ดูรายละเอียดการอัปเกรดและ Test Flow ใน `UPGRADE_V050.md`.
