import { creditPackages, getCreditPackage } from "@/lib/creditPackages";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const paymentMethodIds = ["stripe", "paypal", "bank"] as const;
export type PaymentMethodId = (typeof paymentMethodIds)[number];
export type PriceAdjustmentType = "none" | "percentage" | "fixed";

export type CommerceSettings = {
  id: "default";
  currency: string;
  default_custom_credit_price_eur: number;
  global_adjustment_type: PriceAdjustmentType;
  global_adjustment_value: number;
  promotion_label: string | null;
  payment_paypal_enabled: boolean;
  payment_bank_enabled: boolean;
  payment_stripe_enabled: boolean;
  updated_at?: string;
};

export type CustomerCommercialPolicy = {
  user_id: string;
  credit_price_override_eur: number | null;
  adjustment_type: PriceAdjustmentType;
  adjustment_value: number;
  payment_paypal_enabled: boolean | null;
  payment_bank_enabled: boolean | null;
  payment_stripe_enabled: boolean | null;
  internal_note: string | null;
  updated_at?: string;
};

export type EffectivePaymentMethods = Record<PaymentMethodId, boolean>;

export const defaultCommerceSettings: CommerceSettings = {
  id: "default",
  currency: "EUR",
  default_custom_credit_price_eur: 5,
  global_adjustment_type: "percentage",
  global_adjustment_value: 20,
  promotion_label: "Limited time -20% on all credit purchases",
  payment_paypal_enabled: true,
  payment_bank_enabled: true,
  payment_stripe_enabled: true,
};

export function emptyCustomerCommercialPolicy(userId: string): CustomerCommercialPolicy {
  return {
    user_id: userId,
    credit_price_override_eur: null,
    adjustment_type: "none",
    adjustment_value: 0,
    payment_paypal_enabled: null,
    payment_bank_enabled: null,
    payment_stripe_enabled: null,
    internal_note: null,
  };
}

function asNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function tableUnavailable(error: { code?: string; message?: string } | null | undefined) {
  return ["42P01", "42703", "PGRST204", "PGRST205"].includes(error?.code || "") ||
    Boolean(error?.message?.toLowerCase().includes("schema cache"));
}

function normalizeSettings(row: Record<string, unknown> | null): CommerceSettings {
  if (!row) return defaultCommerceSettings;
  return {
    id: "default",
    currency: String(row.currency || "EUR").toUpperCase(),
    default_custom_credit_price_eur: asNumber(row.default_custom_credit_price_eur, 5),
    global_adjustment_type: (["none", "percentage", "fixed"].includes(String(row.global_adjustment_type))
      ? row.global_adjustment_type
      : "percentage") as PriceAdjustmentType,
    global_adjustment_value: asNumber(row.global_adjustment_value, 20),
    promotion_label: typeof row.promotion_label === "string" ? row.promotion_label : null,
    payment_paypal_enabled: row.payment_paypal_enabled !== false,
    payment_bank_enabled: row.payment_bank_enabled !== false,
    payment_stripe_enabled: row.payment_stripe_enabled !== false,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

function normalizeCustomerPolicy(userId: string, row: Record<string, unknown> | null): CustomerCommercialPolicy {
  const empty = emptyCustomerCommercialPolicy(userId);
  if (!row) return empty;
  return {
    user_id: userId,
    credit_price_override_eur: row.credit_price_override_eur == null ? null : asNumber(row.credit_price_override_eur, 0),
    adjustment_type: (["none", "percentage", "fixed"].includes(String(row.adjustment_type))
      ? row.adjustment_type
      : "none") as PriceAdjustmentType,
    adjustment_value: asNumber(row.adjustment_value, 0),
    payment_paypal_enabled: typeof row.payment_paypal_enabled === "boolean" ? row.payment_paypal_enabled : null,
    payment_bank_enabled: typeof row.payment_bank_enabled === "boolean" ? row.payment_bank_enabled : null,
    payment_stripe_enabled: typeof row.payment_stripe_enabled === "boolean" ? row.payment_stripe_enabled : null,
    internal_note: typeof row.internal_note === "string" ? row.internal_note : null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

export async function getCommercialContext(userId: string) {
  const admin = getSupabaseAdmin();
  const [globalResult, customerResult] = await Promise.all([
    admin.from("commerce_settings").select("*").eq("id", "default").maybeSingle(),
    admin.from("customer_commercial_policies").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  if (globalResult.error && !tableUnavailable(globalResult.error)) throw new Error(globalResult.error.message);
  if (customerResult.error && !tableUnavailable(customerResult.error)) throw new Error(customerResult.error.message);

  return {
    settings: normalizeSettings((globalResult.data as Record<string, unknown> | null) ?? null),
    customerPolicy: normalizeCustomerPolicy(userId, (customerResult.data as Record<string, unknown> | null) ?? null),
    migrationReady: !globalResult.error && !customerResult.error,
  };
}

export function applyUnitAdjustment(
  unitPrice: number,
  type: PriceAdjustmentType,
  value: number
) {
  const safeUnit = Math.max(0.01, unitPrice);
  if (type === "percentage") return Math.max(0.01, safeUnit * (1 - value / 100));
  if (type === "fixed") return Math.max(0.01, safeUnit - value);
  return safeUnit;
}

export function effectivePaymentMethods(
  settings: CommerceSettings,
  policy: CustomerCommercialPolicy
): EffectivePaymentMethods {
  return {
    stripe: policy.payment_stripe_enabled ?? settings.payment_stripe_enabled,
    paypal: policy.payment_paypal_enabled ?? settings.payment_paypal_enabled,
    bank: policy.payment_bank_enabled ?? settings.payment_bank_enabled,
  };
}

export function calculateEffectiveUnitPrice(input: {
  catalogUnitPrice: number;
  settings: CommerceSettings;
  customerPolicy: CustomerCommercialPolicy;
}) {
  const customerOverride = input.customerPolicy.credit_price_override_eur;
  const afterGlobal = customerOverride == null
    ? applyUnitAdjustment(
        input.catalogUnitPrice,
        input.settings.global_adjustment_type,
        input.settings.global_adjustment_value
      )
    : customerOverride;
  return Number(
    applyUnitAdjustment(
      afterGlobal,
      input.customerPolicy.adjustment_type,
      input.customerPolicy.adjustment_value
    ).toFixed(4)
  );
}

export function buildCreditQuote(
  settings: CommerceSettings,
  customerPolicy: CustomerCommercialPolicy
) {
  const methods = effectivePaymentMethods(settings, customerPolicy);
  const packages = creditPackages.map((item) => {
    const catalogUnitPrice = item.basePriceEuro / item.credits;
    const unitPriceEuro = calculateEffectiveUnitPrice({ catalogUnitPrice, settings, customerPolicy });
    return {
      ...item,
      priceEuro: Number((unitPriceEuro * item.credits).toFixed(2)),
      unitPriceEuro,
    };
  });
  const customUnitPriceEuro = calculateEffectiveUnitPrice({
    catalogUnitPrice: settings.default_custom_credit_price_eur,
    settings,
    customerPolicy,
  });

  return {
    currency: settings.currency,
    promotionLabel: settings.promotion_label,
    customBaseUnitPriceEuro: settings.default_custom_credit_price_eur,
    customUnitPriceEuro,
    packages,
    paymentMethods: methods,
    customerPricingActive:
      customerPolicy.credit_price_override_eur != null ||
      customerPolicy.adjustment_type !== "none" ||
      [
        customerPolicy.payment_stripe_enabled,
        customerPolicy.payment_paypal_enabled,
        customerPolicy.payment_bank_enabled,
      ].some((value) => value != null),
  };
}

export async function getCreditPurchaseQuote(
  userId: string,
  body: { packageId?: unknown; customCredits?: unknown },
  paymentMethod?: PaymentMethodId
) {
  const context = await getCommercialContext(userId);
  const quote = buildCreditQuote(context.settings, context.customerPolicy);
  if (paymentMethod && !quote.paymentMethods[paymentMethod]) {
    throw new Error(`${paymentMethod.toUpperCase()} is not available for this customer account.`);
  }

  if (typeof body.packageId === "string") {
    const packageData = quote.packages.find((item) => item.id === body.packageId);
    if (!packageData || !getCreditPackage(body.packageId)) return null;
    return {
      id: packageData.id,
      credits: packageData.credits,
      priceEuro: packageData.priceEuro,
      unitPriceEuro: packageData.unitPriceEuro,
      description: packageData.description,
      purchaseType: "package" as const,
      quote,
      migrationReady: context.migrationReady,
    };
  }

  const customCredits = Number(body.customCredits ?? 0);
  if (!Number.isInteger(customCredits) || customCredits < 1 || customCredits > 1000) return null;
  return {
    id: `custom_${customCredits}`,
    credits: customCredits,
    priceEuro: Number((customCredits * quote.customUnitPriceEuro).toFixed(2)),
    unitPriceEuro: quote.customUnitPriceEuro,
    description: `Custom credit purchase: ${customCredits} credits at EUR ${quote.customUnitPriceEuro.toFixed(2)} per credit.`,
    purchaseType: "custom" as const,
    quote,
    migrationReady: context.migrationReady,
  };
}
