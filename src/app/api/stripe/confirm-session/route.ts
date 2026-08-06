import { NextResponse } from "next/server";
import { completeStripeCreditPurchase } from "@/lib/stripeCreditPurchase";
import { getStripe } from "@/lib/stripe";

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
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Payment is not completed yet.", paymentStatus: session.payment_status },
        { status: 400 }
      );
    }

    const result = await completeStripeCreditPurchase(session);

    return NextResponse.json({
      success: true,
      credits: result.credits,
      paymentStatus: session.payment_status,
      conversion: {
        value: Number(session.amount_total ?? 0) / 100,
        currency: String(session.currency ?? "").toUpperCase(),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not confirm Stripe session.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
