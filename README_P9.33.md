# Nakna P9.33 — Employee Document Upload Fix

แก้ปัญหาเมนู **พนักงาน > เอกสาร > อัปโหลดไฟล์** ที่กดแล้วเหมือนค้าง/ไม่อัปโหลด

## สาเหตุที่แก้

1. หน้าเว็บใช้ `fetch()` ตรงสำหรับอัปโหลดเอกสาร ทำให้ไม่ได้ใช้ timeout / session error handling / mutation feedback ชุดเดียวกับ API หลัก
2. หลังอัปโหลดสำเร็จ หน้าเว็บเรียก `loadAll()` ทั้ง Dashboard ทำให้ปุ่มค้างจนผู้ใช้คิดว่าอัปโหลดไม่สำเร็จ
3. ฝั่ง Server ผูกการอัปโหลดกับ Google Drive 100% ถ้า Drive หลุดสิทธิ์/ช้า/ยังไม่พร้อม เอกสารจะถูกบล็อกทั้งหมด
4. การเปิดไฟล์เดิมอาศัย Google Drive URL โดยตรง แทนที่จะเปิดผ่านสิทธิ์ของ Nakna

## สิ่งที่เปลี่ยน

- `api()` รองรับ `FormData` โดยไม่เขียน `Content-Type` ทับ multipart boundary
- อัปโหลดเอกสารผ่าน API helper กลาง พร้อม timeout 60 วินาทีและข้อความสถานะค้างบน Modal
- หลังสำเร็จ refresh เฉพาะรายการเอกสารและรายชื่อพนักงาน ไม่ reload ทั้งระบบ
- Google Drive ยังเป็น storage หลักเหมือนเดิม
- ถ้า Google Drive ใช้ไม่ได้และ Worker มี `EVIDENCE_BUCKET` ระบบ fallback เก็บไฟล์ private ใน R2 โดยอัตโนมัติ
- เพิ่ม secure route `/api/employee-documents/:id/file` เพื่อเปิดไฟล์หลัง Login โดยไม่ต้องพึ่ง public Drive link
- ตรวจชนิดไฟล์ฝั่ง Server: PDF / PNG / JPG / JPEG / WEBP / DOC / DOCX
- จำกัด 10 MB ทั้ง Client และ Server
- เพิ่ม schema guard สำหรับ `storage_key` และ `file_size` อัตโนมัติ

## ไฟล์ที่เปลี่ยน

- `public/app.js`
- `src/index.js`

ไม่มี Migration ที่ต้องรันเอง เพราะ schema guard จะเพิ่มคอลัมน์ที่ขาดอย่างปลอดภัยตอนใช้งานครั้งแรก

## วิธีติดตั้ง

วางไฟล์ 2 ตัวทับของเดิม แล้ว Deploy:

```bash
npx wrangler deploy
```

## วิธีทดสอบหลัง Deploy

1. Dashboard > พนักงาน
2. เลือกพนักงาน 1 คน > เอกสาร
3. เลือก PDF หรือรูปเล็กกว่า 10 MB
4. กด `อัปโหลดไฟล์`
5. ต้องเห็นสถานะ `กำลังส่ง...`
6. สำเร็จแล้วไฟล์ต้องโผล่ในรายการทันที โดย Dashboard ไม่โหลดใหม่ทั้งหน้า
7. กด `เปิดไฟล์` ต้องเปิดผ่าน `/api/employee-documents/<id>/file`
8. ลองไฟล์เกิน 10 MB ต้องถูกปฏิเสธทันที

หาก Google Drive หมดอายุและไม่มี R2 fallback ระบบจะแจ้งสาเหตุชัดเจนแทนการค้างเงียบ
