import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  const admin = getSupabaseAdmin();
  const [cluster, members] = await Promise.all([
    admin.from("ai_pattern_clusters").select("*").eq("id", id).single(),
    admin.from("ai_cluster_members")
      .select("id, cluster_id, training_sample_id, membership_score, membership_reasons, is_outlier, created_at")
      .eq("cluster_id", id)
      .order("membership_score", { ascending: false }),
  ]);
  if (cluster.error || !cluster.data) {
    return NextResponse.json({ error: cluster.error?.message || "Pattern cluster not found." }, { status: 404 });
  }
  if (members.error) return NextResponse.json({ error: members.error.message }, { status: 500 });
  const sampleIds = (members.data ?? []).map((member) => member.training_sample_id);
  const samples = sampleIds.length
    ? await admin.from("ai_training_samples").select(
        "id, request_id, brand, model, engine, ecu_family, ecu_type, sw_number, hw_number, performed_service_labels, requested_service_labels, data_quality_score, quality_rating, outcome, human_verification_status, learning_use_status, provider, source_type, revision_number, created_at"
      ).in("id", sampleIds)
    : { data: [], error: null };
  if (samples.error) return NextResponse.json({ error: samples.error.message }, { status: 500 });
  const metric = await admin.from("ai_accuracy_metrics").select("*")
    .eq("scope_type", "cluster").eq("scope_key", cluster.data.cluster_key).maybeSingle();
  if (metric.error) return NextResponse.json({ error: metric.error.message }, { status: 500 });
  return NextResponse.json({
    cluster: cluster.data,
    members: members.data ?? [],
    samples: samples.data ?? [],
    accuracy: metric.data ?? null,
    warning: "Evidence only. Human tuner and checksum verification are required before any real write.",
  });
}
