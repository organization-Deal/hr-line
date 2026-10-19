NAKNA HR — REMOVE COMPANY LINE OA SETTINGS (UI ONLY)
===============================================
ชุดนี้ต่อจาก Nakna-HR-REMOVE-STRETCH-CHANGED-ONLY.zip รอบก่อน
ไฟล์ที่แก้: public/index.html, public/app.js
ไฟล์ตรวจ: scripts/verify-line-oa-settings-retired.mjs

แก้แล้ว:
- เอาหัวข้อ LINE Official Account ของบริษัทและช่องเชื่อม OA ออกทั้งหมด
- เอา shortcut / ปุ่มเชื่อม / modal ใส่ Token และ Webhook ของ OA บริษัทออก
- สถานะ LINE นากนะกลางยังมองเห็นได้ (ไม่มีปุ่มตั้งค่าเพิ่มเติม)
- 2/3 readiness จะนับ LINE กลางที่พร้อมใช้งานเป็นพร้อม โดยไม่บังคับ OA ของบริษัท
- หน้า Google ยังอยู่และใช้งานเหมือนเดิม
- API, database, LINE messaging และ OA ที่เคยเชื่อมไว้ ไม่ถูกลบหรือยกเลิกโดยอัตโนมัติ

วิธี Deploy:
1. อัปไฟล์จาก ZIP ลง Root ของ Repo hr-line โดยให้ public/index.html และ public/app.js ทับที่เดิม
2. Commit/Push ไป Branch ที่ Cloudflare ใช้จริง
3. Cloudflare Deploy command (แนะนำ):
   node scripts/verify-line-oa-settings-retired.mjs && npx wrangler deploy
4. หลัง Deploy กด Ctrl+Shift+R เพื่อโหลดไฟล์ใหม่ แล้วไป ตั้งค่า > การเชื่อมต่อ
5. ควรเหลือเพียงสถานะ LINE สำหรับพนักงาน (ดูอย่างเดียว) และ Google พร้อมการเชื่อมต่อ

ข้อจำกัด:
- ไม่ได้ยกเลิก/ลบการเชื่อม OA บริษัทที่เคยมีอยู่ และไม่ได้ปิด backend endpoints
- หากต้องการถอดระบบ OA บริษัทถาวร ต้องสำรวจผลกระทบกับลูกค้าที่ยังเชื่อมอยู่ก่อน
- ไม่ต้องทำ Migration และไม่ต้องแก้ Secrets
