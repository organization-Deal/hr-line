# Nakna P9.11 — Global Action Feedback

Base: P9.10 Mobile Modal System Fix

## REPLACE
- `public/app.js`
- `public/index.html`
- `public/styles.css`

## Migration
- ไม่มี Migration ใหม่
- ไม่แก้ Worker / Database

## สิ่งที่เปลี่ยน
- เพิ่ม feedback กลางระบบให้ปุ่มแทบทุกจุด ทั้งมือถือและคอม
- ทุกปุ่มมี tap/pressed feedback ทันที เพื่อยืนยันว่าระบบรับการกดแล้ว
- ถ้าปุ่มเริ่มโหลดข้อมูลด้วย GET API จะขึ้นกล่อง `กำลังโหลด...` อัตโนมัติหลัง ~120ms
- เมื่อข้อมูลพร้อมจะแสดง `พร้อมแล้ว` ชั่วครู่
- ถ้าโหลดไม่สำเร็จจะแสดงสาเหตุ/ข้อความ error
- Mutation เดิม (บันทึก/ลบ/อนุมัติ/ส่ง) ยังใช้ Action Status เต็มจอเดิม และไม่ชนกับ loading ใหม่
- เพิ่ม spinner บนปุ่มที่กำลังรอข้อมูลโดยไม่แก้ innerHTML ของปุ่ม
- Background requests / silent requests ไม่เด้ง popup รบกวนผู้ใช้
- Cache version `P9.11.0`

## เป้าหมาย UX
ผู้ใช้ต้องรู้ทันทีว่า:
1. แตะปุ่มสำเร็จแล้ว
2. ระบบกำลังโหลด/บันทึกอะไรอยู่
3. งานเสร็จแล้วหรือเกิด error
