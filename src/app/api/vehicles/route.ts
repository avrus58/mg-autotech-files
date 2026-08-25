import { NextRequest, NextResponse } from "next/server";
import {
  getSafePublishedVehicleCatalog,
  getSafePublishedVehicle,
  listEnginesFromCatalog,
  listGenerationsFromCatalog,
  listModelsFromCatalog,
} from "@/lib/vehicleControl/public";
import {
  checkPublicVehicleAccess,
  parsePublicVehicleQuery,
} from "@/lib/vehicleControl/publicAccess";
import { rateLimitResponseHeaders } from "@/lib/abuseProtection";

const vehicleCacheHeaders = {
  "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=60",
  "CDN-Cache-Control": "public, max-age=60, stale-while-revalidate=60",
  "Vercel-CDN-Cache-Control": "public, max-age=60, stale-while-revalidate=60",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

const privateErrorHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

const vehicleDetailCacheHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export async function GET(req: NextRequest) {
  const parsed = parsePublicVehicleQuery(req.url);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400, headers: privateErrorHeaders });
  }

  const access = await checkPublicVehicleAccess(req, parsed.query);
  if (!access.allowed) {
    return NextResponse.json(
      { error: "Vehicle catalog request limit reached. Please wait and try again." },
      {
        status: 429,
        headers: {
          ...privateErrorHeaders,
          ...rateLimitResponseHeaders({
            result: access.result,
            limit: access.limit,
            windowMs: access.windowMs,
            blocked: true,
          }),
        },
      }
    );
  }

  const { type, brandId, modelId, generationId, engineId } = parsed.query;
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
      headers: { ...vehicleDetailCacheHeaders, "x-vehicle-source": vehicle.source },
    });
  }

  return NextResponse.json({ error: "Invalid vehicle catalog request" }, { status: 400, headers: privateErrorHeaders });
}
