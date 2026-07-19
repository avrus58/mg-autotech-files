import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getVehicleAdminRecordPage } from "@/lib/vehicleControl/admin";
import { parseVehicleAdminListQuery } from "@/lib/vehicleControl/schema";

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "vehicles.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = parseVehicleAdminListQuery(new URL(request.url).searchParams);
  if (!parsed.success) {
    return NextResponse.json({
      error: "Invalid vehicle search query.",
      details: parsed.error.flatten(),
    }, { status: 400 });
  }

  try {
    const result = await getVehicleAdminRecordPage(parsed.data);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({
      error: "Vehicle records could not be loaded.",
    }, { status: 500 });
  }
}
