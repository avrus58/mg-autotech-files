import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getTransactionalEmailProviderStatus, sendTransactionalEmail } from "@/lib/email/service";
import {
  listTransactionalEmailTemplates,
  renderTransactionalEmailTemplate,
} from "@/lib/email/templates";
import { getSiteUrl } from "@/lib/email/render";
import { listLifecycleStatusCoverage } from "@/lib/email/lifecycle";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getSupabaseAuthTemplateDefinition,
  renderSupabaseAuthTemplatePreview,
  supabaseAuthTemplateCatalog,
} from "@/lib/email/supabaseAuthTemplates";
import {
  transactionalEmailEventTypes,
  type TransactionalEmailLanguage,
} from "@/lib/email/types";
import { supportedTransactionalEmailLanguages } from "@/lib/email/language";
import {
  getEmailJourneyCoverage,
  runEmailJourneyCertification,
} from "@/lib/email/certification";
import { summarizeEmailDeliveryHealth } from "@/lib/email/deliveryReliability";

const transactionalEmailLanguageSchema = z.custom<TransactionalEmailLanguage>(
  (value) => supportedTransactionalEmailLanguages.includes(value as TransactionalEmailLanguage),
  { message: "Unsupported email language." }
);

const testSchema = z.object({
  action: z.enum(["send_test", "preview", "certify"]).optional().default("send_test"),
  source: z.enum(["transactional", "supabase_auth"]).optional().default("transactional"),
  eventType: z.string().trim().min(1).max(100).optional().default("admin_email_test"),
  language: transactionalEmailLanguageSchema.optional().default("en"),
  testId: z.string().uuid().optional(),
}).strict();

const summaryStatuses = [
  "sent",
  "delivered",
  "delayed",
  "bounced",
  "complained",
  "failed",
  "suppressed",
  "skipped",
  "pending",
] as const;

function emptyEventSummary() {
  return Object.fromEntries(summaryStatuses.map((status) => [status, 0])) as Record<
    (typeof summaryStatuses)[number],
    number
  >;
}

function sampleEmailContext() {
  return {
    requestId: "32007019-ac4b-48cb-a648-668ffa5e4d69",
    requestNumber: "32007019",
    customerId: "MGA-10011",
    customerName: "Sample Customer",
    customerEmail: "customer@example.com",
    vehicleSummary: "Mercedes-Benz E / W214 / E 220 d",
    serviceSummary: "Stage 1",
    dashboardUrl: `${getSiteUrl()}/dashboard`,
    adminUrl: `${getSiteUrl()}/admin/email`,
    messagePreview: "A customer-safe sample message for template preview.",
    statusLabel: "In progress",
    actionRequired: "Review the request in your customer dashboard.",
    fileName: "sample-original.bin",
    credits: 10,
    amountLabel: "36.00 EUR",
    paymentReference: "MGA-10011",
    recoveryUrl: `${getSiteUrl()}/reset-password?preview=true`,
  };
}

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "orders.view");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let recentEvents: Array<Record<string, unknown>> = [];
  let deliveryEvents: Array<Record<string, unknown>> = [];
  let activeSuppressions: Array<Record<string, unknown>> = [];
  let migrationReady = true;
  let deliveryTrackingReady = true;
  try {
    const admin = getSupabaseAdmin();
    const enhancedResult = await admin
      .from("email_events")
      .select("id,event_type,recipient_email,status,delivery_status,provider,provider_message_id,error_message,created_at,sent_at,last_delivery_event_at,delivered_at,delayed_at,bounced_at,complained_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (enhancedResult.error?.code === "42703") {
      deliveryTrackingReady = false;
      const legacyResult = await admin
        .from("email_events")
        .select("id,event_type,recipient_email,status,provider,provider_message_id,error_message,created_at,sent_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (legacyResult.error) {
        migrationReady = !["42P01", "42703"].includes(legacyResult.error.code || "");
      } else {
        recentEvents = legacyResult.data ?? [];
      }
    } else if (enhancedResult.error) {
      migrationReady = !["42P01", "42703"].includes(enhancedResult.error.code || "");
    } else {
      recentEvents = enhancedResult.data ?? [];
    }

    const deliveryResult = await admin
      .from("email_delivery_events")
      .select("provider_event_id,email_event_id,provider_message_id,provider_event_type,delivery_status,recipient_email,occurred_at,reason_code,reason_message")
      .order("occurred_at", { ascending: false })
      .limit(100);
    if (deliveryResult.error) {
      deliveryTrackingReady = false;
    } else {
      const seen = new Set<string>();
      deliveryEvents = (deliveryResult.data ?? []).filter((event) => {
        const messageId = String(event.provider_message_id || "");
        if (!messageId || seen.has(messageId)) return false;
        seen.add(messageId);
        return true;
      }).slice(0, 50);
    }

    const suppressionResult = await admin
      .from("email_suppressions")
      .select("recipient_email,reason,last_event_at,created_at")
      .eq("active", true)
      .order("last_event_at", { ascending: false })
      .limit(50);
    if (suppressionResult.error) {
      deliveryTrackingReady = false;
    } else {
      activeSuppressions = suppressionResult.data ?? [];
    }
  } catch {
    migrationReady = false;
    deliveryTrackingReady = false;
  }

  const eventSummary = emptyEventSummary();
  const providerMessageIds = new Set(deliveryEvents.map((event) => String(event.provider_message_id || "")));
  for (const event of deliveryEvents) {
    const status = String(event.delivery_status || "pending") as keyof typeof eventSummary;
    if (status in eventSummary) eventSummary[status] += 1;
  }
  for (const event of recentEvents) {
    if (event.provider_message_id && providerMessageIds.has(String(event.provider_message_id))) continue;
    const status = String(event.delivery_status || event.status || "pending") as keyof typeof eventSummary;
    if (status in eventSummary) eventSummary[status] += 1;
  }

  const deliveryHealth = summarizeEmailDeliveryHealth(
    deliveryEvents,
    activeSuppressions.length,
    deliveryTrackingReady
  );

  return NextResponse.json({
    provider: getTransactionalEmailProviderStatus(),
    templates: listTransactionalEmailTemplates(),
    authTemplates: supabaseAuthTemplateCatalog.map(({ key, label, category, supabaseKey }) => ({
      key,
      label,
      category,
      supabaseKey,
    })),
    recentEvents,
    deliveryEvents,
    activeSuppressions,
    eventSummary,
    authFlows: supabaseAuthTemplateCatalog.map(({ key, label, category }) => ({
      key,
      label,
      managedBy: "Supabase Auth",
      category,
      redirectPath: key === "confirm_signup"
        ? "/auth/callback?next=/dashboard"
        : key === "password_recovery"
          ? "/auth/callback?next=/reset-password"
          : null,
    })),
    lifecycleCoverage: listLifecycleStatusCoverage(),
    journeyCoverage: getEmailJourneyCoverage(),
    deliveryHealth,
    migrationReady,
    deliveryTrackingReady,
  });
}

export async function POST(request: Request) {
  const auth = await requireStaffPermission(request, "orders.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = testSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid email test payload." }, { status: 400 });

  if (parsed.data.action === "certify") {
    return NextResponse.json({ certification: runEmailJourneyCertification() });
  }

  if (parsed.data.action === "preview") {
    if (parsed.data.source === "supabase_auth") {
      if (!getSupabaseAuthTemplateDefinition(parsed.data.eventType)) {
        return NextResponse.json({ error: "Unknown Supabase Auth template." }, { status: 400 });
      }
      const preview = renderSupabaseAuthTemplatePreview(
        parsed.data.eventType,
        parsed.data.language
      );
      return NextResponse.json({ preview });
    }

    if (!transactionalEmailEventTypes.some((eventType) => eventType === parsed.data.eventType)) {
      return NextResponse.json({ error: "Unknown transactional email template." }, { status: 400 });
    }
    return NextResponse.json({
      preview: renderTransactionalEmailTemplate(
        parsed.data.eventType as (typeof transactionalEmailEventTypes)[number],
        sampleEmailContext(),
        parsed.data.language
      ),
    });
  }

  const recipient = auth.user.email;
  if (!recipient) return NextResponse.json({ error: "Admin user has no email address." }, { status: 400 });

  const result = await sendTransactionalEmail({
    eventType: "admin_email_test",
    to: recipient,
    language: parsed.data.language,
    context: {
      customerEmail: recipient,
      adminUrl: `${getSiteUrl()}/admin/email`,
    },
    idempotencyKey: `admin_email_test:${auth.user.id}:${parsed.data.testId || new Date().toISOString().slice(0, 10)}`,
    recipientUserId: auth.user.id,
    metadata: { source: "admin_email_test" },
  });

  return NextResponse.json({ result });
}
