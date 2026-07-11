import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";
import { renderTransactionalEmailTemplate } from "../src/lib/email/templates";
import { sendTransactionalEmail } from "../src/lib/email/service";
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
  });
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

test("customer-visible message email includes only visible safe message content", () => {
  const rows = filterCustomerVisibleRequestMessages([
    { id: "visible", request_id: "r1", sender_id: "admin", sender_role: "admin", message: "Bitte laden Sie eine neue ORI-Datei hoch.", created_at: "2026-07-11T00:00:00.000Z", visibility_status: "visible" },
    { id: "hidden", request_id: "r1", sender_id: "admin", sender_role: "admin", message: "Hidden smoke test note", created_at: "2026-07-11T00:01:00.000Z", visibility_status: "hidden" },
  ]);
  const rendered = renderTransactionalEmailTemplate("customer_visible_message_added", {
    requestId: "r1",
    messagePreview: rows[0].message,
    vehicleSummary: "BMW 530d",
  });
  const serialized = JSON.stringify(rendered);
  assert.equal(rows.length, 1);
  assert.match(serialized, /Bitte laden Sie/);
  assert.equal(serialized.includes("Hidden smoke test note"), false);
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
  });
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
  assert.equal((await adminEmail.GET(new Request("http://localhost/api/admin/email"))).status, 401);
  assert.equal((await adminEmail.POST(new Request("http://localhost/api/admin/email", { method: "POST", body: "{}" }))).status, 401);
  assert.equal((await bankEmail.POST(new Request("http://localhost/api/email/bank-transfer", { method: "POST", body: "{}" }))).status, 401);
});

test("work-order email integration never triggers customer email for internal notes", () => {
  const source = readFileSync(resolve(process.cwd(), "src", "lib", "workOrders", "server.ts"), "utf8");
  assert.match(source, /sendCustomerVisibleMessageEmail/);
  assert.match(source, /customerVisible && linkedMessageId/);
  assert.match(source, /internal_note_added/);
  assert.doesNotMatch(source, /internal_note_added[\s\S]{0,160}sendCustomerVisibleMessageEmail/);
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
