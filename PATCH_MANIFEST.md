# Nakna P8.24 — Document Signature & Branding Patch

## REPLACE
- `src/index.js`
- `public/app.js`
- `public/index.html`
- `public/styles.css`
- `public/documents.js`
- `public/documents.html`
- `public/documents.css`

## ADD
- `migrations/0028_document_signatures.sql`

## Deployment order
1. Backup D1.
2. Replace the 7 files above.
3. Add migration `0028_document_signatures.sql`.
4. Run remote D1 migrations.
5. Deploy Worker/static assets.
6. Hard refresh HR dashboard and reopen Employee Documents from LINE.

## New behavior
- Company logo is embedded into generated HR PDFs when it is PNG/JPG-compatible; otherwise company name is used as fallback.
- HR can configure signer name, position and a PNG/JPG signature from **Documents → ตั้งค่าเอกสาร & ลายเซ็น**.
- Final documents include an HR signature block.
- Documents requiring acknowledgement include an employee acknowledgement signature block.
- Employee acknowledgement now requires a drawn signature in the LINE/Nakna employee portal.
- The original final PDF is preserved. After acknowledgement the system creates a separate `-ACK.pdf` signed copy and stores signature/evidence hashes.
- Existing old PDFs are handled safely: acknowledgement evidence is added on a new page rather than overwriting their layout.
