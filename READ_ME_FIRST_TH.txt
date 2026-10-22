NAKNA P10.14 ต่อจาก P10.13
อัป 5 ไฟล์ใน ZIP ทับ path เดิม รอ Cloudflare Deploy แล้ว Ctrl+Shift+R
ไม่ต้องลบไฟล์ใดหรือ Migration

นำออกจาก HTML จริง ไม่ใช่เพียงซ่อนด้วย CSS:
- เมนูและหน้าพักยืดกับนากนะ
- การ์ดเชื่อม LINE OA บริษัท, shortcut, ปุ่มตั้งค่า OA และ modal กรอก token
คง statusLineBadge/statusLineText และ LINE นากนะกลางไว้
ไม่เปลี่ยน src/index.js, LINE token, ฐานข้อมูล หรือระบบแจ้งเตือน HR
คง Recruitment P10.12 และสวัสดิการ P10.13
เพิ่มตรวจ retired UI ใน npm run audit เพื่อกัน HTML เก่าพากลับมาอีก

ทดสอบ npm run audit, test-release-version.mjs, test-p10.13-benefits.mjs, test-p10.12-recruitment.mjs ผ่าน
Audit ใช้ scripts/verify-line-oa-settings-retired.mjs และ scripts/verify-move-retired.mjs ที่มีใน ZIP ฐานเดิม
ยังไม่ได้ Deploy หรือทดสอบหน้าเว็บจริง
