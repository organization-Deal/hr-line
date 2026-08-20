Nakna HR V0.5.3 — LINE Card CI Refresh

ทับไฟล์เดิมแค่:
- src/index.js
- public/index.html (เปลี่ยนเลขเวอร์ชันใน Sidebar เท่านั้น)

ไม่ต้องทับ wrangler.jsonc / package.json / migrations
ไม่แตะ D1 schema, R2 binding, Google OAuth หรือ LINE secrets

สิ่งที่เปลี่ยน:
- LINE CI colors: Warm Off-white / People Teal / Deep Teal / Mint / Coral
- Employee Menu Flex Card
- Leave Type Card + คงเหลือแต่ละประเภท
- Leave Balance Card
- Date picker / Day part / Reason prompt
- Leave Submitted / Evidence / Approval / Decision Cards
- Check-in / Check-out Result Cards
- Attendance Status Card
- Location Request Card
- Success / Error / Warning Notice Cards
- Thai-first copywriting

Deploy แล้วตรวจ /api/health ต้องเห็น version 0.5.3
จากนั้นพิมพ์ "เมนู" หรือ "ขอลา" ใน LINE เพื่อดู UI ใหม่
