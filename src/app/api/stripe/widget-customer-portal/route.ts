import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { requireApiUser } from "@/lib/apiAuth";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function stripeObjectId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

async function recoverCustomerIdFromSubscription(stripe: Stripe, subscriptionId: string) {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return stripeObjectId(subscription.customer);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const admin = getSupabaseAdmin();
  const client = await admin
    .from("widget_clients")
    .select("id, stripe_customer_id, stripe_subscription_id")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (client.error) return NextResponse.json({ error: "Widget billing profile could not be loaded." }, { status: 500 });
  if (!client.data) {
    return NextResponse.json(
      { error: "No widget subscription is linked to this account.", action: "view_plans" },
      { status: 404 }
    );
  }

  const stripe = getStripe();
  let stripeCustomerId = client.data.stripe_customer_id;
  if (!stripeCustomerId && client.data.stripe_subscription_id) {
    stripeCustomerId = await recoverCustomerIdFromSubscription(stripe, client.data.stripe_subscription_id);
    if (stripeCustomerId) {
      await Promise.allSettled([
        admin.from("widget_clients").update({ stripe_customer_id: stripeCustomerId }).eq("id", client.data.id),
        admin.from("widget_audit_logs").insert({
          actor_user_id: auth.user.id,
          client_id: client.data.id,
          action: "billing.customer_profile_recovered",
          details: { source: "stripe_subscription_lookup" },
        }),
      ]);
    }
  }

  if (!stripeCustomerId) {
    return NextResponse.json(
      {
        error:
          "No Stripe billing profile is linked to this widget yet. Start a widget subscription or contact MG AutoTech support.",
        action: "view_plans",
      },
      { status: 404 }
    );
  }
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://file.mgautotech.de").replace(/\/$/, "");
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${siteUrl}/dashboard/widget/billing`,
  });
  return NextResponse.json({ url: session.url });
}
