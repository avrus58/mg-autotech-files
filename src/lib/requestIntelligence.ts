export type RequestIntelligenceStatus = "ready" | "needs_attention" | "blocked";

export type RequestIntelligenceFinding = {
  key: string;
  label: string;
  detail: string;
  severity: "required" | "review" | "advisory";
};

export type RequestIntelligenceInput = {
  hasVehicle: boolean;
  manualVehicle: boolean;
  hasService: boolean;
  selectedServiceIds: string[];
  selectedServiceTitles: string[];
  hasValidFile: boolean;
  fileName: string | null;
  ecu: string | null;
  readMethod: string | null;
  notes: string | null;
  accountVerified: boolean;
  creditsVerified: boolean;
};

export type RequestIntelligenceResult = {
  status: RequestIntelligenceStatus;
  score: number;
  label: string;
  summary: string;
  findings: RequestIntelligenceFinding[];
  strengths: string[];
};

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function needsDtcContext(ids: string[], titles: string[]) {
  return [...ids, ...titles].some((value) => /\bdtc\b/i.test(value.replaceAll("_", " ")));
}

function hasDtcCode(value: string | null | undefined) {
  return /\b[PCBU][0-9A-F]{4}\b/i.test(value ?? "");
}

export function evaluateRequestIntelligence(input: RequestIntelligenceInput): RequestIntelligenceResult {
  const findings: RequestIntelligenceFinding[] = [];
  const strengths: string[] = [];
  let score = 0;

  if (input.hasVehicle) {
    score += 18;
    strengths.push("Vehicle and engine context available");
  } else {
    findings.push({ key: "vehicle", label: "Vehicle identity required", detail: "Select a catalog vehicle or complete the manual brand, model and engine fields.", severity: "required" });
  }

  if (input.hasService) {
    score += 15;
    strengths.push("Primary service selected");
  } else {
    findings.push({ key: "service", label: "Service required", detail: "Choose the main file-service request before submission.", severity: "required" });
  }

  if (input.hasValidFile) {
    score += 20;
    strengths.push("Original file passed client validation");
  } else {
    findings.push({ key: "file", label: "Valid original file required", detail: "Attach a supported file within the existing upload size limit.", severity: "required" });
  }

  if (input.accountVerified) {
    score += 12;
  } else {
    findings.push({ key: "account", label: "Account verification pending", detail: "The customer account must be online and active before submission.", severity: "required" });
  }

  if (input.creditsVerified) {
    score += 15;
    strengths.push("Credit access verified online");
  } else {
    findings.push({ key: "credits", label: "Credit check required", detail: "Available credits must be verified by the existing server-backed request flow.", severity: "required" });
  }

  if (hasText(input.ecu)) {
    score += 7;
    strengths.push("ECU / TCU context supplied");
  } else {
    findings.push({ key: "ecu", label: "ECU / TCU not identified", detail: "Add the controller type when known. The request can still be reviewed manually.", severity: "advisory" });
  }

  if (hasText(input.readMethod)) {
    score += 6;
    strengths.push("Read method supplied");
  } else {
    findings.push({ key: "read_method", label: "Read method not supplied", detail: "Add OBD, bench, boot, virtual or the exact known method to reduce clarification time.", severity: "advisory" });
  }

  const noteLength = input.notes?.trim().length ?? 0;
  const needsDetailedNotes = input.selectedServiceIds.length > 1 || input.manualVehicle || needsDtcContext(input.selectedServiceIds, input.selectedServiceTitles);
  if (!needsDetailedNotes || noteLength >= 12) {
    score += 7;
    if (noteLength >= 12) strengths.push("Technical request note supplied");
  } else {
    findings.push({ key: "notes", label: "Add a precise technical note", detail: "This combination benefits from symptoms, requested behavior and any known diagnostic context.", severity: "review" });
  }

  if (needsDtcContext(input.selectedServiceIds, input.selectedServiceTitles) && !hasDtcCode(input.notes)) {
    findings.push({ key: "dtc_code", label: "DTC code not detected", detail: "Enter the exact P, C, B or U code when available. No code is invented automatically.", severity: "review" });
  }

  if (input.manualVehicle) {
    findings.push({ key: "manual_vehicle", label: "Manual vehicle identity", detail: "Customer-provided vehicle data will remain visible for staff verification and will not alter the Vehicle Database.", severity: "advisory" });
  }

  if (input.fileName?.toLowerCase().endsWith(".zip")) {
    findings.push({ key: "archive", label: "Archive upload selected", detail: "Confirm the archive contains only the intended request file and no unrelated customer data.", severity: "advisory" });
  }

  const boundedScore = Math.max(0, Math.min(100, score));
  const hasRequired = findings.some((finding) => finding.severity === "required");
  const hasReview = findings.some((finding) => finding.severity === "review");
  const status: RequestIntelligenceStatus = hasRequired ? "blocked" : hasReview ? "needs_attention" : "ready";

  return {
    status,
    score: boundedScore,
    label: status === "ready" ? "Ready for secure submission" : status === "needs_attention" ? "Technical context recommended" : "Required steps incomplete",
    summary: status === "ready"
      ? "The request has enough structured context for the existing secure submission flow."
      : status === "needs_attention"
        ? "The request can remain in the existing flow, but added context should reduce manual clarification."
        : "Complete the required request, file, account and credit checks before submission.",
    findings,
    strengths,
  };
}
