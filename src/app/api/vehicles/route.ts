import { NextRequest, NextResponse } from "next/server";
import {
  getSafePublishedVehicleCatalog,
  getSafePublishedVehicle,
  listEnginesFromCatalog,
  listGenerationsFromCatalog,
  listModelsFromCatalog,
} from "@/lib/vehicleControl/public";

const vehicleCacheHeaders = {
  "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const brandId = searchParams.get("brandId") ?? "";
  const modelId = searchParams.get("modelId") ?? "";
  const generationId = searchParams.get("generationId") ?? "";
  const engineId = searchParams.get("engineId") ?? "";
  const { payload, source } = await getSafePublishedVehicleCatalog();
  const headers = { ...vehicleCacheHeaders, "x-vehicle-source": source };

  if (type === "brands") {
    return NextResponse.json(payload.brands, { headers });
  }

  if (type === "models") {
    return NextResponse.json(listModelsFromCatalog(payload, brandId), { headers });
  }

  if (type === "generations") {
    return NextResponse.json(listGenerationsFromCatalog(payload, brandId, modelId), { headers });
  }

  if (type === "engines") {
    return NextResponse.json(listEnginesFromCatalog(payload, brandId, modelId, generationId), { headers });
  }

  if (type === "vehicle") {
    const vehicle = await getSafePublishedVehicle(brandId, modelId, generationId, engineId);
    return NextResponse.json(vehicle.row, {
      headers: { ...vehicleCacheHeaders, "x-vehicle-source": vehicle.source },
    });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
