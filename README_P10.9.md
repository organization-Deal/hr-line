# Nakna P10.9 — Recruitment Quick Start (connected Gmail)

## ทำไมต้องมี
บัญชีรับสมัครงานสามารถ OAuth เชื่อมสำเร็จ แต่ใน Recruitment ยังขึ้น **ตั้งแหล่งเมลก่อน**, Sync disabled. P10.8 เคยทำให้ modal ตั้งค่าง่ายขึ้น แต่ยังต้องเข้าถึงปุ่ม **เลือกแหล่งเมล** ก่อน จึงไม่ช่วยผู้ใช้ที่ไม่รู้ว่าต้องตั้งค่าอีกขั้นหนึ่ง

## สิ่งที่แก้
- ตรวจจากการ์ด Gmail ที่เชื่อมและขึ้น **ตั้งแหล่งเมลก่อน** เท่านั้น
- เพิ่ม **เริ่มรับใบสมัคร** และ **ตั้งค่าเพิ่มเติม** บนการ์ด Gmail นั้นโดยตรง
- กดเริ่มรับ → เปิดหน้าตั้งค่าของบัญชีเดียวกัน → ใช้ P10.8 ตั้ง recipient, To เป็นที่อยู่อีเมลบัญชีนั้นอย่างเดียว, ย้อนหลัง 30 วัน, enabled + auto_sync แล้วบันทึกผ่านปุ่ม Save ของระบบเดิม
- หากพบหลายบัญชีจะยึด Gmail ที่กดเท่านั้น ไม่ไปแก้บัญชีอื่นหรือ Google หลัก
- ไม่มีการเรียก Gmail Sync ขณะโหลดหน้า หรือ Sync เมื่อแค่เชื่อม OAuth
- หลัง Server ยืนยันการตั้งค่า ต้องกด **Sync** หนึ่งครั้งเพื่อเริ่มนำอีเมลเข้าคิวคัดกรอง (ยังไม่สร้าง Candidate อัตโนมัติ)
- หากตัวช่วย P10.8 ไม่พร้อม จะเปิด modal เดิมและเตือน ไม่คาดเดาค่าหรือบันทึกอัตโนมัติ
- ไม่เปลี่ยนสิทธิ์ฐานข้อมูล/Google scopes, ไม่ลบอีเมล, ไม่ตอบกลับอัตโนมัติ

## วิธีติดตั้ง
1. สร้าง Branch สำรองจาก Repository ล่าสุดจริง แล้วทดลองบน Staging
2. แตก ZIP คัดลอก 4 ไฟล์ใน `public/ui` และ 2 ไฟล์ใน `tools` เข้า Repo (ถ้ามี P10.8 อยู่แล้วใช้ไฟล์เดิมได้)
3. รันจาก root ของ Repository:

```bash
node tools/apply-p10.9.mjs --dry-run
node tools/apply-p10.9.mjs
npm run check
npx wrangler deploy
```

ตัวติดตั้งแก้ `public/index.html` เฉพาะแท็ก include ไม่ทับ `public/app.js`, `src/index.js`, Gmail API, D1, Payroll, LINE หรือไฟล์เอกสาร.

### ถ้าอัปผ่าน GitHub Web UI เท่านั้น
หลังวาง 4 ไฟล์ไว้ที่ `public/ui` เปิด `public/index.html` เวอร์ชันปัจจุบัน เพิ่มบรรทัดต่อไปนี้ก่อน `</head>` **เฉพาะบรรทัดที่ยังไม่มีอยู่**:

```html
<link rel="stylesheet" href="/ui/p10-8-recruitment-simple.css?v=P10.8-1" />
<script defer src="/ui/p10-8-recruitment-simple.js?v=P10.8-1"></script>
<link rel="stylesheet" href="/ui/p10-9-recruitment-quickstart.css?v=P10.9-1" />
<script defer src="/ui/p10-9-recruitment-quickstart.js?v=P10.9-1"></script>
```

จากนั้นรอ Cloudflare Deploy สำเร็จ กด Hard Refresh และเปิด Recruitment ใหม่.

## วิธีใช้
Recruitment → บัญชี HR ที่เชื่อมแล้ว → **เริ่มรับใบสมัคร** → รอระบบบันทึก → ถ้าปุ่ม Sync เปิดแล้วกด **Sync** ครั้งแรก → ตรวจคิวคัดกรอง

ถ้าไม่เห็นปุ่ม ให้เปิด Console ตรวจ:

```js
window.NaknaRecruitmentSimple?.version
window.NaknaRecruitmentQuickstart?.version
```

ควรเป็น `P10.8-simple-gmail-1` และ `P10.9-recruitment-quickstart-1` ตามลำดับ.

หากยังขึ้น **ตั้งแหล่งเมลก่อน** หลังบันทึก ต้องดู HTTP response / Worker Logs ของการบันทึกค่าบัญชีนั้น อย่าถือว่าบันทึกสำเร็จจากการคลิกปุ่มอย่างเดียว

## ย้อนกลับ

```bash
node tools/rollback-p10.9.mjs
npx wrangler deploy
```

เอาเฉพาะ include P10.9 ออก ไม่แตะ P10.8 หรือข้อมูล Gmail/ผู้สมัคร.

## การทดสอบและข้อจำกัด
- Playwright Chromium mock: 5 viewports (320/390/430/768/1440) ผ่าน, account isolation, safe fallback, advanced setup, already configured (รวม 8 tests)
- Installer dry-run, real apply, idempotency, rollback ผ่าน 4 กรณี
- ยังไม่ได้ทดสอบบัญชี Gmail Production จริง / LINE WebView / Google API scopes / D1 / Cloudflare; ต้องทดสอบใน Staging ก่อนปล่อยให้ HR ใช้
