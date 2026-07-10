# MG AutoTech AI File Intelligence Roadmap

MG AutoTech AI File Intelligence is an evidence-first system. It helps a human tuner understand files, compare previous work, measure learning quality and prepare future review workflows. It does not generate write-ready MOD files.

## Current production boundaries

- No automatic MOD generation.
- No checksum-corrected final ECU/TCU files.
- No byte patch output for customers.
- No automatic customer delivery.
- No raw binary, hex, offsets, hashes, storage paths, provider metadata, private sample IDs or admin notes in customer output.
- Human tuner verification is required for real file work.
- Checksum verification remains outside the AI evidence layer.

## Level 0 - Structured learning foundation

Implemented:

- File Expert ORI-only and ORI/MOD analysis.
- Training samples with requested service labels and actual performed service labels.
- Data quality score and quality reasons.
- Admin verification workflow.
- Learning events and model run logging.
- Production-safe demo mode, disabled unless explicitly enabled.

## Level 1 - Similarity evidence

Implemented:

- Trusted sample filtering.
- Similarity scoring for ECU identity, SW/HW, file size, pattern signature and service labels.
- Admin-only similarity explanations.
- Customer-safe summaries without private sample details.

Trusted evidence requires:

- `learning_use_status = approved_for_learning`
- `human_verification_status = confirmed`
- `data_quality_score >= 60`
- actual service labels
- pattern signature where applicable

## Level 2 - Pattern clustering and accuracy

Implemented:

- Pattern clusters by ECU family/type/SW/HW and feature type.
- Weak/usable/strong/mature cluster status.
- Repeated changed-region buckets.
- Outlier detection.
- Automatic label accuracy metrics.
- Admin cluster pages and rebuild actions.

Level 2 still remains evidence-only. It cannot approve or create a tuning file.

## Level 3: Map Definition Layer and Changed Map Attribution

Implemented in this sprint as a safe foundation:

- TypeScript domain model in `src/lib/aiFileIntelligence`.
- Non-destructive SQL draft: `scripts/add-ai-level3-map-definitions.sql`.
- Admin-only map definition API and control page.
- Map definition sets scoped by ECU family/type/SW/HW.
- Map definitions with category, offset range, dimensions, unit, confidence and human verification.
- Changed-region attribution helper.
- Evidence trust helper.
- Learning usefulness helper.
- Exact/similar file match explanation helper.
- Generation readiness gate with export locked.
- Safe synthetic fixtures for tests.
- Training Accelerator / Synthetic File Lab for admin-only fake fixture benchmarking.
- Bulk ORI/MOD Dataset Importer dry-run foundation for pairing and review queue preparation.
- Customer-safe projection helpers.

Level 3 can say:

- a changed region overlaps a known map definition
- a match is exact/partial/ambiguous/unknown
- the evidence is trusted/strong/usable/weak/untrusted/blocked
- generation is blocked and why

Level 3 cannot say:

- these bytes should be changed
- this is the correct calibration value
- this file is safe to flash
- this output is write-ready

## Level 4: Human calibration suggestion

Future only.

Goal: support tuner reasoning without generating a file.

Allowed output examples:

- "Review torque limiter consistency."
- "Stage 1 label is weak because no power-related cluster evidence exists."
- "DTC OFF claim does not match changed-region evidence."

Forbidden:

- final values
- byte patches
- checksum-corrected output
- customer-ready files

Required gates:

- verified map definitions
- strong/mature clusters
- high quality confirmed samples
- known actual service labels
- human tuner review

## Level 5: AI draft change-set

Future only.

This would be an admin-only draft plan, not a file. It must remain export locked until a separate human-approved export project exists.

Required gates:

- exact ECU/SW map definitions
- enough trusted examples
- measured accuracy
- all proposed changes explainable
- every item rejectable by a human tuner

## Level 6: Human-Approved Draft MOD Export

Future only and must be a separate controlled project.

Required gates:

- explicit owner approval
- human tuner approval
- checksum workflow
- audit trail
- versioning and rollback
- bench/OBD validation process
- no automatic customer delivery

## Why automatic generation is locked

ECU/TCU calibration is safety critical. Similar bytes do not guarantee the same map, axis, unit, checksum, legal status or vehicle result. The platform must first collect verified evidence, measure accuracy, build map definitions and keep expert review in control.

The correct product position today:

> AI-assisted evidence and review support for professional tuners, not automatic tuning file generation.
