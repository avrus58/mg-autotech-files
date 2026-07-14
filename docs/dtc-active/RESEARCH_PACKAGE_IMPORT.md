# DTC Active Research Package Import

Phase A imported the active-processing research package as repository documentation, not as enabled runtime behavior.

Source package path in this workspace:

`mg-autotech-dtc-active-processing-v2`

Imported hash artifacts:

- `docs/dtc-active/research-package/SHA256SUMS.txt`
- `docs/dtc-active/research-package/PACKAGE_MANIFEST.json`

The source package remains the canonical research source for Phase B and later. Phase A code only uses derived, read-only policy/status contracts and does not execute package rules, adapters, binaries or fixture output generation.

Read artifacts for Phase A:

- `CODEX_ACTIVE_IMPLEMENTATION_PROMPT.md`
- `ACTIVE_PROCESSING_RESEARCH_ADDENDUM.md`
- `POLICY_PRECEDENCE.md`
- `config/active-processing-policy.yaml`
- `config/feature-flags.example.yaml`
- `schemas/dtc-processing-rule.schema.json`
- `schemas/dtc-integrity-adapter.schema.json`
- `schemas/golden-corpus-manifest.schema.json`
- `src-spec/active-types.ts`
- `src-spec/PROCESSING_ENGINE_SPEC.md`
- `src-spec/RULE_REGISTRY_SPEC.md`
- `src-spec/INTEGRITY_ADAPTER_SPEC.md`
- `src-spec/WORKER_ISOLATION_SPEC.md`
- `canonical-v1/schema/001_dtc_foundation.sql`
- `schema/002_dtc_active_processing.sql`
- `schema/MIGRATION_NOTES.md`
- `canonical-v1/api/openapi-dtc.yaml`
- `api/openapi-dtc-active.yaml`
- `ui/ADMIN_WORKBENCH_SPEC.md`
- `ui/CUSTOMER_DESKTOP_WORKFLOW_SPEC.md`
- `test/GOLDEN_CORPUS_SPEC.md`
- `test/ACTIVE_VALIDATION_MATRIX.md`
- `examples/fixtures/SYNTHETIC_FIXTURE_SPEC.md`
- synthetic rule, adapter and corpus manifests
- `TARGET_CLUSTER_RANKING.md`

Phase A deliberately stops before executable mutation, synthetic final output generation, checksum adapters and customer delivery.
