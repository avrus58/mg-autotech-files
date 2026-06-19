import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is missing." },
      { status: 500 }
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature." },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  const supabaseAdmin = getSupabaseAdmin();
  const rawBody = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Webhook signature verification failed.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status !== "paid") {
      return NextResponse.json({ received: true });
    }

    const userId = session.metadata?.user_id;
    const credits = Number(session.metadata?.credits ?? 0);

    if (!userId || !Number.isFinite(credits) || credits <= 0) {
      return NextResponse.json(
        { error: "Missing or invalid checkout metadata." },
        { status: 400 }
      );
    }

    const paymentIntent =
      typeof session.payment_intent === "string" ? session.payment_intent : null;

    const { error } = await supabaseAdmin.rpc("add_credits_from_stripe", {
      p_user_id: userId,
      p_stripe_session_id: session.id,
      p_stripe_payment_intent: paymentIntent,
      p_customer_email:
        session.customer_email ?? session.metadata?.user_email ?? null,
      p_package_id: session.metadata?.package_id ?? null,
      p_credits: credits,
      p_amount_total: session.amount_total ?? null,
      p_currency: session.currency ?? null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("credit_balance")
      .eq("id", userId)
      .single();

    const balanceAfter = Number(profile?.credit_balance ?? 0);

    const { error: ledgerError } = await supabaseAdmin
      .from("credit_transactions")
      .upsert(
        {
          user_id: userId,
          type: "purchase",
          source_type: "stripe_checkout",
          source_id: session.id,
          credits_delta: credits,
          balance_after: balanceAfter,
          description: `${credits} credits purchased via Stripe.`,
          amount_total: session.amount_total ?? null,
          currency: session.currency ?? null,
          metadata: {
            stripe_session_id: session.id,
            stripe_payment_intent: paymentIntent,
            customer_email:
              session.customer_email ?? session.metadata?.user_email ?? null,
            package_id: session.metadata?.package_id ?? null,
            purchase_type: session.metadata?.purchase_type ?? null,
          },
        },
        {
          onConflict: "source_type,source_id",
          ignoreDuplicates: true,
        }
      );

    if (ledgerError) {
      return NextResponse.json({ error: ledgerError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
