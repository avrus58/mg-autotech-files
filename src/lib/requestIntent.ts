export const requestIntentDefinitions = {
  stage_1: {
    mainServiceId: "stage_1",
    extraServiceIds: [],
    openCategoryIds: [],
  },
  stage_2: {
    mainServiceId: "stage_2",
    extraServiceIds: [],
    openCategoryIds: [],
  },
  stage_3: {
    mainServiceId: "stage_3",
    extraServiceIds: [],
    openCategoryIds: [],
  },
  tcu_stage_1: {
    mainServiceId: "tcu_stage_1",
    extraServiceIds: [],
    openCategoryIds: [],
  },
  dpf_off: {
    mainServiceId: "only_options",
    extraServiceIds: ["dpf_off"],
    openCategoryIds: ["emissions"],
  },
  egr_off: {
    mainServiceId: "only_options",
    extraServiceIds: ["egr_off"],
    openCategoryIds: ["emissions"],
  },
  adblue_off: {
    mainServiceId: "only_options",
    extraServiceIds: ["adblue_off"],
    openCategoryIds: ["emissions"],
  },
  dtc_off: {
    mainServiceId: "only_options",
    extraServiceIds: ["dtc_off"],
    openCategoryIds: ["diagnostics"],
  },
  file_check: {
    mainServiceId: "only_options",
    extraServiceIds: ["file_check"],
    openCategoryIds: ["diagnostics"],
  },
} as const;

export type RequestIntent = keyof typeof requestIntentDefinitions;

const publicServiceRequestIntents = {
  "stage-1": "stage_1",
  "stage-2": "stage_2",
  "stage-3": "stage_3",
  "tcu-tuning": "tcu_stage_1",
  "ecu-file-check": "file_check",
  "dpf-off": "dpf_off",
  "egr-off": "egr_off",
  "adblue-off": "adblue_off",
  "dtc-off": "dtc_off",
} as const satisfies Record<string, RequestIntent>;

export function parseRequestIntent(value: string | null | undefined): RequestIntent | null {
  if (!value) return null;
  return Object.prototype.hasOwnProperty.call(requestIntentDefinitions, value)
    ? (value as RequestIntent)
    : null;
}

export function getRequestIntentSelection(intent: RequestIntent) {
  return requestIntentDefinitions[intent];
}

export function getPublicServiceRequestIntent(slug: string): RequestIntent | null {
  return Object.prototype.hasOwnProperty.call(publicServiceRequestIntents, slug)
    ? publicServiceRequestIntents[slug as keyof typeof publicServiceRequestIntents]
    : null;
}

export function buildNewRequestPath(intent?: RequestIntent | null) {
  return intent ? `/new-request?intent=${encodeURIComponent(intent)}` : "/new-request";
}
