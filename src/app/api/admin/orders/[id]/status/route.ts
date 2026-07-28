import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { sendLegacyOrderStatusEmail } from "@/lib/email/events";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { recordWorkOrderEvent } from "@/lib/workOrders/server";

const legacyOrderStatuses = [
  "new_request",
  "file_check",
  "in_progress",
  "customer_info_needed",
  "completed",
  "revision",
  "cancelled",
] as const;

const statusSchema = z.object({
  status: z.enum(legacyOrderStatuses),
}).strict();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffPermission(request, "orders.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = statusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order status." }, { status: 400 });
  }

  const { id } = await context.params;
  const admin = getSupabaseAdmin();
  const currentResult = await admin
    .from("orders")
    .select("id,status")
    .eq("id", id)
    .maybeSingle();
  if (currentResult.error || !currentResult.data) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const previousStatus = String(currentResult.data.status || "");
  if (previousStatus === parsed.data.status) {
    return NextResponse.json({ order: currentResult.data, changed: false });
  }

  const updated = await admin
    .from("orders")
    .update({ status: parsed.data.status })
    .eq("id", id)
    .eq("status", previousStatus)
    .select("id,status")
    .maybeSingle();
  if (updated.error) {
    return NextResponse.json({ error: updated.error.message }, { status: 500 });
  }
  if (!updated.data) {
    return NextResponse.json(
      { error: "Order status changed in another session. Refresh and try again." },
      { status: 409 }
    );
  }

  const transitionId = crypto.randomUUID();
  await recordWorkOrderEvent({
    requestId: id,
    actorUserId: auth.user.id,
    eventType: "order_status_changed",
    oldValue: { status: previousStatus },
    newValue: { status: parsed.data.status },
    message: `Order status changed from ${previousStatus || "unknown"} to ${parsed.data.status}.`,
    metadata: { transition_id: transitionId },
    mode: "best_effort",
  });
  await sendLegacyOrderStatusEmail({
    requestId: id,
    previousStatus,
    status: parsed.data.status,
    transitionId,
  });

  return NextResponse.json({ order: updated.data, changed: true });
}
