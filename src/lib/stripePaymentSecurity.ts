import { createHash } from "node:crypto";

export const STRIPE_CREDIT_PURCHASE_PRODUCT = "credit_purchase";
export const STRIPE_WEBHOOK_MAX_BODY_BYTES = 1024 * 1024;

export class StripeWebhookBodyError extends Error {
  readonly status: 400 | 413;

  constructor(status: 400 | 413) {
    super(status === 413 ? "Stripe webhook body is too large." : "Stripe webhook body is invalid.");
    this.name = "StripeWebhookBodyError";
    this.status = status;
  }
}

const checkoutSessionIdPattern = /^cs_(?:test|live)_[A-Za-z0-9]{16,192}$/;
const paymentIntentIdPattern = /^pi_[A-Za-z0-9]{16,192}$/;
const correlationIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const userIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type StripeMetadata = Record<string, string> | null | undefined;

export async function readStripeWebhookBody(
  request: Request,
  maxBytes = STRIPE_WEBHOOK_MAX_BODY_BYTES,
) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new StripeWebhookBodyError(400);
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const normalized = declaredLength.trim();
    if (!/^\d{1,10}$/.test(normalized)) {
      throw new StripeWebhookBodyError(400);
    }
    const length = Number(normalized);
    if (!Number.isSafeInteger(length)) throw new StripeWebhookBodyError(400);
    if (length > maxBytes) throw new StripeWebhookBodyError(413);
  }

  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new StripeWebhookBodyError(413);
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    throw new StripeWebhookBodyError(400);
  }
}

export function normalizeStripeCheckoutSessionId(value: unknown) {
  if (typeof value !== "string") return null;
  const sessionId = value.trim();
  if (sessionId.length < 28 || sessionId.length > 208) return null;
  return checkoutSessionIdPattern.test(sessionId) ? sessionId : null;
}

export function normalizeStripeCorrelationId(value: unknown) {
  if (typeof value !== "string") return null;
  const correlationId = value.trim().toLowerCase();
  return correlationIdPattern.test(correlationId) ? correlationId : null;
}

export function normalizeStripePaymentIntentId(value: unknown) {
  if (typeof value !== "string") return null;
  const paymentIntentId = value.trim();
  if (paymentIntentId.length < 19 || paymentIntentId.length > 195) return null;
  return paymentIntentIdPattern.test(paymentIntentId) ? paymentIntentId : null;
}

export function isStripeCreditPurchaseMetadata(metadata: StripeMetadata) {
  if (metadata?.product !== STRIPE_CREDIT_PURCHASE_PRODUCT) return false;
  if (!userIdPattern.test(metadata.user_id ?? "")) return false;
  const credits = Number(metadata.credits);
  return Number.isInteger(credits) && credits > 0 && credits <= 100_000;
}

/**
 * Checkout sessions created immediately before the product discriminator was
 * introduced did not carry `product`. They are accepted only as a bounded
 * cutover shape; reconciliation still requires an exact authoritative pending
 * payment_records row before any credit can be applied.
 */
export function isRecognizedStripeCreditPurchaseMetadata(metadata: StripeMetadata) {
  if (isStripeCreditPurchaseMetadata(metadata)) return true;
  if (metadata?.product) return false;
  if (!userIdPattern.test(metadata?.user_id ?? "")) return false;
  const credits = Number(metadata?.credits);
  return Number.isInteger(credits) && credits > 0 && credits <= 100_000;
}

export function stripeCreditPurchaseOwnedBy(metadata: StripeMetadata, userId: string) {
  return isRecognizedStripeCreditPurchaseMetadata(metadata) && metadata?.user_id === userId;
}

export function stripeCreditPurchaseAbuseSubject(userId: string, sessionId?: string | null) {
  return createHash("sha256")
    .update(`${userId.trim().toLowerCase()}\u0000${sessionId?.trim() ?? ""}`)
    .digest("hex")
    .slice(0, 32);
}
