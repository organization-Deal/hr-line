# P9.14 Test Result

Validation ที่รันแล้วใน patch นี้:

- `node --check src/index.js` — PASS
- `node --check public/app.js` — PASS
- `node --check public/attendance.js` — PASS
- `node --check public/invite.js` — PASS
- `public/index.html` duplicate IDs — PASS (0)
- `public/attendance.html` duplicate IDs — PASS (0)
- `public/invite.html` duplicate IDs — PASS (0)
- CSS brace balance: `styles.css` — PASS
- CSS brace balance: `attendance.css` — PASS
- CSS brace balance: `invite.css` — PASS
- SQLite smoke test for migration `0033_attendance_face_verification.sql` — PASS
- Face profile schema checked: no photo/image/blob column — PASS
- Frontend face flow checked for image serialization APIs (`toDataURL`, `toBlob`, JPEG/PNG upload) — PASS / none found
- Runtime release markers — PASS
- Attendance + onboarding Face API routes present — PASS

## ยังต้องทดสอบบนอุปกรณ์จริงหลัง Deploy
- LINE in-app browser iPhone
- Safari iPhone
- Android LINE/Chrome (ถ้าใช้งาน)
- กล้องหน้า permission denied / allowed
- Enrollment คนใหม่
- Existing employee first Check-in enrollment
- Face match คนเดิม
- Face mismatch คนอื่น
- Blink / head-turn liveness ในแสงมืดและแสงย้อน
- Outside geofence + employee permission allowed
- Outside geofence + permission denied
- Check-out verification toggle

Threshold เริ่มต้น: Euclidean face distance `0.56` ต้อง calibrate จากพนักงานจริงก่อน rollout ทั้งบริษัท
