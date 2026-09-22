# P8.24 Test Result

- `npm run check` — PASS
- `npm run audit` — PASS
- `npm run migration:smoke` — PASS
- Fresh migration chain `0001 → 0028` — PASS
- GPS P8.23 backend changes are preserved in `src/index.js`.

## Runtime smoke tests still required after deploy
1. Documents → ตั้งค่าเอกสาร & ลายเซ็น → upload HR signature → save.
2. Generate a new acknowledgement-required document (e.g. probation pass / salary adjustment).
3. Approve → PDF should show company branding + HR signature + employee acknowledgement slot.
4. Send to employee → open from LINE → draw signature → acknowledge.
5. Reopen document → system should serve signed `-ACK.pdf` and HR dashboard should show acknowledged status.
