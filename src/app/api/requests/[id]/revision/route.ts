import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendRevisionRequestedAdminEmail } from "@/lib/email/events";
import { recordWorkOrderEvent } from "@/lib/workOrders/server";
import {
  checkAdaptiveRateLimit,
  rateLimitResponseHeaders,
} from "@/lib/abuseProtection";

const revisionSchema = z.object({
  revisionNote: z.string().trim().min(1).max(4000),
}).strict();

const REVISION_RATE_LIMIT = 5;
const REVISION_RATE_WINDOW_MS = 60 * 60 * 1000;
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

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if (!auth.ok) {
    return privateJson({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const rateLimit = await checkAdaptiveRateLimit({
    request,
    scope: "request-revision-create",
    suffix: `${auth.user.id}:${id}`,
    limit: REVISION_RATE_LIMIT,
    windowMs: REVISION_RATE_WINDOW_MS,
  });
  if (!rateLimit.allowed) {
    return privateJson(
      { error: "Too many revision attempts. Please wait before trying again." },
      {
        status: 429,
        headers: rateLimitResponseHeaders({
          result: rateLimit,
          limit: REVISION_RATE_LIMIT,
          windowMs: REVISION_RATE_WINDOW_MS,
          blocked: true,
        }),
      }
    );
  }

  const parsed = revisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return privateJson(
      { error: "Revision note must be between 1 and 4000 characters." },
      { status: 400 }
    );
  }

  const supabaseAdmin = getSupabaseAdmin();
  const user = auth.user;

  const revisionNote = parsed.data.revisionNote;

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, customer_id, status, modified_file_path")
    .eq("id", id)
    .eq("customer_id", user.id)
    .single();

  if (orderError || !order) {
    return privateJson(
      { error: "Order not found or access denied." },
      { status: 404 }
    );
  }

  if (!order.modified_file_path) {
    return privateJson(
      { error: "Revision can only be requested after a modified file is delivered." },
      { status: 400 }
    );
  }

  if (order.status === "revision") {
    return privateJson(
      { error: "A revision request is already pending for this order." },
      { status: 409 }
    );
  }
  if (order.status !== "completed") {
    return privateJson(
      { error: "Revision can only be requested for a completed order." },
      { status: 409 }
    );
  }

  const { data: updatedOrder, error: updateError } = await supabaseAdmin
    .from("orders")
    .update({ status: "revision" })
    .eq("id", id)
    .eq("customer_id", user.id)
    .eq("status", "completed")
    .select("id")
    .maybeSingle();

  if (updateError) {
    return privateJson(
      { error: "Revision request could not be saved. Please try again." },
      { status: 503, headers: { "Retry-After": "3" } }
    );
  }
  if (!updatedOrder) {
    return privateJson(
      { error: "A revision request is already pending or the order state changed." },
      { status: 409 }
    );
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
    await supabaseAdmin
      .from("orders")
      .update({ status: "completed" })
      .eq("id", id)
      .eq("customer_id", user.id)
      .eq("status", "revision");
    return privateJson(
      { error: "Revision message could not be saved. Please contact support." },
      { status: 503, headers: { "Retry-After": "3" } }
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

  return privateJson(
    { success: true, status: "revision" },
    {
      headers: rateLimitResponseHeaders({
        result: rateLimit,
        limit: REVISION_RATE_LIMIT,
        windowMs: REVISION_RATE_WINDOW_MS,
      }),
    }
  );
}
