# Nakna P9.28 — HR Daily Summary Delivery Fix

ฐานที่แก้: P9.27-HR-DAILY-1300 จากไฟล์แนบในบทสนทนานี้
รุ่นใหม่: P9.28-HR-DAILY-DELIVERY-FIX

## สาเหตุที่ตรวจพบและทำซ้ำได้
ใน src/index.js ของ P9.27 บรรทัด 10761 เรียก
    await ensureAttendanceRetroRequestsReady(env.DB);
แต่ฟังก์ชันชื่อนี้ไม่มีอยู่ในไฟล์ ฟังก์ชันที่มีจริงคือ ensureAttendanceRetroReady(db)
ที่บรรทัด 6810 ทำให้ตัวส่งสรุปหยุดด้วย ReferenceError ก่อนค้นหาผู้รับและก่อนส่ง LINE
ได้ทดสอบเรียกฟังก์ชันจากโค้ด P9.27 ตรงเวลา 13:00 จำลองแล้วได้ข้อผิดพลาดนี้จริง
การตรวจ syntax อย่างเดียวไม่ตรวจพบชื่อฟังก์ชันที่หายไปในเส้นทางนี้

มีปัญหาเพิ่มเติมในโค้ดเดิม:
- getDailyHrLineRecipients เริ่มจาก employees และใช้ email ไปหา users; ไม่รองรับ HR/ผู้ดูแลที่มีแต่บัญชี users
- role ในเงื่อนไขผู้รับมีเฉพาะ hr/hr_admin; Owner/Co-Owner ไม่ถูกเพิ่มด้วยสิทธิ์บัญชีโดยตรง
- ทั้ง scheduled() และ sendDailyHrStatusSummary() จำกัดให้ clock.time เท่ากับ 13:00 เท่านั้น
- บันทึกสำเร็จรวมต่อบริษัท; ถ้าส่งสำเร็จบางผู้รับจะกันผู้รับที่ล้มเหลวจากการส่งครั้งต่อไป

## สิ่งที่แก้
1. เรียก ensureAttendanceRetroReady ที่มีอยู่จริง
2. รวมผู้รับจากบัญชี company_members + users และข้อมูลพนักงานแบบเดิม ตรวจสถานะ active และ provider scope
   ใช้สิทธิ์ผู้ดูแล HR เดิมในระบบ: owner/co_owner/hr_admin/hr ไม่เพิ่มสิทธิ์ใหม่ให้ใคร
   manager/payroll_admin/approver/employee ไม่ได้สิทธิ์รับโดย role เพียงอย่างเดียว
   พนักงาน HR แบบเก่าตามแผนก/ตำแหน่ง HR ที่ตรงชื่อหรือสิทธิ์ hr_request.approve ยังรับสรุปพื้นฐานได้
   เรื่องส่วนตัวถึง HR ถูกตัดออกจากสรุปของผู้รับที่ไม่มีสิทธิ์ canManagePeopleAdmin
3. ทำงานรอบ 13:00 เวลาไทย และตรวจรายการที่ยังส่งไม่สำเร็จในช่วง 13:00–17:59 น.
   ถ้า deploy ช้าหรือ Cron พลาดนาที 13:00 จะไม่ต้องรอวันถัดไป หาก Cron ยังทำงานในช่วงนี้
   แสดงเวลาข้อมูลจริงบนการ์ด ไม่อ้างว่าข้อมูลที่ดึง 13:21 เป็น snapshot ตอน 13:00
4. บันทึกแยกบริษัท/วันที่/เวลา/LINE provider/ผู้รับ ล็อกการส่งพร้อมกันด้วย conditional UPDATE
   ใช้ X-Line-Retry-Key และ snapshot เดิมสำหรับ retry, timeout 10 วินาที, exponential backoff สูงสุด 6 ครั้ง
   Retry อัตโนมัติเฉพาะ network/timeout/server errors หรือกรณียังอ่าน token ไม่ได้
   HTTP 4xx หยุดและแสดงสถานะให้แก้การเชื่อมต่อ/โควตาก่อน ไม่วนยิงคำขอที่ถูกปฏิเสธ
   HTTP 409 ถือว่า LINE รับแล้วก็ต่อเมื่อมี x-line-accepted-request-id
   LINE รับคำขอไม่ใช่การยืนยันว่าข้อความถึงมือถือหรือถูกอ่านแล้ว
5. แยกข้อผิดพลาดต่อบริษัท/ผู้รับ ป้องกันบริษัทหนึ่งล้มแล้วหยุดบริษัทอื่น
6. เก็บ heartbeat ของ Cron และสถานะการส่งเพื่อเช็กใน LINE ได้

## คำสั่งใน LINE (แชตส่วนตัวกับนากนะ)
สรุป HR วันนี้
    ดูสรุปทันทีด้วย reply message เฉพาะผู้มีสิทธิ์ ไม่ส่งให้พนักงานคนอื่น
    ไม่บันทึกเป็นความสำเร็จของรอบอัตโนมัติ และไม่ใช่การทดสอบโควตา push
สถานะสรุป HR
    ดูรุ่นระบบ, Cron ล่าสุด, จำนวนผู้รับที่มีสิทธิ์, จำนวนที่ LINE รับคำขอ,
    และสถานะการส่งของบัญชีตนเอง รวมถึง error 400/401/403/429 ฯลฯ
ถ้ามีสิทธิ์หลายบริษัท ระบบให้เลือกบริษัทก่อน ไม่เดาบริษัทเอง
ไม่แสดงสรุปพนักงานใน group/room และตรวจสิทธิ์อีกครั้งเมื่อกดปุ่ม

GET /api/hr/daily-summary/status
    ต้องล็อกอินและมีสิทธิ์ canManagePeopleAdmin ในบริษัทปัจจุบัน
    ไม่เปิดเผย LINE user IDs, tokens, retry keys หรือเนื้อหา snapshot

## วิธีติดตั้ง
แพ็กนี้ส่งเฉพาะไฟล์ระบบที่แก้ + ชุดทดสอบ + เอกสาร ไม่ใช่ Full package
สำรอง src/index.js ของระบบที่ใช้งานอยู่ก่อน
วาง src/index.js จาก ZIP ทับ src/index.js ของโปรเจกต์ P9.27
ถ้ามีการแก้โค้ดอื่นหลัง P9.27 ต้อง merge ไม่ใช่ทับงานใหม่ด้วยฐานเก่า
ไฟล์ scripts/test-hr-daily-p928.mjs เป็นชุดทดสอบ ไม่จำเป็นต่อการทำงานบน Worker

รันจากโฟลเดอร์โปรเจกต์:
    npm run check
    npx wrangler deploy
หรือ commit/upload ไฟล์เข้าระบบ GitHub ที่ผูก deploy ไว้อยู่แล้วและรอ deploy สำเร็จ

ไม่มีไฟล์ migration ใหม่ ไม่ต้องเปลี่ยนข้อมูล binding DB/R2/secrets
ระบบสร้าง hr_daily_status_deliveries และ hr_daily_status_runtime อัตโนมัติ
hr_daily_status_logs เดิมยังคงอยู่ ไม่ลบข้อมูล Attendance/Payroll/Leave

## ตัวตั้งเวลา Cloudflare ต้องยังอยู่
ไฟล์ wrangler.jsonc ในฐานต้นฉบับที่แนบมามีค่า:
    "triggers": { "crons": ["* * * * *"] }
แพ็กนี้ไม่ทับ wrangler.jsonc เพื่อไม่กระทบ Database ID/Bindings ที่ใช้งานจริง
ไม่ต้องสร้าง Cron เพิ่มถ้ามีค่ารันทุกนาทีอยู่แล้ว
ตรวจที่ Cloudflare > Workers & Pages > hr-line > Settings > Triggers > Cron Triggers
หากไม่มี ให้กำหนดใน wrangler.jsonc ของ environment ที่ deploy แล้ว deploy อีกครั้ง
สำหรับโครงการนี้ควรคง Cron ทุกนาทีไว้ เพราะงานเตือนอื่นใช้ร่วมกัน
Cloudflare ใช้ UTC แต่ตัวโค้ดแปลงเป็นเวลาไทยอยู่แล้วเมื่อใช้ Cron ทุกนาที
การเพิ่ม/แก้ Cron อาจใช้เวลาประกาศทั่วระบบถึง 15 นาที

## ตรวจหลังติดตั้ง
พิมพ์ 'เวอร์ชัน' ต้องเห็น P9.28-HR-DAILY-DELIVERY-FIX
พิมพ์ 'สรุป HR วันนี้' ต้องได้สรุปหรือข้อความสิทธิ์/ข้อผิดพลาด ไม่ใช่เงียบ
พิมพ์ 'สถานะสรุป HR' เพื่อดู Cron และสถานะส่งอัตโนมัติแยกต่างหาก
ถ้าเพิ่ง deploy และ Cron ยังไม่เคยเรียก handler นี้ จะเห็น 'ยังไม่พบการทำงานของ Cron'
จึงต้องตรวจ Trigger และรอการเรียกจริง ไม่ใช่สรุปทันทีว่า Trigger ถูกลบ
หลัง 18:00 น. ไม่ส่งรอบย้อนหลังอัตโนมัติแล้ว แต่ขอดูสรุปเองได้
หาก LINE ตอบ HTTP 4xx ต้องแก้สาเหตุ ในวันนั้นยังดูด้วยคำสั่ง reply ได้
รอบใหม่ในวันถัดไปจะใช้ delivery key ใหม่

## ข้อจำกัดและความเข้ากันได้
ไม่ได้ตรวจ Logs, Cron ที่ deploy จริง, Database จริง หรือส่งทดสอบเข้า LINE ของผู้ใช้
ผลที่ตรวจคือไฟล์ต้นฉบับและโค้ดใหม่ในเครื่องทดสอบเท่านั้น
หากมีรายการส่งสำเร็จจากระบบเดิมซึ่งเก็บแค่จำนวนรวมต่อบริษัท จะระบุผู้รับเก่าไม่ได้
การอัปเกรดวันแรกจึงอาจมีสรุปเพิ่มหนึ่งครั้งสำหรับผู้รับเดิม; รุ่นใหม่นับและกันซ้ำรายผู้รับจากนั้น
ข้อมูลคนไม่เช็กอิน/ใบลา/ตารางงานใช้กฎจาก getDashboard เดิม ไม่ได้เปลี่ยนสูตร Attendance/Payroll ในแพ็กนี้

## ผลทดสอบ
npm run check ผ่าน (9 JavaScript entry files)
26/26 automated tests ผ่านด้วย Node 22.16.0 + SQLite ในเครื่องและ mock LINE HTTP
รวม reproduction ของ P9.27, 13:21 catch-up, account-only Co-Owner, canonical email,
ผู้รับซ้ำ, หลายบริษัท, provider scope, สิทธิ์ถูกถอน, กลุ่ม LINE,
5xx/401/409/429, network failure, retry key คงเดิม, retry limit, Cron heartbeat,
ข้อมูลส่วนตัวของ HR และ authenticated diagnostics endpoint
ไม่ได้อ้างว่าได้ทดสอบ Cloudflare D1/LINE Production แล้ว

ชุดทดสอบรันได้ด้วย Node 22+:
    node --test scripts/test-hr-daily-p928.mjs
เคส reproduction P9.27 จะ skip ถ้าไม่ได้ระบุ P927_SOURCE เป็น path ของ src/index.js รุ่นเดิม

## Hash สำหรับตรวจไฟล์
P9.27 src/index.js SHA256: 341013a1567816c432c2be15da60b73fea92b1876f46ad06b4e880c900205b77
P9.28 src/index.js SHA256: 5e9b20ebc316be558c49f87dc176e6106c62aee1b89de3169c482a65777e89ac

## เอกสารอ้างอิง
Cloudflare Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/
Cloudflare Scheduled Handler: https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/
LINE retry keys / acceptance semantics: https://developers.line.biz/en/docs/messaging-api/retrying-api-request/
