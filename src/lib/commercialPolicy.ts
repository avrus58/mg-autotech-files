import { createHash } from "node:crypto";
import { getCreditPackage } from "@/lib/creditPackages";
import {
  buildCreditQuote,
  calculateCreditTotalEuro,
  emptyCustomerCommercialPolicy,
  type CommerceSettings,
  type CustomerCommercialPolicy,
  type PaymentMethodId,
  type PriceAdjustmentType,
} from "@/lib/commercialPricing";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export {
  applyUnitAdjustment,
  buildCreditQuote,
  calculateEffectiveUnitPrice,
  defaultCommerceSettings,
  effectivePaymentMethods,
  emptyCustomerCommercialPolicy,
  paymentMethodIds,
  pricingSource,
} from "@/lib/commercialPricing";
export type {
  CommerceSettings,
  CustomerCommercialPolicy,
  EffectivePaymentMethods,
  PaymentMethodId,
  PriceAdjustmentType,
  PricingSource,
} from "@/lib/commercialPricing";

const MAX_UNIT_PRICE_EURO = 1000;
const MAX_ADJUSTMENT = 1000;
const QUOTE_ID_PATTERN = /^[a-f0-9]{40}$/;

export class CommercialPricingUnavailableError extends Error {
  readonly code = "commercial_pricing_unavailable";

  constructor() {
    super("Commercial pricing is temporarily unavailable.");
    this.name = "CommercialPricingUnavailableError";
  }
}

export class StaleCreditQuoteError extends Error {
  readonly code = "credit_quote_stale";

  constructor() {
    super("Credit prices changed after this quote was loaded.");
    this.name = "StaleCreditQuoteError";
  }
}

export class PaymentMethodUnavailableError extends Error {
  readonly code = "payment_method_unavailable";

  constructor(paymentMethod: PaymentMethodId) {
    super(`${paymentMethod.toUpperCase()} is not available for this customer account.`);
    this.name = "PaymentMethodUnavailableError";
  }
}

function unavailable(): never {
  throw new CommercialPricingUnavailableError();
}

function finiteNumber(value: unknown, minimum: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) unavailable();
  return parsed;
}

function adjustment(
  rawType: unknown,
  rawValue: unknown,
): { type: PriceAdjustmentType; value: number } {
  const type = String(rawType);
  if (!["none", "percentage", "fixed"].includes(type)) unavailable();
  if (type === "none") return { type, value: 0 };

  const value = finiteNumber(rawValue, -MAX_ADJUSTMENT, MAX_ADJUSTMENT);
  if (type === "percentage" && Math.abs(value) > 100) unavailable();
  return { type: type as PriceAdjustmentType, value };
}

function booleanValue(value: unknown) {
  if (typeof value !== "boolean") unavailable();
  return value;
}

export function normalizeCommerceSettings(row: Record<string, unknown> | null): CommerceSettings {
  if (!row || row.id !== "default" || row.currency !== "EUR") unavailable();
  if (typeof row.updated_at !== "string") unavailable();
  const globalAdjustment = adjustment(
    row.global_adjustment_type,
    row.global_adjustment_value,
  );

  return {
    id: "default",
    currency: "EUR",
    default_custom_credit_price_eur: finiteNumber(
      row.default_custom_credit_price_eur,
      0.01,
      MAX_UNIT_PRICE_EURO,
    ),
    global_adjustment_type: globalAdjustment.type,
    global_adjustment_value: globalAdjustment.value,
    promotion_label: row.promotion_label == null
      ? null
      : typeof row.promotion_label === "string" && row.promotion_label.length <= 180
        ? row.promotion_label
        : unavailable(),
    payment_paypal_enabled: false,
    payment_bank_enabled: booleanValue(row.payment_bank_enabled),
    payment_stripe_enabled: booleanValue(row.payment_stripe_enabled),
    updated_at: row.updated_at,
  };
}

export function normalizeCustomerCommercialPolicy(
  userId: string,
  row: Record<string, unknown> | null,
): CustomerCommercialPolicy {
  if (!row) return emptyCustomerCommercialPolicy(userId);
  if (row.user_id !== userId || typeof row.updated_at !== "string") unavailable();
  const customerAdjustment = adjustment(row.adjustment_type, row.adjustment_value);
  const override = row.credit_price_override_eur == null
    ? null
    : finiteNumber(row.credit_price_override_eur, 0.01, MAX_UNIT_PRICE_EURO);

  if (override != null && customerAdjustment.type !== "none") unavailable();

  const nullableBoolean = (value: unknown) => {
    if (value == null) return null;
    return booleanValue(value);
  };

  return {
    user_id: userId,
    credit_price_override_eur: override,
    adjustment_type: customerAdjustment.type,
    adjustment_value: customerAdjustment.value,
    payment_paypal_enabled: null,
    payment_bank_enabled: nullableBoolean(row.payment_bank_enabled),
    payment_stripe_enabled: nullableBoolean(row.payment_stripe_enabled),
    internal_note: row.internal_note == null
      ? null
      : typeof row.internal_note === "string" && row.internal_note.length <= 2000
        ? row.internal_note
        : unavailable(),
    updated_at: row.updated_at,
  };
}

export async function getCommerceSettings() {
  const admin = getSupabaseAdmin();
  const result = await admin
    .from("commerce_settings")
    .select("id,currency,default_custom_credit_price_eur,global_adjustment_type,global_adjustment_value,promotion_label,payment_bank_enabled,payment_stripe_enabled,updated_at")
    .eq("id", "default")
    .maybeSingle();

  if (result.error || !result.data) unavailable();
  return normalizeCommerceSettings(result.data as Record<string, unknown>);
}

export async function getCustomerCommercialPolicy(userId: string) {
  const admin = getSupabaseAdmin();
  const result = await admin
    .from("customer_commercial_policies")
    .select("user_id,credit_price_override_eur,adjustment_type,adjustment_value,payment_bank_enabled,payment_stripe_enabled,internal_note,updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (result.error) unavailable();
  return normalizeCustomerCommercialPolicy(
    userId,
    (result.data as Record<string, unknown> | null) ?? null,
  );
}

export async function getCommercialContext(userId: string) {
  const [settings, customerPolicy] = await Promise.all([
    getCommerceSettings(),
    getCustomerCommercialPolicy(userId),
  ]);

  return { settings, customerPolicy, migrationReady: true };
}

export function createCreditQuoteId(
  userId: string,
  quote: ReturnType<typeof buildCreditQuote>,
) {
  return createHash("sha256")
    .update(JSON.stringify({ userId, quote }))
    .digest("hex")
    .slice(0, 40);
}

export async function getCreditQuoteForUser(userId: string) {
  const context = await getCommercialContext(userId);
  const quote = buildCreditQuote(context.settings, context.customerPolicy);
  return {
    ...context,
    quote: {
      ...quote,
      quoteId: createCreditQuoteId(userId, quote),
    },
  };
}

export async function getCreditPurchaseQuote(
  userId: string,
  body: { packageId?: unknown; customCredits?: unknown; quoteId?: unknown },
  paymentMethod?: PaymentMethodId,
) {
  const context = await getCreditQuoteForUser(userId);
  const quote = context.quote;
  // A purchase must be bound to the exact quote the customer reviewed. Missing,
  // malformed and superseded revisions all require a fresh quote before any
  // payment provider is contacted.
  if (
    typeof body.quoteId !== "string" ||
    !QUOTE_ID_PATTERN.test(body.quoteId) ||
    body.quoteId !== quote.quoteId
  ) {
    throw new StaleCreditQuoteError();
  }

  if (paymentMethod && !quote.paymentMethods[paymentMethod]) {
    throw new PaymentMethodUnavailableError(paymentMethod);
  }

  const hasPackage = typeof body.packageId === "string" && body.packageId.length > 0;
  const hasCustom = body.customCredits !== undefined && body.customCredits !== null;
  if (hasPackage === hasCustom) return null;

  if (hasPackage) {
    const packageId = body.packageId as string;
    const packageData = quote.packages.find((item) => item.id === packageId);
    if (!packageData || !getCreditPackage(packageId)) return null;
    return {
      id: packageData.id,
      credits: packageData.credits,
      priceEuro: packageData.priceEuro,
      unitPriceEuro: packageData.unitPriceEuro,
      description: packageData.description,
      purchaseType: "package" as const,
      quote,
      quoteId: quote.quoteId,
      migrationReady: true,
    };
  }

  const customCredits = Number(body.customCredits ?? 0);
  if (!Number.isInteger(customCredits) || customCredits < 1 || customCredits > 1000) return null;
  return {
    id: `custom_${customCredits}`,
    credits: customCredits,
    priceEuro: calculateCreditTotalEuro(customCredits, quote.customUnitPriceEuro),
    unitPriceEuro: quote.customUnitPriceEuro,
    description: `Custom credit purchase: ${customCredits} credits at EUR ${quote.customUnitPriceEuro.toFixed(4)} per credit.`,
    purchaseType: "custom" as const,
    quote,
    quoteId: quote.quoteId,
    migrationReady: true,
  };
}
