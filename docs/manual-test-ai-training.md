# Manual Test - Level 0 AI Training

## Preparation

1. Run `scripts/add-ecu-intelligence-learning.sql` if the Level 0 tables do not exist.
2. Run `scripts/add-ai-training-quality.sql` to add the quality columns.
3. Set `ENABLE_AI_TRAINING_DEMO=true` only in the local or controlled Preview environment.
4. Keep `AI_PROVIDER=rule_based` for the deterministic baseline test.
5. Run `npm install`, `npm run fixtures:ecu-intelligence` and `npm run dev`.
6. Open `http://localhost:3000` and sign in with a verified customer account.

Never use a production customer file for the demo test. The committed fixtures are synthetic and harmless.

## File Expert - ORI Only

1. Open `/dashboard/file-expert`.
2. Upload `tests/fixtures/ecu-intelligence/ori_same_size.bin` as ORI only.
3. Start the analysis and open the report.
4. Confirm the report says `Single-file inspection`, does not claim an exact modification and shows a checksum/human-review disclaimer.
5. Expand Analyzer JSON. Confirm full raw binary, first/last hex previews and byte arrays are not exposed.

## File Expert - ORI And MOD

1. Create another File Expert job.
2. Upload `ori_same_size.bin` as ORI and `mod_same_size_stage1_like.bin` as MOD.
3. Confirm loading changes to completed without a page crash.
4. Open the report and confirm changed bytes, changed regions, confidence badges and the readable block table appear.
5. Repeat with `mod_different_size.bin`. Confirm a structural-mismatch warning appears.
6. Attempt `empty_invalid.bin`. Confirm the upload is rejected as empty.

## Admin Demo Pipeline

1. Sign in as an owner or staff member with `ai_training.manage`.
2. Open `/admin/ai-training`.
3. Confirm the blue Demo mode notice and `Run safe demo` button appear.
4. Select `Run safe demo` once.
5. Open the new sample and verify:
   - provider is `demo_fixture`;
   - ORI/MOD hashes and sizes exist;
   - `diff_json` and `pattern_signature` exist;
   - Stage 1 is selected;
   - data quality is 0-100 with reasons;
   - an ECU knowledge profile exists at Level 0;
   - the timeline includes diff started, sample created, diff completed and profile updated.
6. Run the demo again. Confirm the same sample opens or remains in the list, no second sample is created, and a `duplicate_skipped` event is recorded.

## Database Verification

Run these read-only queries in Supabase SQL Editor:

```sql
select id, provider, data_quality_score, human_verification_status, created_at
from public.ai_training_samples
order by created_at desc;

select training_sample_id, feature_type, human_confirmed, confidence
from public.ai_pattern_signatures
order by created_at desc;

select ecu_family, ecu_type, total_samples, learning_level, generation_readiness, profile_json
from public.ai_ecu_knowledge_profiles
order by last_updated_at desc;

select event_type, training_sample_id, message, created_at
from public.ai_training_events
order by created_at desc;
```

## Admin Verification

1. Open the demo sample.
2. Set decision to `confirmed`, correct labels if needed, set quality 1-5, safety, outcome and admin notes.
3. Save and confirm `human_verified=true`, selected signatures have `human_confirmed=true`, quality is recalculated and `admin_confirmed` appears in the timeline.
4. Change it to `needs_review`; confirm the `needs_review` event.
5. Change it to `rejected`; confirm it no longer counts as usable profile evidence and `admin_rejected` appears.

## Access And Disable Tests

1. Sign in as a normal customer and request `/admin/ai-training` and `/api/admin/ai-training`. Confirm no training data is returned.
2. Set `ENABLE_AI_TRAINING_DEMO=false`, restart the app and reload the admin page.
3. Confirm the demo notice/button disappear and `POST /api/admin/ai-training/demo` returns 404 for an authorized admin.
4. Confirm customers can open only their own File Expert jobs; another job ID must return 403.

## Existing Flow Regression

Create a normal customer request, buy/test credits in the configured safe environment, upload/download a file and complete one order. Customer delivery must succeed even if training capture fails. Re-capturing the same completed ORI/MOD pair must not create a duplicate.

## Level 1 Similarity Manual Test

1. Run `scripts/add-ecu-similarity-level1.sql` in Supabase SQL Editor.
2. Open `/admin/ai-training` as a user with `ai_training.manage`.
3. Open a quality-scored sample, set verification to `confirmed`, select at least one **Actual performed service**, set learning use to `approved_for_learning`, and save.
4. Prepare a second sample with the same ECU family/type and a related actual service. It may remain `pending`.
5. Open the second sample and select **Run similarity**.
6. Confirm **Similarity Evidence** shows the approved sample, overall score, ECU/identifier/pattern/service reasons, quality score and warnings.
7. Confirm the pending sample remains pending. Similarity must not change verification or learning approval.
8. Run similarity again. In Supabase, confirm only one row exists for the same `(source_type, source_id, compared_sample_id)` combination.
9. Filter `/admin/ai-training` by learning state, actual service, ECU family/type, quality threshold, matches and review status.
10. Confirm the ECU profile shows approved/pending/excluded counts, average quality and `no_data`, `weak`, `usable` or `strong` similarity readiness.
11. Create or re-analyze an ORI/MOD job from `/dashboard/file-expert` and open its report.
12. Confirm the customer sees only match count, best score and confidence. The response must not contain a matched sample ID, filename, storage path, hash, customer identity or binary preview.
13. As an admin, open the same File Expert report and confirm sanitized matched-sample links and reasons are available.
14. Sign in as another customer and request the File Expert job API directly. Confirm access is denied.
15. Test a database with no eligible samples. Confirm the UI reports no approved evidence and still requires human tuner verification.

## Level 2 Pattern Clustering Manual Test

1. Back up the schema, then run `scripts/add-ecu-pattern-clustering-level2.sql` in Supabase SQL Editor. The migration is additive and does not delete training samples or customer data.
2. Prepare at least five samples for the same ECU type and actual service label. Each must be `confirmed`, `approved_for_learning`, quality 60+ and have a pattern signature.
3. Keep one otherwise related sample pending, one excluded and one below quality 60. These are negative controls and must not become cluster members.
4. Open `/admin/ai-training/clusters` as an owner or staff user with `ai_training.manage`.
5. Select **Rebuild all clusters** and confirm the success message reports eligible samples and rebuilt clusters.
6. Open a cluster and verify ECU family/type, optional SW/HW, actual feature, member count, average quality, confidence, status and last rebuild time.
7. Verify repeated regions show bucket range, occurrence count/rate, representative offsets, confidence and the evidence-only warning.
8. Verify the pending, excluded and low-quality controls do not appear as members.
9. Confirm an exact-SW cluster uses a stricter bucket than its general ECU-type cluster.
10. Add or identify a deliberately dissimilar approved sample. Rebuild and confirm it appears as an outlier warning but remains in the database.
11. Use **Mark needs review** only as an explicit admin action. Confirm the sample changes to `needs_review` and learning use returns to `pending`.
12. Open `/admin/ai-training/[sample-id]`. Confirm **Cluster Evidence** lists memberships, score, reasons and outlier state. A pending sample may show possible clusters but is not auto-approved.
13. Verify the Level 2 cards show cluster counts, status distribution, outliers, automatic-label precision and review coverage.
14. If reviewed automatic labels exist, verify correct/partial/wrong totals and the confusion matrix in `ai_accuracy_metrics`. Otherwise confirm the UI says reviewed data is insufficient.
15. Open a customer-owned File Expert report. Confirm it shows only matching cluster count, best readiness, confidence and generic warnings.
16. Inspect the customer API response. It must not contain cluster IDs, member sample IDs, SW/provider details, offsets, filenames, storage paths, hashes, raw bytes or hex previews.
17. Open the same report as an authorized admin. Confirm richer repeated-region evidence is visible without raw binary content.
18. Sign in as a normal customer and call `POST /api/admin/ai-training/clusters/rebuild`. Confirm 403. Without a session, confirm 401.
19. Rebuild a second time. Confirm cluster/member uniqueness is preserved and stale memberships are not duplicated.

Read-only verification queries:

```sql
select ecu_family, ecu_type, sw_number, feature_type, sample_count,
       average_quality_score, cluster_confidence, cluster_status, last_rebuilt_at
from public.ai_pattern_clusters
order by cluster_confidence desc;

select cluster_id, training_sample_id, membership_score, is_outlier
from public.ai_cluster_members
order by is_outlier desc, membership_score asc;

select scope_type, scope_key, total_reviewed, precision_score,
       review_coverage, confusion_json
from public.ai_accuracy_metrics
order by scope_type, scope_key;
```
