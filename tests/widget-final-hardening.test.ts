import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { canonicalWidgetDomain } from "../src/lib/widget/domain";

function source(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

test("widget domains canonicalize www and apex to one allocation boundary", () => {
  assert.equal(canonicalWidgetDomain("https://WWW.Example.com./path"), "example.com");
  assert.equal(canonicalWidgetDomain("example.com"), "example.com");
  assert.equal(canonicalWidgetDomain("shop.example.com"), "shop.example.com");
  assert.equal(canonicalWidgetDomain(null), "");
});

test("checkout authenticates ownership before charging the subject limiter", () => {
  const checkout = source("src", "app", "api", "stripe", "widget-checkout", "route.ts");
  const auth = checkout.indexOf("const auth = await requireApiUser(request)");
  const owner = checkout.indexOf("widgetCheckoutActorMatchesEmail(actor, email)");
  const subject = checkout.indexOf('scope: "widget-checkout-subject"');
  assert.ok(auth >= 0 && owner > auth && subject > owner);
  assert.match(checkout, /suffix: widgetAbuseSubject\(actor\.userId, email, canonicalDomain\)/);
  assert.match(checkout, /includeClientIp: false/);
});

test("checkout retires Stripe sessions before releasing stale database leases", () => {
  const checkout = source("src", "app", "api", "stripe", "widget-checkout", "route.ts");
  assert.match(checkout, /expires_at: claimExpiresAt/);
  assert.match(checkout, /payment_method_types: \["card"\]/);
  assert.match(checkout, /p_session_expires_at: new Date\(session\.expires_at \* 1000\)\.toISOString\(\)/);
  assert.match(checkout, /session\.status !== "open"/);
  assert.match(checkout, /stripe\.checkout\.sessions\.expire\(sessionId\)/);
  assert.match(checkout, /expired\.status === "expired" && checkoutSessionBelongsToClient/);
  assert.match(checkout, /if \(row\.stripe_checkout_session_id && !\(await safelyExpireCheckout\(row\)\)\)[\s\S]*?status: 503/);
  assert.match(checkout, /if \(!sessionId\) return false/);
  assert.match(checkout, /admin\.rpc\("release_widget_checkout_attempt"/);
  assert.match(checkout, /p_claim_token: row\.checkout_claim_token/);
  assert.match(checkout, /p_expired_stripe_checkout_session_id: row\.stripe_checkout_session_id \?\? null/);
  assert.match(checkout, /\.eq\("status", "cancelled"\)[\s\S]*?\.not\("stripe_checkout_session_id", "is", null\)/);
  assert.match(checkout, /\.eq\("canonical_domain", canonicalDomain\)/);
  assert.doesNotMatch(checkout, /\.update\(\{ status: "cancelled"[\s\S]{0,250}\.lt\("checkout_pending_until"/);
});

test("widget checkout claims, binds and releases one exact provider attempt", () => {
  const checkout = source("src", "app", "api", "stripe", "widget-checkout", "route.ts");
  const webhook = source("src", "app", "api", "stripe", "widget-webhook", "route.ts");
  const widgetVerification = source("scripts", "verify-widget-saas-commercial.sql");
  const migration = source(
    "supabase",
    "migrations",
    "20260816002448_widget_checkout_atomic_claim.sql",
  );
  const claim = checkout.indexOf('admin.rpc("claim_widget_checkout_attempt"');
  const create = checkout.indexOf("stripe.checkout.sessions.create");
  const bind = checkout.indexOf('admin.rpc("bind_widget_checkout_session"');
  assert.ok(claim >= 0 && create > claim && bind > create);
  assert.match(checkout, /idempotencyKey: `widget-checkout:\$\{claim\.claim_token\}`/);
  assert.match(checkout, /session\.expires_at !== claimExpiresAt/);
  assert.match(checkout, /checkoutSessionBelongsToClient\(session, \{ id: claim\.client_id, user_id: actor\.userId \}\)/);
  assert.match(checkout, /bound\.data === "bound"/);
  assert.match(webhook, /checkout_claim_token: null/);
  assert.match(webhook, /checkout_claimed_at: null/);
  assert.match(migration, /add column if not exists checkout_claim_token uuid/);
  assert.match(migration, /Unbound legacy widget checkout attempts must expire before atomic checkout claims are enabled/);
  assert.match(migration, /stripe_checkout_session_id is null[\s\S]*?created_at \+ interval '31 minutes'[\s\S]*?> pg_catalog\.now\(\)/);
  assert.match(migration, /widget_clients_checkout_claim_state_check/);
  assert.match(migration, /widget_clients_checkout_claim_token_idx/);
  assert.match(migration, /create or replace function public\.claim_widget_checkout_attempt/);
  assert.match(migration, /status is distinct from 'cancelled'[\s\S]*?for update/);
  assert.match(migration, /if not found and p_existing_client_id is not null then[\s\S]*?return/);
  assert.match(migration, /when unique_violation[\s\S]*?exact same unbound owner attempt/i);
  assert.match(migration, /create or replace function public\.bind_widget_checkout_session/);
  assert.match(migration, /client\.checkout_claim_token = p_claim_token/);
  assert.match(migration, /return 'already_bound'/);
  assert.match(migration, /create or replace function public\.release_widget_checkout_attempt/);
  assert.match(migration, /p_expired_stripe_checkout_session_id is null[\s\S]*?client\.stripe_checkout_session_id is null[\s\S]*?client\.checkout_pending_until <= pg_catalog\.now\(\)/);
  assert.doesNotMatch(checkout, /p_expired_stripe_checkout_session_id:\s*["'`]cs_/);
  assert.match(migration, /grant execute on function public\.claim_widget_checkout_attempt[\s\S]*?to service_role/);
  assert.match(migration, /from public, anon, authenticated/g);
  assert.match(widgetVerification, /widget_clients_checkout_claim_state_check/);
  assert.match(widgetVerification, /widget_clients_checkout_claim_token_idx/);
  assert.match(widgetVerification, /claim_widget_checkout_attempt\(uuid,uuid,text,text,text,text,text,numeric,text,text,jsonb,integer,uuid,timestamptz\)/);
  assert.match(widgetVerification, /bind_widget_checkout_session\(uuid,uuid,uuid,text,timestamptz\)/);
  assert.match(widgetVerification, /release_widget_checkout_attempt\(uuid,uuid,uuid,text\)/);
  assert.match(widgetVerification, /has_function_privilege\('service_role', p\.oid, 'execute'\)/);
});

test("migration enforces canonical live-domain uniqueness and private durable webhook state", () => {
  const migration = source(
    "supabase",
    "migrations",
    "20260816002445_widget_final_hardening.sql",
  );
  assert.match(migration, /add column if not exists canonical_domain text/);
  assert.match(migration, /pg_catalog\.substr\(v_domain, 5\)/);
  assert.doesNotMatch(migration, /pg_catalog\.substring\(/i);
  assert.match(migration, /before insert or update on public\.widget_clients/);
  assert.match(migration, /v_domain !~ '\^\[a-z0-9\.\-\]\+\$'/);
  assert.match(migration, /v_label !~ '\^\[a-z0-9\]\(/);
  assert.match(migration, /widget_clients_one_live_canonical_domain_idx[\s\S]*?where status is distinct from 'cancelled'/);
  assert.match(migration, /processing_state in \('processing', 'failed', 'processed'\)/);
  assert.match(migration, /add column if not exists claim_token uuid/);
  assert.match(migration, /widget_webhook_events_claim_state_check/);
  assert.match(migration, /processing_state = 'processing'[\s\S]*claim_token is not null[\s\S]*claimed_at is not null/);
  assert.match(migration, /create table if not exists public\.widget_webhook_effects/);
  assert.match(migration, /primary key \(event_id, effect_key\)/);
  assert.match(migration, /revoke all privileges on table public\.widget_webhook_effects[\s\S]*?from public, anon, authenticated/);
  assert.match(migration, /widget_audit_logs_event_effect_idx/);
  assert.match(migration, /alter table public\.widget_clients enable row level security/);
  assert.match(migration, /revoke all privileges on table[\s\S]*?public\.widget_rate_limit_buckets[\s\S]*?from public, anon, authenticated/);
  assert.match(migration, /grant all privileges on table[\s\S]*?public\.widget_rate_limit_buckets[\s\S]*?to service_role/);
  const verification = source("scripts", "verify-security-state-hardening.sql");
  assert.match(verification, /widget canonical ownership and webhook effects are database-enforced/i);
  assert.match(verification, /widget_webhook_events_claim_state_check/i);
  assert.match(verification, /widget checkout provider creation is atomically claimed and bound/i);
});

test("release SQL avoids schema-qualified special substring syntax", () => {
  const releaseSql = [
    "20260816002443_financial_authority_hardening.sql",
    "20260816002444_security_state_hardening.sql",
    "20260816002445_widget_final_hardening.sql",
    "20260816002446_stripe_recovery_hardening.sql",
    "20260816002447_file_expert_atomic_completion.sql",
    "20260816002448_widget_checkout_atomic_claim.sql",
    "20260816002450_auth_customer_id_generator_hardening.sql",
    "20260816002452_post_deploy_legacy_rpc_cutover.sql",
    "20260816002453_email_delivery_schema_parity.sql",
  ].map((fileName) => source("supabase", "migrations", fileName));
  releaseSql.push(
    source("scripts", "preflight-integrated-security-release.sql"),
    source("scripts", "verify-auth-customer-id-hardening.sql"),
  );

  for (const sql of releaseSql) {
    assert.doesNotMatch(sql, /pg_catalog\.substring\(/i);
    assert.doesNotMatch(sql, /pg_catalog\.position\(/i);
  }
});

test("webhook failures retain claims and retry audit and e-mail effects idempotently", () => {
  const webhook = source("src", "app", "api", "stripe", "widget-webhook", "route.ts");
  const email = source("src", "lib", "email.ts");
  assert.match(webhook, /const claimToken = randomUUID\(\)/);
  assert.match(webhook, /processing_state: "failed"/);
  assert.match(webhook, /\.eq\("claim_token", claimToken\)/);
  assert.doesNotMatch(webhook, /from\("widget_webhook_events"\)[\s\S]{0,100}\.delete\(\)/);
  assert.match(webhook, /source_event_id: event\.id/);
  assert.match(webhook, /effect_key: input\.effectKey/);
  assert.match(webhook, /from\("widget_webhook_effects"\)/);
  assert.match(webhook, /effect_state: "completed"/);
  assert.match(webhook, /send\(`widget:\$\{event\.id\}:\$\{effectKey\}`\)/);
  assert.match(webhook, /auditDetails\.notify_cancelled === true/);
  assert.match(webhook, /auditDetails\.notify_activated === true/);
  assert.match(email, /widgetEmailRequestOptions\(idempotencyKey\)/g);
  assert.match(email, /mg_widget_\$\{createHash\("sha256"\)/);
});
