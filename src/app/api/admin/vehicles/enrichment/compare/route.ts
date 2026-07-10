import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getVehicleAdminOverview } from "@/lib/vehicleControl/admin";
import { buildVehicleEnrichmentPlan } from "@/lib/vehicleEnrichment";
import type { VehicleEnrichmentInput } from "@/lib/vehicleEnrichment/types";

export async function POST(request: Request) {
  const auth = await requireStaffPermission(request, "vehicles.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null) as Partial<VehicleEnrichmentInput> | null;
  if (!body || !Array.isArray(body.entries)) {
    return NextResponse.json({ error: "Invalid enrichment payload. Provide source details and entries array." }, { status: 400 });
  }

  const overview = await getVehicleAdminOverview();
  const plan = buildVehicleEnrichmentPlan({
    sourceType: body.sourceType ?? "manual",
    sourceName: body.sourceName ?? null,
    sourceUrl: body.sourceUrl ?? null,
    brand: body.brand ?? null,
    model: body.model ?? null,
    entries: body.entries,
    modernOnly: body.modernOnly !== false,
    yearCutoff: body.yearCutoff ?? 2020,
  }, overview.records);

  return NextResponse.json({ plan, dryRun: true, mutation: false });
}
