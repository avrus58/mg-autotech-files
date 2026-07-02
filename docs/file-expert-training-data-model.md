# File Expert Training Data Model

## Training Samples

`ai_training_samples` stores one analytical snapshot for an ORI/MOD pair: private object paths, hashes, sizes, vehicle/ECU metadata, requested service labels, analyzer output in `diff_json`, a compact `pattern_signature`, human verification and outcome data. The database does not store a public binary URL.

Partial unique indexes prevent duplicate request/hash pairs and duplicate anonymous/demo hash pairs. A later real MOD revision becomes a new sample only when its hash differs.

## Data Quality Score

`data_quality_score` is a nullable numeric value from 0 to 100. `data_quality_reasons` is JSON containing the reason code, readable explanation and positive or negative point impact.

Positive evidence includes ORI and MOD presence, same size, SHA-256 hashes, vehicle/ECU metadata, service labels, analyzer JSON, pattern signature, analyzer confidence, human verification, known outcome and future log/dyno evidence. Penalties apply to different sizes, missing ECU/labels, analyzer failure, an empty diff, admin rejection and negative outcomes.

This score measures learning-data completeness, not flash safety. A high score never means a file is safe to write. Knowledge profiles count only samples scoring at least 60, not rejected and not rated below 3/5.

## Signatures And Profiles

`ai_pattern_signatures` creates one queryable feature row per selected service label. `human_confirmed` becomes true only after an authorized reviewer confirms the sample. No vector or embedding is stored at Level 0.

`ai_ecu_knowledge_profiles` is recalculated from samples sharing ECU family/type/HW/SW identity. `profile_json` records usable count, review count, verified ratio, average data quality, high-quality count and the Level 0 quality threshold. Level 5 is never automatic.

## Verification States

- `unverified`: automatic evidence only.
- `confirmed`: reviewed and allowed as trusted positive evidence.
- `needs_review`: incomplete or conflicting evidence.
- `rejected`: retained for audit but excluded from positive learning.

Human fields include service-label corrections, `quality_rating` 1-5, safety rating, outcome and admin notes. Every save recalculates quality/signatures/profile and creates an audit event.

## Binary And Privacy Boundaries

Full files remain in private `customer-files`, `file-expert` or `ai-training` storage. Analyzer JSON may retain derived server-side evidence, but customer/admin JSON responses redact first/last hex and byte preview arrays. External AI providers receive structured, redacted analyzer JSON only, never raw binary or customer notes.

## Learning Safety

- automatic labels never set `human_verified`;
- low-quality and rejected samples do not increase readiness;
- database uniqueness and application checks prevent duplicate spam;
- profile counters are recalculated, not trusted blindly;
- checksum, logs, dyno and human review remain separate evidence;
- no Level 0 component generates or edits tuning files.
