import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { createVehicleAdminRecord, getVehicleAdminLegacyRecords, getVehicleAdminOverview } from "@/lib/vehicleControl/admin";
import { vehicleAdminPayloadSchema } from "@/lib/vehicleControl/schema";

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "vehicles.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const includeRecords = new URL(request.url).searchParams.get("includeRecords") !== "false";
    const [overview, legacyRecords] = await Promise.all([
      getVehicleAdminOverview(),
      includeRecords ? getVehicleAdminLegacyRecords() : Promise.resolve(null),
    ]);
    const permissionWarnings: string[] = [];
    if (auth.access.role === "admin" && auth.access.staffRole !== "owner") {
      permissionWarnings.push("Primary admin access is allowed by the app guard, but the Supabase profile is not marked as staff_role=owner. Normalize this before relying on direct RLS checks or delegating staff access.");
    }
    return NextResponse.json({
      ...overview,
      ...(legacyRecords ? { records: legacyRecords } : {}),
      permissionWarnings,
    });
  } catch {
    return NextResponse.json({
      error: "Vehicle database could not be loaded.",
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
    return NextResponse.json(result.detail, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Vehicle could not be created." }, { status: 500 });
  }
}
