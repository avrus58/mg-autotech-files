import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import {
  CommercialPricingUnavailableError,
  getCreditPurchaseQuote,
  PaymentMethodUnavailableError,
  StaleCreditQuoteError,
} from "@/lib/commercialPolicy";
import { sendBankTransferInstructionsEmail } from "@/lib/email/events";
import {
  checkAdaptiveRateLimit,
  rateLimitResponseHeaders,
} from "@/lib/abuseProtection";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const bankTransferSelectionSchema = z.object({
  packageId: z.string().trim().min(1).max(80).optional(),
  customCredits: z.number().int().min(1).max(1000).optional(),
  quoteId: z.string().regex(/^[a-f0-9]{40}$/),
}).strict().superRefine((value, context) => {
  if (Boolean(value.packageId) === (value.customCredits !== undefined)) {
    context.addIssue({
      code: "custom",
      message: "Choose exactly one credit package or custom credit amount.",
    });
  }
});

const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization",
};

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status, headers: privateNoStoreHeaders },
    );
  }

  const limit = await checkAdaptiveRateLimit({
    request,
    scope: "bank-transfer-email",
    suffix: auth.user.id,
    limit: 4,
    windowMs: 60 * 60 * 1000,
  });
  const responseHeaders = {
    ...privateNoStoreHeaders,
    ...rateLimitResponseHeaders({
      result: limit,
      limit: 4,
      windowMs: 60 * 60 * 1000,
      blocked: !limit.allowed,
    }),
  };
  if (!limit.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many bank transfer email requests. Please try again later." },
      { status: 429, headers: responseHeaders },
    );
  }

  const parsed = bankTransferSelectionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Choose a valid credit package or custom credit amount." },
      { status: 400, headers: responseHeaders },
    );
  }

  let selectedPurchase;
  try {
    selectedPurchase = await getCreditPurchaseQuote(
      auth.user.id,
      parsed.data,
      "bank",
    );
  } catch (error) {
    if (error instanceof StaleCreditQuoteError) {
      return NextResponse.json(
        {
          success: false,
          error: "Credit prices changed. Review the refreshed quote before continuing.",
          code: error.code,
        },
        { status: 409, headers: responseHeaders },
      );
    }
    if (error instanceof PaymentMethodUnavailableError) {
      return NextResponse.json(
        {
          success: false,
          error: "Bank transfer is not available for this account.",
          code: error.code,
        },
        { status: 403, headers: responseHeaders },
      );
    }
    if (error instanceof CommercialPricingUnavailableError) {
      return NextResponse.json(
        {
          success: false,
          error: "Credit pricing is temporarily unavailable. No payment instruction was created.",
          code: error.code,
        },
        { status: 503, headers: responseHeaders },
      );
    }
    return NextResponse.json(
      { success: false, error: "Bank transfer could not be prepared safely." },
      { status: 503, headers: responseHeaders },
    );
  }

  if (!selectedPurchase) {
    return NextResponse.json(
      { success: false, error: "Choose a valid credit package or custom credit amount." },
      { status: 400, headers: responseHeaders },
    );
  }

  const admin = getSupabaseAdmin();
  const profile = await admin
    .from("profiles")
    .select("customer_id,email")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profile.error || !profile.data?.customer_id) {
    return NextResponse.json(
      { success: false, error: "Customer ID could not be loaded." },
      { status: 503, headers: responseHeaders },
    );
  }

  try {
    const delivery = await sendBankTransferInstructionsEmail({
      userId: auth.user.id,
      customerEmail: profile.data.email || auth.user.email || "",
      customerId: profile.data.customer_id,
      credits: selectedPurchase.credits,
      amountLabel: `${selectedPurchase.priceEuro.toFixed(2)} EUR`,
      deliveryRequestId: randomUUID(),
    });
    if (!delivery.ok || delivery.status !== "sent") {
      return NextResponse.json(
        { success: false, error: "Bank transfer instructions could not be confirmed as sent. Please try again." },
        { status: 503, headers: responseHeaders },
      );
    }
  } catch {
    return NextResponse.json(
      { success: false, error: "Bank transfer instructions could not be sent. Please try again." },
      { status: 503, headers: responseHeaders },
    );
  }

  return NextResponse.json(
    {
      success: true,
      customerId: profile.data.customer_id,
      credits: selectedPurchase.credits,
      amountEuro: selectedPurchase.priceEuro,
      quoteId: selectedPurchase.quoteId,
    },
    { headers: responseHeaders },
  );
}
