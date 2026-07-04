import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { rebuildAllPatternClusters } from "@/lib/ecuIntelligence/clustering";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  const admin = getSupabaseAdmin();
  const outlier = await admin.from("ai_cluster_members").select("cluster_id")
    .eq("training_sample_id", id).eq("is_outlier", true);
  if (outlier.error) return NextResponse.json({ error: outlier.error.message }, { status: 500 });
  if (!outlier.data?.length) return NextResponse.json({ error: "This sample is not currently a cluster outlier." }, { status: 409 });
  const updated = await admin.from("ai_training_samples").update({
    human_verification_status: "needs_review",
    human_verified: false,
    learning_use_status: "pending",
  }).eq("id", id).select("id").single();
  if (updated.error) return NextResponse.json({ error: updated.error.message }, { status: 500 });
  const event = await admin.from("ai_training_events").insert({
    event_type: "sample_marked_needs_review_from_cluster",
    training_sample_id: id,
    actor_user_id: auth.user.id,
    message: "An admin marked this outlier sample as needs review. It is no longer trusted clustering evidence.",
    metadata: { cluster_ids: outlier.data.map((row) => row.cluster_id) },
  });
  if (event.error) return NextResponse.json({ error: event.error.message }, { status: 500 });
  try {
    const rebuilt = await rebuildAllPatternClusters({ actorUserId: auth.user.id });
    return NextResponse.json({ ok: true, rebuiltClusters: rebuilt.clusters.length });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error
        ? `Sample was moved to needs review, but cluster rebuild failed: ${error.message}`
        : "Sample was moved to needs review, but cluster rebuild failed.",
    }, { status: 500 });
  }
}
