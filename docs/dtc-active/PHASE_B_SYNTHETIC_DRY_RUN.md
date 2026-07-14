# DTC Active Phase B Synthetic Dry-Run Foundation

Phase B adds a synthetic-only reasoning layer on top of the Phase A database foundation.

It does not enable real ECU processing.

## What Phase B Includes

- Strict declarative DTC rule document validation.
- Strict integrity adapter metadata validation.
- Golden corpus manifest validation.
- Canonical JSON and SHA-256 document digests.
- Exact compound identity matching.
- Approval and revocation gates.
- Ambiguity rejection.
- Hard-veto evaluation.
- Synthetic dry-run operation reports.
- Customer-safe projection of dry-run status.
- Admin read-only visibility.

## What Phase B Does Not Do

- No firmware bytes are modified.
- No pre-integrity artifacts are created.
- No final artifacts are created.
- No MOD files are generated.
- No checksum or integrity adapter is executed.
- No native DLL or external executable is invoked.
- No real ECU rule is included.
- No A3, A4 or A5 processing is enabled.
- No customer delivery is enabled.

## Default Feature Flags

All processing-related flags fail closed:

- `DTC_INTERNAL_TEST_PROCESSING=false`
- `DTC_SYNTHETIC_FIXTURES=false`
- `DTC_REAL_ECU_RULES=false`
- `DTC_REAL_INTEGRITY_ADAPTERS=false`
- `DTC_A3_PRODUCTION_PROCESSING=false`
- `DTC_A4_AUTOMATION=false`
- `DTC_A5_AUTOMATION=false`
- `DTC_CUSTOMER_DELIVERY=false`
- `DTC_INSTRUCTION_PATCH_OPERATIONS=false`
- global kill switch engaged in production-like environments

Tests explicitly pass synthetic-only flags to exercise the dry-run compiler.

## Dry-Run Report

A dry-run report can include:

- requested DTC codes;
- matched rule and adapter digests;
- intended operation IDs;
- intended offset/length metadata for admin review;
- hard-veto reasons;
- safety booleans proving no byte mutation and no artifact creation.

Customer projections strip all rule, adapter, offset, operation, digest and private metadata.

## Phase C Boundary

Phase C is not started. Before Phase C, the project still needs an explicit review for:

- local test artifact policy;
- non-production worker isolation;
- additional migration review;
- corpus runner hardening;
- independent approval workflow;
- real rule/adaptor exclusion enforcement.
