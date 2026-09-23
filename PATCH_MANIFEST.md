# Nakna P9.10 — Mobile Modal System

Base: P9.09 Dashboard Command Center

## REPLACE ONLY
- `public/app.js`
- `public/index.html`
- `public/styles.css`

## Migration
- ไม่มี Migration ใหม่
- ไม่ต้องแก้ `src/index.js`

## แก้อะไร
- เปลี่ยน modal บนมือถือทั้งระบบให้มี vertical scroll เพียงชั้นเดียว
- Header ของ modal ติดด้านบน และ Footer action ติดด้านล่างโดยไม่บังข้อมูล
- รองรับ LINE iOS / Safari / Chrome และ `visualViewport` ตอนคีย์บอร์ดเด้งขึ้น
- เมื่อ focus input ระบบเลื่อน field ให้อยู่กลางพื้นที่ที่มองเห็นอัตโนมัติ
- แก้ Leave Profile โดยเฉพาะ: รายการสิทธิ์ลาไม่เป็น nested scroll อีกต่อไป
- แก้ nested scroll ใน Payroll Bulk, Payroll Components, Broadcast acknowledgement, Department/Position assignment, Organization Builder, Employee documents และ Help Center
- ปรับ Document HR Signature / Document Settings / Generate Document ให้ใช้ระบบ scroll เดียวกัน
- Mobile fields บังคับ 16px เพื่อลดปัญหา iOS zoom ตอนแตะ input
- Cache busting เป็น `P9.10.0`

## Dialog audit
ตรวจ dialog ทั้งหมด 44 ตัวใน `public/index.html` และใช้ mobile shell กลางชุดเดียวกัน
