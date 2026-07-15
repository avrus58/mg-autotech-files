import {
  ecuIntelligenceServiceCategories,
  type EcuIntelligenceServiceCategory,
  type EcuIntelligenceServiceInput,
} from "@/lib/ecuIntelligence/center/types";
import { trainingFeatureKeys, type TrainingFeature, type TrainingServiceLabels } from "@/lib/ecuIntelligence/types";

const featureToCategory: Record<TrainingFeature, EcuIntelligenceServiceCategory> = {
  stage1: "stage_1",
  stage2: "stage_2",
  stage3: "stage_3",
  dpf_off: "dpf",
  egr_off: "egr",
  adblue_off: "adblue",
  dtc_off: "dtc",
  vmax_off: "vmax",
  pop_bangs: "pops_bangs",
  tcu_tune: "tcu",
  tcu_shift: "tcu",
  tcu_lockup: "tcu",
};

const serviceAliases = new Map<string, EcuIntelligenceServiceCategory>([
  ["stage1", "stage_1"],
  ["stage_1", "stage_1"],
  ["stg1", "stage_1"],
  ["stage2", "stage_2"],
  ["stage_2", "stage_2"],
  ["stg2", "stage_2"],
  ["stage3", "stage_3"],
  ["stage_3", "stage_3"],
  ["stg3", "stage_3"],
  ["dtc", "dtc"],
  ["dtcoff", "dtc"],
  ["dtc_off", "dtc"],
  ["dpf", "dpf"],
  ["dpfoff", "dpf"],
  ["dpf_off", "dpf"],
  ["egr", "egr"],
  ["egroff", "egr"],
  ["egr_off", "egr"],
  ["adblue", "adblue"],
  ["adblueoff", "adblue"],
  ["adblue_off", "adblue"],
  ["scr", "adblue"],
  ["scroff", "adblue"],
  ["swirl", "swirl"],
  ["swirlflap", "swirl"],
  ["tva", "tva"],
  ["vmax", "vmax"],
  ["vmaxoff", "vmax"],
  ["speedlimit", "vmax"],
  ["startstop", "start_stop"],
  ["start_stop", "start_stop"],
  ["hotstart", "hot_start"],
  ["hot_start", "hot_start"],
  ["coldstart", "cold_start"],
  ["cold_start", "cold_start"],
  ["launchcontrol", "launch_control"],
  ["launch_control", "launch_control"],
  ["popsbangs", "pops_bangs"],
  ["popbangs", "pops_bangs"],
  ["pop_bangs", "pops_bangs"],
  ["burble", "pops_bangs"],
  ["torque", "torque"],
  ["tcptune", "tcu"],
  ["tcu_tune", "tcu"],
  ["tcushift", "tcu"],
  ["tcu_shift", "tcu"],
  ["tculockup", "tcu"],
  ["tcu_lockup", "tcu"],
  ["gearbox", "tcu"],
  ["boost", "boost"],
  ["railpressure", "rail_pressure"],
  ["rail_pressure", "rail_pressure"],
  ["lambda", "lambda"],
]);

function normalizedLabel(value: unknown) {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/[\s/-]+/g, "_").replace(/[^a-z0-9_]/g, "")
    : "";
}

function compactLabel(value: unknown) {
  return normalizedLabel(value).replace(/_/g, "");
}

export function normalizeServiceLabel(value: unknown): {
  category: EcuIntelligenceServiceCategory;
  original: string;
  known: boolean;
} {
  const original = typeof value === "string" ? value.trim() : "";
  const normalized = normalizedLabel(value);
  const compact = compactLabel(value);
  const category = serviceAliases.get(normalized) || serviceAliases.get(compact);
  if (category) return { category, original: original || category, known: true };
  if (ecuIntelligenceServiceCategories.includes(normalized as EcuIntelligenceServiceCategory)) {
    return { category: normalized as EcuIntelligenceServiceCategory, original: original || normalized, known: true };
  }
  return { category: original ? "unknown" : "unknown", original: original || "unknown", known: false };
}

export function normalizeDtcCodes(value: unknown) {
  const source = Array.isArray(value) ? value.join(" ") : typeof value === "string" ? value : "";
  const matches = source.toUpperCase().match(/\b[PCBU][0-9A-F]{4}\b/g);
  return [...new Set(matches || [])].slice(0, 120);
}

function labelsFromTrainingObject(labels: Partial<TrainingServiceLabels> | Record<string, unknown> | null | undefined) {
  const categories: EcuIntelligenceServiceCategory[] = [];
  const unknownLabels: string[] = [];
  if (!labels || typeof labels !== "object" || Array.isArray(labels)) return { categories, unknownLabels };

  for (const [key, enabled] of Object.entries(labels)) {
    if (!enabled) continue;
    if ((trainingFeatureKeys as readonly string[]).includes(key)) {
      categories.push(featureToCategory[key as TrainingFeature]);
      continue;
    }
      const normalized = normalizeServiceLabel(key);
      if (normalized.known) categories.push(normalized.category);
      else {
        categories.push("unknown");
        unknownLabels.push(normalized.original);
      }
  }
  return { categories, unknownLabels };
}

export function normalizeServiceEvidence(input: EcuIntelligenceServiceInput): {
  categories: EcuIntelligenceServiceCategory[];
  unknownLabels: string[];
  exactDtcCodes: string[];
} {
  const categories: EcuIntelligenceServiceCategory[] = [];
  const unknownLabels: string[] = [];

  if (Array.isArray(input.labels)) {
    for (const label of input.labels) {
      const normalized = normalizeServiceLabel(label);
      if (normalized.known) categories.push(normalized.category);
      else {
        categories.push("unknown");
        unknownLabels.push(normalized.original);
      }
    }
  } else if (typeof input.labels === "string") {
    const normalized = normalizeServiceLabel(input.labels);
    if (normalized.known) categories.push(normalized.category);
    else {
      categories.push("unknown");
      unknownLabels.push(normalized.original);
    }
  } else {
    const fromObject = labelsFromTrainingObject(input.labels);
    categories.push(...fromObject.categories);
    unknownLabels.push(...fromObject.unknownLabels);
  }

  const textCodes = normalizeDtcCodes(input.sourceText);
  const exactDtcCodes = [...new Set([...normalizeDtcCodes(input.exactDtcCodes), ...textCodes])];
  if (exactDtcCodes.length) categories.push("dtc");

  return {
    categories: [...new Set<EcuIntelligenceServiceCategory>(categories.length ? categories : ["unknown"])],
    unknownLabels: [...new Set(unknownLabels.filter(Boolean))],
    exactDtcCodes,
  };
}

export function trainingFeatureForCategory(category: EcuIntelligenceServiceCategory) {
  return Object.entries(featureToCategory)
    .filter(([, mapped]) => mapped === category)
    .map(([feature]) => feature as TrainingFeature);
}
