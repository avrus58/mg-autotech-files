import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { patternClusterStatuses, trainingFeatureKeys } from "@/lib/ecuIntelligence/types";

function tableMissing(error: { code?: string; message?: string } | null) {
  return ["42P01", "42703", "PGRST204", "PGRST205"].includes(error?.code || "") ||
    Boolean(error?.message?.toLowerCase().includes("schema cache"));
}

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "all";
  const feature = url.searchParams.get("feature") || "all";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 250), 1), 500);
  const admin = getSupabaseAdmin();

  let query = admin.from("ai_pattern_clusters").select("*")
    .order("cluster_confidence", { ascending: false })
    .order("sample_count", { ascending: false })
    .limit(limit);
  if (status !== "all" && patternClusterStatuses.includes(status as (typeof patternClusterStatuses)[number])) {
    query = query.eq("cluster_status", status);
  }
  if (feature !== "all" && trainingFeatureKeys.includes(feature as (typeof trainingFeatureKeys)[number])) {
    query = query.eq("feature_type", feature);
  }
  const [clusters, globalAccuracy] = await Promise.all([
    query,
    admin.from("ai_accuracy_metrics").select("*").eq("scope_type", "global").eq("scope_key", "all").maybeSingle(),
  ]);
  const firstError = clusters.error || globalAccuracy.error;
  if (firstError) {
    return NextResponse.json(
      { error: firstError.message, setupRequired: tableMissing(firstError) },
      { status: tableMissing(firstError) ? 503 : 500 }
    );
  }
  const rows = clusters.data ?? [];
  return NextResponse.json({
    clusters: rows,
    accuracy: globalAccuracy.data ?? null,
    stats: {
      total: rows.length,
      weak: rows.filter((row) => row.cluster_status === "weak").length,
      usable: rows.filter((row) => row.cluster_status === "usable").length,
      strong: rows.filter((row) => row.cluster_status === "strong" || row.cluster_status === "mature").length,
      mature: rows.filter((row) => row.cluster_status === "mature").length,
      outliers: rows.reduce((sum, row) => sum + (Array.isArray(row.outlier_sample_ids) ? row.outlier_sample_ids.length : 0), 0),
    },
  });
}
