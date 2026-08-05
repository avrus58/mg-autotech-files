import type { WidgetClientStatus } from "@/lib/widget/types";

export type WidgetCommercialStage =
  | "prospect"
  | "onboarding"
  | "ready"
  | "live"
  | "attention"
  | "paused"
  | "churned";

export type WidgetCommercialHealthLevel = "healthy" | "watch" | "critical" | "inactive";

export type WidgetCommercialIssue = {
  code: string;
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
};

export type WidgetCommercialMetrics = {
  usage_this_month: number;
  blocked_this_month: number;
  enquiries_this_month: number;
  failed_enquiries_this_month: number;
  pending_domain_request_count: number;
  active_key_count: number;
  last_allowed_at: string | null;
  last_blocked_at: string | null;
  last_enquiry_at: string | null;
  latest_requested_domain: string | null;
};

export type WidgetCommercialClient = {
  status: WidgetClientStatus;
  widget_enabled: boolean;
  admin_suspended: boolean;
  domain_verified: boolean;
  monthly_usage_limit: number;
  stripe_subscription_status: string | null;
  email_enquiries_enabled: boolean;
  enquiry_email: string | null;
  whatsapp_enquiries_enabled: boolean;
  whatsapp_number: string | null;
};

export type WidgetOnboardingStep = {
  id: "subscription" | "domain" | "key" | "enabled" | "installation" | "contact";
  label: string;
  complete: boolean;
};

export type WidgetCommercialHealth = {
  stage: WidgetCommercialStage;
  level: WidgetCommercialHealthLevel;
  score: number;
  usage_percent: number;
  onboarding_completed: number;
  onboarding_total: number;
  onboarding_steps: WidgetOnboardingStep[];
  issues: WidgetCommercialIssue[];
  next_action: WidgetCommercialIssue | null;
};

function activeSubscription(status: string | null) {
  return !status || ["active", "trialing"].includes(status.toLowerCase());
}

export function emptyWidgetCommercialMetrics(): WidgetCommercialMetrics {
  return {
    usage_this_month: 0,
    blocked_this_month: 0,
    enquiries_this_month: 0,
    failed_enquiries_this_month: 0,
    pending_domain_request_count: 0,
    active_key_count: 0,
    last_allowed_at: null,
    last_blocked_at: null,
    last_enquiry_at: null,
    latest_requested_domain: null,
  };
}

export function evaluateWidgetCommercialHealth(
  client: WidgetCommercialClient,
  metrics: WidgetCommercialMetrics,
): WidgetCommercialHealth {
  const subscriptionReady = client.status === "active" && activeSubscription(client.stripe_subscription_status);
  const contactReady = Boolean(
    (client.email_enquiries_enabled && client.enquiry_email) ||
    (client.whatsapp_enquiries_enabled && client.whatsapp_number),
  );
  const onboardingSteps: WidgetOnboardingStep[] = [
    { id: "subscription", label: "Commercial access active", complete: subscriptionReady },
    { id: "domain", label: "Live origin verified", complete: client.domain_verified },
    { id: "key", label: "Installation key available", complete: metrics.active_key_count > 0 },
    { id: "enabled", label: "Widget delivery enabled", complete: client.widget_enabled && !client.admin_suspended },
    { id: "installation", label: "First live load received", complete: metrics.usage_this_month > 0 },
    { id: "contact", label: "Lead channel configured", complete: contactReady },
  ];
  const issues: WidgetCommercialIssue[] = [];

  if (client.status === "past_due" || ["past_due", "unpaid", "incomplete"].includes(client.stripe_subscription_status?.toLowerCase() ?? "")) {
    issues.push({ code: "billing_attention", severity: "critical", title: "Billing needs attention", detail: "The subscription is not in an active billing state." });
  }
  if (client.admin_suspended || client.status === "suspended") {
    issues.push({ code: "admin_suspended", severity: "critical", title: "Access is suspended", detail: "Public widget delivery is blocked by an admin control." });
  }
  if (!client.widget_enabled && !["cancelled", "suspended"].includes(client.status)) {
    issues.push({ code: "delivery_disabled", severity: "critical", title: "Widget delivery is disabled", detail: "The account is active but public delivery is switched off." });
  }
  if (!client.domain_verified) {
    issues.push({ code: "domain_unverified", severity: "warning", title: "Live origin not verified", detail: "No successful load has confirmed the approved website domain yet." });
  }
  if (metrics.active_key_count === 0 && client.status !== "cancelled") {
    issues.push({ code: "key_missing", severity: "critical", title: "No active installation key", detail: "The client cannot install or load the widget until a key is issued." });
  }
  if (metrics.pending_domain_request_count > 0) {
    issues.push({ code: "domain_review", severity: "warning", title: "Domain review waiting", detail: `${metrics.pending_domain_request_count} domain change request${metrics.pending_domain_request_count === 1 ? " is" : "s are"} waiting for review.` });
  }
  if (metrics.blocked_this_month >= 10) {
    issues.push({ code: "blocked_traffic", severity: "warning", title: "Repeated blocked traffic", detail: `${metrics.blocked_this_month} widget requests were blocked this month.` });
  }
  if (metrics.failed_enquiries_this_month > 0) {
    issues.push({ code: "lead_delivery", severity: "critical", title: "Lead delivery failures", detail: `${metrics.failed_enquiries_this_month} customer enquir${metrics.failed_enquiries_this_month === 1 ? "y" : "ies"} could not be delivered this month.` });
  }
  if (!contactReady && client.status !== "cancelled") {
    issues.push({ code: "contact_missing", severity: "warning", title: "No lead channel configured", detail: "Visitors can inspect vehicle data but cannot submit an enquiry." });
  }

  const usagePercent = client.monthly_usage_limit > 0
    ? Math.min(100, Math.round((metrics.usage_this_month / client.monthly_usage_limit) * 100))
    : 0;
  if (client.monthly_usage_limit > 0 && usagePercent >= 85) {
    issues.push({ code: "usage_limit", severity: usagePercent >= 100 ? "critical" : "warning", title: "Usage allowance running low", detail: `${usagePercent}% of the monthly load allowance has been used.` });
  }

  let score = onboardingSteps.reduce((total, step) => total + (step.complete ? 14 : 0), 0) + (metrics.blocked_this_month === 0 ? 8 : 0) + (metrics.failed_enquiries_this_month === 0 ? 8 : 0);
  score -= issues.filter((issue) => issue.severity === "critical").length * 15;
  score -= issues.filter((issue) => issue.severity === "warning").length * 6;
  score = Math.max(0, Math.min(100, score));

  let stage: WidgetCommercialStage;
  if (client.status === "cancelled") stage = "churned";
  else if (client.admin_suspended || client.status === "suspended") stage = "paused";
  else if (issues.some((issue) => issue.severity === "critical")) stage = "attention";
  else if (metrics.usage_this_month > 0 && subscriptionReady) stage = "live";
  else if (subscriptionReady && client.domain_verified && metrics.active_key_count > 0 && client.widget_enabled) stage = "ready";
  else if (client.status === "pending") stage = "prospect";
  else stage = "onboarding";

  const level: WidgetCommercialHealthLevel = stage === "churned"
    ? "inactive"
    : score >= 80
      ? "healthy"
      : score >= 55
        ? "watch"
        : "critical";
  const orderedIssues = [...issues].sort((a, b) => {
    const priority = { critical: 0, warning: 1, info: 2 } as const;
    return priority[a.severity] - priority[b.severity];
  });

  return {
    stage,
    level,
    score,
    usage_percent: usagePercent,
    onboarding_completed: onboardingSteps.filter((step) => step.complete).length,
    onboarding_total: onboardingSteps.length,
    onboarding_steps: onboardingSteps,
    issues: orderedIssues,
    next_action: orderedIssues[0] ?? null,
  };
}
