import { buildVehicleKey, compareNormalizedNames, normalizeToken, sameVehicleModelFamily } from "@/lib/vehicleControl/normalization";
import type { VehicleControlRecord } from "@/lib/vehicleControl/types";
import type {
  NormalizedEngineCandidate,
  NormalizedGenerationGroup,
  VehicleEnrichmentDiff,
  VehicleEnrichmentGapResult,
} from "@/lib/vehicleEnrichment/types";

function sameText(left: string | null | undefined, right: string | null | undefined) {
  return normalizeToken(left ?? "") === normalizeToken(right ?? "");
}

function sameBrand(left: string | null | undefined, right: string | null | undefined) {
  return compareNormalizedNames({ entityType: "brand", left, right }).equal;
}

function generationCompatible(existing: string, candidate: string) {
  if (sameText(existing, candidate)) return true;
  const candidateCodes = candidate.toUpperCase().match(/\b[A-Z]\d{3}\b/g) ?? [];
  return candidateCodes.length > 0 && candidateCodes.every((code) => existing.toUpperCase().includes(code));
}

function isManualVerified(record: VehicleControlRecord) {
  return record.verificationStatus === "verified" && !/carecufile/i.test(record.sourceType ?? "");
}

export function findExistingGeneration(group: NormalizedGenerationGroup, records: VehicleControlRecord[]) {
  const hasPlatformCodes = group.platformCodes.length > 0;
  return records.find((record) =>
    sameBrand(record.brand, group.brand) &&
    sameVehicleModelFamily(record.brand, record.model, group.model) &&
    (sameText(record.generation, group.customerDisplayLabel) || (hasPlatformCodes && group.platformCodes.every((code) => record.generation.toUpperCase().includes(code))))
  ) ?? null;
}

export function findExistingEngine(candidate: NormalizedEngineCandidate, records: VehicleControlRecord[]) {
  const key = buildVehicleKey({
    brand: candidate.brand,
    model: candidate.model,
    generation: candidate.generation,
    engine: candidate.engineDisplayName,
    ecuType: null,
  });
  return records.find((record) =>
    record.vehicleKey === key ||
    (sameBrand(record.brand, candidate.brand) &&
      sameVehicleModelFamily(record.brand, record.model, candidate.model) &&
      generationCompatible(record.generation, candidate.generation) &&
      sameText(record.engine, candidate.engineDisplayName))
  ) ?? null;
}

export function analyzeVehicleEnrichmentGaps(
  groups: NormalizedGenerationGroup[],
  engineCandidates: NormalizedEngineCandidate[],
  existingRecords: VehicleControlRecord[]
): VehicleEnrichmentGapResult[] {
  const results: VehicleEnrichmentGapResult[] = [];
  for (const group of groups) {
    const matchedGeneration = findExistingGeneration(group, existingRecords);
    const groupEngines = engineCandidates.filter((candidate) => candidate.generationGroupId === group.id);
    if (!groupEngines.length) {
      results.push({
        generationGroupId: group.id,
        matchedExistingGeneration: matchedGeneration,
        matchedExistingEngine: null,
        possibleDuplicates: matchedGeneration ? [matchedGeneration] : [],
        conflictingValues: [],
        protectedManualVerified: Boolean(matchedGeneration && isManualVerified(matchedGeneration)),
        suggestedAction: matchedGeneration ? "ignore_existing" : "create_draft_generation",
        reasons: matchedGeneration ? ["Generation already exists."] : ["Modern generation appears missing and should be reviewed as a draft."],
      });
      continue;
    }

    for (const candidate of groupEngines) {
      const matchedEngine = findExistingEngine(candidate, existingRecords);
      const possibleDuplicates = existingRecords.filter((record) =>
        sameBrand(record.brand, candidate.brand) &&
        sameVehicleModelFamily(record.brand, record.model, candidate.model) &&
        (record.engine.toLowerCase().includes(candidate.engineDisplayName.toLowerCase()) || candidate.engineDisplayName.toLowerCase().includes(record.engine.toLowerCase()))
      ).slice(0, 5);
      const conflictingValues: VehicleEnrichmentDiff[] = [];
      if (matchedEngine) {
        for (const [fieldName, existingValue, candidateValue] of [
          ["stock_hp", matchedEngine.stockHp, candidate.stockHp],
          ["stock_nm", matchedEngine.stockNm, candidate.stockNm],
          ["displacement_cc", matchedEngine.displacementCc, candidate.displacementCc],
        ] as const) {
          if (existingValue != null && candidateValue != null && existingValue !== candidateValue) {
            conflictingValues.push({
              entityType: "engine",
              fieldName,
              existingValue,
              candidateValue,
              diffType: isManualVerified(matchedEngine) ? "protected_manual_verified" : "conflict",
              severity: isManualVerified(matchedEngine) ? "error" : "warning",
              reviewStatus: "pending",
            });
          }
        }
      }
      const protectedManualVerified = Boolean(matchedEngine && isManualVerified(matchedEngine));
      const suggestedAction = (() => {
        if (protectedManualVerified && conflictingValues.length) return "create_diff_review";
        if (matchedEngine && !conflictingValues.length) return "ignore_existing";
        if (matchedEngine && conflictingValues.length) return "create_diff_review";
        if (matchedGeneration) return "create_draft_engine";
        return "create_draft_generation";
      })();
      results.push({
        generationGroupId: group.id,
        engineCandidateId: candidate.id,
        matchedExistingGeneration: matchedGeneration,
        matchedExistingEngine: matchedEngine,
        possibleDuplicates,
        conflictingValues,
        protectedManualVerified,
        suggestedAction,
        reasons: [
          matchedGeneration ? "Generation match found." : "Generation missing.",
          matchedEngine ? "Engine match found." : "Engine missing.",
          protectedManualVerified ? "Manual verified record is protected from overwrite." : "No protected manual overwrite risk detected.",
          ...conflictingValues.map((diff) => `Conflict on ${diff.fieldName}.`),
        ],
      });
    }
  }
  return results;
}
