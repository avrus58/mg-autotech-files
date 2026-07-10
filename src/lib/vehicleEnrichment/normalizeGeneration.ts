import { normalizeToken } from "@/lib/vehicleControl/normalization";
import type {
  BodyVariantSummary,
  ExcludedExternalEntry,
  ExternalVehicleEntry,
  NormalizedGenerationGroup,
  VehicleEnrichmentScopeOptions,
} from "@/lib/vehicleEnrichment/types";
import { isCurrentOrModernEntry, parseExternalYearRange } from "@/lib/vehicleEnrichment/scopeRules";

const PLATFORM_CODE_RE = /\b[A-Z]\d{3}\b/g;

export function extractPlatformCodes(text: string | null | undefined) {
  return [...new Set(((text ?? "").toUpperCase().match(PLATFORM_CODE_RE) ?? []))];
}

function inferBodyLabel(entry: ExternalVehicleEntry, code: string | null) {
  const source = [entry.rawBodyType, entry.rawTitle, entry.rawGeneration].filter(Boolean).join(" ");
  if (/all[\s-]*terrain/i.test(source)) return `${code ? `${code} ` : ""}All-Terrain`.trim();
  if (/t-modell|estate|wagon|touring|avant/i.test(source)) return `${code ? `${code} ` : ""}Estate / T-Modell`.trim();
  if (/long|lwb/i.test(source)) return `${code ? `${code} ` : ""}Long wheelbase`.trim();
  if (/coupe/i.test(source)) return `${code ? `${code} ` : ""}Coupe`.trim();
  if (/cabrio|convertible/i.test(source)) return `${code ? `${code} ` : ""}Cabrio`.trim();
  if (/sedan|saloon|limousine|class\b/i.test(source)) return `${code ? `${code} ` : ""}Sedan`.trim();
  return code ? `${code} variant` : (entry.rawBodyType || entry.rawTitle || "Variant");
}

function platformFamilyKey(codes: string[]) {
  const sorted = sortPlatformCodes(codes);
  if (sorted.some((code) => ["W214", "S214", "V214"].includes(code))) return "W214/S214/V214";
  if (sorted.some((code) => ["W213", "S213", "C238", "A238"].includes(code))) return sorted.includes("W213") || sorted.includes("S213") ? "W213/S213" : "C238/A238";
  return sorted.join("/") || "unknown-platform";
}

function sortPlatformCodes(codes: string[]) {
  const rank = (code: string) => {
    const prefix = code[0];
    const order = ["W", "S", "V", "G", "F", "C", "A"];
    const prefixRank = order.includes(prefix) ? order.indexOf(prefix) : order.length;
    const number = Number(code.slice(1)) || 9999;
    return prefixRank * 10000 + number;
  };
  return [...codes].sort((left, right) => rank(left) - rank(right) || left.localeCompare(right));
}

function customerLabelFromCodes(codes: string[], yearFrom: number | null, yearTo: number | null) {
  const labelCodes = sortPlatformCodes(codes).join("/");
  const range = yearFrom ? ` (${yearFrom}-${yearTo ?? "present"})` : "";
  return `${labelCodes || "Current generation"}${range}`;
}

function bodyVariant(entry: ExternalVehicleEntry): BodyVariantSummary {
  const codes = extractPlatformCodes([entry.rawTitle, entry.rawGeneration].filter(Boolean).join(" "));
  const years = parseExternalYearRange(entry);
  const code = codes[0] ?? null;
  return {
    code,
    label: inferBodyLabel(entry, code),
    bodyType: entry.rawBodyType ?? null,
    yearFrom: years.yearFrom,
    yearTo: years.yearTo,
    sourceUrl: entry.sourceUrl ?? null,
  };
}

export function normalizeGenerationGroups(entries: ExternalVehicleEntry[], options: VehicleEnrichmentScopeOptions = {}) {
  const accepted: ExternalVehicleEntry[] = [];
  const skippedOld: ExcludedExternalEntry[] = [];
  for (const entry of entries) {
    const scope = isCurrentOrModernEntry(entry, options);
    if (scope.accepted) accepted.push(entry);
    else skippedOld.push({ entry, reason: scope.reason });
  }

  const currentFamilyTargets = new Set(
    accepted
      .filter((entry) => platformFamilyKey(extractPlatformCodes([entry.rawTitle, entry.rawGeneration].filter(Boolean).join(" "))) === "W214/S214/V214")
      .map((entry) => `${normalizeToken(entry.brand)}:${normalizeToken(entry.model)}`)
  );

  const buckets = new Map<string, ExternalVehicleEntry[]>();
  for (const entry of accepted) {
    const codes = extractPlatformCodes([entry.rawTitle, entry.rawGeneration].filter(Boolean).join(" "));
    const brandModel = `${normalizeToken(entry.brand)}:${normalizeToken(entry.model)}`;
    if (currentFamilyTargets.has(brandModel) && platformFamilyKey(codes) === "C238/A238") {
      skippedOld.push({
        entry,
        reason: "Excluded from current W214/S214/V214 group because C238/A238 is a previous/different platform family.",
      });
      continue;
    }
    const key = `${normalizeToken(entry.brand)}:${normalizeToken(entry.model)}:${platformFamilyKey(codes)}`;
    buckets.set(key, [...(buckets.get(key) ?? []), entry]);
  }

  const groups: NormalizedGenerationGroup[] = [];
  for (const [key, bucketEntries] of buckets.entries()) {
    const allCodes = sortPlatformCodes([...new Set(bucketEntries.flatMap((entry) => extractPlatformCodes([entry.rawTitle, entry.rawGeneration].filter(Boolean).join(" "))))]);
    const family = platformFamilyKey(allCodes);
    const includedEntries = bucketEntries.filter((entry) => {
      const codes = extractPlatformCodes([entry.rawTitle, entry.rawGeneration].filter(Boolean).join(" "));
      return platformFamilyKey(codes) === family;
    });
    const excludedEntries: ExcludedExternalEntry[] = [
      ...bucketEntries.filter((entry) => !includedEntries.includes(entry)).map((entry) => ({ entry, reason: "Different platform family." })),
      ...skippedOld.filter((item) => normalizeToken(item.entry.brand) === normalizeToken(bucketEntries[0]?.brand) && normalizeToken(item.entry.model) === normalizeToken(bucketEntries[0]?.model)),
    ];
    const years = includedEntries.map(parseExternalYearRange);
    const yearFromValues = years.map((year) => year.yearFrom).filter((value): value is number => value != null);
    const yearToValues = years.map((year) => year.yearTo).filter((value): value is number => value != null);
    const yearFrom = yearFromValues.length ? Math.min(...yearFromValues) : null;
    const yearTo = years.some((year) => year.yearTo == null) ? null : (yearToValues.length ? Math.max(...yearToValues) : null);
    const bodyVariants = includedEntries.map(bodyVariant);
    const brand = includedEntries[0]?.brand ?? bucketEntries[0]?.brand ?? "";
    const model = includedEntries[0]?.model ?? bucketEntries[0]?.model ?? "";
    const customerDisplayLabel = customerLabelFromCodes(allCodes, yearFrom, yearTo);
    groups.push({
      id: key,
      brand,
      model,
      internalGenerationLabel: `${brand} ${model} ${customerDisplayLabel}`.replace(/\s+/g, " ").trim(),
      customerDisplayLabel,
      yearFrom,
      yearTo,
      platformCodes: allCodes,
      bodyVariants,
      includedEntries,
      excludedEntries,
      confidenceScore: Math.max(40, Math.min(90, 55 + allCodes.length * 5 + bodyVariants.length * 2 - excludedEntries.length * 4)),
      reviewStatus: "needs_review",
      notes: [
        "External source normalized into MG AutoTech generation structure.",
        "Body variants are metadata; they are not separate customer-facing generations.",
      ],
    });
  }
  return { groups, skippedOld };
}
