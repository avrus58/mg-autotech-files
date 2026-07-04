import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { rebuildAllPatternClusters } from "@/lib/ecuIntelligence/clustering";

export async function POST(request: Request) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const result = await rebuildAllPatternClusters({ actorUserId: auth.user.id });
    return NextResponse.json({
      clusterCount: result.clusters.length,
      metricCount: result.metrics.length,
      eligibleSampleCount: result.eligibleSampleCount,
      message: "Evidence-only pattern clusters and accuracy metrics were rebuilt.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Pattern clusters could not be rebuilt." },
      { status: 500 }
    );
  }
}
