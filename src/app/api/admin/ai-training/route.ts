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
  const learningUseStatus = url.searchParams.get("learningUseStatus") || "all";
  const serviceLabel = url.searchParams.get("serviceLabel") || "all";
  const ecuFamily = url.searchParams.get("ecuFamily")?.trim() || "";
  const ecuType = url.searchParams.get("ecuType")?.trim() || "";
  const minQuality = Math.min(Math.max(Number(url.searchParams.get("minQuality") || 0), 0), 100);
  const hasSimilarity = url.searchParams.get("hasSimilarity") === "true";
  const needsReviewOnly = url.searchParams.get("needsReview") === "true";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 250);

  let similarityFilteredIds: string[] | null = null;
  if (hasSimilarity) {
    const similarityIds = await admin
      .from("ai_similarity_results")
      .select("source_id")
      .eq("source_type", "training_sample")
      .limit(5000);
    if (similarityIds.error) {
      return NextResponse.json(
        { error: similarityIds.error.message, setupRequired: tableMissing(similarityIds.error) },
        { status: tableMissing(similarityIds.error) ? 503 : 500 }
      );
    }
    similarityFilteredIds = [...new Set((similarityIds.data ?? []).map((row) => row.source_id))];
  }

  let samplesQuery = admin
    .from("ai_training_samples")
    .select(
      "id, request_id, brand, model, engine, ecu_type, ecu_family, sw_number, hw_number, service_labels, requested_service_labels, performed_service_labels, provider, source_type, revision_label, revision_number, change_type_classification, learning_use_status, auto_label_confidence, human_verified, human_verification_status, quality_rating, data_quality_score, data_quality_reasons, safety_rating, outcome, ori_file_name, mod_file_name, source_metadata, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status !== "all") samplesQuery = samplesQuery.eq("human_verification_status", status);
  if (needsReviewOnly) samplesQuery = samplesQuery.in("human_verification_status", ["unverified", "needs_review"]);
  if (learningUseStatus !== "all") samplesQuery = samplesQuery.eq("learning_use_status", learningUseStatus);
  if (serviceLabel !== "all" && trainingFeatureKeys.includes(serviceLabel as (typeof trainingFeatureKeys)[number])) {
    samplesQuery = samplesQuery.contains("performed_service_labels", { [serviceLabel]: true });
  }
  if (ecuFamily) samplesQuery = samplesQuery.ilike("ecu_family", `%${ecuFamily}%`);
  if (ecuType) samplesQuery = samplesQuery.ilike("ecu_type", `%${ecuType}%`);
  if (minQuality > 0) samplesQuery = samplesQuery.gte("data_quality_score", minQuality);
  if (similarityFilteredIds) {
    samplesQuery = similarityFilteredIds.length
      ? samplesQuery.in("id", similarityFilteredIds.slice(0, 1000))
      : samplesQuery.eq("id", "00000000-0000-0000-0000-000000000000");
  }

  const [samples, profiles, events, total, confirmed, unverified, review, rejected, approved, pending, excluded, profileTotal, level3Profiles, qualityRows, similarityReadyProfiles] = await Promise.all([
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
    admin.from("ai_training_samples").select("id", { count: "exact", head: true }).eq("learning_use_status", "pending"),
    admin.from("ai_training_samples").select("id", { count: "exact", head: true }).eq("learning_use_status", "excluded"),
    admin.from("ai_ecu_knowledge_profiles").select("id", { count: "exact", head: true }),
    admin.from("ai_ecu_knowledge_profiles").select("id", { count: "exact", head: true }).gte("learning_level", 3),
    admin.from("ai_training_samples").select("data_quality_score").not("data_quality_score", "is", null).limit(5000),
    admin.from("ai_ecu_knowledge_profiles").select("id", { count: "exact", head: true }).in("similarity_readiness", ["usable", "strong"]),
  ]);

  const firstError = samples.error || profiles.error || events.error || total.error || confirmed.error || unverified.error || review.error || rejected.error || approved.error || pending.error || excluded.error || profileTotal.error || level3Profiles.error || qualityRows.error || similarityReadyProfiles.error;
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

  const sampleIds = (samples.data ?? []).map((sample) => sample.id);
  const visibleSimilarity = sampleIds.length
    ? await admin
        .from("ai_similarity_results")
        .select("source_id")
        .eq("source_type", "training_sample")
        .in("source_id", sampleIds)
    : { data: [], error: null };
  if (visibleSimilarity.error) {
    return NextResponse.json(
      { error: visibleSimilarity.error.message, setupRequired: tableMissing(visibleSimilarity.error) },
      { status: tableMissing(visibleSimilarity.error) ? 503 : 500 }
    );
  }
  const samplesWithSimilarity = new Set((visibleSimilarity.data ?? []).map((row) => row.source_id));
  const qualityValues = (qualityRows.data ?? [])
    .map((row) => Number(row.data_quality_score))
    .filter(Number.isFinite);
  const averageQualityScore = qualityValues.length
    ? Number((qualityValues.reduce((sum, value) => sum + value, 0) / qualityValues.length).toFixed(1))
    : 0;

  return NextResponse.json({
    demoEnabled: isAiTrainingDemoEnabled(),
    samples: (samples.data ?? []).map((sample) => ({
      ...sample,
      has_similarity_matches: samplesWithSimilarity.has(sample.id),
    })),
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
      pendingLearning: pending.count ?? 0,
      excludedFromLearning: excluded.count ?? 0,
      averageQualityScore,
      similarityReadyProfiles: similarityReadyProfiles.count ?? 0,
      profiles: profileTotal.count ?? 0,
      level3Plus: level3Profiles.count ?? 0,
      featureCounts,
    },
  });
}
