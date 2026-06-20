import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSelectedCreditPurchase } from "@/lib/paymentSelection";

const SUMUP_API_BASE = process.env.SUMUP_API_BASE || "https://api.sumup.com";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const selectedPackage = getSelectedCreditPurchase(body);

    if (!selectedPackage) {
      return NextResponse.json(
        { error: "Credit package or valid custom credit amount is missing." },
        { status: 400 }
      );
    }

    const sumupApiKey = process.env.SUMUP_API_KEY;
    const sumupPayToEmail = process.env.SUMUP_PAY_TO_EMAIL;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    if (!sumupApiKey || !sumupPayToEmail) {
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

    const checkoutReference = Buffer.from(
      JSON.stringify({
        u: user.id,
        c: selectedPackage.credits,
        p: selectedPackage.id,
        t: selectedPackage.purchaseType,
      })
    )
      .toString("base64url")
      .slice(0, 120);

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
        pay_to_email: sumupPayToEmail,
        description: `${selectedPackage.credits} MG AutoTech Credits`,
        return_url: `${siteUrl}/payment/success?provider=sumup`,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || "Could not create SumUp checkout." },
        { status: 500 }
      );
    }

    const checkoutUrl =
      data.hosted_checkout_url ||
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
