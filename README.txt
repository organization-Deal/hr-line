Nakna HR V0.5.2 deploy config fix

Replace only wrangler.jsonc.
Changed compatibility_date from 2026-08-21 to 2026-08-20 so Cloudflare UTC deployment does not treat it as a future date.
R2 binding remains pinned to hr-line-evidence-bucket.
