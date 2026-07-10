import type {
  FileExpertAnalyzerResult,
  FileExpertChangedBlock,
  FileExpertMapCandidate,
} from "@/lib/fileExpert/types";

export type MapCategory =
  | "torque_model"
  | "boost"
  | "fuel"
  | "rail_pressure"
  | "smoke_limiter"
  | "egr"
  | "dpf"
  | "adblue"
  | "dtc"
  | "vmax"
  | "start_stop"
  | "tcu_shift"
  | "tcu_lockup"
  | "unknown";

export type MapDefinition = {
  id: string;
  ecuFamily?: string | null;
  ecuType?: string | null;
  swNumber?: string | null;
  hwNumber?: string | null;
  name: string;
  category: MapCategory;
  startOffsetHex: string;
  endOffsetHex: string;
  confidence: number;
  source: "human_verified" | "provider_reference" | "cluster_candidate" | "research";
  notes?: string | null;
};

export type MapAttribution = {
  category: MapCategory;
  mapName: string;
  definitionId: string;
  overlapRate: number;
  confidence: number;
  changedBytes: number;
  reason: string;
};

export type MapAttributionSummary = {
  status: "no_definitions" | "no_changed_regions" | "attributed" | "unknown_regions";
  attributed: MapAttribution[];
  unknownChangedRegions: number;
  mapDefinitionRequired: boolean;
  adminMessage: string;
};

function parseHex(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number.parseInt(value.replace(/^0x/i, ""), 16);
  return Number.isFinite(parsed) ? parsed : null;
}

function regionOverlapRate(
  leftStartHex: string,
  leftEndHex: string,
  rightStartHex: string,
  rightEndHex: string
) {
  const leftStart = parseHex(leftStartHex);
  const leftEnd = parseHex(leftEndHex);
  const rightStart = parseHex(rightStartHex);
  const rightEnd = parseHex(rightEndHex);
  if (leftStart === null || leftEnd === null || rightStart === null || rightEnd === null) return 0;
  const intersection = Math.max(0, Math.min(leftEnd, rightEnd) - Math.max(leftStart, rightStart) + 1);
  const leftLength = Math.max(1, leftEnd - leftStart + 1);
  return intersection / leftLength;
}

function changedRegions(result: FileExpertAnalyzerResult) {
  const blocks = result.comparison?.changed_blocks ?? [];
  if (blocks.length) return blocks;
  return result.map_candidates.map((candidate) => ({
    start_offset_hex: candidate.offset_hex,
    end_offset_hex: candidate.offset_hex,
    length: candidate.length,
    changed_byte_count: candidate.length,
    ori_hex_preview: "",
    mod_hex_preview: "",
    unsigned_8bit_preview: [],
    signed_8bit_preview: [],
    uint16_be_preview: [],
    uint16_le_preview: [],
    delta_preview: [],
  } satisfies FileExpertChangedBlock));
}

function matchesDefinitionContext(result: FileExpertAnalyzerResult, definition: MapDefinition) {
  const identity = result.ecu_identification;
  const normalize = (value: string | null | undefined) => value?.trim().toUpperCase() || "";
  if (definition.ecuFamily && normalize(definition.ecuFamily) !== normalize(identity?.family)) return false;
  if (definition.ecuType && normalize(definition.ecuType) !== normalize(identity?.display_name ?? result.metadata?.ecu_type)) return false;
  if (definition.swNumber && !identity?.software_numbers.map(normalize).includes(normalize(definition.swNumber))) return false;
  if (definition.hwNumber && !identity?.hardware_numbers.map(normalize).includes(normalize(definition.hwNumber))) return false;
  return true;
}

export function attributeChangedRegionsToMapDefinitions(
  result: FileExpertAnalyzerResult | null | undefined,
  definitions: MapDefinition[]
): MapAttributionSummary {
  if (!result) {
    return {
      status: "no_changed_regions",
      attributed: [],
      unknownChangedRegions: 0,
      mapDefinitionRequired: true,
      adminMessage: "No analyzer result is available for map attribution.",
    };
  }

  const regions = changedRegions(result);
  if (!definitions.length) {
    return {
      status: "no_definitions",
      attributed: [],
      unknownChangedRegions: regions.length,
      mapDefinitionRequired: true,
      adminMessage: "No ECU-specific map definitions are available. Human map definition is required before any generation workflow.",
    };
  }
  if (!regions.length) {
    return {
      status: "no_changed_regions",
      attributed: [],
      unknownChangedRegions: 0,
      mapDefinitionRequired: true,
      adminMessage: "No changed regions are available for attribution.",
    };
  }

  const usableDefinitions = definitions.filter((definition) => matchesDefinitionContext(result, definition));
  const attributed: MapAttribution[] = [];
  let unknownChangedRegions = 0;

  for (const region of regions) {
    const matches = usableDefinitions
      .map((definition) => ({
        definition,
        overlapRate: regionOverlapRate(
          region.start_offset_hex,
          region.end_offset_hex,
          definition.startOffsetHex,
          definition.endOffsetHex
        ),
      }))
      .filter((item) => item.overlapRate >= 0.25)
      .sort((left, right) => right.overlapRate - left.overlapRate || right.definition.confidence - left.definition.confidence);

    const best = matches[0];
    if (!best) {
      unknownChangedRegions += 1;
      continue;
    }

    attributed.push({
      category: best.definition.category,
      mapName: best.definition.name,
      definitionId: best.definition.id,
      overlapRate: Number(best.overlapRate.toFixed(3)),
      confidence: Number(Math.min(1, best.definition.confidence * best.overlapRate).toFixed(3)),
      changedBytes: region.changed_byte_count,
      reason: `Changed region overlaps ${best.definition.name} by ${Math.round(best.overlapRate * 100)}%.`,
    });
  }

  return {
    status: attributed.length ? (unknownChangedRegions ? "unknown_regions" : "attributed") : "unknown_regions",
    attributed,
    unknownChangedRegions,
    mapDefinitionRequired: unknownChangedRegions > 0 || !attributed.length,
    adminMessage: attributed.length
      ? "Some changed regions can be connected to known map definitions. Human calibration review is still required."
      : "Changed regions do not match the available map definitions. Treat as unknown map area.",
  };
}

export function summarizeMapCandidates(candidates: FileExpertMapCandidate[]) {
  const byType = new Map<string, { count: number; maxConfidence: number }>();
  for (const candidate of candidates) {
    const current = byType.get(candidate.possible_type) ?? { count: 0, maxConfidence: 0 };
    current.count += 1;
    current.maxConfidence = Math.max(current.maxConfidence, candidate.confidence);
    byType.set(candidate.possible_type, current);
  }
  return [...byType.entries()].map(([possibleType, value]) => ({
    possibleType,
    count: value.count,
    maxConfidence: Number(value.maxConfidence.toFixed(3)),
    note: "Structural candidate only; exact map purpose requires a human-reviewed map definition.",
  }));
}
