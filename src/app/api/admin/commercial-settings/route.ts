import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getCommerceSettings, normalizeCommerceSettings } from "@/lib/commercialPolicy";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const schema = z.object({
  defaultCustomCreditPriceEuro: z.number().min(0.01).max(1000),
  adjustmentType: z.enum(["none", "percentage", "fixed"]),
  adjustmentValue: z.number().min(-1000).max(1000),
  promotionLabel: z.string().trim().max(180).nullable(),
  paymentMethods: z.object({
    stripe: z.boolean(),
    bank: z.boolean(),
  }),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
}).strict().superRefine((value, context) => {
  if (value.adjustmentType === "percentage" && Math.abs(value.adjustmentValue) > 100) {
    context.addIssue({
      code: "custom",
      path: ["adjustmentValue"],
      message: "Percentage adjustment must be between -100 and 100.",
    });
  }
  if (value.adjustmentType === "none" && value.adjustmentValue !== 0) {
    context.addIssue({
      code: "custom",
      path: ["adjustmentValue"],
      message: "Adjustment value must be zero when no adjustment is selected.",
    });
  }
});

const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization",
};

const selectedColumns = "id,currency,default_custom_credit_price_eur,global_adjustment_type,global_adjustment_value,promotion_label,payment_bank_enabled,payment_stripe_enabled,updated_at";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: privateNoStoreHeaders });
}

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "credits.manage");
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  try {
    return json({ settings: await getCommerceSettings(), migrationReady: true });
  } catch {
    return json(
      { error: "Commercial settings are temporarily unavailable. No pricing changes can be saved." },
      503,
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireStaffPermission(request, "credits.manage");
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: parsed.error.issues[0]?.message || "Invalid commercial settings." },
      400,
    );
  }

  const admin = getSupabaseAdmin();
  const current = await admin
    .from("commerce_settings")
    .select(selectedColumns)
    .eq("id", "default")
    .maybeSingle();
  if (current.error || !current.data) {
    return json(
      { error: "Commercial settings are temporarily unavailable. Nothing was changed." },
      503,
    );
  }

  const currentUpdatedAt = typeof current.data.updated_at === "string"
    ? current.data.updated_at
    : null;
  if (parsed.data.expectedUpdatedAt !== currentUpdatedAt) {
    return json(
      {
        error: "These settings changed in another session. Reload the current values before saving.",
        code: "commercial_settings_conflict",
      },
      409,
    );
  }

  const payload = {
    default_custom_credit_price_eur: parsed.data.defaultCustomCreditPriceEuro,
    global_adjustment_type: parsed.data.adjustmentType,
    global_adjustment_value: parsed.data.adjustmentType === "none"
      ? 0
      : parsed.data.adjustmentValue,
    promotion_label: parsed.data.promotionLabel || null,
    payment_stripe_enabled: parsed.data.paymentMethods.stripe,
    payment_paypal_enabled: false,
    payment_bank_enabled: parsed.data.paymentMethods.bank,
    updated_by: auth.user.id,
  };

  let saveQuery = admin
    .from("commerce_settings")
    .update(payload)
    .eq("id", "default");
  if (currentUpdatedAt) {
    saveQuery = saveQuery.eq("updated_at", currentUpdatedAt);
  }
  const saved = await saveQuery.select(selectedColumns).maybeSingle();
  if (saved.error) {
    return json({ error: "Commercial settings could not be saved. Nothing was confirmed." }, 503);
  }
  if (!saved.data) {
    return json(
      {
        error: "These settings changed in another session. Reload the current values before saving.",
        code: "commercial_settings_conflict",
      },
      409,
    );
  }

  const audit = await admin.from("commerce_policy_events").insert({
    scope: "global",
    actor_user_id: auth.user.id,
    event_type: "global_commercial_policy_updated",
    before_json: current.data,
    after_json: saved.data,
  });

  return json({
    settings: normalizeCommerceSettings(saved.data as Record<string, unknown>),
    auditRecorded: !audit.error,
  });
}
