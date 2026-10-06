import type { RequestBriefCopyKey } from "@/lib/i18n/tool-client-copy-keys";
import { buildNewRequestPath, type RequestIntent } from "@/lib/requestIntent";

export type RequestBriefPreparationInput = {
  vehicle: string;
  engine: string;
  year: string;
  notes: string;
  hardware: string;
  faultCodes: string;
  serviceGoal: string;
};

export type RequestBriefMissingCopyKey = Extract<
  RequestBriefCopyKey,
  | "vehicle brand/model"
  | "engine or engine code"
  | "model year"
  | "short customer goal or context"
  | "hardware changes"
  | "fault codes"
>;

export type RequestBriefPreparation = {
  score: number;
  missing: RequestBriefMissingCopyKey[];
  requestPath: string;
};

type PreparationRequirement = {
  value: string;
  missingKey: RequestBriefMissingCopyKey;
};

function getPreparationIntent(serviceGoal: string): RequestIntent | null {
  switch (serviceGoal) {
    case "Stage 1 performance":
      return "stage_1";
    case "Stage 2 / hardware changes":
      return "stage_2";
    case "TCU / gearbox support":
      return "tcu_stage_1";
    case "DTC request preparation":
      return "dtc_off";
    default:
      return null;
  }
}

export function getRequestBriefPreparation(
  input: RequestBriefPreparationInput,
): RequestBriefPreparation {
  const intent = getPreparationIntent(input.serviceGoal);
  const requirements: PreparationRequirement[] = [
    { value: input.vehicle, missingKey: "vehicle brand/model" },
    { value: input.engine, missingKey: "engine or engine code" },
    { value: input.year, missingKey: "model year" },
    { value: input.notes, missingKey: "short customer goal or context" },
  ];

  if (intent === "stage_2") {
    requirements.push({ value: input.hardware, missingKey: "hardware changes" });
  }
  if (intent === "dtc_off") {
    requirements.push({ value: input.faultCodes, missingKey: "fault codes" });
  }

  const missing = requirements
    .filter(({ value }) => value.trim().length === 0)
    .map(({ missingKey }) => missingKey);
  const filled = requirements.length - missing.length;

  return {
    score: Math.round((filled / requirements.length) * 100),
    missing,
    requestPath: buildNewRequestPath(intent),
  };
}
