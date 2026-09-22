# Nakna HR P8.25 — Two-signature Document Composition

Base: P8.24 Document Signatures (and P8.23 GPS patch already applied)

## Files
- REPLACE `src/index.js`
- ADD `migrations/0029_two_party_document_signatures.sql`

## What changed
- Standard employee documents now use a two-party signature composition by default.
- Employment certificate and salary certificate now require employee receipt/signature evidence too.
- New PDF layout reserves two balanced signature cards:
  - HR / authorized signer
  - Employee recipient / acknowledgement signer
- Employee signature from LINE / Employee Portal is embedded into the right-hand card on the `-ACK.pdf` copy.
- HR signature, signer name/position and company branding remain tenant-scoped.
- Warning / acknowledgement documents include the fairness note that acknowledgement is evidence of receipt, not admission of an allegation or waiver of the right to explain.
- Signature timestamps shown in the PDF use Asia/Bangkok time.
- Older V1 PDFs remain compatible with the acknowledgement renderer.

## Deploy
1. Back up D1.
2. Replace `src/index.js`.
3. Add and run migration `0029_two_party_document_signatures.sql`.
4. Deploy Worker.
5. Generate a NEW test document. Existing PDFs are immutable and will not be visually rewritten.
6. Approve → send to employee → employee signs → open the generated `-ACK.pdf` and verify both signatures.

## Important
The migration changes only the standard `EMP_CERT` and `SAL_CERT` acknowledgement flag. Custom template body text is not overwritten.
