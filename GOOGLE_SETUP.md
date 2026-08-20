# Nakna HR V0.3 — Google Login / Gmail Setup

## สิ่งที่เปลี่ยน

- เอา `HR_ADMIN_TOKEN` ออกจากระบบ Login แล้ว
- ผู้ใช้เข้าสู่ระบบด้วย Google Account
- Session เก็บด้วย Secure + HttpOnly cookie
- User 1 คนสามารถอยู่ได้หลายบริษัทผ่าน `company_members`
- Gmail เป็น Personal Integration แยกจาก Login: ใครต้องใช้ Gmail คนนั้นค่อยกดเชื่อมบัญชีของตัวเอง
- Gmail OAuth token ถูกเข้ารหัสก่อนเก็บลง D1

## 1) Google Cloud Console

สร้าง OAuth Client แบบ **Web application** และเพิ่ม Redirect URI:

- `https://hr-line.organization-23c.workers.dev/auth/google/callback`
- `https://hr-line.organization-23c.workers.dev/integrations/gmail/callback`

ถ้าเปลี่ยนเป็น Custom Domain ให้เพิ่ม URL ของโดเมนใหม่ด้วย

สำหรับ Login อย่างเดียว ใช้ scope: `openid email profile`

ถ้าจะใช้ Gmail Integration ให้ Enable **Gmail API** และระบบจะขอ `gmail.readonly` เฉพาะตอนผู้ใช้กด “เชื่อม Gmail”

> Gmail scope สำหรับ SaaS สาธารณะอาจต้องผ่าน Google OAuth verification ก่อนเปิดให้ผู้ใช้ทั่วไปใช้งาน

## 2) Cloudflare Secrets

ตั้งใน Worker `hr-line` > Settings > Variables and Secrets:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_TOKEN_ENCRYPTION_KEY` — ใช้ข้อความสุ่มยาวอย่างน้อย 32 ตัวอักษร และห้าม commit ลง Git

LINE ยังใช้ของเดิมเมื่อพร้อม:

- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`

ไม่ต้องมี `HR_ADMIN_TOKEN` แล้ว

## 3) Deploy

เอาไฟล์ใน ZIP ไปทับ repo เดิม แล้ว Deploy:

```bash
npx wrangler deploy
```

ไม่จำเป็นต้องรัน migration ด้วยมือ เพราะ `src/index.js` จะสร้างตาราง Auth ที่ขาดอยู่ให้เองแบบ `CREATE TABLE IF NOT EXISTS` แต่ไฟล์ `migrations/0002_saas_auth.sql` มีไว้ให้ schema history ของ repo ครบ

## 4) Login ครั้งแรก

1. เปิดหน้า Nakna HR
2. กด “เข้าสู่ระบบด้วย Google”
3. ถ้า D1 เดิมมี Workspace จาก V0.2 แต่ยังไม่มี Owner ระบบจะขึ้น “ใช้ Workspace เดิม” ให้ Owner คนแรก Claim ได้หนึ่งครั้ง
4. หรือสร้าง Workspace ใหม่
5. หลังจากนั้นระบบจำบริษัทและสิทธิ์ผ่าน Session / Membership

## 5) Gmail

เข้า `ตั้งค่า > การเชื่อมต่อของฉัน > Gmail`

- Login ด้วย Google **ไม่ได้แปลว่านากนะอ่าน Gmail ได้**
- Gmail จะถูกขอสิทธิ์แยกต่างหากเมื่อตัวผู้ใช้กดเชื่อม
- การเชื่อมเป็นราย User ไม่ใช่ Gmail กลางทั้งบริษัท
