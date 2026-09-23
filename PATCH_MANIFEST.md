# Nakna P9.05 — LINE Owner / HR Dashboard Access Fix

Base: P9.04 Payroll Mobile Redesign

## REPLACE
- `src/index.js`

## Migration
- ไม่มี Migration ใหม่

## Bug ที่แก้
- ผู้ใช้ที่เป็น Owner / HR และมี Employee profile ในบริษัทเดียวกัน อาจเห็นเฉพาะเมนูพนักงานใน LINE
- ปุ่ม `เปิด HR Dashboard` หาย ทั้งที่บัญชีเว็บมีสิทธิ์ Owner / HR
- พิมพ์ `Dashboard` แล้วถูก fallback กลับมาเป็น Employee menu

## Root cause
LINE บางบัญชีถูกเชื่อมกับ employee flow มาก่อน จึงมี LINE identity อยู่บน users row แบบ legacy/synthetic แต่สิทธิ์ Owner/HR จริงอยู่บน Google/Nakna users row อีกตัวหนึ่ง ทำให้ fast menu resolver หา `company_members` ไม่เจอ

## Fix
- เพิ่ม canonical management identity fallback ผ่าน Employee LINE + Employee Email + Workspace membership
- ต้อง match email ของ Employee กับ Users account และ client เดียวกันก่อน จึงจะถือว่ามีสิทธิ์ Dashboard
- ใช้ fallback ทั้งตอนสร้าง Employee menu และตอนผู้ใช้กด/พิมพ์ Dashboard
- ยังคงตรวจ role เฉพาะ `owner/co_owner/hr_admin/hr/payroll_admin/manager/approver`
- bump runtime card เป็น `P9.05-LINE-ACCESS` เพื่อดูได้ทันทีว่า Worker ใหม่ถูก deploy แล้ว
