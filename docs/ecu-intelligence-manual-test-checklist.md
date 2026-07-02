# ECU Intelligence Manual Test Checklist

## Migration And Permissions

- Run `scripts/add-ecu-intelligence-learning.sql` in the Supabase SQL editor.
- Confirm all five `ai_*` tables exist and RLS is enabled.
- Confirm `ai-training` and `file-expert` buckets are private.
- Confirm a customer cannot select any `ai_*` table through the browser client.
- Confirm the Primary Owner and staff with `ai_training.manage` can open `/admin/ai-training`.
- Confirm other customers and staff receive 403.

## Automatic Capture

- Complete an order by uploading a final MOD.
- Confirm customer delivery succeeds even if analyzer processing fails.
- Confirm one training sample appears with correct order, ORI/MOD paths, hashes, sizes and metadata.
- Retry capture and confirm no duplicate row is created.
- Upload a different revision and confirm a second hash-distinct sample is created.
- Complete an order missing ORI or MOD and confirm a skipped/failed event is recorded without breaking delivery.

## Analyzer

- Analyze a single ORI and confirm no modified-feature claim is presented as fact.
- Analyze identical ORI/MOD and confirm `identical` classification.
- Analyze different-size files and confirm structural mismatch/high-risk warning.
- Analyze a known pair and inspect changed blocks, map candidates, repeated patterns and pattern signature.
- Confirm every report includes automated-analysis, checksum and human-review warnings plus logging/dyno guidance where relevant.

## Human Verification

- Open a training sample, edit labels, set quality/safety/outcome and confirm.
- Confirm the audit event and profile counts update.
- Reject a sample and confirm rejected count increases and it is excluded from positive feature counts.
- Mark a sample `needs_review` and confirm it remains unverified.

## File Expert

- Upload `.bin`, `.ori`, `.mod` and `.hex` files within the size limit.
- Confirm empty, oversized and unsupported files are rejected.
- Confirm another customer cannot open the job detail.
- Confirm report JSON download contains no signed URL, service key or customer PII.
- Re-analyze a job and confirm the previous files remain private.

## Regression

- Create a normal request and verify credit handling is unchanged.
- Download original/final order files as authorized users.
- Test customer dashboard, admin dashboard and File Expert at mobile/tablet/desktop widths.
- Run `npm run test:ecu-intelligence`, `npm run lint`, `npm run typecheck` and `npm run build`.
