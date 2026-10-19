NAKNA HR — Employee Service UX/UI Redesign
วันที่: 20 ต.ค. 2569

เปลี่ยนจากหน้า Employee Service ที่มีกล่องใหญ่และเมนูซ้ำ เป็น workspace เดียว:
- เรื่องถึง HR (ค้นหา/กรอง/เปิดเคสด้วยฟังก์ชันเดิม)
- ประกาศ (ค้นหา/กรอง/ดูการรับทราบ/ส่งประกาศด้วยฟังก์ชันเดิม)
- LINE พนักงาน (คำอธิบายการใช้ LINE นากนะกลาง ไม่แสดงปุ่มเชื่อม LINE OA บริษัท)

คง Backend/API/D1 ไว้เหมือนเดิม ไม่มี migration ใหม่
- โหลด /api/requests, /api/employee-service พร้อมกับ /api/hr-cases เฉพาะ HR และ /api/broadcasts เฉพาะผู้มีสิทธิ์
- ซ่อนเมนู 'แจ้ง HR' และ 'ประกาศ' ที่ซ้ำบน sidebar แต่เก็บ DOM/route เดิมเพื่อความเข้ากันได้
- ลิงก์เก่า hr-inbox หรือ broadcast จะเปิดแท็บใน Employee Service แทน
- ใช้ฟอร์มส่งประกาศ, รายละเอียดเคส, ดูการรับทราบจากฟังก์ชันเดิม
- ไม่มี MutationObserver เพิ่มใหม่ ไม่มีการแก้การเชื่อม LINE OA หรือ API ส่งข้อความ

ไฟล์ที่แก้จริง 3 ไฟล์:
public/index.html
public/app.js
public/ui/nk-employee-service.css

ไฟล์ตรวจ (เพิ่มใหม่):
scripts/verify-employee-service.mjs

วิธีลง
1) สำรอง/เปรียบเทียบ public/index.html และ public/app.js ของ repo ล่าสุดก่อนวางทับ
2) แตก ZIP ที่ root ของ repo hr-line
3) ตรวจ: node scripts/verify-employee-service.mjs
4) ตรวจ syntax: npm run check
5) commit/push แล้ว Deploy ด้วย npx wrangler deploy หรือคำสั่งเดิมใน CI
6) เปิด Employee Service และลองสร้าง/ส่งประกาศด้วยข้อมูลทดสอบ, เปิดเคสที่ได้รับสิทธิ์จริง

ข้อจำกัด: ทดสอบ UI ในเบราว์เซอร์ด้วย fixture บน 390/768/1440 px และตรวจ syntax ผ่าน;
ยังไม่ได้ทดสอบ LINE push, API / auth, การรับทราบ และการส่งจริงบน Production.
ชุดนี้ต่อจากซอร์ส hr-line-main (2).zip + Nakna-Rewards-Redesign-CHANGED-ONLY.zip
หากมี commit ใหม่หลังจากนั้น อย่าวางทับไฟล์เต็มโดยไม่ตรวจ diff เพราะจะลบงานล่าสุดได้
