#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const PAIRABLE_EXTENSIONS = new Set(["bin", "ori", "mod", "hex", "frf", "sgo"]);

function parseArgs(argv) {
  const args = {
    datasetRoot: process.env.DATASET_ROOT || "",
    scan: "",
    out: "data/ai-pair-analysis.jsonl",
    limit: Number.POSITIVE_INFINITY,
    mergeDistance: 32,
    maxRegions: 80,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--root") args.datasetRoot = argv[++index] || "";
    else if (value === "--scan") args.scan = argv[++index] || "";
    else if (value === "--out") args.out = argv[++index] || args.out;
    else if (value === "--limit") args.limit = Number(argv[++index] || 0) || Number.POSITIVE_INFINITY;
    else if (value === "--merge-distance") args.mergeDistance = Math.max(0, Number(argv[++index] || 32) || 32);
    else if (value === "--max-regions") args.maxRegions = Math.max(1, Number(argv[++index] || 80) || 80);
  }
  return args;
}

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function baseKey(filename) {
  return normalizeText(filename.replace(/\.[^.]+$/, ""))
    .replace(/\b(original|ori|stock|read|backup|mod|stage\s*1|stage\s*2|stage\s*3|egr|dpf|adblue|dtc|vmax|tcu|off|file|tuned)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stableId(prefix, input) {
  return `${prefix}-${createHash("sha256").update(input).digest("hex").slice(0, 16)}`;
}

function isPairable(row) {
  return row && row.supported !== false && PAIRABLE_EXTENSIONS.has(String(row.extension || "").replace(/^\./, "").toLowerCase());
}

async function readJsonl(filePath) {
  const rows = [];
  const reader = createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Number.POSITIVE_INFINITY,
  });
  for await (const line of reader) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    rows.push(JSON.parse(trimmed));
  }
  return rows;
}

function pairConfidence(ori, mod) {
  const reasons = [];
  let score = 0;
  if (baseKey(ori.filename) && baseKey(ori.filename) === baseKey(mod.filename)) {
    score += 30;
    reasons.push("normalized_filename_match");
  }
  const oriFolder = dirname(ori.relative_path || "").replace(/\\/g, "/");
  const modFolder = dirname(mod.relative_path || "").replace(/\\/g, "/");
  if (oriFolder === modFolder) {
    score += 12;
    reasons.push("same_folder");
  }
  if (ori.file_size && mod.file_size) {
    if (ori.file_size === mod.file_size) {
      score += 25;
      reasons.push("same_file_size");
    } else {
      const ratio = Math.min(ori.file_size, mod.file_size) / Math.max(ori.file_size, mod.file_size);
      if (ratio >= 0.98) {
        score += 12;
        reasons.push("near_file_size");
      }
    }
  }
  if (ori.guessed_sw_number && mod.guessed_sw_number && ori.guessed_sw_number === mod.guessed_sw_number) {
    score += 18;
    reasons.push("sw_number_match");
  }
  if (ori.guessed_hw_number && mod.guessed_hw_number && ori.guessed_hw_number === mod.guessed_hw_number) {
    score += 10;
    reasons.push("hw_number_match");
  }
  if (Array.isArray(mod.guessed_service_labels) && mod.guessed_service_labels.length) {
    score += 5;
    reasons.push("mod_service_label_hint");
  }
  if (ori.sha256 && mod.sha256 && ori.sha256 !== mod.sha256) {
    score += 5;
    reasons.push("different_fingerprints");
  }
  return { confidence: Math.min(100, score), reasons };
}

function createPairs(rows) {
  const usable = rows.filter(isPairable);
  const oris = usable.filter((row) => row.guessed_file_role === "ori");
  const mods = usable.filter((row) => row.guessed_file_role === "mod");
  const pairs = [];
  for (const ori of oris) {
    for (const mod of mods) {
      const confidence = pairConfidence(ori, mod);
      if (confidence.confidence < 30) continue;
      pairs.push({ ori, mod, ...confidence });
    }
  }
  return pairs.sort((left, right) => right.confidence - left.confidence);
}

function resolveInside(root, relativePath) {
  const target = resolve(join(root, String(relativePath || "")));
  const normalizedRoot = resolve(root);
  if (target !== normalizedRoot && !target.startsWith(`${normalizedRoot}${sep}`)) {
    throw new Error(`Unsafe scanner relative path: ${relativePath}`);
  }
  return target;
}

function mergeChangedOffsets(offsets, mergeDistance) {
  const regions = [];
  for (const offset of offsets) {
    const current = regions[regions.length - 1];
    if (!current || offset > current.end_offset + mergeDistance + 1) {
      regions.push({ start_offset: offset, end_offset: offset, changed_count: 1 });
    } else {
      current.end_offset = offset;
      current.changed_count += 1;
    }
  }
  return regions.map((region) => {
    const length = region.end_offset - region.start_offset + 1;
    return {
      start_offset: region.start_offset,
      end_offset: region.end_offset,
      length,
      density: Number((region.changed_count / length).toFixed(4)),
    };
  });
}

async function compareFiles(oriPath, modPath, options) {
  const [ori, mod] = await Promise.all([readFile(oriPath), readFile(modPath)]);
  const warnings = [];
  if (ori.length !== mod.length) warnings.push("file_size_mismatch");
  const compareLength = Math.min(ori.length, mod.length);
  const changedOffsets = [];
  for (let index = 0; index < compareLength; index += 1) {
    if (ori[index] !== mod[index]) changedOffsets.push(index);
  }
  if (ori.length !== mod.length) {
    for (let index = compareLength; index < Math.max(ori.length, mod.length); index += 1) changedOffsets.push(index);
  }
  const changedPercent = Math.max(ori.length, mod.length) > 0
    ? Number(((changedOffsets.length / Math.max(ori.length, mod.length)) * 100).toFixed(4))
    : 0;
  if (changedOffsets.length === 0) warnings.push("identical_files");
  if (changedOffsets.length > 0 && changedPercent < 0.05) warnings.push("suspicious_tiny_diff");
  if (changedPercent > 35) warnings.push("suspicious_huge_diff");
  const allRegions = mergeChangedOffsets(changedOffsets, options.mergeDistance);
  const changedRegions = allRegions.slice(0, options.maxRegions);
  if (allRegions.length > changedRegions.length) warnings.push("changed_regions_truncated");
  return {
    file_size: ori.length === mod.length ? ori.length : null,
    changed_byte_count: changedOffsets.length,
    changed_percent: changedPercent,
    changed_region_count: allRegions.length,
    changed_regions: changedRegions,
    warnings,
  };
}

function qualityScore(pair, comparison) {
  let score = 0;
  const reasons = [];
  if (pair.confidence >= 70) {
    score += 25;
    reasons.push("high_pair_confidence");
  } else if (pair.confidence >= 45) {
    score += 12;
    reasons.push("usable_pair_confidence");
  }
  if (comparison.file_size !== null) {
    score += 20;
    reasons.push("same_size_compare");
  }
  if (comparison.changed_byte_count > 0 && comparison.changed_percent <= 35) {
    score += 25;
    reasons.push("changed_regions_present");
  }
  if (pair.ori.guessed_sw_number && pair.mod.guessed_sw_number && pair.ori.guessed_sw_number === pair.mod.guessed_sw_number) {
    score += 10;
    reasons.push("sw_number_match");
  }
  if (Array.isArray(pair.mod.guessed_service_labels) && pair.mod.guessed_service_labels.length) {
    score += 10;
    reasons.push("service_label_hint");
  }
  if (!comparison.warnings.includes("file_size_mismatch")) score += 5;
  if (!comparison.warnings.includes("suspicious_huge_diff")) score += 5;
  if (comparison.warnings.includes("identical_files")) score = Math.min(score, 20);
  if (comparison.warnings.includes("suspicious_huge_diff")) score = Math.min(score, 45);
  return { score: Math.max(0, Math.min(100, score)), reasons };
}

function patternSignature(pair, comparison) {
  return {
    version: 1,
    pair_confidence: pair.confidence,
    changed_byte_count: comparison.changed_byte_count,
    changed_percent: comparison.changed_percent,
    region_count: comparison.changed_region_count,
    buckets: comparison.changed_regions.slice(0, 24).map((region) => ({
      start_bucket: Math.floor(region.start_offset / 256) * 256,
      length_bucket: Math.ceil(region.length / 16) * 16,
      density: region.density,
    })),
  };
}

export async function analyzePairs(options) {
  if (!options.datasetRoot) throw new Error("DATASET_ROOT or --root is required.");
  if (!options.scan) throw new Error("--scan is required.");
  const root = resolve(options.datasetRoot);
  const rows = await readJsonl(resolve(options.scan));
  const pairs = createPairs(rows).slice(0, options.limit);
  await mkdir(dirname(resolve(options.out)), { recursive: true });
  const output = createWriteStream(resolve(options.out), { encoding: "utf8" });
  let analyzed = 0;
  for (const pair of pairs) {
    const oriPath = resolveInside(root, pair.ori.relative_path);
    const modPath = resolveInside(root, pair.mod.relative_path);
    const comparison = await compareFiles(oriPath, modPath, options);
    const quality = qualityScore(pair, comparison);
    const row = {
      pair_id: stableId("pair-analysis", `${pair.ori.sha256}:${pair.mod.sha256}`),
      ori_relative_path: pair.ori.relative_path,
      mod_relative_path: pair.mod.relative_path,
      ori_sha256: pair.ori.sha256,
      mod_sha256: pair.mod.sha256,
      file_size: comparison.file_size,
      changed_byte_count: comparison.changed_byte_count,
      changed_percent: comparison.changed_percent,
      changed_region_count: comparison.changed_region_count,
      changed_regions: comparison.changed_regions,
      guessed_service_labels: pair.mod.guessed_service_labels || [],
      guessed_ecu_family: pair.mod.guessed_ecu_family || pair.ori.guessed_ecu_family || null,
      guessed_ecu_type: pair.mod.guessed_ecu_type || pair.ori.guessed_ecu_type || null,
      guessed_sw_number: pair.mod.guessed_sw_number || pair.ori.guessed_sw_number || null,
      guessed_hw_number: pair.mod.guessed_hw_number || pair.ori.guessed_hw_number || null,
      quality_score: quality.score,
      quality_reasons: quality.reasons,
      confidence: pair.confidence,
      pairing_reasons: pair.reasons,
      warnings: [...new Set(comparison.warnings)],
      pattern_signature: patternSignature(pair, comparison),
      raw_bytes_included: false,
      hex_included: false,
      mod_generation: false,
    };
    output.write(`${JSON.stringify(row)}\n`);
    analyzed += 1;
  }
  await new Promise((resolvePromise, rejectPromise) => output.end((error) => error ? rejectPromise(error) : resolvePromise()));
  return { analyzed_pairs: analyzed, output: resolve(options.out) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  analyzePairs(parseArgs(process.argv.slice(2))).then((summary) => {
    console.log(JSON.stringify(summary, null, 2));
  }).catch((error) => {
    console.error(`[error] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
