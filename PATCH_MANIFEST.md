# Nakna P8.15 — Company Template Patch

Base: P8.14

## REPLACE
- `src/index.js`

## ADD
- `migrations/0025_company_document_templates.sql`

## What changed
- Standard document templates are provisioned per `client_id` (company/tenant).
- Company identity is resolved from Company Profile / onboarding data at PDF generation time.
- Supported company variables: legal name, tax ID, address, phone, signer name/position.
- Existing company-customized templates are preserved (`INSERT OR IGNORE`).
- Standard templates include employment certificate, salary certificate, probation pass, salary adjustment, acknowledgement notice, warning.
- Document Center/template API self-provisions missing standard templates for each company.
- PDF header/footer uses that company's identity rather than Nakna as the document issuer.

## Deploy
1. Backup D1.
2. Add and run migration 0025.
3. Replace `src/index.js`.
4. Deploy Worker.
5. Open Document Center for each test company and verify the six standard templates appear.
6. Generate one employment certificate and verify company legal name/address/tax ID are from the active company.

## Important
P8.15 does not overwrite an existing template with the same company+code. This prevents a company's customized wording from being silently replaced.
