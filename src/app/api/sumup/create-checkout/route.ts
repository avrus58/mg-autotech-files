import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCreditPurchaseQuote } from "@/lib/commercialPolicy";

const SUMUP_API_BASE = process.env.SUMUP_API_BASE || "https://api.sumup.com";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const sumupApiKey = process.env.SUMUP_API_KEY;
    const sumupMerchantCode = process.env.SUMUP_MERCHANT_CODE;
    const sumupPayToEmail = process.env.SUMUP_PAY_TO_EMAIL;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    if (!sumupApiKey || (!sumupMerchantCode && !sumupPayToEmail)) {
      return NextResponse.json(
        { error: "SumUp API credentials are missing." },
        { status: 500 }
      );
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Supabase environment variables are missing." },
        { status: 500 }
      );
    }

    const authorization = request.headers.get("authorization");

    if (!authorization) {
      return NextResponse.json(
        { error: "Missing authorization header." },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: "You must be logged in to buy credits." },
        { status: 401 }
      );
    }

    const user = userData.user;

    if (!user.email_confirmed_at && !user.confirmed_at) {
      return NextResponse.json(
        { error: "Please verify your e-mail address before buying credits." },
        { status: 403 }
      );
    }

    let selectedPackage;
    try {
      selectedPackage = await getCreditPurchaseQuote(user.id, body, "sumup");
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "SumUp is not available." }, { status: 403 });
    }
    if (!selectedPackage) {
      return NextResponse.json({ error: "Credit package or valid custom credit amount is missing." }, { status: 400 });
    }

    // Keep the merchant reference below SumUp's 90-character API limit.
    const checkoutReference = Buffer.from(
      JSON.stringify([
        1,
        user.id,
        selectedPackage.credits,
        selectedPackage.purchaseType === "custom" ? "c" : "p",
        Date.now().toString(36),
      ])
    ).toString("base64url");

    const response = await fetch(`${SUMUP_API_BASE}/v0.1/checkouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sumupApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        checkout_reference: checkoutReference,
        amount: selectedPackage.priceEuro,
        currency: "EUR",
        ...(sumupMerchantCode
          ? { merchant_code: sumupMerchantCode }
          : { pay_to_email: sumupPayToEmail }),
        description: `${selectedPackage.credits} MG AutoTech Credits`,
        redirect_url: `${siteUrl}/payment/success?provider=sumup`,
        hosted_checkout: { enabled: true },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data.error_message ||
            data.detail ||
            data.message ||
            "Could not create SumUp checkout.",
        },
        { status: 500 }
      );
    }

    const checkoutUrl =
      data.hosted_checkout_url ||
      data.hosted_checkout?.url ||
      data.checkout_url ||
      data.links?.checkout ||
      data.links?.payment ||
      data.next_step?.url;

    if (!checkoutUrl) {
      return NextResponse.json(
        { error: "SumUp checkout URL was not returned." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: checkoutUrl, checkoutId: data.id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create SumUp checkout.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
