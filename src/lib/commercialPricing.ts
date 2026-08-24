import { creditPackages } from "@/lib/creditPackages";

export const paymentMethodIds = ["stripe", "bank"] as const;
export const STRIPE_EUR_MIN_AMOUNT_CENTS = 50;
export const STRIPE_EUR_MAX_AMOUNT_CENTS = 99_999_999;
export type PaymentMethodId = (typeof paymentMethodIds)[number];
export type PriceAdjustmentType = "none" | "percentage" | "fixed";
export type PricingSource = "global" | "customer_adjustment" | "customer_fixed";

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
  payment_paypal_enabled: false,
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

export function applyUnitAdjustment(
  unitPrice: number,
  type: PriceAdjustmentType,
  value: number,
) {
  const safeUnit = Math.max(0.01, unitPrice);
  if (type === "percentage") return Math.max(0.01, safeUnit * (1 - value / 100));
  if (type === "fixed") return Math.max(0.01, safeUnit - value);
  return safeUnit;
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
  if (policy.credit_price_override_eur != null) return "customer_fixed";
  if (policy.adjustment_type !== "none") return "customer_adjustment";
  return "global";
}

export function calculateEffectiveUnitPrice(input: {
  catalogUnitPrice: number;
  settings: CommerceSettings;
  customerPolicy: CustomerCommercialPolicy;
}) {
  const customerOverride = input.customerPolicy.credit_price_override_eur;

  // An explicit customer price is an exact contractual rate. It must remain
  // stable when the global tariff changes and must not receive a second
  // percentage/fixed adjustment.
  if (customerOverride != null) {
    return Number(Math.max(0.01, customerOverride).toFixed(4));
  }

  const afterGlobal = applyUnitAdjustment(
    input.catalogUnitPrice,
    input.settings.global_adjustment_type,
    input.settings.global_adjustment_value,
  );

  return Number(
    applyUnitAdjustment(
      afterGlobal,
      input.customerPolicy.adjustment_type,
      input.customerPolicy.adjustment_value,
    ).toFixed(4),
  );
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
  const globalPolicy = emptyCustomerCommercialPolicy("global-preview");
  const globalCustomUnitPriceEuro = calculateEffectiveUnitPrice({
    catalogUnitPrice: settings.default_custom_credit_price_eur,
    settings,
    customerPolicy: globalPolicy,
  });
  const packages = creditPackages.map((item) => {
    const catalogUnitPrice = item.basePriceEuro / item.credits;
    const unitPriceEuro = calculateEffectiveUnitPrice({ catalogUnitPrice, settings, customerPolicy });
    return {
      ...item,
      priceEuro: calculateCreditTotalEuro(item.credits, unitPriceEuro),
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
    globalCustomUnitPriceEuro,
    customUnitPriceEuro,
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
