# Nakna P10.8 — QA

## Tested in mock browser
- JavaScript syntax and installer syntax: passed
- Chromium viewports 320, 390, 430, 768, 1440: 5/5 passed, no horizontal overflow
- Preset populates `source=recipient`, `To=hr.info@dealinvests.com`, `back=30`, Inbox enable+auto Sync: 5/5 passed
- Switching from a previously configured sender mode: passed
- Save unavailable: fails open to original advanced fields; does not claim success: passed
- No resolvable mailbox title: does not inject UI or guess the account: passed
- Advanced fields remain accessible via toggle: 5/5 passed
- Installer dry run/idempotency and byte-exact rollback on local P10.x HTML: passed

8/8 browser cases pass + installer checks pass. Code does **not** add backend or OAuth routes. The mock save handler is **not a proof of successful D1/Gmail sync**.

## Still needs production UAT
- Test with the actual current Recruitment mailbox dialog structure and the connected HR email
- Confirm original Server successfully saves config with the normalized `To` address
- Confirm first manual Sync reads correct HR mailbox only, and Google personal mailbox remains untouched
- Verify imported emails enter the screening queue, not Candidate directly
- If modal implementation differs from the fixture, inspect production DOM; the enhancement will show original fields or fail open without sending a new API request
