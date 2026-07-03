import { NextResponse } from "next/server";
import {
  safeAppendPaymentEvent,
  safeUpdatePaymentRecord,
  safeUpsertPaymentRecord,
} from "@/lib/paymentAudit";
import { addPurchasedCredits } from "@/lib/paymentCredits";

const PAYPAL_API_BASE =
  process.env.PAYPAL_API_BASE || "https://api-m.paypal.com";

async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PayPal API credentials are missing.");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error_description || "Could not authorize PayPal.");
  }

  return String(data.access_token);
}

export async function POST(request: Request) {
  let activeOrderId: string | null = null;
  try {
    const { orderId } = (await request.json()) as { orderId?: string };

    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json(
        { error: "PayPal order id is missing." },
        { status: 400 }
      );
    }
    activeOrderId = orderId;

    const accessToken = await getPayPalAccessToken();

    const response = await fetch(
      `${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const recordId = await safeUpdatePaymentRecord("paypal", orderId, {
        status: "failed",
        failure_code: data.name || String(response.status),
        failure_message: data.message || "Could not capture PayPal order.",
      });
      await safeAppendPaymentEvent({
        paymentRecordId: recordId,
        provider: "paypal",
        eventType: "capture_failed",
        status: "failed",
        message: data.message || "Could not capture PayPal order.",
        payload: { paypal_order_id: orderId, http_status: response.status },
      });
      return NextResponse.json(
        { error: data.message || "Could not capture PayPal order." },
        { status: 500 }
      );
    }

    if (data.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "PayPal payment is not completed yet.", paymentStatus: data.status },
        { status: 400 }
      );
    }

    const purchaseUnit = data.purchase_units?.[0];
    const capture = purchaseUnit?.payments?.captures?.[0];
    const metadata = JSON.parse(purchaseUnit?.custom_id || "{}") as {
      u?: string;
      c?: number;
      p?: string;
      t?: string;
    };

    if (!capture?.id || !metadata.u || !metadata.c) {
      return NextResponse.json(
        { error: "PayPal payment metadata is missing." },
        { status: 400 }
      );
    }

    const recordId = await safeUpsertPaymentRecord({
      provider: "paypal",
      externalId: orderId,
      providerPaymentId: capture.id,
      userId: metadata.u,
      status: "pending",
      credits: Number(metadata.c),
      amountTotal: Math.round(Number(capture.amount?.value ?? 0) * 100),
      currency: String(capture.amount?.currency_code ?? "EUR").toLowerCase(),
      packageId: metadata.p ?? null,
      purchaseType: metadata.t ?? null,
      metadata: { paypal_order_id: orderId, paypal_capture_id: capture.id },
    });

    const result = await addPurchasedCredits({
      userId: metadata.u,
      sourceType: "paypal_order",
      sourceId: capture.id,
      credits: Number(metadata.c),
      amountTotal: Math.round(Number(capture.amount?.value ?? 0) * 100),
      currency: String(capture.amount?.currency_code ?? "EUR").toLowerCase(),
      description: `${metadata.c} credits purchased via PayPal.`,
      metadata: {
        payment_record_id: recordId,
        paypal_order_id: orderId,
        paypal_capture_id: capture.id,
        package_id: metadata.p ?? null,
        purchase_type: metadata.t ?? null,
      },
    });

    const creditsAppliedAt = new Date().toISOString();
    await safeUpdatePaymentRecord("paypal", orderId, {
      status: "succeeded",
      provider_payment_id: capture.id,
      credits_applied_at: creditsAppliedAt,
      failure_code: null,
      failure_message: null,
    });
    await safeAppendPaymentEvent({
      paymentRecordId: recordId,
      provider: "paypal",
      eventType: "capture_completed",
      status: "processed",
      message: "PayPal payment captured and credits reconciled.",
      payload: { paypal_order_id: orderId, paypal_capture_id: capture.id },
    });

    return NextResponse.json({
      success: true,
      credits: result.credits,
      alreadyProcessed: result.alreadyProcessed,
      paymentStatus: data.status,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not capture PayPal order.";

    if (activeOrderId) {
      const recordId = await safeUpdatePaymentRecord("paypal", activeOrderId, {
        status: "requires_review",
        failure_message: message,
      });
      await safeAppendPaymentEvent({
        paymentRecordId: recordId,
        provider: "paypal",
        eventType: "capture_processing_failed",
        status: "failed",
        message,
        payload: { paypal_order_id: activeOrderId },
      });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
