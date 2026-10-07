// Keep route eligibility tiny: client navigation must not import guide prose.
export const serviceIntentGuideSlugs = [
  "stage-2",
  "stage-3",
  "tcu-tuning",
  "ecu-file-check",
] as const;

export type ServiceIntentGuideSlug = (typeof serviceIntentGuideSlugs)[number];

export function isServiceIntentGuideSlug(value: string): value is ServiceIntentGuideSlug {
  return serviceIntentGuideSlugs.includes(value as ServiceIntentGuideSlug);
}
