# P8.20 Test Result

- Frontend JS syntax: PASS
- Module-scope regression assertion: PASS
- npm run check: PASS
- npm run audit: PASS
- migration smoke 0001 → 0026: PASS

Root cause confirmed:
`public/index.html` loads `app.js` with `type="module"`; inline HTML handlers cannot access module-local function declarations unless exposed on `window`.
