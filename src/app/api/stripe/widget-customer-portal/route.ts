import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { requireApiUser } from "@/lib/apiAuth";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function stripeObjectId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

async function recoverCustomerIdFromSubscription(
  stripe: Stripe,
  subscriptionId: string,
  clientId: string,
  clientEmail: string,
) {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const subscriptionEmail = subscription.metadata.email?.trim().toLowerCase() ?? "";
    if (
      subscription.metadata.product !== "vehicle_widget" ||
      subscription.metadata.widget_client_id !== clientId ||
      (subscriptionEmail && subscriptionEmail !== clientEmail.trim().toLowerCase())
    ) {
      return null;
    }
    return stripeObjectId(subscription.customer);
  } catch {
    return null;
  }
}

const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization",
};

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers: privateNoStoreHeaders },
    );
  }
  const admin = getSupabaseAdmin();
  const client = await admin
    .from("widget_clients")
    .select("id, email, stripe_customer_id, stripe_subscription_id")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (client.error) {
    return NextResponse.json(
      { error: "Widget billing profile could not be loaded." },
      { status: 500, headers: privateNoStoreHeaders },
    );
  }
  if (!client.data) {
    return NextResponse.json(
      { error: "No widget subscription is linked to this account.", action: "view_plans" },
      { status: 404, headers: privateNoStoreHeaders }
    );
  }
  if (!client.data.stripe_subscription_id) {
    return NextResponse.json(
      { error: "No verified widget subscription is linked to this billing profile.", action: "view_plans" },
      { status: 404, headers: privateNoStoreHeaders },
    );
  }

  const stripe = getStripe();
  const verifiedCustomerId = await recoverCustomerIdFromSubscription(
    stripe,
    client.data.stripe_subscription_id,
    client.data.id,
    client.data.email,
  );
  if (
    !verifiedCustomerId ||
    (client.data.stripe_customer_id && client.data.stripe_customer_id !== verifiedCustomerId)
  ) {
    return NextResponse.json(
      { error: "Widget billing ownership could not be verified. Please contact support." },
      { status: 409, headers: privateNoStoreHeaders },
    );
  }
  const stripeCustomerId = verifiedCustomerId;
  if (!client.data.stripe_customer_id) {
    await Promise.allSettled([
      admin
        .from("widget_clients")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", client.data.id)
        .eq("user_id", auth.user.id)
        .eq("stripe_subscription_id", client.data.stripe_subscription_id),
      admin.from("widget_audit_logs").insert({
        actor_user_id: auth.user.id,
        client_id: client.data.id,
        action: "billing.customer_profile_recovered",
        details: { source: "stripe_subscription_lookup" },
      }),
    ]);
  }
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://file.mgautotech.de").replace(/\/$/, "");
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${siteUrl}/dashboard/widget/billing`,
  });
  return NextResponse.json({ url: session.url }, { headers: privateNoStoreHeaders });
}
