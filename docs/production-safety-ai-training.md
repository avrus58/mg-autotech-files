# Production Safety - AI Training

## Checked In Code

- `SUPABASE_SERVICE_ROLE_KEY` is read only by server modules and has no `NEXT_PUBLIC_` prefix.
- `/api/admin/ai-training/**` requires a verified user and `ai_training.manage`.
- normal customers do not satisfy the admin permission.
- File Expert detail/analyze APIs compare `job.user_id` with the authenticated user unless the user is an authorized admin.
- `customer-files`, `file-expert` and `ai-training` buckets are private.
- no customer storage policy exists for `ai-training`.
- demo mode is server-only, disabled unless `ENABLE_AI_TRAINING_DEMO=true`, and uses deterministic synthetic files.
- hash lookup plus PostgreSQL unique indexes prevent duplicate training samples.
- File Expert and training API responses redact raw hex/byte previews.
- external AI report providers receive structured analyzer JSON only.
- analyzer/provider errors return controlled failure or rule-based fallback instead of crashing customer delivery.
- training capture failure is isolated from completed-file delivery.
- Level 5 is not automatically reachable.

## Remaining Manual Verification

- apply `scripts/add-ai-training-quality.sql` before deploying code that selects quality columns;
- confirm Vercel Production keeps `ENABLE_AI_TRAINING_DEMO=false` unless a short, controlled demo is intended;
- verify RLS policies in Supabase after every schema migration;
- test owner, manager, calibrator and customer accounts against admin routes;
- verify storage signed URLs expire and bucket public flags remain false;
- define retention/deletion behavior for training records when a customer account is deleted;
- monitor Vercel duration/memory for large completed files; synchronous capture should move to a queue before high volume;
- validate optional OpenAI/Ollama/vLLM credentials in Preview before Production;
- perform legal/privacy review before using customer jobs beyond operational service delivery.

## Deployment Checklist

1. Back up the Supabase schema.
2. Run `scripts/add-ai-training-quality.sql`.
3. Confirm the two columns with a read-only query.
4. Set `AI_PROVIDER=rule_based` unless an external provider has been approved.
5. Set `ENABLE_AI_TRAINING_DEMO=false` in Production.
6. Run `npm run lint`, `npm run typecheck`, `npm run test:ecu-intelligence` and `npm run build`.
7. Deploy to Preview and run `docs/manual-test-ai-training.md`.
8. Verify non-admin 403 behavior and private storage.
9. Deploy to Production.
10. Complete one controlled real ORI/MOD order and verify sample/signature/profile/events without exposing the source file.

No SQL in this hardening task deletes, truncates or rewrites production rows.

## Level 1 Similarity Data Exposure

- `ai_similarity_results` has no customer RLS policy. Browser clients cannot read it directly.
- Customer File Expert APIs verify job ownership before loading any similarity result.
- Customer responses contain only match count, best score, confidence and a generic evidence message.
- Training sample IDs, vehicle metadata, outcomes and match reasons are returned only after `ai_training.manage` authorization.
- `compared_features` stores sanitized metadata only. It must never contain filenames, user IDs, storage paths, hashes, raw bytes, printable strings or binary previews.
- Similarity search never downloads a compared sample's source files. It uses structured analyzer output and compact signatures.
- Pending, rejected, excluded, low-quality and non-explicit demo samples cannot become trusted evidence.
- Similarity failures are non-blocking for File Expert analysis; no customer upload or report is lost because the Level 1 table is unavailable.
- Similarity cannot approve a sample, modify a binary, create a MOD or trigger customer delivery.

### Level 1 Deployment Checklist

1. Run `scripts/add-ecu-similarity-level1.sql` in Supabase SQL Editor.
2. Confirm `ai_similarity_results` has RLS enabled and no customer read policy.
3. Confirm the unique comparison index exists.
4. Re-save approved samples if their knowledge profiles need readiness backfill.
5. Run similarity for one pending sample and inspect reasons/warnings.
6. Verify a customer sees only aggregate evidence on their own File Expert report.
7. Verify a second customer cannot access that File Expert job.
8. Confirm production `ENABLE_AI_TRAINING_DEMO` remains false or unset.

## Level 2 Cluster Data Exposure

- `ai_pattern_clusters`, `ai_cluster_members` and `ai_accuracy_metrics` have RLS enabled and only `ai_training.manage` policies.
- Cluster rebuild APIs require the same server-side staff permission. A normal customer cannot list, rebuild or inspect clusters.
- Only confirmed, learning-approved, quality 60+ samples with actual performed labels and pattern signatures are trusted inputs.
- Demo samples remain excluded unless the server-only demo flag is explicitly enabled.
- Customer File Expert responses contain aggregate cluster count, readiness and confidence only.
- Customer responses never include cluster IDs, training sample IDs, repeated offsets, filenames, providers, storage paths, hashes, raw bytes or hex previews.
- Admin cluster screens use structured signatures and summaries. They do not download or render source binary content.
- Outlier detection is advisory. It cannot reject, exclude or approve a sample automatically.
- Accuracy metrics compare predictions only with human-confirmed actual labels and explicitly report insufficient data.
- A full rebuild may remove stale derived memberships and zero stale cluster/metric aggregates. It never deletes source training samples, customer orders or uploaded files.
- Every screen warns that evidence is not write-ready and still requires human tuner and checksum verification.

### Level 2 Deployment Checklist

1. Back up the Supabase schema.
2. Review and run `scripts/add-ecu-pattern-clustering-level2.sql` in Supabase SQL Editor.
3. Confirm RLS and admin-only policies on all three Level 2 tables.
4. Confirm Production keeps `ENABLE_AI_TRAINING_DEMO=false` or unset.
5. Run lint, typecheck, tests and production build.
6. Deploy to Preview first and complete the Level 2 section in `docs/manual-test-ai-training.md`.
7. Verify customer isolation with two different customer accounts.
8. Verify rebuild endpoints return 401 without a session and 403 for a normal customer.
9. Verify customer File Expert JSON contains no private cluster/member/offset data.
10. Rebuild once with a small approved set and inspect weak status; do not interpret low-count clusters as calibration truth.
11. Deploy only after owner approval. This implementation does not deploy itself.
