import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  return NextResponse.json({
    status: "ready_for_dry_run",
    persistentWorkbenchRequiresSql: true,
    migration: "scripts/add-ai-dataset-import-workbench.sql",
    safety: {
      dryRunOnlyByDefault: true,
      createsTrainingSamples: false,
      approvesLearningAutomatically: false,
      generatesModFiles: false,
    },
  });
}
