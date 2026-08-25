import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getVehicleAdminDetail, updateVehicleAdminRecord } from "@/lib/vehicleControl/admin";
import { synchronizePublicVehicleCatalogCache } from "@/lib/vehicleControl/public";
import { vehicleAdminPayloadSchema } from "@/lib/vehicleControl/schema";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffPermission(request, "vehicles.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  try {
    return NextResponse.json(await getVehicleAdminDetail(id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Vehicle could not be loaded." }, { status: 404 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffPermission(request, "vehicles.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  const parsed = vehicleAdminPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid vehicle payload.", details: parsed.error.flatten() }, { status: 400 });
  try {
    const result = await updateVehicleAdminRecord(id, parsed.data, auth.user.id);
    if (!result.ok) return NextResponse.json({ error: "Vehicle has validation errors.", issues: result.issues }, { status: 400 });
    const publicCatalogSync = await synchronizePublicVehicleCatalogCache(auth.user.id);
    return NextResponse.json({ ...result.detail, publicCatalogSync });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Vehicle could not be updated." }, { status: 500 });
  }
}
