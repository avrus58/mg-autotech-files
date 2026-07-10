import type { VehicleControlRecord } from "@/lib/vehicleControl/types";
import type { VehicleEnrichmentInput, VehicleEnrichmentPlan } from "@/lib/vehicleEnrichment/types";
import { DEFAULT_MODERN_YEAR_CUTOFF } from "@/lib/vehicleEnrichment/scopeRules";
import { normalizeGenerationGroups } from "@/lib/vehicleEnrichment/normalizeGeneration";
import { normalizeEngineCandidate } from "@/lib/vehicleEnrichment/normalizeEngine";
import { analyzeVehicleEnrichmentGaps } from "@/lib/vehicleEnrichment/gapAnalysis";
import { buildExternalCoverageReport } from "@/lib/vehicleEnrichment/coverage";

export function buildVehicleEnrichmentPlan(input: VehicleEnrichmentInput, existingRecords: VehicleControlRecord[] = []): VehicleEnrichmentPlan {
  const modernOnly = input.modernOnly !== false;
  const yearCutoff = input.yearCutoff ?? DEFAULT_MODERN_YEAR_CUTOFF;
  const entries = input.entries.map((entry) => ({
    ...entry,
    brand: entry.brand || input.brand || "",
    model: entry.model || input.model || "",
    sourceUrl: entry.sourceUrl || input.sourceUrl || null,
  }));
  const { groups, skippedOld } = normalizeGenerationGroups(entries, { modernOnly, yearCutoff });
  const acceptedEntries = groups.reduce((total, group) => total + group.includedEntries.length, 0);
  const engineCandidates = groups.flatMap((group) =>
    group.includedEntries.map((entry) => normalizeEngineCandidate(entry, group))
  );
  const gaps = analyzeVehicleEnrichmentGaps(groups, engineCandidates, existingRecords);
  const coverage = buildExternalCoverageReport({
    source: input,
    groups,
    engineCandidates,
    gaps,
    existingRecords,
  });
  return {
    source: {
      sourceType: input.sourceType,
      sourceName: input.sourceName ?? null,
      sourceUrl: input.sourceUrl ?? null,
      modernOnly,
      yearCutoff,
    },
    totalEntries: entries.length,
    acceptedEntries,
    skippedOldEntries: skippedOld.length,
    generationGroups: groups,
    engineCandidates,
    gaps,
    coverage,
    warnings: [
      "Manual-assisted enrichment only. No broad crawling or anti-bot bypass is performed.",
      "All external data remains draft/needs_review until MG AutoTech verifies and publishes it.",
      "Coverage analysis is global across brands, models, generations and engines; W214 is only one example.",
      ...(skippedOld.length ? [`${skippedOld.length} older/out-of-scope entries were excluded by default.`] : []),
    ],
  };
}
