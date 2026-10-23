# P10.40 — Payroll document center UX

Changed-only update over P10.39. Upload all files in this ZIP at their relative paths and deploy Worker/public assets together. Keep other source files. No migration is required. After deployment press Ctrl+Shift+R and verify UI P10.40.

Changes:
- Document dialog uses a wide workspace with a fixed header/navigation and contained scrolling. Styles use the dialog ID so the generic 760px dialog and generic form styles cannot override it.
- All field labels sit above full-width inputs. Settings have separate sections for SSO, tax and employee data, with more spacing and field groups. Section changes retain entered values; main-tab changes preserve the current unsaved settings draft.
- Save button and review-reason field remain visible at the bottom. Employee details open per person, with a name search.
- Monthly files show SSO first, PND1 second, then the accounting/transfer documents in a separate group. Cards use one column and shorter descriptions. Technical instructions and history are collapsed.
- When required export information is missing, the card shows the error and a direct settings shortcut. File creation remains blocked until server validation passes.
- Generated attachments download immediately, with a retained download link. Draft 50 Tawi keeps the explicit print/open action. After saving settings there is a direct button back to monthly file creation.
- P10.39 timeout handling and P10.38 company identity changes are preserved. No payroll formulas, financial data, export specifications or submission statuses are changed by this UI update.

Validation:
- Real Chromium rendering and interaction at 1440, 1280, 768 and 390px widths, loading the actual application CSS in its original order. Checked modal bounds, horizontal overflow, labels above inputs and visible save button.
- Browser interactions: SSO priority, blocked export/settings shortcut, setting section switches, employee search, save payload, unchanged wage values not becoming overrides, settings draft retention, direct attachment download, no JavaScript errors.
- Existing document-center UI, timeout recovery, release-version and npm syntax checks pass.

Optional browser test:
NAKNA_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs NAKNA_CHROMIUM_PATH=/absolute/path/to/chromium node tests/test-p10.40-document-center-browser.mjs

Browser tests use synthetic data and a local fixture. No production deployment or government portal submission/import was performed. Previously documented RD Prep/SSO live-import limitations remain unchanged.
