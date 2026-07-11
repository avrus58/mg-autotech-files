# MG AutoTech Vehicle Database Control Center

## Purpose

The Vehicle Database Control Center moves vehicle data management from production JSON files into Supabase tables. `data/vehicle-database.json` remains the raw CareEcuFile source and the application keeps a JSON fallback, but production management is database-first.

## Migration

Run the SQL in this order:

1. Confirm `scripts/add-staff-access-notifications.sql` has already been applied in the environment. This is expected from the existing staff access system.
2. Run `scripts/add-vehicle-control-center.sql`.
3. Run `scripts/verify-vehicle-control-center.sql`.
4. Run `scripts/add-vehicle-normalization-aliases.sql` when alias tables are not present yet.
5. Run `scripts/add-public-vehicle-catalog-cache.sql` to enable the fast public selector snapshot.
6. Run `scripts/verify-public-vehicle-catalog-cache.sql`.

The migration creates:

- `vehicle_data_sources`
- `vehicle_import_batches`
- `vehicle_brands`
- `vehicle_models`
- `vehicle_generations`
- `vehicle_engines`
- `vehicle_ecu_variants`
- `vehicle_service_capabilities`
- `vehicle_performance_profiles`
- `vehicle_change_audit_log`
- `vehicle_validation_results`
- `public_vehicle_catalog_cache`

It enables RLS and grants access through `public.has_staff_permission('vehicles.manage')`. It contains no destructive data operations.

## Verification SQL

Run this read-only verification file after the migration:

```text
scripts/verify-vehicle-control-center.sql
```

Confirm:

- every vehicle table exists
- RLS is enabled on every vehicle table
- expected indexes exist
- policies are guarded by `has_staff_permission`
- the unrestricted-policy query returns zero rows
- row counts are visible for vehicle tables, import batches, validation results and audit logs

The verification SQL does not change data.

## Owner/Admin Access Check

The app-side admin guard treats the Primary Owner as allowed even if the profile has no explicit `vehicles.manage` permission. In Supabase, verify at least one admin owner profile exists:

- `role = 'admin'`
- preferably `staff_role = 'owner'`

If the owner profile has a missing staff role, `/admin/vehicles` still works through the app guard, but the dashboard will show a warning so the profile can be normalized before heavy operations.

## Admin URLs

- `/admin/vehicles`
- `/admin/vehicles/brands`
- `/admin/vehicles/models`
- `/admin/vehicles/generations`
- `/admin/vehicles/engines`
- `/admin/vehicles/import`
- `/admin/vehicles/enrichment`
- `/admin/vehicles/coverage`
- `/admin/vehicles/validation`
- `/admin/vehicles/audit`
- `/admin/vehicles/[id]`

Admin users with `vehicles.manage` can import, create draft records, edit records, publish/unpublish, archive with `active=false`, view validation warnings and review audit history.

## URL-Based Enrichment Import

The Vehicle Enrichment Center supports a controlled one-page URL import for admin review.

Admin can paste a source URL, choose a source type, click `Fetch URL + Extract Vehicles`, review extracted candidates, and then run the normal dry-run normalize/compare workflow.

Safety rules:

- exact URL only
- no broad crawling
- no anti-bot bypass
- localhost/private IP/file URLs blocked
- response timeout and size limit enforced
- no auto-publish
- no overwrite of verified records
- source URLs and extraction metadata stay admin-only
- customers see only published customer-safe vehicle records

Operational details are documented in:

```text
docs/vehicle-url-enrichment-import.md
```

## Import Flow

1. Open `/admin/vehicles/import`.
2. Run dry-run first.
3. Review valid importable, would-create, would-update, duplicate skip, invalid skip, needs-review, protected-manual, error and warning counts.
4. Run real import only after the SQL migration is active and the dry-run result is acceptable.

The importer is additive and valid-only by default. It upserts CareEcuFile source rows by stable `vehicle_key`, tracks batches and avoids overwriting verified manual records from non-CareEcuFile sources.

Before the first production import, the importer filters the raw CareEcuFile source:

- Duplicate `vehicle_key` groups are skipped completely by default. The first import does not try to guess a winner.
- Blocking-invalid rows are skipped. This includes missing identity fields, invalid year ranges and unrealistic stock/tuned HP/NM values.
- Missing ECU type is a warning, not a blocking error. The record can import as lower-confidence `needs_review`.
- Stage 1 records with missing tuned HP/NM are warnings, not blocking errors, unless the app cannot safely display them.
- Missing stock performance is a warning unless validation turns it into a blocking error.
- Info-level generation overlap warnings are noisy and non-blocking.

Dry-run calculates the expected import impact. When Supabase admin env values are available, it also checks existing `vehicle_engines` and reports would-create, would-update and protected manual verified counts. If the env values are missing locally, the dry-run still reports the valid-only source plan but marks `dbDiffCalculated=false`.

Real import now requires an explicit confirmation text in the admin UI. This is intentional production safety.

## Public Selector Behavior

The public selector uses `getSafePublishedVehicleRows()`:

1. Try active + published Supabase vehicle records.
2. If no database rows are available, fall back to `data/vehicle-database.json` plus `data/vehicle-performance-overrides.json`.
3. If the new Supabase tables do not exist yet, fall back to JSON.
4. If the database query fails, fall back to JSON.

Customer-facing APIs expose only safe fields. They must not expose:

- admin technical notes
- audit history
- source provider internals
- confidence internals
- validation warnings
- private source references
- alias/internal metadata
- public catalog cache internals

To confirm fallback, open:

```text
/api/vehicles?type=brands
```

Before import or when the database has no published records, the response header should be:

```text
x-vehicle-source: json
```

After a successful real import with published rows, the response header should become:

```text
x-vehicle-source: database
```

After the Public Catalog Cache is rebuilt, the response header should become:

```text
x-vehicle-source: cache
```

### Public Catalog Cache

The public vehicle selector can use a Supabase-backed snapshot stored in:

```text
public.public_vehicle_catalog_cache
```

The cache row uses `id = 'published'` and contains only the customer-safe selector payload:

- published active vehicle rows
- canonical brands
- canonical models by brand
- canonical generations by model
- engines by generation

The cache excludes admin notes, source references, confidence scores, validation metadata, import metadata, audit data, alias tables and private storage paths. Public users do not read this table directly. `/api/vehicles` reads it server-side, returns the safe payload slices and falls back to the database loader or JSON when the cache is missing.

Admin rebuild:

1. Open `/admin/vehicles`.
2. Click `Rebuild Public Catalog Cache`.
3. Confirm the message shows brand, model, generation and engine counts.
4. Open `/api/vehicles?type=brands` and confirm `x-vehicle-source: cache`.

Rebuild the cache after real import, publish/unpublish, vehicle edits or alias changes. The operation does not import vehicles and does not publish drafts.

## Vehicle Normalization & Alias System

Vehicle data can arrive from different sources with different naming conventions. MG AutoTech keeps a single clean customer-facing hierarchy by normalizing source names before public grouping, import deduplication and validation.

The central helper is:

```text
src/lib/vehicleNormalization.ts
```

It provides:

- `normalizeText`
- `normalizeBrandName`
- `normalizeModelName`
- `normalizeGenerationName`
- `normalizeEngineName`
- `buildCanonicalVehicleKey`
- `resolveAliasCandidate`
- `compareNormalizedNames`

### Canonical Names

The system normalizes common brand and model aliases into canonical families. Examples:

- `Mercedes`, `Mercedes Benz`, `Mercedes-Benz`, `MB` -> `Mercedes-Benz`
- `Bmw`, `BMW`, `Bayerische Motoren Werke` -> `BMW`
- `VW`, `Volkswagen` -> `Volkswagen`
- Mercedes `E`, `E-Class`, `E Klasse`, `E-Klasse` -> customer-facing `E`
- Mercedes `C`, `C-Class`, `C Klasse`, `C-Klasse` -> customer-facing `C`

Generation aliases are normalized conservatively by platform code when clear. Examples:

- `W214`
- `W 214`
- `E-Class W214`
- `E Klasse W 214`

all resolve to `W214`. Combined current-generation labels such as `W214/S214/V214 (2023-present)` remain grouped under the same canonical Mercedes `E` model family.

### Import Resolution

Dry-run import reports alias resolution before any real write. The preview shows:

- source brand/model/generation
- resolved canonical brand/model/generation
- matched alias type
- whether the canonical model will be reused
- whether the vehicle key would change after normalization

Example:

```text
Mercedes / E-Class / E Klasse W 214
-> Mercedes-Benz / E / W214
```

Real import uses canonical keys for new records, but it does not destructively merge existing records.

### Public Selector Behavior

The customer selector groups by canonical brand, model and generation names. Customers should see clean choices such as:

```text
Mercedes-Benz -> E -> W214/S214/V214 (2023-present)
```

They should not see duplicate model families such as:

```text
E
E-Class
E Klasse
```

Customers never see alias tables, source names, normalized keys, source references, confidence scores, batch IDs, duplicate warnings, validation metadata or admin notes.

### Validation Warnings

Validation is intentionally non-destructive. It warns when:

- the same normalized brand appears with different display names
- the same normalized model appears under the same brand with different display names
- the same normalized generation appears with different labels
- a canonical vehicle key would differ from an existing legacy/source key
- a vehicle key collision could occur after normalization

These warnings are for admin review. The app must not auto-merge or delete records.

### Alias Tables

The optional migration:

```text
scripts/add-vehicle-normalization-aliases.sql
```

adds admin-only alias tables:

- `vehicle_brand_aliases`
- `vehicle_model_aliases`
- `vehicle_generation_aliases`
- `vehicle_engine_aliases`
- `vehicle_alias_review_events`

These tables are additive, RLS-protected and guarded by `vehicles.manage`. They are for future admin-approved alias workflows. Applying an alias must be audited and must not automatically destroy or merge existing records.

### VehicleKey Stability

Existing request records may already reference legacy `vehicleKey` values. For that reason:

- existing keys are not rewritten automatically
- canonical keys are used for new imports/records
- validation reports a warning when an old key differs from the canonical key
- old/source references should be preserved where needed
- any manual cleanup must be handled by an explicit admin-reviewed migration plan, not automatic code

This keeps historical requests stable while preventing new duplicate model families.

## External Vehicle Coverage

The enrichment system is global, not Mercedes-only. `/admin/vehicles/coverage` provides an external coverage dry-run workflow for all brands, models, generations and engines.

It reuses the admin-only `vehicle_external_*` staging/review tables and compares legal external JSON, CSV or manually prepared source data against the canonical Vehicle Database. The coverage report shows missing brands, missing models, missing generations, missing engines, alias suggestions, duplicate risks, conflicts, protected verified-data conflicts and review queue items.

External coverage never auto-publishes and never overwrites verified MG AutoTech data. Creating a draft requires explicit admin confirmation and produces an unpublished `needs_review` record. The public selector changes only after an admin verifies/publishes records and rebuilds the Public Catalog Cache.

More detail:

```text
docs/external-vehicle-coverage-system.md
```

## Security

Admin APIs use `requireStaffPermission(request, 'vehicles.manage')`.

Anonymous users and normal customers cannot access:

- `/api/admin/vehicles`
- `/api/admin/vehicles/import`
- `/api/admin/vehicles/coverage`
- `/api/admin/vehicles/validation`
- `/api/admin/vehicles/audit`
- `/api/admin/vehicles/[id]`

The public `/api/vehicles` route remains safe for customer selector usage.

## Smoke Tests Before Deploy

1. Run `npm run lint`.
2. Run `npm run typecheck`.
3. Run `npm test`.
4. Run `npm run build`.
5. Apply `scripts/add-vehicle-control-center.sql` in Supabase.
6. Open `/admin/vehicles` as owner/admin.
7. Run dry-run import.
8. Run real import only when dry-run looks sane.
9. Open `/api/vehicles?type=brands` and confirm it returns public-safe data.
10. Confirm `/api/admin/vehicles` returns `401` without an admin token.

See the full production checklist:

```text
docs/vehicle-control-center-production-smoke.md
```

## App-Level Rollback

If deployment needs to be reverted, revert the application deployment to the previous Vercel build or previous Git commit. Do not run destructive rollback SQL. The new tables can remain in Supabase unused; the public selector still has JSON fallback and old app versions will ignore the new tables.

## Known Limitations

- The first import should be reviewed because raw CareEcuFile data can contain duplicate or incomplete records.
- Public selector DB reads are performed server-side via the service role and projected to safe fields.
- Validation detects suspicious ranges and duplicates, but human verification is still required before publishing high-trust records.
