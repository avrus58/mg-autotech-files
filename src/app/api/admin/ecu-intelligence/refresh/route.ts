import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getEcuIntelligenceFeatureFlags, centerSafety, ecuIntelligenceCenterEngineVersion } from "@/lib/ecuIntelligence/center/server";

export async function POST(request: Request) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const flags = getEcuIntelligenceFeatureFlags();
  if (!flags.refreshEnabled) {
    return NextResponse.json({
      status: "disabled",
      error: "ECU Intelligence refresh is fail-closed. Set ECU_INTELLIGENCE_REFRESH_ENABLED=true only when a private read model exists.",
      engineVersion: ecuIntelligenceCenterEngineVersion,
      safety: centerSafety(),
    }, { status: 409 });
  }

  return NextResponse.json({
    status: "noop",
    message: "No derived read model is configured. Live server-side aggregation remains authoritative.",
    engineVersion: ecuIntelligenceCenterEngineVersion,
    safety: centerSafety(),
  });
}
