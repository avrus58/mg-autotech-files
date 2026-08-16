# Integrated security release runbook (02443-02449)

This release is a coordinated database/application cutover. Migrations must be
applied in this exact order:

1. `20260816002443_financial_authority_hardening.sql`
2. `20260816002444_security_state_hardening.sql`
3. `20260816002445_widget_final_hardening.sql`
4. `20260816002446_stripe_recovery_hardening.sql`
5. `20260816002447_file_expert_atomic_completion.sql`
6. `20260816002448_widget_checkout_atomic_claim.sql`
7. Deploy the matching application and complete the cutover smoke checks.
8. `20260816002449_post_deploy_legacy_rpc_cutover.sql`

Do not use an unreviewed `supabase db push`. The connected Production migration
history contains applied versions that are not represented by identical local
filenames. Apply only these exact reviewed files, one transaction at a time,
and confirm the recorded version after each success.

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

## Staging rehearsal

1. Reconcile staging migration metadata without changing schema. Confirm none
   of versions 02443-02449 is partially recorded.
2. Run the SELECT-only preflight and archive only its aggregate PASS/FAIL output.
3. Apply 02443 through 02448 in order. Do not apply 02449 yet.
4. Run the phase-appropriate SELECT-only verifiers:
   `verify-financial-authority-hardening.sql`,
   `verify-widget-saas-commercial.sql`, and
   `verify-file-expert-atomic-completion.sql`.
5. Deploy the frozen application artifact. Using disposable staging fixtures,
   verify signed uploads for both protected buckets, web/desktop order retry
   idempotency, File Expert finalization, staff credit retry idempotency, Stripe
   credit recovery, refund recovery, and widget checkout/webhook claims.
6. Apply 02449. Then run
   `verify-post-deploy-legacy-rpc-cutover.sql` and
   `verify-security-state-hardening.sql`. Every verifier row must pass.
7. Run Supabase Security Advisor again and compare with the captured baseline.
   Resolve any new ERROR/WARN finding introduced by this release.

## Production sequence

1. Confirm the staging rehearsal passed for the same checksums and application
   artifact. Capture the logical backup and verify that the restore procedure
   and destination are known.
2. Run the aggregate preflight. Confirm the protected buckets are private,
   legacy canonical domains are valid/unique, the unbound checkout window is
   clear, and authority/financial invariants pass.
3. Apply 02443 through 02448 in exact order. These migrations retain narrow
   compatibility for the previous application: legacy financial calls remain
   role-bound, and direct uploads remain authenticated, owner-prefix-only,
   bucket-size/MIME-limited, and unable to UPDATE/DELETE existing objects.
   Direct legacy admin profile and delivery-ETA mutations intentionally remain
   fail-closed because broad `profiles`/`orders` grants are not restored. Keep
   those admin mutations in a bounded maintenance window until the matching
   application is deployed.
4. Run the pre-cutover verifiers listed in the staging sequence. Do not run the
   final Storage matrix verifier until 02449 removes transitional INSERT access.
5. Deploy the frozen application artifact. Perform immediate read-only
   Production health/auth/download checks; rely on the completed staging
   rehearsal for mutating payment and customer-data paths.
6. Verify that the deployed application uses signed uploads, claim-bound
   financial RPCs, idempotent order wrappers, and atomic File Expert/widget
   claims. Hold 02449 until logs and smoke checks show no critical regression.
7. Apply 02449. Run both final verifiers and Security Advisor, then repeat the
   read-only Production smoke checks.

## Failure and recovery

- Before 02443: deploy nothing; no compensation is required.
- During a migration: each file is transactional. Stop after the failed file,
  preserve the error, and fix forward; never skip a version.
- After 02443-02448 but before the application deploy: keep the previous build
  live. The temporary role/prefix-bound compatibility layer remains available.
- After the application deploy but before 02449: roll back the application to
  the immediately preceding build if needed. No database down-migration is
  required because compatibility has not yet been removed.
- After 02449: first apply
  `scripts/recover-integrated-security-release-compatibility.sql` as one reviewed
  transaction, verify its exact grants/policies, and only then roll back the
  application. The compensation restores narrow upload/order/financial
  wrappers and prefix-bound INSERT; admin profile and delivery-ETA mutations
  remain unavailable in the preceding build. It does not restore broad
  `profiles`/`orders` grants, drop hardened objects, or overwrite customer rows.
- After recovery, restore the hardened application by a new forward migration.
  Do not edit or re-label an already-recorded 02449 migration.
- For suspected data corruption, stop traffic-changing operations and restore
  through the verified logical backup process. The compatibility compensation
  is not a substitute for database restoration.

The recovery SQL deliberately leaves the restrictive authenticated/anonymous
UPDATE and DELETE policies in place. Hosted `storage.objects` table privileges
remain Supabase-managed throughout; no recovery or release step revokes them.
