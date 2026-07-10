# MG AutoTech Security Notes

This document captures the current production security posture for the file-service platform.

## Access Control

- Admin APIs must use staff permission checks through the server auth helpers.
- Customer APIs must always verify row ownership before returning request, message, payment, File Expert or order data.
- Public APIs must use explicit safe projections instead of returning raw database rows.
- Service-role Supabase access must stay server-side only and must never be exposed through `NEXT_PUBLIC_` variables.

## Customer Data Boundaries

Customers must not receive:

- internal notes
- audit logs
- admin risk flags
- storage paths
- raw binary or hex previews
- binary offsets
- provider/source/private sample metadata
- private hashes
- confidence_score/internal confidence fields
- source_reference/import metadata
- VIN-like private identifiers unless intentionally exposed in a customer-safe workflow

## File Expert

- Customer File Expert job detail responses are sanitized before returning to the browser.
- Customer File Expert reports hide binary previews, hashes, offsets, storage paths, provider/source data and private sample identifiers.
- Admin users can still access technical evidence required for review.
- AI/File Expert remains evidence-only: no MOD generation, no byte editing and no write-ready output.

## AI Dataset Importer

- Dataset import batches, file candidates, pair candidates, review events and negative examples are admin-only.
- Dry-run mode must not read production storage, write files or create training samples.
- Suggested service labels are not trusted `actual_service_labels`.
- Learning approval requires explicit human/admin confirmation.
- Dataset importer internals must never be returned to customer or public APIs.

## Vehicle Database

- Public vehicle selector responses use active + published data only.
- Public responses must not expose admin notes, source references, confidence scores, audit/import metadata or internal validation details.
- JSON fallback must remain available if database reads fail or no published records exist.
- Real imports require explicit owner approval and must not be run as part of ordinary deploy smoke tests.

## Payments

- Active methods are Stripe/Card and Bank Transfer.
- PayPal is disabled from active flows; historical PayPal records may remain readable as legacy data only.
- Payment summaries in work orders are read-only operational context.
- Manual crediting must remain auditable and double-credit safe.

## Smoke Tests

Use:

```bash
BASE_URL=https://file.mgautotech.de node scripts/smoke-public-platform.mjs
BASE_URL=https://file.mgautotech.de node scripts/smoke-admin-unauthenticated.mjs
```

These scripts are intentionally non-mutating and contain no secrets.
