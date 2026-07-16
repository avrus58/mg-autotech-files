# ECU Intelligence Production Release Plan

Status: owner approval package and dry run only. This document does not authorize a production database change, environment change, merge, promotion, or deployment.

Prepared: 2026-07-16

## Fixed release identity

| Item | Fixed value | Verification |
| --- | --- | --- |
| Staging branch | `staging/ecu-intelligence-v1` | Local and origin matched at verification time |
| Runtime candidate SHA | `04b899df85f4ef5bb279cb11083974c70b82a8c8` | Git-linked Preview source; application code is unchanged from hardening commit `09a5ec5` |
| Production Supabase ref | `jujaeyvyaeesmipihrrw` | `ACTIVE_HEALTHY`, Postgres 17, read-only catalog inspection only |
| Isolated staging ref | `vxdxdvtsopsjatukdbuq` | `ACTIVE_HEALTHY`, distinct from production |
| Verified Preview | `dpl_9dSqiXFaG5xzmGBMpvb8GYyHvHVx` | Target `preview`, status `Ready` |
| Preview URL | `https://mg-autotech-files-22dce5eak-avrus58s-projects.vercel.app` | Current root probe returned `200` |
| Vercel project | `avrus58s-projects/mg-autotech-files` | Project id `prj_6hTWgfloM7SCDtZnR3gnfDipwP2h` |

Do not substitute another commit, Supabase ref, Vercel project, or Preview promotion. If any identity changes, repeat the dry run and owner review.

## Initial production boundary

Included:

- metadata-only file candidate capture;
- metadata-only ORI/MOD pair candidate capture;
- staff-only candidate review and corpus coverage;
- ECU Intelligence Center, graph, services, patterns, similarity, review queue, and deterministic insights;
- read-only DTC foundation and customer-safe status projection;
- durable candidate-ingestion jobs, idempotency, bounded retries, and staff observability;
- existing customer upload, request, File Expert, payment, email, and delivery behavior without widening their authority.

Excluded and required to remain disabled:

- learning approval and promotion into training samples;
- historical backfill;
- learning authorization capture until owner/legal terms are approved;
- internal synthetic processing in production;
- real ECU processing, firmware mutation, MOD generation, Stage 1/Stage 2 generation, or real DTC modification;
- real rules, checksum or integrity adapters, A3/A4/A5, instruction patching, and automatic customer output delivery.

Candidate capture in this release means **allowed but not granted for learning**: rows may be captured as private review candidates, while `learning_authorization_status` remains the database value `not_granted`, `learning_use_status` remains `pending`, and approval remains disabled.

## Final staging evidence

- Staging migration ledger contains the schema baseline, managed overlays, DTC Phase A, synthetic Phase C, Phase C.1, Learning Flywheel candidates, and production-readiness hardening. Exact versions are in `PRODUCTION_MIGRATION_PLAN.md`.
- The production-derived base still matches: 75 base public tables, 1,120 base public columns, and column digest `519517a0c008ccd5357376016588debe` on both production and staging.
- Staging adds 7 public release tables and 13 `dtc_private` tables. All 95 public/private tables have RLS enabled. No `bytea` column exists in either release schema.
- Current exact staging audit checked 95 application/private tables plus `auth.users` and `storage.objects`: 97 relations, 0 rows, 0 non-empty relations, and 0 temporary cleanup policies.
- `dtc_request_status_public` has one customer-or-staff `SELECT` policy using init-plan-safe authorization checks. Anonymous access and authenticated writes remain denied.
- Branch-scoped Preview configuration has file and pair capture enabled; approval, backfill, and authorization capture disabled; read-only DTC enabled; every processing/delivery flag disabled; and the global DTC kill switch engaged.
- Current Preview probes: root `200`, anonymous learning-corpus API `401`, and authorization config `available=false`, no terms version/URL, no default choice.
- Final staging hardening evidence passed 29/29 staging smoke checks, 31/31 complete-delivery hardening checks, 13/13 repository smoke checks, and 8/8 final Git-linked Preview checks.
- Final repository evidence passed lint, typecheck, 447 tests, a 267-page production build, payment schema-only validation, production dependency audit with 0 vulnerabilities, SQL verification, and diff checks.

## Warnings and technical debt

No release-specific Supabase advisor `WARN` or `ERROR` was introduced relative to the production-derived base.

- The 13 private DTC tables report [`rls_enabled_no_policy`](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) at `INFO`. This is intentional deny-by-default behavior: the private schema is not available to anonymous/authenticated clients and service-role grants are explicit.
- Release tables report 11 [`unindexed_foreign_keys`](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) findings at `INFO`. These include actor/creator references and synthetic-only relationships; they are not a launch blocker at zero-row staging volume, but query plans must be reviewed after real aggregate volume exists.
- Fifteen release indexes report [`unused_index`](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) at `INFO`, expected on an empty staging database.
- Production and staging retain the same 47 inherited schema security warnings and the same 63 inherited performance warnings. They are outside this release and must not be silently represented as fixed.
- Production additionally reports the project-level [leaked-password-protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). The owner should review it separately; this release does not change Auth configuration.
- Owner/legal terms wording, terms version, and HTTPS URL remain unresolved by design. They block authorization capture and learning approval, but do not block private `not_granted` candidate capture.

## Owner-run release sequence

### 1. Pre-deploy review

1. Freeze the release at the fixed SHA and require a clean checkout.
2. Confirm production ref `jujaeyvyaeesmipihrrw` and Vercel project `avrus58s-projects/mg-autotech-files` in two independent views.
3. Re-run the catalog-only preflight and migration-ledger comparison from `PRODUCTION_MIGRATION_PLAN.md`.
4. Confirm the production migration allowlist contains exactly three SQL files and that all SHA-256 digests match.
5. Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `node scripts/check-payment-env.js --schema-only`, and `npm audit --omit=dev --audit-level=high` in the fixed checkout.
6. Confirm the rollback owner, database operator, Vercel operator, monitoring owner, and final go/no-go approver are present.

Stop if the checkout, project identity, migration history, catalog preconditions, digest, or owner roles differ.

### 2. Database phase

1. Enter the owner-approved maintenance window.
2. Check for lock contention using catalog/session counts without reading SQL text or application rows.
3. Run the exact three-file dry run from `PRODUCTION_MIGRATION_PLAN.md` and retain its values-free output in the change record.
4. Obtain the final owner confirmation for database apply.
5. Apply the three migrations in their specified order. Do not run repo-wide `supabase db push`, the production baseline, managed overlays, local fake baseline, Phase C, or Phase C.1.
6. Run the catalog-only post-migration verification queries. Stop before environment or app deployment if any assertion fails.

### 3. Production environment phase

1. Preserve a values-hidden inventory of the prior Production variable names and scopes.
2. Add the 21 release control names with the exact states in `PRODUCTION_ENV_MATRIX.md`.
3. Do not add authorization terms version or URL. Do not alter existing Supabase, payment, email, widget, bank, PayPal, Stripe, site, or desktop values as part of this release.
4. Verify names/scopes without printing values. A second operator confirms approval/backfill/capture are false and the DTC kill switch is true.

### 4. Application deployment phase

1. Merge only the fixed release artifact through the owner-approved `main` release process. Do not promote the Preview deployment.
2. Require the resulting Vercel deployment to be Git-linked to the approved release SHA, target `production`, and status `Ready`.
3. If build or deployment metadata is ambiguous, stop. Do not retry with an unlinked CLI deployment.

### 5. Post-deploy smoke and monitoring

1. Execute every non-mutating check in `PRODUCTION_SMOKE_TESTS.md`.
2. Do not upload a real customer file, manufacture a production fixture, initiate payment, complete delivery, approve a candidate, or run backfill for smoke testing.
3. Keep heightened monitoring for 60 minutes, then perform a 24-hour aggregate review.
4. Monitor candidate ingestion successes/failures/duplicates, oldest pending age, blocked approvals, authorization state, API error rates, delivery isolation, and DTC effective flags. Do not inspect firmware content, storage paths, credentials, or customer PII in the release record.
5. On any stop signal, follow `PRODUCTION_ROLLBACK.md` immediately.

## Stop conditions

- wrong or ambiguous target identity;
- a production release object already exists before migration or a required dependency is missing;
- any migration outside the three-file allowlist appears in the dry run;
- migration checksum mismatch or catalog verification failure;
- approval, backfill, authorization capture, DTC processing, real rules/adapters, A3/A4/A5, patching, or DTC customer delivery resolves true;
- DTC global kill switch resolves false;
- anonymous admin access, customer cross-tenant access, or authenticated writes to the DTC projection succeed;
- candidate capture blocks upload, request finalization, payment, email, or existing delivery behavior;
- deployment is not Git-linked to the approved artifact.

The owner decision and sign-off fields are in `OWNER_GO_NO_GO.md`.
