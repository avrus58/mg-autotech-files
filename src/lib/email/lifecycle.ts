import type {
  TransactionalEmailEventType,
  TransactionalEmailLanguage,
} from "@/lib/email/types";

export type EmailStatusSource = "legacy_order" | "work_order" | "delivery";

type LocalizedStatusEmailDefinition = {
  eventType: TransactionalEmailEventType;
  statusLabel: Record<TransactionalEmailLanguage, string>;
  actionRequired?: Record<TransactionalEmailLanguage, string>;
};

type StatusEmailDefinition = {
  eventType: TransactionalEmailEventType;
  statusLabel: string;
  actionRequired?: string;
};

const localized = (de: string, en: string, tr: string) => ({ de, en, tr });

const legacyOrderStatusEmails: Record<string, LocalizedStatusEmailDefinition> = {
  file_check: {
    eventType: "request_in_review",
    statusLabel: localized("Dateiprüfung", "File review", "Dosya incelemesi"),
  },
  in_progress: {
    eventType: "request_in_progress",
    statusLabel: localized("In Bearbeitung", "In progress", "İşleniyor"),
  },
  customer_info_needed: {
    eventType: "request_waiting_for_customer",
    statusLabel: localized("Rückmeldung erforderlich", "Response required", "Yanıt gerekli"),
    actionRequired: localized(
      "Bitte öffnen Sie Ihre Anfrage und prüfen Sie die aktuelle Nachricht im Kundenportal.",
      "Please open your request and review the latest message in the customer portal.",
      "Lütfen talebinizi açın ve müşteri panelindeki son mesajı kontrol edin."
    ),
  },
  revision: {
    eventType: "request_in_review",
    statusLabel: localized("Revision in Prüfung", "Revision under review", "Revizyon inceleniyor"),
  },
  completed: {
    eventType: "request_completed",
    statusLabel: localized("Abgeschlossen", "Completed", "Tamamlandı"),
  },
  cancelled: {
    eventType: "request_cancelled",
    statusLabel: localized("Storniert", "Cancelled", "İptal edildi"),
  },
};

const workOrderStatusEmails: Record<string, LocalizedStatusEmailDefinition> = {
  waiting_for_file: {
    eventType: "additional_file_requested",
    statusLabel: localized("Datei erforderlich", "File required", "Dosya gerekli"),
    actionRequired: localized(
      "Bitte öffnen Sie Ihre Anfrage und laden Sie die angeforderte Datei ausschließlich über das Kundenportal hoch.",
      "Please open your request and upload the requested file only through the customer portal.",
      "Lütfen talebinizi açın ve istenen dosyayı yalnızca müşteri panelinden yükleyin."
    ),
  },
  file_received: {
    eventType: "request_received",
    statusLabel: localized("Datei erhalten", "File received", "Dosya alındı"),
  },
  in_analysis: {
    eventType: "request_in_review",
    statusLabel: localized("Technische Prüfung", "Technical review", "Teknik inceleme"),
  },
  in_progress: {
    eventType: "request_in_progress",
    statusLabel: localized("In Bearbeitung", "In progress", "İşleniyor"),
  },
  waiting_for_customer: {
    eventType: "request_waiting_for_customer",
    statusLabel: localized("Rückmeldung erforderlich", "Response required", "Yanıt gerekli"),
    actionRequired: localized(
      "Bitte öffnen Sie Ihre Anfrage und prüfen Sie die aktuelle Nachricht im Kundenportal.",
      "Please open your request and review the latest message in the customer portal.",
      "Lütfen talebinizi açın ve müşteri panelindeki son mesajı kontrol edin."
    ),
  },
  ready_for_delivery: {
    eventType: "request_completed",
    statusLabel: localized("Bereit zur Auslieferung", "Ready for delivery", "Teslime hazır"),
  },
  delivered: {
    eventType: "request_delivered",
    statusLabel: localized("Ausgeliefert", "Delivered", "Teslim edildi"),
  },
  completed: {
    eventType: "request_completed",
    statusLabel: localized("Abgeschlossen", "Completed", "Tamamlandı"),
  },
  cancelled: {
    eventType: "request_cancelled",
    statusLabel: localized("Storniert", "Cancelled", "İptal edildi"),
  },
  needs_review: {
    eventType: "request_in_review",
    statusLabel: localized("Manuelle Prüfung", "Manual review", "Manuel inceleme"),
  },
};

const deliveryStatusEmails: Record<string, LocalizedStatusEmailDefinition> = {
  delivered: {
    eventType: "request_delivered",
    statusLabel: localized("Ausgeliefert", "Delivered", "Teslim edildi"),
  },
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

  return {
    eventType: definition.eventType,
    statusLabel: definition.statusLabel[language],
    actionRequired: definition.actionRequired?.[language],
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
