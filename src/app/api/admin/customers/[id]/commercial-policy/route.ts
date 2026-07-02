import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { buildCreditQuote, getCommercialContext } from "@/lib/commercialPolicy";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const schema = z.object({
  creditPriceOverrideEuro: z.number().positive().max(1000).nullable(),
  adjustmentType: z.enum(["none", "percentage", "fixed"]),
  adjustmentValue: z.number().min(-1000).max(1000),
  paymentMethods: z.object({
    sumup: z.boolean().nullable(),
    paypal: z.boolean().nullable(),
    bank: z.boolean().nullable(),
    stripe: z.boolean().nullable(),
  }),
  internalNote: z.string().trim().max(2000).nullable(),
}).superRefine((value, context) => {
  if (value.adjustmentType === "percentage" && Math.abs(value.adjustmentValue) > 100) {
    context.addIssue({ code: "custom", path: ["adjustmentValue"], message: "Percentage adjustment must be between -100 and 100." });
  }
});

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffPermission(request, "credits.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  try {
    const commercial = await getCommercialContext(id);
    return NextResponse.json({
      policy: commercial.customerPolicy,
      effectiveQuote: buildCreditQuote(commercial.settings, commercial.customerPolicy),
      migrationReady: commercial.migrationReady,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Customer commercial policy could not be loaded." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffPermission(request, "credits.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid customer commercial policy." }, { status: 400 });
  const { id } = await context.params;
  const admin = getSupabaseAdmin();
  const customer = await admin.from("profiles").select("id").eq("id", id).maybeSingle();
  if (customer.error || !customer.data) return NextResponse.json({ error: customer.error?.message || "Customer not found." }, { status: 404 });
  const current = await admin.from("customer_commercial_policies").select("*").eq("user_id", id).maybeSingle();
  if (current.error) return NextResponse.json({ error: current.error.message }, { status: 500 });
  const payload = {
    user_id: id,
    credit_price_override_eur: parsed.data.creditPriceOverrideEuro,
    adjustment_type: parsed.data.adjustmentType,
    adjustment_value: parsed.data.adjustmentValue,
    payment_sumup_enabled: parsed.data.paymentMethods.sumup,
    payment_paypal_enabled: parsed.data.paymentMethods.paypal,
    payment_bank_enabled: parsed.data.paymentMethods.bank,
    payment_stripe_enabled: parsed.data.paymentMethods.stripe,
    internal_note: parsed.data.internalNote || null,
    updated_by: auth.user.id,
  };
  const saved = await admin.from("customer_commercial_policies").upsert(payload, { onConflict: "user_id" }).select("*").single();
  if (saved.error) return NextResponse.json({ error: saved.error.message }, { status: 500 });
  await admin.from("commerce_policy_events").insert({
    scope: "customer",
    customer_id: id,
    actor_user_id: auth.user.id,
    event_type: "customer_commercial_policy_updated",
    before_json: current.data,
    after_json: saved.data,
  });
  const commercial = await getCommercialContext(id);
  return NextResponse.json({ policy: commercial.customerPolicy, effectiveQuote: buildCreditQuote(commercial.settings, commercial.customerPolicy) });
}
