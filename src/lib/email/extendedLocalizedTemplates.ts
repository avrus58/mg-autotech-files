import { emailLocaleCopy } from "@/lib/email/localeCopy";
import {
  detailTable,
  escapeHtml,
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

export type ExtendedTransactionalEmailLanguage = Exclude<
  TransactionalEmailLanguage,
  "de" | "en" | "tr"
>;

type EventKey = keyof (typeof emailLocaleCopy)["en"]["events"];

const eventKeys: Partial<Record<TransactionalEmailEventType, EventKey>> = {
  customer_welcome: "accountReady",
  customer_password_reset: "passwordReset",
  request_created: "requestCreated",
  request_abandoned_reminder: "requestReminder",
  request_received: "requestReceived",
  file_uploaded: "fileReceived",
  additional_file_requested: "additionalFileRequired",
  additional_file_uploaded_customer: "additionalFileReceived",
  request_in_review: "requestReview",
  request_in_progress: "requestProgress",
  request_waiting_for_customer: "responseRequired",
  request_completed: "requestCompleted",
  request_delivered: "requestDelivered",
  request_cancelled: "requestCancelled",
  request_rejected_or_not_possible: "requestNotPossible",
  credit_purchase_started: "creditPurchase",
  bank_transfer_instructions: "bankTransfer",
  payment_received: "paymentReceived",
  credits_added: "creditsAdded",
  payment_failed: "paymentFailed",
  payment_pending_review: "paymentReview",
  customer_visible_message_added: "newMessage",
  upload_permission_enabled: "uploadEnabled",
  upload_permission_disabled: "uploadDisabled",
  delivery_completed: "requestDelivered",
};

const fileEvents = new Set<TransactionalEmailEventType>([
  "file_uploaded",
  "additional_file_requested",
  "additional_file_uploaded_customer",
  "upload_permission_enabled",
  "upload_permission_disabled",
]);
const paymentEvents = new Set<TransactionalEmailEventType>([
  "credit_purchase_started",
  "bank_transfer_instructions",
  "payment_received",
  "credits_added",
  "payment_failed",
  "payment_pending_review",
]);

function introFor(
  eventType: TransactionalEmailEventType,
  language: ExtendedTransactionalEmailLanguage
) {
  const copy = emailLocaleCopy[language];
  if (eventType === "customer_welcome") return copy.intros.account;
  if (eventType === "customer_password_reset") return copy.intros.password;
  if (eventType === "customer_visible_message_added") return copy.intros.message;
  if (fileEvents.has(eventType)) return copy.intros.file;
  if (paymentEvents.has(eventType)) return copy.intros.payment;
  return copy.intros.request;
}

export function renderExtendedLocalizedTransactionalEmailTemplate(
  eventType: TransactionalEmailEventType,
  context: TransactionalEmailContext,
  language: ExtendedTransactionalEmailLanguage
): RenderedTransactionalEmail {
  const copy = emailLocaleCopy[language];
  const eventKey = eventKeys[eventType] ?? "requestProgress";
  const title = copy.events[eventKey];
  const intro = introFor(eventType, language);
  const requestReference = context.requestNumber && context.requestNumber !== "-"
    ? ` ${safeText(context.requestNumber)}`
    : "";
  const subject = `MG AutoTech - ${title}${requestReference}`;
  const ctaUrl = eventType === "customer_password_reset"
    ? context.recoveryUrl
    : context.dashboardUrl;
  const ctaLabel = eventType === "customer_password_reset"
    ? copy.actions.resetPassword
    : copy.actions.openDashboard;
  const rows: Array<[string, unknown]> = [
    [copy.details.reference, context.requestNumber],
    [copy.details.customerId, context.customerId],
    [copy.details.status, context.statusLabel],
    [copy.details.vehicle, context.vehicleSummary],
    [copy.details.services, context.serviceSummary],
    [copy.details.file, context.fileName],
    [copy.details.amount, context.amountLabel],
    [copy.details.credits, context.credits],
    [copy.details.paymentReference, context.paymentReference],
    [copy.details.accountHolder, context.bankAccountName],
    [copy.details.bank, context.bankName],
    ["IBAN", context.bankIban],
    ["BIC", context.bankBic],
    [copy.details.message, context.messagePreview],
  ];
  const actionRequired = context.actionRequired
    ? `<div style="margin:18px 0 0;border:1px solid #f2c6ca;background:#fff7f8;padding:14px 16px;color:#7f1d1d;font-size:13px;line-height:1.65;"><strong>${escapeHtml(copy.details.actionRequired)}:</strong> ${escapeHtml(safeText(context.actionRequired))}</div>`
    : "";
  const footerNote = eventType === "customer_password_reset"
    ? copy.passwordFooter
    : undefined;
  const html = htmlLayout({
    language,
    preheader: intro,
    title,
    intro,
    content: `${detailTable(rows)}${actionRequired}`,
    ctaLabel,
    ctaUrl,
    footerNote,
  });
  const text = textBlock([
    "MG AutoTech",
    title,
    "",
    intro,
    "",
    ...rows.map(([label, value]) => {
      const visible = safeText(value, "");
      return visible ? `${label}: ${visible}` : null;
    }),
    context.actionRequired
      ? `${copy.details.actionRequired}: ${safeText(context.actionRequired)}`
      : null,
    "",
    ctaUrl ? `${ctaLabel}: ${ctaUrl}` : null,
    `${copy.details.support}: ${safeText(context.supportEmail)}`,
  ]);

  return { subject, html, text };
}
