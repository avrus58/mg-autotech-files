import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { sendUploadPermissionEmail } from "@/lib/email/events";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { recordWorkOrderEvent } from "@/lib/workOrders/server";

const schema = z.object({ enabled: z.boolean() });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffPermission(request, "orders.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid upload permission." }, { status: 400 });

  const { id } = await context.params;
  const admin = getSupabaseAdmin();
  const current = await admin
    .from("orders")
    .select("id, customer_upload_enabled, customer_upload_grant_nonce")
    .eq("id", id)
    .maybeSingle();
  if (current.error?.code === "42703") {
    return NextResponse.json({ error: "Additional file upload migration has not been installed." }, { status: 409 });
  }
  if (current.error || !current.data) {
    return NextResponse.json({ error: current.error?.message || "Order not found." }, { status: 404 });
  }
  if (Boolean(current.data.customer_upload_enabled) === parsed.data.enabled) {
    return NextResponse.json({ order: current.data, changed: false });
  }
  const transitionId = crypto.randomUUID();
  const grantNonce = parsed.data.enabled ? crypto.randomUUID() : null;
  const { data, error } = await admin
    .from("orders")
    .update({
      customer_upload_enabled: parsed.data.enabled,
      customer_upload_grant_nonce: grantNonce,
    })
    .eq("id", id)
    .select("id, customer_upload_enabled")
    .maybeSingle();

  if (error?.code === "42703") {
    return NextResponse.json({ error: "Additional file upload migration has not been installed." }, { status: 409 });
  }
  if (error || !data) return NextResponse.json({ error: error?.message || "Order not found." }, { status: 404 });
  await recordWorkOrderEvent({
    requestId: id,
    actorUserId: auth.user.id,
    eventType: parsed.data.enabled ? "customer_upload_permission_enabled" : "customer_upload_permission_disabled",
    message: parsed.data.enabled
      ? "Admin enabled a one-time customer upload for this request."
      : "Admin disabled customer upload for this request.",
    newValue: { customer_upload_enabled: parsed.data.enabled },
    metadata: { transition_id: transitionId },
    mode: "best_effort",
  });
  await sendUploadPermissionEmail({
    requestId: id,
    enabled: parsed.data.enabled,
    transitionId,
  });
  return NextResponse.json({ order: data, changed: true });
}
