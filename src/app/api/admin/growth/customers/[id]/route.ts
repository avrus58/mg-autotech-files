import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { classificationExcludesAnalytics } from "@/lib/growth/customerClassification";
import { isGrowthCustomerClassificationMigrationMissing } from "@/lib/growth/customerClassificationServer";
import { growthCustomerClassifications } from "@/lib/growth/types";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const schema = z.object({
  classification: z.enum(growthCustomerClassifications),
  reason: z.string().trim().max(240).nullable().optional(),
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
  if (classificationExcludesAnalytics(body.data.classification) && (!reason || reason.length < 3)) {
    return response({ error: "A short reason is required for an excluded account." }, 400);
  }

  const result = await getSupabaseAdmin().rpc("set_growth_customer_classification", {
    p_user_id: userId.data,
    p_classification: body.data.classification,
    p_reason: reason,
    p_actor_user_id: auth.user.id,
  });
  if (result.error) {
    if (isGrowthCustomerClassificationMigrationMissing(result.error)) {
      return response({ error: "Customer classification migration is required." }, 503);
    }
    const message = String(result.error.message ?? "");
    if (message.includes("staff_accounts_are_already_excluded")) {
      return response({ error: "Staff accounts are already excluded from customer analytics." }, 409);
    }
    if (message.includes("growth_customer_not_found")) {
      return response({ error: "Customer account was not found." }, 404);
    }
    return response({ error: "Customer classification could not be saved." }, 503);
  }

  const saved = Array.isArray(result.data) ? result.data[0] : result.data;
  return response({
    ok: true,
    classification: saved ? {
      userId: String(saved.user_id),
      classification: String(saved.classification),
      analyticsExcluded: saved.analytics_excluded === true,
      reason: typeof saved.reason === "string" ? saved.reason : null,
      verifiedAt: typeof saved.verified_at === "string" ? saved.verified_at : null,
    } : null,
  });
}
