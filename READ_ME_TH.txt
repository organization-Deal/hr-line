แก้หน้าขาวหลังติดตั้ง VERSION_LABEL_FIX
สาเหตุ: dataset.naknaVersion สร้าง data-nakna-version บน html ทำให้ selector เลือก html และ textContent ล้าง DOM ทั้งหน้า
แก้: ใช้ data-nakna-release บน root และเลือกเฉพาะ span[data-nakna-version]

1. อัป public/release.js ใน ZIP ทับ public/release.js บน GitHub
2. รอ Cloudflare Deploy สำเร็จ
3. กด Ctrl+Shift+R เปิดเว็บใหม่
ไม่ต้องทับ index.html ไม่ต้องลบข้อมูล ไม่ต้อง Migration
ยังแสดง UI P10.11 เพราะเป็นการแก้ไฟล์ป้ายของรุ่นนี้
ทดสอบ syntax, audit และ regression กันการเขียนทับ html ผ่าน
ยังไม่ได้ Deploy ให้
