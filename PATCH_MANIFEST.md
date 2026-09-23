# Nakna P9.12 — Smart Action Feedback

Base: P9.11 Global Action Feedback

## REPLACE
- `public/app.js`
- `public/index.html`
- `public/styles.css`

## Migration
- ไม่มี Migration ใหม่

## เปลี่ยนอะไร
- ยกเลิก popup โหลดซ้ำสำหรับ GET / เปิด modal / เปิดข้อมูล
- ปุ่มที่กดจะแสดง spinner เล็กเฉพาะเมื่อโหลดเกิน ~220ms
- การเปลี่ยนหน้า/refresh view ใช้ progress bar บางด้านบน แทน popup กลางจอ
- Save/Delete/Publish ที่เสร็จเร็วจะไม่แสดง popup กลางจอ
- Save/Delete/Publish ที่ใช้เวลามากกว่า ~450ms จะแสดง status compact เพียง 1 อัน
- เมื่อสำเร็จไม่แสดง success popup ซ้ำ เพราะ UI/toast เดิมเพียงพอ
- Error ยังแจ้งให้เห็นชัด
- ป้องกัน spinner ซ้ำในปุ่มที่มี `setButtonBusy()` อยู่แล้ว
- cache/version bump เป็น `P9.12.0`
