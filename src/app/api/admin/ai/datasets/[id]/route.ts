import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { evaluateStage1Readiness } from "@/lib/aiFileIntelligence/stage1Readiness";

function scannerSummaryFromEvents(events: Array<{ action?: string | null; new_value?: unknown }>) {
  const importEvent = events.find((event) => event.action === "scanner_metadata_imported");
  const value = importEvent?.new_value;
  if (!value || typeof value !== "object") return null;
  const summary = (value as Record<string, unknown>).scanner_summary;
  return summary && typeof summary === "object" ? summary : null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  const supabaseAdmin = getSupabaseAdmin();

  const { data: batch, error: batchError } = await supabaseAdmin
    .from("ai_dataset_import_batches")
    .select("id, source_type, source_name, provider_name, import_mode, dry_run, status, total_files, candidate_pairs, duplicates, rejected, needs_review, errors, warnings, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (batchError || !batch) {
    return NextResponse.json({ error: batchError?.message || "Dataset batch not found." }, { status: 404 });
  }

  const [files, pairs, events] = await Promise.all([
    supabaseAdmin
      .from("ai_dataset_file_candidates")
      .select("id, filename, file_role_guess, file_extension, file_size, ecu_family_guess, ecu_type_guess, sw_number_guess, hw_number_guess, service_label_guess, validation_status, privacy_status, warnings, errors, created_at")
      .eq("batch_id", id)
      .order("created_at", { ascending: false })
      .limit(250),
    supabaseAdmin
      .from("ai_dataset_pair_candidates")
      .select("id, ori_candidate_id, mod_candidate_id, pair_confidence, pairing_reasons, ecu_match_score, file_size_relation, sw_hw_match, service_label_guess, quality_score, quality_reasons, learning_recommendation, review_status, created_at")
      .eq("batch_id", id)
      .order("pair_confidence", { ascending: false })
      .limit(250),
    supabaseAdmin
      .from("ai_dataset_review_events")
      .select("id, action, notes, new_value, created_at")
      .eq("batch_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const pairRows = pairs.data || [];
  const fileRows = files.data || [];
  const filesById = new Map(fileRows.map((file) => [file.id, file]));
  const reviewCounts = pairRows.reduce<Record<string, number>>((counts, pair) => {
    counts[pair.review_status] = (counts[pair.review_status] || 0) + 1;
    return counts;
  }, {});
  const stage1Readiness = evaluateStage1Readiness(pairRows.map((pair) => {
    const mod = pair.mod_candidate_id ? filesById.get(pair.mod_candidate_id) : null;
    const ori = pair.ori_candidate_id ? filesById.get(pair.ori_candidate_id) : null;
    return {
      ecu_family: mod?.ecu_family_guess || ori?.ecu_family_guess || null,
      ecu_type: mod?.ecu_type_guess || ori?.ecu_type_guess || null,
      sw_number: mod?.sw_number_guess || ori?.sw_number_guess || null,
      service_labels: Array.isArray(pair.service_label_guess) ? pair.service_label_guess : [],
      quality_score: pair.quality_score,
      confidence: pair.pair_confidence,
      warnings: Array.isArray(pair.quality_reasons) ? pair.quality_reasons : [],
      actual_service_labels_confirmed: pair.review_status === "approved",
      map_definitions_available: false,
    };
  }));

  return NextResponse.json({
    batch,
    files: fileRows,
    pairs: pairRows,
    events: events.data || [],
    scanner_summary: scannerSummaryFromEvents(events.data || []),
    review_counts: reviewCounts,
    stage1_readiness: stage1Readiness,
    errors: [files.error?.message, pairs.error?.message, events.error?.message].filter(Boolean),
    safety: {
      rawBinaryReturned: false,
      localPathsReturned: false,
      customerAccessible: false,
    },
  });
}
