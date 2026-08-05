import { NextResponse } from "next/server";
import { z } from "zod";
import { checkAdaptiveRateLimit, rateLimitResponseHeaders } from "@/lib/abuseProtection";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getWidgetSettings } from "@/lib/widget/settings";
import { normalizeWidgetLanguage } from "@/lib/i18n/widget-translations";
import { validatePublicWidgetDomain, widgetAbuseSubject } from "@/lib/widget/security";

const checkoutSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(250),
  websiteDomain: z.string().trim().min(3).max(253),
  preferredLanguage: z.string().max(5).optional(),
});

export async function POST(request: Request) {
  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please complete all subscription details." }, { status: 400 });
  const rateLimit = await checkAdaptiveRateLimit({
    request,
    scope: "widget-checkout",
    limit: 8,
    windowMs: 60 * 60 * 1000,
    suffix: widgetAbuseSubject(parsed.data.email, parsed.data.websiteDomain),
  });
  const limitHeaders = rateLimitResponseHeaders({ result: rateLimit, limit: 8, windowMs: 60 * 60 * 1000, blocked: !rateLimit.allowed });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many checkout attempts. Please try again later." }, { status: 429, headers: limitHeaders });
  }
  const settingsResult = await getWidgetSettings();
  const settings = settingsResult.settings;
  if (!settingsResult.databaseReady) return NextResponse.json({ error: "Widget subscriptions are not configured yet." }, { status: 503 });
  if (!settings.widget_product_enabled || !settings.public_signup_enabled) return NextResponse.json({ error: "New widget subscriptions are currently unavailable." }, { status: 403 });
  if (!settings.checkout_enabled) return NextResponse.json({ error: "Online checkout is currently unavailable. Please contact MG AutoTech." }, { status: 403 });
  const domainValidation = validatePublicWidgetDomain(parsed.data.websiteDomain);
  if (!domainValidation.valid) return NextResponse.json({ error: domainValidation.reason }, { status: 400, headers: limitHeaders });
  const domain = domainValidation.domain;

  const admin = getSupabaseAdmin();
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const authUser = token ? (await admin.auth.getUser(token)).data.user : null;
  const language = normalizeWidgetLanguage(parsed.data.preferredLanguage, settings.default_language);
  const email = parsed.data.email.toLowerCase();
  const existing = await admin.from("widget_clients").select("id, status, stripe_subscription_id").eq("email", email).eq("allowed_domain", domain).neq("status", "cancelled").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existing.error) return NextResponse.json({ error: "Existing subscription state could not be verified." }, { status: 503, headers: limitHeaders });
  if (existing.data?.stripe_subscription_id) {
    return NextResponse.json({ error: "A widget subscription already exists for this e-mail and domain. Sign in to manage its billing." }, { status: 409, headers: limitHeaders });
  }
  let domainOwnerQuery = admin.from("widget_clients").select("id").eq("allowed_domain", domain).neq("status", "cancelled");
  if (existing.data?.id) domainOwnerQuery = domainOwnerQuery.neq("id", existing.data.id);
  const domainOwner = await domainOwnerQuery.limit(1).maybeSingle();
  if (domainOwner.error) return NextResponse.json({ error: "Domain availability could not be verified." }, { status: 503, headers: limitHeaders });
  if (domainOwner.data) return NextResponse.json({ error: "This website domain is already linked to a widget subscription." }, { status: 409, headers: limitHeaders });
  const clientPayload = {
    user_id: authUser?.id ?? null,
    company_name: parsed.data.companyName,
    email,
    website_domain: domain,
    allowed_domain: domain,
    plan: "starter",
    monthly_price: settings.monthly_price,
    currency: settings.currency,
    default_language: language,
    allowed_languages: settings.enabled_languages,
    monthly_usage_limit: settings.default_monthly_usage_limit,
    status: "pending",
    widget_enabled: true,
  };
  const clientResult = existing.data
    ? await admin.from("widget_clients").update(clientPayload).eq("id", existing.data.id).select("id").single()
    : await admin.from("widget_clients").insert(clientPayload).select("id").single();
  if (clientResult.error) return NextResponse.json({ error: "Widget subscription setup could not be started." }, { status: 500, headers: limitHeaders });

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://file.mgautotech.de").replace(/\/$/, "");
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: email,
    line_items: [{
      price_data: {
        currency: settings.currency,
        recurring: { interval: "month" },
        product_data: {
          name: "MG AutoTech Vehicle Selector Widget",
          description: "Hosted vehicle lookup widget for one website domain, including 12 languages and automatic database updates.",
        },
        unit_amount: Math.round(settings.monthly_price * 100),
      },
      quantity: 1,
    }],
    success_url: `${siteUrl}/dashboard/widget?checkout=success`,
    cancel_url: `${siteUrl}/widget?checkout=cancelled`,
    allow_promotion_codes: true,
    subscription_data: { metadata: { product: "vehicle_widget", widget_client_id: clientResult.data.id, plan: "starter", allowed_domain: domain } },
    metadata: { product: "vehicle_widget", widget_client_id: clientResult.data.id, company_name: parsed.data.companyName, email, website_domain: domain, allowed_domain: domain, plan: "starter" },
  });
  await admin.from("widget_audit_logs").insert({ actor_user_id: authUser?.id ?? null, client_id: clientResult.data.id, action: "checkout.created", details: { stripe_session_id: session.id, domain } });
  return NextResponse.json({ url: session.url }, { headers: limitHeaders });
}
