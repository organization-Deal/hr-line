# Nakna P9.14 — Face Verification (No Daily Photo Storage)

## เป้าหมาย
เพิ่ม Face Verification ให้ Attendance เพื่อกันการฝากคนอื่นกดเช็กอินแทน โดยแยกจากกฎ Geofence เดิมอย่างชัดเจน

- Geofence = ตรวจสถานที่และสิทธิ์เช็กอินนอกพื้นที่
- Face Verification = ตรวจว่าเป็นเจ้าของบัญชีพนักงานจริง
- ไม่บันทึกรูปภาพจากการเช็กอิน/เช็กเอาต์ประจำวัน
- เก็บเฉพาะ Face Template/Descriptor แบบเข้ารหัสสำหรับพนักงานที่ลงทะเบียน

## ไฟล์ที่ต้องอัปเดต

### Backend
- `src/index.js`
- `migrations/0033_attendance_face_verification.sql`

### HR Backoffice
- `public/index.html`
- `public/app.js`
- `public/styles.css`

### Quick Attendance
- `public/attendance.html`
- `public/attendance.js`
- `public/attendance.css`

### Employee Invite / Onboarding
- `public/invite.html`
- `public/invite.js`
- `public/invite.css`

## ฟีเจอร์

### 1. โหมดระดับบริษัท
ใน Attendance Settings มี 3 โหมด
- `off` — ปิด Face Verification
- `enroll` — ช่วงลงทะเบียน พนักงานข้ามได้ Attendance เดิมยังทำงาน
- `required` — ต้องยืนยันใบหน้าก่อน Check-in และเลือกบังคับ Check-out เพิ่มได้

### 2. พนักงานเดิม
เมื่อเปิด `required`:
- ยังไม่มี Face Template → กด Check-in แล้วเข้าสู่ Enrollment ก่อน
- Enrollment สำเร็จ → ทำ Check-in ครั้งเดิมต่อทันที
- มี Template แล้ว → Liveness → Face Match → GPS → Attendance

### 3. พนักงานใหม่
หลังกรอก Employee Invite สำเร็จ ถ้าบริษัทเปิด Face Verification ระบบจะแสดงขั้นตอนลงทะเบียนใบหน้าตั้งแต่ Onboarding
- ทำตอนนั้นได้ทันที
- หากเลือกทำภายหลัง ระบบ Check-in ครั้งแรกจะบังคับอีกครั้งในโหมด `required`

### 4. Privacy / Data Storage
ระบบไม่ส่งหรือเก็บ JPEG/PNG/ภาพกล้องสำหรับ Face Verification
- Browser อ่านกล้องชั่วคราว
- สร้าง descriptor 128 ค่า
- ส่ง descriptor ให้ server
- server เข้ารหัส AES-GCM ก่อนเก็บใน `employee_face_profiles.template_encrypted`
- frame/image จากกล้องไม่ได้ถูก serialize หรือ upload
- attendance เก็บเฉพาะผล verification/evidence เช่น passed, model, timestamp และระยะ matching สำหรับ diagnostic

### 5. Liveness
มี basic browser-side liveness แบบสุ่มลำดับ
- กระพริบตา
- มองตรงแล้วหันหน้าไปด้านข้าง

> หมายเหตุ: เป็น anti-buddy-punch / basic anti-replay สำหรับ HR attendance ไม่ใช่ bank-grade biometric liveness

### 6. HR Control
- ดูจำนวนพนักงานที่ลงทะเบียนแล้ว / ยังไม่ลงทะเบียน
- ดูสถานะ Face Verification ใน People Profile
- HR รีเซ็ต Face Template ของพนักงานได้
- หลัง reset พนักงานต้อง Enrollment ใหม่
- Work Log แสดง evidence ว่า Check-in/Check-out ผ่าน Face Verify หรือไม่

## Database
Migration `0033_attendance_face_verification.sql` เพิ่ม:
- `attendance_face_settings`
- `employee_face_profiles`
- `attendance_face_challenges`
- `attendance_face_passes`
- `attendance_face_events`

ไม่มี column สำหรับรูปภาพใบหน้า

## Worker Secret
แนะนำให้ตั้ง secret แยกสำหรับ biometric data ก่อนเปิดใช้:

`NAKNA_BIOMETRIC_ENCRYPTION_KEY`

ระบบมี fallback ไปยัง integration encryption key เดิมเพื่อ compatibility แต่ production แนะนำใช้ secret แยก

## Runtime dependency
Face engine ใช้ `face-api.js 0.22.2` และโหลด model weights จาก CDN ขณะใช้งานครั้งแรก หาก network ไป CDN ไม่ได้ ระบบจะแจ้งว่าโหลด Face Verification ไม่สำเร็จและไม่แอบข้าม verification ในโหมด required

## Release
- Runtime: `P9.14-FACE-VERIFICATION`
- Feature: `attendance-face-verification-no-photo-storage`
