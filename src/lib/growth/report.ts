import { getEligibleGrowthReminderCandidates } from "@/lib/growth/reminders";
import {
  applyGrowthCustomerClassifications,
  buildFirstVerifiedRevenueJourney,
  buildRealCustomerSnapshot,
  normalizeGrowthCustomerClassificationRecord,
} from "@/lib/growth/customerClassification";
import { isGrowthCustomerClassificationMigrationMissing } from "@/lib/growth/customerClassificationServer";
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
  return `${label} could not be loaded completely and is excluded from this report; the remaining verified metrics are still shown.`;
}

type GrowthReportPage<T> = {
  data: T[] | null;
  error: unknown | null;
};

type GrowthReportRows<T> = {
  data: T[];
  error: unknown | null;
  truncated: boolean;
};

export type GrowthReportCursor = {
  orderValue: string;
  id: string;
};

const growthReportPageSize = 1_000;
const growthReportCursorValuePattern = /^[A-Za-z0-9_:+.-]{1,128}$/;

function growthReportCursor(
  row: Record<string, unknown>,
  orderColumn: string,
  idColumn = "id"
): GrowthReportCursor | null {
  const orderValue = String(row[orderColumn] ?? "");
  const id = String(row[idColumn] ?? "");
  if (
    !growthReportCursorValuePattern.test(orderValue) ||
    !growthReportCursorValuePattern.test(id)
  ) {
    return null;
  }
  return { orderValue, id };
}

function growthReportKeysetFilter(
  orderColumn: string,
  cursor: GrowthReportCursor,
  direction: "ascending" | "descending",
  idColumn = "id"
) {
  const comparison = direction === "ascending" ? "gt" : "lt";
  return `${orderColumn}.${comparison}.${cursor.orderValue},and(${orderColumn}.eq.${cursor.orderValue},${idColumn}.${comparison}.${cursor.id})`;
}

/**
 * Loads a deterministically ordered report query without trusting the API's
 * configured maximum row count. Every page resumes after the last composite
 * ordering key actually returned, so concurrent inserts at the head cannot
 * shift later pages and a server-side cap smaller than pageSize cannot skip
 * data. One sentinel row is read beyond the safety limit to distinguish an
 * exact-size result from a truncated result.
 */
export async function loadGrowthReportRows<T>(input: {
  safetyLimit: number;
  loadPage: (
    cursor: GrowthReportCursor | null,
    limit: number
  ) => PromiseLike<GrowthReportPage<T>>;
  getCursor: (row: T) => GrowthReportCursor | null;
  pageSize?: number;
}): Promise<GrowthReportRows<T>> {
  const safetyLimit = Math.max(1, Math.floor(input.safetyLimit));
  const pageSize = Math.max(
    1,
    Math.min(growthReportPageSize, Math.floor(input.pageSize ?? growthReportPageSize))
  );
  const rows: T[] = [];
  let cursor: GrowthReportCursor | null = null;

  while (rows.length <= safetyLimit) {
    const sentinelRemaining = safetyLimit + 1 - rows.length;
    const requestedRows = Math.min(pageSize, sentinelRemaining);
    const page = await input.loadPage(cursor, requestedRows);
    if (page.error) {
      return {
        // A partial page set is not a business metric. Discard every row from
        // this source so a transient later-page failure cannot look like a real
        // drop in registrations, requests, revenue or exclusions.
        data: [],
        error: page.error,
        truncated: false,
      };
    }

    const pageRows = page.data ?? [];
    if (pageRows.length === 0) {
      return { data: rows, error: null, truncated: false };
    }
    rows.push(...pageRows.slice(0, sentinelRemaining));
    if (rows.length > safetyLimit || pageRows.length > sentinelRemaining) {
      return {
        data: rows.slice(0, safetyLimit),
        error: null,
        truncated: true,
      };
    }

    const nextCursor = input.getCursor(pageRows[pageRows.length - 1]);
    if (
      !nextCursor ||
      (cursor &&
        nextCursor.orderValue === cursor.orderValue &&
        nextCursor.id === cursor.id)
    ) {
      return {
        data: [],
        error: new Error("Growth report keyset cursor did not advance."),
        truncated: false,
      };
    }
    cursor = nextCursor;
  }

  return {
    data: rows.slice(0, safetyLimit),
    error: null,
    truncated: rows.length > safetyLimit,
  };
}

function growthReportErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  return String((error as { code?: unknown }).code ?? "");
}

export async function buildGrowthCustomerSuccessReport(input?: {
  range?: GrowthReportRange;
  now?: Date;
}): Promise<GrowthCustomerSuccessReport> {
  const range = input?.range ?? "30d";
  const endAt = input?.now ?? new Date();
  const startAt = new Date(endAt.getTime() - rangeDays[range] * 86_400_000);
  const endAtIso = endAt.toISOString();
  const startAtIso = startAt.toISOString();
  const admin = getSupabaseAdmin();
  const warnings: string[] = [];

  const [profilesResult, ordersResult, revenueLedgerResult, paymentReviewResult, classificationResult] = await Promise.all([
    loadGrowthReportRows<Record<string, unknown>>({
      safetyLimit: 25_000,
      loadPage: (cursor, limit) => {
        let query = admin.from("profiles")
          .select("id,customer_id,role,country,account_status,created_at")
          .eq("role", "customer")
          .lte("created_at", endAtIso);
        if (cursor) {
          query = query.or(
            growthReportKeysetFilter("created_at", cursor, "descending")
          );
        }
        return query
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(limit);
      },
      getCursor: (row) => growthReportCursor(row, "created_at"),
    }),
    loadGrowthReportRows<Record<string, unknown>>({
      safetyLimit: 25_000,
      loadPage: (cursor, limit) => {
        let query = admin.from("orders")
          .select("id,customer_id,status,service_type,vehicle_brand,credits_required,created_at")
          .lte("created_at", endAtIso);
        if (cursor) {
          query = query.or(
            growthReportKeysetFilter("created_at", cursor, "descending")
          );
        }
        return query
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(limit);
      },
      getCursor: (row) => growthReportCursor(row, "created_at"),
    }),
    loadGrowthReportRows<Record<string, unknown>>({
      safetyLimit: 10_000,
      loadPage: (cursor, limit) => {
        let query = admin.from("credit_transactions")
          .select("id,user_id,type,amount_total,currency,created_at")
          .in("type", ["purchase", "refund"])
          .gte("created_at", startAtIso)
          .lte("created_at", endAtIso);
        if (cursor) {
          query = query.or(
            growthReportKeysetFilter("created_at", cursor, "descending")
          );
        }
        return query
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(limit);
      },
      getCursor: (row) => growthReportCursor(row, "created_at"),
    }),
    loadGrowthReportRows<Record<string, unknown>>({
      safetyLimit: 100,
      loadPage: (cursor, limit) => {
        let query = admin.from("payment_records")
          .select("id,user_id,status,created_at")
          .eq("status", "requires_review")
          .gte("created_at", startAtIso)
          .lte("created_at", endAtIso);
        if (cursor) {
          query = query.or(
            growthReportKeysetFilter("created_at", cursor, "descending")
          );
        }
        return query
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(limit);
      },
      getCursor: (row) => growthReportCursor(row, "created_at"),
    }),
    loadGrowthReportRows<Record<string, unknown>>({
      safetyLimit: 25_000,
      loadPage: (cursor, limit) => {
        let query = admin.from("growth_customer_classifications")
          .select("user_id,classification,analytics_excluded,reason,verified_at");
        if (cursor) query = query.gt("user_id", cursor.orderValue);
        return query.order("user_id", { ascending: true }).limit(limit);
      },
      getCursor: (row) => growthReportCursor(row, "user_id", "user_id"),
    }),
  ]);

  if (profilesResult.error) warnings.push(warningMessage("Customer profiles"));
  if (ordersResult.error) warnings.push(warningMessage("Request history"));
  if (revenueLedgerResult.error) warnings.push(warningMessage("Revenue ledger"));
  if (paymentReviewResult.error) warnings.push(warningMessage("Payment review queue"));
  const classificationMissing = isGrowthCustomerClassificationMigrationMissing(classificationResult.error);
  const classificationReady = !classificationResult.error && !classificationResult.truncated;
  if (classificationMissing) {
    warnings.push("Customer classification migration is not applied. No account is auto-classified; current totals can still include unreviewed internal/test accounts.");
  } else if (classificationResult.error) {
    warnings.push(warningMessage("Customer classification"));
  }
  if (profilesResult.truncated) warnings.push("Customer profile reporting reached its 25,000-row safety limit.");
  if (ordersResult.truncated) warnings.push("Request reporting reached its 25,000-row safety limit.");
  if (revenueLedgerResult.truncated) warnings.push("Revenue reporting reached its 10,000-row safety limit.");
  if (paymentReviewResult.truncated) warnings.push("Payment review reporting reached its 100-row safety limit.");
  if (classificationResult.truncated) warnings.push("Customer classification reporting reached its 25,000-row safety limit.");

  const loadEmailRows = (select: string) =>
    loadGrowthReportRows<Record<string, unknown>>({
      safetyLimit: 20_000,
      loadPage: (cursor, limit) => {
        let query = admin.from("email_events")
          .select(select)
          .gte("created_at", startAtIso)
          .lte("created_at", endAtIso);
        if (cursor) {
          query = query.or(
            growthReportKeysetFilter("created_at", cursor, "descending")
          );
        }
        return query
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(limit) as unknown as PromiseLike<GrowthReportPage<Record<string, unknown>>>;
      },
      getCursor: (row) => growthReportCursor(row, "created_at"),
    });
  let emailResult = await loadEmailRows(
    "id,event_type,recipient_user_id,status,delivery_status,created_at"
  );
  let emailRows = emailResult.data;
  let emailError = emailResult.error;
  if (growthReportErrorCode(emailError) === "42703") {
    const legacyEmailResult = await loadEmailRows(
      "id,event_type,recipient_user_id,status,created_at"
    );
    emailResult = legacyEmailResult;
    emailRows = legacyEmailResult.data;
    emailError = legacyEmailResult.error;
  }
  if (emailError) warnings.push(warningMessage("Email delivery metrics"));
  if (!emailError && emailResult.truncated) {
    warnings.push("Email delivery reporting reached its 20,000-row safety limit.");
  }

  let attributionRows: Array<Record<string, unknown>> = [];
  let journeyRows: Array<Record<string, unknown>> = [];
  let migrationReady = true;
  let attributionSource: GrowthCustomerSuccessReport["sources"]["attribution"] = "ready";
  const [attributionResult, journeyResult] = await Promise.all([
    loadGrowthReportRows<Record<string, unknown>>({
      safetyLimit: 25_000,
      loadPage: (cursor, limit) => {
        let query = admin.from("growth_attribution_sessions")
          .select("id,user_id,locale,first_source,first_medium,first_campaign,first_term,first_landing_path,first_country_code,first_seen_at")
          .gte("first_seen_at", startAtIso)
          .lte("first_seen_at", endAtIso);
        if (cursor) {
          query = query.or(
            growthReportKeysetFilter("first_seen_at", cursor, "ascending")
          );
        }
        return query
          .order("first_seen_at", { ascending: true })
          .order("id", { ascending: true })
          .limit(limit);
      },
      getCursor: (row) => growthReportCursor(row, "first_seen_at"),
    }),
    loadGrowthReportRows<Record<string, unknown>>({
      safetyLimit: 20_000,
      loadPage: (cursor, limit) => {
        let query = admin.from("growth_journey_events")
          .select("id,event_type,user_id,order_id,occurred_at")
          .gte("occurred_at", startAtIso)
          .lte("occurred_at", endAtIso);
        if (cursor) {
          query = query.or(
            growthReportKeysetFilter("occurred_at", cursor, "descending")
          );
        }
        return query
          .order("occurred_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(limit);
      },
      getCursor: (row) => growthReportCursor(row, "occurred_at"),
    }),
  ]);
  if (attributionResult.error || journeyResult.error) {
    migrationReady = false;
    const error = attributionResult.error || journeyResult.error;
    if (isGrowthMigrationMissing(error)) {
      attributionSource = "migration_required";
    } else {
      attributionSource = "error";
      warnings.push(warningMessage("Privacy-safe attribution"));
    }
  } else {
    attributionRows = attributionResult.data ?? [];
    journeyRows = journeyResult.data ?? [];
    if (attributionResult.truncated) {
      warnings.push("Attribution reporting reached its 25,000-row safety limit.");
      attributionSource = "error";
    }
    if (journeyResult.truncated) {
      warnings.push("Journey reporting reached its 20,000-row safety limit.");
      attributionSource = "error";
    }
  }

  const rawProfiles = (profilesResult.data ?? []) as Array<Record<string, unknown>>;
  const rawOrders = (ordersResult.data ?? []) as Array<Record<string, unknown>>;
  const rawRevenueRows = (revenueLedgerResult.data ?? []) as Array<Record<string, unknown>>;
  const classifications = (classificationResult.data ?? [])
    .map((row) => normalizeGrowthCustomerClassificationRecord(row))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  const excludedCustomerIds = new Set(
    classifications.filter((row) => row.analyticsExcluded).map((row) => row.userId)
  );
  const rawMetricInput = {
    startAt,
    endAt,
    profiles: rawProfiles as never,
    orders: rawOrders as never,
    payments: rawRevenueRows as never,
    emails: emailRows as never,
    attribution: attributionRows as never,
    journeyEvents: journeyRows as never,
  };
  const metricInput = applyGrowthCustomerClassifications(rawMetricInput, classifications);
  const profiles = metricInput.profiles as unknown as Array<Record<string, unknown>>;
  const orders = metricInput.orders as unknown as Array<Record<string, unknown>>;
  const metrics = buildGrowthMetrics(metricInput);
  const realGrowth = buildRealCustomerSnapshot({
    metricInput: rawMetricInput,
    classifications,
    classificationReady,
  });
  const paymentReviews = ((paymentReviewResult.data ?? []) as Array<Record<string, unknown>>)
    .filter((row) => !row.user_id || !excludedCustomerIds.has(String(row.user_id)));

  const verifiedRealIds = classifications
    .filter((row) => row.classification === "real_customer" && !row.analyticsExcluded)
    .map((row) => row.userId);
  let firstVerifiedPayment: Record<string, unknown> | null = null;
  let firstRevenueAttributionRows = attributionRows;
  if (verifiedRealIds.length) {
    const firstPaymentResult = await admin.from("credit_transactions")
      .select("id,user_id,type,amount_total,currency,created_at")
      .eq("type", "purchase")
      .gt("amount_total", 0)
      .in("user_id", verifiedRealIds)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (firstPaymentResult.error) warnings.push(warningMessage("First verified revenue journey"));
    firstVerifiedPayment = firstPaymentResult.data as Record<string, unknown> | null;
    if (firstVerifiedPayment?.user_id && migrationReady) {
      const firstTouchResult = await admin.from("growth_attribution_sessions")
        .select("user_id,first_source,first_medium,first_campaign,first_term,first_landing_path,first_country_code,first_seen_at")
        .eq("user_id", String(firstVerifiedPayment.user_id))
        .order("first_seen_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (firstTouchResult.error) warnings.push(warningMessage("First verified revenue attribution"));
      if (firstTouchResult.data) firstRevenueAttributionRows = [firstTouchResult.data, ...attributionRows];
    }
  }
  const firstRevenueJourney = buildFirstVerifiedRevenueJourney({
    profiles: rawMetricInput.profiles,
    orders: rawMetricInput.orders,
    firstPayment: firstVerifiedPayment as never,
    attribution: firstRevenueAttributionRows as never,
    classifications,
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
      if (isGrowthMigrationMissing(error)) {
        migrationReady = false;
        attributionSource = "migration_required";
      }
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
      coreBusiness: profilesResult.error || ordersResult.error || revenueLedgerResult.error || paymentReviewResult.error ||
        profilesResult.truncated || ordersResult.truncated || revenueLedgerResult.truncated || paymentReviewResult.truncated
        ? "partial"
        : "ready",
      attribution: attributionSource,
      customerClassification: classificationReady
        ? "ready"
        : classificationMissing
          ? "migration_required"
          : "error",
      seo: seoState,
      emailDelivery: emailError ? "partial" : "ready",
    },
    realGrowth,
    firstRevenueJourney,
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
      "Internal/test and staff-operated customer accounts are excluded only after an authorized administrator classifies them; no account is classified from email, filename, payment amount or behavior.",
      "The first revenue journey uses only an explicitly verified real customer and consented attribution. Missing acquisition history is shown as not captured and is never inferred.",
    ],
  };
}
