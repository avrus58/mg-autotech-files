import {
  changedRegionsFromAnalyzer,
  normalizeIdentifier,
  normalizeOffsetRange,
  scoreDefinitionSetContext,
  selectBestDefinitionSets,
} from "@/lib/aiFileIntelligence/mapDefinitions";
import type {
  ChangedRegionAttribution,
  ChangedRegionInput,
  MapAttributionSummary,
  MapCategory,
  MapDefinition,
  MapDefinitionSet,
} from "@/lib/aiFileIntelligence/types";
import type { FileExpertAnalyzerResult } from "@/lib/fileExpert/types";

function overlapRatio(
  changed: ChangedRegionInput,
  definition: MapDefinition
) {
  const changedRange = normalizeOffsetRange(changed);
  const definitionRange = normalizeOffsetRange(definition);
  const intersection = Math.max(
    0,
    Math.min(changedRange.offset_end, definitionRange.offset_end) -
      Math.max(changedRange.offset_start, definitionRange.offset_start) +
      1
  );
  return intersection / Math.max(1, changedRange.size);
}

function weightedDefinitionConfidence(input: {
  changed: ChangedRegionInput;
  definition: MapDefinition;
  definitionSet: MapDefinitionSet;
  exactSwMatch: boolean;
}) {
  const overlap = overlapRatio(input.changed, input.definition);
  const definitionConfidence = Math.max(0, Math.min(100, input.definition.confidence_score || 0));
  let score = overlap * 60 + definitionConfidence * 0.25;
  if (input.definition.human_verified) score += 10;
  if (input.definitionSet.human_verified) score += 6;
  if (input.exactSwMatch) score += 8;
  return Math.round(Math.max(0, Math.min(100, score)));
}

function attributionStatus(input: {
  overlap: number;
  humanVerified: boolean;
  alternatives: number;
}): ChangedRegionAttribution["attribution_status"] {
  if (input.alternatives > 1 && input.overlap < 0.9) return "ambiguous";
  if (input.overlap < 0.5) return "partial_match";
  return input.humanVerified ? "matched_verified" : "matched_unverified";
}

export function attributeChangedRegion(input: {
  changed: ChangedRegionInput;
  definitionSet: MapDefinitionSet;
  definitions: MapDefinition[];
  exactSwMatch?: boolean;
}): ChangedRegionAttribution {
  const changedRange = normalizeOffsetRange(input.changed);
  const candidates = input.definitions
    .filter((definition) => definition.active !== false)
    .map((definition) => {
      const overlap = overlapRatio(changedRange, definition);
      return {
        definition,
        overlap,
        confidence: weightedDefinitionConfidence({
          changed: changedRange,
          definition,
          definitionSet: input.definitionSet,
          exactSwMatch: Boolean(input.exactSwMatch),
        }),
      };
    })
    .filter((candidate) => candidate.overlap > 0)
    .sort((left, right) =>
      right.confidence - left.confidence ||
      Number(right.definition.human_verified) - Number(left.definition.human_verified) ||
      right.overlap - left.overlap ||
      left.definition.map_name.localeCompare(right.definition.map_name)
    );

  const best = candidates[0];
  if (!best) {
    return {
      changed_region_id: input.changed.id ?? `${changedRange.offset_start}-${changedRange.offset_end}`,
      offset_start: changedRange.offset_start,
      offset_end: changedRange.offset_end,
      size: changedRange.size,
      matched_map_definition_id: null,
      map_name: null,
      category: "unknown",
      overlap_ratio: 0,
      confidence: 0,
      human_verified: false,
      attribution_status: "unknown",
      warnings: ["Changed region does not overlap an active map definition."],
      alternatives: [],
    };
  }

  const alternatives = candidates.slice(1, 4).map((candidate) => ({
    matched_map_definition_id: candidate.definition.id,
    map_name: candidate.definition.map_name,
    category: candidate.definition.category,
    overlap_ratio: Number(candidate.overlap.toFixed(3)),
    confidence: candidate.confidence,
    human_verified: candidate.definition.human_verified,
  }));
  const warnings: string[] = [];
  if (best.overlap < 0.5) warnings.push("Only a partial overlap with the map definition was found.");
  if (alternatives.length) warnings.push("Multiple map definitions overlap this changed region.");
  if (["checksum", "metadata", "axis"].includes(best.definition.category)) {
    warnings.push(`${best.definition.category} area changed; do not infer tuning intent from this alone.`);
  }

  return {
    changed_region_id: input.changed.id ?? `${changedRange.offset_start}-${changedRange.offset_end}`,
    offset_start: changedRange.offset_start,
    offset_end: changedRange.offset_end,
    size: changedRange.size,
    matched_map_definition_id: best.definition.id,
    map_name: best.definition.map_name,
    category: best.definition.category,
    overlap_ratio: Number(best.overlap.toFixed(3)),
    confidence: best.confidence,
    human_verified: best.definition.human_verified,
    attribution_status: attributionStatus({
      overlap: best.overlap,
      humanVerified: best.definition.human_verified,
      alternatives: candidates.length,
    }),
    warnings,
    alternatives,
  };
}

export function attributeChangedRegionsToDefinitions(input: {
  changedRegions: ChangedRegionInput[];
  definitionSets: MapDefinitionSet[];
  definitions: MapDefinition[];
  ecuFamily?: string | null;
  ecuType?: string | null;
  swNumber?: string | null;
  hwNumber?: string | null;
}): MapAttributionSummary {
  if (!input.changedRegions.length) {
    return {
      status: "no_changed_regions",
      definition_set_id: null,
      exact_sw_match: false,
      attributed_regions: [],
      category_counts: {},
      unknown_region_count: 0,
      verified_match_count: 0,
      average_confidence: 0,
      map_definition_required: true,
      human_review_required: true,
      checksum_verification_required: true,
    };
  }

  const usableSets = selectBestDefinitionSets(input.definitionSets, input);
  const bestSet = usableSets[0] ?? null;
  if (!bestSet) {
    return {
      status: "no_definition_set",
      definition_set_id: null,
      exact_sw_match: false,
      attributed_regions: input.changedRegions.map((region) => ({
        changed_region_id: region.id ?? `${region.offset_start}-${region.offset_end}`,
        ...normalizeOffsetRange(region),
        matched_map_definition_id: null,
        map_name: null,
        category: "unknown",
        overlap_ratio: 0,
        confidence: 0,
        human_verified: false,
        attribution_status: "no_definition_set",
        warnings: ["No active map definition set matches this ECU/SW context."],
        alternatives: [],
      })),
      category_counts: { unknown: input.changedRegions.length },
      unknown_region_count: input.changedRegions.length,
      verified_match_count: 0,
      average_confidence: 0,
      map_definition_required: true,
      human_review_required: true,
      checksum_verification_required: true,
    };
  }

  const setDefinitions = input.definitions.filter(
    (definition) => definition.definition_set_id === bestSet.id && definition.active !== false
  );
  const exactSwMatch = Boolean(
    normalizeIdentifier(bestSet.sw_number) &&
    normalizeIdentifier(bestSet.sw_number) === normalizeIdentifier(input.swNumber)
  );
  const attributedRegions = input.changedRegions.map((changed) =>
    attributeChangedRegion({
      changed,
      definitionSet: bestSet,
      definitions: setDefinitions,
      exactSwMatch,
    })
  );
  const categoryCounts = attributedRegions.reduce<Partial<Record<MapCategory, number>>>((acc, region) => {
    acc[region.category] = (acc[region.category] ?? 0) + 1;
    return acc;
  }, {});
  const known = attributedRegions.filter((region) => region.attribution_status !== "unknown");
  const verified = attributedRegions.filter((region) => region.attribution_status === "matched_verified");
  const averageConfidence = known.length
    ? Math.round(known.reduce((sum, region) => sum + region.confidence, 0) / known.length)
    : 0;
  const unknownRegionCount = attributedRegions.length - known.length;
  const partial = attributedRegions.some((region) =>
    ["partial_match", "ambiguous", "matched_unverified"].includes(region.attribution_status)
  );
  return {
    status: known.length === 0 ? "unknown" : unknownRegionCount || partial ? "partial" : "attributed",
    definition_set_id: bestSet.id,
    exact_sw_match: exactSwMatch,
    attributed_regions: attributedRegions,
    category_counts: categoryCounts,
    unknown_region_count: unknownRegionCount,
    verified_match_count: verified.length,
    average_confidence: averageConfidence,
    map_definition_required: unknownRegionCount > 0 || partial,
    human_review_required: true,
    checksum_verification_required: true,
  };
}

export function attributeAnalyzerResultToDefinitions(input: {
  result: FileExpertAnalyzerResult | null | undefined;
  definitionSets: MapDefinitionSet[];
  definitions: MapDefinition[];
}) {
  const identity = input.result?.ecu_identification;
  return attributeChangedRegionsToDefinitions({
    changedRegions: changedRegionsFromAnalyzer(input.result),
    definitionSets: input.definitionSets,
    definitions: input.definitions,
    ecuFamily: identity?.family ?? input.result?.metadata?.ecu_type ?? null,
    ecuType: identity?.display_name ?? input.result?.metadata?.ecu_type ?? null,
    swNumber: identity?.software_numbers[0] ?? null,
    hwNumber: identity?.hardware_numbers[0] ?? null,
  });
}

export function explainDefinitionSetMatch(
  definitionSet: MapDefinitionSet,
  context: {
    ecuFamily?: string | null;
    ecuType?: string | null;
    swNumber?: string | null;
    hwNumber?: string | null;
  }
) {
  return {
    definition_set_id: definitionSet.id,
    score: scoreDefinitionSetContext({ definitionSet, ...context }),
    exact_sw_match: Boolean(
      normalizeIdentifier(definitionSet.sw_number) &&
      normalizeIdentifier(definitionSet.sw_number) === normalizeIdentifier(context.swNumber)
    ),
    human_verified: definitionSet.human_verified,
  };
}
