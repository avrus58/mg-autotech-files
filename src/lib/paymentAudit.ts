import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type PaymentProvider = "stripe" | "paypal" | "bank";
export type PaymentStatus =
  | "pending"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "requires_review"
  | "refunded";

export type PaymentRecordInput = {
  provider: PaymentProvider;
  externalId: string;
  providerPaymentId?: string | null;
  userId?: string | null;
  status: PaymentStatus;
  paymentType?: "credit_purchase" | "manual_bank";
  credits?: number;
  amountTotal?: number | null;
  currency?: string | null;
  customerEmail?: string | null;
  packageId?: string | null;
  purchaseType?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  metadata?: Record<string, unknown>;
  creditsAppliedAt?: string | null;
};

type PaymentEventInput = {
  paymentRecordId?: string | null;
  provider: PaymentProvider;
  externalEventId?: string | null;
  eventType: string;
  status: "received" | "processed" | "failed" | "info";
  message?: string | null;
  payload?: Record<string, unknown>;
};

export function paymentAuditUnavailable(error: { code?: string; message?: string } | null | undefined) {
  return ["42P01", "42703", "PGRST204", "PGRST205"].includes(error?.code || "") ||
    Boolean(error?.message?.toLowerCase().includes("schema cache"));
}

export async function safeUpsertPaymentRecord(input: PaymentRecordInput) {
  if (!input.externalId) return null;
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("payment_records")
      .upsert(
        {
          provider: input.provider,
          external_id: input.externalId,
          provider_payment_id: input.providerPaymentId ?? null,
          user_id: input.userId ?? null,
          status: input.status,
          payment_type: input.paymentType ?? "credit_purchase",
          credits: input.credits ?? 0,
          amount_total: input.amountTotal ?? null,
          currency: String(input.currency || "eur").toLowerCase(),
          customer_email: input.customerEmail ?? null,
          package_id: input.packageId ?? null,
          purchase_type: input.purchaseType ?? null,
          failure_code: input.failureCode ?? null,
          failure_message: input.failureMessage ?? null,
          metadata: input.metadata ?? {},
          credits_applied_at: input.creditsAppliedAt ?? null,
        },
        { onConflict: "provider,external_id" }
      )
      .select("id")
      .single();

    if (error) {
      if (!paymentAuditUnavailable(error)) console.error("Payment audit upsert failed:", error.message);
      return null;
    }
    return String(data.id);
  } catch (error) {
    console.error("Payment audit upsert failed:", error);
    return null;
  }
}

export async function safeUpdatePaymentRecord(
  provider: PaymentProvider,
  externalId: string,
  updates: Record<string, unknown>
) {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("payment_records")
      .update(updates)
      .eq("provider", provider)
      .eq("external_id", externalId)
      .select("id")
      .maybeSingle();
    if (error) {
      if (!paymentAuditUnavailable(error)) console.error("Payment audit update failed:", error.message);
      return null;
    }
    return data?.id ? String(data.id) : null;
  } catch (error) {
    console.error("Payment audit update failed:", error);
    return null;
  }
}

export async function safeAppendPaymentEvent(input: PaymentEventInput) {
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("payment_event_log").insert({
      payment_record_id: input.paymentRecordId ?? null,
      provider: input.provider,
      external_event_id: input.externalEventId ?? null,
      event_type: input.eventType,
      status: input.status,
      message: input.message ?? null,
      payload: input.payload ?? {},
    });
    if (error && error.code !== "23505" && !paymentAuditUnavailable(error)) {
      console.error("Payment event log failed:", error.message);
    }
  } catch (error) {
    console.error("Payment event log failed:", error);
  }
}

export function paymentProviderFromSource(sourceType: string | null | undefined): PaymentProvider | null {
  const source = String(sourceType || "").toLowerCase();
  if (source.includes("stripe")) return "stripe";
  if (source.includes("paypal")) return "paypal";
  if (source.includes("bank")) return "bank";
  return null;
}
