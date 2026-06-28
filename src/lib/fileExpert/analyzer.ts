import { createHash } from "crypto";
import type {
  FileExpertActiveRegion,
  FileExpertAnalyzerResult,
  FileExpertChangeProfile,
  FileExpertChangedBlock,
  FileExpertEcuIdentification,
  FileExpertFileInspection,
  FileExpertFinding,
  FileExpertIntegrityAssessment,
  FileExpertMapCandidate,
  FileExpertModuleType,
  FileExpertPossibleFeature,
  FileExpertRepeatedPattern,
  FileExpertRiskLevel,
} from "@/lib/fileExpert/types";
import {
  extractTechnicalStrings,
  identifyFileBuffer,
  mergeEcuIdentifications,
} from "@/lib/fileExpert/identification";

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

function inspectFile(
  buffer: Buffer,
  context: {
    fileName?: string | null;
    submittedEcuType?: string | null;
    submittedReadMethod?: string | null;
  }
) {
  const asciiStrings = extractTechnicalStrings(buffer);
  const fileEntropy = entropy(buffer);
  const ffRatio = ratioOf(buffer, 0xff);
  const zeroRatio = ratioOf(buffer, 0x00);
  const identity = identifyFileBuffer({
    buffer,
    strings: asciiStrings,
    entropy: fileEntropy,
    ffRatio,
    zeroRatio,
    context,
  });
  const inspection: FileExpertFileInspection = {
    file_size: buffer.length,
    sha256: sha256Buffer(buffer),
    first_64_bytes_hex: buffer.subarray(0, 64).toString("hex"),
    last_64_bytes_hex: buffer.subarray(Math.max(0, buffer.length - 64)).toString("hex"),
    ff_ratio: ffRatio,
    zero_ratio: zeroRatio,
    entropy: fileEntropy,
    ascii_strings: asciiStrings,
    ecu_identifiers: [
      identity.identification.supplier,
      identity.identification.family,
      identity.identification.variant,
    ].filter(Boolean) as string[],
    file_format: identity.fileFormat,
    read_scope: identity.readScope,
    read_scope_confidence: identity.readScopeConfidence,
    hardware_numbers: identity.hardwareNumbers,
    software_numbers: identity.softwareNumbers,
    calibration_ids: identity.calibrationIds,
    vins: identity.vins,
    engine_codes: identity.engineCodes,
  };

  return { inspection, identification: identity.identification };
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

function buildChangeProfile(
  mode: "single_file" | "ori_mod_compare",
  comparison: ReturnType<typeof compareFiles> | undefined,
  mapCandidateCount: number
): FileExpertChangeProfile {
  if (mode === "single_file" || !comparison) {
    return {
      classification: "single_file",
      label: "Single-file inspection",
      summary: "Only one file was supplied, so modifications cannot be confirmed without a matching original file.",
      confidence: 1,
      affected_area_percent: 0,
      changed_regions: 0,
    };
  }

  if (!comparison.same_size) {
    return {
      classification: "structural_mismatch",
      label: "File structure mismatch",
      summary: "ORI and MOD sizes differ. This can indicate different read scopes, a container mismatch or an incompatible file pair.",
      confidence: 0.96,
      affected_area_percent: comparison.changed_percent,
      changed_regions: comparison.merged_changed_blocks,
    };
  }

  if (comparison.changed_bytes === 0) {
    return {
      classification: "identical",
      label: "Files are identical",
      summary: "No binary difference was found between the uploaded ORI and MOD files.",
      confidence: 1,
      affected_area_percent: 0,
      changed_regions: 0,
    };
  }

  if (comparison.changed_percent <= 0.2 && comparison.merged_changed_blocks <= 80) {
    return {
      classification: "focused_calibration",
      label: "Focused calibration changes",
      summary: mapCandidateCount
        ? "Changes are concentrated in a limited set of structured, calibration-like regions."
        : "Changes are concentrated in a limited part of the file, but map purpose cannot be named safely.",
      confidence: mapCandidateCount >= 3 ? 0.82 : 0.66,
      affected_area_percent: comparison.changed_percent,
      changed_regions: comparison.merged_changed_blocks,
    };
  }

  if (comparison.changed_percent <= 2.5) {
    return {
      classification: "distributed_calibration",
      label: "Distributed calibration changes",
      summary: "Multiple areas of the calibration appear to have been changed. The exact functions require map definitions or tuner review.",
      confidence: 0.75,
      affected_area_percent: comparison.changed_percent,
      changed_regions: comparison.merged_changed_blocks,
    };
  }

  return {
    classification: "broad_rework",
    label: "Broad file changes",
    summary: "A large part of the file differs. Confirm that both files belong to the same software version and were read with the same method.",
    confidence: 0.86,
    affected_area_percent: comparison.changed_percent,
    changed_regions: comparison.merged_changed_blocks,
  };
}

function sameDetectedIdentity(
  ori: FileExpertEcuIdentification | undefined,
  mod: FileExpertEcuIdentification | undefined
) {
  const left = ori?.variant || ori?.family;
  const right = mod?.variant || mod?.family;
  if (!left || !right) return null;
  return left.toUpperCase() === right.toUpperCase();
}

function sameVin(ori?: FileExpertFileInspection, mod?: FileExpertFileInspection) {
  if (!ori?.vins?.length || !mod?.vins?.length) return null;
  return ori.vins.some((vin) => mod.vins?.includes(vin));
}

function buildIntegrityAssessment(input: {
  mode: "single_file" | "ori_mod_compare";
  comparison?: ReturnType<typeof compareFiles>;
  ori?: FileExpertFileInspection;
  mod?: FileExpertFileInspection;
  oriIdentity?: FileExpertEcuIdentification;
  modIdentity?: FileExpertEcuIdentification;
}) {
  const identityMatch = sameDetectedIdentity(input.oriIdentity, input.modIdentity);
  const vinMatch = sameVin(input.ori, input.mod);
  const issues: string[] = [];

  if (input.comparison && !input.comparison.same_size) {
    issues.push("ORI and MOD file sizes differ.");
  }
  if (identityMatch === false) {
    issues.push("ORI and MOD contain different ECU family signatures.");
  }
  if (vinMatch === false) {
    issues.push("ORI and MOD contain different VIN identifiers.");
  }
  if ((input.ori?.entropy ?? 0) > 7.9 || (input.mod?.entropy ?? 0) > 7.9) {
    issues.push("High entropy may indicate an encrypted or compressed container.");
  }

  return {
    file_size_match: input.comparison ? input.comparison.same_size : null,
    ecu_identity_match: identityMatch,
    vin_match: vinMatch,
    checksum_status: "not_checked",
    issues,
  } satisfies FileExpertIntegrityAssessment;
}

function buildFindings(input: {
  identification: FileExpertEcuIdentification;
  changeProfile: FileExpertChangeProfile;
  integrity: FileExpertIntegrityAssessment;
  comparison?: ReturnType<typeof compareFiles>;
  primaryFile?: FileExpertFileInspection;
  mapCandidateCount: number;
}) {
  const findings: FileExpertFinding[] = [];

  findings.push({
    id: "ecu-identification",
    category: "identity",
    severity: input.identification.status === "not_detected" ? "warning" : "positive",
    title: input.identification.status === "not_detected" ? "Control unit not identified" : input.identification.display_name,
    summary: input.identification.status === "not_detected"
      ? "No reliable ECU or TCU signature was found in the binary or file name. HW/SW identification may be required from the read tool."
      : `${input.identification.module_type} identity is ${input.identification.status}.`,
    confidence: input.identification.confidence,
    evidence: input.identification.evidence.slice(0, 4),
  });

  findings.push({
    id: "file-profile",
    category: "file",
    severity: "info",
    title: input.primaryFile?.read_scope === "full_read" ? "Likely full read" : "File structure classified",
    summary: `Format: ${(input.primaryFile?.file_format || "unknown").replaceAll("_", " ")}. Read scope: ${(input.primaryFile?.read_scope || "unknown").replaceAll("_", " ")}.`,
    confidence: input.primaryFile?.read_scope_confidence ?? 0.4,
    evidence: input.primaryFile ? [`File size ${input.primaryFile.file_size.toLocaleString()} bytes`, `Entropy ${input.primaryFile.entropy}`] : [],
  });

  findings.push({
    id: "change-profile",
    category: "comparison",
    severity: input.changeProfile.classification === "structural_mismatch" || input.changeProfile.classification === "broad_rework" ? "warning" : "info",
    title: input.changeProfile.label,
    summary: input.changeProfile.summary,
    confidence: input.changeProfile.confidence,
    evidence: input.comparison
      ? [`${input.comparison.changed_bytes.toLocaleString()} changed bytes`, `${input.comparison.merged_changed_blocks} changed regions`, `${input.comparison.changed_percent}% of file affected`]
      : ["No ORI/MOD pair was available."],
  });

  if (input.mapCandidateCount > 0) {
    findings.push({
      id: "calibration-regions",
      category: "calibration",
      severity: "info",
      title: "Calibration-like regions detected",
      summary: `${input.mapCandidateCount} structured change regions resemble numeric calibration data. Exact map names cannot be confirmed without ECU-specific definitions.`,
      confidence: Math.min(0.84, 0.52 + input.mapCandidateCount / 80),
      evidence: ["Repeated numeric deltas", "Structured changed blocks"],
    });
  }

  if (input.integrity.issues.length) {
    findings.push({
      id: "integrity-warning",
      category: "integrity",
      severity: "critical",
      title: "Compatibility check required",
      summary: input.integrity.issues.join(" "),
      confidence: 0.92,
      evidence: input.integrity.issues,
    });
  } else {
    findings.push({
      id: "integrity-status",
      category: "integrity",
      severity: "positive",
      title: "No structural conflict detected",
      summary: "The automated size and identity checks did not find an obvious ORI/MOD compatibility conflict. Checksum is still not verified.",
      confidence: 0.78,
      evidence: ["File-pair structure checked", "Checksum status: not checked"],
    });
  }

  return findings;
}

function featureHeuristics(options: {
  mode: "single_file" | "ori_mod_compare";
  changedPercent: number;
  changedBlocks: number;
  mapCandidates: number;
  moduleType: FileExpertModuleType;
  sameSize: boolean;
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

  if (!options.sameSize) {
    return {
      features,
      riskLevel: "high" as const,
      confidence: 0.94,
      reasons: ["ORI and MOD file sizes differ, so feature classification was stopped."],
      warnings,
      stock: "unknown" as const,
      conclusion: "The uploaded files do not have the same size. Confirm software version and read method before interpreting modifications.",
    };
  }

  if (options.changedPercent > 0.002 && options.changedPercent <= 2.5 && options.mapCandidates >= 3) {
    features.push({
      feature: "stage1",
      confidence: Math.min(0.76, 0.48 + options.mapCandidates / 80),
      reasons: ["Multiple structured calibration-like regions changed; exact tuning level is not confirmed."],
    });
  }

  if (options.changedBlocks > 60 && options.changedPercent < 0.2) {
    features.push({
      feature: "dtc_off",
      confidence: 0.38,
      reasons: ["Many small isolated edits can resemble diagnostic-table changes; this is low-confidence."],
    });
  }

  if (options.moduleType === "TCU" && options.mapCandidates >= 3) {
    features.push({
      feature: "tcu_tune",
      confidence: 0.66,
      reasons: ["A TCU signature and repeated calibration-like changes were detected."],
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
    options.changedPercent > 2.5 ? "high" : options.changedPercent > 0 ? "medium" : "low";
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
  fileNames?: {
    ori?: string | null;
    mod?: string | null;
    single?: string | null;
  };
  metadata?: {
    ecuType?: string | null;
    readMethod?: string | null;
  };
}): Promise<FileExpertAnalyzerResult> {
  const mode = input.ori && input.mod ? "ori_mod_compare" : "single_file";
  const files: FileExpertAnalyzerResult["files"] = {};
  const identifications: FileExpertEcuIdentification[] = [];
  let oriIdentification: FileExpertEcuIdentification | undefined;
  let modIdentification: FileExpertEcuIdentification | undefined;

  if (input.ori) {
    const inspected = inspectFile(input.ori, {
      fileName: input.fileNames?.ori,
      submittedEcuType: input.metadata?.ecuType,
      submittedReadMethod: input.metadata?.readMethod,
    });
    files.ori = inspected.inspection;
    oriIdentification = inspected.identification;
    identifications.push(inspected.identification);
  }
  if (input.mod) {
    const inspected = inspectFile(input.mod, {
      fileName: input.fileNames?.mod,
      submittedEcuType: input.metadata?.ecuType,
      submittedReadMethod: input.metadata?.readMethod,
    });
    files.mod = inspected.inspection;
    modIdentification = inspected.identification;
    identifications.push(inspected.identification);
  }
  if (!input.ori && !input.mod && input.single) {
    const inspected = inspectFile(input.single, {
      fileName: input.fileNames?.single,
      submittedEcuType: input.metadata?.ecuType,
      submittedReadMethod: input.metadata?.readMethod,
    });
    files.single = inspected.inspection;
    identifications.push(inspected.identification);
  }

  const baseBuffer = input.mod ?? input.ori ?? input.single ?? Buffer.alloc(0);
  const activeRegions = detectActiveRegions(baseBuffer);
  const comparison = input.ori && input.mod ? compareFiles(input.ori, input.mod) : undefined;
  const mapCandidates = comparison ? detectMapCandidates(comparison.changed_blocks) : [];
  const repeatedPatterns = comparison ? detectRepeatedPatterns(comparison.changed_blocks) : [];
  const ecuIdentification = mergeEcuIdentifications(identifications);
  const changeProfile = buildChangeProfile(mode, comparison, mapCandidates.length);
  const integrityAssessment = buildIntegrityAssessment({
    mode,
    comparison,
    ori: files.ori,
    mod: files.mod,
    oriIdentity: oriIdentification,
    modIdentity: modIdentification,
  });
  const primaryFile = files.mod ?? files.ori ?? files.single;
  const heuristics = featureHeuristics({
    mode,
    changedPercent: comparison?.changed_percent ?? 0,
    changedBlocks: comparison?.merged_changed_blocks ?? 0,
    mapCandidates: mapCandidates.length,
    moduleType: ecuIdentification?.module_type ?? "unknown",
    sameSize: comparison?.same_size ?? true,
  });
  const findings = ecuIdentification
    ? buildFindings({
        identification: ecuIdentification,
        changeProfile,
        integrity: integrityAssessment,
        comparison,
        primaryFile,
        mapCandidateCount: mapCandidates.length,
      })
    : [];
  const analysisConfidence = mode === "single_file"
    ? Math.max(0.35, ecuIdentification?.confidence ?? 0.35)
    : Math.max(heuristics.confidence, (ecuIdentification?.confidence ?? 0) * 0.9);
  const riskLevel: FileExpertRiskLevel = integrityAssessment.issues.length
    ? "high"
    : heuristics.riskLevel;
  const riskReasons = [
    ...heuristics.reasons,
    ...integrityAssessment.issues,
  ];
  const conclusion = mode === "single_file" && ecuIdentification?.status !== "not_detected"
    ? `${ecuIdentification.display_name} was identified with ${ecuIdentification.status} confidence. Modification status cannot be confirmed from a single file.`
    : heuristics.conclusion;

  return {
    job_id: input.jobId,
    analysis_version: "2.0.0",
    mode,
    files,
    comparison,
    active_regions: activeRegions,
    map_candidates: mapCandidates,
    repeated_patterns: repeatedPatterns,
    possible_features: heuristics.features,
    ecu_identification: ecuIdentification,
    change_profile: changeProfile,
    findings,
    integrity_assessment: integrityAssessment,
    risk_assessment: {
      risk_level: riskLevel,
      confidence: Number(analysisConfidence.toFixed(2)),
      reasons: riskReasons,
      warnings: heuristics.warnings,
    },
    summary: {
      stock_or_modified: heuristics.stock,
      main_conclusion: conclusion,
      recommended_next_steps: [
        ecuIdentification?.status === "not_detected"
          ? "Obtain the ECU HW/SW identification from the read tool."
          : "Confirm the detected HW/SW identifiers against the read tool.",
        mode === "single_file"
          ? "Upload a matching original file to confirm modifications."
          : "Review calibration-like regions in professional calibration software.",
        "Verify checksum before writing.",
        "Complete an experienced tuner review before writing.",
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
    ecu_identification: result.ecu_identification ?? null,
    change_profile: result.change_profile ?? null,
  };
}
