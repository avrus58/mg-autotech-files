import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { updateLearningPairReview } from "@/lib/ecuIntelligence/learningFlywheel";
import { trainingFeatureKeys } from "@/lib/ecuIntelligence/types";

const serviceLabelsSchema = z.object(
  Object.fromEntries(trainingFeatureKeys.map((key) => [key, z.boolean()])) as Record<
    (typeof trainingFeatureKeys)[number],
    z.ZodBoolean
  >
);

const bodySchema = z.object({
  reviewStatus: z.enum(["pending_review", "needs_review", "human_verified", "approved", "quarantined", "excluded"]).optional(),
  performedServiceLabels: serviceLabelsSchema.optional(),
  learningUseStatus: z.enum(["pending", "approved_for_learning", "excluded"]).optional(),
  learningAuthorizationStatus: z.enum(["not_granted", "granted", "revoked", "unknown"]).optional(),
  learningAuthorizationTermsVersion: z.string().trim().max(80).nullable().optional(),
  markUnrelatedChanges: z.boolean().optional(),
  adminNotes: z.string().trim().max(3000).nullable().optional(),
}).strict();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ pairId: string }> }
) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid learning pair review update." }, { status: 400 });
  }
  const { pairId } = await context.params;
  try {
    const result = await updateLearningPairReview({
      pairId,
      actorUserId: auth.user.id,
      ...parsed.data,
    });
    return NextResponse.json({
      ...result,
      createsTrainingSampleOnlyAfterGates: true,
      autoApproved: false,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Learning pair review could not be updated." },
      { status: 400 }
    );
  }
}
