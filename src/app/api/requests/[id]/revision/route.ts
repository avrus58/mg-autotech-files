import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendRevisionRequestedAdminEmail } from "@/lib/email/events";
import { recordWorkOrderEvent } from "@/lib/workOrders/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const user = auth.user;

  const revisionNote = String(body.revisionNote || "").trim();

  if (!revisionNote) {
    return NextResponse.json(
      { error: "Revision note is required." },
      { status: 400 }
    );
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, customer_id, status, modified_file_path")
    .eq("id", id)
    .eq("customer_id", user.id)
    .single();

  if (orderError || !order) {
    return NextResponse.json(
      { error: "Order not found or access denied." },
      { status: 404 }
    );
  }

  if (!order.modified_file_path) {
    return NextResponse.json(
      { error: "Revision can only be requested after a modified file is delivered." },
      { status: 400 }
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from("orders")
    .update({ status: "revision" })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { data: messageData, error: messageError } = await supabaseAdmin
    .from("request_messages")
    .insert({
      request_id: id,
      sender_id: user.id,
      sender_role: "customer",
      message: `Revision request:\n\n${revisionNote}`,
      visibility_status: "visible",
    })
    .select("id")
    .single();

  if (messageError || !messageData) {
    return NextResponse.json(
      { error: messageError?.message || "Revision message could not be saved." },
      { status: 500 }
    );
  }

  await recordWorkOrderEvent({
    requestId: id,
    actorUserId: user.id,
    eventType: "customer_revision_requested",
    message: "Customer requested a revision for the delivered file.",
    customerVisible: true,
    newValue: { status: "revision", note_length: revisionNote.length },
    mode: "best_effort",
  });
  await sendRevisionRequestedAdminEmail({
    requestId: id,
    messageId: String(messageData.id),
  });

  return NextResponse.json({ success: true, status: "revision" });
}
