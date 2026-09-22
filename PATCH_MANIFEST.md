# Nakna P8.27 — Mobile HR Signature Submit Fix

Base: P8.26 Signature Workflow Engine

## REPLACE
- public/app.js
- public/index.html
- public/styles.css

## Migration
- None

## What changed
- HR signature submit button now updates state immediately after drawing, clearing, or selecting a saved signature.
- Submit action stays visibly fixed above the bottom edge on mobile/LINE iOS instead of being hidden below the signing canvas.
- Added safe-area handling for iPhone/LINE in-app browser.
- Added explicit disabled/ready UI state for the sign button.
- Prevented stale frontend assets by bumping app.js/styles.css cache keys to P8.27.0.
- Existing P8.26 signature workflow and migrations remain unchanged.
