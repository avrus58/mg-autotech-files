# MG AutoTech Vehicle Database Control Center

## Purpose

The Vehicle Database Control Center moves vehicle data management from production JSON files into Supabase tables. `data/vehicle-database.json` remains the raw CareEcuFile source and the application keeps a JSON fallback, but production management is database-first.

## Migration

Run the SQL in this order:

1. Confirm `scripts/add-staff-access-notifications.sql` has already been applied in the environment. This is expected from the existing staff access system.
2. Run `scripts/add-vehicle-control-center.sql`.
3. Run `scripts/verify-vehicle-control-center.sql`.

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
- `/admin/vehicles/validation`
- `/admin/vehicles/audit`
- `/admin/vehicles/[id]`

Admin users with `vehicles.manage` can import, create draft records, edit records, publish/unpublish, archive with `active=false`, view validation warnings and review audit history.

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

## Security

Admin APIs use `requireStaffPermission(request, 'vehicles.manage')`.

Anonymous users and normal customers cannot access:

- `/api/admin/vehicles`
- `/api/admin/vehicles/import`
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
