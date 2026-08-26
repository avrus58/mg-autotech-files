import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import {
  MAX_CREDIT_PACKAGE_TOTAL_EURO,
  MAX_CUSTOM_CREDIT_UNIT_PRICE_EURO,
  minimumCreditPackageTotalEuro,
} from "@/lib/creditPackages";
import { buildCreditQuote } from "@/lib/commercialPricing";
import {
  getCommerceSettings,
  getCustomerCommercialPolicy,
  normalizeCustomerCommercialPolicy,
} from "@/lib/commercialPolicy";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const nullablePackagePrice = (credits: number) => z.number()
  .min(minimumCreditPackageTotalEuro(credits))
  .max(MAX_CREDIT_PACKAGE_TOTAL_EURO)
  .multipleOf(0.01)
  .nullable();

const schema = z.object({
  packagePriceOverridesEuro: z.object({
    credits_10: nullablePackagePrice(10),
    credits_50: nullablePackagePrice(50),
    credits_100: nullablePackagePrice(100),
    credits_250: nullablePackagePrice(250),
    credits_500: nullablePackagePrice(500),
  }).strict(),
  customUnitPriceOverrideEuro: z.number()
    .min(0.01)
    .max(MAX_CUSTOM_CREDIT_UNIT_PRICE_EURO)
    .multipleOf(0.0001)
    .nullable(),
  paymentMethods: z.object({
    stripe: z.boolean().nullable(),
    bank: z.boolean().nullable(),
  }).strict(),
  internalNote: z.string().trim().max(2000).nullable(),
  expectedUpdatedAt: z.string().datetime({ offset: true }).nullable(),
}).strict();

const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: privateNoStoreHeaders });
}

async function customerExists(id: string) {
  const admin = getSupabaseAdmin();
  const customer = await admin
    .from("profiles")
    .select("id,role")
    .eq("id", id)
    .eq("role", "customer")
    .maybeSingle();
  return customer.error ? "error" as const : customer.data ? "yes" as const : "no" as const;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffPermission(request, "credits.manage");
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return json({ error: "Invalid customer identifier." }, 400);
  }

  const existence = await customerExists(id);
  if (existence === "error") return json({ error: "Customer pricing could not be loaded." }, 503);
  if (existence === "no") return json({ error: "Customer not found." }, 404);

  try {
    const [settings, customerPolicy] = await Promise.all([
      getCommerceSettings(),
      getCustomerCommercialPolicy(id),
    ]);
    return json({
      policy: customerPolicy,
      effectiveQuote: buildCreditQuote(settings, customerPolicy),
      explicitPricingWritesEnabled: settings.explicit_pricing_writes_enabled,
      migrationReady: true,
    });
  } catch {
    return json(
      { error: "Customer pricing is temporarily unavailable. Retry before making changes." },
      503,
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffPermission(request, "credits.manage");
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: parsed.error.issues[0]?.message || "Invalid customer commercial policy." },
      400,
    );
  }

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return json({ error: "Invalid customer identifier." }, 400);
  }

  const existence = await customerExists(id);
  if (existence === "error") return json({ error: "Customer pricing could not be saved." }, 503);
  if (existence === "no") return json({ error: "Customer not found." }, 404);

  try {
    await getCommerceSettings();
  } catch {
    return json(
      { error: "Global pricing is temporarily unavailable. Nothing was changed." },
      503,
    );
  }

  const { packagePriceOverridesEuro, paymentMethods } = parsed.data;
  const admin = getSupabaseAdmin();
  const saved = await admin.rpc("save_customer_commercial_policy_v2", {
    p_user_id: id,
    p_expected_updated_at: parsed.data.expectedUpdatedAt,
    p_credit_package_10_total_override_eur: packagePriceOverridesEuro.credits_10,
    p_credit_package_50_total_override_eur: packagePriceOverridesEuro.credits_50,
    p_credit_package_100_total_override_eur: packagePriceOverridesEuro.credits_100,
    p_credit_package_250_total_override_eur: packagePriceOverridesEuro.credits_250,
    p_credit_package_500_total_override_eur: packagePriceOverridesEuro.credits_500,
    p_custom_credit_unit_price_override_eur: parsed.data.customUnitPriceOverrideEuro,
    p_payment_stripe_enabled: paymentMethods.stripe,
    p_payment_bank_enabled: paymentMethods.bank,
    p_internal_note: parsed.data.internalNote || null,
    p_actor_user_id: auth.user.id,
  });

  if (saved.error || !saved.data || typeof saved.data !== "object") {
    return json({ error: "Customer pricing could not be saved. Nothing was confirmed." }, 503);
  }

  const result = saved.data as {
    ok?: boolean;
    code?: string;
    policy?: Record<string, unknown>;
    auditRecorded?: boolean;
  };
  if (!result.ok && result.code === "customer_commercial_policy_conflict") {
    return json(
      {
        error: "This customer pricing policy changed in another session. Reload it before saving.",
        code: result.code,
      },
      409,
    );
  }
  if (!result.ok && result.code === "explicit_pricing_writes_not_activated") {
    return json(
      {
        error: "Customer price writes are locked until the verified v2 rollback bridge is activated.",
        code: result.code,
      },
      503,
    );
  }
  if (!result.ok || !result.policy || result.auditRecorded !== true) {
    return json({ error: "Customer pricing could not be saved. Nothing was confirmed." }, 503);
  }

  try {
    const policy = normalizeCustomerCommercialPolicy(id, result.policy);
    const currentSettings = await getCommerceSettings();
    return json({
      policy,
      effectiveQuote: buildCreditQuote(currentSettings, policy),
      explicitPricingWritesEnabled: currentSettings.explicit_pricing_writes_enabled,
      auditRecorded: true,
    });
  } catch {
    return json(
      { error: "Saved customer pricing could not be verified. Reload before another change." },
      503,
    );
  }
}
