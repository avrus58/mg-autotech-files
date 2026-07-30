import type { AdminRequestListItem } from "@/lib/workOrders/server";

export type OperationsProfile = {
  id: string;
  email: string | null;
  customer_id: string | null;
  full_name: string | null;
  account_type: string | null;
  company_name: string | null;
  phone: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  invoice_email: string | null;
  preferred_contact: string | null;
  account_status: string | null;
  created_at: string | null;
};

export type ProfileReadiness = {
  complete: boolean;
  percent: number;
  completed: number;
  total: number;
  missing: string[];
};

export type OperationsQueueSummary = {
  total: number;
  active: number;
  completed: number;
  cancelled: number;
  needsAttention: number;
  waitingForCustomer: number;
  urgentOrHigh: number;
  unassigned: number;
  etaMissing: number;
  estimateElapsed: number;
  stateCounts: Record<string, number>;
};

export type OperationsSearchResult = {
  type: "order" | "customer";
  id: string;
  title: string;
  subtitle: string;
  reference: string;
  href: string;
  status: string;
};

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function toTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getCustomerProfileReadiness(profile: OperationsProfile): ProfileReadiness {
  const checks = [
    { label: "full name", complete: hasText(profile.full_name) },
    { label: "phone", complete: hasText(profile.phone) },
    { label: "invoice email", complete: hasText(profile.invoice_email) },
    { label: "preferred contact", complete: hasText(profile.preferred_contact) },
    {
      label: "billing address",
      complete:
        hasText(profile.street) &&
        hasText(profile.postal_code) &&
        hasText(profile.city) &&
        hasText(profile.country),
    },
    {
      label: "company name",
      complete: profile.account_type !== "company" || hasText(profile.company_name),
    },
  ];
  const completed = checks.filter((check) => check.complete).length;

  return {
    complete: completed === checks.length,
    percent: Math.round((completed / checks.length) * 100),
    completed,
    total: checks.length,
    missing: checks.filter((check) => !check.complete).map((check) => check.label),
  };
}

export function buildOperationsQueueSummary(
  items: AdminRequestListItem[],
  now = new Date()
): OperationsQueueSummary {
  const nowMs = now.getTime();
  const stateCounts: Record<string, number> = {};
  let active = 0;
  let completed = 0;
  let cancelled = 0;
  let needsAttention = 0;
  let waitingForCustomer = 0;
  let urgentOrHigh = 0;
  let unassigned = 0;
  let etaMissing = 0;
  let estimateElapsed = 0;

  for (const item of items) {
    const state = item.queueProjection.state;
    const workOrder = item.workOrder;
    stateCounts[state] = (stateCounts[state] ?? 0) + 1;

    if (state === "delivered") completed += 1;
    else if (state === "cancelled") cancelled += 1;
    else active += 1;

    if (state === "waiting_for_customer") waitingForCustomer += 1;
    if (item.queueProjection.isBlocked || state === "expert_review" || state === "quality_check") {
      needsAttention += 1;
    }

    if (!item.queueProjection.isTerminal) {
      if (workOrder?.priority === "urgent" || workOrder?.priority === "high") urgentOrHigh += 1;
      if (!workOrder?.assigned_admin_id && !workOrder?.assigned_tuner_id) unassigned += 1;
      if (item.queueProjection.eta.availability === "pending_review") etaMissing += 1;

      const createdAt = toTimestamp(item.order.created_at);
      const estimateMinutes = workOrder?.estimated_turnaround_minutes;
      if (
        createdAt !== null &&
        typeof estimateMinutes === "number" &&
        estimateMinutes >= 0 &&
        nowMs > createdAt + estimateMinutes * 60_000
      ) {
        estimateElapsed += 1;
      }
    }
  }

  return {
    total: items.length,
    active,
    completed,
    cancelled,
    needsAttention,
    waitingForCustomer,
    urgentOrHigh,
    unassigned,
    etaMissing,
    estimateElapsed,
    stateCounts,
  };
}

export function normalizeOperationsSearchTerm(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 100)
    .toLocaleLowerCase("en");
}

function matchesSearch(term: string, values: Array<string | null | undefined>) {
  return values.some((value) => value?.toLocaleLowerCase("en").includes(term));
}

export function searchOperationsRecords({
  items,
  profiles,
  term,
  limit = 24,
}: {
  items: AdminRequestListItem[];
  profiles: OperationsProfile[];
  term: string;
  limit?: number;
}): OperationsSearchResult[] {
  const normalized = normalizeOperationsSearchTerm(term);
  if (normalized.length < 2) return [];

  const orderResults = items
    .filter((item) => matchesSearch(normalized, [
      item.order.id,
      item.order.customer_email,
      item.customer?.customer_id,
      item.customer?.full_name,
      item.customer?.company_name,
      item.order.vehicle_brand,
      item.order.vehicle_model,
      item.order.vehicle_generation,
      item.order.vehicle_engine,
      item.order.ecu,
      item.order.service_type,
      item.order.uploaded_file_name,
    ]))
    .slice(0, limit)
    .map((item): OperationsSearchResult => ({
      type: "order",
      id: item.order.id,
      title: [item.order.vehicle_brand, item.order.vehicle_model, item.order.vehicle_engine]
        .filter(Boolean)
        .join(" ") || "Vehicle request",
      subtitle: item.customer?.full_name || item.order.customer_email || "Customer",
      reference: `#${item.order.id.slice(0, 8).toUpperCase()}`,
      href: `/admin/requests/${item.order.id}`,
      status: item.queueProjection.stateLabel,
    }));

  const customerResults = profiles
    .filter((profile) => matchesSearch(normalized, [
      profile.id,
      profile.customer_id,
      profile.email,
      profile.full_name,
      profile.company_name,
      profile.phone,
    ]))
    .slice(0, Math.max(0, limit - orderResults.length))
    .map((profile): OperationsSearchResult => ({
      type: "customer",
      id: profile.id,
      title: profile.full_name || profile.company_name || profile.email || "Customer",
      subtitle: profile.email || profile.company_name || "Customer profile",
      reference: profile.customer_id || "Customer ID pending",
      href: "/admin#customers",
      status: profile.account_status || "active",
    }));

  return [...orderResults, ...customerResults].slice(0, limit);
}
