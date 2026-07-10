import { parseYearRange } from "@/lib/vehicleControl/normalization";
import type { ExternalVehicleEntry, VehicleEnrichmentScopeOptions } from "@/lib/vehicleEnrichment/types";

export const DEFAULT_MODERN_YEAR_CUTOFF = 2020;

export function parseExternalYearRange(entry: Pick<ExternalVehicleEntry, "rawYearRange" | "rawGeneration" | "rawTitle">) {
  const source = [entry.rawYearRange, entry.rawGeneration, entry.rawTitle].filter(Boolean).join(" ");
  return parseYearRange(source);
}

export function isCurrentOrModernEntry(entry: ExternalVehicleEntry, options: VehicleEnrichmentScopeOptions = {}) {
  const modernOnly = options.modernOnly !== false;
  const yearCutoff = options.yearCutoff ?? DEFAULT_MODERN_YEAR_CUTOFF;
  if (!modernOnly) return { accepted: true, reason: "Admin override allows older entries." };

  const source = [entry.rawYearRange, entry.rawGeneration, entry.rawTitle].filter(Boolean).join(" ");
  const years = parseExternalYearRange(entry);
  const hasPresent = /present|current|now|->|\bseit\b|\bfrom\b|\b-\s*$/i.test(source);
  if (hasPresent && (years.yearFrom == null || years.yearFrom >= yearCutoff - 3)) {
    return { accepted: true, reason: "Current/open year range." };
  }
  if (years.yearFrom != null && years.yearFrom >= yearCutoff) {
    return { accepted: true, reason: `Year from ${years.yearFrom} is within modern cutoff.` };
  }
  if (years.yearTo == null && years.yearFrom != null && years.yearFrom >= yearCutoff - 1) {
    return { accepted: true, reason: "Open recent generation." };
  }
  return {
    accepted: false,
    reason: years.yearFrom == null
      ? "Year range missing; keep out of modern-only import until reviewed."
      : `Year ${years.yearFrom} is older than modern cutoff ${yearCutoff}.`,
  };
}
