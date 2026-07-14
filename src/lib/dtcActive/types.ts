export type DtcActiveOperatingMode =
  | "READ_ONLY"
  | "INTERNAL_TEST_PROCESSING"
  | "CONTROLLED_PRODUCTION_PROCESSING";

export type DtcActiveAutomationClass = "A0" | "A1" | "A2" | "A3" | "A4" | "A5";

export type DtcActivePublicStatus =
  | "analyzing"
  | "expert_review"
  | "eligible"
  | "processing"
  | "completed"
  | "unsupported"
  | "action_required"
  | "failed_safely";

export type DtcActiveRiskCategory =
  | "ordinary_non_restricted"
  | "emissions_and_regulatory"
  | "safety_critical"
  | "security_related"
  | "powertrain_protection"
  | "unknown"
  | "synthetic_test_only";

export type DtcActiveHardVetoCode =
  | "GLOBAL_KILL_SWITCH"
  | "MODE_DISABLED"
  | "SOURCE_INTEGRITY_FAILED"
  | "UNAUTHORIZED_SOURCE_PROVENANCE"
  | "UNKNOWN_CONTAINER"
  | "UNSAFE_ARCHIVE"
  | "SOURCE_HASH_MISMATCH"
  | "FILE_ROLE_UNKNOWN"
  | "EXACT_SW_NOT_ESTABLISHED"
  | "WRONG_FILE_SIZE"
  | "SEGMENT_MANIFEST_MISMATCH"
  | "DEFINITION_NOT_EXACT"
  | "RULE_NOT_APPROVED"
  | "RULE_REVOKED"
  | "ADAPTER_NOT_APPROVED"
  | "ADAPTER_REVOKED"
  | "SOURCE_BYTES_MISMATCH"
  | "DUPLICATE_OR_AMBIGUOUS_MATCH"
  | "MISSING_LINKED_STRUCTURE"
  | "CONFLICTING_EVIDENCE"
  | "UNSUPPORTED_OPERATION_TYPE"
  | "OPERATION_OUT_OF_BOUNDS"
  | "OPERATION_OVERLAP"
  | "OPERATION_ALIGNMENT_FAILED"
  | "ARBITRARY_SCRIPT_REJECTED"
  | "UNSUPPORTED_CHECKSUM"
  | "UNSUPPORTED_SIGNATURE"
  | "OUTPUT_OUTSIDE_ALLOWLIST"
  | "POST_VALIDATION_FAILED"
  | "PREVIOUSLY_MODIFIED_INPUT"
  | "RESTRICTED_DTC_CATEGORY"
  | "REGRESSION_CORPUS_FAILED"
  | "ENGINE_BUILD_NOT_RELEASED"
  | "WORKER_INTEGRITY_FAILURE"
  | "LEASE_FENCING_FAILURE"
  | "AUDIT_COMMIT_FAILED"
  | "PUBLICATION_POLICY_FAILED";

export type DtcActiveFeatureFlags = {
  dtcReadOnlyFoundation: boolean;
  dtcInternalTestProcessing: boolean;
  dtcSyntheticFixtures: boolean;
  dtcAuthorizedLabFirmware: boolean;
  dtcA3ProductionProcessing: boolean;
  dtcA4Automation: boolean;
  dtcA5Automation: boolean;
  dtcCustomerDelivery: boolean;
  dtcRealEcuRules: boolean;
  dtcRealIntegrityAdapters: boolean;
  dtcInstructionPatchOperations: boolean;
  globalDtcKillSwitchEngaged: boolean;
};

export type DtcActiveModeStatus = {
  mode: DtcActiveOperatingMode;
  mutationAllowed: boolean;
  publicationAllowed: boolean;
  enabled: boolean;
  hardVetoes: DtcActiveHardVetoCode[];
  notes: string[];
};

export type NormalizedActiveDtcCode = {
  raw: string;
  code: string;
  valid: true;
  system: "powertrain" | "body" | "chassis" | "network";
  namespace: "generic" | "manufacturer_specific" | "reserved_or_mixed";
  riskCategory: DtcActiveRiskCategory;
  requiresManualReview: boolean;
};

export type RejectedActiveDtcCode = {
  raw: string;
  valid: false;
  reason: "malformed" | "too_many_codes";
};

export type DtcActiveCodeNormalizationResult = {
  codes: NormalizedActiveDtcCode[];
  rejected: RejectedActiveDtcCode[];
  maxCodes: number;
};

export type CustomerDtcActiveStatus = {
  requestId: string;
  status: DtcActivePublicStatus;
  requestedCodes: string[];
  customerMessage: string;
  downloadable: false;
  updatedAt: string;
};

export type DtcActiveFoundationStatus = {
  contractVersion: "dtc-active-phase-a-v1";
  phase: "A";
  policyVersion: string;
  repositoryMode: "read_only_foundation";
  serverAuthority: true;
  customerDeliveryEnabled: false;
  realEcuRulesEnabled: false;
  checksumAdaptersEnabled: false;
  productionAutomationEnabled: false;
  effectiveFlags: DtcActiveFeatureFlags;
  modes: DtcActiveModeStatus[];
  disabledCapabilities: string[];
  safeCapabilities: string[];
  adminPermission: "ai_training.manage";
  migration: {
    status: "database_verified_local_not_production_applied";
    file: "scripts/add-dtc-active-processing-phase-a.sql";
    localVerification:
      | "blocked_docker_daemon_unavailable"
      | "database_verified_local_disposable"
      | "blocked_supabase_cli_missing"
      | "not_run";
  };
  researchPackage: {
    sourcePath: "mg-autotech-dtc-active-processing-v2";
    hashManifestPath: "docs/dtc-active/research-package/SHA256SUMS.txt";
    packageManifestPath: "docs/dtc-active/research-package/PACKAGE_MANIFEST.json";
  };
  phaseB: {
    status: "synthetic_dry_run_foundation";
    syntheticOnly: true;
    ruleCount: number;
    adapterCount: number;
    corpusCaseCount: number;
    positiveCorpusCases: number;
    negativeCorpusCases: number;
    dryRunReportsEnabled: true;
    firmwareMutationEnabled: false;
    outputArtifactGenerationEnabled: false;
    integrityAdapterExecutionEnabled: false;
    customerDeliveryEnabled: false;
    sampleReport: {
      success: boolean;
      requestedCodes: string[];
      operationCount: number;
      hardVetoes: DtcActiveHardVetoCode[];
      outputArtifactCreated: false;
      firmwareBytesMutated: false;
    };
  };
};
