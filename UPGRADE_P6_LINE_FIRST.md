# Nakna HR V1.0-P6 — LINE-first onboarding

## Flow ใหม่

1. ลูกค้า Add LINE OA ของนากนะ
2. พิมพ์ `เชื่อมธุรกิจ`
3. กด `สร้างธุรกิจใหม่`
4. พิมพ์ชื่อบริษัท
5. ระบบสร้าง Workspace และตั้งผู้สร้างเป็น `Owner`
6. LINE ส่งปุ่ม `เปิดระบบ HR` (ลิงก์ใช้ได้ครั้งเดียว อายุ 15 นาที)
7. เว็บเปิดพร้อม session ของบริษัทนั้นทันที

พนักงานไม่ต้องสร้างธุรกิจเอง ให้ใช้ Invite/รหัสเชื่อมจาก HR

## ก่อน Deploy

```bash
npm install
npm run check
npm run db:migrate:remote
npm run deploy
```

ต้องมี Cloudflare Worker secrets สำหรับ LINE OA กลางของนากนะ:

- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`

และตั้ง Webhook ของ LINE Messaging API เป็น:

`https://hr-line.organization-23c.workers.dev/webhooks/line`

หน้า Login จะพยายามอ่าน Basic ID จาก LINE API เพื่อสร้างปุ่มเปิด LINE อัตโนมัติ

## ตรวจหลัง Deploy

- `/api/health` ต้องเห็น `version: 1.0-P6`
- Add LINE → พิมพ์ `เชื่อมธุรกิจ`
- สร้างบริษัททดสอบ
- กด `เปิดระบบ HR`
- Dashboard ต้องไม่ค้าง Skeleton แม้ API บางตัว error; จะขึ้นแถบแจ้งเตือนและปุ่มลองใหม่แทน
