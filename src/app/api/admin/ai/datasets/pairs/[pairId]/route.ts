import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { datasetReviewStatuses } from "@/lib/aiFileIntelligence/datasetImport";

function hasAnyActualServiceLabel(value: unknown) {
  return Boolean(value && typeof value === "object" && Object.values(value as Record<string, unknown>).some(Boolean));
}

const updateSchema = z.object({
  review_status: z.enum(datasetReviewStatuses).optional(),
  actual_service_labels: z.record(z.string(), z.boolean()).nullable().optional(),
  admin_notes: z.string().trim().max(2000).nullable().optional(),
}).strict();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ pairId: string }> }
) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid pair review update." }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Pair review update is empty." }, { status: 400 });
  }
  if (parsed.data.review_status === "approved_for_learning") {
    return NextResponse.json({
      error: "Dataset pair review cannot directly approve trusted learning. Create/approve training samples in the dedicated learning workflow after human verification.",
    }, { status: 400 });
  }

  const { pairId } = await context.params;
  const supabaseAdmin = getSupabaseAdmin();
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("ai_dataset_pair_candidates")
    .select("id, batch_id, review_status, actual_service_labels, admin_notes, quality_score")
    .eq("id", pairId)
    .maybeSingle();
  if (existingError || !existing) {
    return NextResponse.json({ error: existingError?.message || "Pair candidate not found." }, { status: 404 });
  }
  const nextActualLabels = parsed.data.actual_service_labels !== undefined
    ? parsed.data.actual_service_labels
    : existing.actual_service_labels;
  if (parsed.data.review_status === "approved" && !hasAnyActualServiceLabel(nextActualLabels)) {
    return NextResponse.json({ error: "actual_service_labels are required before a pair can be marked approved for review." }, { status: 400 });
  }
  if (parsed.data.review_status === "approved" && Number(existing.quality_score || 0) < 60) {
    return NextResponse.json({ error: "quality_score must be at least 60 before a pair can be marked approved for review." }, { status: 400 });
  }

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.review_status) updatePayload.review_status = parsed.data.review_status;
  if (parsed.data.actual_service_labels !== undefined) updatePayload.actual_service_labels = parsed.data.actual_service_labels || {};
  if (parsed.data.admin_notes !== undefined) updatePayload.admin_notes = parsed.data.admin_notes;

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("ai_dataset_pair_candidates")
    .update(updatePayload)
    .eq("id", pairId)
    .select("id, batch_id, review_status, actual_service_labels, admin_notes, quality_score, learning_recommendation")
    .single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await supabaseAdmin.from("ai_dataset_review_events").insert({
    batch_id: existing.batch_id,
    pair_candidate_id: pairId,
    action: "pair_review_updated",
    old_value: existing,
    new_value: updated,
    actor_id: auth.user.id,
    notes: parsed.data.admin_notes || "Dataset pair review updated.",
  });

  return NextResponse.json({
    pair: updated,
    creates_training_sample: false,
    auto_approved_learning: false,
    message: "Pair review updated. No training sample was created and trusted learning approval remains a separate admin decision.",
  });
}
