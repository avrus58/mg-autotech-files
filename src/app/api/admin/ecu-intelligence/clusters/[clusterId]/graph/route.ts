import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getEcuIntelligenceClusterDetail } from "@/lib/ecuIntelligence/center/server";

export async function GET(request: Request, context: { params: Promise<{ clusterId: string }> }) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { clusterId } = await context.params;
    const detail = await getEcuIntelligenceClusterDetail(decodeURIComponent(clusterId));
    if (!detail?.graph) return NextResponse.json({ error: "ECU Intelligence graph not available." }, { status: detail ? 503 : 404 });
    return NextResponse.json(detail.graph);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ECU Intelligence graph could not be loaded." },
      { status: 500 }
    );
  }
}
