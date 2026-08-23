import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { sendCreditsAddedEmail } from "@/lib/email/events";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { safeAppendPaymentEvent } from "@/lib/paymentAudit";
import {
  isRecognizedStripeCreditPurchaseMetadata,
  normalizeStripePaymentIntentId,
} from "@/lib/stripePaymentSecurity";

const processingFailureCode = "stripe_credit_processing";
const claimRetryFailureCodes = ["stripe_reconciliation_failed", "stripe_payment_pending"];
const ledgerRecoveryFailureCodes = [processingFailureCode, ...claimRetryFailureCodes];
const processingLeaseMs = 10 * 60 * 1000;

type StripePaymentRecord = {
  id: string;
  user_id: string | null;
  status: string;
  payment_type: string;
  credits: number | string;
  amount_total: number | null;
  currency: string | null;
  credits_applied_at: string | null;
  failure_code: string | null;
  provider_payment_id: string | null;
  package_id: string | null;
  purchase_type: string | null;
  processing_claim_token: string | null;
  processing_started_at: string | null;
};

type StripeCreditLedgerRecord = {
  id: string;
  user_id: string;
  credits_delta: number | string;
  amount_total: number | null;
  currency: string | null;
  metadata: Record<string, unknown> | null;
};

export class StripeCreditPurchaseProcessingError extends Error {
  constructor() {
    super("Stripe credit purchase is already being reconciled.");
    this.name = "StripeCreditPurchaseProcessingError";
  }
}

export class StripeCreditPurchaseReconciliationError extends Error {
  constructor() {
    super("Stripe credit purchase requires reconciliation.");
    this.name = "StripeCreditPurchaseReconciliationError";
  }
}

function stripeObjectId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

function canRecoverStripeLedger(record: StripePaymentRecord) {
  return record.status === "pending" ||
    record.status === "succeeded" ||
    (record.status === "requires_review" &&
      ledgerRecoveryFailureCodes.includes(record.failure_code ?? ""));
}

export async function completeStripeCreditPurchase(
  session: Stripe.Checkout.Session,
  eventId?: string
) {
  if (session.payment_status !== "paid") {
    throw new StripeCreditPurchaseReconciliationError();
  }

  const userId = session.metadata?.user_id;
  const credits = Number(session.metadata?.credits ?? 0);
  if (
    session.mode !== "payment" ||
    !isRecognizedStripeCreditPurchaseMetadata(session.metadata) ||
    !userId ||
    !Number.isInteger(credits) ||
    credits <= 0
  ) {
    throw new StripeCreditPurchaseReconciliationError();
  }

  const paymentIntent = normalizeStripePaymentIntentId(stripeObjectId(session.payment_intent));
  if (!paymentIntent) throw new StripeCreditPurchaseReconciliationError();
  const admin = getSupabaseAdmin();
  const recordResult = await admin
    .from("payment_records")
    .select("id,user_id,status,payment_type,credits,amount_total,currency,credits_applied_at,failure_code,provider_payment_id,package_id,purchase_type,processing_claim_token,processing_started_at")
    .eq("provider", "stripe")
    .eq("external_id", session.id)
    .maybeSingle();
  if (recordResult.error || !recordResult.data) {
    throw new StripeCreditPurchaseReconciliationError();
  }
  const record = recordResult.data as StripePaymentRecord;
  const expectedCurrency = String(session.currency ?? "").toLowerCase();
  if (
    record.user_id !== userId ||
    record.payment_type !== "credit_purchase" ||
    (record.provider_payment_id !== null && record.provider_payment_id !== paymentIntent) ||
    record.package_id !== (session.metadata?.package_id ?? null) ||
    record.purchase_type !== (session.metadata?.purchase_type ?? null) ||
    Number(record.credits) !== credits ||
    Number(record.amount_total ?? 0) !== Number(session.amount_total ?? 0) ||
    String(record.currency ?? "").toLowerCase() !== expectedCurrency
  ) {
    throw new StripeCreditPurchaseReconciliationError();
  }

  if (record.status === "succeeded" && record.credits_applied_at) {
    await sendCreditsAddedEmail({
      userId,
      customerEmail: session.customer_email ?? session.metadata?.user_email ?? null,
      credits,
      amountTotal: session.amount_total ?? null,
      currency: session.currency,
      source: "stripe",
      referenceId: session.id,
    });
    return {
      credits,
      recordId: record.id,
      creditsAppliedAt: record.credits_applied_at,
      replayed: true,
    };
  }

  if (!canRecoverStripeLedger(record)) {
    throw new StripeCreditPurchaseReconciliationError();
  }

  const ledgerResult = await admin
    .from("credit_transactions")
    .select("id,user_id,credits_delta,amount_total,currency,metadata")
    .eq("source_type", "stripe_checkout")
    .eq("source_id", session.id)
    .maybeSingle();
  if (ledgerResult.error) {
    throw new StripeCreditPurchaseReconciliationError();
  }
  if (ledgerResult.data) {
    const appliedLedger = ledgerResult.data as StripeCreditLedgerRecord;
    if (
      appliedLedger.user_id !== userId ||
      Number(appliedLedger.credits_delta) !== credits ||
      Number(appliedLedger.amount_total ?? 0) !== Number(session.amount_total ?? 0) ||
      String(appliedLedger.currency ?? "").toLowerCase() !== expectedCurrency ||
      appliedLedger.metadata?.payment_record_id !== record.id
    ) {
      throw new StripeCreditPurchaseReconciliationError();
    }
    const recoveredAt = record.credits_applied_at ?? new Date().toISOString();
    let recoverRecord = admin
      .from("payment_records")
      .update({
        status: "succeeded",
        provider_payment_id: paymentIntent,
        credits_applied_at: recoveredAt,
        failure_code: null,
        failure_message: null,
        processing_claim_token: null,
        processing_started_at: null,
      })
      .eq("id", record.id)
      .eq("provider", "stripe")
      .eq("external_id", session.id)
      .eq("user_id", userId);
    recoverRecord = record.status === "requires_review"
      ? recoverRecord
          .eq("status", "requires_review")
          .in("failure_code", ledgerRecoveryFailureCodes)
      : recoverRecord.eq("status", record.status);
    const recovered = await recoverRecord.select("id").maybeSingle();
    if (recovered.error || !recovered.data) {
      throw new StripeCreditPurchaseReconciliationError();
    }
    await sendCreditsAddedEmail({
      userId,
      customerEmail: session.customer_email ?? session.metadata?.user_email ?? null,
      credits,
      amountTotal: session.amount_total ?? null,
      currency: session.currency,
      source: "stripe",
      referenceId: session.id,
    });
    return { credits, recordId: record.id, creditsAppliedAt: recoveredAt, replayed: true };
  }

  const claimToken = randomUUID();
  const claimStartedAt = new Date().toISOString();
  const staleBefore = new Date(Date.now() - processingLeaseMs).toISOString();
  let claimQuery = admin
    .from("payment_records")
    .update({
      status: "requires_review",
      provider_payment_id: paymentIntent,
      failure_code: processingFailureCode,
      failure_message: null,
      processing_claim_token: claimToken,
      processing_started_at: claimStartedAt,
    })
    .eq("id", record.id)
    .eq("provider", "stripe")
    .eq("external_id", session.id)
    .eq("user_id", userId)
    .is("credits_applied_at", null);

  if (record.status === "pending") {
    claimQuery = claimQuery
      .eq("status", "pending")
      .is("processing_claim_token", null)
      .is("processing_started_at", null);
  } else if (
    record.status === "requires_review" &&
    claimRetryFailureCodes.includes(record.failure_code ?? "")
  ) {
    claimQuery = claimQuery
      .eq("status", "requires_review")
      .eq("failure_code", record.failure_code as string)
      .is("processing_claim_token", null)
      .is("processing_started_at", null);
  } else if (
    record.status === "requires_review" &&
    record.failure_code === processingFailureCode
  ) {
    if (
      record.processing_started_at &&
      Date.parse(record.processing_started_at) > Date.parse(staleBefore)
    ) {
      throw new StripeCreditPurchaseProcessingError();
    }
    claimQuery = claimQuery
      .eq("status", "requires_review")
      .eq("failure_code", processingFailureCode);
    claimQuery = record.processing_claim_token
      ? claimQuery.eq("processing_claim_token", record.processing_claim_token)
      : claimQuery.is("processing_claim_token", null);
    claimQuery = record.processing_started_at
      ? claimQuery.lt("processing_started_at", staleBefore)
      : claimQuery.is("processing_started_at", null);
  } else {
    throw new StripeCreditPurchaseReconciliationError();
  }

  const claim = await claimQuery.select("id").maybeSingle();
  if (claim.error) throw new StripeCreditPurchaseReconciliationError();
  if (!claim.data) throw new StripeCreditPurchaseProcessingError();

  try {
    const creditResult = await admin.rpc("add_credits_from_stripe", {
      p_user_id: userId,
      p_stripe_session_id: session.id,
      p_stripe_payment_intent: paymentIntent,
      p_customer_email: session.customer_email ?? session.metadata?.user_email ?? null,
      p_package_id: session.metadata?.package_id ?? null,
      p_credits: credits,
      p_amount_total: session.amount_total ?? null,
      p_currency: session.currency ?? null,
      p_processing_claim_token: claimToken,
    });
    if (creditResult.error) throw new Error("Credit reconciliation failed.");

    const finalized = await admin
      .from("payment_records")
      .select("status,credits_applied_at,processing_claim_token,processing_started_at")
      .eq("id", record.id)
      .eq("provider", "stripe")
      .eq("external_id", session.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (
      finalized.error ||
      finalized.data?.status !== "succeeded" ||
      !finalized.data.credits_applied_at ||
      finalized.data.processing_claim_token !== null ||
      finalized.data.processing_started_at !== null
    ) {
      throw new Error("Payment finalization could not be recorded.");
    }
    const creditsAppliedAt = finalized.data.credits_applied_at;

    await safeAppendPaymentEvent({
      paymentRecordId: record.id,
      provider: "stripe",
      externalEventId: eventId ?? null,
      eventType: "checkout_completed",
      status: "processed",
      message: "Stripe payment confirmed and credits reconciled.",
      payload: { session_id: session.id, payment_intent: paymentIntent },
    });
    await sendCreditsAddedEmail({
      userId,
      customerEmail: session.customer_email ?? session.metadata?.user_email ?? null,
      credits,
      amountTotal: session.amount_total ?? null,
      currency: session.currency,
      source: "stripe",
      referenceId: session.id,
    });

    return { credits, recordId: record.id, creditsAppliedAt, replayed: false };
  } catch {
    await admin
      .from("payment_records")
      .update({
        status: "requires_review",
        failure_code: "stripe_reconciliation_failed",
        failure_message: "Automatic Stripe reconciliation did not complete.",
        processing_claim_token: null,
        processing_started_at: null,
      })
      .eq("id", record.id)
      .eq("provider", "stripe")
      .eq("external_id", session.id)
      .eq("user_id", userId)
      .eq("status", "requires_review")
      .eq("failure_code", processingFailureCode)
      .eq("processing_claim_token", claimToken);

    const terminal = await admin
      .from("payment_records")
      .select("status,credits_applied_at,processing_claim_token,processing_started_at")
      .eq("id", record.id)
      .eq("provider", "stripe")
      .eq("external_id", session.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (
      !terminal.error &&
      terminal.data?.status === "succeeded" &&
      terminal.data.credits_applied_at &&
      terminal.data.processing_claim_token === null &&
      terminal.data.processing_started_at === null
    ) {
      await sendCreditsAddedEmail({
        userId,
        customerEmail: session.customer_email ?? session.metadata?.user_email ?? null,
        credits,
        amountTotal: session.amount_total ?? null,
        currency: session.currency,
        source: "stripe",
        referenceId: session.id,
      });
      return {
        credits,
        recordId: record.id,
        creditsAppliedAt: terminal.data.credits_applied_at,
        replayed: true,
      };
    }
    throw new StripeCreditPurchaseReconciliationError();
  }
}
