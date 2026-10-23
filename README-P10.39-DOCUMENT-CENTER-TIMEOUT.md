# P10.39 — Payroll document center timeout fix

Changed-only patch over P10.38. Upload every file from this ZIP at the same relative path; deploy Worker and public assets together. Keep other source files. Back up the current code/database first. After deployment use Ctrl+Shift+R and verify UI P10.39.

Observed issue: opening เอกสารหลังเงินเดือน displayed API_TIMEOUT for /api/payroll/document-center?period_id=6&year=2026.

Changes:
- Ready installations skip full payroll default initialization and HR document workflow initialization. The previous generic initializer was also called without the required company ID; the fallback now receives the selected company ID.
- Use a dedicated small period/items/payment query instead of loading the complete payroll control-center detail, timeline, component catalog, exceptions and export history.
- Remove a repeated payment-confirmation read. Date/month searches use indexable ranges. SSO adjustment totals are grouped for the selected wage month instead of a correlated query per employee.
- Add four indexes for payment month, wage month, items and adjustments. Migration 0046 is included for normal D1 migration workflows; the document-center guard also creates missing indexes automatically. No payroll amounts are changed.
- Batch document-center/filing table setup. Existing saved exports bypass unrelated payroll initialization.
- Use an explicit 45-second document request timeout (previous default 18 seconds) and show a Thai error plus a retry button inside the same dialog. Retrying a failed action reloads data; it does not silently resubmit a filing or duplicate a status action.

Use after installing: Payroll → select period → เอกสารหลังเงินเดือน → ตั้งค่านำส่ง → เอกสารรายเดือน → ไฟล์ สปส.1-10 สำหรับ SSO → สร้าง CSV สำหรับ SSO.

Validation: real SQLite integration checks use the dedicated lightweight detail loader, and deliberately throw if any full initialization helper is invoked on a ready installation. 32 checks cover role/company isolation, immutable exports, actual payment calendar grouping, SSO aggregation, config save, read-only financial behavior and automatic indexes. UI tests cover successful retry after API_TIMEOUT in the same dialog. P10.38 company profile (25 checks), P10.37 export format (16 cases), document-center UI, release version, syntax/npm checks pass.

Limit: tests are local; no live production latency measurement or deployment was performed. Existing RD Prep/SSO live-import validation limitations from P10.37 remain unchanged. This release does not submit anything to government portals or transfer money.
