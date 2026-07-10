# External Vehicle Coverage System

The External Vehicle Coverage system is an admin-only workflow for comparing legally usable external vehicle data with MG AutoTech's canonical Vehicle Database.

It is not a crawler, not an Auto-Data clone, and not a public import pipeline. External data is staged, normalized, compared and reviewed before any internal vehicle record can be created.

## Purpose

The production Vehicle Database already powers the customer selector and widget through a DB-first public catalog cache. Coverage work is needed because new/current vehicles can appear after the initial import, for example new Mercedes, BMW, Audi, Volkswagen and other generation or engine options.

The system helps admins detect:

- missing brands
- missing models
- missing generations
- missing engines
- outdated year ranges
- likely aliases
- duplicate model or generation risks
- vehicleKey collisions after canonical normalization
- source data conflicts with verified internal records
- candidates that need more stock HP/NM, fuel or displacement data

## Supported Sources

Supported source modes are intentionally source-agnostic:

- manual structured paste
- JSON export
- CSV export
- legally usable provider export
- future provider feeds

Direct broad crawling is not supported. Admins should only use source data that MG AutoTech is legally allowed to process.

## Import Flow

1. Admin opens `/admin/vehicles/coverage`.
2. Admin enters source name/reference and pastes JSON or CSV rows.
3. The system runs a dry-run coverage comparison.
4. External names are normalized through the central vehicle normalization helper.
5. The comparison produces coverage stats, issues, alias suggestions, review queue items and source-to-canonical mappings.
6. Admin reviews each candidate.
7. Admin may create an unpublished `needs_review` draft only with explicit confirmation.
8. Admin verifies/edit/publishes later in the Vehicle Database Control Center.
9. After publishing changes, admin rebuilds the Public Catalog Cache.

## Canonical Normalization

External source names are normalized before comparison:

- `MB`, `Mercedes`, `Mercedes Benz` -> `Mercedes-Benz`
- `VW` -> `Volkswagen`
- `E-Class`, `E Klasse`, `E-Klasse` -> `E`
- `W 214`, `E-Class W214`, `W214-S214` -> canonical generation/platform naming

This prevents duplicate public model families such as `E` and `E-Class`.

## Gap Analysis

Coverage comparison is global and works for all brands. It checks whether external candidates match existing canonical records by:

- canonical brand
- canonical model
- generation/platform identity
- engine display name
- stock HP/NM
- displacement
- fuel type
- source confidence
- verification status

If a manual verified internal record conflicts with external source data, the system creates a review/conflict warning and blocks automatic overwrite behavior.

## Candidate Review

External candidates are review items, not public vehicle data.

Admins can decide to:

- create an unpublished draft generation/engine
- link candidate to an existing canonical record
- create an alias suggestion
- create a diff review
- reject candidate
- mark candidate as needing more data
- add notes through review events

No destructive merge is performed automatically.

## Safe Apply Behavior

When an admin creates a draft from a candidate:

- `published = false`
- `verification_status = needs_review`
- source reference remains admin-only
- confidence score remains admin-only
- Stage 1 estimates, if present, are unverified helper values only
- ECU type is not invented
- Stage 2 is not estimated
- verified MG AutoTech data is not overwritten

## Public Selector And Cache

The public selector only reads active and published customer-safe data through `/api/vehicles`.

Customers never see:

- external source names or URLs
- source_reference
- confidence_score
- enrichment batch IDs
- validation metadata
- review events
- admin notes
- alias/internal metadata
- unpublished draft records

After approved/published vehicle changes, the Public Catalog Cache must be rebuilt from `/admin/vehicles`.

## Security

External coverage APIs require `vehicles.manage`.

Anonymous users and customers cannot access:

- `/api/admin/vehicles/coverage`
- enrichment staging tables
- review events
- source references
- alias internals

The staging SQL uses existing `vehicle_external_*` tables and is protected by RLS with staff permission checks.

## Current Limitations

- No direct Auto-Data crawler.
- No automated legal-source validation.
- No destructive record merging.
- No automatic public publishing.
- Admin must verify source quality and publish deliberately.
