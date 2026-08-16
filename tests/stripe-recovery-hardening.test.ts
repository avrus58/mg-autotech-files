import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function source(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

const migration = source(
  "supabase",
  "migrations",
  "20260816002446_stripe_recovery_hardening.sql",
);
const cutoverMigration = source(
  "supabase",
  "migrations",
  "20260816002452_post_deploy_legacy_rpc_cutover.sql",
);
const financialVerification = source(
  "scripts",
  "verify-financial-authority-hardening.sql",
);
const postCutoverVerification = source(
  "scripts",
  "verify-post-deploy-legacy-rpc-cutover.sql",
);
const stateVerification = source(
  "scripts",
  "verify-security-state-hardening.sql",
);

test("Stripe credit checkout is card-only and reconciliation uses a reclaimable claim", () => {
  const checkout = source("src", "app", "api", "stripe", "create-checkout-session", "route.ts");
  const credit = source("src", "lib", "stripeCreditPurchase.ts");

  assert.match(checkout, /payment_method_types:\s*\["card"\]/);
  assert.match(credit, /processingLeaseMs = 10 \* 60 \* 1000/);
  assert.match(credit, /processing_claim_token: claimToken/);
  assert.match(credit, /claimRetryFailureCodes\.includes\(record\.failure_code \?\? ""\)/);
  assert.match(credit, /\.lt\("processing_started_at", staleBefore\)/);
  assert.match(credit, /p_processing_claim_token: claimToken/);
  assert.match(credit, /processing_claim_token: null/);

  assert.match(migration, /add column if not exists processing_claim_token uuid/i);
  assert.match(migration, /p_processing_claim_token uuid/i);
  assert.match(migration, /processing_claim_token is distinct from p_processing_claim_token/i);
  assert.match(migration, /status = 'succeeded'[\s\S]*processing_claim_token = null[\s\S]*processing_started_at = null/i);
  assert.match(migration, /grant execute on function public\.add_credits_from_stripe\([\s\S]*?\) to service_role/i);
  assert.match(migration, /revoke all privileges on function public\.add_credits_from_stripe\([\s\S]*?numeric, numeric, text[\s\S]*?from public, anon, authenticated/i);
  assert.match(migration, /Temporary service-role compatibility entry point using locked authoritative payment data/i);
  assert.match(cutoverMigration, /legacy Stripe credit RPC is disabled; a processing claim is required/i);
  assert.match(cutoverMigration, /revoke all privileges on function public\.add_credits_from_stripe\([\s\S]*?numeric, numeric, text[\s\S]*?from public, anon, authenticated, service_role/i);
  assert.match(
    financialVerification,
    /add_credits_from_stripe\(uuid,text,text,text,text,numeric,numeric,text\)', false, false, true, true/i,
  );
  assert.match(
    financialVerification,
    /add_credits_from_stripe\(uuid,text,text,text,text,numeric,numeric,text,uuid\)', false, false, true, false/i,
  );
  assert.match(postCutoverVerification, /add_credits_from_stripe\(uuid,text,text,text,text,numeric,numeric,text\)', false, false, false/i);
  assert.match(postCutoverVerification, /add_credits_from_stripe\(uuid,text,text,text,text,numeric,numeric,text,uuid\)', false, false, true/i);
  assert.match(stateVerification, /Stripe payment and refund recovery state is durable/i);
});

test("legacy delayed Checkout events retain exact-record recovery", () => {
  const webhook = source("src", "app", "api", "stripe", "webhook", "route.ts");
  const credit = source("src", "lib", "stripeCreditPurchase.ts");

  assert.match(webhook, /checkout\.session\.async_payment_succeeded/);
  assert.match(webhook, /checkout\.session\.async_payment_failed/);
  assert.match(webhook, /updateExactAsyncCheckoutState/);
  assert.match(webhook, /record\.package_id !== \(metadata\.package_id \?\? null\)/);
  assert.match(webhook, /record\.provider_payment_id !== null && record\.provider_payment_id !== paymentIntent/);
  assert.match(credit, /"stripe_payment_pending"/);
  assert.match(credit, /metadata\?\.payment_record_id !== record\.id/);
  assert.match(credit, /referenceId: session\.id/);
});

test("refund recovery binds Stripe state and database reversal to one durable claim", () => {
  const route = source("src", "app", "api", "admin", "payments", "route.ts");
  const page = source("src", "app", "admin", "payments", "page.tsx");

  assert.match(route, /claim_payment_refund/);
  assert.match(route, /stripe\.refunds\.list\(\{[\s\S]*payment_intent: payment\.provider_payment_id/);
  assert.match(route, /stripe\.paymentIntents\.retrieve\([\s\S]*expand: \["latest_charge"\]/);
  assert.match(route, /paymentIntent\.amount_received !== expectedAmount/);
  assert.match(route, /latestCharge\.amount_captured !== expectedAmount/);
  assert.match(route, /matching\.length !== existing\.data\.length/);
  assert.match(route, /latestCharge\.amount_refunded !== succeededAmount/);
  assert.match(route, /amount: expectedAmount/);
  assert.match(route, /stripeRefundMatchesPayment/);
  assert.match(route, /idempotencyKey: `mga-refund-\$\{payment\.payment_id\}`/);
  assert.match(route, /provider_refund_id: providerRefundId/);
  assert.match(route, /failure_code: refundProviderSucceededFailureCode/);
  assert.match(route, /p_refund_claim_token: refundClaimToken/);
  assert.match(route, /refund_reconciliation_failed/);
  assert.match(page, /Retry refund recovery/);
  assert.match(page, /record\.provider === "stripe"/);
  assert.match(page, /Bank refunds are not automated/);
  assert.doesNotMatch(route, /bank-refund-/);

  assert.match(migration, /create or replace function public\.claim_payment_refund/i);
  assert.match(migration, /interval '10 minutes'/i);
  assert.match(migration, /provider_refund_id is distinct from v_provider_refund_id/i);
  assert.match(migration, /failure_code <> 'refund_provider_succeeded'/i);
  assert.match(migration, /refund_claim_token is distinct from p_refund_claim_token/i);
  assert.match(migration, /v_purchase_ledger_count <> 1/i);
  assert.match(migration, /original payment ledger requires reconciliation before a provider refund/i);
  assert.match(migration, /refund ledger already exists and requires reconciliation before a provider refund/i);
  assert.match(migration, /Only Stripe credit purchases support automatic refunds/i);
  assert.doesNotMatch(migration, /v_payment\.provider not in \('stripe', 'bank'\)/i);
  assert.doesNotMatch(migration, /v_payment\.payment_type not in \('credit_purchase', 'manual_bank'\)/i);
  assert.match(migration, /ledger\.metadata ->> 'payment_record_id' = v_payment\.id::text/i);
  assert.match(migration, /grant execute on function public\.claim_payment_refund\([\s\S]*?\) to service_role/i);
  assert.match(migration, /grant execute on function public\.admin_apply_payment_refund\([\s\S]*?\) to service_role/i);
  assert.match(migration, /Temporary service-role compatibility entry point with explicit staff actor verification/i);
  assert.match(cutoverMigration, /legacy refund RPC is disabled; a durable refund claim is required/i);
  assert.match(cutoverMigration, /revoke all privileges on function public\.admin_apply_payment_refund\([\s\S]*?uuid, uuid, text, text[\s\S]*?from public, anon, authenticated, service_role/i);
  assert.match(
    financialVerification,
    /admin_apply_payment_refund\(uuid,uuid,text,text\)', false, false, true, true/i,
  );
  assert.match(
    financialVerification,
    /admin_apply_payment_refund\(uuid,uuid,text,text,uuid\)', false, false, true, false/i,
  );
  assert.match(
    financialVerification,
    /claim_payment_refund\(uuid,uuid,uuid\)', false, false, true, false/i,
  );
  assert.match(postCutoverVerification, /admin_apply_payment_refund\(uuid,uuid,text,text\)', false, false, false/i);
  assert.match(postCutoverVerification, /admin_apply_payment_refund\(uuid,uuid,text,text,uuid\)', false, false, true/i);
});
