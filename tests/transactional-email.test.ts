import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";
import { renderTransactionalEmailTemplate } from "../src/lib/email/templates";
import {
  buildProviderEmailIdempotencyKey,
  isRetryableEmailProviderError,
  sendTransactionalEmail,
} from "../src/lib/email/service";
import {
  buildLifecycleIdempotencyKey,
  resolveStatusEmail,
  shouldSendStatusTransition,
} from "../src/lib/email/lifecycle";
import { sanitizeEmailEventMetadata } from "../src/lib/email/logging";
import {
  normalizeTransactionalEmailLanguage,
  resolveBrowserTransactionalEmailLanguage,
  resolveTransactionalEmailLanguageFromCookie,
  resolveTransactionalEmailLanguageFromMetadata,
  supportedTransactionalEmailLanguages,
} from "../src/lib/email/language";
import { emailLocaleCopy } from "../src/lib/email/localeCopy";
import { safeEmailUrl } from "../src/lib/email/render";
import { filterCustomerVisibleRequestMessages } from "../src/lib/workOrders/messageVisibility";

test("transactional email migration is additive, logged and RLS protected", () => {
  const sql = readFileSync(resolve(process.cwd(), "scripts", "add-transactional-email-system.sql"), "utf8");
  assert.match(sql, /create table if not exists public\.email_events/i);
  assert.match(sql, /idempotency_key text not null unique/i);
  assert.match(sql, /status text not null default 'pending'/i);
  assert.match(sql, /alter table public\.email_events enable row level security/i);
  assert.match(sql, /has_staff_permission\('orders\.view'\)/i);
  assert.match(sql, /has_staff_permission\('orders\.manage'\)/i);
  assert.doesNotMatch(sql, /\bdrop\s+table\b|\bdrop\s+column\b|\btruncate\b|\bdelete\s+from\b/i);
});

test("request-created template renders German HTML and text without internal fields", () => {
  const rendered = renderTransactionalEmailTemplate("request_created", {
    requestId: "32007019-ac4b-48cb-a648-668ffa5e4d69",
    customerId: "MGA-10001",
    vehicleSummary: "Mercedes-Benz E W214 E 220 d",
    serviceSummary: "Stage 1 + EGR OFF",
    dashboardUrl: "https://file.mgautotech.de/dashboard/orders/32007019-ac4b-48cb-a648-668ffa5e4d69",
  }, "de");
  const serialized = JSON.stringify(rendered);
  assert.match(rendered.subject, /Ihre Anfrage/);
  assert.match(rendered.html, /MG AutoTech/);
  assert.match(rendered.text, /Mercedes-Benz E W214/);
  assert.equal(serialized.includes("internal_notes"), false);
  assert.equal(serialized.includes("risk_flags"), false);
  assert.equal(serialized.includes("storage_path"), false);
  assert.equal(serialized.includes("confidence_score"), false);
  assert.equal(serialized.includes("hex"), false);
});

test("verified registration renders customer welcome and separate admin notice", () => {
  const customer = renderTransactionalEmailTemplate("customer_welcome", {
    customerId: "MGA-10001",
    customerEmail: "customer@example.com",
    customerName: "Example Workshop",
    dashboardUrl: "https://file.mgautotech.de/dashboard",
  }, "de");
  const admin = renderTransactionalEmailTemplate("customer_registered", {
    customerId: "MGA-10001",
    customerEmail: "customer@example.com",
    customerName: "Example Workshop",
    adminUrl: "https://file.mgautotech.de/admin?view=customers",
  }, "de");
  assert.match(customer.subject, /Kundenkonto ist bereit/);
  assert.match(customer.text, /Credits verwalten/);
  assert.match(admin.subject, /Neuer MG AutoTech Kunde/);
  assert.doesNotMatch(customer.text, /Referenz: -/);
});

test("password recovery template contains the secure action without internal metadata", () => {
  const recoveryUrl = "https://example.supabase.co/auth/v1/verify?token=hashed-token&type=recovery";
  const rendered = renderTransactionalEmailTemplate("customer_password_reset", {
    customerId: "MGA-10001",
    customerEmail: "customer@example.com",
    recoveryUrl,
  }, "de");
  const serialized = JSON.stringify(rendered);

  assert.match(rendered.subject, /Passwort sicher/);
  assert.match(rendered.html, /Passwort sicher zurücksetzen/);
  assert.match(rendered.text, /example\.supabase\.co\/auth\/v1\/verify/);
  assert.doesNotMatch(serialized, /admin_note|storage_path|service_role|raw_binary|hex_preview|confidence_score/i);
});

test("customer transactional email language is explicit and defaults safely to English", () => {
  const context = {
    customerId: "MGA-10001",
    customerEmail: "customer@example.com",
    recoveryUrl: "https://example.supabase.co/auth/v1/verify?token=hashed-token&type=recovery",
  };
  const defaultEmail = renderTransactionalEmailTemplate("customer_password_reset", context);
  const english = renderTransactionalEmailTemplate("customer_password_reset", context, "en");
  const german = renderTransactionalEmailTemplate("customer_password_reset", context, "de");
  const turkish = renderTransactionalEmailTemplate("customer_password_reset", context, "tr");

  assert.equal(defaultEmail.subject, english.subject);
  assert.match(english.subject, /Secure password reset/);
  assert.match(english.html, /<html lang="en">/);
  assert.match(english.html, /Reset your password securely/);
  assert.doesNotMatch(english.html, /Passwort|Kundenkonto|Zurücksetzen/);
  assert.match(german.subject, /Passwort sicher/);
  assert.match(german.html, /<html lang="de">/);
  assert.match(turkish.subject, /Güvenli şifre sıfırlama/);
  assert.match(turkish.html, /<html lang="tr">/);
  assert.match(turkish.html, /Şifrenizi güvenle sıfırlayın/);
  assert.doesNotMatch(turkish.html, /Passwort|Kundenkonto/);
});

test("email language resolver accepts exact supported locales and never promotes unknown values", () => {
  assert.equal(normalizeTransactionalEmailLanguage("de-DE"), "de");
  assert.equal(normalizeTransactionalEmailLanguage("tr_TR"), "tr");
  assert.equal(normalizeTransactionalEmailLanguage("en-GB"), "en");
  assert.equal(normalizeTransactionalEmailLanguage("fr-FR"), "fr");
  assert.equal(normalizeTransactionalEmailLanguage(null), "en");
  for (const language of supportedTransactionalEmailLanguages) {
    assert.equal(
      normalizeTransactionalEmailLanguage(`${language}-${language.toUpperCase()}`),
      language
    );
  }
  assert.equal(
    resolveTransactionalEmailLanguageFromMetadata({ email_language: "tr-TR" }),
    "tr"
  );
  assert.equal(
    resolveTransactionalEmailLanguageFromMetadata({ preferred_language: "de" }),
    "de"
  );
  assert.equal(
    resolveTransactionalEmailLanguageFromMetadata({ email_language: "unknown", locale: "fr" }),
    "fr"
  );
  assert.equal(resolveTransactionalEmailLanguageFromCookie("foo=1; mg_locale=de; bar=2"), "de");
  assert.equal(resolveTransactionalEmailLanguageFromCookie("mg_locale=fr"), "fr");
  assert.equal(
    resolveBrowserTransactionalEmailLanguage({
      storedLocale: "tr",
      cookieHeader: "mg_locale=de",
      browserLocale: "en-US",
    }),
    "tr"
  );
});

test("request lifecycle copy follows the recipient email language", () => {
  const english = resolveStatusEmail("customer_info_needed", "legacy_order", "en");
  const german = resolveStatusEmail("customer_info_needed", "legacy_order", "de");
  const turkish = resolveStatusEmail("customer_info_needed", "legacy_order", "tr");
  const french = resolveStatusEmail("customer_info_needed", "legacy_order", "fr");
  const chinese = resolveStatusEmail("customer_info_needed", "legacy_order", "zh");

  assert.equal(english?.statusLabel, "Response required");
  assert.match(english?.actionRequired ?? "", /review the latest message/);
  assert.equal(german?.statusLabel, "Rückmeldung erforderlich");
  assert.equal(turkish?.statusLabel, "Yanıt gerekli");
  assert.match(turkish?.actionRequired ?? "", /son mesajı kontrol edin/);
  assert.equal(french?.statusLabel, "Réponse requise");
  assert.equal(chinese?.statusLabel, "需要回复");
});

test("every customer lifecycle template renders complete output in all supported languages", () => {
  const customerEvents = [
    "customer_welcome",
    "customer_password_reset",
    "request_created",
    "request_abandoned_reminder",
    "request_received",
    "file_uploaded",
    "additional_file_requested",
    "additional_file_uploaded_customer",
    "request_in_review",
    "request_in_progress",
    "request_waiting_for_customer",
    "request_completed",
    "request_delivered",
    "request_cancelled",
    "request_rejected_or_not_possible",
    "credit_purchase_started",
    "bank_transfer_instructions",
    "payment_received",
    "credits_added",
    "payment_failed",
    "payment_pending_review",
    "customer_visible_message_added",
    "upload_permission_enabled",
    "upload_permission_disabled",
    "delivery_completed",
  ] as const;
  const context = {
    requestId: "request-id",
    requestNumber: "#REQ-100",
    customerId: "MGA-10001",
    customerEmail: "customer@example.com",
    vehicleSummary: "Mercedes-Benz E W214",
    serviceSummary: "Stage 1",
    statusLabel: "In progress",
    fileName: "original.bin",
    messagePreview: "Please review the latest message.",
    credits: 10,
    amountLabel: "36.00 EUR",
    recoveryUrl: "https://example.supabase.co/auth/v1/verify?token=hashed-token&type=recovery",
    dashboardUrl: "https://file.mgautotech.de/dashboard",
  };

  for (const eventType of customerEvents) {
    for (const language of supportedTransactionalEmailLanguages) {
      const rendered = renderTransactionalEmailTemplate(eventType, context, language);
      assert.ok(rendered.subject.trim(), `${eventType}:${language}:subject`);
      assert.ok(rendered.text.trim(), `${eventType}:${language}:text`);
      assert.match(rendered.html, new RegExp(`<html lang="${language}">`));
      assert.ok(
        rendered.html.includes(emailLocaleCopy[language].serviceName),
        `${eventType}:${language}:localized service name`
      );
      assert.doesNotMatch(rendered.html, />\s*(?:undefined|null)\s*</);
      assert.doesNotMatch(rendered.text, /^(?:undefined|null)$/m);
      assert.doesNotMatch(
        JSON.stringify(rendered),
        /admin_notes|storage_path|service_role|raw_binary|hex_preview|confidence_score/i
      );
    }
  }
});

test("status lifecycle maps meaningful legacy and work-order transitions only", () => {
  assert.equal(resolveStatusEmail("customer_info_needed", "legacy_order")?.eventType, "request_waiting_for_customer");
  assert.equal(resolveStatusEmail("file_check", "legacy_order")?.eventType, "request_in_review");
  assert.equal(resolveStatusEmail("waiting_for_file", "work_order")?.eventType, "additional_file_requested");
  assert.equal(resolveStatusEmail("delivered", "delivery")?.eventType, "request_delivered");
  assert.equal(resolveStatusEmail("quality_check", "work_order"), null);
  assert.equal(resolveStatusEmail("payment_review", "work_order"), null);
  assert.equal(shouldSendStatusTransition({ previousStatus: "in_progress", nextStatus: "in_progress", source: "legacy_order" }), false);
  assert.equal(shouldSendStatusTransition({ previousStatus: "file_check", nextStatus: "customer_info_needed", source: "legacy_order" }), true);
});

test("lifecycle idempotency key is deterministic and bounded", () => {
  const first = buildLifecycleIdempotencyKey(["request_in_review", "ORDER-ID", "transition 1"]);
  const second = buildLifecycleIdempotencyKey(["request_in_review", "ORDER-ID", "transition 1"]);
  assert.equal(first, second);
  assert.equal(first, "request_in_review:order-id:transition_1");
  assert.ok(first.length <= 240);
});

test("customer-visible message email includes only visible safe message content", () => {
  const rows = filterCustomerVisibleRequestMessages([
    { id: "visible", request_id: "r1", sender_id: "admin", sender_role: "admin", message: "Bitte laden Sie eine neue ORI-Datei hoch.", created_at: "2026-07-11T00:00:00.000Z", visibility_status: "visible" },
    { id: "hidden", request_id: "r1", sender_id: "admin", sender_role: "admin", message: "Hidden smoke test note", created_at: "2026-07-11T00:01:00.000Z", visibility_status: "hidden" },
  ]);
  const rendered = renderTransactionalEmailTemplate("customer_visible_message_added", {
    requestId: "r1",
    messagePreview: rows[0].message,
    vehicleSummary: "BMW 530d",
  }, "de");
  const serialized = JSON.stringify(rendered);
  assert.equal(rows.length, 1);
  assert.match(serialized, /Bitte laden Sie/);
  assert.equal(serialized.includes("Hidden smoke test note"), false);
});

test("additional-file customer receipt and revision admin templates remain portal-safe", () => {
  const receipt = renderTransactionalEmailTemplate("additional_file_uploaded_customer", {
    requestId: "r1",
    fileName: "safe-original.bin",
    dashboardUrl: "https://file.mgautotech.de/dashboard/orders/r1",
  }, "de");
  const revision = renderTransactionalEmailTemplate("revision_requested_admin_notification", {
    requestId: "r1",
    messagePreview: "Please review the requested revision.",
    adminUrl: "https://file.mgautotech.de/admin/requests/r1",
  }, "de");
  assert.match(receipt.subject, /Zusätzliche Datei/);
  assert.match(revision.subject, /Revision angefordert/);
  const serialized = JSON.stringify({ receipt, revision });
  assert.doesNotMatch(serialized, /storage_path|service_role|raw_binary|hex_preview|admin_note/i);
});

test("email CTA accepts only http and https destinations", () => {
  assert.equal(safeEmailUrl("javascript:alert(1)"), null);
  assert.equal(safeEmailUrl("file:///private/customer.bin"), null);
  assert.equal(safeEmailUrl("https://file.mgautotech.de/dashboard"), "https://file.mgautotech.de/dashboard");
});

test("email event metadata sanitizer removes nested private fields", () => {
  const sanitized = sanitizeEmailEventMetadata({
    source: "request_status",
    nested: {
      storage_path: "customer/private/file.bin",
      raw_binary: "secret",
      recovery_url: "https://example.supabase.co/auth/v1/verify?token=secret",
      action_link: "https://example.supabase.co/auth/v1/verify?token=secret",
      safe_status: "completed",
    },
    list: [{ sample_id: "private" }, { status: "ok" }],
  });
  const serialized = JSON.stringify(sanitized);
  assert.match(serialized, /request_status/);
  assert.match(serialized, /safe_status/);
  assert.doesNotMatch(serialized, /storage_path|raw_binary|sample_id|recovery_url|action_link|token=secret|private\/file/i);
});

test("bank transfer email includes payment reference and configured bank fields only", () => {
  const rendered = renderTransactionalEmailTemplate("bank_transfer_instructions", {
    customerId: "MGA-12345",
    credits: 100,
    amountLabel: "400.00 EUR",
    paymentReference: "MGA-12345",
    bankAccountName: "MG AutoTech",
    bankName: "Example Bank",
    bankIban: "DE00TEST0000000000",
    bankBic: "TESTDE00",
  }, "de");
  assert.match(rendered.text, /MGA-12345/);
  assert.match(rendered.text, /400.00 EUR/);
  assert.match(rendered.text, /DE00TEST/);
  assert.equal(JSON.stringify(rendered).includes("paypal"), false);
});

test("dry-run provider does not send real email and keeps idempotency key", async () => {
  const previousDryRun = process.env.EMAIL_DRY_RUN;
  process.env.EMAIL_DRY_RUN = "true";
  try {
    const result = await sendTransactionalEmail({
      eventType: "admin_email_test",
      to: "admin@example.com",
      context: { adminUrl: "https://file.mgautotech.de/admin/email" },
      idempotencyKey: "unit-test-email-dry-run",
    });
    assert.equal(result.ok, true);
    assert.equal(result.status, "skipped");
    assert.equal(result.provider, "dry_run");
    assert.equal(result.idempotencyKey, "unit-test-email-dry-run");
  } finally {
    if (previousDryRun === undefined) delete process.env.EMAIL_DRY_RUN;
    else process.env.EMAIL_DRY_RUN = previousDryRun;
  }
});

test("real email delivery requires explicit dry-run opt-out", () => {
  const service = readFileSync(resolve(process.cwd(), "src", "lib", "email", "service.ts"), "utf8");
  assert.match(service, /process\.env\.EMAIL_DRY_RUN !== "false"/);
  assert.match(service, /process\.env\.NODE_ENV === "test"/);
});

test("provider delivery uses a privacy-safe stable idempotency key", () => {
  const first = buildProviderEmailIdempotencyKey("request-created:customer@example.com:order-1");
  const second = buildProviderEmailIdempotencyKey("request-created:customer@example.com:order-1");
  const other = buildProviderEmailIdempotencyKey("request-created:customer@example.com:order-2");

  assert.equal(first, second);
  assert.notEqual(first, other);
  assert.match(first, /^mg_[a-f0-9]{64}$/);
  assert.doesNotMatch(first, /customer|example|order/i);
});

test("email provider retries only transient failures", () => {
  assert.equal(isRetryableEmailProviderError(new TypeError("fetch failed")), true);
  assert.equal(isRetryableEmailProviderError({ statusCode: 429, name: "rate_limit_exceeded" }), true);
  assert.equal(isRetryableEmailProviderError({ statusCode: 503, name: "application_error" }), true);
  assert.equal(isRetryableEmailProviderError({ statusCode: 400, name: "validation_error" }), false);
  assert.equal(isRetryableEmailProviderError({ statusCode: 401, name: "authentication_error" }), false);

  const service = readFileSync(resolve(process.cwd(), "src", "lib", "email", "service.ts"), "utf8");
  assert.match(service, /providerRetryDelays = \[0, 300, 900\]/);
  assert.match(service, /emails\.send\(emailPayload, \{\s*idempotencyKey: providerIdempotencyKey/);
});

test("email service rejects invalid recipients before provider access", async () => {
  const result = await sendTransactionalEmail({
    eventType: "admin_email_test",
    to: "not-an-email",
    context: {},
    idempotencyKey: "invalid-recipient",
  });
  assert.equal(result.ok, false);
  assert.equal(result.skippedReason, "invalid_recipient");
});

test("admin email and bank transfer email APIs reject anonymous users", async () => {
  const adminEmail = await import("../src/app/api/admin/email/route");
  const bankEmail = await import("../src/app/api/email/bank-transfer/route");
  const registrationEmail = await import("../src/app/api/email/new-customer/route");
  const orderStatus = await import("../src/app/api/admin/orders/[id]/status/route");
  assert.equal((await adminEmail.GET(new Request("http://localhost/api/admin/email"))).status, 401);
  assert.equal((await adminEmail.POST(new Request("http://localhost/api/admin/email", { method: "POST", body: "{}" }))).status, 401);
  assert.equal((await bankEmail.POST(new Request("http://localhost/api/email/bank-transfer", { method: "POST", body: "{}" }))).status, 401);
  assert.equal((await registrationEmail.POST(new Request("http://localhost/api/email/new-customer", { method: "POST", body: "{}" }))).status, 401);
  assert.equal((await orderStatus.PATCH(
    new Request("http://localhost/api/admin/orders/r1/status", { method: "PATCH", body: "{}" }),
    { params: Promise.resolve({ id: "r1" }) }
  )).status, 401);
});

test("registration notifications happen only after verified auth callback", () => {
  const register = readFileSync(resolve(process.cwd(), "src", "app", "register", "page.tsx"), "utf8");
  const callback = readFileSync(resolve(process.cwd(), "src", "app", "auth", "callback", "page.tsx"), "utf8");
  const route = readFileSync(resolve(process.cwd(), "src", "app", "api", "email", "new-customer", "route.ts"), "utf8");
  const settings = readFileSync(resolve(process.cwd(), "src", "app", "dashboard", "settings", "page.tsx"), "utf8");
  assert.match(register, /supabase\.auth\.signUp/);
  assert.match(register, /email_language: getSelectedEmailLanguage\(\)/);
  assert.match(register, /supabase\.auth\.resend/);
  assert.match(register, /verificationPending/);
  assert.doesNotMatch(register, /customerEmail:\s*cleanEmail[\s\S]{0,180}\/api\/email\/new-customer/);
  assert.match(callback, /authenticatedFetch\("\/api\/email\/new-customer"/);
  assert.match(callback, /isRecentEmailConfirmation/);
  assert.match(route, /requireApiUser/);
  assert.match(route, /auth\.user\.email/);
  assert.match(route, /resolveTransactionalEmailLanguageFromCookie/);
  assert.match(route, /email_language: language/);
  assert.match(settings, /E-mail Language/);
  assert.match(settings, /supabase\.auth\.updateUser/);
  assert.match(settings, /email_language: emailLanguage/);
  assert.doesNotMatch(route, /customerEmail:\s*z\.string/);
});

test("Supabase Auth templates contain only approved hosted-auth placeholders", () => {
  const confirm = readFileSync(resolve(process.cwd(), "docs", "email-templates", "confirm-signup.html"), "utf8");
  const recovery = readFileSync(resolve(process.cwd(), "docs", "email-templates", "reset-password.html"), "utf8");
  const changed = readFileSync(resolve(process.cwd(), "docs", "email-templates", "password-changed.html"), "utf8");
  assert.match(confirm, /\{\{ \.ConfirmationURL \}\}/);
  assert.match(recovery, /\{\{ \.ConfirmationURL \}\}/);
  assert.match(changed, /\{\{ \.Email \}\}/);
  assert.doesNotMatch(confirm + recovery + changed, /service_role|RESEND_API_KEY|SUPABASE_SERVICE/i);
});

test("work-order email integration never triggers customer email for internal notes", () => {
  const source = readFileSync(resolve(process.cwd(), "src", "lib", "workOrders", "server.ts"), "utf8");
  assert.match(source, /sendCustomerVisibleMessageEmail/);
  assert.match(source, /customerVisible && linkedMessageId/);
  assert.match(source, /internal_note_added/);
  assert.doesNotMatch(source, /internal_note_added[\s\S]{0,160}sendCustomerVisibleMessageEmail/);
});

test("customer replies, revisions, additional uploads and legacy status changes use server lifecycle mail", () => {
  const messages = readFileSync(resolve(process.cwd(), "src", "app", "api", "requests", "[id]", "messages", "route.ts"), "utf8");
  const revision = readFileSync(resolve(process.cwd(), "src", "app", "api", "requests", "[id]", "revision", "route.ts"), "utf8");
  const additional = readFileSync(resolve(process.cwd(), "src", "app", "api", "requests", "[id]", "additional-file", "finalize", "route.ts"), "utf8");
  const adminPage = readFileSync(resolve(process.cwd(), "src", "app", "admin", "page.tsx"), "utf8");
  const statusRoute = readFileSync(resolve(process.cwd(), "src", "app", "api", "admin", "orders", "[id]", "status", "route.ts"), "utf8");
  assert.match(messages, /sendCustomerReplyAdminEmail/);
  assert.match(messages, /sendCustomerVisibleMessageEmail/);
  assert.match(revision, /sendRevisionRequestedAdminEmail/);
  assert.match(additional, /sendAdditionalFileUploadedNotifications/);
  assert.match(adminPage, /\/api\/admin\/orders\/\$\{orderId\}\/status/);
  assert.doesNotMatch(adminPage, /from\("orders"\)\.update\(\{ status: newStatus \}\)/);
  assert.match(statusRoute, /requireStaffPermission\(request, "orders\.manage"\)/);
  assert.match(statusRoute, /sendLegacyOrderStatusEmail/);
});

test("admin email control center exposes health, auth flows and lifecycle coverage", () => {
  const page = readFileSync(resolve(process.cwd(), "src", "app", "admin", "email", "page.tsx"), "utf8");
  const route = readFileSync(resolve(process.cwd(), "src", "app", "api", "admin", "email", "route.ts"), "utf8");
  assert.match(page, /Lifecycle coverage/);
  assert.match(page, /Authentication mail/);
  assert.match(page, /Dry-run \/ skipped/);
  assert.match(route, /eventSummary/);
  assert.match(route, /authFlows/);
  assert.match(route, /listLifecycleStatusCoverage/);
  assert.doesNotMatch(route, /RESEND_API_KEY\s*:/);
});

test("payment email integration keeps Stripe and bank logic intact without email PayPal templates", () => {
  const stripe = readFileSync(resolve(process.cwd(), "src", "lib", "stripeCreditPurchase.ts"), "utf8");
  const adminPayments = readFileSync(resolve(process.cwd(), "src", "app", "api", "admin", "payments", "route.ts"), "utf8");
  const emailTemplates = readFileSync(resolve(process.cwd(), "src", "lib", "email", "templates.ts"), "utf8");
  assert.match(stripe, /completeStripeCreditPurchase/);
  assert.match(stripe, /sendCreditsAddedEmail/);
  assert.match(adminPayments, /record_bank_payment/);
  assert.match(adminPayments, /sendCreditsAddedEmail/);
  assert.doesNotMatch(emailTemplates, /PayPal/);
});
