export type CalibrationVehicleContext = {
  ecuFamily?: string | null;
  ecuType?: string | null;
  swNumber?: string | null;
  fuelType?: "diesel" | "gasoline" | "petrol" | "hybrid" | "unknown" | null;
  induction?: "turbo" | "naturally_aspirated" | "supercharged" | "unknown" | null;
  isTcu?: boolean | null;
  evidenceCount?: number | null;
  highQualityEvidenceCount?: number | null;
  mapDefinitionsAvailable?: boolean | null;
};

export type CalibrationPlaybook = {
  key: string;
  title: string;
  likely_calibration_areas: string[];
  risk_warnings: string[];
  required_human_checks: string[];
};

export const dieselTurboPlaybook: CalibrationPlaybook = {
  key: "diesel_turbo",
  title: "Turbo diesel Stage 1 inspection",
  likely_calibration_areas: [
    "driver wish",
    "torque limiters",
    "smoke limiter",
    "boost request and limiter",
    "rail pressure",
    "duration",
    "air/lambda model",
    "torque monitoring",
    "gearbox torque risk",
  ],
  risk_warnings: [
    "Do not raise torque without checking smoke, boost and gearbox limits.",
    "Human tuner must verify EGT, clutch/gearbox and DPF state.",
  ],
  required_human_checks: [
    "Confirm ECU family/type/SW.",
    "Confirm original file integrity.",
    "Identify torque model and smoke limiter behavior.",
    "Check gearbox torque capacity.",
  ],
};

export const gasolineTurboPlaybook: CalibrationPlaybook = {
  key: "gasoline_turbo",
  title: "Turbo gasoline Stage 1 inspection",
  likely_calibration_areas: [
    "driver wish",
    "torque/load limiters",
    "boost request and limiter",
    "lambda/fuel enrichment",
    "ignition safety",
    "torque monitoring",
    "gearbox torque risk",
  ],
  risk_warnings: [
    "Boost and ignition changes require knock and lambda validation.",
    "Human tuner must check fuel quality and thermal limits.",
  ],
  required_human_checks: [
    "Confirm ECU family/type/SW.",
    "Verify boost control strategy.",
    "Review ignition and lambda safety.",
    "Check gearbox torque capacity.",
  ],
};

export const naturallyAspiratedPlaybook: CalibrationPlaybook = {
  key: "naturally_aspirated",
  title: "Naturally aspirated Stage 1 inspection",
  likely_calibration_areas: [
    "ignition safety",
    "fueling",
    "throttle/driver wish",
    "torque/load limiters",
  ],
  risk_warnings: [
    "Expected gains are usually limited without hardware changes.",
    "Do not promise turbo-like gains for naturally aspirated engines.",
  ],
  required_human_checks: [
    "Confirm naturally aspirated engine state.",
    "Review ignition and fueling only within safe limits.",
    "Set realistic customer expectation.",
  ],
};

export const tcuPlaybook: CalibrationPlaybook = {
  key: "tcu",
  title: "TCU inspection",
  likely_calibration_areas: [
    "shift schedule",
    "torque intervention",
    "line pressure",
    "lockup strategy",
    "torque limiters",
  ],
  risk_warnings: [
    "TCU work must match engine torque strategy.",
    "Do not change shift pressure without transmission-specific validation.",
  ],
  required_human_checks: [
    "Confirm TCU type and software.",
    "Confirm clutch/gearbox condition.",
    "Match engine and gearbox torque model.",
  ],
};

export const unknownEcuPlaybook: CalibrationPlaybook = {
  key: "unknown_ecu",
  title: "Unknown ECU safety-first inspection",
  likely_calibration_areas: [
    "ECU/SW identification",
    "file size and checksum family",
    "similarity search",
    "map definition availability",
    "human review",
  ],
  risk_warnings: [
    "Do not calibrate blindly when ECU/SW is unknown.",
    "No byte changes or MOD generation are allowed from this assistant.",
  ],
  required_human_checks: [
    "Identify ECU family/type/SW first.",
    "Run similarity and map attribution if available.",
    "Confirm original file integrity.",
  ],
};

export function selectCalibrationPlaybook(context: CalibrationVehicleContext): CalibrationPlaybook {
  if (context.isTcu || /tcu|zf|dsg/i.test(`${context.ecuFamily || ""} ${context.ecuType || ""}`)) return tcuPlaybook;
  if (!context.ecuFamily && !context.ecuType) return unknownEcuPlaybook;
  if (context.induction === "naturally_aspirated") return naturallyAspiratedPlaybook;
  if (context.fuelType === "diesel") return dieselTurboPlaybook;
  if (context.fuelType === "gasoline" || context.fuelType === "petrol" || context.induction === "turbo") return gasolineTurboPlaybook;
  return unknownEcuPlaybook;
}
