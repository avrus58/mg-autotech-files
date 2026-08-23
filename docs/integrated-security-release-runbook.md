# Integrated security and customer-device release runbook

This is the canonical combined order when the 02443-02454 hardening set and
customer trusted-device protection ship in the same release window. Use the
customer-device rollout document for its detailed smoke cases, but do not run
it as an independent or conflicting sequence. The two application artifacts
below are intentional: the cutover-compatible predecessor must remove legacy
dependencies before the shadow-first device schema can safely precede the
device-aware application. Apply these steps in this exact order:

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
11. `20260816002454_zero_credit_request_compatibility.sql`
12. Run `verify-zero-credit-request-compatibility.sql` and keep zero-credit
    request creation in the maintenance window until every row passes.
13. Deploy the frozen cutover-compatible predecessor application and complete
    its cutover smoke checks.
14. `20260816002452_post_deploy_legacy_rpc_cutover.sql`
15. `20260816002453_email_delivery_schema_parity.sql`
16. Run the post-cutover, email parity, zero-credit and final security
    verifiers. Every row must pass.
17. `20260823000000_customer_device_verification.sql`
18. `20260823000001_customer_device_verification_catalog_reconciliation.sql`
19. Confirm device mode is still `shadow`, then run
    `verify-customer-device-verification.sql` and rerun both
    `verify-post-deploy-legacy-rpc-cutover.sql` and
    `verify-zero-credit-request-compatibility.sql`. The latter two must now
    resolve the renamed `create_order_with_credit_deduction_without_assurance`
    core and verify the old signature as its private assurance wrapper.
20. Configure the server-only device HMAC secret and deploy the frozen
    device-aware application. Complete shadow-mode smoke checks before any
    enforcement activation.

Version 02449 is intentionally unused. The reviewed cutover body was renamed
without content changes from its unapplied 02451 filename to 02452 so numeric
migration order places the customer ledger/Storage fix first. Do not apply or
record the retired 02449 cutover or the old 02451 cutover name.
The selected-file release order deliberately applies additive 02454 after 02451
but before the matching application. Versions 02452 and 02453 were already
established as post-app cutover/parity artifacts before this compatibility gap
was found, so 02454's numeric suffix does not define its live cutover position.
On a fresh empty replay where no application is serving traffic, lexical replay
through 02454 is acceptable; run the 02454 verifier at the end. In staging and
Production, use only the exact selected-file order above so zero-credit requests
never pass an app gate while the database still rejects them.
Freeze and compare these SHA-256 values before each environment:

- 02443: `61FC3D7B0B0D515ABE69DDA57BA4C0A3B07C1E12E24109A1E2F06DCC6410A5EA`
- 02444: `62E7B08FDE1DFD3566AB997DC3E9896350DB753E2BC2FCFE9CA4E74D51C15FB3`
- 02445: `59CAF2338C85F3114D8D80E46792AC227EEA00B0ACEE870A6B05F1EA45B76728`
- 02446: `CBE9E0938CC1A72B007F175D484DF00F7D6A064A0D7C0A6E81F78118BD10EC5D`
- 02447: `4B202715C9E96D475FD9578E8A18B6D3E4A3047DD84575B1D1D0F2AAD3D0CE4F`
- 02448: `B581019DF5C08AC0529E260FD7DF41ED86B322801DEC57EFB33E5451727111B4`
- 02450: `8131E02E582D5E16C18F6262515E402AEC2A4DBAFAA1E3029362E80EA8F8C792`
- 02451: `6DE1F340791C17D54621DFB9DDB3E6FBB39B0B5F322565B421B34D24EF15FFD9`
- 02452: `5084DFD95DBD878FD1037F7CE497C1362E900ED5D3F931A2626CD448719C84CC`
- 02453: `E88D700B4ACB0D051C6D563C3D52F1958074983D9127D413BB28901374DE4353`
- 02454: `958ED96EF6607397EA8839432D53FE64776FAA853FDB5994E02DD67B5046A6F0`
- device migration: `8F09E9B7E7A90FDA8696C0B7A6CBCC6454D08E4600AA835C1420CFD8C8E52262`
- device catalog reconciliation: `958B34C5E19CFD7FA2C7124100C2A29AEC465539228660B2AC82A462924A9668`

Migration 02453 closes a real environment-parity gap: the historical email
delivery reliability schema exists in Production but was never captured in the
versioned migration chain used by isolated staging. It adds only the canonical
delivery columns, constraints, indexes, and two operational tables. It then
reasserts the 02443 service-API-only boundary: no direct `PUBLIC`, `anon`, or
`authenticated` table/column authority and no Data API policies remain on
`email_delivery_events` or `email_suppressions`. Do not substitute the older
standalone setup script, because that script predates the final API-only access
model. The legacy `file_fingerprints` relation is optional and must not be
created; the canonical runtime relation is `file_expert_binary_fingerprints`.

Migration 02454 restores the existing catalog contract for `Only Options` and
the zero-credit `Special Request / Other` extra. An exact server-resolved total
of zero creates the order without updating `profiles.credit_balance` and
without a `credit_transactions` usage row. Positive totals retain the locked
profile debit plus marker-bound ledger path; negative or client/catalog-
mismatched totals remain rejected. It redefines only the private resolver,
order core and ledger trigger. Resolver/trigger remain private; the core keeps
the current release phase ACL so 02444 compatibility stays callable before the
app cutover and 02452 revocation stays closed after it.

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
- Freeze both exact application artifacts (the cutover-compatible predecessor
  and its device-aware successor) and every migration checksum. Preview must
  use only the isolated staging Supabase project, with an independent device
  HMAC secret, and must not inherit Production credentials.
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
   schema. Confirm none of versions 02443-02448 or 02450-02454 is partially
   recorded and 02449 is absent. For a resumed rehearsal, accept only the
   previously archived exact name, generated version, checksum, and post-state
   verifier mapping; do not rerun the fresh-start absence preflight. Continue
   from the first missing migration and never repair or relabel history.
2. On a fresh rehearsal, run the SELECT-only preflight and archive only its
   aggregate PASS/FAIL output.
3. Apply 02443 through 02448 in order, then apply 02450. Do not apply 02451,
   02452, 02453, or 02454 yet.
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
   transitional policies. Then apply 02454 and run
   `verify-zero-credit-request-compatibility.sql`; every row must pass before
   application deployment.
7. Deploy the frozen cutover-compatible predecessor artifact. Using disposable
   staging fixtures,
   verify signed uploads for both protected buckets, web/desktop order retry
   idempotency, File Expert finalization, staff credit retry idempotency, Stripe
   credit recovery, refund recovery, and widget checkout/webhook claims. With
   the retained customer fixture, create one exact `Only Options + Special
   Request / Other` zero-credit order through both web and desktop contracts;
   verify the balance is unchanged and no order-usage ledger row exists. Also
   verify one positive request still creates exactly one debit/ledger row and a
   negative or client/catalog-mismatched amount fails closed. Record only
   synthetic aggregate PASS/FAIL evidence and clean up the fixture rows.
8. Apply 02452, then apply 02453. Run
   `verify-post-deploy-legacy-rpc-cutover.sql`,
   `verify-email-delivery-schema-parity.sql`, and
   `verify-zero-credit-request-compatibility.sql`, plus
   `verify-security-state-hardening.sql`. Every verifier row must pass. The
   parity verifier reads schema/authority metadata only and must show both
   email operational tables as RLS-enabled and service-API-only.
9. Apply `20260823000000_customer_device_verification.sql`, then
   `20260823000001_customer_device_verification_catalog_reconciliation.sql`.
   Confirm mode remains `shadow`. Run the customer-device verifier and rerun
   both the post-cutover and zero-credit verifiers; all rows must pass against
   the renamed private core plus legacy-signature assurance wrapper.
10. Configure an isolated staging HMAC secret and real staging e-mail delivery,
    then deploy the frozen device-aware successor. Prove the shadow-mode login,
    OAuth, registration, password-change forced-code and explicit-revocation
    cases from `customer-device-verification-rollout.md`. Only after those pass,
    activate with `activate_customer_device_assurance(0)` and run its full
    new-device, trusted-device, RLS, Storage, API and order-RPC suite. Rehearse
    disable/reactivate before Production. Unsupported desktop access must stay
    disabled or minimum-version blocked.
11. Run Supabase Security Advisor again and compare with the captured baseline.
   Resolve any new ERROR/WARN finding introduced by this release. Then delete
   the retained disposable user through the Auth Admin API so normal cascading
   cleanup runs, and confirm only aggregate zero-residue counts.

## Production sequence

1. Confirm the staging rehearsal passed for the same checksums and both frozen
   application artifacts. Capture the logical backup and verify that the
   restore procedure and destination are known.
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
   02452 removes transitional INSERT access. Apply 02454 next and require every
   focused zero-credit verifier row to pass before deploying the application.
5. Deploy the frozen cutover-compatible predecessor artifact. Perform immediate
   read-only Production health/auth/download checks; rely on the completed
   staging rehearsal for mutating payment and customer-data paths.
6. Verify that the deployed application uses signed uploads, claim-bound
   financial RPCs, idempotent order wrappers, and atomic File Expert/widget
   claims. Hold 02452 until logs and smoke checks show no critical regression.
7. Apply 02452, then 02453. Run all four final verifiers and Security Advisor,
   then repeat the read-only Production smoke checks. Production already has
   the historical email tables; 02453 must preserve their schema while removing
   the retired direct staff Data API policies and grants.
8. Apply the customer-device migration and its catalog reconciliation in that
   order. Confirm `shadow`; run the customer-device verifier and rerun the
   post-cutover and zero-credit verifiers. Do not deploy the device-aware
   successor until all rows pass and the server-only HMAC secret is configured.
9. Deploy the frozen device-aware successor and complete non-mutating
   Production shadow-mode smoke checks. Activate only after the detailed device
   rollout gates are satisfied, including Secure Password Change/Auth-layer
   controls, real e-mail capacity and desktop disable/minimum-version safety.
   Immediately rerun the customer-device, post-cutover and zero-credit
   verifiers after activation and monitor 428/401/429/5xx plus delivery failure
   aggregates without recording customer identifiers, codes or raw tokens.

## Failure and recovery

- Before 02443: deploy nothing; no compensation is required.
- During a migration: each file is transactional. Stop after the failed file,
  preserve the error, and fix forward; never skip a version.
- After 02443-02451 and 02454 but before the application deploy: keep the
  previous build live. The temporary role/prefix-bound compatibility layer
  remains available. Keep 02450, 02451 and 02454 in place: all are
  backward-compatible; reverting 02450 or 02451
  would restore the broken customer-reference trigger chain and customer
  ledger/Storage authorization failure.
- After the application deploy but before 02452: roll back the application to
  the immediately preceding build if needed. No database down-migration is
  required because compatibility has not yet been removed.
- After 02452 or 02453: first apply
  `scripts/recover-integrated-security-release-compatibility.sql` as one reviewed
  transaction, verify its exact grants/policies, and only then roll back the
  application. The compensation restores narrow upload/order/financial
  wrappers and prefix-bound INSERT; admin profile and delivery-ETA mutations
  remain unavailable in the preceding build. It does not restore broad
  `profiles`/`orders` grants, drop hardened objects, or overwrite customer rows.
- Migrations 02453 and 02454 are additive and remain compatible with the server
  API during application recovery. Do not recreate the direct staff table
  access retired by 02453 or the positive-only order rejection replaced by
  02454.
- After both customer-device migrations but before the device-aware deploy,
  keep mode `shadow` and continue with the verified cutover-compatible
  predecessor. The verifier must still resolve the renamed private core and
  assurance wrapper correctly in this phase.
- After the device-aware deploy while still in `shadow`, roll the application
  back to the frozen cutover-compatible predecessor if a critical regression
  appears; keep the additive device schema in place. After enforcement is
  active, first call `disable_customer_device_assurance()`, confirm `shadow`,
  and only then roll back. Explicitly revoked sessions and forced password-code
  sessions remain blocked in `shadow` and must not be resurrected.
- After recovery, restore the hardened application by a new forward migration.
  Do not edit or re-label an already-recorded 02450, 02451, 02452, 02453, or 02454
  migration.
- For suspected data corruption, stop traffic-changing operations and restore
  through the verified logical backup process. The compatibility compensation
  is not a substitute for database restoration.

The recovery SQL deliberately leaves the restrictive authenticated/anonymous
UPDATE and DELETE policies in place. Hosted `storage.objects` table privileges
remain Supabase-managed throughout; no recovery or release step revokes them.
