import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { isAiTrainingDemoEnabled } from "@/lib/ecuIntelligence/demoFixtures";
import { runAiTrainingDemo } from "@/lib/ecuIntelligence/demo";

export async function POST(request: Request) {
  if (!isAiTrainingDemoEnabled()) {
    return NextResponse.json({ error: "AI training demo mode is disabled." }, { status: 404 });
  }
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const result = await runAiTrainingDemo(auth.user.id);
    return NextResponse.json({
      ...result,
      demo: true,
      message: result.status === "duplicate"
        ? "The deterministic demo sample already exists; duplicate prevention worked."
        : "Demo ORI/MOD pair completed the Level 0 learning pipeline.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI training demo failed." },
      { status: 500 }
    );
  }
}
