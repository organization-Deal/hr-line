Nakna HR V0.5.1 — R2 binding deploy fix

Replace only:
  wrangler.jsonc

Fix:
  EVIDENCE_BUCKET now binds explicitly to existing R2 bucket:
  hr-line-evidence-bucket

This prevents Wrangler/Cloudflare Builds from trying to auto-provision the same bucket again and failing with R2 error 10004.

Deploy:
  npx wrangler deploy

Expected deploy binding:
  env.EVIDENCE_BUCKET -> hr-line-evidence-bucket
