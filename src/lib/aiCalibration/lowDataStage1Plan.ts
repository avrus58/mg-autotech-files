import {
  selectCalibrationPlaybook,
  type CalibrationVehicleContext,
} from "@/lib/aiCalibration/calibrationRules";

export type LowDataStage1Plan = {
  advisory_only: true;
  mod_generation: false;
  checksum_correction: false;
  readiness: "blocked" | "research_only" | "human_review_required" | "evidence_supported_review";
  confidence: number;
  checklist: string[];
  likely_calibration_areas: string[];
  risk_warnings: string[];
  missing_evidence: string[];
  required_human_checks: string[];
  next_best_action: string;
};

export function createLowDataStage1Plan(context: CalibrationVehicleContext): LowDataStage1Plan {
  const playbook = selectCalibrationPlaybook(context);
  const evidenceCount = Number(context.evidenceCount || 0);
  const highQualityEvidenceCount = Number(context.highQualityEvidenceCount || 0);
  const missing = new Set<string>();
  if (!context.ecuFamily || !context.ecuType) missing.add("ECU family/type identification");
  if (!context.swNumber) missing.add("software number");
  if (evidenceCount < 3) missing.add("more ORI/MOD evidence");
  if (highQualityEvidenceCount < 2) missing.add("high-quality reviewed examples");
  if (!context.mapDefinitionsAvailable) missing.add("map definitions");

  const readiness =
    !context.ecuFamily || !context.ecuType ? "blocked" :
    evidenceCount === 0 ? "research_only" :
    highQualityEvidenceCount >= 3 && context.mapDefinitionsAvailable ? "evidence_supported_review" :
    "human_review_required";

  const confidence = Math.max(0, Math.min(100,
    (context.ecuFamily && context.ecuType ? 25 : 0) +
    (context.swNumber ? 15 : 0) +
    Math.min(evidenceCount * 6, 24) +
    Math.min(highQualityEvidenceCount * 10, 25) +
    (context.mapDefinitionsAvailable ? 11 : 0)
  ));

  const checklist = [
    "Confirm ORI file identity and customer request.",
    "Confirm ECU family/type/SW/HW.",
    "Run File Expert and similarity evidence.",
    "Review requested vs actual service labels.",
    "Check map definitions and attribution.",
    "Confirm human tuner review before any file output.",
  ];

  const nextBestAction =
    readiness === "blocked" ? "Identify ECU/SW and collect metadata before calibration review." :
    missing.has("map definitions") ? "Add or verify map definitions for this ECU/SW." :
    missing.has("high-quality reviewed examples") ? "Review and human-label more ORI/MOD examples." :
    "Prepare an admin-only review checklist; do not generate a file.";

  return {
    advisory_only: true,
    mod_generation: false,
    checksum_correction: false,
    readiness,
    confidence,
    checklist,
    likely_calibration_areas: playbook.likely_calibration_areas,
    risk_warnings: [
      ...playbook.risk_warnings,
      "This assistant never outputs byte patches, checksum-corrected files or customer-deliverable MOD files.",
    ],
    missing_evidence: [...missing],
    required_human_checks: playbook.required_human_checks,
    next_best_action: nextBestAction,
  };
}
