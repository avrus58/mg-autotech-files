import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  isStripeCreditPurchaseMetadata,
  normalizeStripeCheckoutSessionId,
  normalizeStripeCorrelationId,
  normalizeStripePaymentIntentId,
  readStripeWebhookBody,
  StripeWebhookBodyError,
  stripeCreditPurchaseOwnedBy,
} from "../src/lib/stripePaymentSecurity";
import {
  canResumeWidgetCheckoutAttempt,
  evaluateWidgetCheckoutReuse,
  widgetCheckoutActorMatchesEmail,
  type ExistingWidgetCheckoutClient,
} from "../src/lib/widget/checkoutSecurity";
import { createWidgetSession, verifyWidgetSession } from "../src/lib/widget/session";
import { buildRateLimitSubjectFingerprint } from "../src/lib/abuseProtection";

const userId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "22222222-2222-4222-8222-222222222222";
const widgetPublicKey = `pk_mga_widget_${"A".repeat(24)}`;

function source(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

function existingWidget(
  overrides: Partial<ExistingWidgetCheckoutClient> = {},
): ExistingWidgetCheckoutClient {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    user_id: userId,
    email: "owner@example.com",
    status: "active",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    ...overrides,
  };
}

test("Stripe credit metadata, ownership and identifiers are exact allowlists", () => {
  const metadata = {
    product: "credit_purchase",
    user_id: userId,
    credits: "50",
  };
  assert.equal(isStripeCreditPurchaseMetadata(metadata), true);
  assert.equal(stripeCreditPurchaseOwnedBy(metadata, userId), true);
  assert.equal(stripeCreditPurchaseOwnedBy(metadata, otherUserId), false);
  assert.equal(isStripeCreditPurchaseMetadata({ ...metadata, product: "vehicle_widget" }), false);
  assert.equal(isStripeCreditPurchaseMetadata({ ...metadata, credits: "1.5" }), false);
  assert.equal(isStripeCreditPurchaseMetadata({ ...metadata, credits: "100001" }), false);

  const sessionId = `cs_test_${"A1".repeat(16)}`;
  assert.equal(normalizeStripeCheckoutSessionId(` ${sessionId} `), sessionId);
  for (const invalid of ["cs_test_short", `cs_test_${"a".repeat(193)}`, "pi_1234567890", null]) {
    assert.equal(normalizeStripeCheckoutSessionId(invalid), null);
  }
  assert.equal(
    normalizeStripeCorrelationId("AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA"),
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  );
  assert.equal(normalizeStripeCorrelationId("not-a-correlation"), null);
  assert.equal(normalizeStripePaymentIntentId(`pi_${"A1".repeat(10)}`), `pi_${"A1".repeat(10)}`);
  assert.equal(normalizeStripePaymentIntentId("cs_test_not_a_payment_intent"), null);
});

test("Stripe webhook bodies are capped by declared and streamed bytes", async () => {
  const valid = new Request("http://localhost/webhook", {
    method: "POST",
    body: '{"id":"evt_safe"}',
  });
  assert.equal(await readStripeWebhookBody(valid, 64), '{"id":"evt_safe"}');

  const declaredTooLarge = new Request("http://localhost/webhook", {
    method: "POST",
    headers: { "content-length": "65" },
    body: "x",
  });
  await assert.rejects(
    readStripeWebhookBody(declaredTooLarge, 64),
    (error) => error instanceof StripeWebhookBodyError && error.status === 413,
  );

  const chunkedTooLarge = new Request("http://localhost/webhook", {
    method: "POST",
    body: "x".repeat(65),
  });
  await assert.rejects(
    readStripeWebhookBody(chunkedTooLarge, 64),
    (error) => error instanceof StripeWebhookBodyError && error.status === 413,
  );

  const invalidLength = new Request("http://localhost/webhook", {
    method: "POST",
    headers: { "content-length": "not-a-number" },
    body: "{}",
  });
  await assert.rejects(
    readStripeWebhookBody(invalidLength, 64),
    (error) => error instanceof StripeWebhookBodyError && error.status === 400,
  );
});

test("widget checkout reuse fails closed for pending, billing-linked and unowned records", () => {
  const actor = { userId, email: "OWNER@example.com" };
  assert.equal(widgetCheckoutActorMatchesEmail(actor, "owner@example.com"), true);
  assert.equal(widgetCheckoutActorMatchesEmail(actor, "attacker@example.com"), false);
  assert.deepEqual(
    evaluateWidgetCheckoutReuse(existingWidget({ status: "pending" }), actor, "owner@example.com"),
    { allowed: false, reason: "billing_state_exists" },
  );
  assert.deepEqual(
    evaluateWidgetCheckoutReuse(existingWidget({ stripe_customer_id: "cus_existing" }), actor, "owner@example.com"),
    { allowed: false, reason: "billing_state_exists" },
  );
  assert.deepEqual(
    evaluateWidgetCheckoutReuse(existingWidget({ status: "cancelled" }), null, "owner@example.com"),
    { allowed: false, reason: "authentication_required" },
  );
  assert.deepEqual(
    evaluateWidgetCheckoutReuse(existingWidget({ status: "cancelled" }), { userId: otherUserId, email: "owner@example.com" }, "owner@example.com"),
    { allowed: false, reason: "ownership_mismatch" },
  );
  assert.deepEqual(
    evaluateWidgetCheckoutReuse(existingWidget({ status: "cancelled" }), actor, "owner@example.com"),
    { allowed: true },
  );
  assert.deepEqual(
    evaluateWidgetCheckoutReuse(existingWidget({
      status: "pending",
      checkout_pending_until: new Date(Date.now() - 60_000).toISOString(),
    }), actor, "owner@example.com"),
    { allowed: true },
  );
  const resumable = existingWidget({
    status: "pending",
    stripe_checkout_session_id: null,
    checkout_claim_token: "44444444-4444-4444-8444-444444444444",
    checkout_claimed_at: new Date(Date.now() - 1_000).toISOString(),
    checkout_pending_until: new Date(Date.now() + 60_000).toISOString(),
  });
  assert.equal(canResumeWidgetCheckoutAttempt(resumable, actor, "owner@example.com"), true);
  assert.equal(
    canResumeWidgetCheckoutAttempt(
      { ...resumable, stripe_checkout_session_id: `cs_test_${"A".repeat(24)}` },
      actor,
      "owner@example.com",
    ),
    false,
  );
  assert.equal(
    canResumeWidgetCheckoutAttempt({ ...resumable, checkout_claim_token: null }, actor, "owner@example.com"),
    false,
  );
  assert.equal(
    canResumeWidgetCheckoutAttempt(
      { ...resumable, checkout_pending_until: new Date(Date.now() - 1_000).toISOString() },
      actor,
      "owner@example.com",
    ),
    false,
  );
  assert.equal(
    canResumeWidgetCheckoutAttempt(resumable, { userId: otherUserId, email: "owner@example.com" }, "owner@example.com"),
    false,
  );
});

test("widget sessions reject oversized, malformed and expired bearer tokens", () => {
  const previousSecret = process.env.WIDGET_SESSION_SECRET;
  process.env.WIDGET_SESSION_SECRET = "s".repeat(32);
  try {
    const token = createWidgetSession({
      clientId: "33333333-3333-4333-8333-333333333333",
      publicKey: widgetPublicKey,
      domain: "example.com",
      origin: "https://example.com",
      language: "en",
    });
    assert.equal(verifyWidgetSession(token)?.domain, "example.com");
    assert.equal(verifyWidgetSession(`${token}.extra`), null);
    assert.equal(verifyWidgetSession("x".repeat(2001)), null);
    const expired = createWidgetSession({
      clientId: "33333333-3333-4333-8333-333333333333",
      publicKey: widgetPublicKey,
      domain: "example.com",
      origin: "https://example.com",
      language: "en",
    }, -1);
    assert.equal(verifyWidgetSession(expired), null);
  } finally {
    if (previousSecret === undefined) delete process.env.WIDGET_SESSION_SECRET;
    else process.env.WIDGET_SESSION_SECRET = previousSecret;
  }
});

test("session abuse fingerprints can remain stable across rotating IP addresses", () => {
  const request = (ip: string) => ({ headers: new Headers({ "x-vercel-forwarded-for": ip }) }) as Request;
  const shared = {
    scope: "widget-public-session",
    subjectSalt: "s".repeat(32),
    suffix: "hashed-session-subject",
    includeClientIp: false,
    networkEnvironment: { VERCEL: "1" } as const,
  };
  assert.equal(
    buildRateLimitSubjectFingerprint({ ...shared, request: request("192.0.2.10") }),
    buildRateLimitSubjectFingerprint({ ...shared, request: request("198.51.100.20") }),
  );
  assert.notEqual(
    buildRateLimitSubjectFingerprint({ ...shared, includeClientIp: true, request: request("192.0.2.10") }),
    buildRateLimitSubjectFingerprint({ ...shared, includeClientIp: true, request: request("198.51.100.20") }),
  );
});

test("Stripe routes enforce auth, product separation, exact correlation and replay guards", () => {
  const confirm = source("src", "app", "api", "stripe", "confirm-session", "route.ts");
  const checkout = source("src", "app", "api", "stripe", "create-checkout-session", "route.ts");
  const webhook = source("src", "app", "api", "stripe", "webhook", "route.ts");
  const credit = source("src", "lib", "stripeCreditPurchase.ts");
  const success = source("src", "app", "payment", "success", "page.tsx");

  assert.match(confirm, /requireApiUser\(request\)/);
  assert.match(confirm, /normalizeStripeCheckoutSessionId/);
  assert.match(confirm, /stripeCreditPurchaseOwnedBy\(session\.metadata, auth\.user\.id\)/);
  assert.match(confirm, /checkAdaptiveRateLimit/);
  assert.match(confirm, /scope: "stripe-confirm-account"[\s\S]*?includeClientIp: false/);
  assert.match(confirm, /scope: "stripe-confirm-session"/);
  assert.doesNotMatch(confirm, /error instanceof Error \? error\.message/);
  assert.match(checkout, /product: STRIPE_CREDIT_PURCHASE_PRODUCT/);
  assert.match(checkout, /checkout_correlation_id: checkoutCorrelationId/g);
  assert.match(checkout, /providerPaymentId: stripeObjectId\(session\.payment_intent\)/);
  assert.match(checkout, /includeClientIp: false/);
  assert.match(webhook, /isRecognizedStripeCreditPurchaseMetadata/);
  assert.match(webhook, /readStripeWebhookBody\(request\)/);
  assert.doesNotMatch(webhook, /await request\.text\(\)/);
  assert.match(webhook, /findExactPaymentFailureRecord/);
  assert.match(webhook, /contains\("metadata", \{ checkout_correlation_id: correlationId \}\)/);
  assert.match(webhook, /paymentFailureRecordMatches/);
  assert.doesNotMatch(webhook, /order\("created_at"[\s\S]*?status", "pending"/);
  assert.match(webhook, /checkout remains pending for a safe retry/);
  assert.match(credit, /failure_code: processingFailureCode[\s\S]*?eq\("status", "pending"\)/);
  assert.match(credit, /source_type", "stripe_checkout"/);
  assert.match(credit, /appliedLedger\.user_id !== userId/);
  assert.match(credit, /record\.provider_payment_id !== null/);
  assert.match(credit, /canRecoverStripeLedger\(record\)/);
  assert.match(credit, /ledgerRecoveryFailureCodes/);
  assert.match(credit, /record\.status === "succeeded" && record\.credits_applied_at/);
  assert.match(success, /authenticatedFetch\(endpoint/);
});

test("widget checkout and delivery preserve ownership while public delivery is session and IP limited", () => {
  const checkout = source("src", "app", "api", "stripe", "widget-checkout", "route.ts");
  const webhook = source("src", "app", "api", "stripe", "widget-webhook", "route.ts");
  const portal = source("src", "app", "api", "stripe", "widget-customer-portal", "route.ts");
  const summary = source("src", "app", "api", "stripe", "widget-subscription-summary", "route.ts");
  const validation = source("src", "lib", "widget", "validation.ts");
  const usage = source("src", "lib", "widget", "usage.ts");

  assert.match(checkout, /evaluateWidgetCheckoutReuse/);
  assert.match(checkout, /scope: "widget-checkout-ip"/);
  assert.match(checkout, /scope: "widget-checkout-subject"[\s\S]*?includeClientIp: false/);
  assert.match(checkout, /stripe_customer_id, stripe_subscription_id/);
  assert.match(checkout, /p_user_id: actor\.userId/);
  assert.match(checkout, /is\("stripe_customer_id", null\)/);
  assert.match(checkout, /authenticated_user_id: actor\.userId/);
  const claim = checkout.indexOf('admin.rpc("claim_widget_checkout_attempt"');
  const create = checkout.indexOf("stripe.checkout.sessions.create");
  const bind = checkout.indexOf('admin.rpc("bind_widget_checkout_session"');
  assert.ok(claim >= 0 && create > claim && bind > create);
  assert.match(checkout, /idempotencyKey: `widget-checkout:\$\{claim\.claim_token\}`/);
  assert.match(checkout, /\["bound", "already_bound"\]\.includes\(bound\.data\)/);
  assert.match(checkout, /admin\.rpc\("release_widget_checkout_attempt"/);
  assert.doesNotMatch(checkout, /\.from\("widget_clients"\)[\s\S]{0,80}\.insert\(/);
  assert.doesNotMatch(webhook, /from\("profiles"\)/);
  assert.match(webhook, /readStripeWebhookBody\(request\)/);
  assert.doesNotMatch(webhook, /await request\.text\(\)/);
  assert.doesNotMatch(webhook, /user_id:\s*profile/);
  assert.match(webhook, /Widget checkout ownership could not be verified/);
  assert.match(webhook, /subscription\.metadata\.widget_client_id !== clientId/);
  assert.match(webhook, /objectId\(subscription\.customer\) !== customerId/);
  assert.match(webhook, /is\("stripe_customer_id", null\)/);
  assert.match(webhook, /!pristinePendingBinding && !existingBindingMatches/);
  assert.match(webhook, /!expectedClient\.data\.admin_suspended/);
  assert.match(portal, /eq\("user_id", auth\.user\.id\)/);
  assert.match(portal, /subscription\.metadata\.widget_client_id !== clientId/);
  assert.doesNotMatch(portal, /auth\.user\.email/);
  assert.match(portal, /client\.data\.stripe_customer_id !== verifiedCustomerId/);
  assert.match(summary, /subscription\.metadata\.widget_client_id !== client\.id/);
  assert.doesNotMatch(summary, /subscriptions\.list/);
  assert.match(validation, /if \(!bootstrap && !session\) return block\("session_required"\)/);
  assert.match(validation, /session\.publicKey !== publicKey \|\| session\.clientId !== client\.id/);
  assert.doesNotMatch(validation, /recordVerifiedOrigin|system\.live_origin_verified/);
  assert.match(validation, /consumeWidgetFrontDoorAbuseLimit/);
  assert.match(validation, /path !== "\/api\/widget\/validate"/);
  assert.match(validation, /consumeWidgetLayeredAbuseLimit/);
  assert.match(usage, /widget-public-bootstrap/);
  assert.match(usage, /widget-public-client-ip/);
  assert.match(usage, /widget-public-session/);
  assert.match(usage, /includeClientIp: false/);
  assert.ok(validation.indexOf("consumeWidgetLayeredAbuseLimit") < validation.indexOf("consumeWidgetRateLimit(client.id)"));
});
