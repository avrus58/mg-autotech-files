import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  paymentAuditUnavailable,
  paymentProviderFromSource,
  safeAppendPaymentEvent,
  safeUpdatePaymentRecord,
} from "@/lib/paymentAudit";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("record_bank_payment"),
    customerUserId: z.string().uuid(),
    reference: z.string().trim().min(3).max(160),
    credits: z.number().positive().max(100000),
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
  [key: string]: unknown;
};

function cents(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const base = process.env.PAYPAL_API_BASE || "https://api-m.paypal.com";
  if (!clientId || !clientSecret) throw new Error("PayPal API credentials are missing.");
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || "Could not authorize PayPal refund.");
  return String(data.access_token);
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

  const paymentResult = await admin
    .from("payment_records")
    .select("*")
    .eq("id", parsed.data.paymentId)
    .single();
  if (paymentResult.error || !paymentResult.data) {
    return NextResponse.json({ error: paymentResult.error?.message || "Payment was not found." }, { status: 404 });
  }
  const payment = paymentResult.data as PaymentRow;
  if (payment.status !== "succeeded") {
    return NextResponse.json({ error: "Only successful payments can be refunded." }, { status: 400 });
  }

  let providerRefundId = `bank-refund-${payment.id}`;
  try {
    if (payment.provider === "stripe") {
      if (!payment.provider_payment_id) throw new Error("Stripe PaymentIntent is missing.");
      const refund = await getStripe().refunds.create(
        {
          payment_intent: payment.provider_payment_id,
          reason: "requested_by_customer",
          metadata: { payment_record_id: payment.id, actor_user_id: auth.user.id },
        },
        { idempotencyKey: `mga-refund-${payment.id}` }
      );
      providerRefundId = refund.id;
      if (refund.status !== "succeeded") {
        await safeUpdatePaymentRecord("stripe", payment.external_id, {
          status: "requires_review",
          failure_message: `Stripe refund status: ${refund.status}`,
        });
        return NextResponse.json({ error: `Stripe refund is ${refund.status}; manual review is required.` }, { status: 409 });
      }
    } else if (payment.provider === "paypal") {
      if (!payment.provider_payment_id) throw new Error("PayPal capture id is missing.");
      const token = await getPayPalAccessToken();
      const base = process.env.PAYPAL_API_BASE || "https://api-m.paypal.com";
      const response = await fetch(`${base}/v2/payments/captures/${payment.provider_payment_id}/refund`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": `mga-refund-${payment.id}`,
        },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok || data.status !== "COMPLETED") {
        throw new Error(data.message || `PayPal refund status: ${data.status || response.status}`);
      }
      providerRefundId = String(data.id);
    }

    const reversal = await admin.rpc("admin_apply_payment_refund", {
      p_actor_user_id: auth.user.id,
      p_payment_record_id: payment.id,
      p_provider_refund_id: providerRefundId,
      p_note: parsed.data.note,
    });
    if (reversal.error) throw new Error(`Provider refund completed, but credit reversal failed: ${reversal.error.message}`);
    return NextResponse.json({ success: true, providerRefundId, result: reversal.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refund failed.";
    await safeUpdatePaymentRecord(payment.provider, payment.external_id, {
      status: "requires_review",
      failure_message: message,
      reviewed_at: null,
    });
    await safeAppendPaymentEvent({
      paymentRecordId: payment.id,
      provider: payment.provider,
      eventType: "refund_failed",
      status: "failed",
      message,
      payload: { actor_id: auth.user.id, provider_refund_id: providerRefundId },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
