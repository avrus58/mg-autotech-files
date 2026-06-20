import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSelectedCreditPurchase } from "@/lib/paymentSelection";

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
  try {
    const body = await request.json();
    const selectedPackage = getSelectedCreditPurchase(body);

    if (!selectedPackage) {
      return NextResponse.json(
        { error: "Credit package or valid custom credit amount is missing." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

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

    const accessToken = await getPayPalAccessToken();
    const customId = JSON.stringify({
      u: user.id,
      c: selectedPackage.credits,
      p: selectedPackage.id,
      t: selectedPackage.purchaseType,
    });

    const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            custom_id: customId,
            invoice_id: `MG-${selectedPackage.id}-${Date.now()}`,
            description: `${selectedPackage.credits} MG AutoTech Credits`,
            amount: {
              currency_code: "EUR",
              value: selectedPackage.priceEuro.toFixed(2),
            },
          },
        ],
        application_context: {
          brand_name: "MG AutoTech",
          user_action: "PAY_NOW",
          return_url: `${siteUrl}/payment/success?provider=paypal`,
          cancel_url: `${siteUrl}/payment/cancel`,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || "Could not create PayPal order." },
        { status: 500 }
      );
    }

    const approveUrl = data.links?.find(
      (link: { rel?: string }) => link.rel === "approve"
    )?.href;

    if (!approveUrl) {
      return NextResponse.json(
        { error: "PayPal approval URL was not returned." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: approveUrl, orderId: data.id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create PayPal order.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
