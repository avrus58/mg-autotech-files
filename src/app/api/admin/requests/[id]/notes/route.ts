import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { hasStaffPermission } from "@/lib/staffPermissions";
import { addAdminWorkOrderNote } from "@/lib/workOrders/server";
import { workOrderNoteTypes } from "@/lib/workOrders/types";

const noteSchema = z.object({
  note_type: z.enum(workOrderNoteTypes).default("internal"),
  body: z.string().trim().min(1).max(8000),
  pinned: z.boolean().optional().default(false),
}).strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffPermission(request, "orders.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = noteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid work order note.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  if (
    parsed.data.note_type === "customer_visible" &&
    !hasStaffPermission(auth.access, "messages.manage")
  ) {
    return NextResponse.json(
      { error: "Message management permission is required for customer-visible notes." },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  try {
    const note = await addAdminWorkOrderNote({
      requestId: id,
      actorUserId: auth.user.id,
      noteType: parsed.data.note_type,
      body: parsed.data.body,
      pinned: parsed.data.pinned,
    });
    return NextResponse.json({ note }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Work order note could not be saved." },
      { status: 500 }
    );
  }
}
