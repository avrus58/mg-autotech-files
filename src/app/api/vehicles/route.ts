import { NextRequest, NextResponse } from "next/server";
import vehicles from "../../../../data/vehicle-database.json";

type Vehicle = {
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
  stage1?: any;
  stage2?: any;
  readMethods?: string[];
  services?: string[];
  imageUrl?: string;
};

const data = vehicles as Vehicle[];

function uniqueBy<T>(items: T[], keyFn: (item: T) => string) {
  const map = new Map<string, T>();
  for (const item of items) map.set(keyFn(item), item);
  return Array.from(map.values());
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const type = searchParams.get("type");
  const brandId = searchParams.get("brandId");
  const modelId = searchParams.get("modelId");
  const generationId = searchParams.get("generationId");
  const engineId = searchParams.get("engineId");

  if (type === "brands") {
    const brands = uniqueBy(data, (v) => v.brandId)
      .map((v) => ({ id: v.brandId, name: v.brand }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(brands);
  }

  if (type === "models") {
    const filtered = data.filter((v) => v.brandId === brandId);

    const models = uniqueBy(filtered, (v) => v.modelId)
      .map((v) => ({ id: v.modelId, name: v.model }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(models);
  }

  if (type === "generations") {
    const filtered = data.filter(
      (v) => v.brandId === brandId && v.modelId === modelId
    );

    const generations = uniqueBy(filtered, (v) => v.generationId)
      .map((v) => ({ id: v.generationId, name: v.generation }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(generations);
  }

  if (type === "engines") {
    const filtered = data.filter(
      (v) =>
        v.brandId === brandId &&
        v.modelId === modelId &&
        v.generationId === generationId
    );

    const engines = uniqueBy(filtered, (v) => v.engineId).map((v) => ({
      id: v.engineId,
      name: v.engine,
      fuelType: v.fuelType,
    }));

    return NextResponse.json(engines);
  }

  if (type === "vehicle") {
    const vehicle = data.find(
      (v) =>
        v.brandId === brandId &&
        v.modelId === modelId &&
        v.generationId === generationId &&
        v.engineId === engineId
    );

    return NextResponse.json(vehicle ?? null);
  }

  return NextResponse.json(
    { error: "Invalid type" },
    { status: 400 }
  );
}