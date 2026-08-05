import type {
  GrowthDemandRow,
  GrowthEmailSummary,
  GrowthFunnelSummary,
  GrowthPerformanceRow,
  GrowthRetentionSummary,
  GrowthRevenueCurrency,
} from "@/lib/growth/types";

export type GrowthProfileRow = {
  id: string;
  customer_id?: string | null;
  role?: string | null;
  country?: string | null;
  created_at: string | null;
};

export type GrowthOrderRow = {
  id: string;
  customer_id: string | null;
  status: string | null;
  service_type: string | null;
  vehicle_brand: string | null;
  credits_required: number | null;
  created_at: string | null;
};

export type GrowthPaymentRow = {
  id: string;
  user_id: string | null;
  status?: string | null;
  type?: string | null;
  amount_total: number | null;
  currency: string | null;
  created_at: string | null;
};

export type GrowthEmailRow = {
  event_type: string | null;
  recipient_user_id: string | null;
  status: string | null;
  delivery_status?: string | null;
  created_at: string | null;
};

export type GrowthAttributionRow = {
  user_id: string | null;
  locale?: string | null;
  first_source: string | null;
  first_medium: string | null;
  first_campaign: string | null;
  first_term: string | null;
  first_landing_path: string | null;
  first_country_code: string | null;
  first_seen_at: string | null;
};

export type GrowthJourneyRow = {
  event_type: string;
  user_id: string | null;
  order_id: string | null;
  occurred_at: string | null;
};

export type GrowthMetricInput = {
  startAt: Date;
  endAt: Date;
  profiles: GrowthProfileRow[];
  orders: GrowthOrderRow[];
  payments: GrowthPaymentRow[];
  emails: GrowthEmailRow[];
  attribution: GrowthAttributionRow[];
  journeyEvents: GrowthJourneyRow[];
};

function timestamp(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function inRange(value: string | null, start: number, end: number) {
  const time = timestamp(value);
  return time !== null && time >= start && time <= end;
}

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function customerProfiles(rows: GrowthProfileRow[]) {
  return rows.filter((row) => !["admin", "staff"].includes(row.role ?? "customer"));
}

function groupOrdersByCustomer(rows: GrowthOrderRow[]) {
  const grouped = new Map<string, GrowthOrderRow[]>();
  for (const order of rows) {
    if (!order.customer_id) continue;
    const current = grouped.get(order.customer_id) ?? [];
    current.push(order);
    grouped.set(order.customer_id, current);
  }
  for (const orders of grouped.values()) {
    orders.sort((left, right) => (timestamp(left.created_at) ?? 0) - (timestamp(right.created_at) ?? 0));
  }
  return grouped;
}

function isPurchase(row: GrowthPaymentRow) {
  return row.type === "purchase" || (!row.type && row.status === "succeeded");
}

function isRefund(row: GrowthPaymentRow) {
  return row.type === "refund";
}

function revenueRowsByUser(rows: GrowthPaymentRow[]) {
  const grouped = new Map<string, GrowthPaymentRow[]>();
  for (const payment of rows) {
    if (!payment.user_id || !Number.isFinite(payment.amount_total ?? NaN)) continue;
    if (!isPurchase(payment) && !isRefund(payment)) continue;
    const current = grouped.get(payment.user_id) ?? [];
    current.push(payment);
    grouped.set(payment.user_id, current);
  }
  return grouped;
}

export function buildRevenueByCurrency(rows: GrowthPaymentRow[]): GrowthRevenueCurrency[] {
  const groups = new Map<string, {
    grossAmountMinor: number;
    refundedAmountMinor: number;
    payments: number;
    refunds: number;
    users: Set<string>;
  }>();
  for (const row of rows) {
    if (!row.user_id || !Number.isFinite(row.amount_total ?? NaN)) continue;
    if (!isPurchase(row) && !isRefund(row)) continue;
    const currency = (row.currency || "unknown").toUpperCase();
    const group = groups.get(currency) ?? {
      grossAmountMinor: 0,
      refundedAmountMinor: 0,
      payments: 0,
      refunds: 0,
      users: new Set<string>(),
    };
    const amount = Number(row.amount_total ?? 0);
    if (isPurchase(row)) {
      group.grossAmountMinor += Math.max(0, amount);
      group.payments += 1;
      group.users.add(row.user_id);
    } else {
      group.refundedAmountMinor += Math.abs(Math.min(0, amount));
      group.refunds += 1;
    }
    groups.set(currency, group);
  }
  return [...groups.entries()]
    .map(([currency, group]) => ({
      currency,
      grossAmountMinor: group.grossAmountMinor,
      refundedAmountMinor: group.refundedAmountMinor,
      amountMinor: group.grossAmountMinor - group.refundedAmountMinor,
      successfulPayments: group.payments,
      refunds: group.refunds,
      payingCustomers: group.users.size,
      revenuePerPayingCustomerMinor: group.users.size
        ? (group.grossAmountMinor - group.refundedAmountMinor) / group.users.size
        : null,
    }))
    .sort((left, right) => right.amountMinor - left.amountMinor);
}

function buildEmailSummary(rows: GrowthEmailRow[], orders: GrowthOrderRow[]): GrowthEmailSummary {
  const statusCount = (name: string) => rows.filter((row) => (row.delivery_status || row.status) === name).length;
  const reminderRows = rows.filter((row) => row.event_type === "request_abandoned_reminder");
  const sentReminderRows = reminderRows.filter((row) =>
    ["sent", "delivered", "delayed"].includes(row.delivery_status || row.status || "")
  );
  const reminderUsers = new Map<string, number>();
  for (const reminder of sentReminderRows) {
    if (!reminder.recipient_user_id) continue;
    reminderUsers.set(
      reminder.recipient_user_id,
      Math.max(reminderUsers.get(reminder.recipient_user_id) ?? 0, timestamp(reminder.created_at) ?? 0)
    );
  }
  const convertedUsers = new Set<string>();
  for (const order of orders) {
    if (!order.customer_id) continue;
    const reminderAt = reminderUsers.get(order.customer_id);
    const orderAt = timestamp(order.created_at);
    if (reminderAt && orderAt && orderAt > reminderAt && orderAt <= reminderAt + 7 * 86_400_000) {
      convertedUsers.add(order.customer_id);
    }
  }
  const delivered = statusCount("delivered");
  const bad = statusCount("bounced") + statusCount("complained") + statusCount("failed");

  return {
    attempted: rows.length,
    sent: statusCount("sent"),
    delivered,
    delayed: statusCount("delayed"),
    bounced: statusCount("bounced"),
    complained: statusCount("complained"),
    failed: statusCount("failed"),
    suppressed: statusCount("suppressed"),
    skipped: statusCount("skipped"),
    deliveryRate: rate(delivered, delivered + bad),
    reminderAttempts: reminderRows.length,
    reminderConversions: convertedUsers.size,
    reminderConversionRate: rate(convertedUsers.size, reminderUsers.size),
  };
}

function splitDemandLabels(value: string | null) {
  return [...new Set(
    (value ?? "")
      .split(/\s+(?:\+|&)\s+|,|;/i)
      .map((item) => item.trim().replace(/\s+/g, " "))
      .filter(Boolean)
  )];
}

function buildDemandRows(
  orders: GrowthOrderRow[],
  labelSelector: (order: GrowthOrderRow) => string[]
): GrowthDemandRow[] {
  const groups = new Map<string, { label: string; rows: GrowthOrderRow[] }>();
  for (const order of orders) {
    for (const label of labelSelector(order)) {
      const key = label.toLowerCase();
      const current = groups.get(key) ?? { label, rows: [] };
      current.rows.push(order);
      groups.set(key, current);
    }
  }
  return [...groups.entries()].map(([key, group]) => {
    const { label, rows } = group;
    const customerCounts = new Map<string, number>();
    for (const row of rows) {
      if (row.customer_id) customerCounts.set(row.customer_id, (customerCounts.get(row.customer_id) ?? 0) + 1);
    }
    const repeatCustomers = [...customerCounts.values()].filter((count) => count > 1).length;
    return {
      key,
      label,
      orders: rows.length,
      customers: customerCounts.size,
      repeatCustomers,
      completedOrders: rows.filter((row) => row.status === "completed").length,
      creditsRequested: rows.reduce((sum, row) => sum + Number(row.credits_required ?? 0), 0),
      repeatRate: rate(repeatCustomers, customerCounts.size),
    };
  }).sort((left, right) => right.orders - left.orders || left.label.localeCompare(right.label));
}

function buildAttributionPerformance(input: {
  attribution: GrowthAttributionRow[];
  ordersByCustomer: Map<string, GrowthOrderRow[]>;
  paymentsByUser: Map<string, GrowthPaymentRow[]>;
  label: (row: GrowthAttributionRow) => string;
}): GrowthPerformanceRow[] {
  const groups = new Map<string, GrowthAttributionRow[]>();
  for (const row of input.attribution) {
    const label = input.label(row) || "Unknown";
    const key = label.toLowerCase();
    const current = groups.get(key) ?? [];
    current.push(row);
    groups.set(key, current);
  }

  return [...groups.entries()].map(([key, rows]) => {
    const users = new Set(rows.map((row) => row.user_id).filter((value): value is string => Boolean(value)));
    const orderingUsers = new Set([...users].filter((userId) => (input.ordersByCustomer.get(userId)?.length ?? 0) > 0));
    const repeatUsers = new Set([...orderingUsers].filter((userId) => (input.ordersByCustomer.get(userId)?.length ?? 0) > 1));
    const payingUsers = new Set([...users].filter((userId) =>
      (input.paymentsByUser.get(userId) ?? []).some(isPurchase)
    ));
    const orders = [...orderingUsers].flatMap((userId) => input.ordersByCustomer.get(userId) ?? []);
    const payments = [...payingUsers].flatMap((userId) => input.paymentsByUser.get(userId) ?? []);
    return {
      key,
      label: input.label(rows[0]) || "Unknown",
      consentedVisitors: rows.length,
      registrations: users.size,
      customersWithRequests: orderingUsers.size,
      orders: orders.length,
      repeatCustomers: repeatUsers.size,
      payingCustomers: payingUsers.size,
      conversionRate: rate(orderingUsers.size, rows.length),
      revenueByCurrency: buildRevenueByCurrency(payments),
    };
  }).sort((left, right) => right.orders - left.orders || right.consentedVisitors - left.consentedVisitors);
}

export function buildGrowthMetrics(input: GrowthMetricInput) {
  const start = input.startAt.getTime();
  const end = input.endAt.getTime();
  const profiles = customerProfiles(input.profiles);
  const periodProfiles = profiles.filter((row) => inRange(row.created_at, start, end));
  const periodOrders = input.orders.filter((row) => inRange(row.created_at, start, end));
  const periodPayments = input.payments.filter((row) => inRange(row.created_at, start, end));
  const periodEmails = input.emails.filter((row) => inRange(row.created_at, start, end));
  const periodAttribution = input.attribution.filter((row) => inRange(row.first_seen_at, start, end));
  const allOrdersByCustomer = groupOrdersByCustomer(input.orders);
  const periodOrdersByCustomer = groupOrdersByCustomer(periodOrders);
  const periodPaymentsByUser = revenueRowsByUser(periodPayments);
  const customersWithRequests = new Set([...periodOrdersByCustomer.keys()]);
  const repeatCustomers = new Set([...allOrdersByCustomer.entries()].filter(([, rows]) => rows.length > 1).map(([id]) => id));
  const periodRepeatCustomers = new Set([...customersWithRequests].filter((id) => repeatCustomers.has(id)));
  const firstRequestCustomers = new Set<string>();
  const daysToFirstRequest: number[] = [];
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  for (const [userId, rows] of allOrdersByCustomer.entries()) {
    const firstOrder = rows[0];
    if (inRange(firstOrder.created_at, start, end)) firstRequestCustomers.add(userId);
    const profileAt = timestamp(profileById.get(userId)?.created_at);
    const firstOrderAt = timestamp(firstOrder.created_at);
    if (profileAt !== null && firstOrderAt !== null && firstOrderAt >= profileAt) {
      daysToFirstRequest.push((firstOrderAt - profileAt) / 86_400_000);
    }
  }
  const successfulPeriodPayments = periodPayments.filter((row) => isPurchase(row) && row.user_id);
  const payingCustomers = new Set(successfulPeriodPayments.map((row) => row.user_id as string));

  const funnel: GrowthFunnelSummary = {
    consentedVisitors: periodAttribution.length,
    registrations: periodProfiles.length,
    customersWithRequests: customersWithRequests.size,
    firstRequestCustomers: firstRequestCustomers.size,
    repeatCustomers: periodRepeatCustomers.size,
    orders: periodOrders.length,
    completedOrders: periodOrders.filter((row) => row.status === "completed").length,
    payingCustomers: payingCustomers.size,
    visitorToRegistrationRate: rate(periodAttribution.filter((row) => row.user_id).length, periodAttribution.length),
    registrationToRequestRate: rate(
      periodProfiles.filter((profile) => (allOrdersByCustomer.get(profile.id)?.length ?? 0) > 0).length,
      periodProfiles.length
    ),
    requestToRepeatRate: rate(periodRepeatCustomers.size, customersWithRequests.size),
    completionRate: rate(periodOrders.filter((row) => row.status === "completed").length, periodOrders.length),
  };

  const now = input.endAt.getTime();
  const retention: GrowthRetentionSummary = {
    customersWithAnyOrder: allOrdersByCustomer.size,
    repeatCustomers: repeatCustomers.size,
    repeatCustomerRate: rate(repeatCustomers.size, allOrdersByCustomer.size),
    averageOrdersPerCustomer: allOrdersByCustomer.size
      ? [...allOrdersByCustomer.values()].reduce((sum, rows) => sum + rows.length, 0) / allOrdersByCustomer.size
      : null,
    medianDaysToFirstRequest: median(daysToFirstRequest),
    newCustomersWithoutRequest: profiles.filter((profile) => {
      const createdAt = timestamp(profile.created_at);
      return createdAt !== null && now - createdAt >= 7 * 86_400_000 && !(allOrdersByCustomer.get(profile.id)?.length);
    }).length,
    oneTimeCustomersInactive60d: [...allOrdersByCustomer.values()].filter((rows) => {
      const last = timestamp(rows.at(-1)?.created_at);
      return rows.length === 1 && last !== null && now - last >= 60 * 86_400_000;
    }).length,
    repeatCustomersInactive90d: [...allOrdersByCustomer.values()].filter((rows) => {
      const last = timestamp(rows.at(-1)?.created_at);
      return rows.length > 1 && last !== null && now - last >= 90 * 86_400_000;
    }).length,
  };

  return {
    funnel,
    retention,
    revenue: buildRevenueByCurrency(periodPayments),
    email: buildEmailSummary(periodEmails, input.orders),
    bySource: buildAttributionPerformance({
      attribution: periodAttribution,
      ordersByCustomer: allOrdersByCustomer,
      paymentsByUser: periodPaymentsByUser,
      label: (row) => row.first_medium === "none" ? row.first_source || "Direct" : `${row.first_source || "Unknown"} / ${row.first_medium || "unknown"}`,
    }),
    byCountry: buildAttributionPerformance({
      attribution: periodAttribution,
      ordersByCustomer: allOrdersByCustomer,
      paymentsByUser: periodPaymentsByUser,
      label: (row) => row.first_country_code || "Unknown",
    }),
    byLocale: buildAttributionPerformance({
      attribution: periodAttribution,
      ordersByCustomer: allOrdersByCustomer,
      paymentsByUser: periodPaymentsByUser,
      label: (row) => row.locale?.trim().toLowerCase() || "Unknown",
    }),
    byLandingPage: buildAttributionPerformance({
      attribution: periodAttribution,
      ordersByCustomer: allOrdersByCustomer,
      paymentsByUser: periodPaymentsByUser,
      label: (row) => row.first_landing_path || "/",
    }),
    byService: buildDemandRows(periodOrders, (order) => splitDemandLabels(order.service_type)),
    byBrand: buildDemandRows(periodOrders, (order) => order.vehicle_brand?.trim() ? [order.vehicle_brand.trim()] : []),
  };
}
