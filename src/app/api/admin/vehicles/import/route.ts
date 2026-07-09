import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { runVehicleImport } from "@/lib/vehicleControl/importer";

const importSchema = z.object({
  dryRun: z.boolean().default(true),
  limit: z.number().int().positive().max(20000).optional(),
});

export async function POST(request: Request) {
  const auth = await requireStaffPermission(request, "vehicles.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = importSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid import request.", details: parsed.error.flatten() }, { status: 400 });
  try {
    const summary = await runVehicleImport({
      dryRun: parsed.data.dryRun,
      limit: parsed.data.limit,
      actorUserId: auth.user.id,
    });
    return NextResponse.json({ summary });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Vehicle import failed." }, { status: 500 });
  }
}
