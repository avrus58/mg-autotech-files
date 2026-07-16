import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { backfillCompletedLearningPairs } from "@/lib/ecuIntelligence/learningFlywheel";
import { recoverFailedLearningIngestionJobs } from "@/lib/ecuIntelligence/learningIngestion";
import { resolveLearningFlywheelFlags } from "@/lib/ecuIntelligence/learningConfig";

const bodySchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  dryRun: z.boolean().default(true),
  mode: z.enum(["recovery_only", "recovery_and_historical"]).default("recovery_and_historical"),
}).strict();

export async function POST(request: Request) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid backfill request." }, { status: 400 });
  }
  try {
    if (!parsed.data.dryRun && !resolveLearningFlywheelFlags().backfillEnabled) {
      return NextResponse.json({ error: "Learning backfill is disabled." }, { status: 403 });
    }
    const recovery = parsed.data.dryRun
      ? { inspected: 0, recovered: 0, failed: 0, results: [] }
      : await recoverFailedLearningIngestionJobs({
          actorUserId: auth.user.id,
          limit: parsed.data.limit,
        });
    if (!parsed.data.dryRun && parsed.data.mode === "recovery_only") {
      return NextResponse.json({
        dryRun: false,
        recovery,
        approvedLearningSamples: 0,
        createsApprovedSamples: false,
        message: "Failed candidate recovery completed without a historical scan.",
      });
    }
    const result = await backfillCompletedLearningPairs({
      actorUserId: auth.user.id,
      limit: parsed.data.limit,
      dryRun: parsed.data.dryRun,
    });
    return NextResponse.json({
      ...result,
      recovery,
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
