import { emailLocaleCopy } from "@/lib/email/localeCopy";
import type {
  TransactionalEmailEventType,
  TransactionalEmailLanguage,
} from "@/lib/email/types";

export type EmailStatusSource = "legacy_order" | "work_order" | "delivery";

type LifecycleCopy = (typeof emailLocaleCopy)["en"]["lifecycle"];
type StatusKey = keyof LifecycleCopy;
type ActionKey = Extract<StatusKey, "checkMessage" | "uploadFile">;

type LocalizedStatusEmailDefinition = {
  eventType: TransactionalEmailEventType;
  statusKey: StatusKey;
  actionKey?: ActionKey;
};

type StatusEmailDefinition = {
  eventType: TransactionalEmailEventType;
  statusLabel: string;
  actionRequired?: string;
};

const legacyOrderStatusEmails: Record<string, LocalizedStatusEmailDefinition> = {
  file_check: { eventType: "request_in_review", statusKey: "fileReview" },
  in_progress: { eventType: "request_in_progress", statusKey: "inProgress" },
  customer_info_needed: {
    eventType: "request_waiting_for_customer",
    statusKey: "responseRequired",
    actionKey: "checkMessage",
  },
  revision: { eventType: "request_in_review", statusKey: "revisionReview" },
  completed: { eventType: "request_completed", statusKey: "completed" },
  cancelled: { eventType: "request_cancelled", statusKey: "cancelled" },
};

const workOrderStatusEmails: Record<string, LocalizedStatusEmailDefinition> = {
  waiting_for_file: {
    eventType: "additional_file_requested",
    statusKey: "fileRequired",
    actionKey: "uploadFile",
  },
  file_received: { eventType: "request_received", statusKey: "fileReceived" },
  in_analysis: { eventType: "request_in_review", statusKey: "technicalReview" },
  in_progress: { eventType: "request_in_progress", statusKey: "inProgress" },
  waiting_for_customer: {
    eventType: "request_waiting_for_customer",
    statusKey: "responseRequired",
    actionKey: "checkMessage",
  },
  ready_for_delivery: {
    eventType: "request_completed",
    statusKey: "readyForDelivery",
  },
  delivered: { eventType: "request_delivered", statusKey: "delivered" },
  completed: { eventType: "request_completed", statusKey: "completed" },
  cancelled: { eventType: "request_cancelled", statusKey: "cancelled" },
  needs_review: { eventType: "request_in_review", statusKey: "manualReview" },
};

const deliveryStatusEmails: Record<string, LocalizedStatusEmailDefinition> = {
  delivered: { eventType: "request_delivered", statusKey: "delivered" },
};

export function resolveStatusEmail(
  status: string | null | undefined,
  source: EmailStatusSource,
  language: TransactionalEmailLanguage = "en"
): StatusEmailDefinition | null {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized) return null;

  const definition = source === "legacy_order"
    ? legacyOrderStatusEmails[normalized]
    : source === "delivery"
      ? deliveryStatusEmails[normalized]
      : workOrderStatusEmails[normalized];
  if (!definition) return null;

  const copy = emailLocaleCopy[language].lifecycle;
  return {
    eventType: definition.eventType,
    statusLabel: copy[definition.statusKey],
    actionRequired: definition.actionKey ? copy[definition.actionKey] : undefined,
  };
}

export function shouldSendStatusTransition(input: {
  previousStatus?: string | null;
  nextStatus?: string | null;
  source: EmailStatusSource;
}) {
  const previous = String(input.previousStatus || "").trim().toLowerCase();
  const next = String(input.nextStatus || "").trim().toLowerCase();
  return Boolean(next && next !== previous && resolveStatusEmail(next, input.source));
}

export function buildLifecycleIdempotencyKey(
  parts: Array<string | null | undefined>
) {
  return parts
    .map((part) => String(part || "").trim().toLowerCase().replace(/[^a-z0-9:_-]+/g, "_"))
    .filter(Boolean)
    .join(":")
    .slice(0, 240);
}

export function listLifecycleStatusCoverage() {
  return [
    ...Object.entries(legacyOrderStatusEmails).map(([status, definition]) => ({
      source: "legacy_order" as const,
      status,
      eventType: definition.eventType,
    })),
    ...Object.entries(workOrderStatusEmails).map(([status, definition]) => ({
      source: "work_order" as const,
      status,
      eventType: definition.eventType,
    })),
    ...Object.entries(deliveryStatusEmails).map(([status, definition]) => ({
      source: "delivery" as const,
      status,
      eventType: definition.eventType,
    })),
  ];
}
