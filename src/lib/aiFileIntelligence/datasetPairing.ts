import {
  labelsToTrainingRecord,
  stableDatasetId,
  type DatasetDryRunResult,
  type DatasetFileCandidate,
  type DatasetFileDescriptor,
  type DatasetFileRoleGuess,
  type DatasetPairCandidate,
  type DatasetServiceLabel,
  type ImportSourceType,
} from "@/lib/aiFileIntelligence/datasetImport";
import { scoreDatasetPairCandidate } from "@/lib/aiFileIntelligence/datasetValidation";

const supportedExtensions = new Set(["bin", "ori", "mod", "hex", "frf", "sgo"]);

function normalizeText(value: string | null | undefined) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function extension(filename: string) {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function baseKey(filename: string) {
  const withoutExt = filename.replace(/\.[^.]+$/, "");
  return normalizeText(withoutExt)
    .replace(/\b(original|ori|stock|read|backup|mod|stage\s*1|stage\s*2|stage\s*3|egr|dpf|adblue|dtc|vmax|tcu|off|file|tuned)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function guessFileRole(filename: string): DatasetFileRoleGuess {
  const text = normalizeText(filename);
  if (/\b(ori|original|stock|read|backup)\b/.test(text)) return "ori";
  if (/\b(mod|stage\s*1|stage\s*2|stage\s*3|egr|dpf|adblue|dtc|vmax|tcu|pop|launch|tuned)\b/.test(text)) return "mod";
  return "unknown";
}

export function suggestServiceLabelsFromText(input: string): DatasetServiceLabel[] {
  const text = normalizeText(input);
  const labels = new Set<DatasetServiceLabel>();
  if (/\bstage\s*1\b|\bstg\s*1\b|\bstage1\b/.test(text)) labels.add("stage1");
  if (/\bstage\s*2\b|\bstg\s*2\b|\bstage2\b/.test(text)) labels.add("stage2");
  if (/\bstage\s*3\b|\bstg\s*3\b|\bstage3\b/.test(text)) labels.add("stage3");
  if (/\begr\b/.test(text)) labels.add("egr_off");
  if (/\bdpf\b/.test(text)) labels.add("dpf_off");
  if (/\badblue\b|\bscr\b/.test(text)) labels.add("adblue_off");
  if (/\bdtc\b|\bp[0-9]{4}\b/.test(text)) labels.add("dtc_off");
  if (/\bvmax\b|speed\s*limit/.test(text)) labels.add("vmax_off");
  if (/start\s*stop/.test(text)) labels.add("start_stop_off");
  if (/\btcu\b|\bdsg\b|\bgearbox\b/.test(text)) labels.add("tcu");
  if (/pop|bang|pops/.test(text)) labels.add("pops_bangs");
  if (/launch/.test(text)) labels.add("launch_control");
  if (!labels.size && /\bcustom|special|solution\b/.test(text)) labels.add("custom");
  return [...labels];
}

export function createDatasetFileCandidate(input: {
  batchId: string;
  descriptor: DatasetFileDescriptor;
  index: number;
}): DatasetFileCandidate {
  const filename = input.descriptor.filename.trim();
  const ext = extension(filename);
  const role = guessFileRole(filename);
  const fileSize = Math.max(0, Math.floor(Number(input.descriptor.fileSize || 0)));
  const fingerprint = input.descriptor.fingerprint?.trim() ||
    stableDatasetId("fp", `${filename}:${fileSize}:${input.descriptor.folder || ""}`);
  const warnings: string[] = [];
  const errors: string[] = [];
  if (!filename) errors.push("Filename is required.");
  if (!supportedExtensions.has(ext)) warnings.push("File extension is not a common ECU/TCU binary container.");
  if (fileSize <= 0) warnings.push("File size is missing; pairing confidence will be limited.");

  return {
    id: stableDatasetId("file", `${input.batchId}:${input.index}:${filename}:${fingerprint}`),
    batch_id: input.batchId,
    filename,
    folder: input.descriptor.folder || null,
    file_role_guess: role,
    file_extension: ext,
    file_size: fileSize,
    fingerprint,
    ecu_family_guess: typeof input.descriptor.providerMetadata?.ecu_family === "string" ? input.descriptor.providerMetadata.ecu_family : null,
    ecu_type_guess: typeof input.descriptor.providerMetadata?.ecu_type === "string" ? input.descriptor.providerMetadata.ecu_type : null,
    sw_number_guess: typeof input.descriptor.providerMetadata?.sw_number === "string" ? input.descriptor.providerMetadata.sw_number : null,
    hw_number_guess: typeof input.descriptor.providerMetadata?.hw_number === "string" ? input.descriptor.providerMetadata.hw_number : null,
    vehicle_guess: typeof input.descriptor.providerMetadata?.vehicle === "object" && input.descriptor.providerMetadata.vehicle !== null ? input.descriptor.providerMetadata.vehicle as Record<string, unknown> : {},
    service_label_guess: suggestServiceLabelsFromText(`${input.descriptor.folder || ""} ${filename}`),
    provider_metadata: input.descriptor.providerMetadata || {},
    privacy_status: "safe",
    validation_status: errors.length ? "invalid" : warnings.length ? "warning" : "valid",
    warnings,
    errors,
  };
}

function fileSizeRelation(ori: DatasetFileCandidate, mod: DatasetFileCandidate): DatasetPairCandidate["file_size_relation"] {
  if (!ori.file_size || !mod.file_size) return "unknown";
  if (ori.file_size === mod.file_size) return "same_size";
  const ratio = Math.min(ori.file_size, mod.file_size) / Math.max(ori.file_size, mod.file_size);
  return ratio >= 0.98 ? "near_size" : "different_size";
}

function pairConfidence(ori: DatasetFileCandidate, mod: DatasetFileCandidate) {
  const reasons: string[] = [];
  let score = 0;
  if (baseKey(ori.filename) && baseKey(ori.filename) === baseKey(mod.filename)) {
    score += 30;
    reasons.push("Filenames share the same normalized base.");
  }
  if ((ori.folder || "") === (mod.folder || "")) {
    score += 12;
    reasons.push("Files are in the same folder/package.");
  }
  const relation = fileSizeRelation(ori, mod);
  if (relation === "same_size") {
    score += 25;
    reasons.push("ORI and MOD have the same file size.");
  } else if (relation === "near_size") {
    score += 12;
    reasons.push("ORI and MOD file sizes are close.");
  }
  if (ori.sw_number_guess && mod.sw_number_guess && ori.sw_number_guess === mod.sw_number_guess) {
    score += 18;
    reasons.push("SW number metadata matches.");
  }
  if (ori.hw_number_guess && mod.hw_number_guess && ori.hw_number_guess === mod.hw_number_guess) {
    score += 10;
    reasons.push("HW number metadata matches.");
  }
  if (mod.service_label_guess.length) {
    score += 5;
    reasons.push("MOD filename/provider metadata suggests service labels.");
  }
  return { score: Math.min(100, score), reasons };
}

export function suggestOriModPairs(files: DatasetFileCandidate[], batchId: string): DatasetPairCandidate[] {
  const oris = files.filter((file) => file.file_role_guess === "ori");
  const mods = files.filter((file) => file.file_role_guess === "mod");
  const pairs: DatasetPairCandidate[] = [];
  for (const ori of oris) {
    for (const mod of mods) {
      if (ori.id === mod.id) continue;
      const confidence = pairConfidence(ori, mod);
      if (confidence.score < 30) continue;
      const pair: DatasetPairCandidate = {
        id: stableDatasetId("pair", `${ori.id}:${mod.id}`),
        batch_id: batchId,
        ori_candidate_id: ori.id,
        mod_candidate_id: mod.id,
        pair_confidence: confidence.score,
        pairing_reasons: confidence.reasons,
        ecu_match_score: confidence.reasons.some((reason) => /SW|HW/.test(reason)) ? 80 : 40,
        file_size_relation: fileSizeRelation(ori, mod),
        sw_hw_match: Boolean(ori.sw_number_guess && mod.sw_number_guess && ori.sw_number_guess === mod.sw_number_guess),
        service_label_guess: mod.service_label_guess,
        changed_region_summary: {},
        map_attribution_summary: {},
        quality_score: 0,
        quality_reasons: [],
        learning_recommendation: "needs_actual_labels",
        review_status: confidence.score >= 70 ? "auto_pair_suggested" : "needs_manual_pairing",
        actual_service_labels: null,
        admin_notes: null,
      };
      const quality = scoreDatasetPairCandidate(pair, { ori, mod });
      pair.quality_score = quality.score;
      pair.quality_reasons = quality.reasons;
      pair.learning_recommendation = quality.recommendation;
      pairs.push(pair);
    }
  }
  return pairs.sort((left, right) => right.pair_confidence - left.pair_confidence);
}

export function createDatasetDryRun(input: {
  files: DatasetFileDescriptor[];
  sourceType?: ImportSourceType;
  sourceName?: string | null;
  providerName?: string | null;
}): DatasetDryRunResult {
  const batchId = stableDatasetId("batch", JSON.stringify(input.files.map((file) => [file.folder, file.filename, file.fileSize, file.fingerprint])));
  const files = input.files.map((descriptor, index) => createDatasetFileCandidate({ batchId, descriptor, index }));
  const fingerprintCounts = new Map<string, number>();
  for (const file of files) fingerprintCounts.set(file.fingerprint, (fingerprintCounts.get(file.fingerprint) || 0) + 1);
  const duplicateFiles = files.filter((file) => (fingerprintCounts.get(file.fingerprint) || 0) > 1);
  for (const file of duplicateFiles) {
    file.validation_status = "duplicate";
    file.warnings.push("Duplicate fingerprint in import package.");
  }
  const validFiles = files.filter((file) => file.validation_status !== "duplicate" && file.validation_status !== "invalid");
  const pairs = suggestOriModPairs(validFiles, batchId);
  const pairedOri = new Set(pairs.map((pair) => pair.ori_candidate_id).filter(Boolean));
  const pairedMod = new Set(pairs.map((pair) => pair.mod_candidate_id).filter(Boolean));
  const unmatchedOri = validFiles.filter((file) => file.file_role_guess === "ori" && !pairedOri.has(file.id));
  const unmatchedMod = validFiles.filter((file) => file.file_role_guess === "mod" && !pairedMod.has(file.id));
  const unknown = validFiles.filter((file) => file.file_role_guess === "unknown");
  const warnings = [
    ...files.flatMap((file) => file.warnings.map((warning) => `${file.filename}: ${warning}`)),
    ...pairs.filter((pair) => pair.review_status === "needs_manual_pairing").map((pair) => `${pair.id}: Pair needs manual review.`),
  ];
  const errors = files.flatMap((file) => file.errors.map((error) => `${file.filename}: ${error}`));

  return {
    batch: {
      id: batchId,
      source_type: input.sourceType || "manual_upload",
      source_name: input.sourceName || null,
      source_reference: null,
      provider_name: input.providerName || null,
      import_mode: "dry_run",
      dry_run: true,
      status: errors.length ? "needs_review" : "analyzed",
      total_files: files.length,
      candidate_pairs: pairs.length,
      confirmed_pairs: 0,
      duplicates: duplicateFiles.length,
      rejected: 0,
      needs_review: pairs.filter((pair) => pair.review_status !== "auto_pair_suggested").length + unmatchedOri.length + unmatchedMod.length + unknown.length,
      errors,
      warnings,
      created_at: new Date(0).toISOString(),
    },
    files,
    pairs,
    unmatched_ori: unmatchedOri,
    unmatched_mod: unmatchedMod,
    unknown_files: unknown,
    duplicate_files: duplicateFiles,
    warnings,
    errors,
  };
}

export { labelsToTrainingRecord };
