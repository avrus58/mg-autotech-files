import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getEcuIntelligenceClusterDetail } from "@/lib/ecuIntelligence/center/server";

export async function GET(request: Request, context: { params: Promise<{ clusterId: string }> }) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { clusterId } = await context.params;
    const detail = await getEcuIntelligenceClusterDetail(decodeURIComponent(clusterId));
    if (!detail) return NextResponse.json({ error: "ECU Intelligence cluster not found." }, { status: 404 });
    return NextResponse.json(detail);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ECU Intelligence cluster detail could not be loaded." },
      { status: 500 }
    );
  }
}
