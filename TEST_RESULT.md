# P8.23-GPS1 Test Result

## Static / local checks
- `src/index.js` syntax: PASS
- `public/attendance.js` syntax: PASS
- migration schema smoke: PASS
- error classes present: PASS
  - PERMISSION_DENIED
  - POSITION_UNAVAILABLE
  - TIMEOUT
  - LOW_ACCURACY
  - STALE_LOCATION_FIX
  - PAGE_NOT_VISIBLE
  - INSECURE_CONTEXT
- automatic retry path present: PASS
- balanced GPS fallback present: PASS
- final watchPosition refinement present: PASS
- browser cache bust: PASS (`P8.23-GPS1`)

## GPS flow
1. High-accuracy fresh fix
2. Automatic retry with balanced location provider if attempt 1 fails
3. Final watchPosition refinement, keeping the best fresh fix
4. Reject stale fix (>30s)
5. Separate low-accuracy failure instead of reporting it as timeout

## Diagnostics stored
No latitude/longitude is stored in the diagnostic table. It stores technical metadata only:
- error code/message
- accuracy
- elapsed time
- permission state
- browser/version
- iOS/Android version
- LINE version
- visibility state / secure context

Authenticated HR/Owner can read recent records from:
`GET /api/attendance/gps-diagnostics?limit=50`
Optional filters: `employee_id`, `code`.

## Requires real-device smoke test after deploy
- LINE iOS
- LINE Android
- Safari iOS
- Chrome Android/Desktop

Local code cannot prove WebKit/LINE native location-provider behavior on a real device.
