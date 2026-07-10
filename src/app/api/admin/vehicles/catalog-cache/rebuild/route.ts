import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { rebuildPublicVehicleCatalogCache } from "@/lib/vehicleControl/public";

export async function POST(request: Request) {
  const auth = await requireStaffPermission(request, "vehicles.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const result = await rebuildPublicVehicleCatalogCache(auth.user.id);
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Public vehicle catalog cache could not be rebuilt.",
      migrationRequired: error instanceof Error && /public_vehicle_catalog_cache/i.test(error.message),
    }, { status: 500 });
  }
}
