# Nakna P10.9.1 — Recruitment Quick Start (ready-to-upload)

**ปัญหา:** P10.8 และ P10.9 มีไฟล์ UI แล้ว แต่ HTML ยังไม่ได้เรียก จึงไม่ปรากฏปุ่ม “เริ่มรับใบสมัคร” บนบัญชี Gmail HR.

**สำหรับผู้ที่ใช้อยู่บน P10.1 Workspace ตามที่แถบด้านข้างแสดง** ชุด `public/index.html` ใน ZIP ประกอบจากฐาน P10.1 Workspace แล้วเพิ่ม tag ที่จำเป็นให้เสร็จ และรวมไฟล์ UI ของ P10.5, P10.7, P10.8, P10.9 ให้ครบ.

### อัปผ่าน GitHub (ไม่ต้องพิมพ์โค้ด HTML)
1. สำรอง/สร้าง Branch ของ Repo ปัจจุบันก่อน เพราะไฟล์ `public/index.html` ที่แนบเป็นไฟล์ประกอบจาก **ฐาน P10.1 Workspace** ไม่ใช่สำเนา HTML Production ที่ดึงมาจาก GitHub.
2. ถ้าใน Repo ไม่มีการแก้ `public/index.html` เพิ่มหลัง P10.1 นอกเหนือจาก P10.4/P10.5/P10.7/P10.8/P10.9 ให้แตก ZIP แล้วอัป **`public/index.html` และไฟล์ 8 ตัวใน `public/ui`** ลงตำแหน่งตามโฟลเดอร์เดิม. ไม่อัป/ทับ `public/app.js` หรือ `src/index.js`.
3. ถ้า `public/index.html` ปัจจุบันมีการแก้ฟีเจอร์อื่นเพิ่มแล้ว **ห้ามวางทับไฟล์ index.html ใน ZIP นี้** เพราะอาจย้อน UI อื่น ให้ใช้วิธี Merge ด้านล่างแทน.
4. รอ Cloudflare Deploy สำเร็จแล้ว Hard Refresh; Recruitment ควรเห็นปุ่ม “เริ่มรับใบสมัคร” บนบัญชี hr.info@dealinvests.com ที่ยังไม่ตั้งแหล่งเมล.
5. กดปุ่มเพื่อเปิดฟอร์มตั้งค่าแบบง่าย แล้วรอระบบยืนยันการบันทึก จากนั้นกด Sync ครั้งแรกเพื่อให้ Gmail ส่งเมลเข้าคิวคัดกรอง.

### Merge ที่ปลอดภัยกว่า หากมี HTML เวอร์ชันใหม่/เพิ่มเติม
คัดลอกไฟล์ใน `public/ui` และ `tools/apply-p10.9.1-safe.mjs` ไปยัง Repo เดิม แต่ **อย่าคัดลอก `public/index.html` จาก ZIP** จากนั้นรัน:

```bash
node tools/apply-p10.9.1-safe.mjs --dry-run
node tools/apply-p10.9.1-safe.mjs
npm run check
npx wrangler deploy
```

ตัวติดตั้งเพิ่มเฉพาะลิงก์ CSS/JS ที่ยังขาด และเก็บสำรอง `public/index.html` เดิมไว้ใน `.nakna-p1091-backup/index.html`.

### ตรวจว่าโหลดขึ้นจริง
เปิด Console (F12):
```js
({
  simple: window.NaknaRecruitmentSimple?.version,
  quickstart: window.NaknaRecruitmentQuickstart?.version,
  button: !!document.querySelector('.p109-start')
})
```
ต้องได้ `P10.8-simple-gmail-1`, `P10.9-recruitment-quickstart-1`, `true` ตามลำดับเมื่อบัญชี Gmail ยังไม่ได้ตั้งค่า.

**ไม่แก้ Backend, D1, API หรือ Google OAuth และไม่มี Migration.** ยังไม่ได้ทดสอบกับบัญชี Gmail/Cloudflare Production จริง.
