import type { TransactionalEmailEventType } from "@/lib/email/types";

export type EmailStatusSource = "legacy_order" | "work_order" | "delivery";

type StatusEmailDefinition = {
  eventType: TransactionalEmailEventType;
  statusLabel: string;
  actionRequired?: string;
};

const legacyOrderStatusEmails: Record<string, StatusEmailDefinition> = {
  file_check: {
    eventType: "request_in_review",
    statusLabel: "Dateiprüfung",
  },
  in_progress: {
    eventType: "request_in_progress",
    statusLabel: "In Bearbeitung",
  },
  customer_info_needed: {
    eventType: "request_waiting_for_customer",
    statusLabel: "Rückmeldung erforderlich",
    actionRequired: "Bitte öffnen Sie Ihre Anfrage und prüfen Sie die aktuelle Nachricht im Kundenportal.",
  },
  revision: {
    eventType: "request_in_review",
    statusLabel: "Revision in Prüfung",
  },
  completed: {
    eventType: "request_completed",
    statusLabel: "Abgeschlossen",
  },
  cancelled: {
    eventType: "request_cancelled",
    statusLabel: "Storniert",
  },
};

const workOrderStatusEmails: Record<string, StatusEmailDefinition> = {
  waiting_for_file: {
    eventType: "additional_file_requested",
    statusLabel: "Datei erforderlich",
    actionRequired: "Bitte öffnen Sie Ihre Anfrage und laden Sie die angeforderte Datei ausschließlich über das Kundenportal hoch.",
  },
  file_received: {
    eventType: "request_received",
    statusLabel: "Datei erhalten",
  },
  in_analysis: {
    eventType: "request_in_review",
    statusLabel: "Technische Prüfung",
  },
  in_progress: {
    eventType: "request_in_progress",
    statusLabel: "In Bearbeitung",
  },
  waiting_for_customer: {
    eventType: "request_waiting_for_customer",
    statusLabel: "Rückmeldung erforderlich",
    actionRequired: "Bitte öffnen Sie Ihre Anfrage und prüfen Sie die aktuelle Nachricht im Kundenportal.",
  },
  ready_for_delivery: {
    eventType: "request_completed",
    statusLabel: "Bereit zur Auslieferung",
  },
  delivered: {
    eventType: "request_delivered",
    statusLabel: "Ausgeliefert",
  },
  completed: {
    eventType: "request_completed",
    statusLabel: "Abgeschlossen",
  },
  cancelled: {
    eventType: "request_cancelled",
    statusLabel: "Storniert",
  },
  needs_review: {
    eventType: "request_in_review",
    statusLabel: "Manuelle Prüfung",
  },
};

const deliveryStatusEmails: Record<string, StatusEmailDefinition> = {
  delivered: {
    eventType: "request_delivered",
    statusLabel: "Ausgeliefert",
  },
};

export function resolveStatusEmail(
  status: string | null | undefined,
  source: EmailStatusSource
): StatusEmailDefinition | null {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized) return null;

  if (source === "legacy_order") return legacyOrderStatusEmails[normalized] ?? null;
  if (source === "delivery") return deliveryStatusEmails[normalized] ?? null;
  return workOrderStatusEmails[normalized] ?? null;
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

export function buildLifecycleIdempotencyKey(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => String(part || "").trim().toLowerCase().replace(/[^a-z0-9:_-]+/g, "_"))
    .filter(Boolean)
    .join(":")
    .slice(0, 240);
}

export function listLifecycleStatusCoverage() {
  const rows = [
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

  return rows;
}
