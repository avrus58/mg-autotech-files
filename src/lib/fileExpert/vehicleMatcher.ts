import vehicles from "../../../data/vehicle-database.json";
import type {
  FileExpertEcuIdentification,
  FileExpertVehicleCandidate,
  FileExpertVehicleMatch,
} from "@/lib/fileExpert/types";

type VehicleRow = {
  brand: string;
  model: string;
  generation: string;
  engine: string;
  ecu?: string[];
};

const vehicleRows = vehicles as VehicleRow[];

function normalize(value: string | null | undefined) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function includesNormalized(value: string, target: string) {
  const normalizedValue = normalize(value);
  const normalizedTarget = normalize(target);
  return Boolean(normalizedTarget && normalizedValue.includes(normalizedTarget));
}

export function findVehicleCandidates(input: {
  identification?: FileExpertEcuIdentification;
  metadata: {
    brand?: string | null;
    model?: string | null;
    engine?: string | null;
  };
}): FileExpertVehicleMatch {
  const identification = input.identification;
  const target = identification?.variant || identification?.family;

  if (!identification || !target || identification.status === "not_detected") {
    return {
      total_matches: 0,
      exact_vehicle_identified: false,
      summary: "Vehicle and engine could not be matched because no reliable ECU family was identified.",
      candidates: [],
    };
  }

  const matches: FileExpertVehicleCandidate[] = [];
  const seen = new Set<string>();

  for (const row of vehicleRows) {
    const matchedEcu = row.ecu?.find((ecu) => includesNormalized(ecu, target));
    if (!matchedEcu) continue;

    let confidence = identification.variant ? 0.74 : 0.52;
    const reasons = [`ECU listing contains ${target}`];

    if (input.metadata.brand && normalize(row.brand) === normalize(input.metadata.brand)) {
      confidence += 0.08;
      reasons.push("submitted brand matches");
    }
    if (input.metadata.model && includesNormalized(row.model, input.metadata.model)) {
      confidence += 0.08;
      reasons.push("submitted model matches");
    } else if (input.metadata.model && includesNormalized(row.engine, input.metadata.model)) {
      confidence += 0.07;
      reasons.push("submitted model or trim matches engine listing");
    }
    if (input.metadata.engine && includesNormalized(row.engine, input.metadata.engine)) {
      confidence += 0.08;
      reasons.push("submitted engine matches");
    }
    if (
      identification.engine_codes.some((code) => includesNormalized(row.engine, code))
    ) {
      confidence += 0.12;
      reasons.push("engine code extracted from binary matches");
    }

    const key = [row.brand, row.model, row.generation, row.engine].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push({
      brand: row.brand,
      model: row.model,
      generation: row.generation,
      engine: row.engine,
      ecu: matchedEcu,
      confidence: Number(Math.min(0.96, confidence).toFixed(2)),
      reason: reasons.join("; "),
    });
  }

  matches.sort((left, right) => {
    if (right.confidence !== left.confidence) return right.confidence - left.confidence;
    return `${left.brand}${left.model}${left.engine}`.localeCompare(`${right.brand}${right.model}${right.engine}`);
  });

  const exactVehicleIdentified =
    matches.length === 1 && matches[0].confidence >= 0.9 && identification.engine_codes.length > 0;

  return {
    total_matches: matches.length,
    exact_vehicle_identified: exactVehicleIdentified,
    summary: matches.length
      ? exactVehicleIdentified
        ? "One vehicle application matches both the ECU and engine identifiers found in the file."
        : `${target} appears in ${matches.length} vehicle applications in the MG AutoTech database. ECU identity alone does not prove the exact vehicle or engine.`
      : `${target} was identified, but no matching vehicle application was found in the local database.`,
    candidates: matches.slice(0, 8),
  };
}
