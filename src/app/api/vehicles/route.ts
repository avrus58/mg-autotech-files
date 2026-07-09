import { NextRequest, NextResponse } from "next/server";
import {
  findVehicleFromRows,
  getSafePublishedVehicleRows,
  listBrandsFromRows,
  listEnginesFromRows,
  listGenerationsFromRows,
  listModelsFromRows,
} from "@/lib/vehicleControl/public";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const brandId = searchParams.get("brandId") ?? "";
  const modelId = searchParams.get("modelId") ?? "";
  const generationId = searchParams.get("generationId") ?? "";
  const engineId = searchParams.get("engineId") ?? "";
  const { rows, source } = await getSafePublishedVehicleRows();

  if (type === "brands") {
    return NextResponse.json(listBrandsFromRows(rows), { headers: { "x-vehicle-source": source } });
  }

  if (type === "models") {
    return NextResponse.json(listModelsFromRows(rows, brandId), { headers: { "x-vehicle-source": source } });
  }

  if (type === "generations") {
    return NextResponse.json(listGenerationsFromRows(rows, brandId, modelId), { headers: { "x-vehicle-source": source } });
  }

  if (type === "engines") {
    return NextResponse.json(listEnginesFromRows(rows, brandId, modelId, generationId), { headers: { "x-vehicle-source": source } });
  }

  if (type === "vehicle") {
    return NextResponse.json(findVehicleFromRows(rows, brandId, modelId, generationId, engineId), {
      headers: { "x-vehicle-source": source },
    });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
