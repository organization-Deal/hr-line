NAKNA HR V1.0-P7.3 PERFORMANCE HOTFIX

เอาไฟล์ใน ZIP ไปทับ path เดิมตามโครงสร้างได้เลย

ไฟล์ที่แก้:
- app.js
- public/app.js
- index.html
- public/index.html
- src/index.js

สิ่งที่แก้:
1) Dashboard โหลดก่อนด้วย API เดียว ไม่รอ API ทั้งระบบ
2) ข้อมูลหน้าที่เหลือ hydrate ภายหลังโดยไม่บล็อกหน้าเว็บ
3) ไม่ render ทุกหน้าที่ซ่อนอยู่พร้อมกัน ลด DOM/CPU ตอนเปิดเว็บ
4) เวลาเปลี่ยนเมนูค่อย render หน้านั้น
5) GET สถานะ LINE ไม่ยิง API ไป LINE ทุกครั้งที่เปิด/refresh เว็บอีกแล้ว
   การเช็ก LINE แบบ live ยังใช้ปุ่ม “ทดสอบ” ได้เหมือนเดิม
6) ตัด /api/bootstrap ออกจาก critical path ตอนเปิด Dashboard

ไม่แก้ schema / migration / ข้อมูลพนักงาน
