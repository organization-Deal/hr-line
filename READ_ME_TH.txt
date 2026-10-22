แพตช์ต่อจาก Nakna P10.11 UX/UI เท่านั้น
อัปไฟล์ตาม path ใน ZIP ทับ Repository เดิม แล้วรอ Deploy และ Refresh
ไม่ต้องลบไฟล์ ไม่ต้อง Migration
ป้าย UI และ window.NaknaUI.version ดึงรุ่นจาก public/release.js จุดเดียว
รุ่นปัจจุบัน P10.11 (เป็นการแก้ป้ายของรุ่นเดิม)
ครั้งต่อไปเมื่อปล่อยรุ่น ให้แก้ค่า version ใน public/release.js พร้อมโค้ดของรุ่นนั้น
ไม่ได้ตรวจ Git หรือหมายเลข Cloudflare อัตโนมัติ และป้ายไม่ยืนยันว่าทุกไฟล์ Deploy ครบ
_headers ปิด cache ของ release.js ถ้ามี _headers ของคุณเพิ่มจากฐานเดิม ให้รวมกฎนี้แทนการทับทั้งหมด
ทดสอบ node tests/test-release-version.mjs และ npm run audit ผ่าน
ยังไม่ได้ Deploy หรือทดสอบบนเว็บจริง
