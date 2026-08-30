import type {
  DtcAnalysisEvidenceItem,
  DtcAnalyzerMessageDescriptor,
  DtcAnalyzerRecommendation,
  DtcAnalyzerConfidence,
  DtcAnalyzerNormalizedInput,
  DtcAnalyzerProviderIdentity,
  DtcAnalyzerRequest,
  DtcAnalyzerResponse,
  DtcCodeAnalysis,
  DtcConfidenceReason,
  DtcRiskFlag,
  DtcStandardization,
  DtcSystem,
} from "@/lib/dtcAnalyzer/types";

export const dtcAnalyzerContractVersion = "dtc-analyzer-v1" as const;
export const dtcAnalyzerPromptVersion = "dtc-analyzer-v1";
export const deterministicDtcFallbackProviderId = "deterministic_rules" as const;
export const unconfiguredDtcProviderId = "unconfigured_dtc_ai_provider";
export const maxDtcTextLength = 2000;

const validDtcPattern = /^[PCBU][0-3][0-9A-F]{3}$/;
const validDtcSearchPattern = /\b[PCBU][0-3][0-9A-F]{3}\b/gi;
const codeLikeSearchPattern = /\b[PCBU][0-9A-Z]{3,6}\b/gi;

function message(
  key: DtcAnalyzerMessageDescriptor["key"],
  fallback: string,
  params?: DtcAnalyzerMessageDescriptor["params"]
): DtcAnalyzerMessageDescriptor {
  return params ? { key, params, fallback } : { key, fallback };
}

const safetyBoundaryMessages = [
  message("safety.guidance_only", "This is diagnostic guidance only and does not confirm a root cause, fix or legal suitability."),
  message("safety.no_approval", "It does not approve DTC-off, emissions removal, byte patching, checksum work or MOD generation."),
  message("safety.human_review", "Human diagnostic and tuner review is required before any customer file action."),
];
const safetyBoundaries = safetyBoundaryMessages.map((item) => item.fallback);

const commonMissingInformationMessages = [
  message("missing.vehicle", "Vehicle brand, model, engine and model year"),
  message("missing.ecu", "ECU family, software number and read method"),
  message("missing.freeze_frame", "Freeze-frame data, current/stored status and fault frequency"),
  message("missing.live_data", "Related DTCs and live data around airflow, boost, temperature and sensor plausibility"),
  message("missing.hardware", "Hardware condition and whether emissions components are present and functional"),
];
const commonMissingInformation = commonMissingInformationMessages.map((item) => item.fallback);

const requiredBeforeMessages = [
  message("required_before.customer_file_advice", "customer file advice"),
  message("required_before.dtc_off_decision", "DTC-off decision"),
  message("required_before.checksum_mod_work", "checksum or MOD-file work"),
];
const requiredBefore = requiredBeforeMessages.map((item) => item.fallback);

type KnownDtcProfile = {
  title: string;
  likelyDiagnosticContext: string[];
  customerExplanation: string;
  recommendedChecks: string[];
  missingInformation?: string[];
};

type KnownDtcCode = "P0101" | "P0299" | "P0401" | "P0402" | "P0420" | "P0087" | "P2002" | "P2453" | "U0100";

const knownDtcProfiles: Record<KnownDtcCode, KnownDtcProfile> = {
  P0101: {
    title: "Mass air flow range or performance context",
    likelyDiagnosticContext: [
      "Air-mass measurement is outside the expected operating range for the ECU strategy.",
      "This can interact with EGR, boost control, air leaks or sensor contamination.",
    ],
    customerExplanation:
      "P0101 usually needs airflow live data and related boost/EGR faults before deciding whether the issue is sensor, air path or calibration related.",
    recommendedChecks: [
      "Compare commanded and measured air mass under the same operating condition.",
      "Check intake leaks, MAF condition and companion EGR or boost faults.",
      "Review freeze-frame load, RPM and temperature before any file decision.",
    ],
  },
  P0299: {
    title: "Turbo or supercharger underboost context",
    likelyDiagnosticContext: [
      "Boost pressure is lower than expected for the current load request.",
      "Common diagnostic areas include charge-air leaks, actuator control, vacuum/pressure control and turbocharger condition.",
    ],
    customerExplanation:
      "P0299 points to an underboost condition, but the fallback cannot separate hardware leakage, actuator control or calibration without logs.",
    recommendedChecks: [
      "Collect requested versus actual boost and air-mass logs.",
      "Check charge pipes, intercooler, actuator movement and boost-control faults.",
      "Confirm whether the fault is current, intermittent or stored only.",
    ],
  },
  P0401: {
    title: "EGR flow lower than expected",
    likelyDiagnosticContext: [
      "The ECU detected less EGR flow than expected for the commanded condition.",
      "Relevant areas can include EGR valve movement, EGR cooler or intake restriction, vacuum/actuator control, wiring or air-mass plausibility.",
    ],
    customerExplanation:
      "P0401 is an EGR-flow diagnostic context. It should be verified with live data and hardware condition before any file-service decision.",
    recommendedChecks: [
      "Compare commanded EGR position with feedback or measured airflow change.",
      "Check companion MAF, boost, differential-pressure and temperature faults.",
      "Confirm whether EGR hardware is present, functional and mechanically clean.",
    ],
    missingInformation: [
      "EGR command and feedback/live-airflow data",
      "Whether the vehicle has prior EGR hardware work or software changes",
    ],
  },
  P0402: {
    title: "EGR flow higher than expected",
    likelyDiagnosticContext: [
      "The ECU detected more EGR flow than expected for the commanded condition.",
      "Relevant areas can include a sticking EGR valve, air-mass plausibility, intake restriction or pressure sensor interpretation.",
    ],
    customerExplanation:
      "P0402 needs live EGR and air-mass data before interpreting it as a hardware, sensor or calibration issue.",
    recommendedChecks: [
      "Review EGR command versus feedback and measured air-mass behavior.",
      "Check for companion airflow, boost and pressure-sensor faults.",
      "Verify mechanical EGR state before any software decision.",
    ],
  },
  P0420: {
    title: "Catalyst efficiency below threshold context",
    likelyDiagnosticContext: [
      "The ECU detected catalyst efficiency below its expected threshold.",
      "Relevant areas can include catalyst condition, exhaust leaks, oxygen sensor plausibility and fuel-trim behavior.",
    ],
    customerExplanation:
      "P0420 cannot be treated as a confirmed catalyst or software problem from the code alone. Sensor and exhaust data are required.",
    recommendedChecks: [
      "Check upstream/downstream oxygen sensor behavior and fuel trims.",
      "Inspect for exhaust leaks and companion misfire or mixture faults.",
      "Confirm readiness monitor status and vehicle operating condition.",
    ],
  },
  P0087: {
    title: "Fuel rail or system pressure too low context",
    likelyDiagnosticContext: [
      "Fuel pressure is lower than expected for the requested operating condition.",
      "Relevant areas can include supply pressure, high-pressure pump control, injectors, regulator/valve control and sensor plausibility.",
    ],
    customerExplanation:
      "P0087 is safety-relevant and needs fuel-pressure logs before any tuning or file-service conclusion.",
    recommendedChecks: [
      "Compare requested and actual fuel pressure during the fault condition.",
      "Check supply-side pressure, filter condition and pressure-control faults.",
      "Do not increase load or torque requests until the pressure issue is reviewed.",
    ],
  },
  P2002: {
    title: "Diesel particulate filter efficiency context",
    likelyDiagnosticContext: [
      "The ECU detected DPF efficiency below an expected threshold.",
      "Relevant areas can include differential pressure, soot load estimation, temperature sensors, regeneration history and exhaust leaks.",
    ],
    customerExplanation:
      "P2002 needs DPF pressure, soot-load and regeneration context. The fallback does not confirm a DPF removal or repair path.",
    recommendedChecks: [
      "Review differential pressure, soot load and regeneration data.",
      "Check exhaust leaks and temperature/differential-pressure sensor plausibility.",
      "Confirm legal and hardware requirements before any file-service discussion.",
    ],
  },
  P2453: {
    title: "DPF differential pressure sensor range or performance context",
    likelyDiagnosticContext: [
      "The DPF differential pressure signal is outside the expected range or behavior.",
      "Relevant areas can include pressure hoses, sensor power/ground, sensor plausibility and DPF restriction state.",
    ],
    customerExplanation:
      "P2453 should be checked with pressure data and sensor/hose condition before interpreting DPF load or software requirements.",
    recommendedChecks: [
      "Inspect pressure hoses for blockage, leakage or swapped connections.",
      "Compare pressure reading at key-on, idle and load.",
      "Check companion DPF temperature, soot load and regeneration faults.",
    ],
  },
  U0100: {
    title: "Lost communication with engine control module context",
    likelyDiagnosticContext: [
      "A control module reported lost communication with the engine control module.",
      "Relevant areas can include CAN wiring, power/ground, module wake-up, gateway state and scan-tool coverage.",
    ],
    customerExplanation:
      "U0100 is a network communication context, not a confirmed ECU failure. Power, ground and CAN checks are required.",
    recommendedChecks: [
      "Confirm whether communication loss is current or stored.",
      "Check ECU power, ground, CAN wiring and related gateway faults.",
      "Scan all modules and compare which modules report the communication loss.",
    ],
  },
};

function isKnownDtcCode(code: string): code is KnownDtcCode {
  return Object.prototype.hasOwnProperty.call(knownDtcProfiles, code);
}

function knownProfileMessages(code: KnownDtcCode, profile: KnownDtcProfile) {
  return {
    title: message(`code.${code}.title`, profile.title),
    explanation: message(`code.${code}.explanation`, profile.customerExplanation),
    checks: profile.recommendedChecks.map((check, index) =>
      message(`code.${code}.check_${(index + 1) as 1 | 2 | 3}`, check)
    ),
  };
}

function codeMissingInformationMessages(code: string) {
  if (code !== "P0401") return commonMissingInformationMessages;
  return [
    message("missing.p0401_egr_data", "EGR command and feedback/live-airflow data"),
    message("missing.p0401_history", "Whether the vehicle has prior EGR hardware work or software changes"),
    ...commonMissingInformationMessages,
  ];
}

function uniqueInOrder(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

export function normalizeDtcInput(text: string): DtcAnalyzerNormalizedInput {
  const trimmed = text.trim();
  const analysisText = trimmed.slice(0, maxDtcTextLength).toUpperCase();
  const validMatches = Array.from(analysisText.matchAll(validDtcSearchPattern), (match) => match[0].toUpperCase());
  const codeLikeMatches = Array.from(analysisText.matchAll(codeLikeSearchPattern), (match) => match[0].toUpperCase());
  const normalizedCodes = uniqueInOrder(validMatches);
  const rejectedCodeLikeTokens = uniqueInOrder(
    codeLikeMatches.filter((token) => !validDtcPattern.test(token))
  ).slice(0, 10);

  let invalidReason: string | null = null;
  if (!trimmed) {
    invalidReason = "Enter at least one diagnostic trouble code such as P0401.";
  } else if (normalizedCodes.length === 0) {
    invalidReason = "No valid SAE-style DTC code was detected. Use codes such as P0401, P2002 or U0100.";
  }

  return {
    hasText: Boolean(trimmed),
    wasTruncated: trimmed.length > maxDtcTextLength,
    normalizedCodes,
    rejectedCodeLikeTokens,
    invalidReason,
  };
}

function systemFor(code: string): {
  system: DtcSystem;
  label: string;
  labelMessage: DtcAnalyzerMessageDescriptor;
} {
  const prefix = code[0];
  if (prefix === "P") {
    return { system: "powertrain", label: "Powertrain", labelMessage: message("system.powertrain", "Powertrain") };
  }
  if (prefix === "C") {
    return { system: "chassis", label: "Chassis", labelMessage: message("system.chassis", "Chassis") };
  }
  if (prefix === "B") {
    return { system: "body", label: "Body", labelMessage: message("system.body", "Body") };
  }
  return {
    system: "network",
    label: "Network communication",
    labelMessage: message("system.network", "Network communication"),
  };
}

function standardizationFor(code: string): {
  standardization: DtcStandardization;
  label: string;
  evidenceKey: DtcAnalyzerMessageDescriptor["key"];
} {
  const scope = code[1];
  if (scope === "0") {
    return {
      standardization: "sae_or_iso_generic",
      label: "SAE/ISO generic range",
      evidenceKey: "evidence.standard_generic",
    };
  }
  if (scope === "1") {
    return {
      standardization: "manufacturer_specific",
      label: "Manufacturer-specific range",
      evidenceKey: "evidence.standard_manufacturer",
    };
  }
  return {
    standardization: "mixed_or_reserved",
    label: "Generic/manufacturer-specific range; verify with vehicle data",
    evidenceKey: "evidence.standard_mixed",
  };
}

const emissionsReviewCodes = new Set(["P0401", "P0402", "P0420", "P2002", "P2453"]);
const safetyRelevantCodes = new Set(["P0087"]);

function uniqueAnalysisItems<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function uniqueMessages(items: DtcAnalyzerMessageDescriptor[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const identity = `${item.key}:${JSON.stringify(item.params ?? {})}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function codeEvidenceItems(input: {
  code: string;
  system: DtcSystem;
  systemLabel: string;
  standardizationEvidenceKey: DtcAnalyzerMessageDescriptor["key"];
  standardizationLabel: string;
  hasKnownProfile: boolean;
}): DtcAnalysisEvidenceItem[] {
  return [
    {
      id: `${input.code}-code-detected`,
      code: input.code,
      source: "input_normalization",
      type: "dtc_code_detected",
      severity: "info",
      text: `${input.code} was detected as a valid DTC token.`,
      message: message("evidence.valid_code", `${input.code} was detected as a valid DTC token.`, { code: input.code }),
      customerSafe: true,
    },
    {
      id: `${input.code}-system-family`,
      code: input.code,
      source: "deterministic_code_family",
      type: "system_family",
      severity: "info",
      text: `${input.code} belongs to the ${input.systemLabel.toLowerCase()} diagnostic family.`,
      message: message(
        `evidence.system_${input.system}`,
        `${input.code} belongs to the ${input.systemLabel.toLowerCase()} diagnostic family.`,
        { code: input.code }
      ),
      customerSafe: true,
    },
    {
      id: `${input.code}-standardization`,
      code: input.code,
      source: "deterministic_code_family",
      type: "standardization_scope",
      severity: "info",
      text: `${input.code} is classified as ${input.standardizationLabel.toLowerCase()}.`,
      message: message(
        input.standardizationEvidenceKey,
        `${input.code} is classified as ${input.standardizationLabel.toLowerCase()}.`,
        { code: input.code }
      ),
      customerSafe: true,
    },
    {
      id: `${input.code}-known-profile`,
      code: input.code,
      source: input.hasKnownProfile ? "local_known_profile" : "deterministic_code_family",
      type: "known_code_context",
      severity: input.hasKnownProfile ? "info" : "caution",
      text: input.hasKnownProfile
        ? `A local deterministic diagnostic profile is available for ${input.code}.`
        : `No trusted local diagnostic profile is available for ${input.code}; only code-family guidance is available.`,
      message: input.hasKnownProfile
        ? message(
            "evidence.profile_known",
            `A local deterministic diagnostic profile is available for ${input.code}.`,
            { code: input.code }
          )
        : message(
            "evidence.profile_unknown",
            `No trusted local diagnostic profile is available for ${input.code}; only code-family guidance is available.`,
            { code: input.code }
          ),
      customerSafe: true,
    },
  ];
}

function codeRiskFlags(input: { code: string; system: DtcSystem; hasKnownProfile: boolean }): DtcRiskFlag[] {
  const flags: DtcRiskFlag[] = [
    {
      id: `${input.code}-diagnostic-uncertainty`,
      code: input.code,
      kind: "diagnostic_uncertainty",
      severity: input.hasKnownProfile ? "caution" : "warning",
      text: "A DTC code alone cannot confirm root cause, repair path or file-service suitability.",
      requiresHumanReview: true,
      customerSafe: true,
    },
    {
      id: `${input.code}-insufficient-context`,
      code: input.code,
      kind: "insufficient_context",
      severity: "caution",
      text: "Freeze-frame, current/stored status, live data and vehicle/ECU context are still required.",
      requiresHumanReview: true,
      customerSafe: true,
    },
  ];

  if (emissionsReviewCodes.has(input.code)) {
    flags.push({
      id: `${input.code}-emissions-review`,
      code: input.code,
      kind: "emissions_or_legal_review",
      severity: "warning",
      text: "Aftertreatment or emissions-related context requires legal, hardware and diagnostic review before any file-service decision.",
      requiresHumanReview: true,
      customerSafe: true,
    });
  }

  if (safetyRelevantCodes.has(input.code)) {
    flags.push({
      id: `${input.code}-safety-relevance`,
      code: input.code,
      kind: "safety_relevance",
      severity: "critical",
      text: "This context can affect safe engine operation and should be reviewed before load, torque or tuning decisions.",
      requiresHumanReview: true,
      customerSafe: true,
    });
  }

  if (input.system === "network") {
    flags.push({
      id: `${input.code}-network-review`,
      code: input.code,
      kind: "network_or_module_review",
      severity: "warning",
      text: "Network/module communication faults need power, ground, wiring and full-vehicle scan review before ECU conclusions.",
      requiresHumanReview: true,
      customerSafe: true,
    });
  }

  return flags;
}

function codeConfidenceReasons(input: {
  code: string;
  confidence: DtcAnalyzerConfidence;
  hasKnownProfile: boolean;
}): DtcConfidenceReason[] {
  if (input.hasKnownProfile) {
    return [
      {
        id: `${input.code}-confidence-known-profile`,
        code: input.code,
        confidence: input.confidence,
        text: "A local deterministic profile exists, but confidence is capped because no live data, freeze-frame or ECU software evidence was evaluated.",
        customerSafe: true,
      },
    ];
  }

  return [
    {
      id: `${input.code}-confidence-unknown-code`,
      code: input.code,
      confidence: input.confidence,
      text: "The DTC format is valid, but no trusted local definition exists for this exact code.",
      customerSafe: true,
    },
  ];
}

function codeRecommendations(input: {
  code: string;
  recommendedChecks: DtcAnalyzerMessageDescriptor[];
  missingInformation: DtcAnalyzerMessageDescriptor[];
}): DtcAnalyzerRecommendation[] {
  const checks = input.recommendedChecks.map((check, index) => ({
    id: `${input.code}-diagnostic-check-${index + 1}`,
    code: input.code,
    category: "diagnostic_check" as const,
    priority: "normal" as const,
    text: check.fallback,
    message: check,
    requiresHumanReview: false,
    customerSafe: true as const,
  }));

  const missing = input.missingInformation.slice(0, 6).map((item, index) => ({
    id: `${input.code}-missing-information-${index + 1}`,
    code: input.code,
    category: "missing_information" as const,
    priority: "normal" as const,
    text: item.fallback,
    message: item,
    requiresHumanReview: false,
    customerSafe: true as const,
  }));

  return [
    ...checks,
    ...missing,
    {
      id: `${input.code}-human-review-gate`,
      code: input.code,
      category: "human_review_gate",
      priority: "high",
      text: "Human review is required before customer file advice, DTC-off decisions, file edits, byte patches, checksum work or customer-ready MOD output.",
      message: message(
        "recommendation.human_review_gate",
        "Human review is required before customer file advice, DTC-off decisions, file edits, byte patches, checksum work or customer-ready MOD output."
      ),
      requiresHumanReview: true,
      customerSafe: true,
    },
  ];
}

function providerStateEvidence(provider: DtcAnalyzerProviderIdentity): DtcAnalysisEvidenceItem[] {
  if (provider.providerStatus === "ready" && provider.providerId === deterministicDtcFallbackProviderId) {
    return [];
  }

  return [{
    id: `provider-${provider.providerStatus}`,
    code: null,
    source: "provider_state",
    type: "provider_availability",
    severity: provider.providerStatus === "error" ? "warning" : "caution",
    text:
      provider.providerStatus === "error"
        ? "The configured DTC provider failed locally; deterministic non-AI fallback was used."
        : "The DTC AI provider is unavailable; deterministic non-AI fallback is required for local guidance.",
    customerSafe: true,
  }];
}

function providerStateRiskFlags(provider: DtcAnalyzerProviderIdentity): DtcRiskFlag[] {
  if (provider.providerStatus === "ready" && provider.providerId === deterministicDtcFallbackProviderId) {
    return [];
  }

  return [{
    id: `provider-${provider.providerStatus}-risk`,
    code: null,
    kind: "provider_unavailable",
    severity: provider.providerStatus === "error" ? "warning" : "caution",
    text: "Provider state prevents treating this output as AI-generated analysis.",
    requiresHumanReview: true,
    customerSafe: true,
  }];
}

function providerUnavailableRecommendations(): DtcAnalyzerRecommendation[] {
  return [{
    id: "provider-unavailable-human-review-gate",
    code: null,
    category: "human_review_gate",
    priority: "high",
    text: "Use deterministic fallback or human expert review before any customer-facing DTC guidance.",
    requiresHumanReview: true,
    customerSafe: true,
  }];
}

function invalidInputEvidence(normalizedInput: DtcAnalyzerNormalizedInput): DtcAnalysisEvidenceItem[] {
  return [{
    id: "invalid-input-validation",
    code: null,
    source: "input_normalization",
    type: "input_validation",
    severity: "warning",
    text: normalizedInput.invalidReason ?? "No valid DTC code was detected.",
    customerSafe: true,
  }];
}

function invalidInputRiskFlags(): DtcRiskFlag[] {
  return [{
    id: "invalid-input-insufficient-context",
    code: null,
    kind: "insufficient_context",
    severity: "warning",
    text: "Analysis cannot start until at least one valid DTC code is provided.",
    requiresHumanReview: true,
    customerSafe: true,
  }];
}

function invalidInputRecommendations(): DtcAnalyzerRecommendation[] {
  return [
    {
      id: "invalid-input-missing-code",
      code: null,
      category: "missing_information",
      priority: "high",
      text: "Provide at least one valid DTC code such as P0401.",
      requiresHumanReview: false,
      customerSafe: true,
    },
    {
      id: "invalid-input-human-review-gate",
      code: null,
      category: "human_review_gate",
      priority: "high",
      text: "Do not prepare customer file advice until valid diagnostic input is available.",
      requiresHumanReview: true,
      customerSafe: true,
    },
  ];
}

function noConfidenceReason(id: string, text: string): DtcConfidenceReason[] {
  return [{
    id,
    code: null,
    confidence: "none",
    text,
    customerSafe: true,
  }];
}

function overallConfidenceReasons(codes: DtcCodeAnalysis[], confidence: DtcAnalyzerConfidence): DtcConfidenceReason[] {
  if (confidence === "none") {
    return noConfidenceReason("overall-confidence-none", "No valid DTC code was available for analysis.");
  }

  const hasUnknownCode = codes.some((code) => code.confidence === "low");
  return [
    {
      id: "overall-confidence",
      code: null,
      confidence,
      text: hasUnknownCode
        ? "Overall confidence is low because at least one valid code has no trusted local diagnostic profile."
        : "Overall confidence is medium because every detected code has a local deterministic profile.",
      customerSafe: true,
    },
    {
      id: "overall-confidence-deterministic-cap",
      code: null,
      confidence,
      text: "Deterministic text-only fallback is capped at medium because it does not evaluate live data, freeze-frame, ECU software or vehicle-specific service information.",
      customerSafe: true,
    },
  ];
}

function analyzeCode(code: string): DtcCodeAnalysis {
  const system = systemFor(code);
  const standardization = standardizationFor(code);
  const known = isKnownDtcCode(code) ? knownDtcProfiles[code] : undefined;
  const baseMissingMessages = codeMissingInformationMessages(code);
  const baseMissing = baseMissingMessages.map((item) => item.fallback);
  const hasKnownProfile = Boolean(known);

  if (known) {
    const confidence: DtcAnalyzerConfidence = "medium";
    const profileMessages = knownProfileMessages(code as KnownDtcCode, known);
    return {
      code,
      system: system.system,
      systemLabel: system.label,
      systemLabelMessage: system.labelMessage,
      standardization: standardization.standardization,
      standardizationLabel: standardization.label,
      title: known.title,
      titleMessage: profileMessages.title,
      likelyDiagnosticContext: known.likelyDiagnosticContext,
      customerExplanation: known.customerExplanation,
      customerExplanationMessage: profileMessages.explanation,
      recommendedChecks: known.recommendedChecks,
      missingInformation: baseMissing,
      missingInformationMessages: baseMissingMessages,
      confidence,
      confidenceReasons: codeConfidenceReasons({ code, confidence, hasKnownProfile }),
      evidence: codeEvidenceItems({
        code,
        system: system.system,
        systemLabel: system.label,
        standardizationEvidenceKey: standardization.evidenceKey,
        standardizationLabel: standardization.label,
        hasKnownProfile,
      }),
      riskFlags: codeRiskFlags({ code, system: system.system, hasKnownProfile }),
      recommendations: codeRecommendations({
        code,
        recommendedChecks: profileMessages.checks,
        missingInformation: baseMissingMessages,
      }),
      uncertainty: [
        "This is a deterministic text-only interpretation.",
        "Vehicle, ECU software, freeze-frame and live data can change the final diagnostic conclusion.",
      ],
    };
  }

  const confidence: DtcAnalyzerConfidence = "low";
  const recommendedChecks = [
    "Confirm the code with a professional scan tool and record current/stored status.",
    "Collect freeze-frame data and all companion DTCs.",
    "Provide vehicle, ECU and software details before any file-service decision.",
  ];
  const recommendedCheckMessages = recommendedChecks.map((check, index) =>
    message(`code.generic.check_${(index + 1) as 1 | 2 | 3}`, check)
  );
  const genericTitle = `${system.label} DTC context`;
  const genericExplanation =
    "The code format is valid, but this fallback has no trusted definition for the exact code. Treat it as a prompt for expert review, not as a confirmed diagnosis.";

  return {
    code,
    system: system.system,
    systemLabel: system.label,
    systemLabelMessage: system.labelMessage,
    standardization: standardization.standardization,
    standardizationLabel: standardization.label,
    title: genericTitle,
    titleMessage: message(`code.generic.${system.system}.title`, genericTitle),
    likelyDiagnosticContext: [
      `The code belongs to the ${system.label.toLowerCase()} diagnostic family.`,
      "A vehicle-specific service manual, scan data and related DTCs are required for a useful interpretation.",
    ],
    customerExplanation: genericExplanation,
    customerExplanationMessage: message(`code.generic.${system.system}.explanation`, genericExplanation),
    recommendedChecks,
    missingInformation: baseMissing,
    missingInformationMessages: baseMissingMessages,
    confidence,
    confidenceReasons: codeConfidenceReasons({ code, confidence, hasKnownProfile }),
    evidence: codeEvidenceItems({
      code,
      system: system.system,
      systemLabel: system.label,
      standardizationEvidenceKey: standardization.evidenceKey,
      standardizationLabel: standardization.label,
      hasKnownProfile,
    }),
    riskFlags: codeRiskFlags({ code, system: system.system, hasKnownProfile }),
    recommendations: codeRecommendations({
      code,
      recommendedChecks: recommendedCheckMessages,
      missingInformation: baseMissingMessages,
    }),
    uncertainty: [
      "No trusted local definition is available for this exact code.",
      "The same DTC can have different diagnostic meaning by manufacturer, engine and ECU software.",
    ],
  };
}

function overallConfidence(codes: DtcCodeAnalysis[]): DtcAnalyzerConfidence {
  if (codes.length === 0) return "none";
  return codes.every((code) => code.confidence === "medium") ? "medium" : "low";
}

function deterministicProviderIdentity(): DtcAnalyzerProviderIdentity {
  return {
    providerId: deterministicDtcFallbackProviderId,
    providerKind: "deterministic_rules",
    providerStatus: "ready",
    modelName: null,
    promptVersion: dtcAnalyzerPromptVersion,
  };
}

export function unavailableDtcProviderIdentity(reason: string): DtcAnalyzerProviderIdentity {
  return {
    providerId: unconfiguredDtcProviderId,
    providerKind: "unconfigured",
    providerStatus: "unavailable",
    modelName: null,
    promptVersion: null,
    unavailableReason: reason,
  };
}

export function erroredDtcProviderIdentity(provider: {
  providerId: string;
  providerKind: DtcAnalyzerProviderIdentity["providerKind"];
  modelName: string | null;
}): DtcAnalyzerProviderIdentity {
  return {
    providerId: provider.providerId,
    providerKind: provider.providerKind,
    providerStatus: "error",
    modelName: provider.modelName,
    promptVersion: null,
    unavailableReason: "Configured DTC analyzer provider failed locally.",
  };
}

export function buildProviderUnavailableDtcResponse(
  request: DtcAnalyzerRequest,
  reason = "No DTC AI provider is configured for local analysis."
): DtcAnalyzerResponse {
  const normalizedInput = normalizeDtcInput(request.text);
  const provider = unavailableDtcProviderIdentity(reason);

  return {
    contractVersion: dtcAnalyzerContractVersion,
    status: "provider_unavailable",
    provider,
    fallback: {
      used: false,
      providerId: deterministicDtcFallbackProviderId,
      reason: null,
    },
    isAiGenerated: false,
    confidence: "none",
    confidenceReasons: noConfidenceReason(
      "provider-unavailable-confidence-none",
      "No analysis confidence is assigned because the configured provider is unavailable and fallback was not used in this response."
    ),
    normalizedInput,
    summary: "DTC AI provider is unavailable. Use the deterministic fallback for local, non-AI guidance.",
    summaryMessage: message(
      "summary.provider_unavailable",
      "DTC AI provider is unavailable. Use the deterministic fallback for local, non-AI guidance."
    ),
    codes: [],
    evidence: providerStateEvidence(provider),
    riskFlags: providerStateRiskFlags(provider),
    recommendations: providerUnavailableRecommendations(),
    missingInformation: normalizedInput.invalidReason ? [] : commonMissingInformation,
    missingInformationMessages: normalizedInput.invalidReason ? [] : commonMissingInformationMessages,
    humanReview: {
      required: true,
      reason: "DTC analysis is unavailable until a provider is configured or the deterministic fallback is used.",
      requiredBefore,
      requiredBeforeMessages,
    },
    safetyBoundaries,
    safetyBoundaryMessages,
  };
}

export function buildInvalidDtcInputResponse(
  request: DtcAnalyzerRequest,
  normalizedInput = normalizeDtcInput(request.text)
): DtcAnalyzerResponse {
  const provider = deterministicProviderIdentity();

  return {
    contractVersion: dtcAnalyzerContractVersion,
    status: "invalid_input",
    provider,
    fallback: {
      used: true,
      providerId: deterministicDtcFallbackProviderId,
      reason: "Input validation handled by deterministic rules before any provider call.",
    },
    isAiGenerated: false,
    confidence: "none",
    confidenceReasons: noConfidenceReason(
      "invalid-input-confidence-none",
      "No confidence is assigned until at least one valid DTC code is detected."
    ),
    normalizedInput,
    summary: normalizedInput.invalidReason ?? "No valid DTC code was detected.",
    summaryMessage: !normalizedInput.hasText
      ? message("summary.invalid_empty", "Enter at least one diagnostic trouble code such as P0401.")
      : normalizedInput.invalidReason
        ? message(
            "summary.invalid_no_valid",
            "No valid SAE-style DTC code was detected. Use codes such as P0401, P2002 or U0100."
          )
        : message("summary.invalid_generic", "No valid DTC code was detected."),
    codes: [],
    evidence: invalidInputEvidence(normalizedInput),
    riskFlags: invalidInputRiskFlags(),
    recommendations: invalidInputRecommendations(),
    missingInformation: ["At least one valid DTC code such as P0401"],
    missingInformationMessages: [
      message("missing.valid_code", "At least one valid DTC code such as P0401"),
    ],
    humanReview: {
      required: true,
      reason: "A diagnostic code is required before useful DTC guidance can be prepared.",
      requiredBefore,
      requiredBeforeMessages,
    },
    safetyBoundaries,
    safetyBoundaryMessages,
  };
}

export function buildDeterministicDtcFallback(
  request: DtcAnalyzerRequest,
  input = normalizeDtcInput(request.text),
  options: {
    provider?: DtcAnalyzerProviderIdentity;
    reason?: string;
  } = {}
): DtcAnalyzerResponse {
  if (input.invalidReason) return buildInvalidDtcInputResponse(request, input);

  const codes = input.normalizedCodes.map(analyzeCode);
  const missingInformationMessages = uniqueMessages(
    codes.flatMap((code) => code.missingInformationMessages)
  );
  const missingInformation = missingInformationMessages.map((item) => item.fallback);
  const codeList = input.normalizedCodes.join(", ");
  const provider = options.provider ?? deterministicProviderIdentity();
  const fallbackReason = options.reason ?? "Deterministic non-AI fallback used for local DTC guidance.";
  const confidence = overallConfidence(codes);
  const evidence = uniqueAnalysisItems([
    ...codes.flatMap((code) => code.evidence),
    ...providerStateEvidence(provider),
  ]);
  const riskFlags = uniqueAnalysisItems([
    ...codes.flatMap((code) => code.riskFlags),
    ...providerStateRiskFlags(provider),
  ]);
  const recommendations = uniqueAnalysisItems(codes.flatMap((code) => code.recommendations));
  const confidenceReasons = uniqueAnalysisItems([
    ...overallConfidenceReasons(codes, confidence),
    ...codes.flatMap((code) => code.confidenceReasons),
  ]);

  return {
    contractVersion: dtcAnalyzerContractVersion,
    status: "fallback",
    provider,
    fallback: {
      used: true,
      providerId: deterministicDtcFallbackProviderId,
      reason: fallbackReason,
    },
    isAiGenerated: false,
    confidence,
    confidenceReasons,
    normalizedInput: input,
    summary: `Deterministic non-AI DTC fallback prepared guidance for ${codeList}. Human review remains required.`,
    summaryMessage: message(
      "summary.deterministic",
      `Deterministic non-AI DTC fallback prepared guidance for ${codeList}. Human review remains required.`,
      { codes: codeList }
    ),
    codes,
    evidence,
    riskFlags,
    recommendations,
    missingInformation,
    missingInformationMessages,
    humanReview: {
      required: true,
      reason:
        "A DTC code alone cannot confirm root cause, legal service suitability, file edits, checksums or customer-ready output.",
      requiredBefore,
      requiredBeforeMessages,
    },
    safetyBoundaries,
    safetyBoundaryMessages,
  };
}
