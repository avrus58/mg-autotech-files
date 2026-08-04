import { buildGrowthMetrics, buildRevenueByCurrency } from "@/lib/growth/metrics";
import type {
  GrowthAttributionRow,
  GrowthEmailRow,
  GrowthJourneyRow,
  GrowthMetricInput,
  GrowthOrderRow,
  GrowthPaymentRow,
  GrowthProfileRow,
} from "@/lib/growth/metrics";
import {
  growthCustomerClassifications,
  type GrowthCustomerClassification,
  type GrowthCustomerClassificationRecord,
  type GrowthFirstRevenueJourney,
  type GrowthRealCustomerSnapshot,
} from "@/lib/growth/types";

const excludedClassifications = new Set<GrowthCustomerClassification>([
  "internal_test",
  "staff_operated",
]);

export function isGrowthCustomerClassification(value: unknown): value is GrowthCustomerClassification {
  return growthCustomerClassifications.includes(value as GrowthCustomerClassification);
}

export function classificationExcludesAnalytics(classification: GrowthCustomerClassification) {
  return excludedClassifications.has(classification);
}

export function normalizeGrowthCustomerClassificationRecord(input: {
  user_id?: unknown;
  classification?: unknown;
  analytics_excluded?: unknown;
  reason?: unknown;
  verified_at?: unknown;
}): GrowthCustomerClassificationRecord | null {
  const userId = typeof input.user_id === "string" ? input.user_id : "";
  if (!userId || !isGrowthCustomerClassification(input.classification)) return null;
  const expectedExcluded = classificationExcludesAnalytics(input.classification);
  if (input.analytics_excluded !== expectedExcluded) return null;
  return {
    userId,
    classification: input.classification,
    analyticsExcluded: expectedExcluded,
    reason: typeof input.reason === "string" && input.reason.trim()
      ? input.reason.trim()
      : null,
    verifiedAt: typeof input.verified_at === "string" ? input.verified_at : null,
  };
}

export function applyGrowthCustomerClassifications(
  input: GrowthMetricInput,
  classifications: GrowthCustomerClassificationRecord[]
): GrowthMetricInput {
  const excluded = new Set(
    classifications.filter((row) => row.analyticsExcluded).map((row) => row.userId)
  );
  const keepUser = (userId: string | null | undefined) => !userId || !excluded.has(userId);
  return {
    ...input,
    profiles: input.profiles.filter((row) => keepUser(row.id)),
    orders: input.orders.filter((row) => keepUser(row.customer_id)),
    payments: input.payments.filter((row) => keepUser(row.user_id)),
    emails: input.emails.filter((row) => keepUser(row.recipient_user_id)),
    attribution: input.attribution.filter((row) => keepUser(row.user_id)),
    journeyEvents: input.journeyEvents.filter((row) => keepUser(row.user_id)),
  };
}

function timestamp(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function hoursBetween(start: string | null | undefined, end: string | null | undefined) {
  const startAt = timestamp(start);
  const endAt = timestamp(end);
  return startAt !== null && endAt !== null && endAt >= startAt
    ? (endAt - startAt) / 3_600_000
    : null;
}

export function buildRealCustomerSnapshot(input: {
  metricInput: GrowthMetricInput;
  classifications: GrowthCustomerClassificationRecord[];
  classificationReady: boolean;
}): GrowthRealCustomerSnapshot {
  const customerProfiles = input.metricInput.profiles.filter(
    (row) => !["admin", "staff"].includes(row.role ?? "customer")
  );
  const realIds = new Set(input.classifications
    .filter((row) => row.classification === "real_customer" && !row.analyticsExcluded)
    .map((row) => row.userId));
  const excluded = input.classifications.filter((row) => row.analyticsExcluded).length;
  const classificationByUser = new Map(input.classifications.map((row) => [row.userId, row]));
  const realInput: GrowthMetricInput = {
    ...input.metricInput,
    profiles: input.metricInput.profiles.filter((row) => realIds.has(row.id)),
    orders: input.metricInput.orders.filter((row) => Boolean(row.customer_id && realIds.has(row.customer_id))),
    payments: input.metricInput.payments.filter((row) => Boolean(row.user_id && realIds.has(row.user_id))),
    emails: input.metricInput.emails.filter((row) => Boolean(row.recipient_user_id && realIds.has(row.recipient_user_id))),
    attribution: input.metricInput.attribution.filter((row) => Boolean(row.user_id && realIds.has(row.user_id))),
    journeyEvents: input.metricInput.journeyEvents.filter((row) => Boolean(row.user_id && realIds.has(row.user_id))),
  };
  const metrics = buildGrowthMetrics(realInput);

  return {
    classificationReady: input.classificationReady,
    totalCustomerAccounts: customerProfiles.length,
    verifiedRealCustomers: realIds.size,
    unreviewedCustomers: customerProfiles.filter((row) => {
      const classification = classificationByUser.get(row.id)?.classification;
      return !classification || classification === "unreviewed";
    }).length,
    excludedInternalAccounts: excluded,
    registrations: metrics.funnel.registrations,
    customersWithRequests: metrics.funnel.customersWithRequests,
    repeatCustomers: metrics.retention.repeatCustomers,
    orders: metrics.funnel.orders,
    completedOrders: metrics.funnel.completedOrders,
    payingCustomers: metrics.funnel.payingCustomers,
    revenue: metrics.revenue,
  };
}

const emptyFirstRevenueJourney: GrowthFirstRevenueJourney = {
  status: "no_verified_payment",
  customerReference: null,
  registeredAt: null,
  firstRequestAt: null,
  firstPaymentAt: null,
  hoursRegistrationToRequest: null,
  hoursRegistrationToPayment: null,
  paymentAmountMinor: null,
  paymentCurrency: null,
  source: null,
  medium: null,
  campaign: null,
  landingPath: null,
  countryCode: null,
  attributionStatus: "not_captured",
};

export function buildFirstVerifiedRevenueJourney(input: {
  profiles: GrowthProfileRow[];
  orders: GrowthOrderRow[];
  firstPayment: GrowthPaymentRow | null;
  attribution: GrowthAttributionRow[];
  classifications: GrowthCustomerClassificationRecord[];
}): GrowthFirstRevenueJourney {
  const payment = input.firstPayment;
  if (
    !payment?.user_id ||
    payment.type !== "purchase" ||
    !Number.isFinite(payment.amount_total ?? NaN) ||
    Number(payment.amount_total) <= 0
  ) return emptyFirstRevenueJourney;
  const classification = input.classifications.find((row) => row.userId === payment.user_id);
  if (classification?.classification !== "real_customer" || classification.analyticsExcluded) {
    return emptyFirstRevenueJourney;
  }
  const profile = input.profiles.find((row) => row.id === payment.user_id);
  if (!profile) return emptyFirstRevenueJourney;
  const firstOrder = input.orders
    .filter((row) => row.customer_id === payment.user_id && timestamp(row.created_at) !== null)
    .sort((left, right) => (timestamp(left.created_at) ?? 0) - (timestamp(right.created_at) ?? 0))[0];
  const firstTouch = input.attribution
    .filter((row) => row.user_id === payment.user_id && timestamp(row.first_seen_at) !== null)
    .sort((left, right) => (timestamp(left.first_seen_at) ?? 0) - (timestamp(right.first_seen_at) ?? 0))[0];

  return {
    status: "available",
    customerReference: profile.customer_id || `Customer ${profile.id.slice(0, 8).toUpperCase()}`,
    registeredAt: profile.created_at,
    firstRequestAt: firstOrder?.created_at ?? null,
    firstPaymentAt: payment.created_at,
    hoursRegistrationToRequest: hoursBetween(profile.created_at, firstOrder?.created_at),
    hoursRegistrationToPayment: hoursBetween(profile.created_at, payment.created_at),
    paymentAmountMinor: Number.isFinite(payment.amount_total ?? NaN) ? Number(payment.amount_total) : null,
    paymentCurrency: payment.currency?.toUpperCase() ?? null,
    source: firstTouch?.first_source ?? null,
    medium: firstTouch?.first_medium ?? null,
    campaign: firstTouch?.first_campaign ?? null,
    landingPath: firstTouch?.first_landing_path ?? null,
    countryCode: firstTouch?.first_country_code ?? null,
    attributionStatus: firstTouch ? "consented_first_touch" : "not_captured",
  };
}

export function buildCustomerRevenue(rows: GrowthPaymentRow[]) {
  return buildRevenueByCurrency(rows.filter((row) => row.type === "purchase" || row.type === "refund"));
}

export type GrowthClassificationDataRows = {
  profiles: GrowthProfileRow[];
  orders: GrowthOrderRow[];
  payments: GrowthPaymentRow[];
  emails: GrowthEmailRow[];
  attribution: GrowthAttributionRow[];
  journeyEvents: GrowthJourneyRow[];
};
