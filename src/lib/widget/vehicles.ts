import vehicles from "../../../data/vehicle-database.json";
import performanceOverrides from "../../../data/vehicle-performance-overrides.json";

type VehicleRow = {
  brand: string;
  brandId: string;
  model: string;
  modelId: string;
  generation: string;
  generationId: string;
  engine: string;
  engineId: string;
  fuelType?: string | null;
  ecu?: string[];
  stage1?: StageData | null;
  stage2?: StageData | null;
  readMethods?: string[];
  services?: string[];
};

type StageData = {
  stockHp: number | null;
  tunedHp: number | null;
  gainHp: number | null;
  stockNm: number | null;
  tunedNm: number | null;
  gainNm: number | null;
};

type PerformanceOverride = {
  stage1?: StageData;
  stage2?: StageData;
  services?: string[];
};

const rows = vehicles as VehicleRow[];
const overrides = performanceOverrides as Record<string, PerformanceOverride>;

function uniqueOptions(items: VehicleRow[], id: (row: VehicleRow) => string, name: (row: VehicleRow) => string) {
  const map = new Map<string, string>();
  for (const item of items) map.set(id(item), name(item));
  return [...map.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function widgetMakes() {
  return uniqueOptions(rows, (row) => row.brandId, (row) => row.brand);
}

export function widgetModels(make: string) {
  return uniqueOptions(rows.filter((row) => row.brandId === make), (row) => row.modelId, (row) => row.model);
}

export function widgetYears(make: string, model: string) {
  return uniqueOptions(
    rows.filter((row) => row.brandId === make && row.modelId === model),
    (row) => row.generationId,
    (row) => row.generation
  );
}

export function widgetEngines(make: string, model: string, year: string) {
  const filtered = rows.filter((row) => row.brandId === make && row.modelId === model && row.generationId === year);
  const map = new Map<string, { value: string; label: string; fuelType: string | null }>();
  for (const row of filtered) {
    map.set(row.engineId, { value: row.engineId, label: row.engine, fuelType: row.fuelType ?? null });
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function widgetVehicle(make: string, model: string, year: string, engine: string) {
  const row = rows.find((item) =>
    item.brandId === make && item.modelId === model && item.generationId === year && item.engineId === engine
  );
  if (!row) return null;
  const vehicleId = `${row.brandId}:${row.modelId}:${row.generationId}:${row.engineId}`;
  const override = overrides[vehicleId];
  const stage1 = override?.stage1 ?? row.stage1 ?? null;
  const stage2 = override?.stage2 ?? row.stage2 ?? null;
  const services = [...new Set([...(row.services ?? []), ...(override?.services ?? [])])];
  const vehicleName = `${row.brand} ${row.model} ${row.generation} ${row.engine}`.replace(/\s+/g, " ").trim();
  return {
    vehicleId,
    vehicleName,
    make: row.brand,
    model: row.model,
    year: row.generation,
    engine: row.engine,
    fuelType: row.fuelType ?? null,
    ecu: row.ecu?.slice(0, 8).join(", ") || "",
    ecuFamilies: row.ecu?.slice(0, 8) ?? [],
    powerHp: stage1?.stockHp ?? null,
    stage1,
    stage2,
    services: services.slice(0, 24),
    readMethods: row.readMethods?.slice(0, 8) ?? [],
  };
}
