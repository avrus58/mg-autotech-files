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

export const creditPurchaseSafeMessages = {
  quoteFallback: "Credit prices could not be loaded.",
  purchaseFallback: "Credit purchase could not be started.",
  authRequired: "Please log in again before purchasing credits.",
  rateLimited: "Too many purchase attempts. Please wait a moment and try again.",
  invalidSelection:
    "Choose a valid credit package or enter a valid credit amount.",
  pricingUnavailable:
    "Credit pricing is temporarily unavailable. Please try again later.",
  quoteStale:
    "Credit prices changed. Review the refreshed total before continuing.",
  methodUnavailable:
    "This payment method is currently unavailable. Choose another payment method.",
  customerReferenceUnavailable:
    "Your customer reference could not be prepared. Please refresh and try again.",
  bankDeliveryFailed:
    "Bank transfer instructions could not be prepared. Please try again or choose card payment.",
  checkoutUnavailable:
    "Secure card checkout is temporarily unavailable. Choose Bank Transfer or try again later.",
  stripeAmountUnsupported:
    "This total is outside Stripe's supported EUR range. Choose Bank Transfer or change the amount.",
} as const;

export type CreditPurchaseSafeMessage =
  (typeof creditPurchaseSafeMessages)[keyof typeof creditPurchaseSafeMessages];

const codeMessages: Record<CreditPurchaseErrorCode, CreditPurchaseSafeMessage> = {
  [creditPurchaseErrorCodes.authRequired]: creditPurchaseSafeMessages.authRequired,
  [creditPurchaseErrorCodes.rateLimited]: creditPurchaseSafeMessages.rateLimited,
  [creditPurchaseErrorCodes.invalidSelection]: creditPurchaseSafeMessages.invalidSelection,
  [creditPurchaseErrorCodes.pricingUnavailable]: creditPurchaseSafeMessages.pricingUnavailable,
  [creditPurchaseErrorCodes.quoteStale]: creditPurchaseSafeMessages.quoteStale,
  [creditPurchaseErrorCodes.methodUnavailable]: creditPurchaseSafeMessages.methodUnavailable,
  [creditPurchaseErrorCodes.customerReferenceUnavailable]:
    creditPurchaseSafeMessages.customerReferenceUnavailable,
  [creditPurchaseErrorCodes.bankDeliveryFailed]:
    creditPurchaseSafeMessages.bankDeliveryFailed,
  [creditPurchaseErrorCodes.checkoutUnavailable]:
    creditPurchaseSafeMessages.checkoutUnavailable,
  [creditPurchaseErrorCodes.stripeAmountUnsupported]:
    creditPurchaseSafeMessages.stripeAmountUnsupported,
};

const allowedMessages = new Set<CreditPurchaseSafeMessage>(
  Object.values(creditPurchaseSafeMessages),
);

export function creditPurchaseErrorMessage(
  operation: "quote" | "purchase",
  errorCode: unknown,
  paymentMethod?: "stripe" | "bank",
): CreditPurchaseSafeMessage {
  if (
    errorCode === creditPurchaseErrorCodes.checkoutUnavailable &&
    paymentMethod === "bank"
  ) {
    return creditPurchaseSafeMessages.bankDeliveryFailed;
  }

  if (typeof errorCode === "string" && errorCode in codeMessages) {
    return codeMessages[errorCode as CreditPurchaseErrorCode];
  }

  return operation === "quote"
    ? creditPurchaseSafeMessages.quoteFallback
    : creditPurchaseSafeMessages.purchaseFallback;
}

/** Preserve only messages created from the allowlisted stable-code mapping. */
export function creditPurchaseCaughtErrorMessage(
  operation: "quote" | "purchase",
  error: unknown,
): CreditPurchaseSafeMessage {
  if (
    error instanceof Error &&
    allowedMessages.has(error.message as CreditPurchaseSafeMessage)
  ) {
    return error.message as CreditPurchaseSafeMessage;
  }

  return creditPurchaseErrorMessage(operation, undefined);
}
