# ECU Intelligence Learning Roadmap

## Current Status - Level 1 Similarity & Evidence

The system identifies file structure, compares ORI/MOD data, creates compact signatures, records completed jobs as structured samples, applies a 0-100 evidence-quality score and requires admin verification. Level 1 adds quality-gated similarity ranking and evidence explanations for File Expert and admin review. It does not generate tuning files, edit calibrations or provide automatic calibration suggestions.

Level 1 is deployment-ready after the additive similarity migration is applied. Production evidence still depends on real, human-confirmed ORI/MOD work.

## Learning Levels

- **Level 0 Unknown:** Collecting data. System can analyze files but does not have enough examples for reliable detection.
- **Level 1 Detection Ready:** Enough examples for basic detection. Requires at least 10 usable quality-scored examples.
- **Level 2 Pattern Ready:** Repeated feature patterns are becoming visible. Requires 100 usable examples and at least 10 confirmed examples.
- **Level 3 Map Candidate Ready:** Map candidate suggestions may become useful. Requires 500 usable examples and at least 50 confirmed examples.
- **Level 4 Suggestion Ready:** Human calibration suggestions may be possible. Requires 2,000 usable examples and at least 200 confirmed examples.
- **Level 5 Draft Ready / future only:** Requires a separate design, security review, manual approval and high-quality verified data. It is never set automatically and is not implemented.

Usable means not rejected, human quality rating at least 3 when supplied, and `data_quality_score >= 60`. Sample count alone never proves safety or calibration correctness.

## Level 1 Delivered Boundaries

1. Retrieval uses only confirmed, learning-approved samples with quality 60+ and actual performed labels.
2. Scoring is deterministic and explainable; no embedding provider is required.
3. Results are persisted with duplicate protection and can be recalculated safely.
4. Customers see only aggregate evidence; admins see sanitized matched-sample details.
5. Pending samples can use approved evidence for review but are never approved automatically.
6. Similarity readiness is tracked separately from calibration-learning levels.

## Next Phase Prerequisites

1. Collect enough human-confirmed samples for selected ECU family/HW/SW identities.
2. Define train/evaluation splits and prevent the same ORI/MOD family from leaking across them.
3. Define a privacy and retention policy for learning records and source objects.
4. Move long-running training capture to a durable background queue.
5. Measure false-positive rates per feature and ECU profile.
6. Add pgvector only after an embedding model, dimensionality, versioning and migration strategy are approved. Current Level 1 deliberately uses deterministic structured scoring.
7. Retrieve only human-confirmed, quality-filtered signatures; never retrieve raw binaries into browser or model prompts.

## Future Sequence

1. Level 1: deterministic, quality-filtered similarity evidence (delivered).
2. Level 2: retrieval evaluation, repeated feature-pattern clustering and optional versioned embeddings.
3. Level 3: map candidate assistance for expert review only.
4. Level 4: human calibration explanation and suggestion workflow.
5. Level 5: separately approved draft generation, never automatic delivery.
