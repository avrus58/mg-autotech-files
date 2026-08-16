# Integrated security release runbook (02443-02452)

This release is a coordinated database/application cutover. Migrations must be
applied in this exact order:

1. `20260816002443_financial_authority_hardening.sql`
2. `20260816002444_security_state_hardening.sql`
3. `20260816002445_widget_final_hardening.sql`
4. `20260816002446_stripe_recovery_hardening.sql`
5. `20260816002447_file_expert_atomic_completion.sql`
6. `20260816002448_widget_checkout_atomic_claim.sql`
7. `20260816002450_auth_customer_id_generator_hardening.sql`
8. Run the customer-ID verifier and an Auth signup smoke with a disposable
   staging user before any application cutover.
9. `20260816002451_credit_transaction_customer_access_hardening.sql`
10. Run the credit-ledger/customer Storage verifier before authenticated
    customer smoke checks.
11. Deploy the matching application and complete the cutover smoke checks.
12. `20260816002452_post_deploy_legacy_rpc_cutover.sql`

Version 02449 is intentionally unused. The reviewed cutover body was renamed
without content changes from its unapplied 02451 filename to 02452 so numeric
migration order places the customer ledger/Storage fix first. Do not apply or
record the retired 02449 cutover or the old 02451 cutover name.
Freeze and compare these SHA-256 values before each environment:

- 02450: `8131E02E582D5E16C18F6262515E402AEC2A4DBAFAA1E3029362E80EA8F8C792`
- 02451: `6DE1F340791C17D54621DFB9DDB3E6FBB39B0B5F322565B421B34D24EF15FFD9`
- 02452: `5084DFD95DBD878FD1037F7CE497C1362E900ED5D3F931A2626CD448719C84CC`

Do not use an unreviewed `supabase db push`. The connected Production migration
history contains applied versions that are not represented by identical local
filenames. Apply only these exact reviewed files, one transaction at a time,
and confirm the exact migration name plus the server-generated remote version
after each success. The local filename version defines reviewed artifact order;
do not repair or relabel a successful hosted migration to match it.

## Hard gates

- The isolated staging database must accept SQL connections. `ACTIVE_HEALTHY`
  project status alone is insufficient if database connections still time out.
- Every row from `scripts/preflight-integrated-security-release.sql` must have
  `ok = true`. The script returns aggregate checks only and no customer data.
- Capture and verify a restorable logical database backup immediately before
  Production. The current Free plan does not provide a verified automatic
  daily backup/PITR recovery point; do not treat an application rollback as a
  database backup.
- Freeze the exact commit/artifact and migration checksums. Preview must use
  only the isolated staging Supabase project and must not inherit Production
  credentials.
- Any failed migration, verifier row, Security Advisor error, or critical smoke
  regression stops the sequence.
- Production File Expert is gated on a separate healthy
  `file-expert-analyzer/` deployment, an exact Supabase signed-URL host allowlist,
  a shared server-only analyzer token, and
  `FILE_EXPERT_ANALYZER_DISTRIBUTED_ADMISSION_ENABLED=true` backed by the
  server-only Upstash/KV REST connection. Keep both
  `FILE_EXPERT_ANALYZER_GLOBAL_CONCURRENCY=1` and
  `FILE_EXPERT_ANALYZER_MAX_CONCURRENT=1`; a higher value requires a reviewed
  production-like load test and code change. Confirm `/health`, then run a synthetic
  signed ORI/MOD analysis; missing analyzer or lease configuration must return a
  retryable `503`, never invoke the in-process TypeScript fallback, and never
  replace an already completed result after a failed re-analysis. Confirm the
  lease Lua uses Redis `TIME` and stalled/oversized REST bodies fail closed.
  After the claim response is acquired, a timed-out protected-phase job must
  clear or restore its exact claim token before the 60-second route cap. A lost
  response to the initial claim write is recovered by the token-bound stale
  claim path (currently ten minutes); verify that recovery separately rather
  than claiming every pre-claim timeout is cleaned up inside the route window.
- Confirm the Vercel team plan permits commercial production use before either
  application is released. The currently observed Hobby plan is non-commercial
  only, so this release remains stopped until the owner approves and completes a
  Pro/Enterprise upgrade (or selects another approved worker host with an
  equivalent hard 35-second request cap). Do not use a
  root `api/` catch-all as a shortcut around that gate; Vercel's isolated
  multi-service routing is Private Beta and requires explicit account access.

## Staging rehearsal

1. For a fresh rehearsal, reconcile staging migration metadata without changing
   schema. Confirm none of versions 02443-02448 or 02450-02452 is partially
   recorded and 02449 is absent. For a resumed rehearsal, accept only the
   previously archived exact name, generated version, checksum, and post-state
   verifier mapping; do not rerun the fresh-start absence preflight. Continue
   from the first missing migration and never repair or relabel history.
2. On a fresh rehearsal, run the SELECT-only preflight and archive only its
   aggregate PASS/FAIL output.
3. Apply 02443 through 02448 in order, then apply 02450. Do not apply 02451 or
   02452 yet.
4. Run the phase-appropriate SELECT-only verifiers:
   `verify-auth-customer-id-hardening.sql`,
   `verify-financial-authority-hardening.sql`,
   `verify-widget-saas-commercial.sql`, and
   `verify-file-expert-atomic-completion.sql`. Every verifier row must pass.
5. Create one disposable staging Auth user and confirm exactly one profile with
   a non-null `MGA-` customer reference is created. Record only PASS/FAIL and
   aggregate counts. Retain this same exact fixture for the remaining smoke
   steps. Keep its exact identifiers only in operator-private ephemeral session
   state; never return its email, UUID, or customer reference in release evidence.
6. Apply 02451 and run
   `verify-credit-transaction-customer-access-hardening.sql`. Every row must
   pass. Confirm customer ledger SELECT exposes only the reviewed 11-column
   projection, mutations remain unavailable, the own-row policy is unique, and
   the protected Storage policy matrix contains only the 13 reviewed
   transitional policies.
7. Deploy the frozen application artifact. Using disposable staging fixtures,
   verify signed uploads for both protected buckets, web/desktop order retry
   idempotency, File Expert finalization, staff credit retry idempotency, Stripe
   credit recovery, refund recovery, and widget checkout/webhook claims.
8. Apply 02452. Then run
   `verify-post-deploy-legacy-rpc-cutover.sql` and
   `verify-security-state-hardening.sql`. Every verifier row must pass.
9. Run Supabase Security Advisor again and compare with the captured baseline.
   Resolve any new ERROR/WARN finding introduced by this release. Then delete
   the retained disposable user through the Auth Admin API so normal cascading
   cleanup runs, and confirm only aggregate zero-residue counts.

## Production sequence

1. Confirm the staging rehearsal passed for the same checksums and application
   artifact. Capture the logical backup and verify that the restore procedure
   and destination are known.
2. Run the aggregate preflight. Confirm the protected buckets are private,
   legacy canonical domains are valid/unique, the unbound checkout window is
   clear, and authority/financial invariants pass.
3. Apply 02443 through 02448 in exact order, then apply 02450 before any Auth
   signup smoke. These migrations retain narrow
   compatibility for the previous application: legacy financial calls remain
   role-bound, and direct uploads remain authenticated, owner-prefix-only,
   bucket-size/MIME-limited, and unable to UPDATE/DELETE existing objects.
   Direct legacy admin profile and delivery-ETA mutations intentionally remain
   fail-closed because broad `profiles`/`orders` grants are not restored. Keep
   those admin mutations in a bounded maintenance window until the matching
   application is deployed.
4. Run the pre-cutover verifiers listed in the staging sequence, including the
   customer-ID verifier. Apply 02451, then run the dedicated customer
   ledger/Storage verifier. Do not run the final Storage matrix verifier until
   02452 removes transitional INSERT access.
5. Deploy the frozen application artifact. Perform immediate read-only
   Production health/auth/download checks; rely on the completed staging
   rehearsal for mutating payment and customer-data paths.
6. Verify that the deployed application uses signed uploads, claim-bound
   financial RPCs, idempotent order wrappers, and atomic File Expert/widget
   claims. Hold 02452 until logs and smoke checks show no critical regression.
7. Apply 02452. Run both final verifiers and Security Advisor, then repeat the
   read-only Production smoke checks.

## Failure and recovery

- Before 02443: deploy nothing; no compensation is required.
- During a migration: each file is transactional. Stop after the failed file,
  preserve the error, and fix forward; never skip a version.
- After 02443-02451 but before the application deploy: keep the previous build
  live. The temporary role/prefix-bound compatibility layer remains available.
  Keep 02450 and 02451 in place: both are backward-compatible; reverting them
  would restore the broken customer-reference trigger chain and customer
  ledger/Storage authorization failure.
- After the application deploy but before 02452: roll back the application to
  the immediately preceding build if needed. No database down-migration is
  required because compatibility has not yet been removed.
- After 02452: first apply
  `scripts/recover-integrated-security-release-compatibility.sql` as one reviewed
  transaction, verify its exact grants/policies, and only then roll back the
  application. The compensation restores narrow upload/order/financial
  wrappers and prefix-bound INSERT; admin profile and delivery-ETA mutations
  remain unavailable in the preceding build. It does not restore broad
  `profiles`/`orders` grants, drop hardened objects, or overwrite customer rows.
- After recovery, restore the hardened application by a new forward migration.
  Do not edit or re-label an already-recorded 02450, 02451, or 02452 migration.
- For suspected data corruption, stop traffic-changing operations and restore
  through the verified logical backup process. The compatibility compensation
  is not a substitute for database restoration.

The recovery SQL deliberately leaves the restrictive authenticated/anonymous
UPDATE and DELETE policies in place. Hosted `storage.objects` table privileges
remain Supabase-managed throughout; no recovery or release step revokes them.
