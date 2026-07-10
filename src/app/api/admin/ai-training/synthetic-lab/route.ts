import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { buildSyntheticTrainingBenchmark } from "@/lib/aiFileIntelligence/trainingAccelerator";

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  return NextResponse.json(buildSyntheticTrainingBenchmark());
}

export async function POST(request: Request) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  return NextResponse.json({
    ...buildSyntheticTrainingBenchmark(),
    persisted: false,
    message: "Synthetic lab is dry-run only. No storage writes, no training sample approval and no customer files were created.",
  });
}
