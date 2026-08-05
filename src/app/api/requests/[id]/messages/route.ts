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

const MESSAGE_HISTORY_LIMIT = 200;
const privateResponseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization, Cookie",
};

function privateJson(body: unknown, init?: { status?: number; headers?: HeadersInit }) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...privateResponseHeaders,
      ...init?.headers,
    },
  });
}

function temporaryMessageFailure() {
  return privateJson(
    { error: "Messages are temporarily unavailable. Please try again." },
    { status: 503, headers: { "Retry-After": "3" } }
  );
}

async function authorizeRequest(request: Request, orderId: string) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth;

  const admin = getSupabaseAdmin();
  const { data: order, error } = await admin
    .from("orders")
    .select("id, customer_id")
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      status: 503,
      error: "The secure message channel is temporarily unavailable.",
    };
  }

  if (!order) {
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
    return privateJson({ error: access.error }, { status: access.status });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("request_messages")
    .select("id, request_id, sender_id, sender_role, message, created_at, is_internal, visibility_status")
    .eq("request_id", id)
    .eq("is_internal", false)
    .or("visibility_status.is.null,visibility_status.eq.visible")
    .order("created_at", { ascending: false })
    .limit(MESSAGE_HISTORY_LIMIT + 1);

  if (error) {
    if (error.code === "42703") {
      const legacy = await admin
        .from("request_messages")
        .select("id, request_id, sender_id, sender_role, message, created_at, is_internal")
        .eq("request_id", id)
        .eq("is_internal", false)
        .order("created_at", { ascending: false })
        .limit(MESSAGE_HISTORY_LIMIT + 1);
      if (legacy.error) {
        return temporaryMessageFailure();
      }
      const legacyRows = (legacy.data ?? []) as RequestMessageVisibilityRow[];
      const historyLimited = legacyRows.length > MESSAGE_HISTORY_LIMIT;
      const visibleRows = legacyRows.slice(0, MESSAGE_HISTORY_LIMIT).reverse();
      return privateJson({
        messages: filterCustomerVisibleRequestMessages(visibleRows),
        history_limited: historyLimited,
      });
    }
    return temporaryMessageFailure();
  }

  const rows = (data ?? []) as RequestMessageVisibilityRow[];
  const historyLimited = rows.length > MESSAGE_HISTORY_LIMIT;
  const visibleRows = rows.slice(0, MESSAGE_HISTORY_LIMIT).reverse();

  return privateJson({
    messages: filterCustomerVisibleRequestMessages(visibleRows),
    history_limited: historyLimited,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await authorizeRequest(request, id);
  if (!access.ok) {
    return privateJson({ error: access.error }, { status: access.status });
  }

  const body = await request.json().catch(() => null);
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return privateJson(
      { error: "Message must be between 1 and 4000 characters." },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("request_messages")
    .insert({
      request_id: id,
      sender_id: access.user.id,
      sender_role: access.senderRole,
      message: parsed.data.message,
      is_internal: false,
      visibility_status: "visible",
    })
    .select("id, request_id, sender_id, sender_role, message, created_at")
    .single();

  if (error) {
    return temporaryMessageFailure();
  }

  if (access.senderRole === "customer") {
    await sendCustomerReplyAdminEmail({ requestId: id, messageId: String(data.id) });
  } else {
    await sendCustomerVisibleMessageEmail({ requestId: id, messageId: String(data.id) });
  }

  return privateJson({ message: data }, { status: 201 });
}
