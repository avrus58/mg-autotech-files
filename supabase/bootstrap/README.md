# Isolated staging schema bootstrap

This package reconstructs the application-owned database schema for the owner-authorized ECU Intelligence Center v1 staging release.

Authorized identities:

- production source ref: `jujaeyvyaeesmipihrrw`
- isolated staging target ref: `vxdxdvtsopsjatukdbuq`
- staging branch: `staging/ecu-intelligence-v1`
- release commit: `d28b09f615959ecc24cc96a3e982344d09cacc49`
- staging policy commit: `c2ddd0355625c65bace2ba507a579246922feead`

## Package

- `mg_autotech_schema_baseline.sql`: application-owned `public` schema DDL reconstructed through SELECT-only `pg_catalog` metadata. It includes tables, sequences, functions, constraints, indexes, comments, RLS, policies, triggers, publication membership, grants, and application-owned default privileges. Supabase-managed `supabase_admin` default privileges remain platform-owned and are not altered. It contains no table rows.
- `managed_schema_overlays.sql`: one application auth trigger and eleven application storage policies. It does not recreate Supabase-managed auth or storage schemas.
- `staging_preflight.sql`: catalog-only empty/bootstrap-safe check.
- `staging_verify.sql`: catalog-only post-bootstrap structure, RLS, policy, authorization-default, DTC-default, and no-`bytea` check.
- `scripts/bootstrap-isolated-staging.mjs`: hard-locked guard for the isolated staging ref. It refuses production, excludes the fake local baseline, stops on the first CLI failure, suppresses child command output, and writes a credential-free audit report under `.autopilot/runtime/`.

## SHA-256 digests

- `mg_autotech_schema_baseline.sql`: `0539BE5200B97859B74790A21EE7E8EE7203B3F6660B9060B5148C8D6A21DEE7`
- `managed_schema_overlays.sql`: `4654F13BC6095119E78F96408F864DA2DF7E932FD2FAF51F10BBC2A7F665C2B1`

## Production access proof

The baseline was generated through the authenticated Supabase connector using only `pg_catalog`, `information_schema`, policy, function, trigger, grant, extension, publication, and migration-history metadata. No application table rows, auth users, storage objects, customer/order/payment rows, firmware metadata, paths, credentials, or PII were selected or exported.

## Migration classification

| Migration | Classification | Reason |
| --- | --- | --- |
| `20260714132000_dtc_phase_a_test_baseline.sql` | Local-test-only, never remote | Creates fake `orders`, `request_work_orders`, and a deny-all helper only for disposable Phase A migration verification. |
| `20260714204125_dtc_active_processing_phase_a.sql` | Staging-safe additive | Metadata-only private DTC foundation, customer-safe status projection, RLS, and defaults closed for production processing and delivery. |
| `20260714212824_dtc_active_processing_phase_c_synthetic_test_output.sql` | Staging-safe additive schema, runtime disabled | Private synthetic-test metadata tables only. It grants no customer delivery and stores no firmware bytes. Staging feature flags keep synthetic processing disabled. |
| `20260714220848_dtc_phase_c1_durable_synthetic_artifacts.sql` | Staging-safe additive | Adds only the `INTERNAL_TEST_ONLY` classification column. |
| `20260715195048_learning_flywheel_candidates.sql` | Staging-safe additive | Private candidate metadata, RLS, review-first workflow, and `not_granted` learning authorization defaults. It inserts no terms or authorization rows. |
| `20260716005208_learning_flywheel_production_readiness_hardening.sql` | Staging-safe additive hardening | Adds private authorization evidence and durable ingestion jobs, tightens private-table grants, and consolidates the equivalent DTC customer-or-staff read policy. It inserts no application rows. |

## Guarded use

The tool reads staging credentials only from process memory. It never reads `.env` files and never prints credential values.

```powershell
node scripts/bootstrap-isolated-staging.mjs --target-ref vxdxdvtsopsjatukdbuq
node scripts/bootstrap-isolated-staging.mjs --target-ref vxdxdvtsopsjatukdbuq --apply
```

The first command is preflight-only. The second applies the baseline, overlays, and the four allowlisted additive migrations. The tool uses a disposable runtime workdir and unlinks the staging project on completion.

Never run this package with the production ref. Never add the local fake baseline to the remote allowlist. Never add seed or data-copy statements to the baseline.
