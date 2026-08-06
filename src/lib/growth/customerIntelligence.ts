import { buildRevenueByCurrency, type GrowthPaymentRow } from "@/lib/growth/metrics";
import type {
  GrowthCustomerClassification,
  GrowthRevenueCurrency,
} from "@/lib/growth/types";

export type CustomerIntelligenceSourceState = "ready" | "partial" | "unavailable";

export type CustomerIntelligenceProfileInput = {
  id: string;
  customer_id: string | null;
  email: string | null;
  full_name: string | null;
  credit_balance: number | string | null;
  account_type: string | null;
  company_name: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  preferred_contact: string | null;
  account_status: string | null;
  created_at: string | null;
};

export type CustomerIntelligenceAuthInput = {
  providers: string[];
  createdAt: string | null;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
};

export type CustomerIntelligenceClassificationInput = {
  classification: GrowthCustomerClassification;
  analyticsExcluded: boolean;
  reason: string | null;
  verifiedAt: string | null;
} | null;

export type CustomerIntelligenceAttributionInput = {
  first_landing_path: string | null;
  last_landing_path: string | null;
  first_source: string | null;
  last_source: string | null;
  first_medium: string | null;
  last_medium: string | null;
  first_campaign: string | null;
  last_campaign: string | null;
  first_term: string | null;
  last_term: string | null;
  first_referrer_host: string | null;
  last_referrer_host: string | null;
  first_country_code: string | null;
  last_country_code: string | null;
  locale: string | null;
  consent_version: string | null;
  touch_count: number | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  identified_at: string | null;
};

export type CustomerIntelligenceOrderInput = {
  id: string;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_generation: string | null;
  vehicle_engine: string | null;
  vehicle_year: string | null;
  service_type: string | null;
  credits_required: number | string | null;
  status: string | null;
  ecu: string | null;
  gearbox: string | null;
  read_method: string | null;
  uploaded_file_name: string | null;
  created_at: string | null;
};

export type CustomerIntelligenceLedgerInput = GrowthPaymentRow & {
  credits_delta?: number | null;
  balance_after?: number | null;
};

export type CustomerIntelligencePaymentInput = {
  status: string | null;
  payment_type: string | null;
  purchase_type: string | null;
  credits: number | string | null;
  amount_total: number | string | null;
  currency: string | null;
  credits_applied_at: string | null;
  refunded_at: string | null;
  created_at: string | null;
};

export type CustomerIntelligenceEmailInput = {
  event_type: string | null;
  status: string | null;
  delivery_status: string | null;
  created_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  delayed_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
};

export type CustomerIntelligenceMessageInput = {
  request_id: string;
  sender_role: string | null;
  is_internal: boolean | null;
  visibility_status: string | null;
  created_at: string | null;
};

export type CustomerIntelligenceWorkEventInput = {
  request_id: string;
  event_type: string | null;
  customer_visible: boolean | null;
  created_at: string | null;
};

export type CustomerIntelligenceJourneyInput = {
  event_type: string | null;
  order_id: string | null;
  channel: string | null;
  occurred_at: string | null;
};

export type CustomerIntelligencePreferenceInput = {
  abandoned_request_reminders: boolean | null;
  consent_version: string | null;
  consented_at: string | null;
  revoked_at: string | null;
} | null;

export type CustomerIntelligenceInput = {
  profile: CustomerIntelligenceProfileInput;
  auth: CustomerIntelligenceAuthInput | null;
  classification: CustomerIntelligenceClassificationInput;
  attribution: CustomerIntelligenceAttributionInput[];
  trackingStartedAt: string | null;
  orders: CustomerIntelligenceOrderInput[];
  ledger: CustomerIntelligenceLedgerInput[];
  payments: CustomerIntelligencePaymentInput[];
  emails: CustomerIntelligenceEmailInput[];
  messages: CustomerIntelligenceMessageInput[];
  workEvents: CustomerIntelligenceWorkEventInput[];
  journeyEvents: CustomerIntelligenceJourneyInput[];
  preference: CustomerIntelligencePreferenceInput;
  sourceStates: Record<string, CustomerIntelligenceSourceState>;
  warnings?: string[];
  now?: Date;
};

export type CustomerIntelligenceTouch = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  term: string | null;
  landingPath: string | null;
  referrerHost: string | null;
  countryCode: string | null;
  locale: string | null;
  occurredAt: string | null;
};

export type CustomerIntelligenceOrder = {
  id: string;
  reference: string;
  vehicle: string;
  engine: string | null;
  ecuOrGearbox: string | null;
  readMethod: string | null;
  service: string;
  creditsRequired: number;
  status: string;
  hasCustomerFile: boolean;
  createdAt: string | null;
};

export type CustomerIntelligenceTimelineItem = {
  id: string;
  type: "account" | "acquisition" | "request" | "payment" | "email" | "message" | "workflow";
  label: string;
  detail: string;
  occurredAt: string;
  orderId: string | null;
  tone: "neutral" | "positive" | "attention" | "commercial";
};

export type CustomerIntelligenceRecommendation = {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  detail: string;
  href: string | null;
};

export type CustomerIntelligenceReport = {
  generatedAt: string;
  customer: {
    userId: string;
    customerReference: string;
    email: string | null;
    fullName: string | null;
    companyName: string | null;
    accountType: string | null;
    phone: string | null;
    city: string | null;
    country: string | null;
    preferredContact: string | null;
    accountStatus: string;
    creditBalance: number;
    registeredAt: string | null;
    lastSignInAt: string | null;
    emailConfirmedAt: string | null;
    authProviders: string[];
    profileCompleteness: number;
    missingProfileFields: string[];
  };
  classification: {
    value: GrowthCustomerClassification;
    analyticsExcluded: boolean;
    reason: string | null;
    verifiedAt: string | null;
  };
  acquisition: {
    status: "captured" | "not_captured" | "tracking_not_available_at_registration" | "not_configured";
    confidence: "consented_first_party" | "unavailable";
    explanation: string;
    firstTouch: CustomerIntelligenceTouch | null;
    lastTouch: CustomerIntelligenceTouch | null;
    touchCount: number;
    consentVersion: string | null;
    identifiedAt: string | null;
  };
  lifecycle: {
    relationshipState: "excluded" | "registered" | "active_work" | "first_time" | "repeat_active" | "recent_customer" | "dormant";
    relationshipExplanation: string;
    firstRequestAt: string | null;
    lastRequestAt: string | null;
    firstPaymentAt: string | null;
    lastPaymentAt: string | null;
    hoursRegistrationToFirstRequest: number | null;
    hoursRegistrationToFirstPayment: number | null;
    daysSinceLastRequest: number | null;
    cohortMonth: string | null;
  };
  commercial: {
    revenue: GrowthRevenueCurrency[];
    purchaseCount: number;
    refundCount: number;
    creditsPurchased: number;
    creditsRequested: number;
    paymentStatusCounts: Array<{ status: string; count: number }>;
  };
  requests: {
    total: number;
    open: number;
    completed: number;
    cancelled: number;
    repeatCustomer: boolean;
    services: Array<{ label: string; count: number }>;
    brands: Array<{ label: string; count: number }>;
    orders: CustomerIntelligenceOrder[];
  };
  communication: {
    customerMessageCount: number;
    staffMessageCount: number;
    latestMessageAt: string | null;
    medianFirstResponseMinutes: number | null;
    emailAttemptCount: number;
    emailStatusCounts: Array<{ status: string; count: number }>;
    emailHealth: "healthy" | "attention" | "unknown";
    latestEmailAt: string | null;
    reminderPreference: "enabled" | "disabled" | "not_set";
  };
  cohort: {
    firstService: string | null;
    topService: string | null;
    topBrand: string | null;
    acquisitionSource: string | null;
    acquisitionCountry: string | null;
  };
  timeline: CustomerIntelligenceTimelineItem[];
  recommendations: CustomerIntelligenceRecommendation[];
  dataQuality: {
    operationalCoveragePercent: number;
    confidence: "high" | "medium" | "low";
    sources: Array<{ source: string; state: CustomerIntelligenceSourceState }>;
    warnings: string[];
    excludedFromProjection: string[];
  };
};

const completedStatuses = new Set(["completed", "delivered"]);
const cancelledStatuses = new Set(["cancelled", "canceled", "rejected"]);
const staffRoles = new Set(["admin", "staff", "support", "tuner", "calibrator"]);

function timestamp(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function safeNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeText(value: string | null | undefined, fallback: string) {
  const clean = value?.trim();
  return clean || fallback;
}

function hoursBetween(start: string | null | undefined, end: string | null | undefined) {
  const startAt = timestamp(start);
  const endAt = timestamp(end);
  return startAt !== null && endAt !== null && endAt >= startAt
    ? (endAt - startAt) / 3_600_000
    : null;
}

function daysSince(value: string | null | undefined, now: Date) {
  const at = timestamp(value);
  return at === null || at > now.getTime() ? null : (now.getTime() - at) / 86_400_000;
}

function sortByDate<T>(rows: T[], getter: (row: T) => string | null | undefined) {
  return [...rows].sort((left, right) => (timestamp(getter(left)) ?? 0) - (timestamp(getter(right)) ?? 0));
}

function countValues(values: Array<string | null | undefined>) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const clean = value?.trim();
    if (!clean) continue;
    counts.set(clean, (counts.get(clean) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function splitServices(value: string | null) {
  if (!value) return [];
  return value.split(/\s*(?:\+|,|;|\|)\s*/g).map((item) => item.trim()).filter(Boolean);
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function calculateMedianFirstResponseMinutes(messages: CustomerIntelligenceMessageInput[]) {
  const visible = sortByDate(
    messages.filter((message) => !message.is_internal && (!message.visibility_status || message.visibility_status === "visible")),
    (message) => message.created_at
  );
  const responseMinutes: number[] = [];
  for (let index = 0; index < visible.length; index += 1) {
    const message = visible[index];
    if ((message.sender_role ?? "customer").toLowerCase() !== "customer") continue;
    const sentAt = timestamp(message.created_at);
    if (sentAt === null) continue;
    const response = visible.slice(index + 1).find((candidate) =>
      candidate.request_id === message.request_id &&
      staffRoles.has((candidate.sender_role ?? "").toLowerCase()) &&
      (timestamp(candidate.created_at) ?? 0) >= sentAt
    );
    const responseAt = timestamp(response?.created_at);
    if (responseAt !== null) responseMinutes.push((responseAt - sentAt) / 60_000);
  }
  return median(responseMinutes);
}

function titleCase(value: string | null | undefined) {
  return safeText(value, "Unknown").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function acquisitionTouch(row: CustomerIntelligenceAttributionInput, mode: "first" | "last"): CustomerIntelligenceTouch {
  return {
    source: row[`${mode}_source`],
    medium: row[`${mode}_medium`],
    campaign: row[`${mode}_campaign`],
    term: row[`${mode}_term`],
    landingPath: row[`${mode}_landing_path`],
    referrerHost: row[`${mode}_referrer_host`],
    countryCode: row[`${mode}_country_code`],
    locale: row.locale,
    occurredAt: row[`${mode}_seen_at`],
  };
}

function buildAcquisition(input: CustomerIntelligenceInput) {
  const rows = sortByDate(input.attribution, (row) => row.first_seen_at);
  if (rows.length) {
    const lastRows = sortByDate(input.attribution, (row) => row.last_seen_at);
    const first = rows[0];
    const last = lastRows[lastRows.length - 1];
    return {
      status: "captured" as const,
      confidence: "consented_first_party" as const,
      explanation: "Captured from consented first-party attribution. Authentication provider is intentionally not treated as an acquisition source.",
      firstTouch: acquisitionTouch(first, "first"),
      lastTouch: acquisitionTouch(last, "last"),
      touchCount: rows.reduce((sum, row) => sum + Math.max(0, safeNumber(row.touch_count)), 0),
      consentVersion: last.consent_version,
      identifiedAt: rows.map((row) => row.identified_at).filter(Boolean).sort()[0] ?? null,
    };
  }

  const registeredAt = timestamp(input.profile.created_at);
  const trackingStartedAt = timestamp(input.trackingStartedAt);
  if (trackingStartedAt === null) {
    return {
      status: "not_configured" as const,
      confidence: "unavailable" as const,
      explanation: "No attribution baseline is available. The source remains unknown and is not inferred.",
      firstTouch: null,
      lastTouch: null,
      touchCount: 0,
      consentVersion: null,
      identifiedAt: null,
    };
  }
  if (registeredAt !== null && registeredAt < trackingStartedAt) {
    return {
      status: "tracking_not_available_at_registration" as const,
      confidence: "unavailable" as const,
      explanation: "This account predates the recorded attribution system. Historical source cannot be reconstructed safely.",
      firstTouch: null,
      lastTouch: null,
      touchCount: 0,
      consentVersion: null,
      identifiedAt: null,
    };
  }
  return {
    status: "not_captured" as const,
    confidence: "unavailable" as const,
    explanation: "No consented attribution was linked to this account. The source remains unknown and is not inferred from login, country or payment data.",
    firstTouch: null,
    lastTouch: null,
    touchCount: 0,
    consentVersion: null,
    identifiedAt: null,
  };
}

function buildRelationshipState(input: {
  excluded: boolean;
  orders: CustomerIntelligenceOrderInput[];
  now: Date;
}) {
  if (input.excluded) return {
    state: "excluded" as const,
    explanation: "This account is explicitly excluded from growth analytics, while its operational history remains unchanged.",
  };
  const sorted = sortByDate(input.orders, (order) => order.created_at);
  if (!sorted.length) return {
    state: "registered" as const,
    explanation: "Registered account with no submitted file-service request yet.",
  };
  const open = sorted.some((order) => {
    const status = (order.status ?? "new_request").toLowerCase();
    return !completedStatuses.has(status) && !cancelledStatuses.has(status);
  });
  if (open) return {
    state: "active_work" as const,
    explanation: "At least one request is currently active in the work-order flow.",
  };
  const lastOrder = sorted[sorted.length - 1];
  const inactiveDays = daysSince(lastOrder.created_at, input.now) ?? 0;
  if (sorted.length >= 2 && inactiveDays <= 90) return {
    state: "repeat_active" as const,
    explanation: "Repeat customer with recent request activity in the last 90 days.",
  };
  if (sorted.length === 1 && inactiveDays <= 60) return {
    state: "recent_customer" as const,
    explanation: "First-time customer with recent request activity in the last 60 days.",
  };
  if (inactiveDays > (sorted.length >= 2 ? 90 : 60)) return {
    state: "dormant" as const,
    explanation: `No new request for ${Math.floor(inactiveDays)} days. This is a transparent recency signal, not an automated prediction.`,
  };
  return {
    state: "first_time" as const,
    explanation: "One completed customer request is recorded.",
  };
}

function buildTimeline(input: CustomerIntelligenceInput, acquisition: ReturnType<typeof buildAcquisition>) {
  const items: CustomerIntelligenceTimelineItem[] = [];
  const push = (item: Omit<CustomerIntelligenceTimelineItem, "id">) => {
    if (timestamp(item.occurredAt) === null) return;
    items.push({ ...item, id: `${item.type}:${item.orderId ?? "account"}:${item.occurredAt}:${items.length}` });
  };

  if (input.profile.created_at) push({
    type: "account",
    label: "Account registered",
    detail: input.profile.account_type === "company" ? "Company account created." : "Customer account created.",
    occurredAt: input.profile.created_at,
    orderId: null,
    tone: "neutral",
  });
  if (acquisition.firstTouch?.occurredAt) push({
    type: "acquisition",
    label: "Consented first touch captured",
    detail: `${safeText(acquisition.firstTouch.source, "Unknown source")} / ${safeText(acquisition.firstTouch.medium, "unknown medium")} on ${safeText(acquisition.firstTouch.landingPath, "unknown page")}.`,
    occurredAt: acquisition.firstTouch.occurredAt,
    orderId: null,
    tone: "neutral",
  });

  for (const order of input.orders) {
    if (!order.created_at) continue;
    push({
      type: "request",
      label: "File-service request created",
      detail: `${safeText(order.vehicle_brand, "Vehicle")} ${safeText(order.vehicle_model, "")}`.trim() + ` | ${safeText(order.service_type, "Service not specified")}`,
      occurredAt: order.created_at,
      orderId: order.id,
      tone: "neutral",
    });
  }
  for (const row of input.ledger) {
    if (!row.created_at || !["purchase", "refund"].includes(row.type ?? "")) continue;
    push({
      type: "payment",
      label: row.type === "refund" ? "Credit payment refunded" : "Credit payment recorded",
      detail: `${Math.abs(safeNumber(row.amount_total)) / 100} ${(row.currency ?? "").toUpperCase()}`.trim(),
      occurredAt: row.created_at,
      orderId: null,
      tone: row.type === "refund" ? "attention" : "commercial",
    });
  }
  for (const row of input.workEvents) {
    if (!row.created_at || !row.event_type) continue;
    push({
      type: "workflow",
      label: titleCase(row.event_type),
      detail: row.customer_visible ? "Customer-visible workflow milestone." : "Internal operational milestone.",
      occurredAt: row.created_at,
      orderId: row.request_id,
      tone: /complete|deliver|approve/.test(row.event_type) ? "positive" : /cancel|reject|fail/.test(row.event_type) ? "attention" : "neutral",
    });
  }
  for (const row of input.journeyEvents) {
    if (!row.occurred_at || !row.event_type) continue;
    push({
      type: "workflow",
      label: titleCase(row.event_type),
      detail: `${titleCase(row.channel || "web")} customer journey event.`,
      occurredAt: row.occurred_at,
      orderId: row.order_id,
      tone: /request_created|account_created/.test(row.event_type) ? "positive" : "neutral",
    });
  }
  for (const row of input.emails) {
    if (!row.created_at || !row.event_type) continue;
    const status = (row.delivery_status || row.status || "pending").toLowerCase();
    push({
      type: "email",
      label: titleCase(row.event_type),
      detail: `Transactional email: ${titleCase(status)}.`,
      occurredAt: row.created_at,
      orderId: null,
      tone: ["bounced", "complained", "failed", "suppressed"].includes(status) ? "attention" : ["delivered", "sent"].includes(status) ? "positive" : "neutral",
    });
  }
  for (const row of input.messages.filter((message) => !message.is_internal && (!message.visibility_status || message.visibility_status === "visible"))) {
    if (!row.created_at) continue;
    const customer = (row.sender_role ?? "customer").toLowerCase() === "customer";
    push({
      type: "message",
      label: customer ? "Customer message received" : "Customer-visible staff reply",
      detail: "Message content remains outside the intelligence projection.",
      occurredAt: row.created_at,
      orderId: row.request_id,
      tone: "neutral",
    });
  }

  return items
    .sort((left, right) => (timestamp(right.occurredAt) ?? 0) - (timestamp(left.occurredAt) ?? 0))
    .slice(0, 120);
}

export function buildCustomerIntelligenceReport(input: CustomerIntelligenceInput): CustomerIntelligenceReport {
  const now = input.now ?? new Date();
  const sortedOrders = sortByDate(input.orders, (order) => order.created_at);
  const firstOrder = sortedOrders[0] ?? null;
  const lastOrder = sortedOrders[sortedOrders.length - 1] ?? null;
  const purchases = sortByDate(input.ledger.filter((row) => row.type === "purchase"), (row) => row.created_at);
  const refunds = input.ledger.filter((row) => row.type === "refund");
  const firstPayment = purchases[0] ?? null;
  const lastPayment = purchases[purchases.length - 1] ?? null;
  const classification = input.classification ?? {
    classification: "unreviewed" as const,
    analyticsExcluded: false,
    reason: null,
    verifiedAt: null,
  };
  const acquisition = buildAcquisition(input);
  const relationship = buildRelationshipState({
    excluded: classification.analyticsExcluded,
    orders: input.orders,
    now,
  });
  const services = countValues(input.orders.flatMap((order) => splitServices(order.service_type)));
  const brands = countValues(input.orders.map((order) => order.vehicle_brand));
  const visibleMessages = sortByDate(
    input.messages.filter((message) => !message.is_internal && (!message.visibility_status || message.visibility_status === "visible")),
    (message) => message.created_at
  );
  const emailStatuses = countValues(input.emails.map((email) => email.delivery_status || email.status || "pending"));
  const paymentStatuses = countValues(input.payments.map((payment) => payment.status || "unknown"));
  const emailProblemCount = input.emails.filter((email) =>
    ["bounced", "complained", "failed", "suppressed"].includes((email.delivery_status || email.status || "").toLowerCase())
  ).length;
  const profileFields = [
    ["E-mail", input.profile.email],
    ["Name or company", input.profile.full_name || input.profile.company_name],
    ["Account type", input.profile.account_type],
    ["Phone", input.profile.phone],
    ["Country", input.profile.country],
    ["City", input.profile.city],
    ["Preferred contact", input.profile.preferred_contact],
  ] as const;
  const missingProfileFields = profileFields.filter(([, value]) => !value?.trim()).map(([label]) => label);
  const completed = input.orders.filter((order) => completedStatuses.has((order.status ?? "").toLowerCase())).length;
  const cancelled = input.orders.filter((order) => cancelledStatuses.has((order.status ?? "").toLowerCase())).length;
  const open = Math.max(0, input.orders.length - completed - cancelled);
  const sourceEntries = Object.entries(input.sourceStates).map(([source, state]) => ({ source, state }));
  const requiredOperationalSources = sourceEntries.filter((item) => item.source !== "attribution");
  const readyOperationalSources = requiredOperationalSources.filter((item) => item.state === "ready").length;
  const operationalCoveragePercent = requiredOperationalSources.length
    ? Math.round((readyOperationalSources / requiredOperationalSources.length) * 100)
    : 0;
  const unavailableSources = sourceEntries.filter((item) => item.state === "unavailable").length;
  const dataConfidence = unavailableSources > 1 ? "low" : unavailableSources === 1 || acquisition.status !== "captured" ? "medium" : "high";
  const recommendations: CustomerIntelligenceRecommendation[] = [];

  if (classification.classification === "unreviewed") recommendations.push({
    id: "verify-customer-truth",
    priority: "high",
    title: "Verify customer classification",
    detail: "Confirm whether this is a real customer, internal test or staff-operated account before relying on growth metrics.",
    href: "/admin/growth",
  });
  if (acquisition.status === "not_captured") recommendations.push({
    id: "review-attribution-gap",
    priority: "medium",
    title: "Review attribution capture gap",
    detail: "No consented source was linked. Check the forward tracking flow, but do not reconstruct a historical source from login or payment metadata.",
    href: "/admin/seo-performance",
  });
  if (missingProfileFields.length) recommendations.push({
    id: "profile-completeness",
    priority: "low",
    title: "Complete operational profile",
    detail: `${missingProfileFields.join(", ")} ${missingProfileFields.length === 1 ? "is" : "are"} missing. Collect only what the customer provides for service and support.`,
    href: `/admin#customers`,
  });
  if (emailProblemCount) recommendations.push({
    id: "email-delivery",
    priority: "high",
    title: "Review email delivery health",
    detail: `${emailProblemCount} failed, suppressed, bounced or complained email event${emailProblemCount === 1 ? "" : "s"} require review.`,
    href: "/admin/email",
  });
  if (!input.orders.length && (daysSince(input.profile.created_at, now) ?? 0) >= 7) recommendations.push({
    id: "onboarding-friction",
    priority: "medium",
    title: "Review onboarding friction",
    detail: "The account is at least seven days old and has no submitted request. Any outreach must follow the customer communication preference.",
    href: null,
  });
  if (relationship.state === "dormant") recommendations.push({
    id: "retention-review",
    priority: "medium",
    title: "Review retention context",
    detail: "Inspect service history and support outcomes before planning any approved customer-success outreach.",
    href: null,
  });

  const orderRows: CustomerIntelligenceOrder[] = [...input.orders]
    .sort((left, right) => (timestamp(right.created_at) ?? 0) - (timestamp(left.created_at) ?? 0))
    .map((order) => ({
      id: order.id,
      reference: `#${order.id.slice(0, 8).toUpperCase()}`,
      vehicle: [order.vehicle_brand, order.vehicle_model, order.vehicle_generation, order.vehicle_year].filter(Boolean).join(" | ") || "Vehicle not specified",
      engine: order.vehicle_engine,
      ecuOrGearbox: order.ecu || order.gearbox,
      readMethod: order.read_method,
      service: safeText(order.service_type, "Service not specified"),
      creditsRequired: safeNumber(order.credits_required),
      status: safeText(order.status, "new_request"),
      hasCustomerFile: Boolean(order.uploaded_file_name),
      createdAt: order.created_at,
    }));

  return {
    generatedAt: now.toISOString(),
    customer: {
      userId: input.profile.id,
      customerReference: input.profile.customer_id || `Customer ${input.profile.id.slice(0, 8).toUpperCase()}`,
      email: input.profile.email,
      fullName: input.profile.full_name,
      companyName: input.profile.company_name,
      accountType: input.profile.account_type,
      phone: input.profile.phone,
      city: input.profile.city,
      country: input.profile.country,
      preferredContact: input.profile.preferred_contact,
      accountStatus: safeText(input.profile.account_status, "active"),
      creditBalance: safeNumber(input.profile.credit_balance),
      registeredAt: input.profile.created_at || input.auth?.createdAt || null,
      lastSignInAt: input.auth?.lastSignInAt ?? null,
      emailConfirmedAt: input.auth?.emailConfirmedAt ?? null,
      authProviders: [...new Set(input.auth?.providers.map((provider) => provider.toLowerCase()).filter(Boolean) ?? [])].sort(),
      profileCompleteness: Math.round(((profileFields.length - missingProfileFields.length) / profileFields.length) * 100),
      missingProfileFields,
    },
    classification: {
      value: classification.classification,
      analyticsExcluded: classification.analyticsExcluded,
      reason: classification.reason,
      verifiedAt: classification.verifiedAt,
    },
    acquisition,
    lifecycle: {
      relationshipState: relationship.state,
      relationshipExplanation: relationship.explanation,
      firstRequestAt: firstOrder?.created_at ?? null,
      lastRequestAt: lastOrder?.created_at ?? null,
      firstPaymentAt: firstPayment?.created_at ?? null,
      lastPaymentAt: lastPayment?.created_at ?? null,
      hoursRegistrationToFirstRequest: hoursBetween(input.profile.created_at, firstOrder?.created_at),
      hoursRegistrationToFirstPayment: hoursBetween(input.profile.created_at, firstPayment?.created_at),
      daysSinceLastRequest: daysSince(lastOrder?.created_at, now),
      cohortMonth: input.profile.created_at?.slice(0, 7) ?? null,
    },
    commercial: {
      revenue: buildRevenueByCurrency(input.ledger),
      purchaseCount: purchases.length,
      refundCount: refunds.length,
      creditsPurchased: purchases.reduce((sum, row) => sum + Math.max(0, safeNumber(row.credits_delta)), 0),
      creditsRequested: input.orders.reduce((sum, order) => sum + Math.max(0, safeNumber(order.credits_required)), 0),
      paymentStatusCounts: paymentStatuses.map(({ label, count }) => ({ status: label, count })),
    },
    requests: {
      total: input.orders.length,
      open,
      completed,
      cancelled,
      repeatCustomer: input.orders.length >= 2,
      services,
      brands,
      orders: orderRows,
    },
    communication: {
      customerMessageCount: visibleMessages.filter((message) => (message.sender_role ?? "customer").toLowerCase() === "customer").length,
      staffMessageCount: visibleMessages.filter((message) => staffRoles.has((message.sender_role ?? "").toLowerCase())).length,
      latestMessageAt: visibleMessages[visibleMessages.length - 1]?.created_at ?? null,
      medianFirstResponseMinutes: calculateMedianFirstResponseMinutes(visibleMessages),
      emailAttemptCount: input.emails.length,
      emailStatusCounts: emailStatuses.map(({ label, count }) => ({ status: label, count })),
      emailHealth: emailProblemCount ? "attention" : input.emails.length ? "healthy" : "unknown",
      latestEmailAt: sortByDate(input.emails, (email) => email.created_at).at(-1)?.created_at ?? null,
      reminderPreference: input.preference?.abandoned_request_reminders && !input.preference.revoked_at
        ? "enabled"
        : input.preference
          ? "disabled"
          : "not_set",
    },
    cohort: {
      firstService: firstOrder?.service_type ?? null,
      topService: services[0]?.label ?? null,
      topBrand: brands[0]?.label ?? null,
      acquisitionSource: acquisition.firstTouch?.source ?? null,
      acquisitionCountry: acquisition.firstTouch?.countryCode ?? null,
    },
    timeline: buildTimeline(input, acquisition),
    recommendations: recommendations.sort((left, right) => ({ high: 0, medium: 1, low: 2 })[left.priority] - ({ high: 0, medium: 1, low: 2 })[right.priority]),
    dataQuality: {
      operationalCoveragePercent,
      confidence: dataConfidence,
      sources: sourceEntries,
      warnings: [...new Set(input.warnings ?? [])],
      excludedFromProjection: [
        "Raw IP address and device fingerprint",
        "Visitor identifier and visitor hash",
        "Full referrer URL and raw query string",
        "Payment provider IDs, card or bank details",
        "Email body, provider payload and provider message ID",
        "Message content, hidden messages and internal notes",
        "Storage paths, signed URLs, file names and firmware bytes",
        "AI samples, raw analysis, binary offsets and source metadata",
      ],
    },
  };
}
