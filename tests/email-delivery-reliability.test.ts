import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import type { WebhookEventPayload } from "resend";
import {
  getSuppressionReasonForDeliveryStatus,
  normalizeResendDeliveryEvent,
  selectLatestAdminEmailDeliveryIssues,
  shouldBlockRecipientForSuppression,
} from "../src/lib/email/deliveryReliability";
import {
  buildSupabaseAuthTemplateHtml,
  buildSupabaseAuthTemplateSubject,
  renderSupabaseAuthTemplatePreview,
  supabaseAuthTemplateCatalog,
} from "../src/lib/email/supabaseAuthTemplates";
import { supportedTransactionalEmailLanguages } from "../src/lib/email/language";
import { emailLocaleCopy } from "../src/lib/email/localeCopy";

function providerEvent(
  type: string,
  extra: Record<string, unknown> = {}
): WebhookEventPayload {
  return {
    type,
    created_at: "2026-08-04T10:15:30.000Z",
    data: {
      created_at: "2026-08-04T10:15:29.000Z",
      email_id: "provider-message-1",
      from: "MG AutoTech <noreply@file.mgautotech.de>",
      to: ["Customer@Example.com"],
      subject: "Safe transactional message",
      ...extra,
    },
  } as WebhookEventPayload;
}

function normalize(type: string, extra: Record<string, unknown> = {}) {
  return normalizeResendDeliveryEvent({
    providerEventId: `event-${type}`,
    payload: JSON.stringify({ type, extra }),
    event: providerEvent(type, extra),
  });
}

test("signed provider delivery statuses normalize to the admin delivery model", () => {
  const expected = new Map([
    ["email.sent", "sent"],
    ["email.delivered", "delivered"],
    ["email.delivery_delayed", "delayed"],
    ["email.complained", "complained"],
    ["email.failed", "failed"],
    ["email.suppressed", "suppressed"],
  ]);

  for (const [type, status] of expected) {
    const extra = type === "email.failed"
      ? { failed: { reason: "temporary provider failure" } }
      : type === "email.suppressed"
        ? { suppressed: { type: "Bounce", message: "Recipient suppressed" } }
        : {};
    const event = normalize(type, extra);
    assert.ok(event, type);
    assert.equal(event.deliveryStatus, status);
    assert.equal(event.recipientEmail, "customer@example.com");
    assert.match(event.payloadSha256, /^[a-f0-9]{64}$/);
  }
});

test("hard bounce, complaint and provider suppression block repeat delivery", () => {
  const bounced = normalize("email.bounced", {
    bounce: { type: "Permanent", subType: "MailboxDoesNotExist", message: "Mailbox unavailable" },
  });
  assert.ok(bounced);
  assert.equal(bounced.suppressionReason, "hard_bounce");
  assert.equal(bounced.reasonCode, "Permanent");
  assert.equal(bounced.reasonMessage, "Mailbox unavailable");
  assert.equal(getSuppressionReasonForDeliveryStatus("complained"), "complaint");
  assert.equal(getSuppressionReasonForDeliveryStatus("suppressed"), "provider_suppressed");
  assert.equal(getSuppressionReasonForDeliveryStatus("delayed"), null);
  assert.equal(getSuppressionReasonForDeliveryStatus("failed"), null);
});

test("delivery normalization rejects untracked, malformed and recipient-less events", () => {
  assert.equal(normalize("email.opened"), null);
  assert.equal(normalizeResendDeliveryEvent({
    providerEventId: "event-no-recipient",
    payload: "{}",
    event: providerEvent("email.sent", { to: [] }),
  }), null);
  assert.equal(normalizeResendDeliveryEvent({
    providerEventId: "",
    payload: "{}",
    event: providerEvent("email.sent"),
  }), null);
});

test("recipient suppression is fail-closed for real sending and tolerant in dry-run", () => {
  assert.equal(shouldBlockRecipientForSuppression({ available: true, suppressed: true, reason: "complaint" }, false), true);
  assert.equal(shouldBlockRecipientForSuppression({ available: false, suppressed: false, reason: null }, false), true);
  assert.equal(shouldBlockRecipientForSuppression({ available: false, suppressed: false, reason: null }, true), false);
  assert.equal(shouldBlockRecipientForSuppression({ available: true, suppressed: false, reason: null }, false), false);
});

test("admin notifications keep only the latest delivery state per provider message", () => {
  const issues = selectLatestAdminEmailDeliveryIssues([
    {
      provider_event_id: "delivered-1",
      provider_message_id: "message-1",
      provider_event_type: "email.delivered",
      delivery_status: "delivered",
      occurred_at: "2026-08-04T11:00:00.000Z",
    },
    {
      provider_event_id: "delayed-1",
      provider_message_id: "message-1",
      provider_event_type: "email.delivery_delayed",
      delivery_status: "delayed",
      occurred_at: "2026-08-04T10:00:00.000Z",
    },
    {
      provider_event_id: "bounced-2",
      provider_message_id: "message-2",
      provider_event_type: "email.bounced",
      delivery_status: "bounced",
      occurred_at: "2026-08-04T10:30:00.000Z",
    },
  ]);
  assert.deepEqual(issues, [{
    id: "bounced-2",
    status: "bounced",
    eventType: "email.bounced",
    occurredAt: "2026-08-04T10:30:00.000Z",
  }]);
});

test("email reliability migration is additive, private and RLS protected", () => {
  const sql = readFileSync(resolve(process.cwd(), "scripts", "add-email-delivery-reliability.sql"), "utf8");
  const verification = readFileSync(resolve(process.cwd(), "scripts", "verify-email-delivery-reliability.sql"), "utf8");
  assert.match(sql, /create table if not exists public\.email_delivery_events/i);
  assert.match(sql, /create table if not exists public\.email_suppressions/i);
  assert.match(sql, /alter table public\.email_delivery_events enable row level security/i);
  assert.match(sql, /alter table public\.email_suppressions enable row level security/i);
  assert.match(sql, /revoke all on public\.email_delivery_events from anon/i);
  assert.match(sql, /has_staff_permission\('orders\.view'\)/i);
  assert.match(sql, /payload_sha256 text not null/i);
  assert.doesNotMatch(sql, /payload\s+jsonb|email_body|html_body/i);
  assert.doesNotMatch(sql, /\bdrop\b|\btruncate\b|\bdelete\s+from\b/i);
  assert.doesNotMatch(verification, /\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b|\btruncate\b/i);
});

test("Resend webhook is signed, bounded, idempotent and returns no recipient data", () => {
  const route = readFileSync(resolve(process.cwd(), "src", "app", "api", "webhooks", "resend", "route.ts"), "utf8");
  const delivery = readFileSync(resolve(process.cwd(), "src", "lib", "email", "deliveryReliability.ts"), "utf8");
  assert.match(route, /RESEND_WEBHOOK_SECRET/);
  assert.match(route, /svix-id/);
  assert.match(route, /svix-timestamp/);
  assert.match(route, /svix-signature/);
  assert.match(route, /webhooks\.verify/);
  assert.match(route, /64 \* 1024/);
  assert.match(delivery, /insertResult\.error\?\.code === "23505"/);
  assert.match(delivery, /email_suppressions/);
  assert.match(delivery, /last_delivery_event_at\.is\.null/);
  assert.doesNotMatch(route, /recipientEmail|recipient_email|payloadSha256/);
});

test("all Supabase Auth templates render every supported language with English fallback", () => {
  assert.equal(supabaseAuthTemplateCatalog.length, 13);
  const required = new Set([
    "confirm_signup", "password_recovery", "invite_user", "magic_link",
    "email_change", "reauthentication", "password_changed", "email_changed",
    "phone_changed", "identity_linked", "identity_unlinked",
    "mfa_factor_enrolled", "mfa_factor_unenrolled",
  ]);
  assert.deepEqual(new Set(supabaseAuthTemplateCatalog.map((item) => item.key)), required);

  for (const template of supabaseAuthTemplateCatalog) {
    for (const language of supportedTransactionalEmailLanguages) {
      const preview = renderSupabaseAuthTemplatePreview(template.key, language);
      assert.ok(preview?.subject.trim(), `${template.key}:${language}:subject`);
      assert.match(preview?.html ?? "", new RegExp(`<html lang="${language}">`));
      assert.ok(
        preview?.html.includes(emailLocaleCopy[language].serviceName),
        `${template.key}:${language}:localized service name`
      );
      assert.doesNotMatch(JSON.stringify(preview), /service_role|RESEND_API_KEY|SUPABASE_SERVICE/i);
    }
    const hostedHtml = buildSupabaseAuthTemplateHtml(template.key) ?? "";
    const hostedSubject = buildSupabaseAuthTemplateSubject(template.key) ?? "";
    assert.match(hostedHtml, /email_language/);
    for (const language of supportedTransactionalEmailLanguages.filter((item) => item !== "en")) {
      assert.ok(hostedHtml.includes(`"${language}"`), `${template.key}:${language}:hosted condition`);
      assert.ok(
        hostedHtml.includes(emailLocaleCopy[language].serviceName),
        `${template.key}:${language}:hosted service name`
      );
    }
    assert.equal(hostedSubject, template.copy.en.subject);
    assert.ok(hostedSubject.length <= 255, `${template.key}:Supabase hosted subject limit`);
  }

  const manifest = JSON.parse(readFileSync(
    resolve(process.cwd(), "docs", "email-templates", "manifest.json"),
    "utf8"
  )) as Array<{ key: string; file: string; subject: string }>;
  assert.equal(manifest.length, supabaseAuthTemplateCatalog.length);
  for (const item of manifest) {
    assert.equal(
      readFileSync(resolve(process.cwd(), "docs", "email-templates", item.file), "utf8").trim(),
      buildSupabaseAuthTemplateHtml(item.key)
    );
    assert.equal(item.subject, buildSupabaseAuthTemplateSubject(item.key));
  }
});

test("admin email controls expose delivery issues without leaking them to customers", () => {
  const adminRoute = readFileSync(resolve(process.cwd(), "src", "app", "api", "admin", "email", "route.ts"), "utf8");
  const adminPage = readFileSync(resolve(process.cwd(), "src", "app", "admin", "email", "page.tsx"), "utf8");
  const notificationRoute = readFileSync(resolve(process.cwd(), "src", "app", "api", "admin", "notifications", "route.ts"), "utf8");
  const delivery = readFileSync(resolve(process.cwd(), "src", "lib", "email", "deliveryReliability.ts"), "utf8");
  assert.match(adminRoute, /requireStaffPermission\(request, "orders\.view"\)/);
  assert.match(adminRoute, /requireStaffPermission\(request, "orders\.manage"\)/);
  assert.match(adminRoute, /action: z\.enum\(\["send_test", "preview", "certify"\]\)/);
  assert.match(adminPage, /Provider delivery status/);
  assert.match(adminPage, /Suppressed recipients/);
  assert.match(adminPage, /sandbox=""/);
  assert.match(notificationRoute, /requireStaffPermission\(request, "orders\.view"\)/);
  assert.match(delivery, /select\("provider_event_id,provider_message_id,provider_event_type,delivery_status,occurred_at"\)/);
  assert.match(delivery, /seenMessages/);
  assert.doesNotMatch(delivery, /listAdminEmailDeliveryIssues[\s\S]*select\([^)]*recipient_email/);
});
