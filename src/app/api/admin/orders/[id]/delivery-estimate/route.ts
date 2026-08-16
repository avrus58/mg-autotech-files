import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const deliveryEstimateSchema = z.object({
  estimate: z.enum(["usually_30_min", "same_day", "24h", "48h", "manual_review"]),
  note: z.string().trim().max(1000).nullable(),
}).strict();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffPermission(request, "orders.manage");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const parsed = deliveryEstimateSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid delivery estimate." },
      { status: 400 }
    );
  }

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid order identifier." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const updated = await admin
    .from("orders")
    .update({
      estimated_delivery_label: parsed.data.estimate,
      estimated_delivery_note: parsed.data.note,
    })
    .eq("id", id)
    .select("id,estimated_delivery_label,estimated_delivery_note")
    .maybeSingle();

  if (["42703", "PGRST204"].includes(updated.error?.code || "")) {
    return NextResponse.json(
      { error: "Estimated delivery migration has not been installed." },
      { status: 503 }
    );
  }
  if (updated.error) {
    return NextResponse.json({ error: updated.error.message }, { status: 500 });
  }
  if (!updated.data) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  return NextResponse.json({ order: updated.data });
}
