# Nakna P9.15 — Face Enrollment Rollout

รอบนี้แก้ Flow สำหรับบริษัทที่ใช้งานอยู่แล้วและพนักงานเช็กอินไปแล้ว ให้ HR สามารถพาพนักงานไปลงทะเบียนใบหน้าได้ทันทีโดยไม่ต้องรอเช็กอินวันถัดไป

## สิ่งที่เพิ่ม

- ปุ่ม `ส่ง LINE ให้คนที่ยังไม่ลงทะเบียน` ใน Settings > การเช็กอิน > Face Verification
  - ส่งเฉพาะพนักงาน Active ที่ยังไม่มี Face Template
  - แต่ละคนได้รับลิงก์เฉพาะบัญชีของตัวเอง
  - คนที่เช็กอินวันนี้แล้วก็ลงทะเบียนได้
  - หน้าลงทะเบียนแบบนี้ไม่สร้าง/แก้ไข Attendance
- ปุ่ม `ลงทะเบียน / ทดสอบบัญชีของฉัน`
  - จับคู่ HR/Owner กับ Employee Profile จาก LINE identity หรือ email
  - ถ้ายังไม่ลงทะเบียน จะเปิด Enrollment
  - ถ้าลงทะเบียนแล้ว จะเปิด Test Mode
  - Test Mode เทียบใบหน้าอย่างเดียว ไม่บันทึกเวลา
- เพิ่ม `ใบหน้า & การยืนยันตัวตน` ในเมนูพนักงาน LINE เมื่อบริษัทเปิด Face Verification
  - ยังไม่ลงทะเบียน -> Enrollment
  - ลงทะเบียนแล้ว -> Test Face Verification
- เพิ่ม `คัดลอกข้อความแจ้งทีม` แทนการทำ Shared Enrollment Link
  - ไม่สร้างลิงก์กลางที่อาจทำให้คนอื่นลงทะเบียนแทนบัญชีพนักงาน
- Standalone Face Enrollment/Test Mode ใน `attendance.html`
  - `?face=enroll` = ลงทะเบียนอย่างเดียว
  - `?face=test` = ทดสอบอย่างเดียว
  - `?face=manage` = ถ้ายังไม่มีให้ลงทะเบียน ถ้ามีแล้วให้ทดสอบ
- Test Mode มี Challenge/Liveness + Face Matching แต่ไม่ออก Attendance pass และไม่บันทึกเวลา
- Enrollment แบบ standalone ไม่ออก Attendance pass
- ยังไม่เก็บรูปภาพจากกล้องประจำวันเหมือนเดิม

## Backend API ใหม่

- `POST /api/attendance-face-enrollment/remind`
- `POST /api/attendance-face-enrollment/self-link`

## ไฟล์ที่ต้อง Replace

- `src/index.js`
- `public/app.js`
- `public/index.html`
- `public/styles.css`
- `public/attendance.js`
- `public/attendance.html`

## Migration

ไม่มี Migration ใหม่ ใช้ตาราง Face Verification และ Attendance token เดิมจาก P9.14 อยู่แล้ว

## หลัง Deploy

1. เปิด Settings > การเช็กอิน
2. เลือก `ช่วงลงทะเบียน` หรือ `บังคับยืนยันก่อนเช็กอิน`
3. กด `ส่ง LINE ให้คนที่ยังไม่ลงทะเบียน`
4. สำหรับการทดสอบของ Owner/HR กด `ลงทะเบียน / ทดสอบบัญชีของฉัน`
5. หลังพนักงานลงทะเบียน กด Refresh แล้วตัวเลข `ลงทะเบียนแล้ว` จะเพิ่มขึ้น
