#!/usr/bin/env node
import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

function parseArgs(argv) {
  const args = {
    scan: "",
    analysis: "",
    out: "data/ai-dataset-evaluation-report.json",
    md: "data/ai-dataset-evaluation-report.md",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--scan") args.scan = argv[++index] || "";
    else if (value === "--analysis") args.analysis = argv[++index] || "";
    else if (value === "--out") args.out = argv[++index] || args.out;
    else if (value === "--md") args.md = argv[++index] || args.md;
  }
  return args;
}

async function readJsonl(path, optional = false) {
  if (!path) return [];
  const rows = [];
  try {
    const reader = createInterface({
      input: createReadStream(resolve(path), { encoding: "utf8" }),
      crlfDelay: Number.POSITIVE_INFINITY,
    });
    for await (const line of reader) {
      const trimmed = line.trim();
      if (trimmed) rows.push(JSON.parse(trimmed));
    }
  } catch (error) {
    if (!optional) throw error;
  }
  return rows;
}

function distribution(rows, getter) {
  const output = {};
  for (const row of rows) {
    const values = getter(row);
    for (const value of Array.isArray(values) ? values : [values]) {
      if (!value) continue;
      output[value] = (output[value] || 0) + 1;
    }
  }
  return output;
}

function topEntries(record, limit = 10) {
  return Object.entries(record)
    .sort((left, right) => Number(right[1]) - Number(left[1]))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function bandForAnalysis(row) {
  if (row.warnings?.includes("identical_files")) return "duplicate";
  if (row.warnings?.some((warning) => /suspicious|mismatch/i.test(warning))) return "suspicious";
  if (row.quality_score >= 75) return "high_quality_learning_candidate";
  if (row.quality_score >= 50) return "medium_needs_review";
  if (row.quality_score > 0) return "low_quality_reject_or_exclude";
  return "unknown";
}

function recommendedNextAction(report) {
  if (report.analyzed_pair_count === 0) return "Run safe pair analysis on a small fixture or limited dataset chunk before importing metadata.";
  if (report.high_quality_pair_count === 0) return "Review pairing rules and metadata quality; no high-quality learning candidates were found.";
  if (report.stage1_usable_candidate_count === 0) return "Add or label Stage 1 ORI/MOD examples with human-confirmed actual_service_labels.";
  if (report.suspicious_pair_count > 0) return "Review suspicious pair candidates before any learning approval.";
  return "Human-review high-quality pairs, confirm actual_service_labels, then create pending training candidates.";
}

function markdown(report) {
  const lines = [
    "# AI Dataset Evaluation Report",
    "",
    "This report is metadata-only and admin-only. It does not contain raw bytes, hex dumps or generated MOD files.",
    "",
    "## Summary",
    "",
    `- Total scanned files: ${report.total_scanned_files}`,
    `- Total scanned size: ${report.total_scanned_size_bytes} bytes (${report.total_scanned_size_gb} GB)`,
    `- Pair candidates: ${report.pair_candidate_count}`,
    `- Analyzed pairs: ${report.analyzed_pair_count}`,
    `- High quality pairs: ${report.high_quality_pair_count}`,
    `- Medium needs review: ${report.medium_quality_pair_count}`,
    `- Low quality/reject: ${report.low_quality_pair_count}`,
    `- Suspicious pairs: ${report.suspicious_pair_count}`,
    `- Stage 1 usable candidates: ${report.stage1_usable_candidate_count}`,
    `- Aftertreatment candidates: ${report.aftertreatment_candidate_count}`,
    "",
    "## Top ECU Families",
    "",
    ...report.top_ecu_families_by_usable_data.map((entry) => `- ${entry.key}: ${entry.count}`),
    "",
    "## Top SW Numbers",
    "",
    ...report.top_sw_numbers_by_usable_data.map((entry) => `- ${entry.key}: ${entry.count}`),
    "",
    "## Biggest Quality Problems",
    "",
    ...report.biggest_quality_problems.map((entry) => `- ${entry.key}: ${entry.count}`),
    "",
    "## Recommended Next Action",
    "",
    report.recommended_next_action,
    "",
    "## Safety",
    "",
    "- No raw binary is included.",
    "- No hex previews are included.",
    "- No MOD generation is performed.",
    "- Human review is required before learning approval.",
  ];
  return `${lines.join("\n")}\n`;
}

export async function evaluateDataset(options) {
  if (!options.scan) throw new Error("--scan is required.");
  const scanRows = await readJsonl(options.scan);
  const analysisRows = await readJsonl(options.analysis, true);
  const totalSize = scanRows.reduce((sum, row) => sum + Number(row.file_size || 0), 0);
  const bands = distribution(analysisRows, bandForAnalysis);
  const serviceDistribution = distribution(scanRows, (row) => row.guessed_service_labels || []);
  const ecuDistribution = distribution(scanRows, (row) => row.guessed_ecu_type || row.guessed_ecu_family || null);
  const swDistribution = distribution(analysisRows, (row) => row.guessed_sw_number || null);
  const qualityProblems = distribution(analysisRows, (row) => row.warnings || []);
  const pairCandidateCount = scanRows.filter((row) => row.guessed_file_role === "ori").length *
    scanRows.filter((row) => row.guessed_file_role === "mod").length;
  const stage1Usable = analysisRows.filter((row) =>
    row.guessed_service_labels?.includes("stage1") &&
    row.quality_score >= 60 &&
    !row.warnings?.some((warning) => /identical|huge|mismatch/i.test(warning))
  ).length;
  const aftertreatment = analysisRows.filter((row) =>
    row.guessed_service_labels?.some((label) => ["adblue_off", "egr_off", "dpf_off", "dtc_off"].includes(label))
  ).length;
  const report = {
    generated_at: new Date().toISOString(),
    total_scanned_files: scanRows.length,
    total_scanned_size_bytes: totalSize,
    total_scanned_size_gb: Number((totalSize / 1024 / 1024 / 1024).toFixed(3)),
    service_category_distribution: serviceDistribution,
    ecu_family_type_distribution: ecuDistribution,
    role_distribution: distribution(scanRows, (row) => row.guessed_file_role || "unknown"),
    duplicate_statistics: {
      duplicate_file_count: scanRows.filter((row) => row.duplicate_hash_group).length,
      duplicate_group_count: new Set(scanRows.map((row) => row.duplicate_hash_group).filter(Boolean)).size,
    },
    archive_statistics: {
      archive_candidate_count: scanRows.filter((row) => row.archive_candidate).length,
    },
    pair_candidate_count: pairCandidateCount,
    analyzed_pair_count: analysisRows.length,
    high_quality_pair_count: bands.high_quality_learning_candidate || 0,
    medium_quality_pair_count: bands.medium_needs_review || 0,
    low_quality_pair_count: bands.low_quality_reject_or_exclude || 0,
    suspicious_pair_count: bands.suspicious || 0,
    quality_band_distribution: bands,
    stage1_usable_candidate_count: stage1Usable,
    aftertreatment_candidate_count: aftertreatment,
    top_ecu_families_by_usable_data: topEntries(ecuDistribution),
    top_sw_numbers_by_usable_data: topEntries(swDistribution),
    biggest_quality_problems: topEntries(qualityProblems),
    recommended_next_action: "",
    raw_binary_included: false,
    hex_included: false,
    mod_generation: false,
  };
  report.recommended_next_action = recommendedNextAction(report);
  await mkdir(dirname(resolve(options.out)), { recursive: true });
  await writeFile(resolve(options.out), JSON.stringify(report, null, 2));
  await writeFile(resolve(options.md), markdown(report));
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  evaluateDataset(parseArgs(process.argv.slice(2))).then((report) => {
    console.log(JSON.stringify({
      total_scanned_files: report.total_scanned_files,
      analyzed_pair_count: report.analyzed_pair_count,
      high_quality_pair_count: report.high_quality_pair_count,
      recommended_next_action: report.recommended_next_action,
    }, null, 2));
  }).catch((error) => {
    console.error(`[error] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
