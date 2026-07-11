import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function eventScannerSummary(event: { new_value?: unknown } | null | undefined) {
  const value = event?.new_value;
  if (!value || typeof value !== "object") return null;
  const summary = (value as Record<string, unknown>).scanner_summary;
  return summary && typeof summary === "object" ? summary : null;
}

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const supabaseAdmin = getSupabaseAdmin();
  const { data: batches, error } = await supabaseAdmin
    .from("ai_dataset_import_batches")
    .select("id, source_type, source_name, provider_name, import_mode, dry_run, status, total_files, candidate_pairs, duplicates, needs_review, errors, warnings, created_at")
    .order("created_at", { ascending: false })
    .limit(25);

  const batchRows = batches || [];
  const batchIds = batchRows.map((batch) => batch.id).filter(Boolean);
  const [eventsResult, pairStatusResult] = batchIds.length
    ? await Promise.all([
        supabaseAdmin
          .from("ai_dataset_review_events")
          .select("batch_id, action, new_value, created_at")
          .in("batch_id", batchIds)
          .eq("action", "scanner_metadata_imported")
          .order("created_at", { ascending: false }),
        supabaseAdmin
          .from("ai_dataset_pair_candidates")
          .select("batch_id, review_status")
          .in("batch_id", batchIds),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];

  const scannerSummaryByBatch = new Map<string, unknown>();
  for (const event of eventsResult.data || []) {
    if (!scannerSummaryByBatch.has(event.batch_id)) scannerSummaryByBatch.set(event.batch_id, eventScannerSummary(event));
  }

  const reviewCountsByBatch = new Map<string, Record<string, number>>();
  for (const pair of pairStatusResult.data || []) {
    const counts = reviewCountsByBatch.get(pair.batch_id) || {};
    counts[pair.review_status] = (counts[pair.review_status] || 0) + 1;
    reviewCountsByBatch.set(pair.batch_id, counts);
  }

  return NextResponse.json({
    status: "ready_for_dry_run",
    persistentWorkbenchRequiresSql: true,
    migration: "scripts/add-ai-dataset-import-workbench.sql",
    batches: error ? [] : batchRows.map((batch) => ({
      ...batch,
      scanner_summary: scannerSummaryByBatch.get(batch.id) || null,
      review_counts: reviewCountsByBatch.get(batch.id) || {},
    })),
    batchLoadError: error?.message || eventsResult.error?.message || pairStatusResult.error?.message || null,
    safety: {
      dryRunOnlyByDefault: true,
      createsTrainingSamples: false,
      approvesLearningAutomatically: false,
      generatesModFiles: false,
    },
  });
}
