import {
  buildCanonicalVehicleKey,
  compareNormalizedNames,
  normalizeBrandName,
  normalizeEngineName,
  normalizeGenerationName,
  normalizeModelName,
} from "@/lib/vehicleNormalization";
import type { VehicleControlRecord } from "@/lib/vehicleControl/types";
import type {
  ExternalAliasSuggestion,
  ExternalCoverageIssue,
  ExternalCoverageReport,
  ExternalCoverageReviewItem,
  ExternalCoverageStats,
  NormalizedEngineCandidate,
  NormalizedGenerationGroup,
  VehicleEnrichmentGapResult,
  VehicleEnrichmentInput,
} from "@/lib/vehicleEnrichment/types";

function makeEmptyStats(): ExternalCoverageStats {
  return {
    missingBrands: 0,
    missingModels: 0,
    missingGenerations: 0,
    missingEngines: 0,
    outdatedYearRanges: 0,
    aliasSuggestions: 0,
    duplicateRisks: 0,
    conflicts: 0,
    protectedVerifiedConflicts: 0,
    lowConfidenceCandidates: 0,
    needsReview: 0,
    alreadyMatched: 0,
  };
}

function addUnique(set: Set<string>, value: string | null | undefined) {
  if (value) set.add(value);
}

function sameBrand(left: string | null | undefined, right: string | null | undefined) {
  return compareNormalizedNames({ entityType: "brand", left, right }).equal;
}

function sameModel(brand: string, left: string | null | undefined, right: string | null | undefined) {
  return compareNormalizedNames({ entityType: "model", brand, left, right }).equal;
}

function sameGeneration(brand: string, model: string, left: string | null | undefined, right: string | null | undefined) {
  return compareNormalizedNames({ entityType: "generation", brand, model, left, right }).equal;
}

function normalizedBrandKey(value: string) {
  return normalizeBrandName(value).normalizedKey;
}

function normalizedModelKey(brand: string, value: string) {
  return normalizeModelName(brand, value).normalizedKey;
}

function normalizedGenerationKey(brand: string, model: string, value: string) {
  return normalizeGenerationName(brand, model, value).normalizedKey;
}

function recordYearRangeConflicts(group: NormalizedGenerationGroup, existing: VehicleControlRecord | null) {
  if (!existing) return false;
  const candidateHasYears = group.yearFrom != null || group.yearTo != null;
  if (!candidateHasYears) return false;
  if (existing.yearFrom != null && group.yearFrom != null && existing.yearFrom !== group.yearFrom) return true;
  if (existing.yearTo != null && group.yearTo != null && existing.yearTo !== group.yearTo) return true;
  if (existing.yearTo != null && group.yearTo == null) return true;
  return false;
}

function possibleEngineDuplicate(candidate: NormalizedEngineCandidate, records: VehicleControlRecord[]) {
  return records.find((record) =>
    sameBrand(record.brand, candidate.brand) &&
    sameModel(candidate.brand, record.model, candidate.model) &&
    sameGeneration(candidate.brand, candidate.model, record.generation, candidate.generation) &&
    record.engine !== candidate.engineDisplayName &&
    record.stockHp != null &&
    candidate.stockHp != null &&
    Math.abs(record.stockHp - candidate.stockHp) <= 5 &&
    (record.stockNm == null || candidate.stockNm == null || Math.abs(record.stockNm - candidate.stockNm) <= 20) &&
    (record.displacementCc == null || candidate.displacementCc == null || Math.abs(record.displacementCc - candidate.displacementCc) <= 50)
  ) ?? null;
}

function getGroupAliasSuggestions(group: NormalizedGenerationGroup): ExternalAliasSuggestion[] {
  const firstEntry = group.includedEntries[0];
  if (!firstEntry) return [];
  const suggestions: ExternalAliasSuggestion[] = [];
  const brand = normalizeBrandName(firstEntry.brand);
  const model = normalizeModelName(firstEntry.brand, firstEntry.model);
  const generation = normalizeGenerationName(firstEntry.brand, firstEntry.model, firstEntry.rawGeneration || firstEntry.rawTitle || group.customerDisplayLabel);

  if (brand.aliasMatched) {
    suggestions.push({
      entityType: "brand",
      sourceName: brand.sourceName,
      canonicalName: brand.canonicalName,
      normalizedKey: brand.normalizedKey,
      confidenceScore: 95,
      reason: "Source brand resolved through canonical brand alias.",
      action: "already_normalized",
    });
  }
  if (model.aliasMatched) {
    suggestions.push({
      entityType: "model",
      sourceName: model.sourceName,
      canonicalName: model.canonicalName,
      normalizedKey: model.normalizedKey,
      brand: group.brand,
      confidenceScore: 92,
      reason: "Source model resolved through canonical model alias.",
      action: "already_normalized",
    });
  }
  if (generation.aliasMatched) {
    suggestions.push({
      entityType: "generation",
      sourceName: generation.sourceName,
      canonicalName: generation.canonicalName,
      normalizedKey: generation.normalizedKey,
      brand: group.brand,
      model: group.model,
      confidenceScore: 85,
      reason: "Source generation text resolved to canonical platform/year label.",
      action: "already_normalized",
    });
  }
  return suggestions;
}

function getEngineAliasSuggestion(candidate: NormalizedEngineCandidate): ExternalAliasSuggestion | null {
  const normalized = normalizeEngineName(candidate.engineDisplayName);
  if (!normalized.aliasMatched) return null;
  return {
    entityType: "engine",
    sourceName: normalized.sourceName,
    canonicalName: normalized.canonicalName,
    normalizedKey: normalized.normalizedKey,
    brand: candidate.brand,
    model: candidate.model,
    confidenceScore: 70,
    reason: "Engine display name was cleaned to a canonical display form.",
    action: "already_normalized",
  };
}

function sourceLabel(input: VehicleEnrichmentInput) {
  return input.sourceName || input.sourceType || null;
}

function sourceUrl(input: VehicleEnrichmentInput) {
  return input.sourceUrl ?? null;
}

function issue(input: {
  type: ExternalCoverageIssue["type"];
  severity: ExternalCoverageIssue["severity"];
  group: NormalizedGenerationGroup;
  candidate?: NormalizedEngineCandidate;
  input: VehicleEnrichmentInput;
  action: ExternalCoverageIssue["suggestedAction"];
  message: string;
  matchedExistingId?: string | null;
  reasons?: string[];
  vehicleKey?: string | null;
}): ExternalCoverageIssue {
  return {
    type: input.type,
    severity: input.severity,
    brand: input.group.brand,
    model: input.group.model,
    generation: input.group.customerDisplayLabel,
    engine: input.candidate?.engineDisplayName ?? null,
    candidateId: input.candidate?.id ?? input.group.id,
    suggestedAction: input.action,
    message: input.message,
    sourceName: sourceLabel(input.input),
    sourceUrl: sourceUrl(input.input),
    canonical: {
      brand: input.group.brand,
      model: input.group.model,
      generation: input.group.customerDisplayLabel,
      engine: input.candidate?.engineDisplayName ?? null,
      vehicleKey: input.vehicleKey ?? null,
    },
    matchedExistingId: input.matchedExistingId ?? null,
    reasons: input.reasons ?? [],
  };
}

function reviewItem(input: {
  id: string;
  kind: ExternalCoverageReviewItem["kind"];
  group: NormalizedGenerationGroup;
  candidate?: NormalizedEngineCandidate;
  source: VehicleEnrichmentInput;
  action: ExternalCoverageReviewItem["suggestedAction"];
  reasons: string[];
  blockedByVerifiedData?: boolean;
}) {
  return {
    id: input.id,
    kind: input.kind,
    brand: input.group.brand,
    model: input.group.model,
    generation: input.group.customerDisplayLabel,
    engine: input.candidate?.engineDisplayName ?? null,
    sourceName: sourceLabel(input.source),
    sourceUrl: sourceUrl(input.source),
    confidenceScore: input.candidate?.confidenceScore ?? input.group.confidenceScore,
    reviewStatus: input.candidate?.reviewStatus ?? input.group.reviewStatus,
    suggestedAction: input.action,
    reasons: input.reasons,
    blockedByVerifiedData: Boolean(input.blockedByVerifiedData),
  } satisfies ExternalCoverageReviewItem;
}

export function buildExternalCoverageReport(input: {
  source: VehicleEnrichmentInput;
  groups: NormalizedGenerationGroup[];
  engineCandidates: NormalizedEngineCandidate[];
  gaps: VehicleEnrichmentGapResult[];
  existingRecords: VehicleControlRecord[];
}): ExternalCoverageReport {
  const stats = makeEmptyStats();
  const issues: ExternalCoverageIssue[] = [];
  const aliasSuggestions: ExternalAliasSuggestion[] = [];
  const reviewQueue: ExternalCoverageReviewItem[] = [];
  const sourceMappings: ExternalCoverageReport["sourceMappings"] = [];
  const missingBrands = new Set<string>();
  const missingModels = new Set<string>();
  const missingGenerations = new Set<string>();
  const missingEngines = new Set<string>();
  const outdatedRanges = new Set<string>();
  const duplicateRisks = new Set<string>();
  const lowConfidence = new Set<string>();
  const alreadyMatched = new Set<string>();
  const protectedConflicts = new Set<string>();
  const conflicts = new Set<string>();
  const needsReview = new Set<string>();
  const existingBrandKeys = new Set(input.existingRecords.map((record) => normalizedBrandKey(record.brand)));
  const existingModelKeys = new Set(input.existingRecords.map((record) => `${normalizedBrandKey(record.brand)}:${normalizedModelKey(record.brand, record.model)}`));
  const candidateVehicleKeys = new Map<string, string[]>();

  for (const group of input.groups) {
    const brandKey = normalizedBrandKey(group.brand);
    const modelKey = `${brandKey}:${normalizedModelKey(group.brand, group.model)}`;
    const gapForGroup = input.gaps.find((gap) => gap.generationGroupId === group.id);
    aliasSuggestions.push(...getGroupAliasSuggestions(group));
    addUnique(needsReview, group.id);

    if (!existingBrandKeys.has(brandKey)) {
      addUnique(missingBrands, brandKey);
      issues.push(issue({
        type: "missing_brand",
        severity: "warning",
        group,
        input: input.source,
        action: "create_draft_generation",
        message: `${group.brand} is not present in the canonical MG AutoTech vehicle database.`,
        reasons: ["External source includes a brand that is not currently represented internally."],
      }));
      reviewQueue.push(reviewItem({
        id: `${group.id}:missing-brand`,
        kind: "brand",
        group,
        source: input.source,
        action: "create_draft_generation",
        reasons: ["Missing brand must be reviewed before draft creation."],
      }));
    }

    if (!existingModelKeys.has(modelKey)) {
      addUnique(missingModels, modelKey);
      issues.push(issue({
        type: "missing_model",
        severity: "warning",
        group,
        input: input.source,
        action: "create_draft_generation",
        message: `${group.brand} ${group.model} is missing as a canonical model family.`,
        reasons: ["External source model resolved through normalization and has no internal model family match."],
      }));
    }

    if (!gapForGroup?.matchedExistingGeneration) {
      addUnique(missingGenerations, `${modelKey}:${normalizedGenerationKey(group.brand, group.model, group.customerDisplayLabel)}`);
      issues.push(issue({
        type: "missing_generation",
        severity: "warning",
        group,
        input: input.source,
        action: "create_draft_generation",
        message: `${group.brand} ${group.model} ${group.customerDisplayLabel} appears missing.`,
        reasons: ["No existing generation matched this canonical platform/year group."],
      }));
      reviewQueue.push(reviewItem({
        id: `${group.id}:missing-generation`,
        kind: "generation",
        group,
        source: input.source,
        action: "create_draft_generation",
        reasons: ["Create as unpublished needs_review draft only after admin verification."],
      }));
    } else {
      addUnique(alreadyMatched, gapForGroup.matchedExistingGeneration.id ?? gapForGroup.matchedExistingGeneration.vehicleKey);
      if (recordYearRangeConflicts(group, gapForGroup.matchedExistingGeneration)) {
        addUnique(outdatedRanges, group.id);
        issues.push(issue({
          type: "outdated_year_range",
          severity: "info",
          group,
          input: input.source,
          action: "create_diff_review",
          message: "External generation year range differs from the existing canonical record.",
          matchedExistingId: gapForGroup.matchedExistingGeneration.id ?? null,
          reasons: ["Year range should be reviewed; verified internal data must not be overwritten automatically."],
        }));
      }
    }
  }

  for (const candidate of input.engineCandidates) {
    const group = input.groups.find((item) => item.id === candidate.generationGroupId);
    if (!group) continue;
    const gap = input.gaps.find((item) => item.engineCandidateId === candidate.id);
    const vehicleKey = buildCanonicalVehicleKey({
      brand: candidate.brand,
      model: candidate.model,
      generation: candidate.generation,
      engine: candidate.engineDisplayName,
    });
    candidateVehicleKeys.set(vehicleKey, [...(candidateVehicleKeys.get(vehicleKey) ?? []), candidate.id]);
    const engineAlias = getEngineAliasSuggestion(candidate);
    if (engineAlias) aliasSuggestions.push(engineAlias);
    addUnique(needsReview, candidate.id);

    if (!gap?.matchedExistingEngine) {
      addUnique(missingEngines, vehicleKey);
      issues.push(issue({
        type: "missing_engine",
        severity: "warning",
        group,
        candidate,
        input: input.source,
        action: gap?.suggestedAction ?? "create_draft_engine",
        message: `${candidate.engineDisplayName} appears missing from the canonical vehicle database.`,
        reasons: ["No existing engine record matched this canonical brand/model/generation/engine combination."],
        vehicleKey,
      }));
      reviewQueue.push(reviewItem({
        id: candidate.id,
        kind: "engine",
        group,
        candidate,
        source: input.source,
        action: gap?.suggestedAction ?? "create_draft_engine",
        reasons: gap?.reasons ?? ["Engine candidate requires admin review before draft creation."],
        blockedByVerifiedData: gap?.protectedManualVerified,
      }));
    } else {
      addUnique(alreadyMatched, gap.matchedExistingEngine.id ?? gap.matchedExistingEngine.vehicleKey);
    }

    if (candidate.stockHp == null || candidate.stockNm == null) {
      issues.push(issue({
        type: "missing_stock_performance",
        severity: "warning",
        group,
        candidate,
        input: input.source,
        action: "mark_needs_review",
        message: "External engine candidate is missing stock HP or stock NM.",
        reasons: ["Candidate can be staged but must remain needs_review until performance data is corrected."],
        vehicleKey,
      }));
    }
    if (candidate.fuelType == null || candidate.displacementCc == null) {
      issues.push(issue({
        type: "missing_fuel_or_displacement",
        severity: "info",
        group,
        candidate,
        input: input.source,
        action: "mark_needs_review",
        message: "External engine candidate is missing fuel type or displacement metadata.",
        reasons: ["Fuel/displacement gaps reduce confidence but do not expose anything to customers."],
        vehicleKey,
      }));
    }
    if (candidate.confidenceScore < 55) {
      addUnique(lowConfidence, candidate.id);
      issues.push(issue({
        type: "low_confidence",
        severity: "warning",
        group,
        candidate,
        input: input.source,
        action: "mark_needs_review",
        message: "Candidate confidence is low and should not be used without manual correction.",
        reasons: candidate.warnings,
        vehicleKey,
      }));
    }
    if (gap?.conflictingValues.length) {
      addUnique(conflicts, candidate.id);
      if (gap.protectedManualVerified) addUnique(protectedConflicts, candidate.id);
      for (const diff of gap.conflictingValues) {
        issues.push(issue({
          type: gap.protectedManualVerified ? "verified_conflict" : "engine_possible_duplicate",
          severity: gap.protectedManualVerified ? "error" : "warning",
          group,
          candidate,
          input: input.source,
          action: "create_diff_review",
          message: `External value conflicts with existing ${diff.fieldName}.`,
          matchedExistingId: gap.matchedExistingEngine?.id ?? null,
          reasons: [`Existing: ${String(diff.existingValue)}`, `Candidate: ${String(diff.candidateValue)}`, "No destructive overwrite is allowed."],
          vehicleKey,
        }));
      }
    }
    const duplicate = possibleEngineDuplicate(candidate, input.existingRecords);
    if (duplicate && duplicate.vehicleKey !== gap?.matchedExistingEngine?.vehicleKey) {
      addUnique(duplicateRisks, candidate.id);
      issues.push(issue({
        type: "engine_possible_duplicate",
        severity: "warning",
        group,
        candidate,
        input: input.source,
        action: "link_existing",
        message: "A similar existing engine exists with matching performance/displacement data.",
        matchedExistingId: duplicate.id ?? null,
        reasons: ["Admin should link to the canonical record or reject this candidate instead of creating a duplicate."],
        vehicleKey,
      }));
    }

    const aliasMatched = [
      normalizeBrandName(candidate.brand).aliasMatched ? "brand" : null,
      normalizeModelName(candidate.brand, candidate.model).aliasMatched ? "model" : null,
      normalizeGenerationName(candidate.brand, candidate.model, candidate.generation).aliasMatched ? "generation" : null,
      normalizeEngineName(candidate.engineDisplayName).aliasMatched ? "engine" : null,
    ].filter((value): value is string => Boolean(value));
    sourceMappings.push({
      source: {
        brand: candidate.brand,
        model: candidate.model,
        generation: group.includedEntries[0]?.rawGeneration ?? group.includedEntries[0]?.rawTitle ?? group.customerDisplayLabel,
        engine: candidate.engineDisplayName,
      },
      canonical: {
        brand: candidate.brand,
        model: candidate.model,
        generation: candidate.generation,
        engine: candidate.engineDisplayName,
        vehicleKey,
      },
      aliasMatched,
      action: gap?.matchedExistingEngine ? "reuse_existing" : gap?.conflictingValues.length ? "review_conflict" : "create_draft",
      reasons: gap?.reasons ?? [],
    });
  }

  for (const [vehicleKey, ids] of candidateVehicleKeys.entries()) {
    if (ids.length < 2) continue;
    addUnique(duplicateRisks, vehicleKey);
    const candidate = input.engineCandidates.find((item) => ids.includes(item.id));
    const group = candidate ? input.groups.find((item) => item.id === candidate.generationGroupId) : null;
    if (candidate && group) {
      issues.push(issue({
        type: "vehicle_key_collision",
        severity: "error",
        group,
        candidate,
        input: input.source,
        action: "reject_duplicate",
        message: "Multiple external candidates resolve to the same canonical vehicleKey.",
        reasons: ["Do not import duplicate external candidates; admin must pick or correct the canonical winner."],
        vehicleKey,
      }));
    }
  }

  const aliasKeySet = new Set<string>();
  const uniqueAliases = aliasSuggestions.filter((item) => {
    const key = `${item.entityType}:${item.brand ?? ""}:${item.model ?? ""}:${item.sourceName}:${item.normalizedKey}`;
    if (aliasKeySet.has(key)) return false;
    aliasKeySet.add(key);
    return true;
  });

  stats.missingBrands = missingBrands.size;
  stats.missingModels = missingModels.size;
  stats.missingGenerations = missingGenerations.size;
  stats.missingEngines = missingEngines.size;
  stats.outdatedYearRanges = outdatedRanges.size;
  stats.aliasSuggestions = uniqueAliases.length;
  stats.duplicateRisks = duplicateRisks.size;
  stats.conflicts = conflicts.size;
  stats.protectedVerifiedConflicts = protectedConflicts.size;
  stats.lowConfidenceCandidates = lowConfidence.size;
  stats.needsReview = needsReview.size;
  stats.alreadyMatched = alreadyMatched.size;

  return {
    stats,
    issues,
    aliasSuggestions: uniqueAliases,
    reviewQueue,
    sourceMappings,
  };
}
