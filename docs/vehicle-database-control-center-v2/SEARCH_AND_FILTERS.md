# Vehicle Database Control Center v2 - Search and Filters

## Implemented list contract

The main admin record list is loaded independently from the overview metrics through:

```text
GET /api/admin/vehicles/search
```

The route remains server-only, requires `vehicles.manage`, returns `Cache-Control: private, no-store`, and accepts only these query parameters:

- `page`: integer from 1 through 10,000; default `1`
- `pageSize`: `25`, `50`, or `100`; default `25`
- `q`: trimmed text up to 120 characters; after normalization it must contain at least one letter or number
- `brand`: optional, normalized brand-name text up to 120 characters
- `model`: optional, normalized model-name text up to 120 characters
- `generation`: optional, normalized generation-name text up to 120 characters
- `ecuFamily`: optional, normalized ECU-family text up to 120 characters
- `publishStatus`: `all`, `published`, `draft`, or `archived`
- `verificationStatus`: `all`, `imported`, `unverified`, `needs_review`, `verified`, or `rejected`

Unknown parameters and invalid values return HTTP 400. Anonymous and unauthorized callers remain denied by the existing staff permission guard.

The response contains `records`, the normalized `query`, and exact pagination metadata: `page`, `pageSize`, `total`, `pageCount`, `hasPreviousPage`, and `hasNextPage`.

For backward compatibility, the existing `GET /api/admin/vehicles` response still includes its bounded 150-record legacy window by default. The control-center UI requests `includeRecords=false` for its overview call and loads the list from the dedicated endpoint, avoiding that duplicate record payload.

## Query behavior

The repository query uses an exact count, a bounded range, and deterministic `updated_at DESC, id DESC` ordering. Publish states have non-overlapping semantics:

- published: `active = true` and `published = true`
- draft: `active = true` and `published = false`
- archived: `active = false`

The current no-migration search covers the engine-root fields that are already populated by admin and import writes:

- vehicle key
- denormalized display name, normally containing brand/model/generation
- engine name/code
- external ID
- fuel type
- source reference

Brand, model and generation filters use the existing engine-to-generation-to-model-to-brand foreign-key path. ECU-family filtering uses an inner ECU embed only while that filter is active, so unfiltered lists continue to include engines that have no ECU variant. These related filters are applied on the server and participate in the same exact root-record count and deterministic pagination as publish and verification filters.

The list projection is intentionally narrower than the record-detail projection. It returns only the fields rendered in the list and excludes source references, admin notes, ECU hardware/software and other non-list metadata.

PostgREST control characters are removed before the server builds the fixed allowlisted OR filter. Normalized token separators become server-owned wildcard gaps, so a pasted source reference such as `vehicle_enrichment` can still match without accepting a caller-owned wildcard or filter fragment. Punctuation-only searches are rejected instead of falling back to an unfiltered catalogue. The client never supplies a column, operator, or SQL fragment.

## Admin URL and request lifecycle

The admin UI keeps `q`, brand, model, generation, ECU family, publish state, verification state, page, and page size in the URL. Text filters are debounced by 300 ms. Each list request owns an `AbortController`; a superseded request is cancelled and cannot replace a newer result. Initial loading uses skeleton rows, refresh failures keep the last successful page, and retry/empty/clear-filter states are explicit.

## Known limitations and follow-up

This slice intentionally does not claim universal free-text search across ECU HW/SW, TCU metadata, aliases, services, and every hierarchy table. It provides separate hierarchy and ECU-family filters without OR-ing across one-to-many relations. A future indexed search view or narrowly authorized RPC for broader free text requires an additive migration and local query-plan evidence first.

No index was added without `EXPLAIN (ANALYZE, BUFFERS)` evidence. The current schema has useful hierarchy, publish-state, vehicle-key, ECU-engine, and service indexes, but lacks proven indexes for `%term%` search, verification plus update ordering, and broad ECU text search.

Repository inspection also found a pre-existing DDL discrepancy: `scripts/add-vehicle-control-center.sql` and `supabase/bootstrap/mg_autotech_schema_baseline.sql` do not describe the same source/import-batch column types and shapes. That reconciliation is a separate blocking database task; it must not be silently folded into list pagination.
