# MG AutoTech ECU Intelligence & Learning Engine

## Scope

This foundation turns completed, real file-service work into structured learning data while keeping every calibration decision under human control. It extends the existing File Expert V2 analyzer, Supabase order workflow, private storage and staff permission system.

The current system may identify files, compare ORI/MOD pairs, locate changed regions, propose map candidates, classify likely operations, record verified feedback and build ECU knowledge profiles. It does not generate, approve or deliver a tuning file.

## System Flow

1. A customer creates an order and uploads the original file to the private `customer-files` bucket.
2. An authorized staff member uploads a MOD revision through the server-side delivery API.
3. The API records the delivery, marks the order complete and invokes `maybeCreateTrainingSampleForRequest`.
4. The learning service downloads ORI and MOD server-side, validates both objects, computes SHA-256 hashes and checks duplicate constraints.
5. The File Expert binary analyzer creates file inspections, a binary diff, changed blocks, pattern signatures, likely feature evidence and integrity warnings.
6. A row is stored in `ai_training_samples`; compact feature signatures are stored in `ai_pattern_signatures` and all processing steps are audited in `ai_training_events`.
7. `ai_ecu_knowledge_profiles` is recalculated from the available samples for the detected ECU family/type/HW/SW combination.
8. Admins review samples in `/admin/ai-training`. Human confirmation, rejection, quality, safety and outcome labels become the trusted learning signal.

Failures in the learning pipeline do not block customer delivery. They are recorded as training events so an admin can investigate without affecting the order.

## Existing Platform Integration

- `orders` remains the source of truth for customer work.
- `customer-files` remains the private source for delivered ORI/MOD objects.
- `file_expert_jobs` remains the manual customer/admin analysis workspace.
- `ai_training_samples` represents real completed work and may contain multiple revisions for one order when MOD hashes differ.
- Existing `file_expert_binary_fingerprints` and `known_file_patterns` remain supported.
- The staff permission model adds `ai_training.manage`; the Primary Owner always retains access.

## Binary Analyzer

The initial analyzer is TypeScript and exposes a stable structured result. It calculates hashes, file size, entropy, zero/FF ratios, printable strings, ECU identifiers, read scope, active regions, ORI/MOD changed blocks, map candidates, repeated patterns, integrity observations and evidence-based feature candidates.

The adapter can call `FILE_EXPERT_ANALYZER_URL` when a compatible external service is configured. A future Python/FastAPI analyzer can therefore replace or supplement the TypeScript implementation without changing the database or UI contracts.

Binary heuristics are evidence, not calibration definitions. A changed offset is never presented as a proven torque, boost, rail, lambda, emissions or transmission map without a verified ECU-specific definition.

## AI Report Generation

AI receives structured analyzer JSON and submitted metadata, never an instruction to create calibration bytes. `src/lib/ai` provides one interface for:

- deterministic rule-based reports (always available);
- OpenAI-compatible hosted models;
- Ollama-compatible endpoints;
- vLLM or another OpenAI-compatible self-hosted endpoint.

Provider failures fall back to the rule-based report. Every attempted run can be written to `ai_model_runs` with provider, model, prompt version, latency and error information. Raw service credentials stay server-side.

## Knowledge Profiles

A knowledge profile groups samples by ECU family, ECU type, software number and hardware number. Counts are rebuilt from source samples instead of incremented blindly, preventing drift after feedback changes. The profile records total, verified, unverified and rejected samples plus per-feature counts and readiness levels.

Only human-confirmed samples contribute full trust. Unverified samples may improve discovery statistics but must not be treated as approved examples. Rejected samples remain available as negative evidence.

## Future Calibration Assistant

Future phases may add vector embeddings, similarity search, ECU-specific map definitions, outcome/log/dyno ingestion and an assistant that points an experienced calibrator to likely regions. Any future draft generation must be separately designed, explicitly enabled and protected by human approval, checksum verification, audit logs and quality gates. It is intentionally absent from this phase.

## Security Boundaries

- Customers can read only their own File Expert jobs.
- Customers cannot read training samples, signatures, profiles, events or model runs.
- Training and admin APIs require a verified user with `ai_training.manage`.
- Supabase service-role credentials are server-only.
- Storage objects are downloaded by known bucket/path references; no arbitrary bucket or URL is accepted.
- File size, object existence and hashes are verified before analysis.
- Duplicate database indexes make retries safe.
- Reports always require human calibration review and checksum verification.

## Intentionally Not Automated

- no automatic MOD generation;
- no automatic file approval or customer delivery from AI output;
- no claim that a file is safe to flash;
- no exact horsepower or torque claim;
- no automatic legal judgement for emissions-related work;
- no learning promotion based only on unverified AI labels.
