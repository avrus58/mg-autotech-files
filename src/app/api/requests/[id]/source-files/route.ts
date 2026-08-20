import { NextResponse } from "next/server";
import { z } from "zod";
import { checkAdaptiveRateLimit, rateLimitResponseHeaders } from "@/lib/abuseProtection";
import { requireApiUser } from "@/lib/apiAuth";
import { BoundedRequestBodyError, readBoundedJsonBody } from "@/lib/boundedRequestBody";
import {
  CUSTOMER_FILE_DOWNLOAD_EVENT,
  buildCustomerSourceDownloadAuditValue,
  customerOrderDetailLegacySelect,
  customerOrderDetailSelect,
  isExpectedCustomerSourcePath,
  projectCustomerDeliveryHistory,
  resolveCustomerSourceFile,
  type CustomerDownloadEventRow,
  type CustomerOrderRecord,
} from "@/lib/customerOrderDelivery";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { recordWorkOrderEvent } from "@/lib/workOrders/server";

const downloadLimit = 120;
const downloadWindowMs = 60 * 60 * 1000;

const sourceDownloadSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("original"),
    fileId: z.literal("original"),
  }).strict(),
  z.object({
    kind: z.literal("additional"),
    fileId: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9._-]+$/),
  }).strict(),
]);

async function loadOwnedOrder(requestId: string, customerId: string) {
  const admin = getSupabaseAdmin();
  let result = await admin
    .from("orders")
    .select(customerOrderDetailSelect)
    .eq("id", requestId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (result.error?.code === "42703") {
    result = await admin
      .from("orders")
      .select(customerOrderDetailLegacySelect)
      .eq("id", requestId)
      .eq("customer_id", customerId)
      .maybeSingle();
  }

  return {
    admin,
    order: result.data as unknown as CustomerOrderRecord | null,
    error: result.error,
  };
}

async function loadCustomerDownloadEvents(requestId: string, customerId: string) {
  return getSupabaseAdmin()
    .from("request_work_order_events")
    .select("event_type,actor_user_id,new_value,created_at")
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

  const { id } = await context.params;
  const rate = await checkAdaptiveRateLimit({
    request,
    scope: "customer-source-file-download",
    suffix: `${auth.user.id}:${id}`,
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

  let requestBody: unknown;
  try {
    requestBody = await readBoundedJsonBody(request, 8 * 1024);
  } catch (error) {
    const status = error instanceof BoundedRequestBodyError ? error.status : 400;
    return NextResponse.json(
      { error: "Download request is invalid or too large." },
      { status, headers: rateHeaders }
    );
  }
  const parsed = sourceDownloadSchema.safeParse(requestBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A valid source file is required." },
      { status: 400, headers: rateHeaders }
    );
  }

  const { admin, order, error } = await loadOwnedOrder(id, auth.user.id);
  if (error || !order || order.customer_id !== auth.user.id) {
    return NextResponse.json(
      { error: "Order not found." },
      { status: 404, headers: rateHeaders }
    );
  }

  const sourceFile = resolveCustomerSourceFile(
    order,
    parsed.data.kind,
    parsed.data.fileId
  );
  if (!sourceFile) {
    return NextResponse.json(
      { error: "Source file not found." },
      { status: 404, headers: rateHeaders }
    );
  }
  if (
    !isExpectedCustomerSourcePath(
      sourceFile.file_path,
      order.customer_id,
      order.id,
      sourceFile.kind
    )
  ) {
    return NextResponse.json(
      { error: "Source file is unavailable." },
      { status: 409, headers: rateHeaders }
    );
  }

  const existingEvents = await loadCustomerDownloadEvents(id, order.customer_id);
  if (existingEvents.error) {
    return NextResponse.json(
      { error: "Download tracking is temporarily unavailable. Please try again." },
      { status: 503, headers: rateHeaders }
    );
  }

  const signed = await admin.storage
    .from("customer-files")
    .createSignedUrl(sourceFile.file_path, 60, { download: true });
  if (signed.error || !signed.data?.signedUrl) {
    return NextResponse.json(
      { error: "Secure download could not be prepared." },
      { status: 503, headers: rateHeaders }
    );
  }

  const createdAt = new Date().toISOString();
  try {
    await recordWorkOrderEvent({
      requestId: id,
      actorUserId: auth.user.id,
      eventType: CUSTOMER_FILE_DOWNLOAD_EVENT,
      customerVisible: false,
      message: "Customer requested a secure source file download.",
      newValue: buildCustomerSourceDownloadAuditValue(sourceFile),
      metadata: { surface: "customer_order_workspace" },
    });
  } catch {
    return NextResponse.json(
      { error: "Download tracking is temporarily unavailable. Please try again." },
      { status: 503, headers: rateHeaders }
    );
  }

  const downloadEvent: CustomerDownloadEventRow = {
    event_type: CUSTOMER_FILE_DOWNLOAD_EVENT,
    actor_user_id: auth.user.id,
    new_value: buildCustomerSourceDownloadAuditValue(sourceFile),
    created_at: createdAt,
  };

  return NextResponse.json(
    {
      signedUrl: signed.data.signedUrl,
      delivery: projectCustomerDeliveryHistory(
        order,
        [
          ...((existingEvents.data ?? []) as CustomerDownloadEventRow[]),
          downloadEvent,
        ]
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
