import type {
  DtcActiveFeatureFlags,
  DtcActiveHardVetoCode,
  DtcActiveModeStatus,
  DtcActiveOperatingMode,
} from "@/lib/dtcActive/types";

export const dtcActivePolicyVersion = "dtc-active-processing-policy-2.0.0";
export const dtcActiveContractVersion = "dtc-active-phase-a-v1" as const;

export const dtcActiveHardVetoCodes: readonly DtcActiveHardVetoCode[] = [
  "GLOBAL_KILL_SWITCH",
  "MODE_DISABLED",
  "SOURCE_INTEGRITY_FAILED",
  "UNAUTHORIZED_SOURCE_PROVENANCE",
  "UNKNOWN_CONTAINER",
  "UNSAFE_ARCHIVE",
  "SOURCE_HASH_MISMATCH",
  "FILE_ROLE_UNKNOWN",
  "EXACT_SW_NOT_ESTABLISHED",
  "WRONG_FILE_SIZE",
  "SEGMENT_MANIFEST_MISMATCH",
  "DEFINITION_NOT_EXACT",
  "RULE_NOT_APPROVED",
  "RULE_REVOKED",
  "ADAPTER_NOT_APPROVED",
  "ADAPTER_REVOKED",
  "SOURCE_BYTES_MISMATCH",
  "DUPLICATE_OR_AMBIGUOUS_MATCH",
  "MISSING_LINKED_STRUCTURE",
  "CONFLICTING_EVIDENCE",
  "UNSUPPORTED_OPERATION_TYPE",
  "OPERATION_OUT_OF_BOUNDS",
  "OPERATION_OVERLAP",
  "OPERATION_ALIGNMENT_FAILED",
  "ARBITRARY_SCRIPT_REJECTED",
  "UNSUPPORTED_CHECKSUM",
  "UNSUPPORTED_SIGNATURE",
  "OUTPUT_OUTSIDE_ALLOWLIST",
  "POST_VALIDATION_FAILED",
  "PREVIOUSLY_MODIFIED_INPUT",
  "RESTRICTED_DTC_CATEGORY",
  "REGRESSION_CORPUS_FAILED",
  "ENGINE_BUILD_NOT_RELEASED",
  "WORKER_INTEGRITY_FAILURE",
  "LEASE_FENCING_FAILURE",
  "AUDIT_COMMIT_FAILED",
  "PUBLICATION_POLICY_FAILED",
] as const;

const falseText = new Set(["0", "false", "no", "off", "disabled"]);
const trueText = new Set(["1", "true", "yes", "on", "enabled"]);

function envFlag(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: boolean
) {
  const value = env[key]?.trim().toLowerCase();
  if (!value) return fallback;
  if (trueText.has(value)) return true;
  if (falseText.has(value)) return false;
  return fallback;
}

function isProductionLike(env: NodeJS.ProcessEnv) {
  return env.VERCEL_ENV === "production" || env.NODE_ENV === "production";
}

export function resolveDtcActiveFeatureFlags(
  env: NodeJS.ProcessEnv = process.env
): DtcActiveFeatureFlags {
  const productionLike = isProductionLike(env);

  return {
    dtcReadOnlyFoundation: envFlag(env, "DTC_READ_ONLY_FOUNDATION", true),
    dtcInternalTestProcessing: envFlag(env, "DTC_INTERNAL_TEST_PROCESSING", false),
    dtcSyntheticFixtures: envFlag(env, "DTC_SYNTHETIC_FIXTURES", false),
    dtcAuthorizedLabFirmware: envFlag(env, "DTC_AUTHORIZED_LAB_FIRMWARE", false),
    dtcA3ProductionProcessing: envFlag(env, "DTC_A3_PRODUCTION_PROCESSING", false),
    dtcA4Automation: envFlag(env, "DTC_A4_AUTOMATION", false),
    dtcA5Automation: envFlag(env, "DTC_A5_AUTOMATION", false),
    dtcCustomerDelivery: envFlag(env, "DTC_CUSTOMER_DELIVERY", false),
    dtcRealEcuRules: envFlag(env, "DTC_REAL_ECU_RULES", false),
    dtcRealIntegrityAdapters: envFlag(env, "DTC_REAL_INTEGRITY_ADAPTERS", false),
    dtcInstructionPatchOperations: envFlag(env, "DTC_INSTRUCTION_PATCH_OPERATIONS", false),
    globalDtcKillSwitchEngaged: envFlag(
      env,
      "DTC_GLOBAL_KILL_SWITCH_ENGAGED",
      productionLike
    ),
  };
}

export function evaluateDtcActiveModeStatus(
  flags: DtcActiveFeatureFlags,
  mode: DtcActiveOperatingMode
): DtcActiveModeStatus {
  if (mode === "READ_ONLY") {
    return {
      mode,
      mutationAllowed: false,
      publicationAllowed: false,
      enabled: flags.dtcReadOnlyFoundation,
      hardVetoes: flags.dtcReadOnlyFoundation ? [] : ["MODE_DISABLED"],
      notes: [
        "Phase A exposes status, policy, reconciliation and customer-safe projection only.",
        "No binary output, checksum correction, customer delivery or rule execution is available.",
      ],
    };
  }

  if (mode === "INTERNAL_TEST_PROCESSING") {
    const enabled =
      flags.dtcInternalTestProcessing &&
      flags.dtcSyntheticFixtures &&
      !flags.globalDtcKillSwitchEngaged;
    return {
      mode,
      mutationAllowed: true,
      publicationAllowed: false,
      enabled,
      hardVetoes: enabled ? [] : [
        ...(flags.globalDtcKillSwitchEngaged ? ["GLOBAL_KILL_SWITCH" as const] : []),
        ...(!flags.dtcInternalTestProcessing || !flags.dtcSyntheticFixtures
          ? ["MODE_DISABLED" as const]
          : []),
      ],
      notes: [
        "Internal test processing is limited to Phase B synthetic dry-run reports.",
        "It never mutates firmware, runs integrity adapters, creates artifacts or publishes to customers.",
      ],
    };
  }

  const enabled =
    flags.dtcA3ProductionProcessing &&
    flags.dtcCustomerDelivery &&
    flags.dtcRealEcuRules &&
    flags.dtcRealIntegrityAdapters &&
    !flags.dtcA4Automation &&
    !flags.dtcA5Automation &&
    !flags.globalDtcKillSwitchEngaged;

  return {
    mode,
    mutationAllowed: true,
    publicationAllowed: true,
    enabled,
    hardVetoes: enabled ? [] : [
      ...(flags.globalDtcKillSwitchEngaged ? ["GLOBAL_KILL_SWITCH" as const] : []),
      ...(!flags.dtcA3ProductionProcessing ||
      !flags.dtcCustomerDelivery ||
      !flags.dtcRealEcuRules ||
      !flags.dtcRealIntegrityAdapters
        ? ["MODE_DISABLED" as const]
        : []),
    ],
    notes: [
      "Controlled production processing is intentionally unavailable in Phase A.",
      "A4/A5 automation, real ECU rules and customer delivery require later explicit review.",
    ],
  };
}

export function buildDtcActiveModes(flags: DtcActiveFeatureFlags) {
  return ([
    "READ_ONLY",
    "INTERNAL_TEST_PROCESSING",
    "CONTROLLED_PRODUCTION_PROCESSING",
  ] as const).map((mode) => evaluateDtcActiveModeStatus(flags, mode));
}
