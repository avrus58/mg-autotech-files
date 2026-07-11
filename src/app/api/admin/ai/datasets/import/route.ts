import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { importSourceTypes } from "@/lib/aiFileIntelligence/datasetImport";
import {
  createDatasetDryRunFromScannerRows,
  parseScannerJsonl,
} from "@/lib/aiFileIntelligence/datasetScanMetadata";

const importSchema = z.object({
  jsonl: z.string().min(2),
  sourceType: z.enum(importSourceTypes).default("local_dev_archive"),
  sourceName: z.string().trim().max(160).nullable().optional(),
  sourceReference: z.string().trim().max(500).nullable().optional(),
  providerName: z.string().trim().max(160).nullable().optional(),
  persist: z.boolean().default(true),
}).strict();

function chunk<T>(rows: T[], size = 500) {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) chunks.push(rows.slice(index, index + size));
  return chunks;
}

export async function POST(request: Request) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const contentType = request.headers.get("content-type") || "";
  const rawPayload = contentType.includes("application/json")
    ? await request.json().catch(() => null)
    : { jsonl: await request.text(), sourceType: "local_dev_archive", persist: true };
  const parsed = importSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid scanner metadata import payload." }, { status: 400 });
  }

  const scan = parseScannerJsonl(parsed.data.jsonl);
  if (!scan.rows.length) {
    return NextResponse.json({ error: "No valid scanner metadata rows were found.", rejected_lines: scan.rejected_lines }, { status: 400 });
  }
  const dryRun = createDatasetDryRunFromScannerRows({
    rows: scan.rows,
    sourceType: parsed.data.sourceType,
    sourceName: parsed.data.sourceName || "Local AI dataset scanner import",
    providerName: parsed.data.providerName || null,
  });

  if (!parsed.data.persist) {
    return NextResponse.json({
      ...dryRun,
      rejected_lines: scan.rejected_lines,
      persisted: false,
      mutation: "none",
      message: "Scanner metadata dry-run complete. Nothing was inserted.",
    });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: batch, error: batchError } = await supabaseAdmin
    .from("ai_dataset_import_batches")
    .insert({
      source_type: parsed.data.sourceType,
      source_name: parsed.data.sourceName || "Local AI dataset scanner import",
      source_reference: parsed.data.sourceReference || "local-scanner-jsonl",
      provider_name: parsed.data.providerName || null,
      import_mode: "staged",
      dry_run: false,
      status: dryRun.errors.length || scan.rejected_lines.length ? "needs_review" : "analyzed",
      total_files: dryRun.batch.total_files,
      candidate_pairs: dryRun.batch.candidate_pairs,
      confirmed_pairs: 0,
      duplicates: dryRun.batch.duplicates,
      rejected: 0,
      needs_review: dryRun.batch.needs_review,
      errors: [...dryRun.errors, ...scan.rejected_lines.map((line) => `Line ${line.line}: ${line.error}`)],
      warnings: dryRun.warnings,
      created_by: auth.user.id,
    })
    .select("id")
    .single();
  if (batchError || !batch) {
    return NextResponse.json({ error: batchError?.message || "Dataset import batch could not be created." }, { status: 500 });
  }

  const fileTempToDbId = new Map<string, string>();
  const fileRows = dryRun.files.map((file) => ({
    batch_id: batch.id,
    filename: file.filename,
    file_role_guess: file.file_role_guess,
    file_extension: file.file_extension,
    file_size: file.file_size,
    fingerprint: file.fingerprint,
    safe_storage_reference: typeof file.provider_metadata.relative_path === "string" ? file.provider_metadata.relative_path : null,
    raw_storage_path: null,
    ecu_family_guess: file.ecu_family_guess,
    ecu_type_guess: file.ecu_type_guess,
    sw_number_guess: file.sw_number_guess,
    hw_number_guess: file.hw_number_guess,
    vehicle_guess: file.vehicle_guess,
    service_label_guess: file.service_label_guess,
    provider_metadata: {
      ...file.provider_metadata,
      temp_candidate_id: file.id,
      raw_binary_uploaded: false,
      supabase_storage_used: false,
    },
    validation_status: file.validation_status,
    privacy_status: file.privacy_status,
    warnings: file.warnings,
    errors: file.errors,
  }));

  for (const fileChunk of chunk(fileRows)) {
    const { data, error } = await supabaseAdmin
      .from("ai_dataset_file_candidates")
      .insert(fileChunk)
      .select("id, provider_metadata");
    if (error) return NextResponse.json({ error: error.message, batch_id: batch.id }, { status: 500 });
    for (const row of data || []) {
      const tempId = typeof row.provider_metadata?.temp_candidate_id === "string" ? row.provider_metadata.temp_candidate_id : null;
      if (tempId) fileTempToDbId.set(tempId, row.id);
    }
  }

  const pairRows = dryRun.pairs
    .map((pair) => ({
      batch_id: batch.id,
      ori_candidate_id: pair.ori_candidate_id ? fileTempToDbId.get(pair.ori_candidate_id) || null : null,
      mod_candidate_id: pair.mod_candidate_id ? fileTempToDbId.get(pair.mod_candidate_id) || null : null,
      pair_confidence: pair.pair_confidence,
      pairing_reasons: pair.pairing_reasons,
      ecu_match_score: pair.ecu_match_score,
      file_size_relation: pair.file_size_relation,
      sw_hw_match: pair.sw_hw_match,
      service_label_guess: pair.service_label_guess,
      actual_service_labels: [],
      changed_region_summary: pair.changed_region_summary,
      map_attribution_summary: pair.map_attribution_summary,
      quality_score: pair.quality_score,
      quality_reasons: pair.quality_reasons,
      learning_recommendation: pair.learning_recommendation,
      review_status: pair.review_status,
      admin_notes: "Scanner metadata import candidate. Actual service labels require human confirmation.",
    }))
    .filter((pair) => pair.ori_candidate_id && pair.mod_candidate_id);

  let insertedPairs = 0;
  for (const pairChunk of chunk(pairRows)) {
    const { error, count } = await supabaseAdmin
      .from("ai_dataset_pair_candidates")
      .insert(pairChunk, { count: "exact" });
    if (error) return NextResponse.json({ error: error.message, batch_id: batch.id }, { status: 500 });
    insertedPairs += count || pairChunk.length;
  }

  await supabaseAdmin.from("ai_dataset_review_events").insert({
    batch_id: batch.id,
    action: "scanner_metadata_imported",
    actor_id: auth.user.id,
    notes: "Metadata-only scanner import. No raw files uploaded; no learning samples approved.",
    new_value: {
      scanner_summary: dryRun.scanner_summary,
      file_candidates: fileRows.length,
      pair_candidates: insertedPairs,
      rejected_lines: scan.rejected_lines.length,
      raw_binary_uploaded: false,
      supabase_storage_used: false,
    },
  });

  return NextResponse.json({
    batch_id: batch.id,
    persisted: true,
    raw_files_uploaded: false,
    supabase_storage_used: false,
    created: {
      file_candidates: fileRows.length,
      pair_candidates: insertedPairs,
      review_events: 1,
      training_samples: 0,
      approved_learning_samples: 0,
    },
    scanner_summary: dryRun.scanner_summary,
    rejected_lines: scan.rejected_lines,
    message: "Scanner metadata imported for admin review. No raw files were uploaded and no learning samples were approved.",
  });
}
