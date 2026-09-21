# Nakna P8.19 — Document Refresh & Draft Visibility Fix

ฐานที่ใช้: P8.18

## REPLACE
- `public/app.js`
- `public/index.html`
- `src/index.js`

## Migration
- ไม่มี Migration ใหม่
- ฐานข้อมูลควรมี migrations ถึง `0026_document_form_data.sql` จากเวอร์ชันก่อนหน้า

## แก้ไขหลัก
1. สร้าง Draft แล้วแสดงในหน้าเอกสารทันที ไม่รอ Overview API
2. `/api/documents` และ `/api/document-system/overview` โหลดแยกกัน ถ้า Overview บางส่วนพัง รายการเอกสารยังแสดงได้
3. Dashboard นับ Draft/รออนุมัติจากรายการเอกสารเป็น fallback
4. Action Center แสดง Draft ที่รออนุมัติจาก `/api/documents` ได้ แม้ Overview บาง section ล้มเหลว
5. Template section มี Standard Catalog fallback ไม่ค้าง “กำลังเตรียม Template”
6. Create API ส่งข้อมูลเอกสารที่เพิ่งสร้างกลับให้ Frontend เพื่อ optimistic render
7. Cache bust เป็น `P8.19.0`
8. Restore Employee HR Case response flow ที่หลุดจาก branch ภายหลัง P8.12
