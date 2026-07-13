import type {
  DtcAnalyzerConfidence,
  DtcAnalyzerNormalizedInput,
  DtcAnalyzerProviderIdentity,
  DtcAnalyzerRequest,
  DtcAnalyzerResponse,
  DtcCodeAnalysis,
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

const safetyBoundaries = [
  "This is diagnostic guidance only and does not confirm a root cause, fix or legal suitability.",
  "It does not approve DTC-off, emissions removal, byte patching, checksum work or MOD generation.",
  "Human diagnostic and tuner review is required before any customer file action.",
];

const commonMissingInformation = [
  "Vehicle brand, model, engine and model year",
  "ECU family, software number and read method",
  "Freeze-frame data, current/stored status and fault frequency",
  "Related DTCs and live data around airflow, boost, temperature and sensor plausibility",
  "Hardware condition and whether emissions components are present and functional",
];

type KnownDtcProfile = {
  title: string;
  likelyDiagnosticContext: string[];
  customerExplanation: string;
  recommendedChecks: string[];
  missingInformation?: string[];
};

const knownDtcProfiles: Record<string, KnownDtcProfile> = {
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

function systemFor(code: string): { system: DtcSystem; label: string } {
  const prefix = code[0];
  if (prefix === "P") return { system: "powertrain", label: "Powertrain" };
  if (prefix === "C") return { system: "chassis", label: "Chassis" };
  if (prefix === "B") return { system: "body", label: "Body" };
  return { system: "network", label: "Network communication" };
}

function standardizationFor(code: string): { standardization: DtcStandardization; label: string } {
  const scope = code[1];
  if (scope === "0") {
    return { standardization: "sae_or_iso_generic", label: "SAE/ISO generic range" };
  }
  if (scope === "1") {
    return { standardization: "manufacturer_specific", label: "Manufacturer-specific range" };
  }
  return { standardization: "mixed_or_reserved", label: "Generic/manufacturer-specific range; verify with vehicle data" };
}

function analyzeCode(code: string): DtcCodeAnalysis {
  const system = systemFor(code);
  const standardization = standardizationFor(code);
  const known = knownDtcProfiles[code];
  const baseMissing = known?.missingInformation
    ? uniqueInOrder([...known.missingInformation, ...commonMissingInformation])
    : commonMissingInformation;

  if (known) {
    return {
      code,
      system: system.system,
      systemLabel: system.label,
      standardization: standardization.standardization,
      standardizationLabel: standardization.label,
      title: known.title,
      likelyDiagnosticContext: known.likelyDiagnosticContext,
      customerExplanation: known.customerExplanation,
      recommendedChecks: known.recommendedChecks,
      missingInformation: baseMissing,
      confidence: "medium",
      uncertainty: [
        "This is a deterministic text-only interpretation.",
        "Vehicle, ECU software, freeze-frame and live data can change the final diagnostic conclusion.",
      ],
    };
  }

  return {
    code,
    system: system.system,
    systemLabel: system.label,
    standardization: standardization.standardization,
    standardizationLabel: standardization.label,
    title: `${system.label} DTC context`,
    likelyDiagnosticContext: [
      `The code belongs to the ${system.label.toLowerCase()} diagnostic family.`,
      "A vehicle-specific service manual, scan data and related DTCs are required for a useful interpretation.",
    ],
    customerExplanation:
      "The code format is valid, but this fallback has no trusted definition for the exact code. Treat it as a prompt for expert review, not as a confirmed diagnosis.",
    recommendedChecks: [
      "Confirm the code with a professional scan tool and record current/stored status.",
      "Collect freeze-frame data and all companion DTCs.",
      "Provide vehicle, ECU and software details before any file-service decision.",
    ],
    missingInformation: baseMissing,
    confidence: "low",
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

  return {
    contractVersion: dtcAnalyzerContractVersion,
    status: "provider_unavailable",
    provider: unavailableDtcProviderIdentity(reason),
    fallback: {
      used: false,
      providerId: deterministicDtcFallbackProviderId,
      reason: null,
    },
    isAiGenerated: false,
    confidence: "none",
    normalizedInput,
    summary: "DTC AI provider is unavailable. Use the deterministic fallback for local, non-AI guidance.",
    codes: [],
    missingInformation: normalizedInput.invalidReason ? [] : commonMissingInformation,
    humanReview: {
      required: true,
      reason: "DTC analysis is unavailable until a provider is configured or the deterministic fallback is used.",
      requiredBefore: ["customer file advice", "DTC-off decision", "checksum or MOD-file work"],
    },
    safetyBoundaries,
  };
}

export function buildInvalidDtcInputResponse(
  request: DtcAnalyzerRequest,
  normalizedInput = normalizeDtcInput(request.text)
): DtcAnalyzerResponse {
  return {
    contractVersion: dtcAnalyzerContractVersion,
    status: "invalid_input",
    provider: deterministicProviderIdentity(),
    fallback: {
      used: true,
      providerId: deterministicDtcFallbackProviderId,
      reason: "Input validation handled by deterministic rules before any provider call.",
    },
    isAiGenerated: false,
    confidence: "none",
    normalizedInput,
    summary: normalizedInput.invalidReason ?? "No valid DTC code was detected.",
    codes: [],
    missingInformation: ["At least one valid DTC code such as P0401"],
    humanReview: {
      required: true,
      reason: "A diagnostic code is required before useful DTC guidance can be prepared.",
      requiredBefore: ["customer file advice", "DTC-off decision", "checksum or MOD-file work"],
    },
    safetyBoundaries,
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
  const missingInformation = uniqueInOrder(codes.flatMap((code) => code.missingInformation));
  const codeList = input.normalizedCodes.join(", ");
  const provider = options.provider ?? deterministicProviderIdentity();

  return {
    contractVersion: dtcAnalyzerContractVersion,
    status: "fallback",
    provider,
    fallback: {
      used: true,
      providerId: deterministicDtcFallbackProviderId,
      reason: options.reason ?? "Deterministic non-AI fallback used for local DTC guidance.",
    },
    isAiGenerated: false,
    confidence: overallConfidence(codes),
    normalizedInput: input,
    summary: `Deterministic non-AI DTC fallback prepared guidance for ${codeList}. Human review remains required.`,
    codes,
    missingInformation,
    humanReview: {
      required: true,
      reason:
        "A DTC code alone cannot confirm root cause, legal service suitability, file edits, checksums or customer-ready output.",
      requiredBefore: ["customer file advice", "DTC-off decision", "checksum or MOD-file work"],
    },
    safetyBoundaries,
  };
}
