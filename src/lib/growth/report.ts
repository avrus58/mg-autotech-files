import { getEligibleGrowthReminderCandidates } from "@/lib/growth/reminders";
import { buildGrowthMetrics } from "@/lib/growth/metrics";
import { isGrowthMigrationMissing } from "@/lib/growth/server";
import {
  growthReportRanges,
  type GrowthActionItem,
  type GrowthCustomerSuccessReport,
  type GrowthReportRange,
} from "@/lib/growth/types";
import { getCachedSeoGrowthReport } from "@/lib/seoGrowth/service";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const rangeDays: Record<GrowthReportRange, number> = {
  "30d": 30,
  "90d": 90,
  "180d": 180,
  "365d": 365,
};

export function parseGrowthReportRange(value: string | null): GrowthReportRange {
  return growthReportRanges.includes(value as GrowthReportRange)
    ? value as GrowthReportRange
    : "30d";
}

function safeDate(value: string | null | undefined) {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : 0;
}

function warningMessage(label: string) {
  return `${label} is temporarily unavailable; the remaining verified metrics are still shown.`;
}

export async function buildGrowthCustomerSuccessReport(input?: {
  range?: GrowthReportRange;
  now?: Date;
}): Promise<GrowthCustomerSuccessReport> {
  const range = input?.range ?? "30d";
  const endAt = input?.now ?? new Date();
  const startAt = new Date(endAt.getTime() - rangeDays[range] * 86_400_000);
  const admin = getSupabaseAdmin();
  const warnings: string[] = [];

  const [profilesResult, ordersResult, revenueLedgerResult, paymentReviewResult] = await Promise.all([
    admin.from("profiles")
      .select("id,customer_id,role,country,account_status,created_at")
      .order("created_at", { ascending: false })
      .limit(25_000),
    admin.from("orders")
      .select("id,customer_id,status,service_type,vehicle_brand,credits_required,created_at")
      .order("created_at", { ascending: false })
      .limit(25_000),
    admin.from("credit_transactions")
      .select("id,user_id,type,amount_total,currency,created_at")
      .in("type", ["purchase", "refund"])
      .gte("created_at", startAt.toISOString())
      .lte("created_at", endAt.toISOString())
      .order("created_at", { ascending: false })
      .limit(10_000),
    admin.from("payment_records")
      .select("id,status,created_at")
      .eq("status", "requires_review")
      .gte("created_at", startAt.toISOString())
      .lte("created_at", endAt.toISOString())
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (profilesResult.error) warnings.push(warningMessage("Customer profiles"));
  if (ordersResult.error) warnings.push(warningMessage("Request history"));
  if (revenueLedgerResult.error) warnings.push(warningMessage("Revenue ledger"));
  if (paymentReviewResult.error) warnings.push(warningMessage("Payment review queue"));
  if ((profilesResult.data?.length ?? 0) === 25_000) warnings.push("Customer profile reporting reached its 25,000-row safety limit.");
  if ((ordersResult.data?.length ?? 0) === 25_000) warnings.push("Request reporting reached its 25,000-row safety limit.");
  if ((revenueLedgerResult.data?.length ?? 0) === 10_000) warnings.push("Revenue reporting reached its 10,000-row safety limit.");

  const emailResult = await admin.from("email_events")
    .select("event_type,recipient_user_id,status,delivery_status,created_at")
    .gte("created_at", startAt.toISOString())
    .lte("created_at", endAt.toISOString())
    .order("created_at", { ascending: false })
    .limit(20_000);
  let emailRows = (emailResult.data ?? []) as Array<Record<string, unknown>>;
  let emailError = emailResult.error;
  if (emailError?.code === "42703") {
    const legacyEmailResult = await admin.from("email_events")
      .select("event_type,recipient_user_id,status,created_at")
      .gte("created_at", startAt.toISOString())
      .lte("created_at", endAt.toISOString())
      .order("created_at", { ascending: false })
      .limit(20_000);
    emailRows = (legacyEmailResult.data ?? []) as Array<Record<string, unknown>>;
    emailError = legacyEmailResult.error;
  }
  if (emailError) warnings.push(warningMessage("Email delivery metrics"));

  let attributionRows: Array<Record<string, unknown>> = [];
  let journeyRows: Array<Record<string, unknown>> = [];
  let migrationReady = true;
  const [attributionResult, journeyResult] = await Promise.all([
    admin.from("growth_attribution_sessions")
      .select("user_id,first_source,first_medium,first_campaign,first_term,first_landing_path,first_country_code,first_seen_at")
      .gte("first_seen_at", startAt.toISOString())
      .lte("first_seen_at", endAt.toISOString())
      .order("first_seen_at", { ascending: false })
      .limit(20_000),
    admin.from("growth_journey_events")
      .select("event_type,user_id,order_id,occurred_at")
      .gte("occurred_at", startAt.toISOString())
      .lte("occurred_at", endAt.toISOString())
      .order("occurred_at", { ascending: false })
      .limit(20_000),
  ]);
  if (attributionResult.error || journeyResult.error) {
    migrationReady = false;
    const error = attributionResult.error || journeyResult.error;
    if (!isGrowthMigrationMissing(error)) warnings.push(warningMessage("Privacy-safe attribution"));
  } else {
    attributionRows = attributionResult.data ?? [];
    journeyRows = journeyResult.data ?? [];
  }

  const profiles = (profilesResult.data ?? []) as Array<Record<string, unknown>>;
  const orders = (ordersResult.data ?? []) as Array<Record<string, unknown>>;
  const revenueRows = (revenueLedgerResult.data ?? []) as Array<Record<string, unknown>>;
  const paymentReviews = (paymentReviewResult.data ?? []) as Array<Record<string, unknown>>;
  const metrics = buildGrowthMetrics({
    startAt,
    endAt,
    profiles: profiles as never,
    orders: orders as never,
    payments: revenueRows as never,
    emails: emailRows as never,
    attribution: attributionRows as never,
    journeyEvents: journeyRows as never,
  });

  let seo: Awaited<ReturnType<typeof getCachedSeoGrowthReport>> | null = null;
  try {
    seo = await getCachedSeoGrowthReport(range === "30d" ? "28d" : "90d");
  } catch {
    warnings.push(warningMessage("Aggregate Search Console reporting"));
  }

  const actions: GrowthActionItem[] = [];
  if (migrationReady) {
    try {
      const reminderCandidates = await getEligibleGrowthReminderCandidates({ now: endAt, limit: 20 });
      for (const candidate of reminderCandidates.slice(0, 8)) {
        actions.push({
          id: `reminder:${candidate.sourceEventId}`,
          type: "abandoned_request",
          priority: "high",
          title: "Consented unfinished request",
          detail: "The customer opted in, started a request over 24 hours ago and has not submitted a later order.",
          href: "/admin/growth",
          customerReference: candidate.customerReference,
          sourceEventId: candidate.sourceEventId,
          occurredAt: candidate.occurredAt,
          action: "send_reminder",
        });
      }
    } catch (error) {
      migrationReady = !isGrowthMigrationMissing(error);
      warnings.push(warningMessage("Reminder eligibility"));
    }
  }

  const orderCustomerIds = new Set(orders.map((row) => String(row.customer_id ?? "")).filter(Boolean));
  for (const profile of profiles
    .filter((row) => !["admin", "staff"].includes(String(row.role ?? "customer")))
    .filter((row) => !orderCustomerIds.has(String(row.id ?? "")))
    .filter((row) => endAt.getTime() - safeDate(String(row.created_at ?? "")) >= 7 * 86_400_000)
    .slice(0, 5)) {
    actions.push({
      id: `new-no-order:${String(profile.id)}`,
      type: "new_customer_no_request",
      priority: "medium",
      title: "New customer without a request",
      detail: "Review onboarding friction before contacting the customer through an approved support workflow.",
      href: "/admin#customers",
      customerReference: String(profile.customer_id || `Customer ${String(profile.id).slice(0, 8).toUpperCase()}`),
      sourceEventId: null,
      occurredAt: String(profile.created_at || "") || null,
      action: "review",
    });
  }

  for (const payment of paymentReviews.slice(0, 5)) {
    actions.push({
      id: `payment:${String(payment.id)}`,
      type: "payment_review",
      priority: "high",
      title: "Payment requires review",
      detail: "A payment record needs staff review before the commercial workflow can continue.",
      href: "/admin/payments",
      customerReference: null,
      sourceEventId: null,
      occurredAt: String(payment.created_at || "") || null,
      action: "review",
    });
  }

  const emailProblems = metrics.email.bounced + metrics.email.complained + metrics.email.failed;
  if (emailProblems > 0) {
    actions.push({
      id: "email-delivery-issues",
      type: "email_delivery_issue",
      priority: metrics.email.complained > 0 ? "high" : "medium",
      title: `${emailProblems} email delivery issue${emailProblems === 1 ? "" : "s"}`,
      detail: "Review bounced, complained and failed messages in the transactional email center.",
      href: "/admin/email",
      customerReference: null,
      sourceEventId: null,
      occurredAt: endAt.toISOString(),
      action: "review",
    });
  }

  for (const opportunity of (seo?.opportunities ?? []).slice(0, 3)) {
    actions.push({
      id: `seo:${opportunity.id}`,
      type: "seo_opportunity",
      priority: opportunity.priority,
      title: `SEO opportunity: ${opportunity.query}`,
      detail: opportunity.recommendation,
      href: "/admin/seo-performance",
      customerReference: null,
      sourceEventId: null,
      occurredAt: seo?.generatedAt ?? null,
      action: "review",
    });
  }

  if (metrics.retention.oneTimeCustomersInactive60d > 0) {
    actions.push({
      id: "retention-risk-one-time",
      type: "retention_risk",
      priority: "medium",
      title: `${metrics.retention.oneTimeCustomersInactive60d} one-time customer${metrics.retention.oneTimeCustomersInactive60d === 1 ? "" : "s"} inactive for 60+ days`,
      detail: "Review service mix and customer experience at aggregate level before planning any outreach.",
      href: "/admin/growth",
      customerReference: null,
      sourceEventId: null,
      occurredAt: endAt.toISOString(),
      action: "review",
    });
  }

  if (metrics.retention.repeatCustomersInactive90d > 0) {
    actions.push({
      id: "retention-risk-repeat",
      type: "retention_risk",
      priority: "medium",
      title: `${metrics.retention.repeatCustomersInactive90d} repeat customer${metrics.retention.repeatCustomersInactive90d === 1 ? "" : "s"} inactive for 90+ days`,
      detail: "Review the affected cohort and service history before planning any approved customer-success outreach.",
      href: "/admin/growth",
      customerReference: null,
      sourceEventId: null,
      occurredAt: endAt.toISOString(),
      action: "review",
    });
  }

  const searchQueryWindow = range === "30d" ? "28d" : "90d";
  const seoState = !seo
    ? "error"
    : seo.sources.searchConsole.state === "not_configured" && seo.sources.analytics.state === "not_configured"
      ? "not_configured"
      : seo.sources.searchConsole.state === "ready" || seo.sources.analytics.state === "ready"
        ? "ready"
        : "partial";

  return {
    generatedAt: endAt.toISOString(),
    range,
    period: { startAt: startAt.toISOString(), endAt: endAt.toISOString() },
    migrationReady,
    sources: {
      coreBusiness: profilesResult.error || ordersResult.error || revenueLedgerResult.error || paymentReviewResult.error
        ? "partial"
        : "ready",
      attribution: migrationReady ? "ready" : "migration_required",
      seo: seoState,
      emailDelivery: emailError ? "partial" : "ready",
    },
    ...metrics,
    searchQueries: (seo?.queries ?? []).slice(0, 20),
    searchQueryWindow,
    actions: actions
      .sort((left, right) => ({ high: 0, medium: 1, low: 2 })[left.priority] - ({ high: 0, medium: 1, low: 2 })[right.priority])
      .slice(0, 20),
    warnings: [...new Set([...(seo?.warnings ?? []), ...warnings])],
    limitations: [
      "Search Console queries are aggregate search-demand evidence and are never joined to individual customers.",
      "Attribution includes only visitors who granted optional analytics consent; direct and unattributed totals are therefore conservative.",
      "Revenue uses successful payment records and remains separated by currency; currencies are never combined into a misleading total.",
      "Reminder conversion means a request was submitted within seven days after a reminder; it does not prove causation.",
    ],
  };
}
