import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission, requireStaffPermissions } from "@/lib/apiAuth";
import { classificationNeedsEvidenceNote } from "@/lib/growth/customerClassificationReview";
import { customerIntelligencePermissions } from "@/lib/growth/access";
import {
  growthClassificationSaveError,
  saveGrowthCustomerClassificationBatch,
} from "@/lib/growth/customerClassificationReviewServer";
import { isGrowthCustomerClassificationMigrationMissing } from "@/lib/growth/customerClassificationServer";
import { loadCustomerIntelligenceReport } from "@/lib/growth/customerIntelligenceServer";
import { growthCustomerClassifications } from "@/lib/growth/types";

const schema = z.object({
  classification: z.enum(growthCustomerClassifications),
  reason: z.string().trim().max(240).nullable().optional(),
  expectedUpdatedAt: z.string().max(64).refine((value) => Number.isFinite(Date.parse(value))).nullable(),
}).strict();

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  Vary: "Authorization",
};

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffPermissions(request, customerIntelligencePermissions);
  if (!auth.ok) return response({ error: auth.error }, auth.status);

  const { id } = await context.params;
  const userId = z.string().uuid().safeParse(id);
  if (!userId.success) return response({ error: "Invalid customer identifier." }, 400);

  try {
    const report = await loadCustomerIntelligenceReport(userId.data);
    return report
      ? response(report as unknown as Record<string, unknown>)
      : response({ error: "Customer was not found." }, 404);
  } catch (error) {
    console.error("Customer intelligence report failed", {
      customerIdPrefix: userId.data.slice(0, 8),
      error: error instanceof Error ? error.message : "unknown",
    });
    return response({ error: "Customer intelligence is temporarily unavailable." }, 503);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffPermission(request, "customers.manage");
  if (!auth.ok) return response({ error: auth.error }, auth.status);

  const { id } = await context.params;
  const userId = z.string().uuid().safeParse(id);
  const rawBody = await request.text().catch(() => "");
  if (new TextEncoder().encode(rawBody).byteLength > 2_048) {
    return response({ error: "Customer classification request is too large." }, 413);
  }
  const body = schema.safeParse((() => {
    try { return JSON.parse(rawBody); } catch { return null; }
  })());
  if (!userId.success || !body.success) {
    return response({ error: "Invalid customer classification request." }, 400);
  }

  const reason = body.data.reason?.trim() || null;
  if (classificationNeedsEvidenceNote(body.data.classification) && (!reason || reason.length < 3)) {
    return response({ error: "A short evidence note is required for every reviewed account." }, 400);
  }

  const result = await saveGrowthCustomerClassificationBatch({
    changes: [{
      userId: userId.data,
      classification: body.data.classification,
      reason,
      expectedUpdatedAt: body.data.expectedUpdatedAt,
    }],
    actorUserId: auth.user.id,
  });
  if (result.error) {
    if (isGrowthCustomerClassificationMigrationMissing(result.error)) {
      return response({ error: "Customer classification migration is required." }, 503);
    }
    const mapped = growthClassificationSaveError(result.error);
    return response({ error: mapped.message }, mapped.status);
  }

  return response({
    ok: true,
    savedCount: 1,
  });
}
