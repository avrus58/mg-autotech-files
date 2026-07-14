# DTC Active Phase A Validation

Phase A scope is a read-only foundation only. It imports the active-processing
research package into repository documentation, reconciles the target schema
against the current MG AutoTech architecture, adds a non-applied migration draft,
and exposes status/admin/customer-safe projections without any active file
mutation path.

## Baseline

- `npm test`: passed, 365/365 before Phase A implementation.

## Environment Checks

- Supabase CLI: pinned as local dev dependency (`supabase@2.109.1`).
- Local/disposable database migration apply: completed against the local Supabase stack.
- Docker Desktop/WSL2: available for this verification pass; `docker ps` succeeded.
- Local database: `supabase_db_mg-autotech-files` healthy during verification.
- Production Supabase: not touched.
- Production deploy: not performed.
- Real ECU rules, checksum adapters, A4/A5 automation, customer delivery and MOD generation: not implemented.

## Post-Implementation Checks

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 373/373.
- `npm run build`: passed.
- `node scripts/check-payment-env.js --schema-only`: passed; no environment files were read.
- `npm audit --omit=dev --audit-level=high`: passed; 0 vulnerabilities.
- `git diff --check`: passed with only the existing CRLF warning for `src/app/admin/page.tsx`.

## Migration Reconciliation

- Migration file prepared: `scripts/add-dtc-active-processing-phase-a.sql`.
- The SQL is additive and creates metadata/control tables under `dtc_private`.
- Customer-readable state is limited to a positive projection table with RLS.
- Admin/staff read access is tied to the existing `ai_training.manage` permission boundary.
- No raw binary, byte patches, offsets, storage paths, real ECU rules, checksum-corrected outputs or delivery artifacts are stored.
- No destructive SQL was found by the Phase A safety test or the manual keyword scan.
- The customer-safe projection now explicitly grants `SELECT` to `authenticated` and revokes `anon`, matching current Supabase behavior where new public tables are not automatically exposed to API roles.

## Production Application Boundary

- The Phase A SQL has been verified locally only.
- Production migration remains a separate reviewed owner-controlled action.
- Phase B must not begin from production state alone; it should use this verified schema boundary and a separate Phase B plan.

## Phase A Database Verification Attempt

Date: 2026-07-14.

Requested next step was to close the Phase A database verification blocker before
starting Phase B. The repository and local machine were inspected without using
production credentials or production Supabase access.

Findings:

- A local Supabase project was initialized with `supabase init`.
- A local-only baseline migration was added at `supabase/migrations/20260714132000_dtc_phase_a_test_baseline.sql`.
- A local verification script was added at `scripts/verify-dtc-active-phase-a-local.sql`.
- Existing database change files are currently kept as reviewed SQL scripts under
  `scripts/*.sql`.
- `npx supabase --version` reports `2.109.1`.
- `supabase start`, `supabase db query --local --file`, and `supabase db reset --local`
  were discovered from CLI help and are available.
- `docker ps` succeeded.
- `npx supabase start -x edge-runtime,gotrue,imgproxy,kong,logflare,mailpit,postgres-meta,postgrest,realtime,storage-api,studio,supavisor,vector` started the disposable local DB stack.
- The baseline migration was applied by the local Supabase stack.
- `scripts/add-dtc-active-processing-phase-a.sql` was applied through local container `psql` with `ON_ERROR_STOP=1`.
- `scripts/verify-dtc-active-phase-a-local.sql` passed through local container `psql` with `ON_ERROR_STOP=1`.
- `psql --version` could not run because `psql` is not installed or not on PATH.
- `package.json` and `package-lock.json` include pinned `supabase@2.109.1`.
- No production Supabase project was queried, linked, reset, migrated or modified.

Official Supabase documentation currently describes the supported local workflow
as:

- initialize local configuration with `supabase init`;
- create migrations with `supabase migration new <name>`, which creates files in
  `supabase/migrations/<timestamp>_<name>.sql`;
- start the local stack with `supabase start`;
- reset/apply local migrations with `supabase db reset`;
- inspect with local database commands such as `supabase db lint` and pgTAP via
  `supabase test db`, where available.

The first verification script run exposed one local harness-only issue: the
temporary probe table was owned by `postgres`, then the simulated
`authenticated` role could not insert into it. The harness now grants
`insert, select` on the temporary probe table to `authenticated`, and the
verification script passes.

Verified database behavior:

1. `dtc_private` schema exists.
2. All Phase A private DTC tables exist.
3. RLS is enabled on every private DTC table and the customer-safe projection.
4. `anon` cannot select `public.dtc_request_status_public`.
5. `authenticated` can select only the customer-safe projection.
6. Cross-tenant projection isolation returns exactly one row for the simulated customer.
7. `service_role` can insert/update the customer-safe projection.
8. Append-only triggers block mutable rule document updates.
9. No firmware bytes, raw hex, storage paths, checksum adapters, MOD outputs or customer delivery paths are present.

DATABASE_VERIFIED: Yes, local disposable Supabase only.
