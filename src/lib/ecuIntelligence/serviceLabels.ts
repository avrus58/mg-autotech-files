import {
  emptyTrainingServiceLabels,
  type TrainingFeature,
  type TrainingServiceLabels,
} from "@/lib/ecuIntelligence/types";

const featurePatterns: Record<TrainingFeature, RegExp[]> = {
  stage1: [/\bstage\s*1\b/i, /\bstg\s*1\b/i],
  stage2: [/\bstage\s*2\b/i, /\bstg\s*2\b/i],
  stage3: [/\bstage\s*3\b/i, /\bstg\s*3\b/i],
  dpf_off: [/\bdpf\s*(off|delete|remove|removal|deactivation)\b/i],
  egr_off: [/\begr\s*(off|delete|remove|removal|deactivation)\b/i],
  adblue_off: [/\b(adblue|scr)\s*(off|delete|remove|removal|deactivation)\b/i],
  dtc_off: [/\bdtc\s*(off|delete|remove|removal|deactivation)\b/i],
  vmax_off: [/\b(vmax|speed\s*limit)\s*(off|remove|removal|delete|deactivation)\b/i],
  pop_bangs: [/\b(pop(s)?\s*(&|and)?\s*bangs?|burble)\b/i],
  tcu_tune: [/\b(tcu|gearbox|transmission)\s*(tune|tuning|stage)\b/i],
  tcu_shift: [/\b(shift|shifting)\s*(optimization|optimisation|tune|speed)\b/i],
  tcu_lockup: [/\b(lock[ -]?up|converter)\s*(tune|tuning|optimization|optimisation)\b/i],
};

export function parseTrainingServiceLabels(value: string | null | undefined): TrainingServiceLabels {
  const labels = emptyTrainingServiceLabels();
  if (!value) return labels;

  for (const [feature, patterns] of Object.entries(featurePatterns) as Array<
    [TrainingFeature, RegExp[]]
  >) {
    labels[feature] = patterns.some((pattern) => pattern.test(value));
  }
  return labels;
}

export function activeTrainingServiceLabels(labels: Partial<TrainingServiceLabels> | null | undefined) {
  return (Object.keys(featurePatterns) as TrainingFeature[]).filter((feature) => labels?.[feature]);
}
