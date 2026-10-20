# Nakna P10.9.2 — กู้ Recruitment ที่ถูก P10.9.1 ทับ

## ปัญหา (ยืนยันจาก ZIP ที่ส่ง)
- `Nakna_P10.9.1_RECRUITMENT_READY_UPLOAD.zip` มี `public/index.html` จากฐาน P10.1 เก่า (SHA-256 `e03dab7856b43c3d3d22ce02a65c14a72c87a665b3e13aead23701fb9935849d`).
- HTML นั้น **ไม่มี** ส่วน `บัญชีรับสมัครงานที่เชื่อม`, `คิวคัดกรองอีเมล`, `เลือกแหล่งเมล` จาก Recruitment หลายบัญชีรุ่นล่าสุด
- หลังอัปโหลดทับ ภาพหน้า Recruitment จึงย้อนกลับแม้ `public/app.js` และข้อมูลในฐานอาจยังอยู่ครบ
- ข้อจำกัด: แพ็กนี้ไม่ได้อ่าน GitHub repo Production ของคุณและไม่ได้ Deploy จึงใช้ **ประวัติ Git ของ repo จริง** เพื่อกู้ไฟล์ที่อยู่ก่อน commit ที่ผิด ไม่แต่งหน้า HTML เก่าขึ้นมาแทน

## วิธีที่ง่ายที่สุด: กู้ `public/index.html` จาก GitHub History (ไม่มี Terminal)
1. เปิด GitHub Repository ของ Nakna → `public` → `index.html` → **History**.
2. เปิด commit **ก่อน** การอัปโหลด P10.9.1 (`Add files via upload` ตอนหน้า Recruitment เด้งกลับ).
3. ตรวจในไฟล์ก่อนหน้านั้นว่ามีข้อความ `บัญชีรับสมัครงานที่เชื่อม` หรือ `คิวคัดกรองอีเมล`.
4. คัดลอกเนื้อหาไฟล์จาก revision นี้คืนลง `public/index.html` เวอร์ชันปัจจุบัน → Commit. **ห้ามย้อนทั้ง Repo** เพราะจะทับ hotfix อื่น.
5. ตรวจว่าไฟล์ใน `public/ui/` ต่อไปนี้ยังอยู่: `p10-8-recruitment-simple.css/js` และ `p10-9-recruitment-quickstart.css/js`.
6. ถ้าต้องการเปิดปุ่มใหม่ ให้เพิ่มเพียง tag อ้างอิง 4 ตัวก่อน `</head>` ในไฟล์ที่เพิ่งกู้ หากยังไม่มีอยู่ (ดูบรรทัดด้านล่าง) แล้ว Commit อีกครั้ง.
7. รอ Cloudflare Deploy สำเร็จ และเปิด Recruitment ใหม่แบบ Hard Refresh. หน้า **บัญชี Gmail แยก + คิวคัดกรอง** ต้องกลับมาก่อน แล้วจึงทดสอบปุ่มเปิดรับใบสมัคร.

**ห้ามใช้ `public/index.html` ใน ZIP P10.9.1 ทับอีกครั้ง** เพราะจะทำให้หน้า Recruitment รุ่นหลายบัญชีหายอีก

```html
<link rel="stylesheet" href="/ui/p10-8-recruitment-simple.css?v=P10.8-1">
<script defer src="/ui/p10-8-recruitment-simple.js?v=P10.8-1"></script>
<link rel="stylesheet" href="/ui/p10-9-recruitment-quickstart.css?v=P10.9-1">
<script defer src="/ui/p10-9-recruitment-quickstart.js?v=P10.9-1"></script>
```

## วิธีใช้ไฟล์ช่วยกู้โดยไม่แตะ HTML เอง (มี Git repository ในเครื่อง)

1. คัดลอกโฟลเดอร์ `tools/` และไฟล์ UI 4 ไฟล์จาก ZIP เข้าตำแหน่งเดิมใน Repo (ไม่วาง `index.html` จาก ZIP รุ่นเก่า).
2. เปิด Terminal ใน Root ของ Repo; แนะนำสร้าง branch ชื่อ `recover-p1092` ก่อน.
3. รันตรวจสอบแบบไม่เปลี่ยนไฟล์:

```bash
node tools/recover-p10.9.1.mjs --dry-run
```

4. ถ้าผลบอก `Pre-upload good HTML markers` พร้อมรายชื่อฟีเจอร์เดิม ให้รัน:

```bash
node tools/recover-p10.9.1.mjs --apply
git diff -- public/index.html
npm run check
```

5. Commit เฉพาะไฟล์ที่กู้/ไฟล์ UI ที่ขาด ขึ้น GitHub จากนั้นรอ Cloudflare Deploy และทดสอบก่อนเปิดใช้จริง

ตัวกู้จะค้นหาคอมมิตที่มี HTML P10.9.1 แล้วนำเนื้อหาจาก **คอมมิตก่อนหน้าของไฟล์นั้นจริง ๆ** มาแทน จากนั้นเพิ่มเพียง 4 import tag ที่ขาดอยู่ ไม่แก้ `public/app.js`, `src/index.js`, Database หรือผู้สมัคร

**Fail-safe:** ถ้ามีการแก้ `public/index.html` เพิ่มหลัง P10.9.1, ไม่พบประวัติที่เหมาะสม, หรือไฟล์รุ่นก่อนหน้าไม่มีส่วน Recruitment หลายบัญชี สคริปต์จะหยุด ไม่เขียนทับ

## วิธีใช้ผ่าน GitHub Actions โดยไม่ต้องเปิด Terminal ในเครื่อง (ทางเลือก)

ถ้าบัญชี GitHub เปิด Actions และให้ใช้งานได้:
1. อัป `tools/recover-p10.9.1.mjs` และ `.github/workflows/nakna-p1092-recover-index.yml` ขึ้น GitHub ตาม Path ใน ZIP. รวมไฟล์ UI 4 ตัว หากยังขาด
2. เข้า **Actions → NAKNA P10.9.2 recover Recruitment HTML → Run workflow** บน branch ที่ Deploy อยู่
3. หลัง run สำเร็จ ดาวน์โหลด Artifact `NAKNA-P10.9.2-recovered-index`, แตก ZIP จะได้ `public/index.html`
4. อัป `public/index.html` ที่กู้ได้กลับ GitHub, Commit, รอ Deploy

**Workflow ไม่แก้ Repo อัตโนมัติ** มันสร้างไฟล์ให้ตรวจและอัปเองเพื่อความปลอดภัย

## หลัง Deploy ต้องตรวจอะไร
- Recruitment มี section `บัญชีรับสมัครงานที่เชื่อม` และ `คิวคัดกรองอีเมล` กลับมา
- บัญชี `hr.info@dealinvests.com` ยังเป็นบัญชีแยก ไม่ไปแก้ Google หลัก
- UI โหลด JS ที่เปิดปุ่ม: เช็ค DevTools Network มี 200 ของ `p10-8-recruitment-simple.js` กับ `p10-9-recruitment-quickstart.js`
- ลองตั้งแหล่งเมลและ Sync กับบัญชี HR ที่ได้รับสิทธิ์ ด้วยข้อมูลทดสอบก่อน
- ตรวจว่าข้อมูล Candidate / Queue เดิมยังอยู่ตามเดิม (ไม่สร้าง/ลบอีเมลซ้ำ)
- ตรวจ People, Payroll, Leave, Documents เนื่องจาก HTML เดิมมีโอกาสเกี่ยวกับเมนูอื่นด้วย

## ทดสอบ
- `node --check tools/recover-p10.9.1.mjs` ผ่าน
- ทดสอบ Git history แบบจำลอง: หน้า good → อัป bad → dry-run → restore good + script tags → สำรอง old → ยืนยัน `public/app.js` ไม่ถูกแตะ ผ่าน
- ยังไม่ได้รันกับประวัติ Git ของ Repo จริง หรือ Deploy / ทดสอบ Gmail Production
