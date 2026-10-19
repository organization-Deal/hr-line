NAKNA HR — Engagement & Rewards UI + read-path update
======================================================
ไฟล์ที่เปลี่ยนจริง (7 ไฟล์):
  public/index.html
  public/app.js
  public/ui/nk-rewards-workspace.css   (ใหม่)
  public/learn.html
  public/learn.js
  public/ui/nk-rewards-portal.css      (ใหม่)
  src/index.js

ตรวจ Deploy เพิ่มเติม:
  scripts/verify-rewards-release.mjs

การติดตั้ง
1) สำรอง Commit ที่ใช้งานได้ก่อน
2) แตก ZIP ที่ root repository hr-line (อย่าสร้างโฟลเดอร์ซ้อน)
3) ตรวจ diff ก่อน merge โดยเฉพาะ src/index.js, public/app.js, public/index.html
   เพราะชุดนี้ประกอบบนซอร์สล่าสุดที่ได้จากไฟล์เดิมและแพตช์ Nakna ในบทสนทนานี้
   หากมี commit ใหม่หลังจากนั้น ให้ merge เฉพาะความเปลี่ยนแปลงของ Engagement ไม่ทับทั้งไฟล์ทันที
4) node scripts/verify-rewards-release.mjs
5) npm run check
6) npx wrangler deploy
7) Ctrl+Shift+R / เปิดหน้าใหม่จาก LINE

สิ่งที่แก้
- HR: คิวงาน > ของรางวัล > กติกา > ประวัติ > อันดับ (เปิด/ปิดได้)
- แสดงสถานะข้อผิดพลาด + ปุ่มลองใหม่ เมื่อ Engagement API ไม่สำเร็จ
- พนักงาน: แต้มพร้อมใช้, รางวัลแลกได้, ประวัติแต้ม 30 รายการ,
  ประวัติการแลกและสถานะ, ป้องกันการกดแลกซ้ำระหว่าง request
- API: การอ่าน /api/engagement/overview ไม่รันกติกาอัตโนมัติทุกครั้ง
  กติกาอัตโนมัติยังทำงานตาม Cron/การกดรันตามเดิม
- API พนักงาน: history scoped โดย client_id และ employee_id; ปิดการเปิดเผยอันดับเมื่อปิด leaderboard
- ใช้ CI Teal #04878A, responsive

ไม่ได้ทำ: ระบบเพดานงบประมาณรางวัลใหม่, Migration D1 ใหม่,
          การป้องกันธุรกรรมซ้ำระดับฐานข้อมูลสำหรับคำขอแลกพร้อมกันจากหลายอุปกรณ์
          (ต้องออกแบบ/ทดสอบธุรกรรม atomic เพิ่มต่างหาก)

ทดสอบในสภาพจำลอง (ไม่มีข้อมูลจริง):
- Syntax checks ผ่าน npm run check
- Desktop 1440 / Tablet 768 / Mobile 390 : ไม่มี JS page error หรือ overflow แนวนอน
- HR Tab / Catalog / History / Ranking แสดงข้อมูลจำลองถูกต้อง
- Employee Wallet / Private Transactions / Hide Leaderboard แสดงข้อมูลจำลองถูกต้อง

ต้องทดสอบกับ Production หลัง Deploy:
- หน้า HR มีข้อมูลจริง/ถ้า API ผิดพลาดแสดง Retry ได้
- เริ่มต้นระบบแต้มสำหรับบริษัทใหม่
- สร้างกติกาและสลับเปิด/ปิด แล้วดูอัปเดต
- สร้างรางวัล / ให้แต้มทดสอบหนึ่งคน
- เปิด LINE Employee Portal: ตรวจยอดแต้มและประวัติ
- พนักงานแลกรางวัล -> HR อนุมัติ/ปฏิเสธ/ส่งมอบ
- ตรวจว่าสถานะ/แต้มตรงกัน และไม่เกิดรายการเพิ่มเพราะ refresh หน้า
- หากเป็นรางวัลเงินสด ตรวจ Payroll ด้วยผู้มีสิทธิ์ก่อนใช้งานจริง

สำคัญ: ยังไม่ Deploy จริงและยังไม่ได้ทดสอบส่ง LINE/ข้อมูล D1 Production
