# P10.38 — Edit company identity and document header

Changed-only patch for P10.37. Upload all files in this ZIP at the same relative paths, keeping existing source files not listed here. Deploy backend and public assets together. No new database migration is required; the existing onboarding and document-settings tables are reused. Back up your current source/database before deployment.

After deployment, refresh the page (Ctrl+Shift+R) and check UI P10.38. Open บริษัท → ข้อมูลบริษัท. Edit:

- ชื่อที่แสดงในระบบ
- ชื่อบริษัทตามทะเบียน / หัวเอกสาร
- เลขประจำตัวผู้เสียภาษี 13 หลัก
- ที่อยู่บริษัทสำหรับออกเอกสาร
- เบอร์โทรศัพท์บริษัท / จังหวัด

Press บันทึกข้อมูลบริษัท. The legal name, tax ID, address and phone synchronize atomically to the legacy data sources used by HR certificates, new payslips, 50 Tawi drafts and payroll filing exports. Display name can differ from legal name. An optional tax ID/address can be cleared explicitly; omitted fields from old API clients retain their current values.

Existing signed or issued documents, saved payslip PDFs and saved export snapshots retain their original information. Updating the profile affects newly created documents; it does not rewrite an already-issued PDF. Existing payroll reuse behavior is preserved.

Company signature, signer, footer, onboarding owner and setup progress are preserved. Only the currently selected company can be edited. Existing owner/co_owner/hr_admin/hr edit permissions are retained. Form saves are rejected when the form belongs to a different selected company. Invalid tax IDs are blocked. A missing legacy profile row is created without sending an existing company back through onboarding.

Validation completed:
- 25 P10.38 checks: real SQLite read/save/reload, atomic rollback on forced DB failure, synchronized identity, company and role guards, field validation, omitted/cleared fields, preserved signature/setup, legacy companies; actual frontend fill/save functions exercised against a minimal DOM.
- P10.31 payslip issuer: 26 checks; P10.32 layout: 21 checks.
- P10.36 document-center API: 30 checks; UI checks.
- P10.37 Thai export: 16 format/encoding cases; release-label tests; npm run check; company-profile module syntax check.

No production deployment or live browser save was performed. This patch does not change the previously documented live RD Prep/SSO import validation limitations.
