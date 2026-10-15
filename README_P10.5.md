# Nakna P10.5 — UX Simplification & Information Hierarchy

**ประเภทแพตช์:** Frontend UX แบบ progressive enhancement สำหรับฐาน P10.x (P10.0, P10.1, P10.2 และรุ่นที่ต่อแพตช์ P10.4 มาแล้ว)

**ตั้งใจไม่แตะ:** API, src/index.js, D1, migrations, login/LINE, เอกสารและระบบการลา/เงินเดือนเดิม, calculation และ authorization

## สิ่งที่เปลี่ยน

| หน้า | ก่อน | P10.5 |
|---|---|---|
| ภาพรวม | การ์ดหลายส่วนที่ซ้ำกัน / ตัวเลขที่ไม่มีบันทึกเวลาเป็นสีแดง | สรุปสั้น, แถบทางลัดแนวนอน, งานที่ต้องทำก่อน, รายงานประกอบขยายเมื่อจะดู, สถานะยังไม่ลงเวลาเป็นกลาง |
| พนักงาน | รายหนึ่งกินพื้นที่ยาวและข้อมูลรองหลายช่อง | Mobile compact list ~74px/คน, เปิดดูแผนก/ตำแหน่ง/สถานะ LINE, ขยายเพื่อกดปุ่มเดิม (โปรไฟล์ เอกสาร แก้ไข ตั้งสิทธิ์ลา ฯลฯ) |
| เวลางาน | ข้อมูลขาด/ไม่ลงเวลาแสดงเหมือนพิสูจน์การขาดงาน | เปลี่ยนคำอธิบายให้ไม่ตัดสินว่าเป็นขาดทันที; สำหรับรายวันเปลี่ยนหน่วยเป็นคน (เฉพาะ UI), คงรายชื่อ/Filter/CSV/พิกัดเดิม |
| การลา | KPI 5 ใบ + กราฟ + อันดับเต็มหน้าจอ | แสดงยอด 3 ตัวก่อน, มีปุ่มดูสถานะเพิ่ม, เก็บกราฟ/อันดับในปุ่มเปิด, รายชื่อรายคนแสดงครั้ง/วันอย่างสั้นและขยายรายละเอียดได้ |
| Payroll | ยอดหลายกล่อง/รายการรอบยาวก่อนยอดสำคัญ | เน้นรอบล่าสุด+Net Pay, ยอดอื่นกดแสดง, งวดเงินเดือนยุบเมื่อรายละเอียดเปิดแล้ว, ยังคงปุ่มคำนวณ/แก้/ตรวจ/Export เดิม |

> หน้าคอมยังใช้ตาราง/ข้อมูลเดิม เพื่อไม่ลดประสิทธิภาพการทำงานชุดใหญ่

## การติดตั้งแบบแนะนำ (ปลอดภัยกับ P10.4 และ hotfix หลัง P10.2)

1. สำรอง Branch ปัจจุบันหรือสร้าง Branch `nakna-p105-staging`
2. แตก ZIP แล้วนำ `public/ui/p10-5.js`, `public/ui/p10-5.css`, `tools/apply-p10.5.mjs`, `tools/rollback-p10.5.mjs` ไปวางใน Repository ตามที่อยู่
3. รันจาก Root Repository:

```bash
node tools/apply-p10.5.mjs --dry-run
node tools/apply-p10.5.mjs
npm run check
npx wrangler deploy
```

4. ต้องทดสอบผ่าน **Staging** กับข้อมูลจำลองก่อน Deploy ไปบริษัทจริง และ Hard refresh/ปิด Browser LINE เดิมหลัง Deploy
5. เปิด console เช็ก `window.NaknaSimplify.version` ต้องได้ `P10.5-ux1`

สคริปต์แก้เฉพาะ `public/index.html` โดยเพิ่ม include 2 บรรทัด และเพิ่มไฟล์ใหม่ 2 ตัวใน `public/ui/` **จะไม่เขียนทับ `public/app.js`, ไม่แตะไฟล์ Backend, ไม่มี Migration** มีสำเนา `index.html` ก่อนแก้อยู่ใน `.nakna-p105-backup/` และรันซ้ำไม่แทรก include ซ้ำ

### สำหรับคนอัปผ่าน GitHub เว็บไซต์อย่างเดียว

อัปเพียง **สองไฟล์ใหม่** ลง `public/ui/` แล้วเปิด **`public/index.html` รุ่นที่ใช้อยู่จริง** เพิ่มสองบรรทัดก่อน `</head>` ดังนี้ (ไม่เอา index.html จาก ZIP รุ่นเก่ามาทับ):

```html
<link rel="stylesheet" href="/ui/p10-5.css?v=P10.5-ux1" />
<script defer src="/ui/p10-5.js?v=P10.5-ux1"></script>
```

Deploy ตาม workflow ของ Repository ที่ใช้อยู่

## Rollback (กรณีหน้าเว็บมีปัญหา)

```bash
node tools/rollback-p10.5.mjs --dry-run
node tools/rollback-p10.5.mjs
npm run check
npx wrangler deploy
```

ตัว rollback นำสอง tag ออกเท่านั้น ไม่ลบข้อมูล/ไม่เปลี่ยน Backend หรือจะคืน `index.html` จาก `.nakna-p105-backup/` โดยเทียบ diff ก่อน

## สิ่งที่ยังต้องทดสอบก่อนปล่อยขายจริง

- ตรวจข้อความ/ตัวเลขช่วงกะที่ยังไม่เริ่ม โดยใช้ตารางบริษัทจริง: P10.5 **ไม่แก้สูตรหรือ Query ฝั่ง Server** และไม่ถือว่า 'ไม่มีเช็กอิน' เท่ากับขาดงานโดยอัตโนมัติ
- ตรวจ Submit/Approve/Publish Payroll ด้วยชุดข้อมูลทดสอบ ไม่ใช้เงินจริง
- ตรวจเอกสารหลัง P10.4 ว่าปุ่มแก้ไข/ลบ/กู้คืนเปิดผ่าน Compact List ได้
- ทดสอบ Safari บน iOS LINE WebView/Android, เครื่องจอเล็ก, เน็ตช้า, การสลับ Workspace, สิทธิ์ HR/Owner/Employee
- ทดสอบหลังเลือกคนใน Leave ที่กรองแล้วว่ารายชื่อ/ประวัติแสดงข้อมูลบริษัทเดียวกัน
- การโหลดช้า LINE Push/D1/Google/PDF ยังต้องทำ Backend latency audit เพิ่ม

## หลักฐานทดสอบ

- Chromium mock browser 5 viewport (320,390,430,768,1440 px) รวม **69/69 assertions ผ่าน**
- ทดสอบ class/UI state, event delegation ไปปุ่มเดิม, การขยาย Dashboard/Payroll/Leave, การแสดง People List, ความกว้าง viewport, JS runtime errors
- Installer `--dry-run` ตรวจผ่านกับ P10.0, P10.1 Workspace, P10.2
- ตรวจ syntax `node --check` ผ่าน
- ไม่ได้ทดสอบ D1, LINE, production API หรือ WebKit/Safari จริง
