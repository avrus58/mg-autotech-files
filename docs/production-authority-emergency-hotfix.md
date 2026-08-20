# Current-production authority emergency hotfix

## Scope

This is the smallest database-first and application-guard containment for the
application currently deployed from `origin/main` at `dad28dd`:

- signup metadata can populate presentation fields only; every new profile is
  forced to `role = customer` and `credit_balance = 0`;
- direct profile writes cannot change identity, credit, account-control or
  staff-authority fields without the exact reviewed authority path;
- PUBLIC/anon lose every profile table privilege, while authenticated keeps
  only the existing read/update compatibility and cannot insert, delete,
  truncate, reference or create triggers on profiles;
- every future profile write must form a coherent tuple: Primary Owner is
  exactly `role=admin/staff_role=owner`, delegated staff use only
  `manager|calibrator|support`, and customers have no staff authority;
- `is_admin()` and all 19 catalog-confirmed legacy admin policies require the
  exact Primary Owner tuple; raw `role='admin'` policy checks are replaced;
- service-role-backed application APIs deny `admin/null`, `staff/null`,
  `staff/owner` and unknown staff roles even if a permission array is present;
- the legacy web/desktop order RPC keeps its exact signature but binds the
  caller, verified e-mail, owner-prefixed Storage object, locked profile and
  server-resolved credit price;
- PUBLIC/anon lose direct orders access and authenticated order creation/deletion
  is removed, closing the permissive direct INSERT policy bypass while keeping
  customer SELECT and the current admin UPDATE path;
- catalog-valid zero-credit requests still work without a profile debit or
  ledger row; negative and catalog-mismatched amounts fail closed;
- the six catalog-confirmed finance RPCs lose implicit `PUBLIC`, `anon` and
  unreviewed `authenticated` execution. Only the legacy dependencies required
  by `dad28dd` remain temporarily callable.

The migration does not inspect or rewrite existing customer, order, payment or
ledger rows. It cannot prove whether authority was abused before containment;
that is a separate incident review.

## Artifacts

- `supabase/migrations/20260816002442_current_production_authority_emergency_hardening.sql`
- `patches/20260816002442_current_production_authority_app_hotfix.patch`
- `scripts/preflight-production-authority-emergency-data.sql`
- `scripts/verify-production-authority-emergency-hardening.sql`
- `tests/production-authority-emergency-hardening.test.ts`

The app patch is deliberately based on `dad28dd`; do not deploy the whole
current development branch as the emergency app release. The emergency tables
use `emergency_*` names so the immediately following `02443` migration can
create its canonical relations without collision.

## Artifact integrity gate

The reviewed release set is pinned to these SHA-256 values after final
validation:

| Artifact | SHA-256 |
| --- | --- |
| `20260816002442_current_production_authority_emergency_hardening.sql` | `BBE8117FAC45CE48D009A56B1DE3AD018B7564CF28D358BA9FD38E6F4DA628EA` |
| `20260816002442_current_production_authority_app_hotfix.patch` | `8E599D4F02EE3240AB69545278536D913DE57E29ECA681B64D65B3331B4666B6` |
| `preflight-production-authority-emergency-data.sql` | `EC9FEAF5B340E6AFC20040063DE1C7E65DCEBDA86438862D0BAFE4D38E7A5FF2` |
| `verify-production-authority-emergency-hardening.sql` | `BFDD9AC926D9AF5A6341763AC44CD6F79DD0416434F09B7C4A800B957E3C71EF` |
| `production-authority-emergency-hardening.test.ts` | `3715A64F2DA20A38D96CCCD99FD58F0DED73E7C6F7C16A5E8199AC41C494EEA4` |

Before each isolated rehearsal and again immediately before Production, run:

```powershell
Get-FileHash -Algorithm SHA256 `
  supabase\migrations\20260816002442_current_production_authority_emergency_hardening.sql, `
  patches\20260816002442_current_production_authority_app_hotfix.patch, `
  scripts\preflight-production-authority-emergency-data.sql, `
  scripts\verify-production-authority-emergency-hardening.sql, `
  tests\production-authority-emergency-hardening.test.ts
```

Abort if any hash differs. Review, retest and deliberately repin the complete
set; never apply a modified migration or app patch under an earlier approval.

## Required release sequence

1. Confirm Production still runs `dad28dd` and the exact legacy RPC signatures.
   Confirm the local emergency version slot is unused and ordered after the
   latest remote entry:

   ```sql
   select
     pg_catalog.count(*) filter (
       where version::text = '20260816002442'
     ) = 0 as emergency_version_unused,
     coalesce(pg_catalog.max(version::text), '') < '20260816002442'
       as emergency_local_order_ready,
     pg_catalog.max(version::text) as latest_recorded_version
   from supabase_migrations.schema_migrations;
   ```

   Both booleans must be `true`. The catalog-only check on 2026-08-20 found
   Production history ending at `20260805204209`, so `02442` was unused. Recheck
   immediately before apply. Production history and local filenames are already
   non-isomorphic; never infer blanket `db push` safety and never repair or
   relabel migration history silently.

   Also require the current legacy contract phase:

   ```sql
   select pg_catalog.count(*) as modern_contract_count
   from (values
     ('public.staff_adjust_customer_credits(uuid,numeric,text,uuid)'),
     ('public.create_web_order_with_credit_deduction(text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)'),
     ('public.add_credits_from_stripe(uuid,text,text,text,text,numeric,numeric,text,uuid)'),
     ('public.admin_apply_payment_refund(uuid,uuid,text,text,uuid)')
   ) as expected(signature)
   where pg_catalog.to_regprocedure(expected.signature) is not null;
   ```

   Production requires `modern_contract_count=0`; the catalog check on
   2026-08-20 confirmed all four absent. Counts 1-3 are a schema-contract NO-GO
   for this combined artifact. Stop and prepare phase-specific containment;
   never force the conditional compatibility grants. Count 4 is accepted only
   for the explicit disposable post-`02453` rehearsal.

2. Run `preflight-production-authority-emergency-data.sql`. It is SELECT-only
   and returns aggregate counts, never identifiers, e-mail addresses, names,
   balances, limits or notes. Its result has separate gates:

   - `legacy_contract_phase_ready` must be true for this Production incident;
     `schema_contract_phase_coherent` rejects a partial 1-3 contract cutover;
   - `data_containment_apply_required` is always true: data anomalies never
     justify leaving signup, policies, app guards or RPC ACLs exposed;
   - `finance_functional_go_ready` controls financial functional canaries;
   - `authority_incident_close_ready` controls authority incident closure;
   - `normal_operation_ready` requires both groups and one exact owner.

   A partial schema-contract phase blocks this all-in-one SQL before any change.
   By contrast, any nonzero row-data anomaly starts incident quarantine/session
   review and blocks normal operation but does not block containment once the
   schema phase is coherent. Do not guess, silently normalize rows or execute
   vulnerable RPCs. The authorized aggregate
   Production preflight on 2026-08-20 returned one exact owner and zero
   authority, fractional and out-of-range anomalies.

3. In a clean release worktree anchored exactly at `dad28dd`, verify and apply
   only `20260816002442_current_production_authority_app_hotfix.patch`. Run the
   focused tests, lint, typecheck and build there. Keep this app artifact ready;
   do not mix current development-branch changes into it. The read-only source
   scan must still show zero direct `orders` insert/upsert calls; the 2026-08-20
   scan confirmed web new-request and desktop finalize both use the legacy RPC.

4. Rehearse the pinned migration on an isolated database matching the current
   Production schema, using synthetic users and no copied customer data. Run
   the verifier and disposable fixture cases. The migration is one transaction
   with `lock_timeout='5s'` and `statement_timeout='120s'`. A timeout is a full
   rollback and release abort. Identify the blocker; retry the same pinned file
   only in a reviewed low-traffic window. Never raise the bounds blindly.

5. Separately test the worst case in a disposable isolated database already at
   `02453`: execute the exact SQL file directly, not as a migration-history
   repair, run the verifier, and discard/reset that database. This proves the
   compatibility guards do not recreate absent legacy policies or reopen the
   post-`02452` RPC cutover. Do not add `02442` retroactively to that disposable
   database's migration history. This is a catalog/ACL/trigger compatibility
   rehearsal in the fully canonical 4-of-4 contract phase; do not run legacy
   order/staff functional fixtures against it.

6. On the current-Production-shape rehearsal, fixture smoke must prove: signup
   produces a zero-credit customer; benign customer settings save;
   protected/malformed authority writes fail; exact-priced and catalog-valid
   zero-total legacy orders succeed without debit/ledger; price and cross-user
   paths fail; a valid legacy staff adjustment writes one ledger row; and
   anon/auth calls to private finance RPCs fail. On the post-`02453` rehearsal,
   require the fully canonical 4-of-4 phase, every verifier row PASS, legacy
   entry points still closed and no recreated legacy policy; the canonical
   resolver intentionally owns its own positive-total contract there. Use no
   real customer, Stripe, bank-payment or refund data in either rehearsal.

7. Apply the exact `02442` SQL through the established selected-migration
   runner, one transaction only, in a reviewed low-traffic window. Record the
   exact artifact checksum, local name and server-generated remote version. Do
   not use a blanket `supabase db push`. On a lock/statement timeout, stop,
   confirm rollback and reschedule. Immediately run the catalog-only verifier;
   every row must be `PASS` before a functional canary.

8. Immediately deploy only the prepared `dad28dd` app patch. Smoke registration,
   settings, request creation, admin authorization denial/allow paths and File
   Expert authorization. Do not execute a real payment/refund as a smoke test.
   Rerun the aggregate preflight; normal operation requires
   `normal_operation_ready=true`.

9. Continue the canonical release only through the established selected-file
   procedure in `integrated-security-release-runbook.md`. Re-list remote history
   first; pin every exact checksum and apply only the reviewed order:
   `02443`-`02448`, `02450`, `02451`, matching application deploy, `02452`, and
   `02453`. Do not use `--include-all`, blanket `db push`, or migration-history
   repair. The incident gate must be clean before canonical migrations may
   replace transitional helpers. Before this later phase, confirm the business
   contract for a zero-total `Only Options` / `Special Request` selection: the
   current canonical app and resolver reject a zero total. If zero-only requests
   must remain supported, a separate reviewed additive compatibility migration
   and matching app change are required before canonical Production cutover.

Fresh/full local replay order is `02442` followed by canonical `02443`-`02453`,
so canonical definitions finish last. Conditional legacy grants remain
fail-closed in the explicit post-`02453` rehearsal as an additional safeguard.

## Recovery

- Any SQL error before commit rolls the entire migration back.
- Never recover by restoring metadata-derived signup authority, raw admin
  policies, broad profile authority writes, `PUBLIC`/anon RPC execution or the
  legacy app fallback.
- Database recovery is forward-only: correct the hardened function, trigger,
  policy or grant and rerun the verifier. Keep the affected mutation disabled
  until isolated verification passes.
- If the app patch has a critical regression, disable affected admin mutation
  routes while preparing a forward correction; do not redeploy the old
  `admin/null` or raw-role fallback.
- After verified `02452`, emergency relations/helpers are unused. Remove them
  only with a later reviewed migration after dependency verification.

## Remaining release risks

- Source-level checks are not a Production GO. Both isolated schema rehearsals,
  the exact app patch rehearsal and every release gate above remain mandatory.
- Containment prevents new escalation but does not prove historical balances,
  roles, payments or refunds were never altered.
- The old app still lacks stable client-provided idempotency for the legacy
  three-argument staff adjustment and request RPC. The canonical release is
  still required; this P0 is not the final financial architecture.
- The emergency `dad28dd` phase preserves catalog-valid zero-total orders for
  backward compatibility. The canonical branch currently rejects zero totals;
  owner confirmation or a separate additive compatibility fix is a hard gate
  for that later product-contract decision, not for applying this containment.
