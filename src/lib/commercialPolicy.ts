import { createHash } from "node:crypto";
import {
  creditPackageIds,
  getCreditPackage,
  MAX_CREDIT_PACKAGE_TOTAL_EURO,
  MAX_CUSTOM_CREDIT_UNIT_PRICE_EURO,
  minimumCreditPackageTotalEuro,
  type CreditPackageId,
  type CreditPackagePriceMap,
  type CreditPackagePriceOverrideMap,
} from "@/lib/creditPackages";
import {
  buildCreditQuote,
  calculateCreditTotalEuro,
  emptyCustomerCommercialPolicy,
  type CommerceSettings,
  type CustomerCommercialPolicy,
  type PaymentMethodId,
} from "@/lib/commercialPricing";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export {
  buildCreditQuote,
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
  PricingSource,
} from "@/lib/commercialPricing";

const QUOTE_ID_PATTERN = /^[a-f0-9]{40}$/;

const globalPackageColumns: Record<CreditPackageId, string> = {
  credits_10: "credit_package_10_total_eur",
  credits_50: "credit_package_50_total_eur",
  credits_100: "credit_package_100_total_eur",
  credits_250: "credit_package_250_total_eur",
  credits_500: "credit_package_500_total_eur",
};

const customerPackageColumns: Record<CreditPackageId, string> = {
  credits_10: "credit_package_10_total_override_eur",
  credits_50: "credit_package_50_total_override_eur",
  credits_100: "credit_package_100_total_override_eur",
  credits_250: "credit_package_250_total_override_eur",
  credits_500: "credit_package_500_total_override_eur",
};

export const commerceSettingsSelectedColumns = [
  "id",
  "currency",
  "pricing_model_version",
  "explicit_pricing_writes_enabled",
  "explicit_pricing_bridge_release",
  ...Object.values(globalPackageColumns),
  "custom_credit_unit_price_eur",
  "promotion_label",
  "payment_bank_enabled",
  "payment_stripe_enabled",
  "updated_at",
].join(",");

export const customerCommercialPolicySelectedColumns = [
  "user_id",
  "pricing_model_version",
  ...Object.values(customerPackageColumns),
  "custom_credit_unit_price_override_eur",
  "payment_bank_enabled",
  "payment_stripe_enabled",
  "internal_note",
  "updated_at",
].join(",");

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

function boundedMoney(
  value: unknown,
  maximum: number,
  decimalPlaces: 2 | 4,
  minimum = 0.01,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) unavailable();
  const scale = decimalPlaces === 2 ? 100 : 10_000;
  const canonical = Math.round(parsed * scale) / scale;
  if (Math.abs(parsed - canonical) > 1 / (scale * 100)) unavailable();
  return canonical;
}

function nullableMoney(
  value: unknown,
  maximum: number,
  decimalPlaces: 2 | 4,
  minimum = 0.01,
) {
  return value == null ? null : boundedMoney(value, maximum, decimalPlaces, minimum);
}

function booleanValue(value: unknown) {
  if (typeof value !== "boolean") unavailable();
  return value;
}

function packagePriceMap(
  row: Record<string, unknown>,
  columns: Record<CreditPackageId, string>,
): CreditPackagePriceMap {
  return Object.fromEntries(
    creditPackageIds.map((packageId) => [
      packageId,
      boundedMoney(
        row[columns[packageId]],
        MAX_CREDIT_PACKAGE_TOTAL_EURO,
        2,
        minimumCreditPackageTotalEuro(getCreditPackage(packageId)?.credits ?? 1),
      ),
    ]),
  ) as CreditPackagePriceMap;
}

function packagePriceOverrideMap(
  row: Record<string, unknown>,
): CreditPackagePriceOverrideMap {
  return Object.fromEntries(
    creditPackageIds.map((packageId) => [
      packageId,
      nullableMoney(
        row[customerPackageColumns[packageId]],
        MAX_CREDIT_PACKAGE_TOTAL_EURO,
        2,
        minimumCreditPackageTotalEuro(getCreditPackage(packageId)?.credits ?? 1),
      ),
    ]),
  ) as CreditPackagePriceOverrideMap;
}

export function normalizeCommerceSettings(row: Record<string, unknown> | null): CommerceSettings {
  const bridgeRelease = row?.explicit_pricing_bridge_release == null
    ? null
    : typeof row.explicit_pricing_bridge_release === "string" &&
        /^[A-Za-z0-9._:-]{8,180}$/.test(row.explicit_pricing_bridge_release)
      ? row.explicit_pricing_bridge_release
      : unavailable();
  if (
    !row ||
    row.id !== "default" ||
    row.currency !== "EUR" ||
    row.pricing_model_version !== 2 ||
    typeof row.updated_at !== "string" ||
    typeof row.explicit_pricing_writes_enabled !== "boolean" ||
    (row.explicit_pricing_writes_enabled && bridgeRelease == null)
  ) {
    unavailable();
  }

  return {
    id: "default",
    currency: "EUR",
    pricing_model_version: 2,
    explicit_pricing_writes_enabled: row.explicit_pricing_writes_enabled,
    explicit_pricing_bridge_release: bridgeRelease,
    package_prices_eur: packagePriceMap(row, globalPackageColumns),
    custom_credit_unit_price_eur: boundedMoney(
      row.custom_credit_unit_price_eur,
      MAX_CUSTOM_CREDIT_UNIT_PRICE_EURO,
      4,
    ),
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
  if (
    row.user_id !== userId ||
    row.pricing_model_version !== 2 ||
    typeof row.updated_at !== "string"
  ) {
    unavailable();
  }

  const nullableBoolean = (value: unknown) => {
    if (value == null) return null;
    return booleanValue(value);
  };

  return {
    user_id: userId,
    pricing_model_version: 2,
    package_price_overrides_eur: packagePriceOverrideMap(row),
    custom_credit_unit_price_override_eur: nullableMoney(
      row.custom_credit_unit_price_override_eur,
      MAX_CUSTOM_CREDIT_UNIT_PRICE_EURO,
      4,
    ),
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
    .select(commerceSettingsSelectedColumns)
    .eq("id", "default")
    .maybeSingle();

  if (result.error || !result.data) unavailable();
  return normalizeCommerceSettings(result.data as unknown as Record<string, unknown>);
}

export async function getCustomerCommercialPolicy(userId: string) {
  const admin = getSupabaseAdmin();
  const result = await admin
    .from("customer_commercial_policies")
    .select(customerCommercialPolicySelectedColumns)
    .eq("user_id", userId)
    .maybeSingle();

  if (result.error) unavailable();
  return normalizeCustomerCommercialPolicy(
    userId,
    (result.data as unknown as Record<string, unknown> | null) ?? null,
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
  revisions: { global: string; customer: string | null },
) {
  return createHash("sha256")
    .update(JSON.stringify({ userId, quote, revisions }))
    .digest("hex")
    .slice(0, 40);
}

export async function getCreditQuoteForUser(userId: string) {
  const context = await getCommercialContext(userId);
  const quote = buildCreditQuote(context.settings, context.customerPolicy);
  const globalRevision = context.settings.updated_at;
  if (typeof globalRevision !== "string") unavailable();

  return {
    ...context,
    quote: {
      ...quote,
      quoteId: createCreditQuoteId(userId, quote, {
        global: globalRevision,
        customer: context.customerPolicy.updated_at ?? null,
      }),
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
  // A purchase must be bound to the exact saved revisions the customer
  // reviewed. A save-and-revert still creates a new revision and invalidates
  // the older checkout attempt.
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
      // The exact stored package total is the payment authority. The displayed
      // unit rate is deliberately never multiplied back into this value.
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
