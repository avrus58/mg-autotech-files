import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { updateTrainingSampleVerification } from "@/lib/ecuIntelligence/learning";
import { trainingFeatureKeys } from "@/lib/ecuIntelligence/types";
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
  safetyRating: z.enum(["unknown", "safe", "aggressive", "risky", "bad"]).nullable().optional(),
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

  return NextResponse.json({
    sample: {
      ...sample.data,
      diff_json: redactBinaryPreviews(sample.data.diff_json),
    },
    events: events.data ?? [],
    signatures: signatures.data ?? [],
    modelRuns: modelRuns.data ?? [],
    similarityEvidence,
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
