import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { sendCreditsAddedEmail } from "@/lib/email/events";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  paymentAuditUnavailable,
  paymentProviderFromSource,
  safeAppendPaymentEvent,
} from "@/lib/paymentAudit";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("record_bank_payment"),
    customerUserId: z.string().uuid(),
    reference: z.string().trim().min(3).max(160),
    credits: z.number().int().positive().max(100000),
    amountEuro: z.number().positive().max(1000000),
    note: z.string().trim().max(1000).nullable().optional(),
  }),
  z.object({
    action: z.literal("mark_reviewed"),
    paymentId: z.string().uuid(),
    note: z.string().trim().min(2).max(1000),
  }),
  z.object({
    action: z.literal("refund"),
    paymentId: z.string().uuid(),
    note: z.string().trim().min(3).max(1000),
  }),
]);

type PaymentRow = {
  id: string;
  provider: "stripe" | "paypal" | "bank";
  external_id: string;
  provider_payment_id: string | null;
  user_id: string | null;
  status: string;
  credits: number;
  amount_total: number | null;
  currency: string;
  customer_email: string | null;
  metadata: Record<string, unknown> | null;
  reviewed_at: string | null;
  failure_code: string | null;
  provider_refund_id: string | null;
  [key: string]: unknown;
};

type RefundClaimResult = Pick<
  PaymentRow,
  | "provider"
  | "external_id"
  | "provider_payment_id"
  | "provider_refund_id"
  | "user_id"
  | "credits"
  | "amount_total"
  | "currency"
> & {
  state: "claimed" | "refunded";
  payment_id: string;
};

const refundProcessingFailureCode = "refund_processing";
const refundProviderSucceededFailureCode = "refund_provider_succeeded";

function stripeObjectId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

function stripeRefundMatchesPayment(refund: Stripe.Refund, payment: RefundClaimResult) {
  return refund.metadata?.payment_record_id === payment.payment_id &&
    stripeObjectId(refund.payment_intent) === payment.provider_payment_id &&
    refund.amount === Number(payment.amount_total) &&
    refund.currency.toLowerCase() === String(payment.currency).toLowerCase();
}

async function findOrCreateStripeRefund(
  payment: RefundClaimResult,
  actorUserId: string,
) {
  if (!payment.provider_payment_id) throw new Error("Stripe PaymentIntent is missing.");
  const expectedAmount = Number(payment.amount_total);
  const expectedCurrency = String(payment.currency).toLowerCase();
  if (!Number.isSafeInteger(expectedAmount) || expectedAmount <= 0) {
    throw new Error("The Stripe payment amount is not safe to refund automatically.");
  }
  const stripe = getStripe();

  const paymentIntent = await stripe.paymentIntents.retrieve(
    payment.provider_payment_id,
    { expand: ["latest_charge"] },
  );
  const latestCharge = typeof paymentIntent.latest_charge === "string"
    ? await stripe.charges.retrieve(paymentIntent.latest_charge)
    : paymentIntent.latest_charge;
  if (
    paymentIntent.id !== payment.provider_payment_id ||
    paymentIntent.status !== "succeeded" ||
    paymentIntent.amount !== expectedAmount ||
    paymentIntent.amount_received !== expectedAmount ||
    paymentIntent.currency.toLowerCase() !== expectedCurrency ||
    !latestCharge ||
    latestCharge.paid !== true ||
    latestCharge.amount !== expectedAmount ||
    latestCharge.amount_captured !== expectedAmount ||
    latestCharge.currency.toLowerCase() !== expectedCurrency ||
    stripeObjectId(latestCharge.payment_intent) !== payment.provider_payment_id
  ) {
    throw new Error("The Stripe charge does not exactly match this payment; manual reconciliation is required.");
  }

  const existing = await stripe.refunds.list({
    payment_intent: payment.provider_payment_id,
    limit: 100,
  });
  if (existing.has_more) {
    throw new Error("Stripe has more refunds than can be verified automatically.");
  }
  const matching = existing.data.filter((refund) =>
    refund.metadata?.payment_record_id === payment.payment_id
  );
  if (matching.length !== existing.data.length) {
    throw new Error("Stripe contains an unrecognized refund; manual reconciliation is required.");
  }
  if (matching.length > 1) {
    throw new Error("Multiple Stripe refunds match this payment; manual reconciliation is required.");
  }

  const succeededAmount = existing.data
    .filter((refund) => refund.status === "succeeded")
    .reduce((total, refund) => total + refund.amount, 0);
  if (
    succeededAmount > expectedAmount ||
    latestCharge.amount_refunded !== succeededAmount
  ) {
    throw new Error("Stripe refund totals do not match the authoritative charge.");
  }

  if (payment.provider_refund_id) {
    const stored = await stripe.refunds.retrieve(payment.provider_refund_id);
    if (
      !stripeRefundMatchesPayment(stored, payment) ||
      matching.length !== 1 ||
      matching[0]?.id !== stored.id
    ) {
      throw new Error("The stored Stripe refund does not match this payment.");
    }
    return stored;
  }

  if (matching.length === 1) {
    const recovered = matching[0];
    if (!stripeRefundMatchesPayment(recovered, payment)) {
      throw new Error("The existing Stripe refund does not match this payment.");
    }
    return recovered;
  }

  if (latestCharge.amount_refunded !== 0 || latestCharge.refunded) {
    throw new Error("The Stripe charge already has a refund that cannot be reconciled automatically.");
  }

  const created = await stripe.refunds.create(
    {
      payment_intent: payment.provider_payment_id,
      amount: expectedAmount,
      reason: "requested_by_customer",
      metadata: {
        payment_record_id: payment.payment_id,
        actor_user_id: actorUserId,
      },
    },
    { idempotencyKey: `mga-refund-${payment.payment_id}` },
  );
  if (!stripeRefundMatchesPayment(created, payment)) {
    throw new Error("Stripe returned a refund that does not match this payment.");
  }
  return created;
}

function cents(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "credits.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = getSupabaseAdmin();
  const [recordsResult, eventsResult, ledgerResult, customersResult] = await Promise.all([
    admin.from("payment_records").select("*").order("created_at", { ascending: false }).limit(500),
    admin.from("payment_event_log").select("*").order("created_at", { ascending: false }).limit(200),
    admin
      .from("credit_transactions")
      .select("id,user_id,type,source_type,source_id,credits_delta,balance_after,description,amount_total,currency,metadata,created_at")
      .in("type", ["purchase", "refund"])
      .order("created_at", { ascending: false })
      .limit(1000),
    admin
      .from("profiles")
      .select("id,email,customer_id,full_name,company_name,credit_balance")
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  const migrationReady = !recordsResult.error && !eventsResult.error;
  if (recordsResult.error && !paymentAuditUnavailable(recordsResult.error)) {
    return NextResponse.json({ error: recordsResult.error.message }, { status: 500 });
  }
  if (eventsResult.error && !paymentAuditUnavailable(eventsResult.error)) {
    return NextResponse.json({ error: eventsResult.error.message }, { status: 500 });
  }
  if (ledgerResult.error) return NextResponse.json({ error: ledgerResult.error.message }, { status: 500 });
  if (customersResult.error) return NextResponse.json({ error: customersResult.error.message }, { status: 500 });

  const ledger = ledgerResult.data ?? [];
  const customers = customersResult.data ?? [];
  const customerById = new Map(customers.map((customer) => [String(customer.id), customer]));
  const ledgerSourceIds = new Set(ledger.map((entry) => String(entry.source_id || "")).filter(Boolean));
  const ledgerPaymentIds = new Set(
    ledger
      .map((entry) => String((entry.metadata as Record<string, unknown> | null)?.payment_record_id || ""))
      .filter(Boolean)
  );

  const records = ((recordsResult.data ?? []) as PaymentRow[]).map((record) => ({
    ...record,
    customer: record.user_id ? customerById.get(record.user_id) ?? null : null,
    creditMatched:
      ledgerSourceIds.has(record.external_id) ||
      Boolean(record.provider_payment_id && ledgerSourceIds.has(record.provider_payment_id)) ||
      ledgerPaymentIds.has(record.id),
  }));

  const revenueCents = ledger.reduce((sum, entry) => sum + cents(entry.amount_total), 0);
  const grossCents = ledger
    .filter((entry) => entry.type === "purchase")
    .reduce((sum, entry) => sum + Math.max(0, cents(entry.amount_total)), 0);
  const refundedCents = Math.abs(
    ledger
      .filter((entry) => entry.type === "refund")
      .reduce((sum, entry) => sum + Math.min(0, cents(entry.amount_total)), 0)
  );
  const creditsIssued = ledger
    .filter((entry) => Number(entry.credits_delta) > 0)
    .reduce((sum, entry) => sum + Number(entry.credits_delta || 0), 0);
  const unresolved = records.filter(
    (record) =>
      (!record.reviewed_at && ["failed", "requires_review"].includes(record.status)) ||
      (record.status === "succeeded" && Number(record.credits) > 0 && !record.creditMatched)
  );

  const providers = (["stripe", "paypal", "bank"] as const).map((provider) => {
    const providerRecords = records.filter((record) => record.provider === provider);
    const providerLedger = ledger.filter(
      (entry) => paymentProviderFromSource(entry.source_type) === provider && entry.type === "purchase"
    );
    return {
      provider,
      total: providerRecords.length,
      succeeded: providerRecords.filter((record) => record.status === "succeeded").length,
      failed: providerRecords.filter((record) => record.status === "failed").length,
      pending: providerRecords.filter((record) => record.status === "pending").length,
      revenueCents: providerLedger.reduce((sum, entry) => sum + Math.max(0, cents(entry.amount_total)), 0),
    };
  });

  return NextResponse.json({
    migrationReady,
    records,
    events: eventsResult.data ?? [],
    ledger,
    customers,
    metrics: {
      grossCents,
      refundedCents,
      netCents: revenueCents,
      creditsIssued,
      completedPayments: ledger.filter((entry) => entry.type === "purchase").length,
      unresolved: unresolved.length,
      pending: records.filter((record) => record.status === "pending").length,
    },
    providers,
  });
}

export async function POST(request: Request) {
  const auth = await requireStaffPermission(request, "credits.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payment action." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const tableCheck = await admin.from("payment_records").select("id").limit(1);
  if (tableCheck.error && paymentAuditUnavailable(tableCheck.error)) {
    return NextResponse.json({ error: "Payment Control migration is required." }, { status: 503 });
  }
  if (tableCheck.error) return NextResponse.json({ error: tableCheck.error.message }, { status: 500 });

  if (parsed.data.action === "record_bank_payment") {
    const result = await admin.rpc("admin_record_bank_payment", {
      p_actor_user_id: auth.user.id,
      p_customer_user_id: parsed.data.customerUserId,
      p_reference: parsed.data.reference,
      p_credits: parsed.data.credits,
      p_amount_total: Math.round(parsed.data.amountEuro * 100),
      p_currency: "eur",
      p_note: parsed.data.note || null,
    });
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
    await sendCreditsAddedEmail({
      userId: parsed.data.customerUserId,
      credits: parsed.data.credits,
      amountTotal: Math.round(parsed.data.amountEuro * 100),
      currency: "eur",
      source: "bank",
      referenceId: parsed.data.reference,
    });
    return NextResponse.json({ success: true, result: result.data });
  }

  if (parsed.data.action === "mark_reviewed") {
    const update = await admin
      .from("payment_records")
      .update({ reviewed_at: new Date().toISOString(), reviewed_by: auth.user.id, review_note: parsed.data.note })
      .eq("id", parsed.data.paymentId)
      .select("id,provider")
      .single();
    if (update.error) return NextResponse.json({ error: update.error.message }, { status: 400 });
    await safeAppendPaymentEvent({
      paymentRecordId: update.data.id,
      provider: update.data.provider,
      eventType: "admin_reviewed",
      status: "processed",
      message: parsed.data.note,
      payload: { actor_id: auth.user.id },
    });
    return NextResponse.json({ success: true });
  }

  const refundClaimToken = randomUUID();
  const claimResult = await admin.rpc("claim_payment_refund", {
    p_actor_user_id: auth.user.id,
    p_payment_record_id: parsed.data.paymentId,
    p_refund_claim_token: refundClaimToken,
  });
  if (claimResult.error) {
    const busy = claimResult.error.code === "55P03";
    return NextResponse.json(
      {
        error: busy
          ? "This refund is already being processed. Please try again shortly."
          : "This payment cannot be refunded automatically; review its reconciliation state.",
      },
      { status: busy ? 409 : 400 },
    );
  }
  if (!claimResult.data || typeof claimResult.data !== "object") {
    return NextResponse.json({ error: "The refund claim could not be verified." }, { status: 503 });
  }

  const payment = claimResult.data as RefundClaimResult;
  if (payment.state === "refunded") {
    return NextResponse.json({
      success: true,
      duplicatePrevented: true,
      providerRefundId: payment.provider_refund_id,
    });
  }
  if (
    payment.state !== "claimed" ||
    payment.payment_id !== parsed.data.paymentId ||
    payment.provider !== "stripe"
  ) {
    return NextResponse.json({ error: "The refund claim did not match the payment." }, { status: 409 });
  }

  let providerRefundId = payment.provider_refund_id ?? "";
  let providerSucceeded = false;
  try {
    const refund = await findOrCreateStripeRefund(payment, auth.user.id);
    providerRefundId = refund.id;
    if (refund.status !== "succeeded") {
      const recoverable = refund.status === "pending" || refund.status === "requires_action";
      const providerState = await admin
        .from("payment_records")
        .update({
          provider_refund_id: providerRefundId,
          failure_code: recoverable ? "refund_provider_pending" : "refund_provider_terminal",
          failure_message: `Stripe refund status: ${refund.status ?? "unknown"}`,
          refund_claim_token: null,
          refund_started_at: null,
        })
        .eq("id", payment.payment_id)
        .eq("provider", "stripe")
        .eq("external_id", payment.external_id)
        .eq("status", "requires_review")
        .eq("failure_code", refundProcessingFailureCode)
        .eq("refund_claim_token", refundClaimToken)
        .select("id")
        .maybeSingle();
      if (providerState.error || !providerState.data) {
        throw new Error("The Stripe refund state could not be recorded.");
      }
      await safeAppendPaymentEvent({
        paymentRecordId: payment.payment_id,
        provider: "stripe",
        eventType: "refund_provider_pending",
        status: recoverable ? "received" : "failed",
        message: `Stripe refund status: ${refund.status ?? "unknown"}.`,
        payload: { actor_id: auth.user.id, provider_refund_id: providerRefundId },
      });
      return NextResponse.json(
        {
          error: recoverable
            ? "The Stripe refund is still pending. Retry after Stripe finishes processing it."
            : "Stripe did not complete the refund; manual reconciliation is required.",
        },
        { status: 409 },
      );
    }

    const providerState = await admin
      .from("payment_records")
      .update({
        provider_refund_id: providerRefundId,
        failure_code: refundProviderSucceededFailureCode,
        failure_message: null,
      })
      .eq("id", payment.payment_id)
      .eq("provider", payment.provider)
      .eq("external_id", payment.external_id)
      .eq("status", "requires_review")
      .eq("failure_code", refundProcessingFailureCode)
      .eq("refund_claim_token", refundClaimToken)
      .select("id")
      .maybeSingle();
    if (providerState.error || !providerState.data) {
      const recoveredState = await admin
        .from("payment_records")
        .select("status,failure_code,provider_refund_id,refund_claim_token")
        .eq("id", payment.payment_id)
        .maybeSingle();
      if (
        recoveredState.error ||
        recoveredState.data?.status !== "requires_review" ||
        recoveredState.data.failure_code !== refundProviderSucceededFailureCode ||
        recoveredState.data.provider_refund_id !== providerRefundId ||
        recoveredState.data.refund_claim_token !== refundClaimToken
      ) {
        throw new Error("The completed provider refund could not be bound to its payment claim.");
      }
    }
    providerSucceeded = true;

    const reversal = await admin.rpc("admin_apply_payment_refund", {
      p_actor_user_id: auth.user.id,
      p_payment_record_id: payment.payment_id,
      p_provider_refund_id: providerRefundId,
      p_note: parsed.data.note,
      p_refund_claim_token: refundClaimToken,
    });
    if (reversal.error) {
      const terminal = await admin
        .from("payment_records")
        .select("status,provider_refund_id")
        .eq("id", payment.payment_id)
        .maybeSingle();
      if (
        !terminal.error &&
        terminal.data?.status === "refunded" &&
        terminal.data.provider_refund_id === providerRefundId
      ) {
        return NextResponse.json({
          success: true,
          duplicatePrevented: true,
          providerRefundId,
        });
      }
      throw new Error("Provider refund completed, but the credit reversal needs recovery.");
    }
    return NextResponse.json({ success: true, providerRefundId, result: reversal.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refund failed.";
    const reviewUpdate = await admin
      .from("payment_records")
      .update({
        status: "requires_review",
        failure_code: providerSucceeded ? "refund_reconciliation_failed" : "refund_provider_failed",
        failure_message: message,
        reviewed_at: null,
        refund_claim_token: null,
        refund_started_at: null,
      })
      .eq("id", payment.payment_id)
      .eq("provider", payment.provider)
      .eq("external_id", payment.external_id)
      .eq("status", "requires_review")
      .eq(
        "failure_code",
        providerSucceeded ? refundProviderSucceededFailureCode : refundProcessingFailureCode,
      )
      .eq("refund_claim_token", refundClaimToken)
      .select("id")
      .maybeSingle();
    if (reviewUpdate.error || !reviewUpdate.data) {
      const terminal = await admin
        .from("payment_records")
        .select("status,provider_refund_id")
        .eq("id", payment.payment_id)
        .maybeSingle();
      if (
        !terminal.error &&
        terminal.data?.status === "refunded" &&
        terminal.data.provider_refund_id === providerRefundId
      ) {
        return NextResponse.json({ success: true, duplicatePrevented: true, providerRefundId });
      }
    }
    await safeAppendPaymentEvent({
      paymentRecordId: payment.payment_id,
      provider: payment.provider,
      eventType: providerSucceeded ? "refund_reconciliation_failed" : "refund_provider_failed",
      status: "failed",
      message,
      payload: { actor_id: auth.user.id, provider_refund_id: providerRefundId },
    });
    return NextResponse.json(
      {
        error: providerSucceeded
          ? "The provider refund succeeded, but the credit reversal needs a safe retry."
          : "The provider refund could not be completed safely.",
      },
      { status: providerSucceeded ? 503 : 502 },
    );
  }
}
