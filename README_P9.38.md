# P9.38 Leave Overview Loading Fix
ฐาน: P9.37
- กันการโหลดสรุปพร้อมกันซ้ำเมื่อ renderAll หลายรอบ
- จำกัดคำขอ 12 วินาที และแสดงข้อผิดพลาดพร้อมปุ่มลองใหม่
- แยก log ปัญหาอ่าน D1 จากการแสดงหน้าเว็บ
- ไม่มี Migration ใหม่
ไฟล์ทับ: public/app.js และ src/index.js
Deploy: npx wrangler deploy
ตรวจสอบ Network ของ /api/leave-overview และ Log Worker หากยังไม่ผ่าน
