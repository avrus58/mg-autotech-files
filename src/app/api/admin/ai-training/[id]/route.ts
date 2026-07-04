import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { updateTrainingSampleVerification } from "@/lib/ecuIntelligence/learning";
import { trainingFeatureKeys, trainingSafetyRatingKeys } from "@/lib/ecuIntelligence/types";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { redactBinaryPreviews } from "@/lib/fileExpert/publicResult";
import { getStoredSimilarityResults } from "@/lib/ecuIntelligence/similarity";

const serviceLabelsSchema = z.object(
  Object.fromEntries(trainingFeatureKeys.map((key) => [key, z.boolean()])) as Record<
    (typeof trainingFeatureKeys)[number],
    z.ZodBoolean
  >
);

const updateSchema = z.object({
  status: z.enum(["unverified", "confirmed", "rejected", "needs_review"]),
  aiCorrect: z.boolean().nullable().optional(),
  requestedServiceLabels: serviceLabelsSchema,
  performedServiceLabels: serviceLabelsSchema,
  learningUseStatus: z.enum(["pending", "approved_for_learning", "excluded"]),
  changeTypeClassification: z.enum([
    "identical",
    "focused_calibration",
    "distributed_calibration",
    "broad_rework",
    "structural_mismatch",
    "single_file",
    "unknown",
  ]),
  revisionNumber: z.number().int().min(1).max(10000),
  provider: z.string().trim().min(1).max(120),
  sourceType: z.enum(["completed_request", "demo_fixture", "manual_capture", "file_expert"]),
  qualityRating: z.number().int().min(1).max(5).nullable().optional(),
  safetyRating: z.enum(trainingSafetyRatingKeys).nullable().optional(),
  outcome: z.enum([
    "unknown",
    "customer_ok",
    "issue_reported",
    "limp",
    "smoke",
    "knock",
    "dyno_confirmed",
    "needs_revision",
  ]).nullable().optional(),
  adminNotes: z.string().max(5000).nullable().optional(),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  const admin = getSupabaseAdmin();

  const [sample, events, signatures, modelRuns, similarityEvidence] = await Promise.all([
    admin.from("ai_training_samples").select("*").eq("id", id).single(),
    admin.from("ai_training_events").select("*").eq("training_sample_id", id).order("created_at", { ascending: false }),
    admin.from("ai_pattern_signatures").select("*").eq("training_sample_id", id).order("created_at", { ascending: false }),
    admin.from("ai_model_runs").select("*").eq("source_type", "training_sample").eq("source_id", id).order("created_at", { ascending: false }),
    getStoredSimilarityResults("training_sample", id).catch(() => null),
  ]);
  if (sample.error || !sample.data) {
    return NextResponse.json({ error: sample.error?.message || "Training sample not found." }, { status: 404 });
  }

  const memberRows = await admin.from("ai_cluster_members")
    .select("cluster_id, membership_score, membership_reasons, is_outlier")
    .eq("training_sample_id", id);
  const level2Missing = memberRows.error && ["42P01", "42703", "PGRST204", "PGRST205"].includes(memberRows.error.code || "");
  if (memberRows.error && !level2Missing) {
    return NextResponse.json({ error: memberRows.error.message }, { status: 500 });
  }
  const clusterIds = (memberRows.data ?? []).map((member) => member.cluster_id);
  const memberClusters = clusterIds.length
    ? await admin.from("ai_pattern_clusters")
        .select("id, cluster_key, ecu_family, ecu_type, sw_number, feature_type, sample_count, cluster_confidence, cluster_status, repeated_regions")
        .in("id", clusterIds)
    : { data: [], error: null };
  if (memberClusters.error) return NextResponse.json({ error: memberClusters.error.message }, { status: 500 });

  let possibleClusters: Array<Record<string, unknown>> = [];
  if (!level2Missing && sample.data.human_verification_status !== "confirmed") {
    let possibleQuery = admin.from("ai_pattern_clusters")
      .select("id, cluster_key, ecu_family, ecu_type, sw_number, feature_type, sample_count, cluster_confidence, cluster_status")
      .gt("sample_count", 0)
      .order("cluster_confidence", { ascending: false })
      .limit(20);
    if (sample.data.ecu_family) possibleQuery = possibleQuery.eq("ecu_family", sample.data.ecu_family);
    if (sample.data.ecu_type) possibleQuery = possibleQuery.eq("ecu_type", sample.data.ecu_type);
    const possible = await possibleQuery;
    if (!possible.error) {
      const labels = sample.data.performed_service_labels || sample.data.requested_service_labels || {};
      possibleClusters = (possible.data ?? []).filter((cluster) => labels[cluster.feature_type] === true);
    }
  }
  const clustersById = new Map((memberClusters.data ?? []).map((cluster) => [cluster.id, cluster]));

  return NextResponse.json({
    sample: {
      ...sample.data,
      diff_json: redactBinaryPreviews(sample.data.diff_json),
    },
    events: events.data ?? [],
    signatures: signatures.data ?? [],
    modelRuns: modelRuns.data ?? [],
    similarityEvidence,
    clusterEvidence: {
      available: !level2Missing,
      memberships: (memberRows.data ?? []).map((member) => ({
        ...member,
        cluster: clustersById.get(member.cluster_id) ?? null,
      })),
      possibleClusters,
      warning: "Cluster evidence is analysis-only. Human tuner and checksum verification remain required.",
    },
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid verification data." },
      { status: 400 }
    );
  }
  const { id } = await context.params;

  try {
    const sample = await updateTrainingSampleVerification({
      sampleId: id,
      actorUserId: auth.user.id,
      status: parsed.data.status,
      aiCorrect: parsed.data.aiCorrect,
      requestedServiceLabels: parsed.data.requestedServiceLabels,
      performedServiceLabels: parsed.data.performedServiceLabels,
      learningUseStatus: parsed.data.learningUseStatus,
      changeTypeClassification: parsed.data.changeTypeClassification,
      revisionNumber: parsed.data.revisionNumber,
      provider: parsed.data.provider,
      sourceType: parsed.data.sourceType,
      qualityRating: parsed.data.qualityRating,
      safetyRating: parsed.data.safetyRating,
      outcome: parsed.data.outcome,
      adminNotes: parsed.data.adminNotes,
    });
    return NextResponse.json({ sample });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Training sample could not be updated." },
      { status: 500 }
    );
  }
}
