# Nakna P9.08.1 — Fast LINE Build Fix

Base: P9.08 Fast LINE Startup

## REPLACE
- `src/index.js`
- `public/app.js`
- `public/index.html`

## Migration
- ไม่มี Migration ใหม่

## Fix
- แก้ syntax error ที่ Cloudflare/esbuild แจ้ง `Expected ")" but found "active"`
- เปลี่ยน SQL string ที่มี `status='active'` ให้ใช้ double-quoted JavaScript string
- เก็บ Fast LINE Startup flow ของ P9.08 ไว้ครบ
- bump cache เป็น `P9.08.1`
