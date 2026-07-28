import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import {
  sendCustomerReplyAdminEmail,
  sendCustomerVisibleMessageEmail,
} from "@/lib/email/events";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { hasStaffPermission, isStaffMember } from "@/lib/staffPermissions";
import {
  filterCustomerVisibleRequestMessages,
  type RequestMessageVisibilityRow,
} from "@/lib/workOrders/messageVisibility";

const messageSchema = z.object({
  message: z.string().trim().min(1).max(4000),
});

async function authorizeRequest(request: Request, orderId: string) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth;

  const admin = getSupabaseAdmin();
  const { data: order, error } = await admin
    .from("orders")
    .select("id, customer_id")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    return { ok: false as const, status: 404, error: "Order not found." };
  }

  const isOwner = order.customer_id === auth.user.id;
  const canManageMessages =
    isStaffMember(auth.access) && hasStaffPermission(auth.access, "messages.manage");

  if (!isOwner && !canManageMessages) {
    return { ok: false as const, status: 403, error: "Access denied." };
  }

  return {
    ok: true as const,
    user: auth.user,
    senderRole: canManageMessages && !isOwner ? "admin" as const : "customer" as const,
  };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await authorizeRequest(request, id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("request_messages")
    .select("id, request_id, sender_id, sender_role, message, created_at, visibility_status")
    .eq("request_id", id)
    .or("visibility_status.is.null,visibility_status.eq.visible")
    .order("created_at", { ascending: true });

  if (error) {
    if (error.code === "42703") {
      const legacy = await admin
        .from("request_messages")
        .select("id, request_id, sender_id, sender_role, message, created_at")
        .eq("request_id", id)
        .order("created_at", { ascending: true });
      if (legacy.error) {
        return NextResponse.json({ error: legacy.error.message }, { status: 500 });
      }
      return NextResponse.json({ messages: filterCustomerVisibleRequestMessages((legacy.data ?? []) as RequestMessageVisibilityRow[]) });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: filterCustomerVisibleRequestMessages((data ?? []) as RequestMessageVisibilityRow[]) });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await authorizeRequest(request, id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const parsed = messageSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Message must be between 1 and 4000 characters." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("request_messages")
    .insert({
      request_id: id,
      sender_id: access.user.id,
      sender_role: access.senderRole,
      message: parsed.data.message,
      visibility_status: "visible",
    })
    .select("id, request_id, sender_id, sender_role, message, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (access.senderRole === "customer") {
    await sendCustomerReplyAdminEmail({ requestId: id, messageId: String(data.id) });
  } else {
    await sendCustomerVisibleMessageEmail({ requestId: id, messageId: String(data.id) });
  }

  return NextResponse.json({ message: data });
}
