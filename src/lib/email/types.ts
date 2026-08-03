export const transactionalEmailEventTypes = [
  "customer_registered",
  "customer_welcome",
  "customer_password_reset",
  "request_created",
  "request_received",
  "file_uploaded",
  "additional_file_requested",
  "additional_file_uploaded",
  "additional_file_uploaded_customer",
  "request_in_review",
  "request_in_progress",
  "request_waiting_for_customer",
  "request_completed",
  "request_delivered",
  "request_cancelled",
  "request_rejected_or_not_possible",
  "credit_purchase_started",
  "bank_transfer_instructions",
  "payment_received",
  "credits_added",
  "payment_failed",
  "payment_pending_review",
  "customer_visible_message_added",
  "upload_permission_enabled",
  "upload_permission_disabled",
  "delivery_completed",
  "new_request_admin_notification",
  "payment_needs_review_admin_notification",
  "customer_replied_admin_notification",
  "revision_requested_admin_notification",
  "file_uploaded_admin_notification",
  "failed_email_admin_alert",
  "admin_email_test",
] as const;

export type TransactionalEmailEventType = (typeof transactionalEmailEventTypes)[number];
export type TransactionalEmailLanguage = "de" | "en" | "tr";
export type EmailDeliveryStatus = "pending" | "sent" | "failed" | "skipped";

export type TransactionalEmailContext = {
  requestId?: string | null;
  requestNumber?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  vehicleSummary?: string | null;
  serviceSummary?: string | null;
  dashboardUrl?: string | null;
  adminUrl?: string | null;
  messagePreview?: string | null;
  statusLabel?: string | null;
  actionRequired?: string | null;
  fileName?: string | null;
  credits?: number | null;
  amountLabel?: string | null;
  paymentReference?: string | null;
  bankAccountName?: string | null;
  bankName?: string | null;
  bankIban?: string | null;
  bankBic?: string | null;
  nextSteps?: string[];
  supportEmail?: string | null;
  companyName?: string | null;
  recoveryUrl?: string | null;
};

export type RenderedTransactionalEmail = {
  subject: string;
  html: string;
  text: string;
};

export type SendTransactionalEmailInput = {
  eventType: TransactionalEmailEventType;
  to: string;
  language?: TransactionalEmailLanguage;
  context: TransactionalEmailContext;
  idempotencyKey: string;
  recipientUserId?: string | null;
  relatedOrderId?: string | null;
  relatedRequestId?: string | null;
  metadata?: Record<string, unknown>;
};

export type SendTransactionalEmailResult = {
  ok: boolean;
  status: EmailDeliveryStatus;
  provider: "resend" | "dry_run" | "disabled";
  messageId?: string | null;
  skippedReason?: string | null;
  error?: string | null;
  idempotencyKey: string;
};

export type EmailEventLogInput = {
  eventType: TransactionalEmailEventType;
  recipientEmail: string;
  recipientUserId?: string | null;
  relatedOrderId?: string | null;
  relatedRequestId?: string | null;
  idempotencyKey: string;
  status: EmailDeliveryStatus;
  provider: string;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};
