export const desktopUploadMaxFileSize = 32 * 1024 * 1024;

export const desktopUploadAllowedExtensions = [
  ".bin",
  ".ori",
  ".mod",
  ".frf",
  ".hex",
  ".zip",
  ".sgo",
] as const;

export type DesktopPrimaryServiceId =
  | "only_options"
  | "stage_1"
  | "stage_2"
  | "stage_3"
  | "eco_tuning"
  | "tcu_stage_1"
  | "tcu_stage_2"
  | "tcu_stage_3"
  | "original_file";

export type DesktopExtraServiceId =
  | "dpf_off"
  | "egr_off"
  | "adblue_off"
  | "dpf_egr_off"
  | "dpf_adblue_off"
  | "egr_adblue_off"
  | "dpf_egr_adblue_off"
  | "opf_gpf_off"
  | "nox_off"
  | "lambda_o2_off"
  | "lambda_o2_gpf_off"
  | "decat"
  | "additive_off"
  | "vmax_off"
  | "limited_vmax"
  | "launch_control"
  | "hardcut_diesel"
  | "pops_bangs"
  | "pops_bangs_sport"
  | "pops_bangs_ac"
  | "upshift_farts"
  | "performance_gauge"
  | "map_switch"
  | "multi_map"
  | "burble_map"
  | "flex_fuel"
  | "start_stop"
  | "cold_start"
  | "hot_start_fix"
  | "swirl_flaps"
  | "exhaust_flaps"
  | "tva_off"
  | "cylinder_on_demand"
  | "maf_off"
  | "map_sensor_calibration"
  | "coolant_thermostat"
  | "water_pump"
  | "dtc_off"
  | "file_check"
  | "checksum"
  | "file_expertise"
  | "readout_verification"
  | "software_version_check"
  | "ecu_recovery"
  | "original_backup_check"
  | "priority_processing"
  | "same_day_processing"
  | "log_file_review"
  | "dyno_report_review"
  | "smoke_limiter"
  | "torque_monitoring"
  | "gearbox_torque_limit"
  | "remote_support"
  | "special_request";

export type DesktopServiceOption<TId extends string = string> = {
  id: TId;
  title: string;
  credits: number;
  description?: string;
};

export type DesktopServiceCategory = {
  id: string;
  title: string;
  description: string;
  services: Array<DesktopServiceOption<DesktopExtraServiceId>>;
};

export const desktopPrimaryServices: Array<DesktopServiceOption<DesktopPrimaryServiceId>> = [
  { id: "only_options", title: "Only Options", credits: 0, description: "Only selected software options without stage tuning." },
  { id: "stage_1", title: "Stage 1", credits: 10, description: "Safe performance optimization for stock vehicles." },
  { id: "stage_2", title: "Stage 2", credits: 15, description: "For vehicles with hardware modifications." },
  { id: "stage_3", title: "Stage 3", credits: 30, description: "For heavily modified setups, manual review recommended." },
  { id: "eco_tuning", title: "ECO Tuning", credits: 8, description: "Fuel economy optimization with smooth drivability." },
  { id: "tcu_stage_1", title: "TCU Stage 1", credits: 15, description: "Gearbox software optimization for standard transmission setups." },
  { id: "tcu_stage_2", title: "TCU Stage 2", credits: 20, description: "Advanced gearbox calibration for performance-focused setups." },
  { id: "tcu_stage_3", title: "TCU Stage 3", credits: 30, description: "Custom gearbox calibration for heavily modified setups." },
  { id: "original_file", title: "Original File", credits: 4, description: "Original / stock file request." },
];

export const desktopExtraServiceCategories: DesktopServiceCategory[] = [
  {
    id: "emissions",
    title: "Emission / Aftertreatment Solutions",
    description: "DPF, EGR, AdBlue, OPF/GPF, NOx and related emission system solutions.",
    services: [
      { id: "dpf_off", title: "DPF Removal", credits: 6 },
      { id: "egr_off", title: "EGR / AGR Removal", credits: 6 },
      { id: "adblue_off", title: "AdBlue / SCR Removal", credits: 11 },
      { id: "dpf_egr_off", title: "DPF + EGR Removal", credits: 9 },
      { id: "dpf_adblue_off", title: "DPF + AdBlue Removal", credits: 14 },
      { id: "egr_adblue_off", title: "EGR + AdBlue Removal", credits: 11 },
      { id: "dpf_egr_adblue_off", title: "DPF + EGR + AdBlue Removal", credits: 15 },
      { id: "opf_gpf_off", title: "GPF / OPF Removal", credits: 12 },
      { id: "nox_off", title: "NOx Removal", credits: 4 },
      { id: "lambda_o2_off", title: "Lambda / O2 Removal", credits: 5 },
      { id: "lambda_o2_gpf_off", title: "Lambda / O2 + GPF / OPF Removal", credits: 12 },
      { id: "decat", title: "Decat / CAT Removal", credits: 6 },
      { id: "additive_off", title: "Additive Removal", credits: 6 },
    ],
  },
  {
    id: "performance",
    title: "Performance & Driving Features",
    description: "Performance features, speed limiter, launch control and driving behavior options.",
    services: [
      { id: "vmax_off", title: "Speed Limit Removal / VMAX OFF", credits: 5 },
      { id: "limited_vmax", title: "Limited VMAX to Specific Speed", credits: 6 },
      { id: "launch_control", title: "Launch Control", credits: 10 },
      { id: "hardcut_diesel", title: "Hard Cut Limiter (Diesel)", credits: 8 },
      { id: "pops_bangs", title: "Pop and Bangs", credits: 8 },
      { id: "pops_bangs_sport", title: "Pop and Bangs Sport Button", credits: 9 },
      { id: "pops_bangs_ac", title: "Pop and Bangs AC Button", credits: 9 },
      { id: "upshift_farts", title: "Upshift Farts", credits: 8 },
      { id: "performance_gauge", title: "Performance Gauge BMW / Mini / VAG", credits: 4 },
      { id: "map_switch", title: "Map Switch", credits: 60 },
      { id: "multi_map", title: "Multi Map Setup", credits: 12 },
      { id: "burble_map", title: "Burble Map", credits: 8 },
      { id: "flex_fuel", title: "Flex Fuel / Ethanol Setup", credits: 10 },
    ],
  },
  {
    id: "engine_functions",
    title: "Engine Function Solutions",
    description: "Engine behavior, cold start, flap systems, sensors and special function solutions.",
    services: [
      { id: "start_stop", title: "Start / Stop Removal", credits: 5 },
      { id: "cold_start", title: "Cold Start Removal", credits: 4 },
      { id: "hot_start_fix", title: "Hot Start Fix", credits: 8 },
      { id: "swirl_flaps", title: "Swirl Flaps Removal", credits: 5 },
      { id: "exhaust_flaps", title: "Exhaust Flaps Removal", credits: 4 },
      { id: "tva_off", title: "TVA Removal", credits: 5 },
      { id: "cylinder_on_demand", title: "Cylinder On Demand Removal", credits: 4 },
      { id: "maf_off", title: "MAF Removal", credits: 4 },
      { id: "map_sensor_calibration", title: "Map Sensor Calibration", credits: 5 },
      { id: "coolant_thermostat", title: "Coolant Temperature Control / Thermostat", credits: 6 },
      { id: "water_pump", title: "Water Pump Removal", credits: 5 },
    ],
  },
  {
    id: "diagnostics",
    title: "Diagnostics & File Services",
    description: "File checking, DTC solutions, checksum and technical verification.",
    services: [
      { id: "dtc_off", title: "DTC Removal", credits: 4 },
      { id: "file_check", title: "File Check", credits: 2 },
      { id: "checksum", title: "Checksum Correction", credits: 2 },
      { id: "file_expertise", title: "File Expertise", credits: 17 },
      { id: "readout_verification", title: "Readout Verification", credits: 2 },
      { id: "software_version_check", title: "Software Version Check", credits: 2 },
      { id: "ecu_recovery", title: "ECU Recovery Support", credits: 10 },
      { id: "original_backup_check", title: "Original Backup Check", credits: 4 },
    ],
  },
  {
    id: "support_addons",
    title: "Professional Support Add-ons",
    description: "Priority handling, log review and technical support add-ons for complex jobs.",
    services: [
      { id: "priority_processing", title: "Priority Processing", credits: 5 },
      { id: "same_day_processing", title: "Same Day Processing", credits: 10 },
      { id: "log_file_review", title: "Log File Review", credits: 5 },
      { id: "dyno_report_review", title: "Dyno Report Review", credits: 5 },
      { id: "smoke_limiter", title: "Smoke Limiter Optimization", credits: 6 },
      { id: "torque_monitoring", title: "Torque Monitoring", credits: 6 },
      { id: "gearbox_torque_limit", title: "Gearbox Torque Limit Adjustment", credits: 8 },
      { id: "remote_support", title: "Remote Support Session", credits: 8 },
      { id: "special_request", title: "Special Request / Other", credits: 0 },
    ],
  },
];

const allExtraServices = desktopExtraServiceCategories.flatMap((category) => category.services);

export function findDesktopPrimaryService(id: string) {
  return desktopPrimaryServices.find((service) => service.id === id) ?? null;
}

export function findDesktopExtraService(id: string) {
  return allExtraServices.find((service) => service.id === id) ?? null;
}

export function calculateDesktopRequestCredits(primaryServiceId: string, extraServiceIds: string[]) {
  const primary = findDesktopPrimaryService(primaryServiceId);
  if (!primary) throw new Error("Invalid primary service.");
  const uniqueExtraIds = [...new Set(extraServiceIds)];
  const extras = uniqueExtraIds.map((id) => {
    const service = findDesktopExtraService(id);
    if (!service) throw new Error(`Invalid extra service: ${id}`);
    return service;
  });
  return primary.credits + extras.reduce((sum, service) => sum + service.credits, 0);
}

export function buildDesktopServiceSummary(primaryServiceId: string, extraServiceIds: string[]) {
  const primary = findDesktopPrimaryService(primaryServiceId);
  if (!primary) throw new Error("Invalid primary service.");
  const extras = [...new Set(extraServiceIds)].map((id) => {
    const service = findDesktopExtraService(id);
    if (!service) throw new Error(`Invalid extra service: ${id}`);
    return service;
  });
  return [primary.title, ...extras.map((service) => service.title)].join(" + ");
}

export function validateDesktopUploadFile(input: { fileName: string; fileSize: number }) {
  const lower = input.fileName.toLowerCase();
  const extensionOk = desktopUploadAllowedExtensions.some((extension) => lower.endsWith(extension));
  if (!extensionOk) return { ok: false as const, error: "Unsupported file type." };
  if (!Number.isFinite(input.fileSize) || input.fileSize <= 0) return { ok: false as const, error: "File is empty or invalid." };
  if (input.fileSize > desktopUploadMaxFileSize) return { ok: false as const, error: "The file must be 32 MB or smaller." };
  return { ok: true as const };
}

export function safeDesktopFileName(value: string) {
  return value.replaceAll(" ", "_").replace(/[^a-zA-Z0-9._-]/g, "").slice(-160) || "original-file.bin";
}

export function normalizeDesktopIdempotencyKey(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 96);
}

export function isValidSha256(value: string) {
  return /^[a-f0-9]{64}$/i.test(value);
}

export function customerSafeDesktopOrderSelect() {
  return "id, vehicle_brand, vehicle_model, vehicle_generation, vehicle_engine, service_type, credits_required, status, uploaded_file_name, created_at";
}

export function desktopUploadSessionIdFor(idempotencyKey: string) {
  return `desktop-upload-${normalizeDesktopIdempotencyKey(idempotencyKey)}`;
}

export function validateDesktopCreditAccess(profile: {
  credit_balance: number | string | null;
  allow_negative_credits?: boolean | null;
  negative_credit_limit?: number | string | null;
  account_status?: string | null;
}, requiredCredits: number) {
  if ((profile.account_status ?? "active") !== "active") {
    return "Customer account is not active.";
  }
  const balance = Number(profile.credit_balance ?? 0);
  const negativeLimit = Number(profile.negative_credit_limit ?? 0);
  const available = profile.allow_negative_credits ? balance + Math.max(negativeLimit, 0) : balance;
  if (!Number.isFinite(balance) || requiredCredits > available) {
    return "Your credit balance could not be verified. Please connect to the MG AutoTech server before submitting a request.";
  }
  return null;
}
