import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { trainingFeatureKeys } from "@/lib/ecuIntelligence/types";
import { isAiTrainingDemoEnabled } from "@/lib/ecuIntelligence/demoFixtures";

function tableMissing(error: { code?: string; message?: string } | null) {
  return error?.code === "42P01" ||
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    error?.message?.includes("schema cache");
}

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = getSupabaseAdmin();
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "all";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 250);

  let samplesQuery = admin
    .from("ai_training_samples")
    .select(
      "id, request_id, brand, model, engine, ecu_type, ecu_family, sw_number, hw_number, service_labels, requested_service_labels, performed_service_labels, provider, source_type, revision_label, revision_number, change_type_classification, learning_use_status, auto_label_confidence, human_verified, human_verification_status, quality_rating, data_quality_score, data_quality_reasons, safety_rating, outcome, ori_file_name, mod_file_name, source_metadata, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status !== "all") samplesQuery = samplesQuery.eq("human_verification_status", status);

  const [samples, profiles, events, total, confirmed, unverified, review, rejected, approved, excluded, profileTotal, level3Profiles] = await Promise.all([
    samplesQuery,
    admin
      .from("ai_ecu_knowledge_profiles")
      .select("*")
      .order("total_samples", { ascending: false })
      .limit(100),
    admin
      .from("ai_training_events")
      .select("id, event_type, request_id, training_sample_id, message, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
    admin.from("ai_training_samples").select("id", { count: "exact", head: true }),
    admin.from("ai_training_samples").select("id", { count: "exact", head: true }).eq("human_verification_status", "confirmed"),
    admin.from("ai_training_samples").select("id", { count: "exact", head: true }).eq("human_verification_status", "unverified"),
    admin.from("ai_training_samples").select("id", { count: "exact", head: true }).in("human_verification_status", ["unverified", "needs_review"]),
    admin.from("ai_training_samples").select("id", { count: "exact", head: true }).eq("human_verification_status", "rejected"),
    admin.from("ai_training_samples").select("id", { count: "exact", head: true }).eq("learning_use_status", "approved_for_learning"),
    admin.from("ai_training_samples").select("id", { count: "exact", head: true }).eq("learning_use_status", "excluded"),
    admin.from("ai_ecu_knowledge_profiles").select("id", { count: "exact", head: true }),
    admin.from("ai_ecu_knowledge_profiles").select("id", { count: "exact", head: true }).gte("learning_level", 3),
  ]);

  const firstError = samples.error || profiles.error || events.error || total.error || confirmed.error || unverified.error || review.error || rejected.error || approved.error || excluded.error || profileTotal.error || level3Profiles.error;
  if (firstError) {
    return NextResponse.json(
      {
        error: firstError.message,
        setupRequired: tableMissing(firstError),
      },
      { status: tableMissing(firstError) ? 503 : 500 }
    );
  }

  const featureResults = await Promise.all(
    trainingFeatureKeys.map(async (feature) => {
      const result = await admin
        .from("ai_training_samples")
        .select("id", { count: "exact", head: true })
        .eq("learning_use_status", "approved_for_learning")
        .contains("performed_service_labels", { [feature]: true });
      return { feature, count: result.count ?? 0, error: result.error };
    })
  );
  const featureError = featureResults.find((result) => result.error)?.error;
  if (featureError) {
    return NextResponse.json({ error: featureError.message }, { status: 500 });
  }
  const featureCounts = Object.fromEntries(featureResults.map((result) => [result.feature, result.count]));

  return NextResponse.json({
    demoEnabled: isAiTrainingDemoEnabled(),
    samples: samples.data ?? [],
    profiles: profiles.data ?? [],
    events: events.data ?? [],
    stats: {
      total: total.count ?? 0,
      oriModPairs: total.count ?? 0,
      confirmed: confirmed.count ?? 0,
      unverified: unverified.count ?? 0,
      needsReview: review.count ?? 0,
      rejected: rejected.count ?? 0,
      approvedForLearning: approved.count ?? 0,
      excludedFromLearning: excluded.count ?? 0,
      profiles: profileTotal.count ?? 0,
      level3Plus: level3Profiles.count ?? 0,
      featureCounts,
    },
  });
}
