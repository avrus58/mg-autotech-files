import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import {
  MAX_CREDIT_PACKAGE_TOTAL_EURO,
  MAX_CUSTOM_CREDIT_UNIT_PRICE_EURO,
  minimumCreditPackageTotalEuro,
} from "@/lib/creditPackages";
import { getCommerceSettings, normalizeCommerceSettings } from "@/lib/commercialPolicy";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const packagePricesSchema = z.object({
  credits_10: z.number().min(minimumCreditPackageTotalEuro(10)).max(MAX_CREDIT_PACKAGE_TOTAL_EURO).multipleOf(0.01),
  credits_50: z.number().min(minimumCreditPackageTotalEuro(50)).max(MAX_CREDIT_PACKAGE_TOTAL_EURO).multipleOf(0.01),
  credits_100: z.number().min(minimumCreditPackageTotalEuro(100)).max(MAX_CREDIT_PACKAGE_TOTAL_EURO).multipleOf(0.01),
  credits_250: z.number().min(minimumCreditPackageTotalEuro(250)).max(MAX_CREDIT_PACKAGE_TOTAL_EURO).multipleOf(0.01),
  credits_500: z.number().min(minimumCreditPackageTotalEuro(500)).max(MAX_CREDIT_PACKAGE_TOTAL_EURO).multipleOf(0.01),
}).strict();

const schema = z.object({
  packagePricesEuro: packagePricesSchema,
  customUnitPriceEuro: z.number().min(0.01).max(MAX_CUSTOM_CREDIT_UNIT_PRICE_EURO).multipleOf(0.0001),
  promotionLabel: z.string().trim().max(180).nullable(),
  paymentMethods: z.object({
    stripe: z.boolean(),
    bank: z.boolean(),
  }).strict(),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
}).strict();

const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization",
};

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

  const { packagePricesEuro, paymentMethods } = parsed.data;
  const admin = getSupabaseAdmin();
  const saved = await admin.rpc("save_commerce_settings_v2", {
    p_expected_updated_at: parsed.data.expectedUpdatedAt,
    p_credit_package_10_total_eur: packagePricesEuro.credits_10,
    p_credit_package_50_total_eur: packagePricesEuro.credits_50,
    p_credit_package_100_total_eur: packagePricesEuro.credits_100,
    p_credit_package_250_total_eur: packagePricesEuro.credits_250,
    p_credit_package_500_total_eur: packagePricesEuro.credits_500,
    p_custom_credit_unit_price_eur: parsed.data.customUnitPriceEuro,
    p_promotion_label: parsed.data.promotionLabel || null,
    p_payment_stripe_enabled: paymentMethods.stripe,
    p_payment_bank_enabled: paymentMethods.bank,
    p_actor_user_id: auth.user.id,
  });

  if (saved.error || !saved.data || typeof saved.data !== "object") {
    return json({ error: "Commercial settings could not be saved. Nothing was confirmed." }, 503);
  }

  const result = saved.data as {
    ok?: boolean;
    code?: string;
    settings?: Record<string, unknown>;
    auditRecorded?: boolean;
  };
  if (!result.ok && result.code === "commercial_settings_conflict") {
    return json(
      {
        error: "These settings changed in another session. Reload the current values before saving.",
        code: result.code,
      },
      409,
    );
  }
  if (!result.ok && result.code === "explicit_pricing_writes_not_activated") {
    return json(
      {
        error: "Explicit price writes are locked until the verified v2 rollback bridge is activated.",
        code: result.code,
      },
      503,
    );
  }
  if (!result.ok || !result.settings || result.auditRecorded !== true) {
    return json({ error: "Commercial settings could not be saved. Nothing was confirmed." }, 503);
  }

  try {
    return json({
      settings: normalizeCommerceSettings(result.settings),
      auditRecorded: true,
    });
  } catch {
    return json(
      { error: "Saved settings could not be verified. Reload before making another change." },
      503,
    );
  }
}
