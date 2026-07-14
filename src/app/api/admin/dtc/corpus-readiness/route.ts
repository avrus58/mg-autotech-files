import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { loadDtcCorpusReadinessReport } from "@/lib/dtcActive/corpusReadinessData";

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const result = await loadDtcCorpusReadinessReport();
    return NextResponse.json({
      ...result,
      safety: {
        readOnly: true,
        firmwareBytesMutated: false,
        outputArtifactsCreated: false,
        customerDeliveryEnabled: false,
        phaseDCustomerProcessingStarted: false,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "DTC corpus readiness could not be loaded." },
      { status: 500 }
    );
  }
}
