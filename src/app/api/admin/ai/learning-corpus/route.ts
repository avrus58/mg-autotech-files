import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getLearningCorpusCoverage } from "@/lib/ecuIntelligence/learningFlywheel";
import { getLearningFlywheelObservability } from "@/lib/ecuIntelligence/learningObservability";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function tableMissing(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "42P01" ||
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    error?.message?.includes("schema cache");
}

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const admin = getSupabaseAdmin();
    const [coverage, observability, files, pairs, events] = await Promise.all([
      getLearningCorpusCoverage(),
      getLearningFlywheelObservability(),
      admin
        .from("ai_learning_file_candidates")
        .select("id, request_id, source_type, file_role_candidate, file_name, file_size, supplier, ecu_family, ecu_type, hw_number, sw_number, calibration_id, representation_type, read_method, identity_confidence, review_status, analysis_status, quality_score, stock_or_modified_guess, learning_authorization_status, created_at")
        .order("created_at", { ascending: false })
        .limit(60),
      admin
        .from("ai_learning_pair_candidates")
        .select("id, request_id, pair_type, pair_confidence, requested_service_labels, performed_service_labels, dtc_codes, quality_score, review_status, learning_use_status, learning_authorization_status, learning_authorization_terms_version, linked_training_sample_id, created_at")
        .order("created_at", { ascending: false })
        .limit(60),
      admin
        .from("ai_learning_review_events")
        .select("id, request_id, action, notes, created_at")
        .order("created_at", { ascending: false })
        .limit(25),
    ]);
    const firstError = files.error || pairs.error || events.error;
    if (firstError) {
      return NextResponse.json(
        { error: firstError.message, setupRequired: tableMissing(firstError) },
        { status: tableMissing(firstError) ? 503 : 500 }
      );
    }
    return NextResponse.json({
      coverage,
      observability,
      files: files.data ?? [],
      pairs: pairs.data ?? [],
      events: events.data ?? [],
      safety: {
        createsTrainingSamplesAutomatically: false,
        requiresHumanVerification: true,
        requiresApprovedForLearning: true,
        firmwareGenerated: false,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Learning corpus coverage could not be loaded.",
        setupRequired: /ai_learning_/i.test(error instanceof Error ? error.message : ""),
      },
      { status: 503 }
    );
  }
}
