import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const { sessionId } = (await request.json()) as { sessionId?: string };

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: "Stripe session id is missing." },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const supabaseAdmin = getSupabaseAdmin();

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Payment is not completed yet.", paymentStatus: session.payment_status },
        { status: 400 }
      );
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
      p_customer_email: session.customer_email ?? session.metadata?.user_email ?? null,
      p_package_id: session.metadata?.package_id ?? null,
      p_credits: credits,
      p_amount_total: session.amount_total ?? null,
      p_currency: session.currency ?? null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      credits,
      paymentStatus: session.payment_status,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not confirm Stripe session.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
