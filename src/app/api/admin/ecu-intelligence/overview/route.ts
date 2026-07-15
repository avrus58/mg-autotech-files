import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getEcuIntelligenceOverview } from "@/lib/ecuIntelligence/center/server";

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const url = new URL(request.url);
    const includeSynthetic = url.searchParams.get("includeSynthetic") === "true";
    return NextResponse.json(await getEcuIntelligenceOverview({ includeSynthetic }));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ECU Intelligence overview could not be loaded." },
      { status: 500 }
    );
  }
}
