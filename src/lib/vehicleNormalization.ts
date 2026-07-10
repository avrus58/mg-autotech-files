export type NormalizedName = {
  sourceName: string;
  canonicalName: string;
  normalizedKey: string;
  aliasMatched: boolean;
  matchedAlias?: string | null;
};

export type AliasCandidate = NormalizedName & {
  entityType: "brand" | "model" | "generation" | "engine";
};

const brandAliases: Record<string, { canonicalName: string; aliases: string[] }> = {
  "mercedes-benz": {
    canonicalName: "Mercedes-Benz",
    aliases: ["mercedes", "mercedes-benz", "mercedes benz", "mb"],
  },
  bmw: {
    canonicalName: "BMW",
    aliases: ["bmw", "bayerische motoren werke"],
  },
  volkswagen: {
    canonicalName: "Volkswagen",
    aliases: ["volkswagen", "vw"],
  },
};

const mercedesModelAliases: Record<string, { canonicalName: string; aliases: string[] }> = {
  a: { canonicalName: "A", aliases: ["a", "a-class", "a klasse", "a-klasse"] },
  b: { canonicalName: "B", aliases: ["b", "b-class", "b klasse", "b-klasse"] },
  c: { canonicalName: "C", aliases: ["c", "c-class", "c klasse", "c-klasse"] },
  e: { canonicalName: "E", aliases: ["e", "e-class", "e klasse", "e-klasse"] },
  s: { canonicalName: "S", aliases: ["s", "s-class", "s klasse", "s-klasse"] },
  g: { canonicalName: "G", aliases: ["g", "g-class", "g klasse", "g-klasse"] },
  gla: { canonicalName: "GLA", aliases: ["gla", "gla-class"] },
  glb: { canonicalName: "GLB", aliases: ["glb", "glb-class"] },
  glc: { canonicalName: "GLC", aliases: ["glc", "glc-class"] },
  gle: { canonicalName: "GLE", aliases: ["gle", "gle-class"] },
  gls: { canonicalName: "GLS", aliases: ["gls", "gls-class"] },
  cla: { canonicalName: "CLA", aliases: ["cla", "cla-class"] },
  cls: { canonicalName: "CLS", aliases: ["cls", "cls-class"] },
  clk: { canonicalName: "CLK", aliases: ["clk", "clk-class"] },
  cl: { canonicalName: "CL", aliases: ["cl", "cl-class"] },
};

const brandAliasLookup = buildAliasLookup(brandAliases);
const mercedesModelAliasLookup = buildAliasLookup(mercedesModelAliases);
const PLATFORM_CODE_RE = /\b([A-Z])\s?(\d{3,4})\b/g;

function buildAliasLookup(config: Record<string, { canonicalName: string; aliases: string[] }>) {
  const map = new Map<string, { canonicalKey: string; canonicalName: string; alias: string }>();
  for (const [canonicalKey, item] of Object.entries(config)) {
    for (const alias of item.aliases) {
      map.set(normalizeText(alias), { canonicalKey, canonicalName: item.canonicalName, alias });
    }
  }
  return map;
}

export function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function fromAlias(sourceName: string, fallbackDisplay: string, lookup: Map<string, { canonicalKey: string; canonicalName: string; alias: string }>): NormalizedName {
  const normalizedSource = normalizeText(sourceName);
  const match = lookup.get(normalizedSource);
  if (match) {
    return {
      sourceName,
      canonicalName: match.canonicalName,
      normalizedKey: match.canonicalKey,
      aliasMatched: normalizedSource !== match.canonicalKey || fallbackDisplay !== match.canonicalName,
      matchedAlias: match.alias,
    };
  }
  return {
    sourceName,
    canonicalName: fallbackDisplay,
    normalizedKey: normalizedSource,
    aliasMatched: false,
    matchedAlias: null,
  };
}

export function normalizeBrandName(brand: string | null | undefined): NormalizedName {
  const sourceName = (brand ?? "").trim();
  return fromAlias(sourceName, sourceName, brandAliasLookup);
}

export function normalizeModelName(brand: string | null | undefined, model: string | null | undefined): NormalizedName {
  const sourceName = (model ?? "").trim();
  if (normalizeBrandName(brand).normalizedKey === "mercedes-benz") {
    return fromAlias(sourceName, sourceName, mercedesModelAliasLookup);
  }
  return {
    sourceName,
    canonicalName: sourceName,
    normalizedKey: normalizeText(sourceName),
    aliasMatched: false,
    matchedAlias: null,
  };
}

function sortPlatformCodes(codes: string[]) {
  const order = ["W", "S", "V", "G", "F", "C", "A"];
  return [...new Set(codes)].sort((left, right) => {
    const leftRank = order.includes(left[0]) ? order.indexOf(left[0]) : order.length;
    const rightRank = order.includes(right[0]) ? order.indexOf(right[0]) : order.length;
    return leftRank - rightRank || Number(left.slice(1)) - Number(right.slice(1)) || left.localeCompare(right);
  });
}

function extractPlatformCodes(text: string | null | undefined) {
  return [...(text ?? "").toUpperCase().matchAll(PLATFORM_CODE_RE)].map((match) => `${match[1]}${match[2]}`);
}

function extractYearRange(text: string) {
  const years = [...text.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map((match) => Number(match[1]));
  if (!years.length) return "";
  const yearFrom = Math.min(...years);
  const openEnded = /present|now|current|->|\.\.\./i.test(text) || years.length === 1;
  const yearTo = openEnded ? "present" : String(Math.max(...years));
  return ` (${yearFrom}-${yearTo})`;
}

export function normalizeGenerationName(
  brand: string | null | undefined,
  model: string | null | undefined,
  generation: string | null | undefined
): NormalizedName {
  const sourceName = (generation ?? "").trim();
  const brandName = normalizeBrandName(brand).canonicalName;
  const modelName = normalizeModelName(brand, model).canonicalName;
  let work = removeWord(removeWord(sourceName, brandName), modelName)
    .replace(/\b(class|klasse)\b/ig, " ")
    .replace(/\s+/g, " ")
    .trim();
  const codes = sortPlatformCodes(extractPlatformCodes(work));
  if (codes.length) {
    const range = extractYearRange(sourceName);
    const canonicalName = `${codes.join("/")}${range}`.trim();
    return {
      sourceName,
      canonicalName,
      normalizedKey: normalizeText(canonicalName),
      aliasMatched: normalizeText(canonicalName) !== normalizeText(sourceName),
      matchedAlias: sourceName,
    };
  }
  work = work || sourceName;
  return {
    sourceName,
    canonicalName: work,
    normalizedKey: normalizeText(work),
    aliasMatched: normalizeText(work) !== normalizeText(sourceName),
    matchedAlias: sourceName,
  };
}

export function normalizeEngineName(engine: string | null | undefined): NormalizedName {
  const sourceName = (engine ?? "").trim();
  const canonicalName = sourceName.replace(/\s+/g, " ").trim();
  return {
    sourceName,
    canonicalName,
    normalizedKey: normalizeText(canonicalName),
    aliasMatched: normalizeText(canonicalName) !== normalizeText(sourceName),
    matchedAlias: sourceName,
  };
}

export function buildCanonicalVehicleKey(input: {
  brand: string;
  model: string;
  generation: string;
  engine: string;
  ecuType?: string | null;
}) {
  return [
    normalizeBrandName(input.brand).normalizedKey,
    normalizeModelName(input.brand, input.model).normalizedKey,
    normalizeGenerationName(input.brand, input.model, input.generation).normalizedKey,
    normalizeEngineName(input.engine).normalizedKey,
    normalizeText(input.ecuType ?? ""),
  ].filter(Boolean).join(":");
}

export function resolveAliasCandidate(input: {
  entityType: "brand" | "model" | "generation" | "engine";
  brand?: string | null;
  model?: string | null;
  value: string | null | undefined;
}): AliasCandidate {
  const normalized = (() => {
    if (input.entityType === "brand") return normalizeBrandName(input.value);
    if (input.entityType === "model") return normalizeModelName(input.brand, input.value);
    if (input.entityType === "generation") return normalizeGenerationName(input.brand, input.model, input.value);
    return normalizeEngineName(input.value);
  })();
  return { entityType: input.entityType, ...normalized };
}

export function compareNormalizedNames(input: {
  entityType: "brand" | "model" | "generation" | "engine";
  brand?: string | null;
  model?: string | null;
  left: string | null | undefined;
  right: string | null | undefined;
}) {
  const left = resolveAliasCandidate({ entityType: input.entityType, brand: input.brand, model: input.model, value: input.left });
  const right = resolveAliasCandidate({ entityType: input.entityType, brand: input.brand, model: input.model, value: input.right });
  return {
    equal: left.normalizedKey === right.normalizedKey,
    left,
    right,
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removeWord(source: string, word: string) {
  if (!word.trim()) return source;
  return source.replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, "ig"), " ");
}
