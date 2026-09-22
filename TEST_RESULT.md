# P8.25 Test Result

- Full project reconstructed from P8.11 + patches P8.12–P8.24 + P8.25: PASS
- `npm run check`: PASS
- `npm run audit`: PASS
- `npm run migration:smoke`: PASS
- Fresh migration chain `0001 -> 0029`: PASS
- P8.25 migration data test: PASS
- V2 signature layout marker: PASS
- Backward-compatible V1 acknowledgement rendering retained: PASS

Runtime verification still required after deploy:
1. Generate a NEW salary/employment certificate.
2. Confirm HR signature appears in the left card.
3. Confirm employee placeholder appears in the right card.
4. Send via LINE and sign as employee.
5. Confirm `-ACK.pdf` contains both signatures and Bangkok timestamp.
