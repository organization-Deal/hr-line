# Upgrade — Nakna HR V1.0-P7

## เป้าหมาย
เปลี่ยน Customer Onboarding จากการพิมพ์ชื่อบริษัทใน LINE เป็น Business Setup บนเว็บ โดย LINE ทำหน้าที่เป็น identity + entry point เท่านั้น.

## Flow ใหม่
1. ลูกค้า Add LINE OA นากนะ
2. พิมพ์ `เชื่อมธุรกิจ`
3. LINE ส่ง Flex Card พร้อมปุ่ม `เริ่มตั้งค่า`
4. ปุ่มเปิด one-time magic link อายุ 15 นาที
5. หน้าเว็บสร้าง Workspace + ตั้งค่าข้อมูลบริษัท
6. เชื่อม Google Workspace (Gmail + Drive + Sheets)
7. ตั้ง Gmail Search Query สำหรับผู้สมัคร และเลือก Auto Sync
8. เริ่ม Free Trial 30 วัน
9. เข้า Dashboard และคิด Billing ตาม Active Employee Seat เมื่อเลือกแพ็กเกจ

## Migration
```bash
npm install
npm run db:migrate:remote
npm run deploy
```

Migration ใหม่: `0018_p7_web_onboarding_benefits_recruitment_gmail.sql`

## Google Cloud OAuth Redirect URIs
OAuth Client type: Web application

- `https://hr-line.organization-23c.workers.dev/auth/google/callback`
- `https://hr-line.organization-23c.workers.dev/integrations/google-workspace/callback`
- `https://hr-line.organization-23c.workers.dev/integrations/gmail/callback` (เฉพาะถ้ายังใช้ Personal Gmail connection)

ต้อง Enable:
- Gmail API
- Google Drive API
- Google Sheets API

## Cloudflare secrets
- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_TOKEN_ENCRYPTION_KEY` หรือ `NAKNA_INTEGRATION_ENCRYPTION_KEY`

## P7 เพิ่มอะไร
- Web Business Setup Wizard 4 ขั้น
- 30-day Trial setup state
- Recruitment Gmail status / query / manual sync / daily cron sync
- Gmail Message ID dedupe + Candidate email dedupe
- Benefits catalog
- Benefit enrollment รายพนักงาน
- LINE magic link สำหรับสร้าง Workspace ใหม่ แม้ LINE เดียวกันเป็นพนักงานอยู่แล้ว
- Existing Workspace ก่อน P7 ไม่ถูกบังคับผ่าน Wizard ใหม่

## Smoke Test
1. `/api/health` ต้องเป็น `1.0-P7`
2. `/api/public/diagnostics` DB/LINE/Google secrets ต้องพร้อม
3. LINE → `เชื่อมธุรกิจ` ต้องได้ปุ่มเปิด Setup บนเว็บ ไม่ถามชื่อบริษัทใน LINE
4. สร้างบริษัทบนเว็บแล้วต้องไป Step Google
5. Google OAuth กลับมาแล้วต้องไป Step Recruitment Gmail
6. กด Sync Gmail แล้ว Candidate ใหม่ต้องเข้า Recruitment โดยไม่สร้างซ้ำเมื่อ Sync รอบสอง
7. Complete Setup แล้ว Dashboard ต้องโหลด
8. หน้า `สวัสดิการ` ต้องมี default Social Security / Group Insurance / Medical และเพิ่ม Enrollment รายคนได้
