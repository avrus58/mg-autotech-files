import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getEcuIntelligenceInsights } from "@/lib/ecuIntelligence/center/server";

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    return NextResponse.json(await getEcuIntelligenceInsights());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ECU Intelligence insights could not be loaded." }, { status: 500 });
  }
}
