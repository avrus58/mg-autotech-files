import { NextResponse } from "next/server";
import { z } from "zod";
import { checkAdaptiveRateLimit, rateLimitResponseHeaders } from "@/lib/abuseProtection";
import { requireApiUser } from "@/lib/apiAuth";
import { BoundedRequestBodyError, readBoundedJsonBody } from "@/lib/boundedRequestBody";
import {
  CUSTOMER_FILE_DOWNLOAD_EVENT,
  buildCustomerDownloadAuditValue,
  canDownloadCustomerOrder,
  customerOrderDetailLegacySelect,
  customerOrderDetailSelect,
  isExpectedCustomerDeliveryPath,
  projectCustomerDeliveryHistory,
  resolveCustomerDeliveryVersion,
  type CustomerDownloadEventRow,
  type CustomerOrderRecord,
} from "@/lib/customerOrderDelivery";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { recordWorkOrderEvent } from "@/lib/workOrders/server";

const downloadSchema = z.object({
  versionId: z.string().trim().min(1).max(100),
}).strict();

const downloadLimit = 120;
const downloadWindowMs = 60 * 60 * 1000;

async function loadOrder(requestId: string) {
  const admin = getSupabaseAdmin();
  let result = await admin
    .from("orders")
    .select(customerOrderDetailSelect)
    .eq("id", requestId)
    .maybeSingle();

  if (result.error?.code === "42703") {
    result = await admin
      .from("orders")
      .select(customerOrderDetailLegacySelect)
      .eq("id", requestId)
      .maybeSingle();
  }

  return {
    admin,
    order: result.data as unknown as CustomerOrderRecord | null,
    error: result.error,
  };
}

async function loadDownloadEvents(requestId: string, customerId: string) {
  const admin = getSupabaseAdmin();
  return admin
    .from("request_work_order_events")
    .select("event_type, actor_user_id, new_value, created_at")
    .eq("request_id", requestId)
    .eq("event_type", CUSTOMER_FILE_DOWNLOAD_EVENT)
    .eq("actor_user_id", customerId)
    .order("created_at", { ascending: true });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let requestBody: unknown;
  try {
    requestBody = await readBoundedJsonBody(request, 8 * 1024);
  } catch (error) {
    const status = error instanceof BoundedRequestBodyError ? error.status : 400;
    return NextResponse.json(
      { error: "Download request is invalid or too large." },
      { status }
    );
  }
  const parsed = downloadSchema.safeParse(requestBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid delivery version is required." }, { status: 400 });
  }

  const { id } = await context.params;
  const rate = await checkAdaptiveRateLimit({
    request,
    scope: "customer-delivery-file-download",
    suffix: `${auth.user.id}:${id}:${parsed.data.versionId}`,
    limit: downloadLimit,
    windowMs: downloadWindowMs,
    includeClientIp: false,
  });
  const rateHeaders = rateLimitResponseHeaders({
    result: rate,
    limit: downloadLimit,
    windowMs: downloadWindowMs,
    blocked: !rate.allowed || (process.env.NODE_ENV === "production" && rate.source !== "distributed"),
  });
  if (process.env.NODE_ENV === "production" && rate.source !== "distributed") {
    return NextResponse.json(
      { error: "Secure download capacity is temporarily unavailable." },
      { status: 503, headers: rateHeaders }
    );
  }
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many download requests. Please wait before trying again." },
      { status: 429, headers: rateHeaders }
    );
  }

  const { admin, order, error } = await loadOrder(id);
  if (
    error ||
    !order ||
    !canDownloadCustomerOrder(auth.user.id, order.customer_id, auth.access)
  ) {
    return NextResponse.json({ error: "Order not found." }, { status: 404, headers: rateHeaders });
  }

  const version = resolveCustomerDeliveryVersion(order, parsed.data.versionId);
  if (!version) {
    return NextResponse.json({ error: "Delivery version not found." }, { status: 404, headers: rateHeaders });
  }

  if (!isExpectedCustomerDeliveryPath(version.file_path, order.customer_id, id)) {
    return NextResponse.json({ error: "Delivery file is unavailable." }, { status: 409, headers: rateHeaders });
  }

  const existingEvents = await loadDownloadEvents(id, order.customer_id);
  if (existingEvents.error) {
    return NextResponse.json(
      { error: "Download tracking is temporarily unavailable. Please try again." },
      { status: 503, headers: rateHeaders }
    );
  }

  const signed = await admin.storage
    .from("customer-files")
    .createSignedUrl(version.file_path, 60);
  if (signed.error || !signed.data?.signedUrl) {
    return NextResponse.json({ error: "Secure download could not be prepared." }, { status: 503, headers: rateHeaders });
  }

  const customerOwnDownload = auth.user.id === order.customer_id;
  const projectedEvents = [
    ...((existingEvents.data ?? []) as CustomerDownloadEventRow[]),
  ];
  if (customerOwnDownload) {
    const createdAt = new Date().toISOString();
    try {
      await recordWorkOrderEvent({
        requestId: id,
        actorUserId: auth.user.id,
        eventType: CUSTOMER_FILE_DOWNLOAD_EVENT,
        customerVisible: false,
        message: "Customer requested a secure delivery download.",
        newValue: buildCustomerDownloadAuditValue(version),
        metadata: { surface: "customer_order_workspace" },
      });
    } catch {
      return NextResponse.json(
        { error: "Download tracking is temporarily unavailable. Please try again." },
        { status: 503, headers: rateHeaders }
      );
    }
    projectedEvents.push({
      event_type: CUSTOMER_FILE_DOWNLOAD_EVENT,
      actor_user_id: auth.user.id,
      new_value: buildCustomerDownloadAuditValue(version),
      created_at: createdAt,
    });
  }

  return NextResponse.json(
    {
      signedUrl: signed.data.signedUrl,
      delivery: projectCustomerDeliveryHistory(
        order,
        projectedEvents
      ),
    },
    {
      headers: {
        ...rateHeaders,
        "Cache-Control": "private, no-store",
      },
    }
  );
}
