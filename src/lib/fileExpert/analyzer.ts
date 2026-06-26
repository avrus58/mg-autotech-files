import { createHash } from "crypto";
import type {
  FileExpertActiveRegion,
  FileExpertAnalyzerResult,
  FileExpertChangedBlock,
  FileExpertFileInspection,
  FileExpertMapCandidate,
  FileExpertPossibleFeature,
  FileExpertRepeatedPattern,
  FileExpertRiskLevel,
} from "@/lib/fileExpert/types";

const ecuIdentifierPatterns = [
  "Bosch",
  "Siemens",
  "Continental",
  "Delphi",
  "Denso",
  "Marelli",
  "Delco",
  "EDC",
  "MED",
  "MEVD",
  "MD1",
  "MG1",
  "EDC15",
  "EDC16",
  "EDC17",
  "MED17",
  "MEVD17",
  "MS43",
  "MS45",
  "EGS",
  "ZF",
  "6HP",
  "8HP",
  "CRD",
  "SID",
  "PCR",
  "Simos",
  "E80",
  "E39",
  "E39A",
  "MEDC17",
  "TC179",
  "TC176",
  "TC275",
];

function hexOffset(offset: number) {
  return `0x${offset.toString(16).toUpperCase().padStart(6, "0")}`;
}

export function sha256Buffer(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function ratioOf(buffer: Buffer, byte: number) {
  if (buffer.length === 0) return 0;
  let count = 0;
  for (const value of buffer) {
    if (value === byte) count += 1;
  }
  return Number((count / buffer.length).toFixed(4));
}

function entropy(buffer: Buffer) {
  if (buffer.length === 0) return 0;
  const counts = new Array<number>(256).fill(0);
  for (const value of buffer) counts[value] += 1;
  let total = 0;
  for (const count of counts) {
    if (!count) continue;
    const probability = count / buffer.length;
    total -= probability * Math.log2(probability);
  }
  return Number(total.toFixed(3));
}

function extractAsciiStrings(buffer: Buffer, limit = 60) {
  const result: string[] = [];
  let current = "";

  for (const value of buffer) {
    if (value >= 32 && value <= 126) {
      current += String.fromCharCode(value);
      continue;
    }

    if (current.length >= 4) result.push(current);
    current = "";
    if (result.length >= limit) break;
  }

  if (current.length >= 4 && result.length < limit) result.push(current);

  return Array.from(new Set(result))
    .filter((item) => /[A-Za-z0-9]/.test(item))
    .slice(0, limit);
}

function detectIdentifiers(strings: string[]) {
  const joined = strings.join(" ").toLowerCase();
  return ecuIdentifierPatterns.filter((item) =>
    joined.includes(item.toLowerCase())
  );
}

function inspectFile(buffer: Buffer): FileExpertFileInspection {
  const asciiStrings = extractAsciiStrings(buffer);
  return {
    file_size: buffer.length,
    sha256: sha256Buffer(buffer),
    first_64_bytes_hex: buffer.subarray(0, 64).toString("hex"),
    last_64_bytes_hex: buffer.subarray(Math.max(0, buffer.length - 64)).toString("hex"),
    ff_ratio: ratioOf(buffer, 0xff),
    zero_ratio: ratioOf(buffer, 0x00),
    entropy: entropy(buffer),
    ascii_strings: asciiStrings,
    ecu_identifiers: detectIdentifiers(asciiStrings),
  };
}

function detectActiveRegions(buffer: Buffer, blockSize = 4096): FileExpertActiveRegion[] {
  const regions: FileExpertActiveRegion[] = [];
  let current: { start: number; end: number; densitySum: number; blocks: number } | null = null;

  for (let offset = 0; offset < buffer.length; offset += blockSize) {
    const block = buffer.subarray(offset, Math.min(offset + blockSize, buffer.length));
    let active = 0;
    for (const value of block) {
      if (value !== 0x00 && value !== 0xff) active += 1;
    }
    const density = block.length ? active / block.length : 0;
    const isActive = density > 0.18;

    if (isActive) {
      if (!current) current = { start: offset, end: offset + block.length, densitySum: density, blocks: 1 };
      else {
        current.end = offset + block.length;
        current.densitySum += density;
        current.blocks += 1;
      }
    } else if (current) {
      regions.push({
        start_offset_hex: hexOffset(current.start),
        end_offset_hex: hexOffset(current.end),
        density: Number((current.densitySum / current.blocks).toFixed(3)),
      });
      current = null;
    }
  }

  if (current) {
    regions.push({
      start_offset_hex: hexOffset(current.start),
      end_offset_hex: hexOffset(current.end),
      density: Number((current.densitySum / current.blocks).toFixed(3)),
    });
  }

  return regions.slice(0, 80);
}

function signed8(value: number) {
  return value > 127 ? value - 256 : value;
}

function uint16Preview(buffer: Buffer, endian: "be" | "le") {
  const values: number[] = [];
  for (let offset = 0; offset + 1 < Math.min(buffer.length, 16); offset += 2) {
    values.push(endian === "be" ? buffer.readUInt16BE(offset) : buffer.readUInt16LE(offset));
  }
  return values;
}

function buildChangedBlock(ori: Buffer, mod: Buffer, start: number, end: number): FileExpertChangedBlock {
  const oriSlice = ori.subarray(start, Math.min(end, start + 24));
  const modSlice = mod.subarray(start, Math.min(end, start + 24));
  let changed = 0;
  const deltas: number[] = [];
  for (let index = start; index < end; index += 1) {
    if (ori[index] !== mod[index]) {
      changed += 1;
      if (deltas.length < 12) deltas.push(mod[index] - ori[index]);
    }
  }

  return {
    start_offset_hex: hexOffset(start),
    end_offset_hex: hexOffset(end),
    length: end - start,
    changed_byte_count: changed,
    ori_hex_preview: oriSlice.toString("hex"),
    mod_hex_preview: modSlice.toString("hex"),
    unsigned_8bit_preview: Array.from(modSlice.subarray(0, 12)),
    signed_8bit_preview: Array.from(modSlice.subarray(0, 12)).map(signed8),
    uint16_be_preview: uint16Preview(modSlice, "be"),
    uint16_le_preview: uint16Preview(modSlice, "le"),
    delta_preview: deltas,
  };
}

function compareFiles(ori: Buffer, mod: Buffer) {
  const comparableLength = Math.min(ori.length, mod.length);
  const rawRanges: Array<{ start: number; end: number }> = [];
  let changedBytes = Math.abs(ori.length - mod.length);
  let currentStart: number | null = null;

  for (let index = 0; index < comparableLength; index += 1) {
    if (ori[index] !== mod[index]) {
      changedBytes += 1;
      if (currentStart === null) currentStart = index;
    } else if (currentStart !== null) {
      rawRanges.push({ start: currentStart, end: index });
      currentStart = null;
    }
  }

  if (currentStart !== null) rawRanges.push({ start: currentStart, end: comparableLength });

  const mergedRanges: Array<{ start: number; end: number }> = [];
  for (const range of rawRanges) {
    const previous = mergedRanges[mergedRanges.length - 1];
    if (previous && range.start - previous.end <= 32) previous.end = range.end;
    else mergedRanges.push({ ...range });
  }

  return {
    same_size: ori.length === mod.length,
    changed_bytes: changedBytes,
    changed_percent: Number(((changedBytes / Math.max(ori.length, mod.length, 1)) * 100).toFixed(5)),
    raw_changed_blocks: rawRanges.length,
    merged_changed_blocks: mergedRanges.length,
    changed_blocks: mergedRanges
      .slice(0, 120)
      .map((range) => buildChangedBlock(ori, mod, range.start, range.end)),
  };
}

function detectMapCandidates(blocks: FileExpertChangedBlock[]): FileExpertMapCandidate[] {
  return blocks
    .filter((block) => block.length >= 16 && block.changed_byte_count >= 8)
    .slice(0, 40)
    .map((block) => {
      const repeatedDelta = block.delta_preview.length
        ? Math.max(...Object.values(block.delta_preview.reduce<Record<string, number>>((acc, delta) => {
            acc[String(delta)] = (acc[String(delta)] ?? 0) + 1;
            return acc;
          }, {})))
        : 0;
      const confidence = Math.min(0.85, 0.38 + block.length / 600 + repeatedDelta / 25);
      return {
        offset_hex: block.start_offset_hex,
        length: block.length,
        possible_type: "map_candidate",
        reason: "Structured changed region with repeated numeric deltas.",
        confidence: Number(confidence.toFixed(2)),
      };
    });
}

function detectRepeatedPatterns(blocks: FileExpertChangedBlock[]): FileExpertRepeatedPattern[] {
  const groups = new Map<string, string[]>();
  blocks.forEach((block) => {
    const signature = `${Math.min(block.length, 128)}:${block.delta_preview.slice(0, 4).join(",")}`;
    groups.set(signature, [...(groups.get(signature) ?? []), block.start_offset_hex]);
  });

  return Array.from(groups.entries())
    .filter(([, offsets]) => offsets.length >= 2)
    .slice(0, 30)
    .map(([signature, offsets]) => ({
      signature,
      count: offsets.length,
      offsets,
      reason: "Similar changed block length and delta signature repeated.",
    }));
}

function featureHeuristics(options: {
  mode: "single_file" | "ori_mod_compare";
  changedPercent: number;
  changedBlocks: number;
  mapCandidates: number;
  identifiers: string[];
}) {
  const features: FileExpertPossibleFeature[] = [];
  const reasons: string[] = [];
  const warnings = [
    "Checksum must be verified before writing.",
    "Human tuner confirmation is required before any flashing decision.",
  ];

  if (options.mode === "single_file") {
    return {
      features,
      riskLevel: "unknown" as const,
      confidence: 0.42,
      reasons: ["Single file analysis can identify file structure but cannot confirm modifications."],
      warnings,
      stock: "unknown" as const,
      conclusion: "A single file was inspected. No ORI/MOD comparison was available, so exact feature detection is not claimed.",
    };
  }

  const isTcu = options.identifiers.some((id) => ["EGS", "ZF", "6HP", "8HP"].includes(id));

  if (options.changedPercent > 0.005 && options.mapCandidates >= 5) {
    features.push({
      feature: "stage1",
      confidence: Math.min(0.88, 0.58 + options.mapCandidates / 60),
      reasons: ["Multiple structured calibration-like regions changed."],
    });
  }

  if (options.changedPercent > 0.08 && options.mapCandidates >= 12) {
    features.push({
      feature: "stage2",
      confidence: 0.55,
      reasons: ["Higher modification density with many map-like changes."],
    });
  }

  if (options.changedBlocks > 60 && options.changedPercent < 0.2) {
    features.push({
      feature: "dtc_off",
      confidence: 0.45,
      reasons: ["Many small changed blocks can match diagnostic table edits."],
    });
  }

  if (options.changedBlocks <= 12 && options.changedPercent < 0.03) {
    features.push({
      feature: "vmax_off",
      confidence: 0.38,
      reasons: ["Limited isolated changes can match limiter or flag edits."],
    });
  }

  if (isTcu && options.mapCandidates >= 3) {
    features.push({
      feature: "tcu_tune",
      confidence: 0.58,
      reasons: ["TCU-related identifiers and repeated map-like changes detected."],
    });
  }

  if (features.length === 0 && options.changedPercent > 0) {
    features.push({
      feature: "stock_or_modified",
      confidence: 0.68,
      reasons: ["ORI and MOD files differ, but the feature pattern is not specific enough."],
    });
  }

  const riskLevel: FileExpertRiskLevel =
    options.changedPercent > 0.5 ? "high" : options.changedPercent > 0.04 ? "medium" : "unknown";
  reasons.push(`${options.changedPercent}% of bytes changed across ${options.changedBlocks} merged regions.`);

  return {
    features,
    riskLevel,
    confidence: Math.min(0.88, 0.45 + features.length * 0.08 + options.mapCandidates / 100),
    reasons,
    warnings,
    stock: options.changedPercent > 0 ? ("likely_modified" as const) : ("likely_stock" as const),
    conclusion:
      options.changedPercent > 0
        ? "The MOD file differs from the ORI in structured file regions. Feature labels are heuristic and require human confirmation."
        : "No binary difference was detected between the uploaded files.",
  };
}

export async function analyzeFileExpertBuffers(input: {
  jobId: string;
  ori?: Buffer;
  mod?: Buffer;
  single?: Buffer;
}) {
  const mode = input.ori && input.mod ? "ori_mod_compare" : "single_file";
  const files: FileExpertAnalyzerResult["files"] = {};
  if (input.ori) files.ori = inspectFile(input.ori);
  if (input.mod) files.mod = inspectFile(input.mod);
  if (!input.ori && !input.mod && input.single) files.single = inspectFile(input.single);

  const baseBuffer = input.mod ?? input.ori ?? input.single ?? Buffer.alloc(0);
  const activeRegions = detectActiveRegions(baseBuffer);
  const comparison = input.ori && input.mod ? compareFiles(input.ori, input.mod) : undefined;
  const mapCandidates = comparison ? detectMapCandidates(comparison.changed_blocks) : [];
  const repeatedPatterns = comparison ? detectRepeatedPatterns(comparison.changed_blocks) : [];
  const identifiers = [
    ...(files.ori?.ecu_identifiers ?? []),
    ...(files.mod?.ecu_identifiers ?? []),
    ...(files.single?.ecu_identifiers ?? []),
  ];
  const heuristics = featureHeuristics({
    mode,
    changedPercent: comparison?.changed_percent ?? 0,
    changedBlocks: comparison?.merged_changed_blocks ?? 0,
    mapCandidates: mapCandidates.length,
    identifiers,
  });

  return {
    job_id: input.jobId,
    analysis_version: "1.0.0",
    mode,
    files,
    comparison,
    active_regions: activeRegions,
    map_candidates: mapCandidates,
    repeated_patterns: repeatedPatterns,
    possible_features: heuristics.features,
    risk_assessment: {
      risk_level: heuristics.riskLevel,
      confidence: Number(heuristics.confidence.toFixed(2)),
      reasons: heuristics.reasons,
      warnings: heuristics.warnings,
    },
    summary: {
      stock_or_modified: heuristics.stock,
      main_conclusion: heuristics.conclusion,
      recommended_next_steps: [
        "Review detected regions in professional calibration software.",
        "Verify checksum before writing.",
        "Confirm results with logs and experienced tuner review.",
      ],
    },
  } satisfies FileExpertAnalyzerResult;
}

export function buildPatternSignature(result: FileExpertAnalyzerResult) {
  return {
    analysis_version: result.analysis_version,
    mode: result.mode,
    changed_percent: result.comparison?.changed_percent ?? null,
    merged_changed_blocks: result.comparison?.merged_changed_blocks ?? null,
    map_candidates: result.map_candidates.slice(0, 12),
    repeated_patterns: result.repeated_patterns.slice(0, 12),
    feature_candidates: result.possible_features,
  };
}
