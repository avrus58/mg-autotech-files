import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { runSimilarityForTrainingSample } from "@/lib/ecuIntelligence/similarity";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;

  try {
    const result = await runSimilarityForTrainingSample(id, {
      actorUserId: auth.user.id,
      topN: 10,
    });
    return NextResponse.json({
      result,
      message: result.summary.matches_found
        ? `${result.summary.matches_found} approved evidence matches stored.`
        : "No eligible approved evidence match was found.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Similarity search could not be completed.",
      },
      { status: 500 }
    );
  }
}
