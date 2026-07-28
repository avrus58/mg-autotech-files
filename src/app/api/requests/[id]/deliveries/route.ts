import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import {
  CUSTOMER_FILE_DOWNLOAD_EVENT,
  buildCustomerDownloadAuditValue,
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
});

async function loadOwnedOrder(requestId: string, customerId: string) {
  const admin = getSupabaseAdmin();
  const result = await admin
    .from("orders")
    .select(customerOrderDetailSelect)
    .eq("id", requestId)
    .eq("customer_id", customerId)
    .maybeSingle();

  return {
    admin,
    order: result.data as unknown as CustomerOrderRecord | null,
    error: result.error,
  };
}

async function loadDownloadEvents(requestId: string) {
  const admin = getSupabaseAdmin();
  return admin
    .from("request_work_order_events")
    .select("event_type, new_value, created_at")
    .eq("request_id", requestId)
    .eq("event_type", CUSTOMER_FILE_DOWNLOAD_EVENT)
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

  const parsed = downloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid delivery version is required." }, { status: 400 });
  }

  const { id } = await context.params;
  const { admin, order, error } = await loadOwnedOrder(id, auth.user.id);
  if (error || !order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const version = resolveCustomerDeliveryVersion(order, parsed.data.versionId);
  if (!version) {
    return NextResponse.json({ error: "Delivery version not found." }, { status: 404 });
  }

  if (!isExpectedCustomerDeliveryPath(version.file_path, auth.user.id, id)) {
    return NextResponse.json({ error: "Delivery file is unavailable." }, { status: 409 });
  }

  const signed = await admin.storage
    .from("customer-files")
    .createSignedUrl(version.file_path, 60);
  if (signed.error || !signed.data?.signedUrl) {
    return NextResponse.json({ error: "Secure download could not be prepared." }, { status: 503 });
  }

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
      { status: 503 }
    );
  }

  const eventResult = await loadDownloadEvents(id);
  if (eventResult.error) {
    return NextResponse.json(
      { error: "Download tracking is temporarily unavailable. Please try again." },
      { status: 503 }
    );
  }

  return NextResponse.json(
    {
      signedUrl: signed.data.signedUrl,
      delivery: projectCustomerDeliveryHistory(
        order,
        (eventResult.data ?? []) as CustomerDownloadEventRow[]
      ),
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    }
  );
}
