# DTC Active Phase A Architecture

Phase A is a foundation layer only. It introduces read-only contracts, status visibility and customer-safe projections without enabling binary processing.

## Runtime Components

- `src/lib/dtcActive/policy.ts`: policy version, hard-veto list and fail-closed feature flags.
- `src/lib/dtcActive/codes.ts`: DTC parsing, normalization and conservative risk classification.
- `src/lib/dtcActive/customerVisibility.ts`: positive customer-safe status projection and recursive forbidden-key guard.
- `src/lib/dtcActive/status.ts`: admin foundation status payload.
- `src/lib/dtcActive/canonicalJson.ts`: deterministic JSON canonicalization and SHA-256 document digests.
- `src/lib/dtcActive/schemas.ts`: strict Phase B rule, adapter and corpus document validation.
- `src/lib/dtcActive/registry.ts`: synthetic-only exact-match registry for approved/non-revoked documents.
- `src/lib/dtcActive/dryRunCompiler.ts`: synthetic dry-run report compiler with hard-veto checks and no byte mutation.
- `src/lib/dtcActive/goldenCorpus.ts`: synthetic golden corpus regression harness.
- `src/app/api/admin/dtc/foundation/route.ts`: staff-only read-only status API.
- `src/app/api/requests/[id]/dtc-status/route.ts`: authenticated customer, own-order-only positive status.
- `src/app/admin/dtc/page.tsx`: read-only admin foundation and Phase B synthetic registry page.

## Server Authority

All meaningful status is produced by server code. Clients do not receive service-role keys, private schema content, rule documents, adapter documents, storage paths, offsets, byte operations or checksum internals.

## Active Processing Boundary

Not implemented in Phase A or Phase B:

- rule import;
- rule promotion;
- adapter import;
- worker claims;
- source artifact loading;
- binary transformation;
- integrity adapter execution;
- native DLL or external executable execution;
- final artifacts;
- publication grants;
- customer downloads.

Phase B can validate synthetic documents and produce dry-run reports. The reports are advisory metadata only and assert:

- `firmwareBytesMutated: false`;
- `outputArtifactCreated: false`;
- `integrityAdaptersExecuted: false`;
- `nativeExecutionUsed: false`.

## Customer Surface

Customer DTC status contains only:

- request id;
- positive public status;
- normalized requested codes;
- customer message;
- `downloadable: false`;
- timestamp.

It intentionally excludes private evidence, rules, adapters, offsets, operations, checksum data, storage paths, source URLs and confidence internals.
