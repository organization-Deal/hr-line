# P10.37 Thai payroll filing exports — cumulative patch over P10.35

Install these changed files over P10.35. P10.36 is included; do not install it separately. Back up code and database first. Apply migrations 0044 and 0045 through your existing D1 migration workflow, then deploy the Worker and public assets together. Tables are also created lazily by the document-center route. This package does not deploy, submit forms, transfer money or send LINE messages.

Open Payroll → select a period → เอกสารหลังเงินเดือน → ตั้งค่านำส่ง. Enter RD branch, SSO employer account and branch, intended contribution payment date, the rate and wage limits applicable to the selected month. Check employee names, titles and annual addresses. Valid company/employee tax IDs come from existing registries. Missing historical SSO wage bases must be reviewed explicitly; the system does not derive wages by dividing contributions by a rate. A changed wage input requires a reason and changes export metadata only, not payroll amounts. Clear it to revert to calculated source. New calculations save the SSO wage base in breakdown_json.

## Supported routes and limitations

- Ordinary salary under 40(1), normal filing, withheld condition 1. Not additional filings, tax paid on employee's behalf, termination lump sums, contractors or foreign-resident 40(2) income.
- PND1: actual confirmed payment dates within the selected payment month, including multiple payroll cycles. PND1kor: confirmed payments within the calendar year, not payroll period year. Trial cycles falsely marked paid must be corrected first. Other systems' income is not automatically combined.
- RD TXT is UTF-8 without BOM, CRLF, pipe-delimited, no heading. It follows published Payroll Format 1.0 column order. In RD Prep choose the correct form/month/year, text import, separator `|`, first data row 1, UTF-8, Buddhist dates DDMMYYYY, and map the fields below. Map only fields offered by your RD Prep version; company/form identifiers can be entered in its form settings. Check preview totals, then let RD Prep generate the `.rdx` file for New e-Filing. The TXT is not an `.rdx` file. This is not Format 2.0 for SWC-UI.
- SSO CSV: header type 1 (12 fields), detail type 2 (7 fields), TIS-620, comma-delimited, no heading, quotes or BOM, CRLF. Select the corresponding contribution month in SSO e-Service and review the imported names/totals before confirming submission/payment. Source includes locked/published payroll cycles in the wage month, independently of actual pay month. Contributions must match the explicitly entered rate/caps and whole-baht totals; no automatic adjustment to payroll deductions. An unusual contribution case requires accountant review instead of forcing a file.
- Saved files are immutable snapshots. Old P10.36 preparation exports remain preparation exports. 50 Tawi remains a printable two-copy draft requiring review and signature. Bank/accounting CSVs retain their previous review-only status.

## RD field mapping (one based)

| Column | Field | Value / rule |
|---|---|---|
|1|FORMTYPE|00 normal|
|2|COMPIN|Company tax ID, 13 digits|
|3|COMTIN|0000000000 legacy ID absent|
|4|BRANO|RD branch 4 digits|
|5|PIN|Employee tax ID, 13 digits|
|6|TIN|0000000000 legacy ID absent|
|7|PER_N1|Title|
|8|NAME1|First name|
|9|SUR_N1|Surname|
|10|ADDRESS1|Address line 1|
|11|ADDRESS2|Address line 2|
|12|POSCOD|Postal code|
|13|TAXMONTH|01–12; annual 00|
|14|TAXYEAR|Buddhist year|
|15|INCOMECODE|1: 40(1)|
|16|PAYDATE|Actual DDMMYYYY BE; annual year-end|
|17|TAXRATE|0 progressive|
|18|PAYMENT|Saved taxable income, 2 decimals|
|19|TAX|Actual withheld tax, 2 decimals|
|20|TAXCONDITION|1 withheld|

## SSO CSV mapping

Header: record type `1`, employer account(10), branch(6), payment date DDMMYY BE, wage month MMYY BE, company name, percentage rate with 2 decimals, insured count, total wages, combined contributions, employee contributions, employer contributions.

Detail: record type `2`, insured ID(13), title code(3: นาย003 / นางสาว004 / นาง005), first name(max30), surname(max35), actual assessable wages with 2 decimals, employee contribution with 2 decimals. Wages are not reverse-inferred from the capped contribution.

## Sources checked 23 October 2026

1. Revenue Department Payroll Format 1.0, updated 23 May 2023: https://www.rd.go.th/fileadmin/user_upload/WHT/swc1.5.1/FormatPND1.pdf
2. Revenue Department e-Filing FAQ / RD Prep import and .rdx workflow: https://efiling.rd.go.th/rd-cms/ask
3. Current SSO employer e-Service manual (upload, preview, confirmation/payment): https://www.sso.go.th/eservices/web/UserManual.pdf
4. SSO-authored E-Service manual v1.1, 8 October 2011, appendix B section 8 pages 178–180, CSV Format 3. Current public manual does not publish the column schema. Older primary document available via mirror: https://www.scribd.com/document/369368468/UserManual-pdf

**Validation scope:** Automated spec-position, encoding and SQLite API tests pass. No live RD Prep import, .rdx generation or SSO account upload has been performed. SSO schema is from the older appendix and acceptance by the current portal remains unverified. Do not label this release as agency-certified or live-import-tested.

Tests: node tests/test-p10.37-thai-export.mjs; node tests/test-p10.36-payroll-document-center.mjs; node tests/test-p10.36-document-center-ui.mjs; node tests/test-release-version.mjs; node tests/test-p10.35-payroll-next-step.mjs; node tests/test-p10.31-payslip-issuer.mjs; npm run check. SQLite migration execution checks 0044/0045. Repository migration:smoke script is absent in supplied source, so that npm command cannot run.
