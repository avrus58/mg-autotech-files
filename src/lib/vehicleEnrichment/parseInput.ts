import type { ExternalVehicleEntry } from "@/lib/vehicleEnrichment/types";

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current.trim());
  return values;
}

export function parseVehicleEnrichmentEntries(input: string): ExternalVehicleEntry[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) throw new Error("JSON enrichment paste must be an array.");
    return parsed as ExternalVehicleEntry[];
  }

  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("CSV enrichment paste needs a header row and at least one data row.");
  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    return {
      brand: row.brand ?? row.Brand ?? "",
      model: row.model ?? row.Model ?? "",
      rawTitle: row.rawTitle ?? row.title ?? row.Title ?? null,
      rawModel: row.rawModel ?? null,
      rawGeneration: row.rawGeneration ?? row.generation ?? row.Generation ?? null,
      rawBodyType: row.rawBodyType ?? row.bodyType ?? row.Body ?? null,
      rawYearRange: row.rawYearRange ?? row.years ?? row.Years ?? null,
      rawPowerRange: row.rawPowerRange ?? null,
      engineDisplayName: row.engineDisplayName ?? row.engine ?? row.Engine ?? null,
      engineCodeText: row.engineCodeText ?? row.engineCode ?? row.Code ?? null,
      displacementText: row.displacementText ?? row.displacement ?? null,
      powerText: row.powerText ?? row.power ?? row.Power ?? null,
      torqueText: row.torqueText ?? row.torque ?? row.Torque ?? null,
      fuelType: row.fuelType ?? row.fuel ?? row.Fuel ?? null,
      drivetrain: row.drivetrain ?? null,
      transmission: row.transmission ?? null,
      hybridType: row.hybridType ?? null,
      sourceUrl: row.sourceUrl ?? row.url ?? null,
    };
  });
}
