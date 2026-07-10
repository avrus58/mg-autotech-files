import {
  getSafePublishedVehicleRows,
  getSafePublishedVehicle,
  listBrandsFromRows,
  listEnginesFromRows,
  listGenerationsFromRows,
  listModelsFromRows,
} from "@/lib/vehicleControl/public";

export async function widgetMakes() {
  const { rows } = await getSafePublishedVehicleRows();
  return listBrandsFromRows(rows).map((item) => ({ value: item.id, label: item.name }));
}

export async function widgetModels(make: string) {
  const { rows } = await getSafePublishedVehicleRows();
  return listModelsFromRows(rows, make).map((item) => ({ value: item.id, label: item.name }));
}

export async function widgetYears(make: string, model: string) {
  const { rows } = await getSafePublishedVehicleRows();
  return listGenerationsFromRows(rows, make, model).map((item) => ({ value: item.id, label: item.name }));
}

export async function widgetEngines(make: string, model: string, year: string) {
  const { rows } = await getSafePublishedVehicleRows();
  return listEnginesFromRows(rows, make, model, year).map((item) => ({
    value: item.id,
    label: item.name,
    fuelType: item.fuelType,
  }));
}

export async function widgetVehicle(make: string, model: string, year: string, engine: string) {
  const { row } = await getSafePublishedVehicle(make, model, year, engine);
  if (!row) return null;
  const vehicleName = `${row.brand} ${row.model} ${row.generation} ${row.engine}`.replace(/\s+/g, " ").trim();
  return {
    vehicleId: row.vehicleKey || `${row.brandId}:${row.modelId}:${row.generationId}:${row.engineId}`,
    vehicleName,
    make: row.brand,
    model: row.model,
    year: row.generation,
    engine: row.engine,
    fuelType: row.fuelType ?? null,
    ecu: row.ecu.slice(0, 8).join(", "),
    ecuFamilies: row.ecu.slice(0, 8),
    powerHp: row.stage1?.stockHp ?? null,
    stage1: row.stage1,
    stage2: row.stage2,
    services: row.services.slice(0, 24),
    readMethods: row.readMethods.slice(0, 8),
  };
}
