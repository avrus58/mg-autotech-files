import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";
import { getCreditPackage } from "@/lib/creditPackages";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const packageId = body.packageId;
    const customCredits = Number(body.customCredits ?? 0);

    let selectedPackage:
      | {
          id: string;
          credits: number;
          priceEuro: number;
          description: string;
        }
      | null = null;

    if (packageId && typeof packageId === "string") {
      const packageData = getCreditPackage(packageId);

      if (!packageData) {
        return NextResponse.json(
          { error: "Invalid credit package." },
          { status: 400 }
        );
      }

      selectedPackage = {
        id: packageData.id,
        credits: packageData.credits,
        priceEuro: packageData.priceEuro,
        description: packageData.description,
      };
    } else if (
      Number.isFinite(customCredits) &&
      Number.isInteger(customCredits) &&
      customCredits >= 1 &&
      customCredits <= 1000
    ) {
      selectedPackage = {
        id: `custom_${customCredits}`,
        credits: customCredits,
        priceEuro: customCredits * 5,
        description: `Custom credit purchase: ${customCredits} credits at €5 per credit.`,
      };
    } else {
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
      global: {
        headers: {
          Authorization: authorization,
        },
      },
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

    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email ?? undefined,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `${selectedPackage.credits} MG AutoTech Credits`,
              description: selectedPackage.description,
            },
            unit_amount: selectedPackage.priceEuro * 100,
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/payment/cancel`,
      metadata: {
        user_id: user.id,
        user_email: user.email ?? "",
        package_id: selectedPackage.id,
        credits: String(selectedPackage.credits),
        price_euro: String(selectedPackage.priceEuro),
        purchase_type: packageId ? "package" : "custom",
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not create checkout session.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
