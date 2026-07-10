import { normalizeToken } from "@/lib/vehicleControl/normalization";
import type { ExternalVehicleEntry, NormalizedEngineCandidate, NormalizedGenerationGroup } from "@/lib/vehicleEnrichment/types";
import { createStage1DraftEstimate } from "@/lib/vehicleEnrichment/stageEstimate";

const KW_TO_HP = 1.34102;

function cleanNumber(value: string) {
  return Number(value.replace(/\s+/g, "").replace(",", "."));
}

export function parseHorsepower(text: string | null | undefined) {
  const value = text ?? "";
  const hpMatch = value.match(/\b(\d{2,4}(?:[.,]\d+)?)\s*(?:hp|ps|bhp|cv)\b/i);
  if (hpMatch) return { hp: Math.round(cleanNumber(hpMatch[1])), kw: null };
  const kwMatch = value.match(/\b(\d{2,4}(?:[.,]\d+)?)\s*kW\b/i);
  if (kwMatch) {
    const kw = Math.round(cleanNumber(kwMatch[1]));
    return { hp: Math.round(kw * KW_TO_HP), kw };
  }
  return { hp: null, kw: null };
}

export function parseTorqueNm(text: string | null | undefined) {
  const match = (text ?? "").match(/\b(\d{2,5}(?:[.,]\d+)?)\s*Nm\b/i);
  return match ? Math.round(cleanNumber(match[1])) : null;
}

export function parseDisplacementCcFromText(text: string | null | undefined) {
  const value = text ?? "";
  const cc = value.match(/\b(\d{3,5})\s*(?:cm3|cm³|ccm|cc)\b/i);
  if (cc) return Number(cc[1]);
  const liters = value.match(/\b(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:l|liter|litre)\b/i);
  if (!liters) return null;
  const parsed = cleanNumber(liters[1]);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 20) return null;
  return Math.round(parsed * 1000);
}

export function parseEngineCode(text: string | null | undefined) {
  const value = text ?? "";
  const explicit = value.match(/(?:engine\s*(?:model\/)?code|engine\s*model|code)\s*:?\s*([A-Z]{1,4}\s?\d{2,4}(?:[.\s-]?\d{2,4})?)/i);
  const fallback = value.match(/\b([A-Z]{1,4}\s?\d{2,4}(?:[.\s-]\d{2,4})?)\b/);
  const raw = explicit?.[1] ?? fallback?.[1] ?? null;
  return raw ? raw.toUpperCase().replace(/\s+/g, "") : null;
}

function bestEngineName(entry: ExternalVehicleEntry, stockHp: number | null) {
  const source = entry.engineDisplayName || entry.rawPowerRange || entry.powerText || entry.rawTitle || "Engine";
  const normalized = source
    .replace(/power\s*:?.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized && normalized.length > 2 && !/^engine$/i.test(normalized)) return normalized;
  return stockHp ? `${stockHp}hp` : "Engine option";
}

export function normalizeEngineCandidate(entry: ExternalVehicleEntry, group: NormalizedGenerationGroup): NormalizedEngineCandidate {
  const powerText = [entry.powerText, entry.rawPowerRange, entry.rawTitle, entry.engineDisplayName].filter(Boolean).join(" ");
  const torqueText = [entry.torqueText, entry.rawTitle, entry.engineDisplayName].filter(Boolean).join(" ");
  const displacementText = [entry.displacementText, entry.rawTitle, entry.engineDisplayName].filter(Boolean).join(" ");
  const power = parseHorsepower(powerText);
  const stockNm = parseTorqueNm(torqueText);
  const displacementCc = parseDisplacementCcFromText(displacementText);
  const engineCode = parseEngineCode(entry.engineCodeText);
  const warnings: string[] = [];
  if (power.hp == null) warnings.push("Missing stock HP; keep candidate needs_review.");
  if (stockNm == null) warnings.push("Missing stock NM; keep candidate needs_review.");
  if (!engineCode) warnings.push("Engine code not detected.");
  if (displacementCc == null) warnings.push("Displacement not detected.");

  const stockHp = power.hp;
  const stage1Estimate = createStage1DraftEstimate(stockHp, stockNm);
  const engineDisplayName = bestEngineName(entry, stockHp);
  return {
    id: `${group.id}:${normalizeToken(engineDisplayName)}:${engineCode ?? "no-code"}`,
    generationGroupId: group.id,
    brand: group.brand,
    model: group.model,
    generation: group.customerDisplayLabel,
    engineDisplayName,
    engineCode,
    fuelType: entry.fuelType ?? null,
    displacementCc,
    stockHp,
    stockKw: power.kw,
    stockNm,
    drivetrain: entry.drivetrain ?? null,
    transmission: entry.transmission ?? null,
    hybridType: entry.hybridType ?? null,
    bodyVariantAvailability: group.bodyVariants,
    yearFrom: group.yearFrom,
    yearTo: group.yearTo,
    sourceUrl: entry.sourceUrl ?? null,
    services: ["stage1"],
    stage1Estimate,
    confidenceScore: Math.max(25, Math.min(85, 45 + (stockHp ? 10 : 0) + (stockNm ? 10 : 0) + (engineCode ? 10 : 0) + (displacementCc ? 10 : 0))),
    reviewStatus: "needs_review",
    warnings,
  };
}
