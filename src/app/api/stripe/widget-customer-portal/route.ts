import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/apiAuth";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const client = await getSupabaseAdmin().from("widget_clients").select("stripe_customer_id").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!client.data?.stripe_customer_id) return NextResponse.json({ error: "Stripe billing profile not found." }, { status: 404 });
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://file.mgautotech.de").replace(/\/$/, "");
  const session = await getStripe().billingPortal.sessions.create({ customer: client.data.stripe_customer_id, return_url: `${siteUrl}/dashboard/widget/billing` });
  return NextResponse.json({ url: session.url });
}

