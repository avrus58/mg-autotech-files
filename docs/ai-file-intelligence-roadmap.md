# MG AutoTech AI File Intelligence Roadmap

This document defines how MG AutoTech can grow File Expert and ECU Intelligence safely. The current system is evidence-first. It does not generate MOD files, does not edit binaries, and does not deliver write-ready tuning files.

## Current Capabilities

- File Expert can inspect ORI-only or ORI/MOD jobs.
- ORI/MOD comparison detects changed byte counts, changed block groups, structural mismatch risk, possible feature indicators and ECU identity hints.
- Admin AI Training stores structured learning samples with requested service labels, actual performed service labels, quality score, approval status and event timeline.
- Level 1 similarity compares new evidence against trusted approved learning samples only.
- Level 2 pattern clustering aggregates approved, confirmed and high-quality samples into weak/usable/strong/mature evidence clusters.
- Customer-facing output is sanitized and must not expose raw binary, hex, offsets, private paths, provider/source metadata, sample IDs, hashes, VIN-like private identifiers or admin notes.
- Admin-facing output can show richer evidence for human review, but remains analysis-only.
- Evidence readiness helpers now classify matches as weak, related, strong or same-file-family style evidence for admin review.
- Generation readiness is intentionally conservative: it can explain what is missing, but it never marks a file as write-ready.

## Current Limitations

- The system does not know exact ECU map definitions unless a human/admin supplies verified definitions later.
- Changed regions are structural evidence, not proof of an exact calibration map purpose.
- Similarity and clusters are supporting evidence only, not approval for writing a file.
- Low sample counts create weak evidence, even when the technical comparison looks plausible.
- Pending, rejected, excluded, needs-review or low-quality samples must not be treated as trusted learning data.
- Checksum correction, flash preparation and legal/road-use decisions remain outside automated AI scope.

## Safety Rules That Must Not Change

- No automatic MOD generation.
- No byte patch output for customers.
- No write-ready Stage 1, DPF, EGR, AdBlue, DTC or TCU file output.
- No automatic customer delivery from AI.
- No raw binary, hex previews, private storage paths, provider data or private sample IDs in customer responses.
- Human tuner verification is required before any real file work.
- Checksum verification is required before any real write.
- Learning samples require admin-reviewed requested vs actual service labels.

## Level 3: Map Definition Layer And Changed Map Attribution

Goal: connect changed regions to human-verified map definitions without producing changes.

Planned data model:

- `map_definition_sets`: ECU family/type/SW/HW scope, version, source, verification status, owner/admin notes.
- `map_definitions`: map category, label, address/range, dimensions if known, unit if known, confidence, human verification status.
- `map_definition_audit`: every admin change to definitions.

Code foundation currently exists in:

- `src/lib/ecuIntelligence/evidenceReadiness.ts`
- `src/lib/ecuIntelligence/mapDefinitions.ts`
- `docs/map-definition-layer.md`

Admin experience:

- Upload or manually create map definition sets.
- Mark definitions as verified, needs review or retired.
- Compare ORI/MOD changed regions against known map ranges.
- Display “likely affected categories” such as torque limiter, driver wish, smoke limiter, EGR hysteresis, DTC area or speed limiter only when evidence exists.

Output remains:

- Evidence summary.
- Category attribution confidence.
- Human-review warnings.
- No byte edits.
- No exact write plan.
- Unknown changed regions remain visible to admin and are never hidden behind a false confidence score.

Readiness gate:

- Strong/mature clusters for the ECU family/type.
- Verified map definition set for the exact SW or a clearly compatible variant.
- Quality score and actual performed labels confirmed by admin.

## Level 4: Human Calibration Suggestion Plan

Goal: help the tuner reason about calibration direction, not generate a final file.

Possible output:

- “Review torque model consistency.”
- “Check smoke limiter and boost limiter alignment.”
- “DTC removal claim does not match changed-region evidence.”
- “Stage 1 label is weak because no repeated power-related cluster evidence exists.”

Must not output:

- Final values.
- Byte patches.
- Checksum-corrected output.
- Customer-ready files.

Readiness gate:

- Verified map definitions.
- Strong/mature cluster evidence.
- High data quality.
- Human-confirmed positive outcomes.
- Negative outcomes and revisions clearly excluded or flagged.

## Level 5: AI Draft Change-Set Plan

Goal: future-only internal draft planning. This is not a final file and not customer-facing.

Allowed only when:

- Owner explicitly enables it.
- Exact ECU/SW map definitions are verified.
- Enough high-quality confirmed examples exist.
- The system can show why a draft plan was created.
- A human tuner can reject every suggestion.

Still forbidden:

- Automatic file writing.
- Automatic customer delivery.
- Silent approval.
- Claiming road/legal safety.

## Level 6: Human-Approved Draft MOD Export

Goal: future-only assisted export after human approval and external checksum/tooling workflow.

Required gates:

- Owner approval.
- Human tuner approval.
- Checksum workflow integration.
- Versioned audit trail.
- Rollback and original file preservation.
- No production use without validated bench/OBD process.

This level should be treated as a separate regulated project, not a small feature.

## Admin Review Improvements To Prioritize Next

- Map Definitions page placeholder and non-destructive schema draft.
- Learning approval checklist that explains why a sample is useful or not useful.
- Better requested vs actual service label mismatch warnings.
- Cluster maturity badges next to File Expert evidence.
- Evidence category grouping for admin: identity, structure, service labels, quality, similarity, cluster, map attribution.
- Customer-safe report wording that avoids overclaiming.

## Why We Do Not Auto-Generate Files Now

ECU calibration is safety-critical and vehicle-specific. A visually similar byte region does not automatically mean the same map purpose, same unit, same axis, same checksum requirement or same legal outcome. MG AutoTech should first collect verified samples, build map definitions, measure accuracy, and keep human review in the loop before any draft generation is even considered.

The correct current product position is:

> AI-assisted evidence and review support for professional tuners, not automatic tuning file generation.
