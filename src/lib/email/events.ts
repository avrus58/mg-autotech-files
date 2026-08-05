import { getAdminNotificationEmail, getSiteUrl, formatRequestReference } from "@/lib/email/render";
import { defaultTransactionalEmailLanguage } from "@/lib/email/language";
import { loadUserTransactionalEmailLanguage } from "@/lib/email/languageServer";
import { sendTransactionalEmail } from "@/lib/email/service";
import {
  buildLifecycleIdempotencyKey,
  resolveStatusEmail,
  shouldSendStatusTransition,
  type EmailStatusSource,
} from "@/lib/email/lifecycle";
import type {
  TransactionalEmailContext,
  TransactionalEmailLanguage,
} from "@/lib/email/types";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { filterCustomerVisibleRequestMessages, type RequestMessageVisibilityRow } from "@/lib/workOrders/messageVisibility";

type OrderEmailRow = {
  id: string;
  customer_id: string | null;
  customer_email: string | null;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_generation: string | null;
  vehicle_engine: string | null;
  service_type: string | null;
  credits_required: number | string | null;
};

type ProfileEmailRow = {
  id: string;
  email: string | null;
  customer_id: string | null;
  full_name: string | null;
  company_name: string | null;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function vehicleSummary(order: OrderEmailRow) {
  return [
    order.vehicle_brand,
    order.vehicle_model,
    order.vehicle_generation,
    order.vehicle_engine,
  ].map(clean).filter(Boolean).join(" ");
}

async function loadOrderContext(requestId: string) {
  const admin = getSupabaseAdmin();
  const orderResult = await admin
    .from("orders")
    .select("id,customer_id,customer_email,vehicle_brand,vehicle_model,vehicle_generation,vehicle_engine,service_type,credits_required")
    .eq("id", requestId)
    .maybeSingle();
  if (orderResult.error || !orderResult.data) return null;
  const order = orderResult.data as OrderEmailRow;

  let profile: ProfileEmailRow | null = null;
  if (order.customer_id) {
    const profileResult = await admin
      .from("profiles")
      .select("id,email,customer_id,full_name,company_name")
      .eq("id", order.customer_id)
      .maybeSingle();
    profile = profileResult.data as ProfileEmailRow | null;
  }

  const requestNumber = formatRequestReference(order.id);
  const siteUrl = getSiteUrl();
  const customerEmail = order.customer_email || profile?.email || "";
  const language = await loadUserTransactionalEmailLanguage(order.customer_id);
  const context: TransactionalEmailContext = {
    requestId: order.id,
    requestNumber,
    customerEmail,
    customerId: profile?.customer_id ?? null,
    customerName: profile?.full_name || profile?.company_name || null,
    companyName: profile?.company_name ?? null,
    vehicleSummary: vehicleSummary(order),
    serviceSummary: order.service_type || null,
    credits: Number(order.credits_required ?? 0) || null,
    dashboardUrl: `${siteUrl}/dashboard/orders/${order.id}`,
    adminUrl: `${siteUrl}/admin/requests/${order.id}`,
  };
  return { order, profile, context, customerEmail, language };
}

export async function sendRegistrationConfirmedNotifications(input: {
  userId: string;
  customerEmail: string;
  source?: string | null;
  language?: TransactionalEmailLanguage;
}) {
  try {
    const admin = getSupabaseAdmin();
    const profileResult = await admin
      .from("profiles")
      .select("id,email,customer_id,full_name,company_name")
      .eq("id", input.userId)
      .maybeSingle();
    const profile = profileResult.data as ProfileEmailRow | null;
    const customerEmail = input.customerEmail || profile?.email || "";
    const context: TransactionalEmailContext = {
      customerEmail,
      customerId: profile?.customer_id ?? null,
      customerName: profile?.full_name || profile?.company_name || null,
      companyName: profile?.company_name ?? null,
      dashboardUrl: `${getSiteUrl()}/dashboard`,
      adminUrl: `${getSiteUrl()}/admin?view=customers`,
    };
    const source = clean(input.source) || "email";
    const language = input.language ?? await loadUserTransactionalEmailLanguage(input.userId);

    await Promise.allSettled([
      sendTransactionalEmail({
        eventType: "customer_welcome",
        to: customerEmail,
        language,
        context,
        idempotencyKey: `customer_welcome:${input.userId}`,
        recipientUserId: input.userId,
        metadata: { source: "verified_registration", signup_source: source },
      }),
      sendTransactionalEmail({
        eventType: "customer_registered",
        to: getAdminNotificationEmail(),
        language: defaultTransactionalEmailLanguage,
        context,
        idempotencyKey: `customer_registered:${input.userId}`,
        metadata: { source: "verified_registration", signup_source: source },
      }),
    ]);
  } catch {
    // Registration must remain successful if an email provider is unavailable.
  }
}

export async function sendRequestCreatedNotifications(input: {
  requestId: string;
  customerEmail?: string | null;
  vehicle?: string | null;
  service?: string | null;
  credits?: number | null;
}) {
  try {
    const loaded = await loadOrderContext(input.requestId);
    const fallbackContext: TransactionalEmailContext = {
      requestId: input.requestId,
      requestNumber: formatRequestReference(input.requestId),
      customerEmail: input.customerEmail ?? null,
      vehicleSummary: input.vehicle ?? null,
      serviceSummary: input.service ?? null,
      credits: input.credits ?? null,
      dashboardUrl: `${getSiteUrl()}/dashboard`,
      adminUrl: `${getSiteUrl()}/admin/requests/${input.requestId}`,
    };
    const context = loaded?.context ?? fallbackContext;
    const recipient = loaded?.customerEmail || input.customerEmail || "";
    const language = loaded?.language ?? defaultTransactionalEmailLanguage;

    await Promise.allSettled([
      sendTransactionalEmail({
        eventType: "request_created",
        to: recipient,
        language,
        context,
        idempotencyKey: buildLifecycleIdempotencyKey([
          "request_created",
          input.requestId,
        ]),
        recipientUserId: loaded?.order.customer_id ?? null,
        relatedOrderId: input.requestId,
        relatedRequestId: input.requestId,
        metadata: { source: "request_creation" },
      }),
      sendTransactionalEmail({
        eventType: "new_request_admin_notification",
        to: getAdminNotificationEmail(),
        language: defaultTransactionalEmailLanguage,
        context,
        idempotencyKey: `admin_new_request:${input.requestId}`,
        relatedOrderId: input.requestId,
        relatedRequestId: input.requestId,
        metadata: { source: "request_creation" },
      }),
    ]);
  } catch {
    // Transactional email must not block request creation.
  }
}

export async function sendWorkOrderStatusEmail(input: {
  requestId: string;
  status: string;
  previousStatus?: string | null;
  source?: EmailStatusSource;
  transitionId?: string | null;
}) {
  try {
    const source = input.source ?? "work_order";
    if (!shouldSendStatusTransition({
      previousStatus: input.previousStatus,
      nextStatus: input.status,
      source,
    })) return;
    const loaded = await loadOrderContext(input.requestId);
    if (!loaded?.customerEmail) return;
    const definition = resolveStatusEmail(input.status, source, loaded.language);
    if (!definition) return;
    await sendTransactionalEmail({
      eventType: definition.eventType,
      to: loaded.customerEmail,
      language: loaded.language,
      context: {
        ...loaded.context,
        statusLabel: definition.statusLabel,
        actionRequired: definition.actionRequired ?? null,
      },
      idempotencyKey: buildLifecycleIdempotencyKey([
        definition.eventType,
        input.requestId,
        input.transitionId || input.status,
      ]),
      recipientUserId: loaded.order.customer_id,
      relatedOrderId: input.requestId,
      relatedRequestId: input.requestId,
      metadata: { source: `${source}_status`, status: input.status },
    });
  } catch {
    // Best-effort notification.
  }
}

export async function sendLegacyOrderStatusEmail(input: {
  requestId: string;
  previousStatus?: string | null;
  status: string;
  transitionId?: string | null;
}) {
  return sendWorkOrderStatusEmail({
    ...input,
    source: "legacy_order",
  });
}

export async function sendCustomerVisibleMessageEmail(input: {
  requestId: string;
  messageId: string;
}) {
  try {
    const loaded = await loadOrderContext(input.requestId);
    if (!loaded?.customerEmail) return;
    const admin = getSupabaseAdmin();
    const messageResult = await admin
      .from("request_messages")
      .select("id,request_id,sender_id,sender_role,message,created_at,visibility_status")
      .eq("id", input.messageId)
      .eq("request_id", input.requestId)
      .maybeSingle();
    if (messageResult.error || !messageResult.data) return;
    const [visible] = filterCustomerVisibleRequestMessages([messageResult.data as RequestMessageVisibilityRow]);
    if (!visible || visible.sender_role === "customer") return;
    await sendTransactionalEmail({
      eventType: "customer_visible_message_added",
      to: loaded.customerEmail,
      language: loaded.language,
      context: {
        ...loaded.context,
        messagePreview: String(visible.message ?? "").slice(0, 600),
      },
      idempotencyKey: `customer_message:${input.requestId}:${input.messageId}`,
      recipientUserId: loaded.order.customer_id,
      relatedOrderId: input.requestId,
      relatedRequestId: input.requestId,
      metadata: { source: "customer_visible_note", message_id: input.messageId },
    });
  } catch {
    // Best-effort notification.
  }
}

export async function sendCustomerReplyAdminEmail(input: {
  requestId: string;
  messageId: string;
}) {
  try {
    const loaded = await loadOrderContext(input.requestId);
    if (!loaded) return;
    const admin = getSupabaseAdmin();
    const messageResult = await admin
      .from("request_messages")
      .select("id,request_id,sender_id,sender_role,message,created_at,visibility_status")
      .eq("id", input.messageId)
      .eq("request_id", input.requestId)
      .maybeSingle();
    if (messageResult.error || !messageResult.data) return;
    const [visible] = filterCustomerVisibleRequestMessages([messageResult.data as RequestMessageVisibilityRow]);
    if (!visible || visible.sender_role !== "customer") return;

    await sendTransactionalEmail({
      eventType: "customer_replied_admin_notification",
      to: getAdminNotificationEmail(),
      language: defaultTransactionalEmailLanguage,
      context: {
        ...loaded.context,
        messagePreview: String(visible.message ?? "").slice(0, 600),
      },
      idempotencyKey: `admin_customer_reply:${input.requestId}:${input.messageId}`,
      relatedOrderId: input.requestId,
      relatedRequestId: input.requestId,
      metadata: { source: "customer_message", message_id: input.messageId },
    });
  } catch {
    // Customer messaging must not fail because of an admin notification.
  }
}

export async function sendRevisionRequestedAdminEmail(input: {
  requestId: string;
  messageId: string;
}) {
  try {
    const loaded = await loadOrderContext(input.requestId);
    if (!loaded) return;
    const admin = getSupabaseAdmin();
    const messageResult = await admin
      .from("request_messages")
      .select("id,request_id,sender_id,sender_role,message,created_at,visibility_status")
      .eq("id", input.messageId)
      .eq("request_id", input.requestId)
      .maybeSingle();
    if (messageResult.error || !messageResult.data) return;
    const [visible] = filterCustomerVisibleRequestMessages([messageResult.data as RequestMessageVisibilityRow]);
    if (!visible || visible.sender_role !== "customer") return;

    await sendTransactionalEmail({
      eventType: "revision_requested_admin_notification",
      to: getAdminNotificationEmail(),
      language: defaultTransactionalEmailLanguage,
      context: {
        ...loaded.context,
        messagePreview: String(visible.message ?? "").slice(0, 600),
      },
      idempotencyKey: `admin_revision_requested:${input.requestId}:${input.messageId}`,
      relatedOrderId: input.requestId,
      relatedRequestId: input.requestId,
      metadata: { source: "customer_revision", message_id: input.messageId },
    });
  } catch {
    // Revision creation must not fail because of an email provider.
  }
}

export async function sendUploadPermissionEmail(input: {
  requestId: string;
  enabled: boolean;
  transitionId?: string | null;
}) {
  try {
    if (!input.enabled) return;
    const loaded = await loadOrderContext(input.requestId);
    if (!loaded?.customerEmail) return;
    await sendTransactionalEmail({
      eventType: "upload_permission_enabled",
      to: loaded.customerEmail,
      language: loaded.language,
      context: loaded.context,
      idempotencyKey: buildLifecycleIdempotencyKey([
        "upload_permission_enabled",
        input.requestId,
        input.transitionId || "enabled",
      ]),
      recipientUserId: loaded.order.customer_id,
      relatedOrderId: input.requestId,
      relatedRequestId: input.requestId,
      metadata: { source: "upload_permission" },
    });
  } catch {
    // Best-effort notification.
  }
}

export async function sendAdditionalFileUploadedAdminEmail(input: {
  requestId: string;
  fileName: string;
  uploadId?: string | null;
}) {
  try {
    const loaded = await loadOrderContext(input.requestId);
    if (!loaded) return;
    await sendTransactionalEmail({
      eventType: "additional_file_uploaded",
      to: getAdminNotificationEmail(),
      language: defaultTransactionalEmailLanguage,
      context: { ...loaded.context, fileName: input.fileName },
      idempotencyKey: `admin_additional_file_uploaded:${input.requestId}:${input.uploadId || input.fileName}`,
      relatedOrderId: input.requestId,
      relatedRequestId: input.requestId,
      metadata: { source: "additional_file_uploaded" },
    });
  } catch {
    // Best-effort notification.
  }
}

export async function sendAdditionalFileUploadedNotifications(input: {
  requestId: string;
  fileName: string;
  uploadId?: string | null;
}) {
  try {
    const loaded = await loadOrderContext(input.requestId);
    if (!loaded) return;
    await Promise.allSettled([
      sendAdditionalFileUploadedAdminEmail(input),
      sendTransactionalEmail({
        eventType: "additional_file_uploaded_customer",
        to: loaded.customerEmail,
        language: loaded.language,
        context: { ...loaded.context, fileName: input.fileName },
        idempotencyKey: `customer_additional_file_uploaded:${input.requestId}:${input.uploadId || input.fileName}`,
        recipientUserId: loaded.order.customer_id,
        relatedOrderId: input.requestId,
        relatedRequestId: input.requestId,
        metadata: { source: "additional_file_uploaded" },
      }),
    ]);
  } catch {
    // Upload finalization must not fail because of email notifications.
  }
}

export async function sendDeliveryCompletedEmail(input: {
  requestId: string;
  fileName?: string | null;
}) {
  try {
    const loaded = await loadOrderContext(input.requestId);
    if (!loaded?.customerEmail) return;
    await sendTransactionalEmail({
      eventType: "delivery_completed",
      to: loaded.customerEmail,
      language: loaded.language,
      context: { ...loaded.context, fileName: input.fileName ?? null },
      idempotencyKey: `delivery_completed:${input.requestId}`,
      recipientUserId: loaded.order.customer_id,
      relatedOrderId: input.requestId,
      relatedRequestId: input.requestId,
      metadata: { source: "delivery" },
    });
  } catch {
    // Best-effort notification.
  }
}

export async function sendBankTransferInstructionsEmail(input: {
  userId: string;
  customerEmail: string;
  customerId?: string | null;
  credits?: number | null;
  amountLabel?: string | null;
}) {
  const language = await loadUserTransactionalEmailLanguage(input.userId);
  await sendTransactionalEmail({
    eventType: "bank_transfer_instructions",
    to: input.customerEmail,
    language,
    context: {
      customerId: input.customerId ?? null,
      customerEmail: input.customerEmail,
      credits: input.credits ?? null,
      amountLabel: input.amountLabel ?? null,
      paymentReference: input.customerId ?? null,
      bankAccountName: process.env.NEXT_PUBLIC_BANK_ACCOUNT_NAME || "MG AutoTech",
      bankName: process.env.NEXT_PUBLIC_BANK_NAME || null,
      bankIban: process.env.NEXT_PUBLIC_BANK_IBAN || null,
      bankBic: process.env.NEXT_PUBLIC_BANK_BIC || null,
      dashboardUrl: `${getSiteUrl()}/dashboard/credits`,
    },
    idempotencyKey: `bank_transfer:${input.userId}:${input.credits ?? "custom"}:${input.amountLabel ?? "amount"}`,
    recipientUserId: input.userId,
    metadata: { source: "bank_transfer_selection" },
  });
}

export async function sendCreditsAddedEmail(input: {
  userId: string;
  customerEmail?: string | null;
  credits: number;
  amountTotal?: number | null;
  currency?: string | null;
  source: "stripe" | "bank";
  referenceId?: string | null;
}) {
  try {
    const admin = getSupabaseAdmin();
    const profile = await admin
      .from("profiles")
      .select("id,email,customer_id,full_name,company_name")
      .eq("id", input.userId)
      .maybeSingle();
    const email = input.customerEmail || profile.data?.email || "";
    if (!email) return;
    const language = await loadUserTransactionalEmailLanguage(input.userId);
    const amountLabel =
      typeof input.amountTotal === "number" && input.amountTotal > 0
        ? `${(input.amountTotal / 100).toFixed(2)} ${(input.currency || "eur").toUpperCase()}`
        : null;
    await sendTransactionalEmail({
      eventType: "credits_added",
      to: email,
      language,
      context: {
        customerEmail: email,
        customerId: profile.data?.customer_id ?? null,
        customerName: profile.data?.full_name || profile.data?.company_name || null,
        credits: input.credits,
        amountLabel,
        dashboardUrl: `${getSiteUrl()}/dashboard/credits/history`,
      },
      idempotencyKey: `credits_added:${input.source}:${input.userId}:${input.referenceId || `${input.credits}:${amountLabel ?? "no_amount"}`}`,
      recipientUserId: input.userId,
      metadata: { source: input.source, credits: input.credits },
    });
  } catch {
    // Payment flow must not fail because of email.
  }
}
