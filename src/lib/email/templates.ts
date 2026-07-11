import {
  detailTable,
  escapeHtml,
  getDefaultEmailContext,
  htmlLayout,
  safeText,
  textBlock,
} from "@/lib/email/render";
import type {
  RenderedTransactionalEmail,
  TransactionalEmailContext,
  TransactionalEmailEventType,
  TransactionalEmailLanguage,
} from "@/lib/email/types";

type TemplateDefinition = {
  label: string;
  audience: "customer" | "admin";
  render: (context: TransactionalEmailContext) => RenderedTransactionalEmail;
};

const customerDetails = (context: TransactionalEmailContext) =>
  detailTable([
    ["Referenz", context.requestNumber],
    ["Kunden-ID", context.customerId],
    ["Fahrzeug", context.vehicleSummary],
    ["Leistungen", context.serviceSummary],
  ]);

const paymentDetails = (context: TransactionalEmailContext) =>
  detailTable([
    ["Betrag", context.amountLabel],
    ["Credits", context.credits ?? null],
    ["Zahlungsreferenz", context.paymentReference || context.customerId || context.requestNumber],
    ["Kontoinhaber", context.bankAccountName],
    ["Bank", context.bankName],
    ["IBAN", context.bankIban],
    ["BIC", context.bankBic],
  ]);

function customerTemplate(input: {
  subject: string;
  title: string;
  intro: string;
  context: TransactionalEmailContext;
  details?: string;
  ctaLabel?: string;
  ctaUrl?: string | null;
  extraText?: string;
}) {
  const html = htmlLayout({
    preheader: input.intro,
    title: input.title,
    intro: input.intro,
    content: `${input.details ?? customerDetails(input.context)}${input.extraText ? `<p style="margin:18px 0 0;color:#3f3f46;line-height:1.65;">${escapeHtml(safeText(input.extraText))}</p>` : ""}`,
    ctaLabel: input.ctaLabel || "Dashboard öffnen",
    ctaUrl: input.ctaUrl || input.context.dashboardUrl,
  });
  const text = textBlock([
    "MG AutoTech",
    input.title,
    "",
    input.intro,
    "",
    `Referenz: ${safeText(input.context.requestNumber)}`,
    input.context.customerId ? `Kunden-ID: ${safeText(input.context.customerId)}` : null,
    input.context.vehicleSummary ? `Fahrzeug: ${safeText(input.context.vehicleSummary)}` : null,
    input.context.serviceSummary ? `Leistungen: ${safeText(input.context.serviceSummary)}` : null,
    input.context.amountLabel ? `Betrag: ${safeText(input.context.amountLabel)}` : null,
    typeof input.context.credits === "number" ? `Credits: ${input.context.credits}` : null,
    input.context.paymentReference ? `Zahlungsreferenz: ${safeText(input.context.paymentReference)}` : null,
    input.context.bankAccountName ? `Kontoinhaber: ${safeText(input.context.bankAccountName)}` : null,
    input.context.bankName ? `Bank: ${safeText(input.context.bankName)}` : null,
    input.context.bankIban ? `IBAN: ${safeText(input.context.bankIban)}` : null,
    input.context.bankBic ? `BIC: ${safeText(input.context.bankBic)}` : null,
    input.extraText || null,
    "",
    input.context.dashboardUrl ? `Dashboard: ${input.context.dashboardUrl}` : null,
    `Support: ${safeText(input.context.supportEmail)}`,
  ]);
  return { subject: input.subject, html, text };
}

function adminTemplate(input: {
  subject: string;
  title: string;
  intro: string;
  context: TransactionalEmailContext;
  details?: string;
}) {
  const html = htmlLayout({
    preheader: input.intro,
    title: input.title,
    intro: input.intro,
    content: input.details ?? customerDetails(input.context),
    ctaLabel: "Admin öffnen",
    ctaUrl: input.context.adminUrl,
    footerNote: "Admin-Benachrichtigung. Keine Rohdaten, Hex-Previews oder privaten Speicherpfade enthalten.",
  });
  const text = textBlock([
    "MG AutoTech Admin",
    input.title,
    "",
    input.intro,
    "",
    `Referenz: ${safeText(input.context.requestNumber)}`,
    input.context.customerEmail ? `Kunde: ${safeText(input.context.customerEmail)}` : null,
    input.context.vehicleSummary ? `Fahrzeug: ${safeText(input.context.vehicleSummary)}` : null,
    input.context.serviceSummary ? `Leistungen: ${safeText(input.context.serviceSummary)}` : null,
    "",
    input.context.adminUrl ? `Admin: ${input.context.adminUrl}` : null,
  ]);
  return { subject: input.subject, html, text };
}

const deTemplates: Record<TransactionalEmailEventType, TemplateDefinition> = {
  customer_registered: {
    label: "Kunde registriert",
    audience: "admin",
    render: (context) => adminTemplate({
      subject: `Neuer MG AutoTech Kunde: ${safeText(context.customerEmail, "Kunde")}`,
      title: "Neuer Kunde registriert",
      intro: "Ein neues Kundenkonto wurde auf der MG AutoTech Plattform erstellt.",
      context,
      details: detailTable([
        ["E-Mail", context.customerEmail],
        ["Name", context.customerName],
        ["Firma", context.companyName],
        ["Kunden-ID", context.customerId],
      ]),
    }),
  },
  request_created: {
    label: "Anfrage erstellt",
    audience: "customer",
    render: (context) => customerTemplate({
      subject: `MG AutoTech – Ihre Anfrage ${context.requestNumber} wurde erstellt`,
      title: `Ihre Anfrage ${context.requestNumber} wurde erstellt`,
      intro: "Vielen Dank. Ihre Dateianfrage ist bei MG AutoTech eingegangen und wird sicher im Kundenportal verarbeitet.",
      context,
      extraText: "Nächster Schritt: Unser Team prüft Datei, Fahrzeugdaten und gewünschte Leistungen. Bitte behalten Sie Ihr Dashboard im Blick.",
    }),
  },
  request_received: {
    label: "Anfrage erhalten",
    audience: "customer",
    render: (context) => customerTemplate({
      subject: `MG AutoTech – Anfrage ${context.requestNumber} erhalten`,
      title: "Anfrage erhalten",
      intro: "Ihre Anfrage wurde erfolgreich übernommen.",
      context,
    }),
  },
  file_uploaded: {
    label: "Datei erhalten",
    audience: "customer",
    render: (context) => customerTemplate({
      subject: `MG AutoTech – Datei zu Anfrage ${context.requestNumber} erhalten`,
      title: "Datei erhalten",
      intro: "Ihre Datei wurde empfangen. Die weitere Prüfung erfolgt im geschützten MG AutoTech Dashboard.",
      context,
      details: detailTable([
        ["Referenz", context.requestNumber],
        ["Datei", context.fileName],
        ["Fahrzeug", context.vehicleSummary],
        ["Leistungen", context.serviceSummary],
      ]),
    }),
  },
  additional_file_requested: {
    label: "Weitere Datei benötigt",
    audience: "customer",
    render: (context) => customerTemplate({
      subject: `MG AutoTech – Weitere Datei benötigt für Anfrage ${context.requestNumber}`,
      title: "Weitere Datei benötigt",
      intro: "Für die Bearbeitung Ihrer Anfrage wurde ein zusätzlicher Upload im Dashboard freigeschaltet.",
      context,
      extraText: "Bitte laden Sie nur die angeforderte Datei über das Kundenportal hoch. Dateien werden nicht per E-Mail verarbeitet.",
    }),
  },
  additional_file_uploaded: {
    label: "Zusätzliche Datei hochgeladen",
    audience: "admin",
    render: (context) => adminTemplate({
      subject: `Zusätzliche Datei zu Anfrage ${context.requestNumber} hochgeladen`,
      title: "Kunde hat eine zusätzliche Datei hochgeladen",
      intro: "Eine angeforderte zusätzliche Datei wurde im Portal hochgeladen.",
      context,
      details: detailTable([
        ["Referenz", context.requestNumber],
        ["Datei", context.fileName],
        ["Kunde", context.customerEmail],
        ["Fahrzeug", context.vehicleSummary],
      ]),
    }),
  },
  request_in_review: {
    label: "Anfrage in Prüfung",
    audience: "customer",
    render: (context) => customerTemplate({
      subject: `MG AutoTech – Ihre Anfrage ${context.requestNumber} wird geprüft`,
      title: "Ihre Anfrage wird geprüft",
      intro: "Unser Team prüft Ihre Datei und die gewählten Leistungen.",
      context,
    }),
  },
  request_in_progress: {
    label: "Anfrage in Bearbeitung",
    audience: "customer",
    render: (context) => customerTemplate({
      subject: `MG AutoTech – Ihre Anfrage ${context.requestNumber} ist in Bearbeitung`,
      title: "Ihre Anfrage ist in Bearbeitung",
      intro: "Ihre Anfrage befindet sich jetzt in der Bearbeitung durch MG AutoTech.",
      context,
    }),
  },
  request_waiting_for_customer: {
    label: "Wartet auf Kunde",
    audience: "customer",
    render: (context) => customerTemplate({
      subject: `MG AutoTech – Rückmeldung benötigt zu Anfrage ${context.requestNumber}`,
      title: "Ihre Rückmeldung wird benötigt",
      intro: "Für die weitere Bearbeitung benötigen wir eine Rückmeldung oder eine zusätzliche Datei von Ihnen.",
      context,
    }),
  },
  request_completed: {
    label: "Anfrage abgeschlossen",
    audience: "customer",
    render: (context) => customerTemplate({
      subject: `MG AutoTech – Ihre Anfrage ${context.requestNumber} wurde abgeschlossen`,
      title: "Ihre Anfrage wurde abgeschlossen",
      intro: "Die Bearbeitung Ihrer Anfrage wurde abgeschlossen. Details finden Sie im Dashboard.",
      context,
    }),
  },
  request_delivered: {
    label: "Anfrage geliefert",
    audience: "customer",
    render: (context) => customerTemplate({
      subject: `MG AutoTech – Ihre Datei zu Anfrage ${context.requestNumber} ist bereit`,
      title: "Ihre Datei ist bereit",
      intro: "Die finalen Informationen zu Ihrer Anfrage sind im geschützten Dashboard verfügbar.",
      context,
    }),
  },
  request_cancelled: {
    label: "Anfrage storniert",
    audience: "customer",
    render: (context) => customerTemplate({
      subject: `MG AutoTech – Ihre Anfrage ${context.requestNumber} wurde storniert`,
      title: "Ihre Anfrage wurde storniert",
      intro: "Diese Anfrage wurde storniert. Bei Fragen kontaktieren Sie bitte den Support.",
      context,
    }),
  },
  request_rejected_or_not_possible: {
    label: "Anfrage nicht möglich",
    audience: "customer",
    render: (context) => customerTemplate({
      subject: `MG AutoTech – Anfrage ${context.requestNumber} nicht möglich`,
      title: "Anfrage aktuell nicht möglich",
      intro: "Nach Prüfung ist diese Anfrage aktuell nicht sicher umsetzbar. Details erhalten Sie über das Dashboard oder den Support.",
      context,
    }),
  },
  credit_purchase_started: {
    label: "Credit-Kauf gestartet",
    audience: "customer",
    render: (context) => customerTemplate({
      subject: "MG AutoTech – Credit-Kauf gestartet",
      title: "Credit-Kauf gestartet",
      intro: "Ihr Credit-Kauf wurde gestartet. Die Gutschrift erfolgt nach erfolgreicher Zahlungsbestätigung.",
      context,
      details: paymentDetails(context),
    }),
  },
  bank_transfer_instructions: {
    label: "Banküberweisung",
    audience: "customer",
    render: (context) => customerTemplate({
      subject: `MG AutoTech – Zahlungsinformationen ${context.requestNumber && context.requestNumber !== "-" ? `für Anfrage ${context.requestNumber}` : "für Credits"}`,
      title: "Zahlungsinformationen für Banküberweisung",
      intro: "Bitte verwenden Sie die angegebene Referenz, damit Ihre Zahlung korrekt zugeordnet werden kann.",
      context,
      details: paymentDetails(context),
      extraText: "Credits werden manuell gutgeschrieben, sobald die Zahlung geprüft wurde.",
    }),
  },
  payment_received: {
    label: "Zahlung erhalten",
    audience: "customer",
    render: (context) => customerTemplate({
      subject: "MG AutoTech – Zahlung erhalten",
      title: "Zahlung erhalten",
      intro: "Ihre Zahlung wurde bestätigt.",
      context,
      details: paymentDetails(context),
    }),
  },
  credits_added: {
    label: "Credits gutgeschrieben",
    audience: "customer",
    render: (context) => customerTemplate({
      subject: "MG AutoTech – Credits wurden gutgeschrieben",
      title: "Credits wurden gutgeschrieben",
      intro: "Ihre Credits wurden Ihrem MG AutoTech Konto gutgeschrieben.",
      context,
      details: paymentDetails(context),
    }),
  },
  payment_failed: {
    label: "Zahlung fehlgeschlagen",
    audience: "customer",
    render: (context) => customerTemplate({
      subject: "MG AutoTech – Zahlung fehlgeschlagen",
      title: "Zahlung fehlgeschlagen",
      intro: "Die Zahlung konnte nicht bestätigt werden. Bitte versuchen Sie es erneut oder wählen Sie Banküberweisung.",
      context,
    }),
  },
  payment_pending_review: {
    label: "Zahlung in Prüfung",
    audience: "customer",
    render: (context) => customerTemplate({
      subject: "MG AutoTech – Zahlung wird geprüft",
      title: "Zahlung wird geprüft",
      intro: "Ihre Zahlung wartet auf manuelle Prüfung.",
      context,
    }),
  },
  customer_visible_message_added: {
    label: "Neue Nachricht",
    audience: "customer",
    render: (context) => customerTemplate({
      subject: `MG AutoTech – Neue Nachricht zu Anfrage ${context.requestNumber}`,
      title: "Neue Nachricht zu Ihrer Anfrage",
      intro: "MG AutoTech hat Ihnen eine neue Nachricht im Kundenportal gesendet.",
      context,
      details: `${customerDetails(context)}${detailTable([["Nachricht", context.messagePreview]])}`,
    }),
  },
  upload_permission_enabled: {
    label: "Upload freigeschaltet",
    audience: "customer",
    render: (context) => deTemplates.additional_file_requested.render(context),
  },
  upload_permission_disabled: {
    label: "Upload deaktiviert",
    audience: "customer",
    render: (context) => customerTemplate({
      subject: `MG AutoTech – Upload zu Anfrage ${context.requestNumber} deaktiviert`,
      title: "Zusätzlicher Upload deaktiviert",
      intro: "Der zusätzliche Upload für diese Anfrage wurde deaktiviert.",
      context,
    }),
  },
  delivery_completed: {
    label: "Lieferung abgeschlossen",
    audience: "customer",
    render: (context) => deTemplates.request_delivered.render(context),
  },
  new_request_admin_notification: {
    label: "Neue Anfrage Admin",
    audience: "admin",
    render: (context) => adminTemplate({
      subject: `Neue MG AutoTech Anfrage ${context.requestNumber}`,
      title: "Neue Anfrage eingegangen",
      intro: "Eine neue Kundenanfrage wurde erstellt.",
      context,
      details: detailTable([
        ["Referenz", context.requestNumber],
        ["Kunde", context.customerEmail],
        ["Kunden-ID", context.customerId],
        ["Fahrzeug", context.vehicleSummary],
        ["Leistungen", context.serviceSummary],
        ["Credits", context.credits ?? null],
      ]),
    }),
  },
  payment_needs_review_admin_notification: {
    label: "Zahlung braucht Prüfung",
    audience: "admin",
    render: (context) => adminTemplate({
      subject: "MG AutoTech Zahlung benötigt Prüfung",
      title: "Zahlung benötigt Prüfung",
      intro: "Eine Zahlung sollte im Adminbereich geprüft werden.",
      context,
      details: paymentDetails(context),
    }),
  },
  customer_replied_admin_notification: {
    label: "Kundenantwort Admin",
    audience: "admin",
    render: (context) => adminTemplate({
      subject: `Kundenantwort zu Anfrage ${context.requestNumber}`,
      title: "Kunde hat geantwortet",
      intro: "Im Kundenportal wurde eine neue Nachricht erstellt.",
      context,
      details: `${customerDetails(context)}${detailTable([["Nachricht", context.messagePreview]])}`,
    }),
  },
  file_uploaded_admin_notification: {
    label: "Datei hochgeladen Admin",
    audience: "admin",
    render: (context) => adminTemplate({
      subject: `Datei zu Anfrage ${context.requestNumber} hochgeladen`,
      title: "Datei hochgeladen",
      intro: "Eine Datei wurde im Kundenportal hochgeladen.",
      context,
      details: detailTable([
        ["Referenz", context.requestNumber],
        ["Datei", context.fileName],
        ["Kunde", context.customerEmail],
        ["Fahrzeug", context.vehicleSummary],
      ]),
    }),
  },
  failed_email_admin_alert: {
    label: "Email Fehler Admin",
    audience: "admin",
    render: (context) => adminTemplate({
      subject: "MG AutoTech E-Mail Versandfehler",
      title: "E-Mail Versandfehler",
      intro: "Eine transaktionale E-Mail konnte nicht versendet werden.",
      context,
    }),
  },
  admin_email_test: {
    label: "Admin Test",
    audience: "admin",
    render: (context) => adminTemplate({
      subject: "MG AutoTech – Test-E-Mail",
      title: "Test-E-Mail",
      intro: "Dies ist eine sichere Test-E-Mail aus dem Adminbereich.",
      context,
    }),
  },
};

export function renderTransactionalEmailTemplate(
  eventType: TransactionalEmailEventType,
  context: TransactionalEmailContext,
  language: TransactionalEmailLanguage = "de"
) {
  const fullContext = getDefaultEmailContext(context);
  const templates = language === "de" ? deTemplates : deTemplates;
  return templates[eventType].render(fullContext);
}

export function listTransactionalEmailTemplates() {
  return Object.entries(deTemplates).map(([eventType, definition]) => ({
    eventType,
    label: definition.label,
    audience: definition.audience,
  }));
}
