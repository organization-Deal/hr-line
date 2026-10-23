# P10.41 — Filing settings save feedback

Changed-only patch over P10.40. Upload all files at the paths in the ZIP and deploy backend/public assets together. No migration is needed. Refresh with Ctrl+Shift+R; verify UI P10.41.

The previous form required a reason of at least five characters for every save, including ordinary employer account/date/rate/branch changes. Native browser validation could prevent the submit handler from running; the page also kept displaying an old success message after subsequent edits.

This update:
- Allows ordinary filing settings/profile metadata saves with an empty note. Notes remain limited to 500 characters.
- Requires a reason of at least five characters only for an explicit manual change or clearing of an employee's monthly SSO wage override. Backend validation enforces this; financial payroll amounts remain unchanged.
- Removes the unconditional native required-note block. Explicit form validation reveals an invalid field's section/person, focuses it and displays a clear unsaved error.
- Clears old success status when a data field changes; searching people alone does not mark data dirty.
- Shows a saving state and disables the save button during the request. An API failure retains entered values, shows an error, and restores the button.
- Retains the P10.40 layout and direct download flow.

Validation: real Chromium interaction checks cover blank-note ordinary saves, rejected blank-reason manual wage changes, focus/error feedback, failed-request recovery, unchanged wage payloads, unsaved status and the four viewport sizes from P10.40. Real SQLite API integration: 36 checks including blank-note acceptance, rejected manual wage edits/clears and unchanged stored wages after rejection. Existing document-center UI, timeout recovery, release label and syntax checks pass.

Run backend tests with: node tests/test-p10.36-payroll-document-center.mjs
Run the expanded browser test with NAKNA_PLAYWRIGHT_MODULE and optionally NAKNA_CHROMIUM_PATH: node tests/test-p10.40-document-center-browser.mjs

Tests use local/synthetic data. No production save, government submission or live import validation was performed.
