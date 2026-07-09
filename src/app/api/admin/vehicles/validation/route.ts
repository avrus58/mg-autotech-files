import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getVehicleAdminOverview, persistVehicleValidationResults } from "@/lib/vehicleControl/admin";

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "vehicles.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("vehicle_validation_results")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ results: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireStaffPermission(request, "vehicles.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const overview = await getVehicleAdminOverview();
    const issues = await persistVehicleValidationResults(overview.records, auth.user.id);
    return NextResponse.json({ issues, count: issues.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Validation failed." }, { status: 500 });
  }
}
