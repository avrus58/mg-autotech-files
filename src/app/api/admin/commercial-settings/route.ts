import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getCommercialContext } from "@/lib/commercialPolicy";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const schema = z.object({
  defaultCustomCreditPriceEuro: z.number().positive().max(1000),
  adjustmentType: z.enum(["none", "percentage", "fixed"]),
  adjustmentValue: z.number().min(-1000).max(1000),
  promotionLabel: z.string().trim().max(180).nullable(),
  paymentMethods: z.object({
    stripe: z.boolean(),
    paypal: z.boolean(),
    bank: z.boolean(),
  }),
}).superRefine((value, context) => {
  if (value.adjustmentType === "percentage" && Math.abs(value.adjustmentValue) > 100) {
    context.addIssue({ code: "custom", path: ["adjustmentValue"], message: "Percentage adjustment must be between -100 and 100." });
  }
});

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "credits.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const context = await getCommercialContext(auth.user.id);
    return NextResponse.json({ settings: context.settings, migrationReady: context.migrationReady });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Commercial settings could not be loaded." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireStaffPermission(request, "credits.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid commercial settings." }, { status: 400 });

  const admin = getSupabaseAdmin();
  const current = await admin.from("commerce_settings").select("*").eq("id", "default").maybeSingle();
  if (current.error) return NextResponse.json({ error: current.error.message }, { status: 500 });
  const payload = {
    id: "default",
    default_custom_credit_price_eur: parsed.data.defaultCustomCreditPriceEuro,
    global_adjustment_type: parsed.data.adjustmentType,
    global_adjustment_value: parsed.data.adjustmentValue,
    promotion_label: parsed.data.promotionLabel || null,
    payment_stripe_enabled: parsed.data.paymentMethods.stripe,
    payment_paypal_enabled: parsed.data.paymentMethods.paypal,
    payment_bank_enabled: parsed.data.paymentMethods.bank,
    updated_by: auth.user.id,
  };
  const saved = await admin.from("commerce_settings").upsert(payload, { onConflict: "id" }).select("*").single();
  if (saved.error) return NextResponse.json({ error: saved.error.message }, { status: 500 });
  await admin.from("commerce_policy_events").insert({
    scope: "global",
    actor_user_id: auth.user.id,
    event_type: "global_commercial_policy_updated",
    before_json: current.data,
    after_json: saved.data,
  });
  return NextResponse.json({ settings: saved.data });
}
