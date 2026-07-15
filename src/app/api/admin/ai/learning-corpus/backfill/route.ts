import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { backfillCompletedLearningPairs } from "@/lib/ecuIntelligence/learningFlywheel";

const bodySchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  dryRun: z.boolean().default(true),
}).strict();

export async function POST(request: Request) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid backfill request." }, { status: 400 });
  }
  try {
    const result = await backfillCompletedLearningPairs({
      actorUserId: auth.user.id,
      limit: parsed.data.limit,
      dryRun: parsed.data.dryRun,
    });
    return NextResponse.json({
      ...result,
      approvedLearningSamples: 0,
      createsApprovedSamples: false,
      message: parsed.data.dryRun
        ? "Dry-run complete. No candidates were created."
        : "Historical backfill created review-first candidates only.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Learning backfill failed." },
      { status: 500 }
    );
  }
}
