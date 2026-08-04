export const growthReportRanges = ["30d", "90d", "180d", "365d"] as const;

export type GrowthReportRange = (typeof growthReportRanges)[number];

export type GrowthAttributionTouch = {
  landingPath: string;
  source: string;
  medium: string;
  campaign: string | null;
  term: string | null;
  referrerHost: string | null;
  locale: string | null;
};

export type GrowthFunnelSummary = {
  consentedVisitors: number;
  registrations: number;
  customersWithRequests: number;
  firstRequestCustomers: number;
  repeatCustomers: number;
  orders: number;
  completedOrders: number;
  payingCustomers: number;
  visitorToRegistrationRate: number | null;
  registrationToRequestRate: number | null;
  requestToRepeatRate: number | null;
  completionRate: number | null;
};

export type GrowthRevenueCurrency = {
  currency: string;
  grossAmountMinor: number;
  refundedAmountMinor: number;
  amountMinor: number;
  successfulPayments: number;
  refunds: number;
  payingCustomers: number;
  revenuePerPayingCustomerMinor: number | null;
};

export type GrowthPerformanceRow = {
  key: string;
  label: string;
  consentedVisitors: number;
  registrations: number;
  customersWithRequests: number;
  orders: number;
  repeatCustomers: number;
  payingCustomers: number;
  conversionRate: number | null;
  revenueByCurrency: GrowthRevenueCurrency[];
};

export type GrowthDemandRow = {
  key: string;
  label: string;
  orders: number;
  customers: number;
  repeatCustomers: number;
  completedOrders: number;
  creditsRequested: number;
  repeatRate: number | null;
};

export type GrowthEmailSummary = {
  attempted: number;
  sent: number;
  delivered: number;
  delayed: number;
  bounced: number;
  complained: number;
  failed: number;
  suppressed: number;
  skipped: number;
  deliveryRate: number | null;
  reminderAttempts: number;
  reminderConversions: number;
  reminderConversionRate: number | null;
};

export type GrowthRetentionSummary = {
  customersWithAnyOrder: number;
  repeatCustomers: number;
  repeatCustomerRate: number | null;
  averageOrdersPerCustomer: number | null;
  medianDaysToFirstRequest: number | null;
  newCustomersWithoutRequest: number;
  oneTimeCustomersInactive60d: number;
  repeatCustomersInactive90d: number;
};

export type GrowthActionType =
  | "abandoned_request"
  | "new_customer_no_request"
  | "email_delivery_issue"
  | "payment_review"
  | "seo_opportunity"
  | "retention_risk";

export type GrowthActionItem = {
  id: string;
  type: GrowthActionType;
  priority: "high" | "medium" | "low";
  title: string;
  detail: string;
  href: string;
  customerReference: string | null;
  sourceEventId: string | null;
  occurredAt: string | null;
  action: "review" | "send_reminder";
};

export type GrowthSearchQueryRow = {
  query: string;
  pagePath: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GrowthCustomerSuccessReport = {
  generatedAt: string;
  range: GrowthReportRange;
  period: { startAt: string; endAt: string };
  migrationReady: boolean;
  sources: {
    coreBusiness: "ready" | "partial" | "error";
    attribution: "ready" | "migration_required" | "error";
    seo: "ready" | "not_configured" | "partial" | "error";
    emailDelivery: "ready" | "partial" | "error";
  };
  funnel: GrowthFunnelSummary;
  retention: GrowthRetentionSummary;
  revenue: GrowthRevenueCurrency[];
  email: GrowthEmailSummary;
  bySource: GrowthPerformanceRow[];
  byCountry: GrowthPerformanceRow[];
  byLandingPage: GrowthPerformanceRow[];
  byService: GrowthDemandRow[];
  byBrand: GrowthDemandRow[];
  searchQueries: GrowthSearchQueryRow[];
  searchQueryWindow: "28d" | "90d";
  actions: GrowthActionItem[];
  warnings: string[];
  limitations: string[];
};

export type GrowthReminderSendResult = {
  ok: boolean;
  status: "sent" | "dry_run" | "skipped" | "failed";
  reason: string | null;
};
