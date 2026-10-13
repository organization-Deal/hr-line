# P10.0 — ผลทดสอบที่รันจริง

วันที่ตรวจ: 13 ตุลาคม 2026 / build P10.0-ui1
ฐาน: ZIP ในบทสนทนาประกอบถึง P9.40 ไม่ได้ fetch Repository Production

## ผล
| ชุดตรวจ | ผ่าน | ขอบเขต |
|---|---:|---|
| Viewport matrix | 108/108 | 18 views × 320, 390, 430, 768, 1024, 1440 CSS px; document ไม่มีแนวนอนล้นจอในข้อมูลจำลอง |
| Interaction | 31/31 | navigation, drawer/ESC, employee PATCH, leave tabs/filter/status, Retry503, permissions mirror, reduced motion, DOM ID, observer |
| Extended | 27/27 | 8 settings categories × 2 widths, 7 original forms, payroll input/locked mode/grouped headers, runtime |
| Contract/static | 58/58 | original IDs/field constraints, API-bearing source lines, file hashes, assets, syntax |

`npm run check` เดิมผ่าน (9 JavaScript files) และ `node --check public/ui/p10.js` ผ่าน
ไม่มี pageerror หรือ render exception ใน test harness รอบสุดท้าย
248 บรรทัดใน app.js ที่มี /api/ ตรงกับฐานเดิมทุกบรรทัด รวม endpoint ใน handler ไม่เปลี่ยน
src/index.js และทุกไฟล์ใน src/migrations/scripts เดิมตรงกับฐานแบบ byte-for-byte
SHA256 backend: `aef4fb19a0bcabb42dc52735d3b92bc1ec5e9e22772c3bc478553507dd7d72d1`

## เงื่อนไขการทดสอบ
ใช้ Playwright + Chromium ผ่าน page.set_content; app.js จริง แต่หยุด boot ที่ต้อง Login และใช้ fetch mock ที่เก็บ request
ข้อมูลพนักงาน/ใบลา/เงินเดือนเป็นข้อมูลจำลอง ไม่ใช่ข้อมูลลูกค้าจริง
มีการส่ง original employee PATCH และ payroll cell PUT ไปยัง mock แล้วตรวจว่า handler/field ยังถูกใช้
ตัวเลขจาก mock ไม่พิสูจน์สูตรภาษีหรือเงินเดือนฝั่ง Server (ไม่ได้แก้สูตร)
ใช้ font fallback ที่ติดตั้งในเครื่องระหว่าง offline QA; Production ยังคงการเรียกฟอนต์เดิม ไม่มี font file ในแพ็ก

## ข้อจำกัด
ไม่ได้ทดสอบ Production D1, Google Drive/R2, LINE OA/WebView บนอุปกรณ์จริง, WebKit/Safari, permission camera/GPS จริง, payment หรือ load test หลายผู้ใช้
ไม่มีการเรียก API ที่เขียนข้อมูลไปยังบริษัทจริง ไม่มีการ Deploy
Viewport pass ไม่ได้แปลว่าทุกตำแหน่งของทุกข้อมูลยาว/ทุก modal ทดสอบครบ
Portal 7 หน้าได้รับ skin และถูกตรวจ ID/JS unchanged; submission จริงของทุก Portal ยังต้อง UAT

## Performance
controller ใหม่ไม่มี fetch/XHR/localStorage/sessionStorage, ไม่เพิ่ม API หรือโหลดโมดูลเพิ่ม
observer disconnect ระหว่างแก้ DOM และหยุดนิ่งได้ในการทดสอบ idle ไม่มี loop
ภาพแบรนด์ที่เรียกจากหน้า UI: 1,390,638 → 2,634 bytes (ไฟล์รูปเดิมยังอยู่)
ตัวเลขนี้เป็นขนาดไฟล์ ไม่ใช่ผลวัด LCP/INP หรือเวลาบันทึก Production
UI layer เพิ่ม CSS/JS รวม 80,387 bytes ก่อนบีบอัด โดยไม่เพิ่ม framework

## UAT ก่อน Production
ทดสอบใน branch/staging กับบัญชีสิทธิ์ HR/Owner/พนักงานตามจริง: เปิดทุกเมนู, สลับบริษัท, แก้พนักงาน, เปิด/อัปเอกสาร, ยื่น/อนุมัติใบลา, กรองทุกช่วง, ดาวน์โหลด CSV/Excel, ทดลองรอบเงินเดือนที่ยังไม่ Lock และยืนยันรอบ Lock แก้ไม่ได้
ตรวจบน iPhone LINE/Safari และ Android Chrome โดยเฉพาะ keyboard, file chooser, biometric และการกลับจาก browser
อย่าใช้ใบลาจริงหรือ Publish เงินเดือนจริงเพื่อทดสอบ UI
