import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { updateRequestMessageVisibility } from "@/lib/workOrders/server";

const visibilitySchema = z.object({
  action: z.enum(["hide", "restore"]),
  reason: z.string().trim().max(500).optional().default(""),
}).strict();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; messageId: string }> }
) {
  const auth = await requireStaffPermission(request, "orders.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = visibilitySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid message visibility update.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id, messageId } = await context.params;
  try {
    const message = await updateRequestMessageVisibility({
      requestId: id,
      messageId,
      actorUserId: auth.user.id,
      action: parsed.data.action,
      reason: parsed.data.reason,
    });
    return NextResponse.json({ message });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Message visibility could not be updated.";
    const status = message === "Request message not found." ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
