NAKNA P10.11 — UX/UI repair (changed files only)
ฐาน: hr-line-main (3).zip ที่แนบวันที่ 22 ตุลาคม 2569

วิธีอัปเดต
1. แตก ZIP นี้ แล้วอัป public/, scripts/, tests/ ทับตำแหน่งเดียวกันใน Repository เดิม
   ต้องอัป public/index.html และ public/app.js พร้อมกัน อย่าวางไฟล์ลง Root ผิดตำแหน่ง
2. Commit และรอ Cloudflare Deploy สำเร็จ จากนั้น Hard Refresh / ปิดแล้วเปิด LINE ใหม่
3. ไม่ต้องรัน Migration สำหรับแพตช์นี้ (ไม่ได้เพิ่ม/แก้ Schema)
4. หากใช้ GitHub Web: เข้าโฟลเดอร์ public แล้วอัปไฟล์ภายใน public ของแพตช์ให้ตรงที่เดิม
   สำหรับ ui ให้อัปลง public/ui ส่วน scripts และ tests อยู่ Root ของ Repository

สิ่งที่แก้
- คืน HTML บัญชี Gmail แยก, เลือกแหล่งเมล, คิวคัดกรอง และเลือกหลายรายการ/คัดออก/ลบจากคิว/กู้คืน
  ใช้ API และขั้นตอนยืนยันเดิม ไม่สั่ง Sync Gmail อัตโนมัติจากแพตช์
- เพิ่มไฟล์ attendance-p10.css/js ที่หน้าเว็บเรียกแต่ไม่มีใน ZIP เดิม
- เชื่อมรายชื่อ/สรุปรายคนเข้าตัวแสดงข้อมูลเดิม และทำแท็บ/ช่วงเวลา/ตัวกรองใช้งานได้
- แสดงสถานะกำลังโหลด/ผิดพลาดพร้อมลองใหม่ ไม่แสดงข้อมูลเก่าเป็นผลของช่วงใหม่เมื่อโหลดล้มเหลว
- ขยายกล้องมือถือให้เต็มความกว้างและใช้พื้นที่สูงตามหน้าจอ พร้อม object-fit:cover
  ภาพตัวอย่างอาจถูกครอปขอบ แต่ตัวตรวจใบหน้ายังอ่านวิดีโอต้นฉบับเดิม
- เพิ่ม scripts/audit.mjs ให้คำสั่ง npm run audit ใช้งานได้
- เปลี่ยน cache version สำหรับหน้าเว็บและ CSS กล้อง

การตรวจที่ผ่าน
npm run audit (รวม npm run check)
node scripts/verify-screening-release.mjs
node scripts/verify-screening-bulk.mjs
node scripts/verify-recruitment-source-scope.mjs (14 กรณี)
node tests/test-p10.11.mjs (ทดสอบ DOM จำลอง)
node --check public/ui/attendance-p10.js
ตรวจลิงก์ static ใน index.html/attendance.html: ไม่มีไฟล์ปลายทางหาย และไม่มี ID ซ้ำ

ขอบเขต
ไม่ได้ Deploy / ไม่ได้แก้ข้อมูลจริง / ไม่ได้ส่ง LINE หรืออ่าน Gmail จริง
ยังไม่ได้ตรวจภาพหน้าจอผ่าน Browser และกล้องบนมือถือจริง
ต้องตรวจหลัง Deploy: เปิดกล้องใน LINE, สแกนใบหน้า, เปลี่ยนช่วงเวลา, ดูรายละเอียดพิกัด,
เลือก Gmail, ลองคัดออก/ลบจากคิว/กู้คืนด้วยรายการทดสอบ และเช็กสิทธิ์ HR/พนักงาน
ระบบแจ้งเตือน 12:30/13:00 และแพตช์ P10.10 ไม่ได้ถูกรวมในงาน UX/UI รอบนี้

ข้อจำกัดของชุดตรวจเดิม
verify-multi-gmail.mjs ไม่ผ่านที่ candidateDedupe เพราะตรวจหา SQL รูปแบบเก่าที่ไม่มีใน Source ฐาน
ไม่ได้แก้ Backend หรือเปลี่ยน assertion ให้ผ่าน จึงยังไม่รับรองการทำงาน Gmail หลายบัญชีแบบ End-to-End
scripts/audit.js และ src/audit.mjs รุ่นเก่ายังนับ optional/dynamic DOM เป็น HTML ที่ขาด
ไฟล์ scripts/audit.mjs ใหม่ตรวจ asset, ID ซ้ำ, mandatory bindings และ mount ของฟีเจอร์ที่แก้
ไม่ได้หมายถึงตรวจความถูกต้องระบบทุกโมดูลครบแล้ว
