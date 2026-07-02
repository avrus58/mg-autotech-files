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
