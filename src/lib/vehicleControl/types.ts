export type StageData = {
  stockHp: number | null;
  tunedHp: number | null;
  gainHp: number | null;
  stockNm: number | null;
  tunedNm: number | null;
  gainNm: number | null;
};

export const vehiclePerformanceStages = ["stage1", "stage2", "stage3"] as const;
export type VehiclePerformanceStage = (typeof vehiclePerformanceStages)[number];

export type VehiclePerformanceProfile = StageData & {
  stage: VehiclePerformanceStage;
  active: boolean;
  published: boolean;
};

export type VehiclePerformanceProfileInput = {
  stage: VehiclePerformanceStage;
  tunedHp: number | null;
  tunedNm: number | null;
  active?: boolean;
};

export type RawVehicleRow = {
  source?: string;
  sourceUrl?: string;
  brand: string;
  brandId?: string;
  model: string;
  modelId?: string;
  generation: string;
  generationId?: string;
  engine: string;
  engineId?: string;
  fuelType?: string | null;
  ecu?: string[];
  stage1?: StageData | null;
  stage2?: StageData | null;
  stage3?: StageData | null;
  readMethods?: string[];
  services?: string[];
  imageUrl?: string | null;
  scrapedAt?: string;
};

export type VerificationStatus = "imported" | "unverified" | "needs_review" | "verified" | "rejected";
export type PublishStatus = "draft" | "published" | "archived";
export type VehicleAdminPublishFilter = "all" | PublishStatus;
export type VehicleAdminVerificationFilter = "all" | VerificationStatus;

export const vehicleAdminPageSizes = [25, 50, 100] as const;
export type VehicleAdminPageSize = (typeof vehicleAdminPageSizes)[number];

export type VehicleAdminListQuery = {
  page: number;
  pageSize: VehicleAdminPageSize;
  q: string;
  brand: string;
  model: string;
  generation: string;
  ecuFamily: string;
  publishStatus: VehicleAdminPublishFilter;
  verificationStatus: VehicleAdminVerificationFilter;
};
export type VehicleServiceKey =
  | "stage1"
  | "stage2"
  | "stage3"
  | "dpf_off"
  | "egr_off"
  | "adblue_off"
  | "dtc_off"
  | "vmax_off"
  | "start_stop_off"
  | "tcu_tune"
  | "tcu_shift"
  | "tcu_lockup"
  | "pop_bangs"
  | "launch_control";

export const vehicleServiceKeys: VehicleServiceKey[] = [
  "stage1",
  "stage2",
  "stage3",
  "dpf_off",
  "egr_off",
  "adblue_off",
  "dtc_off",
  "vmax_off",
  "start_stop_off",
  "tcu_tune",
  "tcu_shift",
  "tcu_lockup",
  "pop_bangs",
  "launch_control",
];

export const vehicleServiceLabels: Record<VehicleServiceKey, string> = {
  stage1: "Stage 1",
  stage2: "Stage 2",
  stage3: "Stage 3",
  dpf_off: "DPF OFF",
  egr_off: "EGR OFF",
  adblue_off: "AdBlue OFF",
  dtc_off: "DTC OFF",
  vmax_off: "VMAX OFF",
  start_stop_off: "Start-Stop OFF",
  tcu_tune: "TCU Tune",
  tcu_shift: "TCU Shift",
  tcu_lockup: "TCU Lock-up",
  pop_bangs: "Pop and Bangs",
  launch_control: "Launch Control",
};

export type VehicleControlRecord = {
  id?: string;
  brand: string;
  brandId?: string | null;
  model: string;
  modelId?: string | null;
  generation: string;
  generationId?: string | null;
  generationRecordId?: string | null;
  engine: string;
  engineId?: string | null;
  vehicleKey: string;
  displayName: string;
  yearFrom: number | null;
  yearTo: number | null;
  faceliftLabel: string | null;
  isLci: boolean;
  fuelType: string | null;
  displacementCc: number | null;
  stockHp: number | null;
  stockNm: number | null;
  tunedHp: number | null;
  tunedNm: number | null;
  performanceProfiles?: VehiclePerformanceProfile[];
  ecuVariantId?: string | null;
  ecuFamily: string | null;
  ecuType: string | null;
  ecuHardware: string | null;
  ecuSoftware: string | null;
  ecuNotes: string | null;
  protectionNotes: string | null;
  unlockNotes: string | null;
  gearboxType: string | null;
  tcuType: string | null;
  tcuNotes: string | null;
  services: VehicleServiceKey[];
  readMethods: string[];
  customerSafeNotes: string | null;
  adminTechnicalNotes: string | null;
  sourceType: string;
  sourceReference: string | null;
  sourceUrl: string | null;
  confidenceScore: number;
  verificationStatus: VerificationStatus;
  publishStatus: PublishStatus;
  active: boolean;
  published: boolean;
  updatedAt?: string | null;
  createdAt?: string | null;
};

export type VehicleAdminListRecord = Pick<VehicleControlRecord,
  | "id"
  | "brand"
  | "model"
  | "generation"
  | "engine"
  | "vehicleKey"
  | "yearFrom"
  | "yearTo"
  | "ecuFamily"
  | "ecuType"
  | "services"
  | "confidenceScore"
  | "verificationStatus"
  | "publishStatus"
> & {
  stages: VehiclePerformanceStage[];
};

export type VehicleAdminListResponse = {
  records: VehicleAdminListRecord[];
  pagination: {
    page: number;
    pageSize: VehicleAdminPageSize;
    total: number;
    pageCount: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
  query: VehicleAdminListQuery;
};

export type PublicVehicleRecord = {
  id: string;
  brand: string;
  brandId: string;
  model: string;
  modelId: string;
  generation: string;
  generationId: string;
  engine: string;
  engineId: string;
  fuelType: string | null;
  ecu: string[];
  stage1: StageData | null;
  stage2: StageData | null;
  stage3: StageData | null;
  readMethods: string[];
  services: string[];
  vehicleKey?: string;
  customerSafeNotes?: string | null;
};

export type PublicVehicleOption = {
  id: string;
  name: string;
  fuelType?: string | null;
};

export type PublicVehicleCatalogPayload = {
  version: 1;
  generatedAt: string;
  rows: PublicVehicleRecord[];
  brands: PublicVehicleOption[];
  modelsByBrand: Record<string, PublicVehicleOption[]>;
  generationsByModel: Record<string, PublicVehicleOption[]>;
  enginesByGeneration: Record<string, PublicVehicleOption[]>;
};

export type PublicVehicleCatalogSource = "cache" | "database" | "json";

export type PublicVehicleCatalogResult = {
  source: PublicVehicleCatalogSource;
  payload: PublicVehicleCatalogPayload;
  rows: PublicVehicleRecord[];
  expiresAt: number;
};

export type PublicVehicleCatalogRebuildResult = {
  ok: true;
  id: "published";
  sourceHash: string;
  brandCount: number;
  modelCount: number;
  generationCount: number;
  engineCount: number;
  generatedAt: string;
};

export type VehicleValidationIssue = {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  vehicleKey?: string | null;
  entityType?: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

export type VehicleImportSummary = {
  dryRun: boolean;
  mode?: "valid_only";
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  duplicates: number;
  duplicateExtraRows?: number;
  skippedDuplicate?: number;
  skippedInvalid?: number;
  validImportableCount?: number;
  needsReviewCount?: number;
  protectedManualVerifiedCount?: number;
  warningCount?: number;
  infoCount?: number;
  dbDiffCalculated?: boolean;
  aliasMappings?: Array<{
    vehicleKey: string;
    source: {
      brand: string;
      model: string;
      generation: string;
      engine: string;
    };
    canonical: {
      brand: string;
      model: string;
      generation: string;
      engine: string;
      vehicleKey: string;
    };
    matchedAliases: string[];
    action: "reuse_canonical" | "canonical_key_changed" | "no_alias";
  }>;
  aliasWarningCount?: number;
  warnings: VehicleValidationIssue[];
  examples?: {
    duplicates?: Array<{
      vehicleKey: string;
      count: number;
      records: Array<Pick<VehicleControlRecord, "brand" | "model" | "generation" | "engine" | "ecuType" | "stockHp" | "stockNm" | "tunedHp" | "tunedNm" | "services">>;
    }>;
    invalid?: Array<{
      vehicleKey: string | null;
      reason: string;
      issueCodes: string[];
      record: Pick<VehicleControlRecord, "brand" | "model" | "generation" | "engine" | "ecuType" | "stockHp" | "stockNm" | "tunedHp" | "tunedNm" | "services"> | null;
    }>;
    warnings?: Array<{
      vehicleKey: string | null;
      reason: string;
      issueCodes: string[];
      record: Pick<VehicleControlRecord, "brand" | "model" | "generation" | "engine" | "ecuType" | "stockHp" | "stockNm" | "tunedHp" | "tunedNm" | "services"> | null;
    }>;
    protectedManualVerified?: Array<{
      vehicleKey: string;
      reason: string;
    }>;
  };
  sampleRecords: VehicleControlRecord[];
  batchId?: string | null;
};
