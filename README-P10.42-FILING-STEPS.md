# P10.42 — Explicit payroll filing steps

Changed-only patch over P10.41. Upload every ZIP file at its existing relative path and deploy Worker/public assets together. No migration is required. Refresh with Ctrl+Shift+R and verify UI P10.42.

The old numbered sidebar items were settings categories, not workflow steps. Saving stayed in the same form and the next action was only a small status link. This update removes those misleading category numbers and adds four actual stages:

1. Set up company/employee filing data. The first blocking message is visible. SSO, tax and employee categories remain available inside this stage. Switching categories resets the content scroll position.
2. Review and create the selected file. Saving settings automatically moves here. Missing-data messages remain visible; the persistent next action opens the appropriate settings category. No attempt is made to bypass server export validation.
3. Download and file manually. Newly generated files download as before; the screen displays the selected agency's workflow and a download-again link. SSO CSV goes to SSO e-Service; tax TXT goes through RD Prep to .rdx, then e-Filing. Opening an agency link does not mark a filing complete.
4. Record the actual result. Enter status, date, reference/receipt, note and explicit confirmation. Completion is shown only from the saved manual filing/payment record. Existing source-change checks and API permissions are preserved.

A task selector switches between SSO, PND1 and PND1kor. The current stage and a next/back action remain visible. Moving forward to filing without a current file produces an explanation. Saved files are matched to the current source fingerprint; a stale file does not unlock later stages after refreshing changed data. 50 Tawi remains a separate printable draft.

Validation: real Chromium walkthrough with synthetic data, using the complete application CSS, covers setup → save/automatic advance → create/download → filing instructions → explicit receipt confirmation/completion. Tests also cover blocking a skip before creating a file, no automatic filed state on download, blank-note settings saves, manual wage-reason validation, API error recovery, draft retention, search, and 1440/1280/768/390px layouts. Existing document-center UI, timeout recovery, release-label and syntax tests pass.

Browser test: set NAKNA_PLAYWRIGHT_MODULE and optionally NAKNA_CHROMIUM_PATH, then run node tests/test-p10.40-document-center-browser.mjs.

No production deployment, government portal submission, live import or payment was performed. The previously documented RD Prep/SSO live-import limitations remain unchanged.
