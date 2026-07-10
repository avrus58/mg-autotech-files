import type {
  ChangedRegionInput,
  MapDefinition,
  MapDefinitionSet,
} from "@/lib/aiFileIntelligence/types";
import type { FileExpertAnalyzerResult } from "@/lib/fileExpert/types";

export function normalizeIdentifier(value: string | null | undefined) {
  return value?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "";
}

export function parseHexOffset(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number.parseInt(value.replace(/^0x/i, ""), 16);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toHexOffset(value: number) {
  return `0x${Math.max(0, Math.floor(value)).toString(16).toUpperCase().padStart(6, "0")}`;
}

export function normalizeOffsetRange(input: {
  offset_start: number;
  offset_end: number;
}) {
  const start = Math.max(0, Math.floor(input.offset_start));
  const end = Math.max(start, Math.floor(input.offset_end));
  return { offset_start: start, offset_end: end, size: end - start + 1 };
}

export function changedRegionsFromAnalyzer(
  result: FileExpertAnalyzerResult | null | undefined
): ChangedRegionInput[] {
  if (!result) return [];
  const blocks = result.comparison?.changed_blocks ?? [];
  if (blocks.length) {
    const regions: Array<ChangedRegionInput | null> = blocks.map((block, index) => {
      const start = parseHexOffset(block.start_offset_hex);
      const end = parseHexOffset(block.end_offset_hex);
      if (start === null || end === null) return null;
      const normalized = normalizeOffsetRange({ offset_start: start, offset_end: end });
      return {
        id: `changed-block-${index + 1}`,
        ...normalized,
        changed_byte_count: block.changed_byte_count,
      };
    });
    return regions.filter((region): region is ChangedRegionInput => region !== null);
  }

  const regions: Array<ChangedRegionInput | null> = result.map_candidates.map((candidate, index) => {
    const start = parseHexOffset(candidate.offset_hex);
    if (start === null) return null;
    const end = start + Math.max(0, candidate.length - 1);
    return {
      id: `map-candidate-${index + 1}`,
      ...normalizeOffsetRange({ offset_start: start, offset_end: end }),
      changed_byte_count: candidate.length,
    };
  });
  return regions.filter((region): region is ChangedRegionInput => region !== null);
}

export function mapDefinitionMatchesContext(input: {
  definitionSet: MapDefinitionSet;
  ecuFamily?: string | null;
  ecuType?: string | null;
  swNumber?: string | null;
  hwNumber?: string | null;
}) {
  const set = input.definitionSet;
  if (set.active === false) return false;
  const setFamily = normalizeIdentifier(set.ecu_family);
  const setType = normalizeIdentifier(set.ecu_type);
  const setSw = normalizeIdentifier(set.sw_number);
  const setHw = normalizeIdentifier(set.hw_number);
  const family = normalizeIdentifier(input.ecuFamily);
  const type = normalizeIdentifier(input.ecuType);
  const sw = normalizeIdentifier(input.swNumber);
  const hw = normalizeIdentifier(input.hwNumber);

  if (setSw && sw && setSw !== sw) return false;
  if (setHw && hw && setHw !== hw) return false;
  if (setType && type && setType !== type) return false;
  if (setFamily && family && setFamily !== family) return false;

  return Boolean(setSw || setHw || setType || setFamily);
}

export function scoreDefinitionSetContext(input: {
  definitionSet: MapDefinitionSet;
  ecuFamily?: string | null;
  ecuType?: string | null;
  swNumber?: string | null;
  hwNumber?: string | null;
}) {
  const set = input.definitionSet;
  let score = 0;
  if (normalizeIdentifier(set.sw_number) && normalizeIdentifier(set.sw_number) === normalizeIdentifier(input.swNumber)) score += 45;
  if (normalizeIdentifier(set.hw_number) && normalizeIdentifier(set.hw_number) === normalizeIdentifier(input.hwNumber)) score += 25;
  if (normalizeIdentifier(set.ecu_type) && normalizeIdentifier(set.ecu_type) === normalizeIdentifier(input.ecuType)) score += 20;
  if (normalizeIdentifier(set.ecu_family) && normalizeIdentifier(set.ecu_family) === normalizeIdentifier(input.ecuFamily)) score += 10;
  if (set.human_verified) score += 12;
  score += Math.min(10, Math.max(0, Number(set.confidence_score || 0)) / 10);
  return score;
}

export function selectBestDefinitionSets(
  definitionSets: MapDefinitionSet[],
  context: {
    ecuFamily?: string | null;
    ecuType?: string | null;
    swNumber?: string | null;
    hwNumber?: string | null;
  }
) {
  return definitionSets
    .filter((definitionSet) => mapDefinitionMatchesContext({ definitionSet, ...context }))
    .sort((left, right) =>
      scoreDefinitionSetContext({ definitionSet: right, ...context }) -
      scoreDefinitionSetContext({ definitionSet: left, ...context }) ||
      left.name.localeCompare(right.name)
    );
}

export function validateMapDefinition(definition: MapDefinition) {
  const issues: string[] = [];
  if (definition.active === false) return issues;
  if (!definition.map_name.trim()) issues.push("Map name is required.");
  if (definition.offset_start < 0 || definition.offset_end < 0) issues.push("Offsets must be positive.");
  if (definition.offset_end < definition.offset_start) issues.push("End offset must be greater than start offset.");
  if (definition.confidence_score < 0 || definition.confidence_score > 100) issues.push("Confidence must be 0-100.");
  return issues;
}
