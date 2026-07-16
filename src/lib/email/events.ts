import { getAdminNotificationEmail, getSiteUrl, formatRequestReference } from "@/lib/email/render";
import { sendTransactionalEmail } from "@/lib/email/service";
import type { TransactionalEmailContext, TransactionalEmailEventType } from "@/lib/email/types";
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
  return { order, profile, context, customerEmail };
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

    await sendTransactionalEmail({
      eventType: "request_created",
      to: recipient,
      context,
      idempotencyKey: `request_created:${input.requestId}:${recipient}`,
      recipientUserId: loaded?.order.customer_id ?? null,
      relatedOrderId: input.requestId,
      relatedRequestId: input.requestId,
      metadata: { source: "request_creation" },
    });

    await sendTransactionalEmail({
      eventType: "new_request_admin_notification",
      to: getAdminNotificationEmail(),
      context,
      idempotencyKey: `admin_new_request:${input.requestId}`,
      relatedOrderId: input.requestId,
      relatedRequestId: input.requestId,
      metadata: { source: "request_creation" },
    });
  } catch {
    // Transactional email must not block request creation.
  }
}

function workOrderStatusEvent(status: string): TransactionalEmailEventType | null {
  const map: Record<string, TransactionalEmailEventType> = {
    file_received: "file_uploaded",
    in_analysis: "request_in_review",
    in_progress: "request_in_progress",
    waiting_for_customer: "request_waiting_for_customer",
    delivered: "request_delivered",
    completed: "request_completed",
    cancelled: "request_cancelled",
  };
  return map[status] ?? null;
}

export async function sendWorkOrderStatusEmail(input: {
  requestId: string;
  status: string;
}) {
  try {
    const eventType = workOrderStatusEvent(input.status);
    if (!eventType) return;
    const loaded = await loadOrderContext(input.requestId);
    if (!loaded?.customerEmail) return;
    await sendTransactionalEmail({
      eventType,
      to: loaded.customerEmail,
      context: loaded.context,
      idempotencyKey: `${eventType}:${input.requestId}:${input.status}`,
      recipientUserId: loaded.order.customer_id,
      relatedOrderId: input.requestId,
      relatedRequestId: input.requestId,
      metadata: { source: "work_order_status", status: input.status },
    });
  } catch {
    // Best-effort notification.
  }
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
    if (!visible) return;
    await sendTransactionalEmail({
      eventType: "customer_visible_message_added",
      to: loaded.customerEmail,
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

export async function sendUploadPermissionEmail(input: {
  requestId: string;
  enabled: boolean;
}) {
  try {
    if (!input.enabled) return;
    const loaded = await loadOrderContext(input.requestId);
    if (!loaded?.customerEmail) return;
    await sendTransactionalEmail({
      eventType: "upload_permission_enabled",
      to: loaded.customerEmail,
      context: loaded.context,
      idempotencyKey: `upload_permission_enabled:${input.requestId}:${Date.now()}`,
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
}) {
  try {
    const loaded = await loadOrderContext(input.requestId);
    if (!loaded) return;
    await sendTransactionalEmail({
      eventType: "additional_file_uploaded",
      to: getAdminNotificationEmail(),
      context: { ...loaded.context, fileName: input.fileName },
      idempotencyKey: `admin_additional_file_uploaded:${input.requestId}:${input.fileName}`,
      relatedOrderId: input.requestId,
      relatedRequestId: input.requestId,
      metadata: { source: "additional_file_uploaded" },
    });
  } catch {
    // Best-effort notification.
  }
}

export async function sendDeliveryCompletedEmail(input: {
  requestId: string;
  fileName?: string | null;
}) {
  try {
    const loaded = await loadOrderContext(input.requestId);
    if (!loaded?.customerEmail) {
      return { ok: false as const, status: "skipped" as const, reason: "recipient_unavailable" };
    }
    return await sendTransactionalEmail({
      eventType: "delivery_completed",
      to: loaded.customerEmail,
      context: { ...loaded.context, fileName: input.fileName ?? null },
      idempotencyKey: `delivery_completed:${input.requestId}`,
      recipientUserId: loaded.order.customer_id,
      relatedOrderId: input.requestId,
      relatedRequestId: input.requestId,
      metadata: { source: "delivery" },
    });
  } catch {
    return { ok: false as const, status: "failed" as const, reason: "notification_exception" };
  }
}

export async function sendBankTransferInstructionsEmail(input: {
  userId: string;
  customerEmail: string;
  customerId?: string | null;
  credits?: number | null;
  amountLabel?: string | null;
}) {
  await sendTransactionalEmail({
    eventType: "bank_transfer_instructions",
    to: input.customerEmail,
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
    const amountLabel =
      typeof input.amountTotal === "number" && input.amountTotal > 0
        ? `${(input.amountTotal / 100).toFixed(2)} ${(input.currency || "eur").toUpperCase()}`
        : null;
    await sendTransactionalEmail({
      eventType: "credits_added",
      to: email,
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
