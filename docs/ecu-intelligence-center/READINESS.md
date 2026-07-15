# Readiness Model

Readiness version: `readiness-v1`.

States:

- `NO_EVIDENCE`
- `IDENTITY_ONLY`
- `CANDIDATES_AVAILABLE`
- `HUMAN_REVIEW_REQUIRED`
- `APPROVED_EVIDENCE_AVAILABLE`
- `CONTROLLED_PAIR_REQUIRED`
- `INTEGRITY_RESEARCH_REQUIRED`
- `LAB_VALIDATION_REQUIRED`
- `RESEARCH_ELIGIBLE`
- `BLOCKED`

The model does not include an automation-ready state. It is evidence management only.

Hard blockers include ambiguous identity, unresolved conflicts, authorization gaps, unknown service labels, synthetic-only evidence and insufficient exact identity.
