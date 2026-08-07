import {
  desktopExtraServiceCategories,
  desktopPrimaryServices,
} from "@/lib/desktopUpload/contracts";
import type {
  TuneAdvisorConfidence,
  TuneAdvisorConfidenceReason,
  TuneAdvisorEvidenceItem,
  TuneAdvisorGuidanceItem,
  TuneAdvisorNormalizedService,
  TuneAdvisorProviderIdentity,
  TuneAdvisorReadiness,
  TuneAdvisorRecommendation,
  TuneAdvisorRequest,
  TuneAdvisorResponse,
  TuneAdvisorRiskFlag,
  TuneAdvisorServiceContext,
  TuneAdvisorVehicleContext,
} from "@/lib/tuneAdvisor/types";

export const tuneAdvisorContractVersion = "tune-advisor-v1" as const;
export const tuneAdvisorPromptVersion = "tune-advisor-v1";
export const deterministicTuneAdvisorProviderId = "deterministic_rules" as const;
export const unconfiguredTuneAdvisorProviderId = "unconfigured_tune_advisor_provider";

export const tuneAdvisorBlockedProductionActions = [
  "calibration_byte_patch_generation",
  "customer_ready_mod_export",
  "checksum_approval",
  "flash_safety_approval",
  "legal_suitability_approval",
  "exact_gain_claim",
  "pricing_or_delivery_automation",
] as const;

const safetyBoundaries = [
  "This is request guidance only and does not approve calibration bytes, MOD generation, checksum completion or flash safety.",
  "It does not confirm legal suitability, exact gains, pricing, delivery automation or unsupported tuning promises.",
  "Human tuner review is required before any write-ready file action.",
];

const allExtraServices = desktopExtraServiceCategories.flatMap((category) =>
  category.services.map((service) => ({
    ...service,
    categoryId: category.id,
    categoryTitle: category.title,
  }))
);

const primaryKeywordMap = [
  { id: "only_options", patterns: [/\bonly\s+options\b/i, /\boptions\s+only\b/i] },
  { id: "stage_1", patterns: [/\bstage\s*1\b/i, /\bstage1\b/i] },
  { id: "stage_2", patterns: [/\bstage\s*2\b/i, /\bstage2\b/i] },
  { id: "stage_3", patterns: [/\bstage\s*3\b/i, /\bstage3\b/i] },
  { id: "eco_tuning", patterns: [/\beco\s+tuning\b/i, /\beco\b/i, /\beconomy\b/i] },
  { id: "tcu_tuning", patterns: [/\btcu\s+tuning\b/i, /\btcu\b/i, /\bgearbox\b/i, /\btransmission\b/i] },
  { id: "original_file", patterns: [/\boriginal\s+file\b/i, /\bstock\s+file\b/i] },
] as const;

const extraKeywordMap: Array<{ id: string; patterns: RegExp[] }> = [
  { id: "dpf_off", patterns: [/\bdpf\b/i] },
  { id: "egr_off", patterns: [/\begr\b/i, /\bagr\b/i] },
  { id: "adblue_off", patterns: [/\badblue\b/i, /\bscr\b/i] },
  { id: "dpf_egr_off", patterns: [/\bdpf\s*\+\s*egr\b/i] },
  { id: "dpf_egr_adblue_off", patterns: [/\bdpf\s*\+\s*egr\s*\+\s*adblue\b/i] },
  { id: "opf_gpf_off", patterns: [/\bopf\b/i, /\bgpf\b/i] },
  { id: "nox_off", patterns: [/\bnox\b/i] },
  { id: "dtc_off", patterns: [/\bdtc\s*(off|removal)\b/i, /\bclear\s+code\b/i] },
  { id: "checksum", patterns: [/\bchecksum\b/i] },
  { id: "file_check", patterns: [/\bfile\s+check\b/i] },
  { id: "file_expertise", patterns: [/\bfile\s+expertise\b/i] },
  { id: "readout_verification", patterns: [/\breadout\s+verification\b/i] },
  { id: "software_version_check", patterns: [/\bsoftware\s+version\b/i, /\bsw\s+version\b/i] },
  { id: "ecu_recovery", patterns: [/\becu\s+recovery\b/i] },
  { id: "vmax_off", patterns: [/\bvmax\b/i, /\bspeed\s+limit\b/i] },
  { id: "launch_control", patterns: [/\blaunch\s+control\b/i] },
  { id: "hardcut_diesel", patterns: [/\bhard\s*cut\b/i] },
  { id: "popcorn", patterns: [/\bpopcorn\b/i] },
  { id: "exhaust_flaps", patterns: [/\bexhaust\s+flaps?\b/i] },
  { id: "swirl_flaps", patterns: [/\bswirl\s+flaps?\b/i] },
  { id: "immo_off", patterns: [/\bimmo\b/i, /\bimmobilizer\b/i] },
  { id: "log_file_review", patterns: [/\blog\s+file\b/i] },
  { id: "dyno_report_review", patterns: [/\bdyno\b/i] },
  { id: "custom_support", patterns: [/\bcustom\s+support\b/i] },
  { id: "special_request", patterns: [/\bspecial\s+request\b/i] },
];

const coreMetadataMissing = {
  vehicle: "Vehicle brand, model and engine",
  ecu: "ECU or TCU family/type",
  readMethod: "Read method",
  hwSw: "HW/SW or software number",
  fileEvidence: "Original file identity and read evidence",
} as const;

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function uniqueInOrder(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeServiceText(input: TuneAdvisorServiceContext | null | undefined) {
  return [
    textValue(input?.primaryServiceLabel),
    ...(input?.extraServiceLabels ?? []).map(textValue),
    textValue(input?.serviceSummary),
    textValue(input?.notes),
  ].filter(Boolean).join(" | ");
}

function resolveTcuPrimary(source: "id" | "label" | "summary", label = "TCU Tuning") {
  return { id: "tcu_tuning", label, source };
}

function resolvePrimaryById(id: string | null | undefined) {
  const normalizedId = textValue(id);
  if (!normalizedId) return null;
  if (normalizedId === "tcu_tuning") return resolveTcuPrimary("id");
  const service = desktopPrimaryServices.find((item) => item.id === normalizedId);
  if (!service) return null;
  return service.id.startsWith("tcu_stage_")
    ? resolveTcuPrimary("id", service.title)
    : { id: service.id, label: service.title, source: "id" as const };
}

function resolvePrimaryByLabel(label: string | null | undefined) {
  const normalizedLabel = textValue(label).toLowerCase();
  if (!normalizedLabel) return null;
  if (normalizedLabel === "tcu tuning") return resolveTcuPrimary("label");
  const service = desktopPrimaryServices.find((item) => item.title.toLowerCase() === normalizedLabel);
  if (!service) return null;
  return service.id.startsWith("tcu_stage_")
    ? resolveTcuPrimary("label", service.title)
    : { id: service.id, label: service.title, source: "label" as const };
}

function resolvePrimaryBySummary(summary: string) {
  const match = primaryKeywordMap.find((entry) => entry.patterns.some((pattern) => pattern.test(summary)));
  if (!match) return null;
  if (match.id === "tcu_tuning") return resolveTcuPrimary("summary");
  const service = desktopPrimaryServices.find((item) => item.id === match.id);
  return service ? { id: service.id, label: service.title, source: "summary" as const } : null;
}

function resolveExtraById(id: string, source: "id" | "label" | "summary") {
  const service = allExtraServices.find((item) => item.id === id);
  return service
    ? {
        id: service.id,
        label: service.title,
        categoryId: service.categoryId,
        categoryTitle: service.categoryTitle,
        source,
      }
    : null;
}

function resolveExtraLabels(labels: string[] | null | undefined) {
  return (labels ?? [])
    .map(textValue)
    .filter(Boolean)
    .map((label) => {
      const lower = label.toLowerCase();
      const direct = allExtraServices.find((item) => item.title.toLowerCase() === lower);
      if (direct) return resolveExtraById(direct.id, "label");
      const keyword = extraKeywordMap.find((entry) => entry.patterns.some((pattern) => pattern.test(label)));
      return keyword ? resolveExtraById(keyword.id, "label") : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function resolveExtraSummary(summary: string) {
  return extraKeywordMap
    .filter((entry) => entry.patterns.some((pattern) => pattern.test(summary)))
    .map((entry) => resolveExtraById(entry.id, "summary"))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

export function normalizeTuneAdvisorService(
  services: TuneAdvisorServiceContext | null | undefined
): TuneAdvisorNormalizedService {
  const summary = normalizeServiceText(services);
  const explicitPrimary =
    resolvePrimaryById(services?.primaryServiceId) ??
    resolvePrimaryByLabel(services?.primaryServiceLabel);
  const primary = explicitPrimary ?? resolvePrimaryBySummary(summary);

  const extras = uniqueExtraServices([
    ...(services?.extraServiceIds ?? [])
      .map((id) => resolveExtraById(id, "id"))
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    ...resolveExtraLabels(services?.extraServiceLabels),
    ...resolveExtraSummary(summary),
  ]);

  const hasServiceContext = Boolean(primary || extras.length || textValue(services?.serviceSummary));
  return {
    hasServiceContext,
    primary,
    extras,
    serviceSummaryPresent: Boolean(textValue(services?.serviceSummary)),
    notesPresent: Boolean(textValue(services?.notes)),
    invalidReason: hasServiceContext
      ? null
      : "Provide a primary service such as Stage 1, ECO, TCU, Only Options or selected software options.",
  };
}

function uniqueExtraServices(
  extras: TuneAdvisorNormalizedService["extras"]
): TuneAdvisorNormalizedService["extras"] {
  const seen = new Set<string>();
  return extras.filter((extra) => {
    if (seen.has(extra.id)) return false;
    seen.add(extra.id);
    return true;
  });
}

function deterministicProviderIdentity(): TuneAdvisorProviderIdentity {
  return {
    providerId: deterministicTuneAdvisorProviderId,
    providerKind: "deterministic_rules",
    providerStatus: "ready",
    modelName: null,
    promptVersion: tuneAdvisorPromptVersion,
  };
}

export function unavailableTuneAdvisorProviderIdentity(reason: string): TuneAdvisorProviderIdentity {
  return {
    providerId: unconfiguredTuneAdvisorProviderId,
    providerKind: "unconfigured",
    providerStatus: "unavailable",
    modelName: null,
    promptVersion: null,
    unavailableReason: reason,
  };
}

export function erroredTuneAdvisorProviderIdentity(provider: {
  providerId: string;
  providerKind: TuneAdvisorProviderIdentity["providerKind"];
  modelName: string | null;
}): TuneAdvisorProviderIdentity {
  return {
    providerId: provider.providerId,
    providerKind: provider.providerKind,
    providerStatus: "error",
    modelName: provider.modelName,
    promptVersion: null,
    unavailableReason: "Configured Tune Advisor provider failed locally.",
  };
}

function providerStateEvidence(provider: TuneAdvisorProviderIdentity): TuneAdvisorEvidenceItem[] {
  if (provider.providerStatus === "ready" && provider.providerId === deterministicTuneAdvisorProviderId) {
    return [];
  }

  return [{
    id: `provider-${provider.providerStatus}`,
    source: "provider_state",
    type: "provider_availability",
    severity: provider.providerStatus === "error" ? "warning" : "caution",
    text:
      provider.providerStatus === "error"
        ? "The configured Tune Advisor provider failed locally; deterministic non-AI fallback was used."
        : "The Tune Advisor provider is unavailable; deterministic non-AI fallback is required for local guidance.",
    customerSafe: true,
  }];
}

function providerStateRiskFlags(provider: TuneAdvisorProviderIdentity): TuneAdvisorRiskFlag[] {
  if (provider.providerStatus === "ready" && provider.providerId === deterministicTuneAdvisorProviderId) {
    return [];
  }

  return [{
    id: `provider-${provider.providerStatus}-risk`,
    kind: "provider_unavailable",
    severity: provider.providerStatus === "error" ? "warning" : "caution",
    text: "Provider state prevents treating this output as AI-generated tuning advice.",
    requiresHumanReview: true,
    customerSafe: true,
  }];
}

function metadataMissing(vehicle: TuneAdvisorVehicleContext | null | undefined) {
  const missing = new Set<string>();
  const hasVehicle = Boolean(textValue(vehicle?.brand) && textValue(vehicle?.model) && textValue(vehicle?.engine));
  if (!hasVehicle) missing.add(coreMetadataMissing.vehicle);
  if (!textValue(vehicle?.ecuType) && !textValue(vehicle?.ecuFamily)) missing.add(coreMetadataMissing.ecu);
  if (!textValue(vehicle?.readMethod)) missing.add(coreMetadataMissing.readMethod);
  if (!textValue(vehicle?.hwSw)) missing.add(coreMetadataMissing.hwSw);
  missing.add(coreMetadataMissing.fileEvidence);
  return [...missing];
}

function vehicleEvidence(vehicle: TuneAdvisorVehicleContext | null | undefined): TuneAdvisorEvidenceItem[] {
  const evidence: TuneAdvisorEvidenceItem[] = [];
  if (textValue(vehicle?.brand) || textValue(vehicle?.model) || textValue(vehicle?.engine)) {
    evidence.push({
      id: "vehicle-context-present",
      source: "vehicle_metadata",
      type: "vehicle_context",
      severity: "info",
      text: "Vehicle brand, model or engine metadata is present in the request context.",
      customerSafe: true,
    });
  }
  if (textValue(vehicle?.ecuType) || textValue(vehicle?.ecuFamily) || textValue(vehicle?.hwSw)) {
    evidence.push({
      id: "ecu-context-present",
      source: "vehicle_metadata",
      type: "vehicle_context",
      severity: "info",
      text: "ECU/TCU or software metadata is present in the request context.",
      customerSafe: true,
    });
  }
  return evidence;
}

function serviceEvidence(normalized: TuneAdvisorNormalizedService): TuneAdvisorEvidenceItem[] {
  const evidence: TuneAdvisorEvidenceItem[] = [];
  if (normalized.primary) {
    evidence.push({
      id: `primary-${normalized.primary.id}`,
      source: "request_service_metadata",
      type: "primary_service",
      severity: "info",
      text: `Primary service context detected: ${normalized.primary.label}.`,
      customerSafe: true,
    });
  }
  for (const extra of normalized.extras) {
    evidence.push({
      id: `extra-${extra.id}`,
      source: "request_service_metadata",
      type: "extra_service",
      severity: extra.categoryId === "emissions" || extra.id === "dtc_off" ? "warning" : "info",
      text: `Selected extra service context detected: ${extra.label}.`,
      customerSafe: true,
    });
  }
  return evidence;
}

function metadataEvidence(missing: string[]): TuneAdvisorEvidenceItem[] {
  return missing.map((item, index) => ({
    id: `metadata-gap-${index + 1}`,
    source: "deterministic_rules",
    type: "metadata_gap",
    severity: item === coreMetadataMissing.fileEvidence ? "caution" : "warning",
    text: item,
    customerSafe: true as const,
  }));
}

function primaryGuidance(
  primary: TuneAdvisorNormalizedService["primary"],
  extras: TuneAdvisorNormalizedService["extras"]
): TuneAdvisorGuidanceItem[] {
  if (!primary) {
    return [{
      id: "service-scope-required",
      category: "advanced_service_context",
      title: "Service scope required",
      summary: "Tune Advisor needs a primary service or selected software option before useful request guidance can be prepared.",
      missingInformation: ["Primary service or selected option"],
      requiredHumanChecks: ["Confirm requested service scope before file review"],
      customerSafe: true,
    }];
  }

  if (primary.id === "stage_1") {
    return [{
      id: "stage-1-readiness",
      category: "stage_calibration",
      title: "Stage 1 review readiness",
      summary: "Stage 1 guidance is limited to metadata and expert review preparation; this advisor does not generate a tuning file.",
      missingInformation: [
        "Stock hardware confirmation",
        "ECU/SW identification",
        "Diagnostic fault status and any requested drivability constraints",
      ],
      requiredHumanChecks: [
        "Confirm vehicle hardware is suitable for the requested calibration scope",
        "Review ORI identity, ECU/SW and selected service labels",
        "Review diagnostics and logs before any file output",
      ],
      customerSafe: true,
    }];
  }

  if (primary.id === "stage_2" || primary.id === "stage_3") {
    return [{
      id: `${primary.id.replace("_", "-")}-readiness`,
      category: "stage_calibration",
      title: `${primary.label} expert review readiness`,
      summary: `${primary.label} requires explicit hardware, logging and tuner review context before any calibration decision.`,
      missingInformation: [
        "Hardware modification list",
        "Requested vs actual boost, torque and temperature logs where available",
        "Fuel, exhaust and drivetrain constraints",
      ],
      requiredHumanChecks: [
        "Confirm hardware and drivetrain limits",
        "Review logs and diagnostics before load or torque changes",
        "Confirm checksum workflow separately from Tune Advisor guidance",
      ],
      customerSafe: true,
    }];
  }

  if (primary.id === "eco_tuning") {
    return [{
      id: "eco-readiness",
      category: "eco_calibration",
      title: "ECO tuning review readiness",
      summary: "ECO guidance can collect economy intent and drivability constraints, but it does not estimate fuel savings or create a file.",
      missingInformation: [
        "Driving profile and customer goal",
        "Current diagnostic state",
        "ECU/SW and read method",
      ],
      requiredHumanChecks: [
        "Confirm economy goal is compatible with drivability and diagnostic state",
        "Review smoke, temperature and torque boundaries before any calibration work",
      ],
      customerSafe: true,
    }];
  }

  if (primary.id === "tcu_tuning") {
    return [{
      id: "tcu-readiness",
      category: "tcu_calibration",
      title: "TCU review readiness",
      summary: "TCU guidance requires gearbox identification and engine torque context before any shift or limiter decision.",
      missingInformation: [
        "Gearbox/TCU identification",
        "Engine ECU tune state and torque target context",
        "Read method and software number",
      ],
      requiredHumanChecks: [
        "Confirm gearbox family, clutch/torque limits and read/write method",
        "Coordinate TCU review with engine ECU torque model review",
      ],
      customerSafe: true,
    }];
  }

  if (primary.id === "only_options") {
    return [{
      id: "options-only-readiness",
      category: "options_only",
      title: "Only Options review readiness",
      summary: "Options-only guidance needs the exact selected options and human review; it does not approve option removal or service legality.",
      missingInformation: extras.length ? [] : ["Selected software options"],
      requiredHumanChecks: [
        "Confirm each selected option is supported for the vehicle and ECU/TCU context",
        "Review diagnostic, hardware and legal constraints before any file action",
      ],
      customerSafe: true,
    }];
  }

  return [{
    id: "original-file-readiness",
    category: "original_file",
    title: "Original file request review",
    summary: "Original file guidance is limited to source/provenance and matching review; no tuning recommendation is generated.",
    missingInformation: [
      "Original file source and vehicle/ECU identity",
      "Reason the original file is needed",
    ],
    requiredHumanChecks: [
      "Confirm file provenance and vehicle/ECU matching before delivery decisions",
    ],
    customerSafe: true,
  }];
}

function extraGuidance(extras: TuneAdvisorNormalizedService["extras"]): TuneAdvisorGuidanceItem[] {
  return extras
    .filter((extra) =>
      extra.categoryId === "emissions" ||
      extra.categoryId === "performance" ||
      extra.categoryId === "engine_functions" ||
      extra.id === "dtc_off" ||
      extra.id === "checksum" ||
      extra.id === "ecu_recovery"
    )
    .map((extra) => ({
      id: `extra-${extra.id}-review`,
      category: "advanced_service_context" as const,
      title: `${extra.label} review context`,
      summary: `${extra.label} is handled as a review context only; Tune Advisor does not approve or automate the service.`,
      missingInformation: [
        "Vehicle, ECU/SW and read method",
        "Diagnostic and hardware context for this option",
      ],
      requiredHumanChecks: [
        "Confirm service support and constraints for this exact vehicle and ECU/TCU context",
        "Confirm the action remains blocked until expert review is complete",
      ],
      customerSafe: true as const,
    }));
}

function primaryRiskFlags(primary: TuneAdvisorNormalizedService["primary"]): TuneAdvisorRiskFlag[] {
  if (!primary) {
    return [{
      id: "service-scope-missing",
      kind: "insufficient_metadata",
      severity: "warning",
      text: "A primary service or selected option is required before Tune Advisor can prepare useful guidance.",
      requiresHumanReview: true,
      customerSafe: true,
    }];
  }

  const flags: TuneAdvisorRiskFlag[] = [{
    id: "no-file-evidence",
    kind: "no_file_evidence",
    severity: "caution",
    text: "No binary file, map definition, checksum workflow or flash validation was evaluated by Tune Advisor.",
    requiresHumanReview: true,
    customerSafe: true,
  }];

  if (["stage_1", "stage_2", "stage_3", "eco_tuning"].includes(primary.id)) {
    flags.push({
      id: `${primary.id}-calibration-review`,
      kind: "stage_calibration_review",
      severity: primary.id === "stage_1" || primary.id === "eco_tuning" ? "caution" : "warning",
      text: `${primary.label} requires human tuner review before any calibration, torque, smoke or drivability decision.`,
      requiresHumanReview: true,
      customerSafe: true,
    });
  }

  if (primary.id === "tcu_tuning") {
    flags.push({
      id: "tcu-review-required",
      kind: "tcu_review",
      severity: "warning",
      text: "TCU tuning needs gearbox/TCU identification and engine torque coordination before any file action.",
      requiresHumanReview: true,
      customerSafe: true,
    });
  }

  return flags;
}

function extraRiskFlags(extras: TuneAdvisorNormalizedService["extras"]): TuneAdvisorRiskFlag[] {
  const flags: TuneAdvisorRiskFlag[] = [];

  if (extras.some((extra) => extra.categoryId === "emissions")) {
    flags.push({
      id: "emissions-legal-review",
      kind: "emissions_or_legal_review",
      severity: "warning",
      text: "Aftertreatment or emissions-related options require legal, hardware and diagnostic review before any file-service decision.",
      requiresHumanReview: true,
      customerSafe: true,
    });
  }

  if (extras.some((extra) => extra.id === "dtc_off")) {
    flags.push({
      id: "dtc-off-diagnostic-review",
      kind: "diagnostic_uncertainty",
      severity: "warning",
      text: "DTC-related requests need diagnostic context and human review; Tune Advisor does not approve DTC-off work.",
      requiresHumanReview: true,
      customerSafe: true,
    });
  }

  if (extras.some((extra) => extra.id === "checksum")) {
    flags.push({
      id: "checksum-not-approved",
      kind: "checksum_not_approved",
      severity: "critical",
      text: "Checksum correction is a separate expert/tool workflow and is not approved by Tune Advisor.",
      requiresHumanReview: true,
      customerSafe: true,
    });
  }

  if (extras.some((extra) => extra.categoryId === "performance")) {
    flags.push({
      id: "performance-driveability-review",
      kind: "driveability_or_safety_review",
      severity: "warning",
      text: "Performance driving features require driveability, drivetrain and safety review before any file action.",
      requiresHumanReview: true,
      customerSafe: true,
    });
  }

  if (extras.some((extra) => extra.id === "immo_off")) {
    flags.push({
      id: "security-authorization-review",
      kind: "security_authorization_review",
      severity: "critical",
      text: "Immobilizer-related service context requires authorization and expert review before any handling decision.",
      requiresHumanReview: true,
      customerSafe: true,
    });
  }

  if (extras.some((extra) => extra.categoryId === "engine_functions")) {
    flags.push({
      id: "engine-function-review",
      kind: "advanced_service_review",
      severity: "warning",
      text: "Engine function options need hardware, diagnostics and service-support review before any file action.",
      requiresHumanReview: true,
      customerSafe: true,
    });
  }

  return flags;
}

function missingRecommendations(missing: string[]): TuneAdvisorRecommendation[] {
  return missing.slice(0, 8).map((item, index) => ({
    id: `missing-${index + 1}`,
    category: "metadata_required",
    priority: "normal",
    text: `Collect ${item.toLowerCase()} before expert tuning review.`,
    requiresHumanReview: false,
    customerSafe: true as const,
  }));
}

function serviceRecommendations(
  normalized: TuneAdvisorNormalizedService,
  riskFlags: TuneAdvisorRiskFlag[]
): TuneAdvisorRecommendation[] {
  const recommendations: TuneAdvisorRecommendation[] = [];
  if (normalized.primary) {
    recommendations.push({
      id: "service-scope-review",
      category: "service_scope_review",
      priority: "normal",
      text: `Review ${normalized.primary.label} against vehicle, ECU/TCU, read method and selected extras before file work.`,
      requiresHumanReview: true,
      customerSafe: true,
    });
  }
  if (riskFlags.some((flag) => flag.kind === "emissions_or_legal_review")) {
    recommendations.push({
      id: "emissions-risk-review",
      category: "risk_review",
      priority: "high",
      text: "Complete legal, hardware and diagnostic review for aftertreatment-related requests before any file-service decision.",
      requiresHumanReview: true,
      customerSafe: true,
    });
  }
  if (riskFlags.some((flag) => flag.kind === "checksum_not_approved")) {
    recommendations.push({
      id: "checksum-workflow-separated",
      category: "risk_review",
      priority: "high",
      text: "Keep checksum correction in the separate expert/tool workflow; Tune Advisor cannot approve it.",
      requiresHumanReview: true,
      customerSafe: true,
    });
  }
  recommendations.push({
    id: "human-review-gate",
    category: "human_review_gate",
    priority: "high",
    text: "Human expert review is required before calibration bytes, MOD export, checksum approval, flash-safety claims, legal suitability, pricing or delivery automation.",
    requiresHumanReview: true,
    customerSafe: true,
  });
  return recommendations;
}

function providerUnavailableRecommendations(): TuneAdvisorRecommendation[] {
  return [{
    id: "provider-unavailable-fallback-notice",
    category: "fallback_notice",
    priority: "high",
    text: "Tune Advisor provider is unavailable. Use deterministic fallback or human expert review; do not present the result as AI-generated tuning advice.",
    requiresHumanReview: true,
    customerSafe: true,
  }];
}

function readinessFor(input: {
  normalized: TuneAdvisorNormalizedService;
  missing: string[];
  services?: TuneAdvisorServiceContext | null;
}): TuneAdvisorReadiness {
  if (input.normalized.invalidReason) return "blocked";
  const missingCore = input.missing.filter((item) => item !== coreMetadataMissing.fileEvidence);
  if (missingCore.length > 0) return "needs_metadata";
  const evidenceCount = Number(input.services?.evidenceCount ?? 0);
  const highQualityEvidenceCount = Number(input.services?.highQualityEvidenceCount ?? 0);
  if (evidenceCount >= 3 && highQualityEvidenceCount >= 2 && input.services?.mapDefinitionsAvailable) {
    return "evidence_supported_review";
  }
  return "human_review_required";
}

function confidenceFor(readiness: TuneAdvisorReadiness, normalized: TuneAdvisorNormalizedService): TuneAdvisorConfidence {
  if (readiness === "blocked" || normalized.invalidReason) return "none";
  if (readiness === "needs_metadata") return "low";
  if (readiness === "evidence_supported_review") return "medium";
  return "medium";
}

function confidenceReasons(input: {
  readiness: TuneAdvisorReadiness;
  confidence: TuneAdvisorConfidence;
  normalized: TuneAdvisorNormalizedService;
  provider: TuneAdvisorProviderIdentity;
  riskFlags: TuneAdvisorRiskFlag[];
}): TuneAdvisorConfidenceReason[] {
  const reasons: TuneAdvisorConfidenceReason[] = [];
  if (input.confidence === "none") {
    return [{
      id: "confidence-none",
      confidence: "none",
      text: input.normalized.invalidReason ?? "Tune Advisor cannot start without service context.",
      customerSafe: true,
    }];
  }
  if (input.readiness === "needs_metadata") {
    reasons.push({
      id: "metadata-cap",
      confidence: input.confidence,
      text: "Confidence is low until vehicle, ECU/TCU, read method and software metadata are complete.",
      customerSafe: true,
    });
  }
  if (input.provider.providerStatus !== "ready" || input.provider.providerId !== deterministicTuneAdvisorProviderId) {
    reasons.push({
      id: "provider-fallback-cap",
      confidence: input.confidence,
      text: "Provider unavailable or failed state caps this result as deterministic non-AI fallback.",
      customerSafe: true,
    });
  }
  if (input.riskFlags.some((flag) => flag.severity === "critical" || flag.severity === "warning")) {
    reasons.push({
      id: "risk-review-cap",
      confidence: input.confidence,
      text: "Risk flags keep the output in expert-review mode and prevent automatic file decisions.",
      customerSafe: true,
    });
  }
  reasons.push({
    id: "human-review-cap",
    confidence: input.confidence,
    text: "Tune Advisor confidence is capped because no binary calibration, checksum workflow, flash validation or legal review was executed.",
    customerSafe: true,
  });
  return uniqueById(reasons);
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function allRequiredHumanChecks(guidance: TuneAdvisorGuidanceItem[]) {
  return uniqueInOrder(guidance.flatMap((item) => item.requiredHumanChecks));
}

function invalidInputEvidence(normalized: TuneAdvisorNormalizedService): TuneAdvisorEvidenceItem[] {
  return [{
    id: "invalid-service-context",
    source: "request_service_metadata",
    type: "metadata_gap",
    severity: "warning",
    text: normalized.invalidReason ?? "Service context is missing.",
    customerSafe: true,
  }];
}

export function buildProviderUnavailableTuneAdvisorResponse(
  request: TuneAdvisorRequest,
  reason = "No Tune Advisor provider is configured for local analysis."
): TuneAdvisorResponse {
  const normalized = normalizeTuneAdvisorService(request.services);
  const provider = unavailableTuneAdvisorProviderIdentity(reason);

  return {
    contractVersion: tuneAdvisorContractVersion,
    status: "provider_unavailable",
    provider,
    fallback: {
      used: false,
      providerId: deterministicTuneAdvisorProviderId,
      reason: null,
    },
    isAiGenerated: false,
    readiness: "blocked",
    confidence: "none",
    confidenceReasons: [{
      id: "provider-unavailable-confidence-none",
      confidence: "none",
      text: "No Tune Advisor confidence is assigned because the configured provider is unavailable and fallback was not used in this response.",
      customerSafe: true,
    }],
    normalizedService: normalized,
    summary: "Tune Advisor provider is unavailable. Use deterministic fallback for local, non-AI request guidance.",
    guidance: [],
    evidence: providerStateEvidence(provider),
    riskFlags: providerStateRiskFlags(provider),
    recommendations: providerUnavailableRecommendations(),
    missingInformation: normalized.invalidReason ? ["Primary service or selected option"] : [],
    humanReview: {
      required: true,
      reason: "Tune Advisor is unavailable until a provider is configured or deterministic fallback is used.",
      requiredBefore: [
        "calibration byte changes",
        "customer-ready MOD export",
        "checksum approval",
        "flash-safety or legal-suitability decision",
      ],
    },
    safetyBoundaries,
    blockedProductionActions: [...tuneAdvisorBlockedProductionActions],
  };
}

export function buildInvalidTuneAdvisorInputResponse(
  request: TuneAdvisorRequest,
  normalized = normalizeTuneAdvisorService(request.services)
): TuneAdvisorResponse {
  const provider = deterministicProviderIdentity();

  return {
    contractVersion: tuneAdvisorContractVersion,
    status: "invalid_input",
    provider,
    fallback: {
      used: true,
      providerId: deterministicTuneAdvisorProviderId,
      reason: "Input validation handled by deterministic rules before any provider call.",
    },
    isAiGenerated: false,
    readiness: "blocked",
    confidence: "none",
    confidenceReasons: [{
      id: "invalid-input-confidence-none",
      confidence: "none",
      text: normalized.invalidReason ?? "Tune Advisor needs service context before guidance can be prepared.",
      customerSafe: true,
    }],
    normalizedService: normalized,
    summary: normalized.invalidReason ?? "Service context is missing.",
    guidance: primaryGuidance(null, []),
    evidence: invalidInputEvidence(normalized),
    riskFlags: primaryRiskFlags(null),
    recommendations: [
      {
        id: "invalid-input-metadata",
        category: "metadata_required",
        priority: "high",
        text: "Provide a primary service such as Stage 1, ECO, TCU, Only Options or selected software options.",
        requiresHumanReview: false,
        customerSafe: true,
      },
      {
        id: "invalid-input-human-review-gate",
        category: "human_review_gate",
        priority: "high",
        text: "Do not prepare customer file advice until service scope is available.",
        requiresHumanReview: true,
        customerSafe: true,
      },
    ],
    missingInformation: ["Primary service or selected option"],
    humanReview: {
      required: true,
      reason: "Service scope is required before useful Tune Advisor guidance can be prepared.",
      requiredBefore: [
        "calibration byte changes",
        "customer-ready MOD export",
        "checksum approval",
      ],
    },
    safetyBoundaries,
    blockedProductionActions: [...tuneAdvisorBlockedProductionActions],
  };
}

export function buildDeterministicTuneAdvisorFallback(
  request: TuneAdvisorRequest,
  normalized = normalizeTuneAdvisorService(request.services),
  options: {
    provider?: TuneAdvisorProviderIdentity;
    reason?: string;
  } = {}
): TuneAdvisorResponse {
  if (normalized.invalidReason) return buildInvalidTuneAdvisorInputResponse(request, normalized);

  const provider = options.provider ?? deterministicProviderIdentity();
  const missing = metadataMissing(request.vehicle);
  const guidance = [
    ...primaryGuidance(normalized.primary, normalized.extras),
    ...extraGuidance(normalized.extras),
  ];
  const riskFlags = uniqueById([
    ...primaryRiskFlags(normalized.primary),
    ...extraRiskFlags(normalized.extras),
    ...providerStateRiskFlags(provider),
  ]);
  const readiness = readinessFor({ normalized, missing, services: request.services });
  const confidence = confidenceFor(readiness, normalized);
  const evidence = uniqueById([
    ...serviceEvidence(normalized),
    ...vehicleEvidence(request.vehicle),
    ...metadataEvidence(missing),
    ...providerStateEvidence(provider),
  ]);
  const recommendations = uniqueById([
    ...missingRecommendations(missing),
    ...serviceRecommendations(normalized, riskFlags),
    ...(provider.providerStatus === "ready" && provider.providerId === deterministicTuneAdvisorProviderId
      ? []
      : providerUnavailableRecommendations()),
  ]);
  const requiredHumanChecks = allRequiredHumanChecks(guidance);
  const primaryLabel = normalized.primary?.label ?? "selected service";

  return {
    contractVersion: tuneAdvisorContractVersion,
    status: "fallback",
    provider,
    fallback: {
      used: true,
      providerId: deterministicTuneAdvisorProviderId,
      reason: options.reason ?? "Deterministic non-AI fallback used for local Tune Advisor guidance.",
    },
    isAiGenerated: false,
    readiness,
    confidence,
    confidenceReasons: confidenceReasons({ readiness, confidence, normalized, provider, riskFlags }),
    normalizedService: normalized,
    summary: `Deterministic non-AI Tune Advisor prepared ${primaryLabel} request guidance. Human expert review remains required.`,
    guidance,
    evidence,
    riskFlags,
    recommendations,
    missingInformation: uniqueInOrder([
      ...missing,
      ...guidance.flatMap((item) => item.missingInformation),
    ]),
    humanReview: {
      required: true,
      reason:
        "Request metadata cannot approve calibration bytes, MOD export, checksum completion, flash safety, legal suitability, exact gains, pricing or delivery automation.",
      requiredBefore: uniqueInOrder([
        ...requiredHumanChecks,
        "calibration byte changes",
        "customer-ready MOD export",
        "checksum approval",
        "flash-safety or legal-suitability decision",
      ]),
    },
    safetyBoundaries,
    blockedProductionActions: [...tuneAdvisorBlockedProductionActions],
  };
}
