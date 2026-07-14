import type {
  DtcActiveCodeNormalizationResult,
  DtcActiveRiskCategory,
  NormalizedActiveDtcCode,
  RejectedActiveDtcCode,
} from "@/lib/dtcActive/types";

export const maxActiveDtcCodes = 8;
const activeDtcPattern = /^[PBCU][0-9A-F]{4}$/;
const tokenPattern = /\b[PBCU][0-9A-Z]{4,6}\b/gi;

const emissionsCodes = new Set(["P0401", "P0402", "P0420", "P2002", "P2453"]);
const safetyCodes = new Set(["P0087"]);
const powertrainProtectionCodes = new Set(["P0217", "P0234", "P0300", "P0315"]);
const securityCodePrefixes = ["B10", "B11", "U01"];

export function parseActiveDtcCode(raw: string): NormalizedActiveDtcCode | RejectedActiveDtcCode {
  const normalized = raw.trim().toUpperCase();
  if (!activeDtcPattern.test(normalized)) {
    return { raw, valid: false, reason: "malformed" };
  }

  return {
    raw,
    code: normalized,
    valid: true,
    system: systemForCode(normalized),
    namespace: namespaceForCode(normalized),
    riskCategory: classifyActiveDtcRisk(normalized),
    requiresManualReview: classifyActiveDtcRisk(normalized) !== "ordinary_non_restricted",
  };
}

export function normalizeActiveDtcCodes(
  input: string | readonly string[],
  maxCodes = maxActiveDtcCodes
): DtcActiveCodeNormalizationResult {
  const rawTokens = typeof input === "string"
    ? Array.from(input.matchAll(tokenPattern), (match) => match[0])
    : [...input];
  const codes: NormalizedActiveDtcCode[] = [];
  const rejected: RejectedActiveDtcCode[] = [];
  const seen = new Set<string>();

  for (const token of rawTokens) {
    const parsed = parseActiveDtcCode(token);
    if (!parsed.valid) {
      rejected.push(parsed);
      continue;
    }
    if (seen.has(parsed.code)) continue;
    if (codes.length >= maxCodes) {
      rejected.push({ raw: parsed.code, valid: false, reason: "too_many_codes" });
      continue;
    }
    seen.add(parsed.code);
    codes.push(parsed);
  }

  return { codes, rejected, maxCodes };
}

export function classifyActiveDtcRisk(code: string): DtcActiveRiskCategory {
  const normalized = code.trim().toUpperCase();
  if (emissionsCodes.has(normalized)) return "emissions_and_regulatory";
  if (safetyCodes.has(normalized)) return "safety_critical";
  if (powertrainProtectionCodes.has(normalized)) return "powertrain_protection";
  if (securityCodePrefixes.some((prefix) => normalized.startsWith(prefix))) {
    return "security_related";
  }
  if (!activeDtcPattern.test(normalized)) return "unknown";
  if (normalized[1] !== "0") return "unknown";
  return "ordinary_non_restricted";
}

function systemForCode(code: string): NormalizedActiveDtcCode["system"] {
  if (code.startsWith("P")) return "powertrain";
  if (code.startsWith("B")) return "body";
  if (code.startsWith("C")) return "chassis";
  return "network";
}

function namespaceForCode(code: string): NormalizedActiveDtcCode["namespace"] {
  if (code[1] === "0") return "generic";
  if (code[1] === "1") return "manufacturer_specific";
  return "reserved_or_mixed";
}
