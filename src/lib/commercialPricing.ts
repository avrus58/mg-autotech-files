import {
  creditPackageIds,
  creditPackages,
  minimumCreditPackageTotalEuro,
  type CreditPackagePriceMap,
  type CreditPackagePriceOverrideMap,
} from "@/lib/creditPackages";
import { defaultCreditPromotionLabel } from "@/lib/i18n/commercial-translations";

export const paymentMethodIds = ["stripe", "bank"] as const;
export const STRIPE_EUR_MIN_AMOUNT_CENTS = 50;
export const STRIPE_EUR_MAX_AMOUNT_CENTS = 99_999_999;
export type PaymentMethodId = (typeof paymentMethodIds)[number];
export type PricingSource = "global" | "customer_override";

export type CommerceSettings = {
  id: "default";
  currency: "EUR";
  pricing_model_version: 2;
  explicit_pricing_writes_enabled: boolean;
  explicit_pricing_bridge_release: string | null;
  package_prices_eur: CreditPackagePriceMap;
  custom_credit_unit_price_eur: number;
  promotion_label: string | null;
  payment_paypal_enabled: false;
  payment_bank_enabled: boolean;
  payment_stripe_enabled: boolean;
  updated_at?: string;
};

export type CustomerCommercialPolicy = {
  user_id: string;
  pricing_model_version: 2;
  package_price_overrides_eur: CreditPackagePriceOverrideMap;
  custom_credit_unit_price_override_eur: number | null;
  payment_paypal_enabled: null;
  payment_bank_enabled: boolean | null;
  payment_stripe_enabled: boolean | null;
  internal_note: string | null;
  updated_at?: string;
};

export type EffectivePaymentMethods = Record<PaymentMethodId, boolean>;

export const defaultCommerceSettings: CommerceSettings = {
  id: "default",
  currency: "EUR",
  pricing_model_version: 2,
  explicit_pricing_writes_enabled: true,
  explicit_pricing_bridge_release: "local-default",
  package_prices_eur: {
    credits_10: 36,
    credits_50: 180,
    credits_100: 320,
    credits_250: 700,
    credits_500: 1200,
  },
  custom_credit_unit_price_eur: 4,
  promotion_label: defaultCreditPromotionLabel,
  payment_paypal_enabled: false,
  payment_bank_enabled: true,
  payment_stripe_enabled: true,
};

export function emptyCustomerCommercialPolicy(userId: string): CustomerCommercialPolicy {
  return {
    user_id: userId,
    pricing_model_version: 2,
    package_price_overrides_eur: {
      credits_10: null,
      credits_50: null,
      credits_100: null,
      credits_250: null,
      credits_500: null,
    },
    custom_credit_unit_price_override_eur: null,
    payment_paypal_enabled: null,
    payment_bank_enabled: null,
    payment_stripe_enabled: null,
    internal_note: null,
  };
}

export function effectivePaymentMethods(
  settings: CommerceSettings,
  policy: CustomerCommercialPolicy,
): EffectivePaymentMethods {
  return {
    stripe: policy.payment_stripe_enabled ?? settings.payment_stripe_enabled,
    bank: policy.payment_bank_enabled ?? settings.payment_bank_enabled,
  };
}

export function pricingSource(policy: CustomerCommercialPolicy): PricingSource {
  if (policy.custom_credit_unit_price_override_eur != null) return "customer_override";
  return creditPackageIds.some(
    (packageId) => policy.package_price_overrides_eur[packageId] != null,
  )
    ? "customer_override"
    : "global";
}

export function calculateCreditTotalEuro(credits: number, unitPriceEuro: number) {
  if (!Number.isInteger(credits) || credits < 1) {
    throw new RangeError("Credit amount must be a positive whole number.");
  }
  if (!Number.isFinite(unitPriceEuro) || unitPriceEuro < 0.01) {
    throw new RangeError("Credit unit price must be a positive finite amount.");
  }

  // Unit prices are canonicalized to four decimals. Calculate from integer
  // ten-thousandths so the browser, API and payment provider agree on cents
  // even at half-cent boundaries such as EUR 1.0050.
  const unitTenThousandths = Math.round(unitPriceEuro * 10_000);
  const totalCents = Math.round((credits * unitTenThousandths) / 100);
  return totalCents / 100;
}

export function euroAmountToCents(amountEuro: number) {
  if (!Number.isFinite(amountEuro) || amountEuro <= 0) {
    throw new RangeError("EUR amount must be a positive finite value.");
  }
  const amountTenThousandths = Math.round(amountEuro * 10_000);
  return Math.round(amountTenThousandths / 100);
}

export function isStripeEuroAmountSupported(amountEuro: number) {
  if (!Number.isFinite(amountEuro) || amountEuro <= 0) return false;
  const amountCents = euroAmountToCents(amountEuro);
  return amountCents >= STRIPE_EUR_MIN_AMOUNT_CENTS &&
    amountCents <= STRIPE_EUR_MAX_AMOUNT_CENTS;
}

export function buildCreditQuote(
  settings: CommerceSettings,
  customerPolicy: CustomerCommercialPolicy,
) {
  const methods = effectivePaymentMethods(settings, customerPolicy);
  const source = pricingSource(customerPolicy);
  const packages = creditPackages.map((item) => {
    const globalPriceEuro = settings.package_prices_eur[item.id];
    const customerOverride = customerPolicy.package_price_overrides_eur[item.id];
    const priceEuro = customerOverride ?? globalPriceEuro;
    if (
      !Number.isFinite(priceEuro) ||
      priceEuro < minimumCreditPackageTotalEuro(item.credits)
    ) {
      throw new RangeError("Package totals must preserve the minimum EUR 0.01 per credit.");
    }

    return {
      ...item,
      globalPriceEuro,
      priceEuro,
      // Package total is authoritative. Unit price is display-only and must
      // never be multiplied back into a checkout total.
      unitPriceEuro: Number((priceEuro / item.credits).toFixed(4)),
      pricingSource: customerOverride == null
        ? "global" as const
        : "customer_override" as const,
    };
  });
  const globalCustomUnitPriceEuro = settings.custom_credit_unit_price_eur;
  const customOverride = customerPolicy.custom_credit_unit_price_override_eur;
  const customUnitPriceEuro = customOverride ?? globalCustomUnitPriceEuro;

  return {
    currency: settings.currency,
    promotionLabel: settings.promotion_label,
    customBaseUnitPriceEuro: globalCustomUnitPriceEuro,
    globalCustomUnitPriceEuro,
    customUnitPriceEuro,
    customPricingSource: customOverride == null
      ? "global" as const
      : "customer_override" as const,
    packages,
    paymentMethods: methods,
    pricingSource: source,
    customerPricingActive: source !== "global",
    customerPaymentPolicyActive: [
      customerPolicy.payment_stripe_enabled,
      customerPolicy.payment_bank_enabled,
    ].some((value) => value != null),
  };
}
