import type { NegativeExampleType } from "@/lib/aiFileIntelligence/datasetImport";

export type NegativeLearningExample = {
  id: string;
  negative_type: NegativeExampleType;
  service_labels: string[];
  reason: string;
  human_confirmed: boolean;
  active: boolean;
};

export function negativeTrustWarning(examples: NegativeLearningExample[], input: {
  serviceLabels: string[];
  fingerprint?: string | null;
}) {
  const active = examples.filter((example) => example.active && example.human_confirmed);
  const related = active.filter((example) => example.service_labels.some((label) => input.serviceLabels.includes(label)));
  return {
    has_warning: related.length > 0,
    warnings: related.map((example) => `${example.negative_type}: ${example.reason}`),
    trust_penalty: Math.min(40, related.length * 10),
  };
}
