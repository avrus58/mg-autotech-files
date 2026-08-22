import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  emailJourneyMilestones,
  getEmailJourneyCoverage,
  runEmailJourneyCertification,
} from "../src/lib/email/certification";
import {
  summarizeEmailDeliveryHealth,
} from "../src/lib/email/deliveryReliability";

test("email journey certification validates every milestone without side effects", () => {
  const report = runEmailJourneyCertification(new Date("2026-08-05T12:00:00.000Z"));

  assert.equal(report.summary.status, "passed");
  assert.equal(report.summary.failedChecks, 0);
  assert.equal(report.summary.passedChecks, 4);
  assert.equal(report.summary.languages, 12);
  assert.equal(report.summary.milestones, 10);
  assert.equal(report.summary.lifecycleTransitions, 17);
  assert.equal(report.summary.renderedTemplates, 477);
  assert.deepEqual(report.sideEffects, {
    emailsSent: 0,
    databaseWrites: 0,
    customerRecordsRead: 0,
  });
  assert.equal(report.mode, "sample_render_only");
});

test("journey coverage includes the complete request lifecycle and known audiences", () => {
  const coverage = getEmailJourneyCoverage();
  assert.deepEqual(
    coverage.map((item) => item.id),
    emailJourneyMilestones.map((item) => item.id)
  );
  assert.deepEqual(
    coverage.find((item) => item.id === "verified_registration")?.eventTypes,
    [
      { eventType: "customer_welcome", audience: "customer" },
      { eventType: "customer_registered", audience: "admin" },
    ]
  );
  assert.deepEqual(
    coverage.find((item) => item.id === "request_created")?.eventTypes,
    [
      { eventType: "request_created", audience: "customer" },
      { eventType: "new_request_admin_notification", audience: "admin" },
    ]
  );
  assert.ok(coverage.some((item) => item.id === "customer_action_required"));
  assert.ok(coverage.some((item) => item.id === "customer_message"));
  assert.ok(coverage.some((item) => item.id === "delivery"));
  assert.equal(
    coverage.flatMap((item) => item.eventTypes).some((event) => event.audience === "unknown"),
    false
  );
});

test("delivery health resolves an earlier delay after a delivered event", () => {
  const health = summarizeEmailDeliveryHealth([
    {
      provider_event_id: "evt-delivered",
      provider_message_id: "message-1",
      provider_event_type: "email.delivered",
      delivery_status: "delivered",
      occurred_at: "2026-08-05T12:02:00.000Z",
    },
    {
      provider_event_id: "evt-delayed",
      provider_message_id: "message-1",
      provider_event_type: "email.delivery_delayed",
      delivery_status: "delayed",
      occurred_at: "2026-08-05T12:01:00.000Z",
    },
  ], 0);

  assert.equal(health.state, "healthy");
  assert.equal(health.activeIssueCount, 0);
  assert.equal(health.delayed, 0);
});

test("delivery health distinguishes monitoring, permanent failure and unavailable states", () => {
  const monitoring = summarizeEmailDeliveryHealth([
    {
      provider_event_id: "evt-delayed",
      provider_message_id: "message-1",
      provider_event_type: "email.delivery_delayed",
      delivery_status: "delayed",
      occurred_at: "2026-08-05T12:01:00.000Z",
    },
  ], 0);
  assert.equal(monitoring.state, "monitoring");
  assert.equal(monitoring.delayed, 1);

  const actionRequired = summarizeEmailDeliveryHealth([
    {
      provider_event_id: "evt-bounced",
      provider_message_id: "message-2",
      provider_event_type: "email.bounced",
      delivery_status: "bounced",
      occurred_at: "2026-08-05T12:03:00.000Z",
    },
    {
      provider_event_id: "evt-failed",
      provider_message_id: "message-3",
      provider_event_type: "email.failed",
      delivery_status: "failed",
      occurred_at: "2026-08-05T12:04:00.000Z",
    },
  ], 2);
  assert.equal(actionRequired.state, "action_required");
  assert.equal(actionRequired.activeIssueCount, 2);
  assert.equal(actionRequired.bounced, 1);
  assert.equal(actionRequired.failed, 1);
  assert.equal(actionRequired.permanentSuppressions, 2);

  const unavailable = summarizeEmailDeliveryHealth([], 3, false);
  assert.equal(unavailable.state, "unavailable");
  assert.equal(unavailable.permanentSuppressions, 3);
});

test("request-created idempotency no longer stores the recipient address", () => {
  const source = readFileSync(resolve(process.cwd(), "src", "lib", "email", "events.ts"), "utf8");
  assert.match(source, /idempotencyKey:\s*buildLifecycleIdempotencyKey\(\[\s*"request_created",\s*input\.requestId/);
  assert.doesNotMatch(source, /request_created:\$\{input\.requestId\}:\$\{recipient\}/);
});

test("admin certification UI and route remain protected and render-only", async () => {
  const page = readFileSync(resolve(process.cwd(), "src", "app", "admin", "email", "page.tsx"), "utf8");
  const route = readFileSync(resolve(process.cwd(), "src", "app", "api", "admin", "email", "route.ts"), "utf8");
  assert.match(page, /Certify journey/);
  assert.match(page, /no sends, writes or customer reads/);
  assert.match(page, /flex min-w-0 flex-wrap items-start justify-between gap-4/);
  assert.match(page, /sm:grid-cols-2 lg:grid-cols-3/);
  assert.match(page, /xl:grid-cols-\[minmax\(0,1fr\)_320px\]/);
  assert.match(route, /action === "certify"/);
  assert.match(route, /runEmailJourneyCertification\(\)/);
  assert.match(route, /requireStaffPermission\(request, "messages\.manage"\)/);

  const adminEmail = await import("../src/app/api/admin/email/route");
  const response = await adminEmail.POST(new Request("http://localhost/api/admin/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "certify" }),
  }));
  assert.equal(response.status, 401);
});

test("delivery incident summary is admin-only and customer routes do not import it", () => {
  const adminNotifications = readFileSync(resolve(process.cwd(), "src", "app", "api", "admin", "notifications", "route.ts"), "utf8");
  const customerApiFiles = [
    resolve(process.cwd(), "src", "app", "api", "requests", "[id]", "messages", "route.ts"),
    resolve(process.cwd(), "src", "app", "api", "requests", "[id]", "revision", "route.ts"),
  ];
  assert.match(adminNotifications, /requireStaffPermission\(request, "orders\.view"\)/);
  assert.match(adminNotifications, /listAdminEmailDeliveryIssues/);
  for (const file of customerApiFiles) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /listAdminEmailDeliveryIssues|email_suppressions|email_delivery_events/);
  }
});
