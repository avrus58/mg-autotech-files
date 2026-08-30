export const creditPurchaseErrorCodes = {
  authRequired: "auth_required",
  rateLimited: "rate_limited",
  invalidSelection: "invalid_selection",
  pricingUnavailable: "commercial_pricing_unavailable",
  quoteStale: "credit_quote_stale",
  methodUnavailable: "payment_method_unavailable",
  customerReferenceUnavailable: "customer_reference_unavailable",
  bankDeliveryFailed: "bank_delivery_failed",
  checkoutUnavailable: "checkout_unavailable",
  stripeAmountUnsupported: "stripe_amount_unsupported",
} as const;

export type CreditPurchaseErrorCode =
  (typeof creditPurchaseErrorCodes)[keyof typeof creditPurchaseErrorCodes];

export function creditPurchaseErrorMessage(
  operation: "quote" | "purchase",
  errorCode: unknown,
):
  | "Credit prices could not be loaded."
  | "Credit purchase could not be started."
  | "This total is outside Stripe's supported EUR range. Choose Bank Transfer or change the amount." {
  if (errorCode === creditPurchaseErrorCodes.stripeAmountUnsupported) {
    return "This total is outside Stripe's supported EUR range. Choose Bank Transfer or change the amount.";
  }
  return operation === "quote"
    ? "Credit prices could not be loaded."
    : "Credit purchase could not be started.";
}
