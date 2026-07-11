export type Stage1ReadinessLevel = "no_evidence" | "weak" | "usable" | "strong";

export type Stage1EvidenceInput = {
  ecu_family?: string | null;
  ecu_type?: string | null;
  sw_number?: string | null;
  service_labels?: string[] | null;
  quality_score?: number | null;
  confidence?: number | null;
  warnings?: string[] | null;
  actual_service_labels_confirmed?: boolean | null;
  map_definitions_available?: boolean | null;
};

export type Stage1GroupReadiness = {
  group_key: string;
  ecu_family: string | null;
  ecu_type: string | null;
  sw_number: string | null;
  stage1_evidence_count: number;
  high_quality_stage1_pair_count: number;
  readiness: Stage1ReadinessLevel;
  confidence: number;
  missing_items: string[];
  next_recommended_action: string;
};

function groupKey(input: Stage1EvidenceInput) {
  return [
    input.ecu_family || "unknown_family",
    input.ecu_type || "unknown_ecu",
    input.sw_number || "unknown_sw",
  ].join(" / ");
}

function readinessFor(count: number, highQuality: number, confidence: number): Stage1ReadinessLevel {
  if (count === 0) return "no_evidence";
  if (highQuality >= 10 && confidence >= 75) return "strong";
  if (highQuality >= 3 && confidence >= 55) return "usable";
  return "weak";
}

function nextAction(readiness: Stage1ReadinessLevel, missing: string[]) {
  if (readiness === "no_evidence") return "Collect Stage 1 ORI/MOD pairs for this ECU/SW before making any calibration assumptions.";
  if (missing.includes("human labels")) return "Human-confirm actual_service_labels for the best Stage 1 pairs.";
  if (missing.includes("map definitions")) return "Add or verify map definitions before any future draft change planning.";
  if (missing.includes("quality review")) return "Review low-quality or suspicious pairs and exclude weak evidence.";
  if (readiness === "strong") return "Use as a priority candidate for Level 3 map attribution and benchmark evaluation.";
  return "Add more high-quality, human-reviewed Stage 1 evidence.";
}

export function evaluateStage1Readiness(inputs: Stage1EvidenceInput[]): Stage1GroupReadiness[] {
  const stage1Rows = inputs.filter((input) => input.service_labels?.includes("stage1"));
  const groups = new Map<string, Stage1EvidenceInput[]>();
  for (const row of stage1Rows) {
    const key = groupKey(row);
    groups.set(key, [...(groups.get(key) || []), row]);
  }

  const output: Stage1GroupReadiness[] = [];
  for (const [key, rows] of groups.entries()) {
    const highQuality = rows.filter((row) =>
      Number(row.quality_score || 0) >= 70 &&
      Number(row.confidence || 0) >= 60 &&
      !row.warnings?.some((warning) => /identical|huge|mismatch|suspicious/i.test(warning))
    ).length;
    const averageQuality = rows.reduce((sum, row) => sum + Number(row.quality_score || 0), 0) / Math.max(1, rows.length);
    const averageConfidence = rows.reduce((sum, row) => sum + Number(row.confidence || 0), 0) / Math.max(1, rows.length);
    const missing = new Set<string>();
    if (rows.length < 5) missing.add("more ORI/MOD pairs");
    if (!rows.some((row) => row.actual_service_labels_confirmed)) missing.add("human labels");
    if (!rows.some((row) => row.map_definitions_available)) missing.add("map definitions");
    if (rows.some((row) => Number(row.quality_score || 0) < 60 || row.warnings?.length)) missing.add("quality review");
    if (rows.some((row) => !row.ecu_type || !row.sw_number)) missing.add("ECU identification");
    const confidence = Math.round((averageQuality * 0.55) + (averageConfidence * 0.35) + Math.min(highQuality * 2, 10));
    const readiness = readinessFor(rows.length, highQuality, confidence);
    const first = rows[0];
    output.push({
      group_key: key,
      ecu_family: first.ecu_family || null,
      ecu_type: first.ecu_type || null,
      sw_number: first.sw_number || null,
      stage1_evidence_count: rows.length,
      high_quality_stage1_pair_count: highQuality,
      readiness,
      confidence: Math.max(0, Math.min(100, confidence)),
      missing_items: [...missing],
      next_recommended_action: nextAction(readiness, [...missing]),
    });
  }

  if (!output.length) {
    return [{
      group_key: "stage1 / no_evidence",
      ecu_family: null,
      ecu_type: null,
      sw_number: null,
      stage1_evidence_count: 0,
      high_quality_stage1_pair_count: 0,
      readiness: "no_evidence",
      confidence: 0,
      missing_items: ["more ORI/MOD pairs", "human labels", "map definitions", "ECU identification", "quality review"],
      next_recommended_action: "Collect Stage 1 ORI/MOD pairs and confirm actual_service_labels before any Stage 1 intelligence claim.",
    }];
  }

  return output.sort((left, right) => right.confidence - left.confidence);
}
