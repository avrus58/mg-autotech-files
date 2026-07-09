# Vehicle Control Center Production Smoke Checklist

Use this checklist after the Vehicle Database Control Center changes are deployed. Do not run the real import until dry-run counts are reviewed.

## 1. Database

1. Run `scripts/add-vehicle-control-center.sql` in Supabase SQL editor.
2. Run `scripts/verify-vehicle-control-center.sql`.
3. Confirm every expected vehicle table exists.
4. Confirm RLS is enabled for every vehicle table.
5. Confirm policies include `has_staff_permission('vehicles.manage')`.
6. Confirm the unrestricted-policy query returns zero rows.
7. Confirm at least one owner/admin profile exists or that the current admin can open `/admin/vehicles`.

## 2. Deploy

1. Deploy the current branch after all local checks pass.
2. Do not run production import from scripts or database tools.
3. Open [https://file.mgautotech.de/admin/vehicles](https://file.mgautotech.de/admin/vehicles) as owner/admin.
4. Confirm the dashboard loads without console errors.
5. Confirm any staff-role warning is understood before import.

## 3. Admin Pages

1. Open `/admin/vehicles`.
2. Open `/admin/vehicles/import`.
3. Open `/admin/vehicles/validation`.
4. Open `/admin/vehicles/audit`.
5. Open one `/admin/vehicles/[id]` detail page after import.
6. Confirm empty states are readable if no records exist yet.
7. Confirm loading and error states are clear if the migration is missing.

## 4. Import Flow

1. Run dry-run import only.
2. Confirm rows, created, updated, skipped, errors and warnings are shown.
3. Review warning count and duplicate count.
4. Run real import only if dry-run looks sane and the admin explicitly confirms.
5. After real import, confirm an import batch row exists.
6. Confirm audit entries exist for import create/update/error actions.

## 5. Public Selector

1. Open `/api/vehicles?type=brands`.
2. Confirm JSON is returned.
3. Confirm `x-vehicle-source` is `json` before import or `database` after published DB rows exist.
4. Open `/new-request`.
5. Select brand, model, generation and engine.
6. Confirm vehicle details render.
7. Confirm response JSON does not expose admin-only fields such as admin notes, audit data, source references, confidence score, validation details or import metadata.

## 6. Widget Selector

1. Open the widget flow with a valid widget key in the normal widget test page.
2. Confirm makes/models/years/engines load.
3. Confirm selected vehicle output is customer-safe only.

## 7. Security Checks

1. Incognito: open `/api/admin/vehicles`; expected `401`.
2. Incognito: open `/api/admin/vehicles/audit`; expected `401`.
3. Normal customer token: call `/api/admin/vehicles`; expected `403`.
4. Owner/admin token: call `/api/admin/vehicles`; expected `200`.
5. Confirm browser console has no obvious errors.

## 8. Optional Local Smoke Script

Run:

```bash
VEHICLE_SMOKE_BASE_URL=https://file.mgautotech.de node scripts/smoke-vehicle-control-center.mjs
```

The script checks public-safe endpoints only and never requires admin tokens.
