import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import {
  maxGrowthClassificationBatchSize,
  validateGrowthClassificationChanges,
} from "@/lib/growth/customerClassificationReview";
import {
  growthClassificationSaveError,
  saveGrowthCustomerClassificationBatch,
} from "@/lib/growth/customerClassificationReviewServer";
import {
  isGrowthCustomerClassificationMigrationMissing,
  loadGrowthCustomerClassificationAdminData,
} from "@/lib/growth/customerClassificationServer";
import { growthCustomerClassifications } from "@/lib/growth/types";

const timestampSchema = z.string().max(64).refine((value) => Number.isFinite(Date.parse(value)), {
  message: "Invalid review version.",
});
const changeSchema = z.object({
  userId: z.string().uuid(),
  classification: z.enum(growthCustomerClassifications),
  reason: z.string().trim().max(240).nullable(),
  expectedUpdatedAt: timestampSchema.nullable(),
}).strict();
const batchSchema = z.object({
  changes: z.array(changeSchema).min(1).max(maxGrowthClassificationBatchSize),
}).strict();

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  Vary: "Authorization",
};

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "customers.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers });

  try {
    return NextResponse.json(await loadGrowthCustomerClassificationAdminData(), { headers });
  } catch (error) {
    return NextResponse.json({
      error: isGrowthCustomerClassificationMigrationMissing(error)
        ? "Customer classification migration is required."
        : "Customer classification data is temporarily unavailable.",
    }, { status: 503, headers });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireStaffPermission(request, "customers.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers });

  const rawBody = await request.text().catch(() => "");
  if (new TextEncoder().encode(rawBody).byteLength > 64_000) {
    return NextResponse.json({ error: "Customer review batch is too large." }, { status: 413, headers });
  }
  let rawPayload: unknown = null;
  try { rawPayload = JSON.parse(rawBody); } catch { /* handled by schema */ }
  const body = batchSchema.safeParse(rawPayload);
  if (!body.success) {
    return NextResponse.json({ error: "Invalid customer review batch." }, { status: 400, headers });
  }
  const validationError = validateGrowthClassificationChanges(body.data.changes);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400, headers });
  }

  const result = await saveGrowthCustomerClassificationBatch({
    changes: body.data.changes,
    actorUserId: auth.user.id,
  });
  if (result.error) {
    if (isGrowthCustomerClassificationMigrationMissing(result.error)) {
      return NextResponse.json({ error: "Customer classification bulk-review migration is required." }, { status: 503, headers });
    }
    const mapped = growthClassificationSaveError(result.error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status, headers });
  }

  const saved = result.data && typeof result.data === "object"
    ? result.data as { batch_id?: unknown; saved_count?: unknown }
    : {};
  return NextResponse.json({
    ok: true,
    batchId: typeof saved.batch_id === "string" ? saved.batch_id : null,
    savedCount: Number(saved.saved_count ?? body.data.changes.length),
  }, { headers });
}
