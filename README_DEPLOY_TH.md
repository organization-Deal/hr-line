# Nakna HR — Recruitment Screening Queue V1 (20 ตุลาคม 2569)

## เปลี่ยนอะไร
- หน้า Recruitment: แยก Gmail Inbox, **คิวคัดกรอง**, และ Candidate Pipeline อย่างชัดเจน
- เมล Sync ใหม่ (ทั้ง Inbox ที่เชื่อมใหม่และ Gmail หลักแบบเดิม) **ไม่สร้าง Candidate อัตโนมัติ**
- คัดด้วยคะแนนอย่างระมัดระวัง: น่าจะสมัครจริง / รอตรวจ / ไม่เกี่ยวข้อง แต่ **HR ต้องกดรับเอง** ทุกกรณี
- แสดงผู้ส่ง หัวข้อ เนื้อหาย่อ ที่มา วันเวลา ชื่อไฟล์แนบ เหตุผล และคะแนน
- HR สามารถรับเป็นผู้สมัคร / ตั้งรอตรวจ / คัดออก และดูประวัติคัดออกได้
- เมื่อรับแล้วจึงสร้างหรือเชื่อม Candidate เดิมด้วย Email ไม่สร้างคนใหม่โดยไม่จำเป็น
- เมลย้อนหลังที่เคยสร้าง Candidate ไว้ (เช่น Google/PEAK/Airbnb) จะไม่ถูกลบจาก D1 แต่ Candidate Gmail ที่ยัง stage='new' และไม่มีผลรับจาก HR จะถูกกรองออกจาก Pipeline; ดูและพิจารณาในคิวคัดกรองแทน
- ผู้สมัครที่ถูกเลื่อนไปขั้นสัมภาษณ์/Offer แล้วจะไม่ถูกย้ายขั้นหรือซ่อนอัตโนมัติ
- ไม่มีการเพิ่ม Analytics/AI LLM และไม่แสดงชื่อเมล/ข้อมูลพนักงานแก่ role ที่ไม่มีสิทธิ์ HR

## ไฟล์ที่เปลี่ยน (5 ไฟล์) + ตัวตรวจ
- `src/index.js`
- `public/app.js`
- `public/index.html`
- `public/ui/nk-recruitment-screening.css` **(ใหม่)**
- `migrations/0039_recruitment_screening.sql` **(ใหม่)**
- `scripts/verify-screening-release.mjs` (เครื่องมือตรวจ)
- `recruitment-screening.patch` (ทางเลือกสำหรับ merge เข้ากับโค้ดใหม่กว่า)

## คำเตือนสำคัญก่อน Deploy
โค้ดชุดนี้อิงฐานเวอร์ชัน **Nakna-Multi-Gmail-Recruitment-CHANGED-ONLY.zip** ในแชต ไม่สามารถอ่าน Commit ล่าสุดของ GitHub Production ได้ในรอบนี้ ถ้ามีการแก้ `src/index.js`, `public/app.js`, หรือ `public/index.html` เพิ่มภายหลัง **อย่าเอาไฟล์เก่าทับ** ให้ merge ส่วน `recruitment-screening.patch` หรือทดสอบ Diff ก่อน

## ติดตั้ง
1. สำรอง Commit ปัจจุบันของ Repo `hr-line`
2. เปรียบเทียบ Diff ของไฟล์ `src/index.js`, `public/app.js`, `public/index.html` กับ Production ล่าสุด
3. Merge 3 ไฟล์และเพิ่ม CSS + SQL + Script ใหม่ (ไม่ต้องแทนไฟล์ `package.json`)
4. รัน:

```bash
node scripts/verify-screening-release.mjs
npm run check
# สำหรับ Repo ที่ใช้ D1 migration อย่างเป็นระบบ:
npx wrangler d1 migrations apply DB --remote
npx wrangler deploy
```

หมายเหตุ: Runtime มี `CREATE TABLE IF NOT EXISTS` สำหรับตารางการคัดกรองแล้ว จึงไม่ต้องรัน migration ซ้ำถ้าใช้ lazy-create แต่แนะนำใช้ Migration เป็นหลักใน Production ที่มีขั้นตอน DB release (ต้องระวัง migration เก่าที่ยังไม่ได้รันใน repo อื่น)

## หลัง Deploy ตรวจจริง
1. เปิด Recruitment: เห็นคิวคัดกรองเหนือ Pipeline
2. คลิก `Sync` ของบัญชี `hr.info@dealinvest.com` หรือบัญชีทดสอบที่เชื่อมไว้
3. ตรวจ PEAK/Google/Airbnb/Alibaba แสดงเป็น `ไม่น่าใช่ใบสมัคร`/`รอตรวจ` **ไม่ไป Pipeline เอง**
4. ส่งเมลทดสอบหัวข้อ `สมัครงานตำแหน่ง Designer` จากเมลส่วนตัวพร้อม `resume.pdf`
5. เมลทดสอบต้องขึ้นในคิว (ไม่สร้าง Candidate เอง)
6. กด `รับเป็นผู้สมัคร` แล้วจึงเห็น Candidate ใน Pipeline
7. Sync ข้อความเดิมซ้ำ ต้องไม่เกิด Candidate ซ้ำ
8. กด `คัดออก` กับเมลทดสอบที่ไม่เกี่ยวข้อง แล้วเปลี่ยนตัวกรองเป็น `คัดออกแล้ว` เพื่อตรวจย้อนหลัง
9. ตรวจสิทธิ์: ผู้ใช้ที่ไม่มีสิทธิ์ HR ไม่สามารถเปิด GET/POST screening API ได้
10. ลองมือถือและเช็กข้อความผิดพลาดใน Console / Cloudflare Worker logs

## ความถูกต้องและข้อจำกัด
- กติกาคะแนนเป็น **คำแนะนำ ไม่ใช่ AI ยืนยันตัวตน**: เมลจาก Job Board ที่เป็นการสมัครจริงอาจตกในรอตรวจ และเมลสแปมที่ปลอมว่าเป็นใบสมัครอาจอยู่ในกลุ่มน่าสนใจ HR ต้องเป็นผู้ตัดสิน
- UI โหลดอีเมลล่าสุดไม่เกิน 300 รายการ (250 ต่อแหล่งและรวมหลังเรียง) ยังไม่มี pagination สำหรับ Inbox ขนาดใหญ่
- ไม่ลบ Candidate ที่เคยสร้างผิด เพื่อรักษา audit/history; รายงาน Analytics อื่นที่อิง Candidate เก่าอาจยังนับอยู่จนกว่าจะทำกระบวนการทำความสะอาดข้อมูลเดิมแบบอนุมัติทีละรายการ
- ยังไม่รองรับการเปิดไฟล์แนบจริงผ่าน UI (เห็นชื่อไฟล์) และยังไม่ทำการอ่านเนื้อหาทั้งฉบับ เพราะ Gmail readonly token และสิทธิ์เอกสารต้องออกแบบและทดสอบแยก
- `candidate.email` ยังไม่มี Unique Index ระดับฐานข้อมูล หากมีการกดยืนยันพร้อมกันจากหลาย Client มีความเสี่ยงแข่งขันเขียนต่ำแต่ไม่เป็นศูนย์ ควรทำ DB audit และ unique policy ก่อน Scale
- การแก้จาก Source ZIP ไม่ได้หมายความว่า Deploy ขึ้น Production สำเร็จ ต้องทดสอบ OAuth/Sync/Manual Review จริงหลัง Deploy

## ทดสอบที่ทำแล้ว
- `node --check src/index.js`, `node --check public/app.js`
- `npm run check` จาก Repo snapshot ผ่าน
- 8 test cases ของกติกาคัดกรอง ผ่าน
- SQLite migration idempotency + UNIQUE decision ผ่าน
- UI Fixture headless Chromium 390/768/1440px ผ่าน Filter, no horizontal overflow, no JS page errors
