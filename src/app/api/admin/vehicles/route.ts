import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { createVehicleAdminRecord, getVehicleAdminOverview } from "@/lib/vehicleControl/admin";
import { synchronizePublicVehicleCatalogCache } from "@/lib/vehicleControl/public";
import { vehicleAdminPayloadSchema } from "@/lib/vehicleControl/schema";

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "vehicles.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const overview = await getVehicleAdminOverview();
    return NextResponse.json({ ...overview, permissionWarnings: [] });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Vehicle database could not be loaded.",
      migrationRequired: true,
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireStaffPermission(request, "vehicles.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = vehicleAdminPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid vehicle payload.", details: parsed.error.flatten() }, { status: 400 });
  try {
    const result = await createVehicleAdminRecord(parsed.data, auth.user.id);
    if (!result.ok) return NextResponse.json({ error: "Vehicle has validation errors.", issues: result.issues }, { status: 400 });
    const publicCatalogSync = result.detail.record.published
      ? await synchronizePublicVehicleCatalogCache(auth.user.id)
      : { ok: true as const, status: "not_required" as const };
    return NextResponse.json({ ...result.detail, publicCatalogSync }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Vehicle could not be created." }, { status: 500 });
  }
}
