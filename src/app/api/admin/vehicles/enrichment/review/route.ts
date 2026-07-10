import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  const auth = await requireStaffPermission(request, "vehicles.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const admin = getSupabaseAdmin();
  const event = {
    batch_id: typeof body?.batchId === "string" ? body.batchId : null,
    entity_type: typeof body?.entityType === "string" ? body.entityType : "enrichment",
    entity_id: typeof body?.entityId === "string" ? body.entityId : null,
    action: typeof body?.action === "string" ? body.action : "review.note",
    old_value: {},
    new_value: body ?? {},
    actor_id: auth.user.id,
    notes: typeof body?.notes === "string" ? body.notes : null,
  };
  const { data, error } = await admin.from("vehicle_external_review_events").insert(event).select("*").single();
  if (error) {
    return NextResponse.json({
      error: error.code === "42P01" ? "Vehicle enrichment SQL migration is required before review events can be stored." : error.message,
      migrationRequired: error.code === "42P01",
    }, { status: error.code === "42P01" ? 409 : 500 });
  }
  return NextResponse.json({ event: data });
}
