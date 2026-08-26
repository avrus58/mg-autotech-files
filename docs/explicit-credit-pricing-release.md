# Explicit credit pricing release gate

This release treats every configured amount as the final payable EUR value.
There is no VAT, tax, country, gross/net, or tax-inclusive calculation in this
pricing model.

## Why the cutover is gated

The legacy application derives every package from a unit price plus shared
adjustments. Version 2 stores five independent package totals and one separate
custom-credit unit price. An arbitrary v2 package list cannot be represented by
the legacy model, so an application build from before v2 is not a valid rollback
target after the first v2 price save.

The migration therefore keeps `explicit_pricing_writes_enabled = false` while
it materializes the existing prices. Both pricing write RPCs fail closed while
that flag is false. Existing quotes and purchases remain available at the
materialized prices.

## Required release sequence

1. Back up the database using the normal Production recovery process and keep
   the current Production deployment identifier. Freeze legacy admin pricing
   edits until activation completes; customer quote and purchase reads may
   continue normally.
2. Apply the additive migration in isolated staging. Run both
   `scripts/verify-commercial-pricing-authority.sql` and
   `scripts/verify-explicit-credit-pricing.sql`; every safety result must be
   true. Before activation, `writes_activated = false` is expected.
3. Verify legacy-to-v2 continuity for the global row and every customer policy.
   The migration uses binary64 arithmetic plus integer ten-thousandths to match
   the legacy JavaScript calculation. Compare all five package totals and the
   custom-credit unit price by running
   `node scripts/verify-explicit-pricing-continuity.mjs`; any mismatch blocks
   the release. The verifier is read-only and reports counts, never customer
   identifiers or policy contents.
4. Deploy the v2-aware application to staging and test public quotes,
   authenticated quotes, package checkout, custom checkout, global pricing,
   customer inheritance, customer override, stale-quote rejection, and
   concurrent-save conflict handling.
5. Repeat the reviewed additive migration in Production. Before deploying or
   activating writes, run `scripts/verify-commercial-pricing-authority.sql`,
   `scripts/verify-explicit-credit-pricing.sql`, and
   `node scripts/verify-explicit-pricing-continuity.mjs` against Production.
   Every check must pass and every migrated global/customer price must match.
   Then deploy and smoke-test the v2-aware application while pricing writes
   remain locked.
6. Retain a verified v2-aware Production deployment as the pricing rollback
   bridge. Record its immutable deployment/release identifier by calling the
   service-role-only `activate_explicit_pricing_v2` RPC with the current global
   `updated_at` revision. The identifier must match
   `^[A-Za-z0-9._:-]{8,180}$`.
7. Re-run the explicit verifier. All safety fields, including
   `writes_activated`, must now be true. Reload the admin screens, save one
   controlled no-price-change fixture in staging, then perform the approved
   Production smoke checks without creating a real payment.

## Recovery boundary

- Before activation, the pre-v2 application and unchanged legacy columns are a
  valid rollback path because v2 writes are impossible.
- After activation, roll back only to the recorded v2-aware bridge deployment.
  Never point Production at a pre-v2 build.
- A pricing, quote, or checkout discrepancy is critical: restore the recorded
  v2 bridge, stop making admin price changes, keep payment creation fail-closed,
  and investigate before accepting another pricing change. Activation is
  intentionally one-way; do not disable its database guard or use a pre-v2 app.
- Do not delete or rewrite legacy columns during this release. Their removal is
  a separate future migration after the v2 rollback window ends.
