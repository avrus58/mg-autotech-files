import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { checkAdaptiveRateLimit, rateLimitResponseHeaders } from "@/lib/abuseProtection";
import { requireApiUser } from "@/lib/apiAuth";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getWidgetSettings } from "@/lib/widget/settings";
import { normalizeWidgetLanguage } from "@/lib/i18n/widget-translations";
import { validatePublicWidgetDomain, widgetAbuseSubject } from "@/lib/widget/security";
import { canonicalWidgetDomain } from "@/lib/widget/domain";
import {
  canResumeWidgetCheckoutAttempt,
  evaluateWidgetCheckoutReuse,
  widgetCheckoutActorMatchesEmail,
  type ExistingWidgetCheckoutClient,
  type WidgetCheckoutActor,
} from "@/lib/widget/checkoutSecurity";

const checkoutSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(250),
  websiteDomain: z.string().trim().min(3).max(253),
  preferredLanguage: z.string().max(5).optional(),
});

const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization",
};
const widgetCheckoutWindowMs = 60 * 60 * 1000;
const widgetCheckoutLifetimeSeconds = 31 * 60;
const stripeCheckoutSessionIdPattern = /^cs_(?:test|live)_[A-Za-z0-9]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PendingWidgetCheckout = {
  id: string;
  user_id: string | null;
  status: "pending" | "cancelled";
  stripe_checkout_session_id: string | null;
  checkout_pending_until: string | null;
  checkout_claim_token: string | null;
  checkout_claimed_at: string | null;
};

type ClaimedWidgetCheckout = {
  client_id: string;
  claim_token: string;
  claim_expires_at: string;
  checkout_company_name: string;
  checkout_email: string;
  checkout_website_domain: string;
  checkout_canonical_domain: string;
  checkout_plan: string;
  checkout_monthly_price: number | string;
  checkout_currency: string;
};

function checkoutSessionBelongsToClient(
  session: { metadata?: Record<string, string> | null },
  client: Pick<PendingWidgetCheckout, "id" | "user_id">,
) {
  return session.metadata?.product === "vehicle_widget" &&
    session.metadata.widget_client_id === client.id &&
    Boolean(client.user_id) &&
    session.metadata.authenticated_user_id === client.user_id;
}

export async function POST(request: Request) {
  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please complete all subscription details." },
      { status: 400, headers: privateNoStoreHeaders },
    );
  }
  const ipRateLimit = await checkAdaptiveRateLimit({
    request,
    scope: "widget-checkout-ip",
    limit: 20,
    windowMs: widgetCheckoutWindowMs,
  });
  const ipLimitHeaders = {
    ...privateNoStoreHeaders,
    ...rateLimitResponseHeaders({
      result: ipRateLimit,
      limit: 20,
      windowMs: widgetCheckoutWindowMs,
      blocked: !ipRateLimit.allowed,
    }),
  };
  if (!ipRateLimit.allowed) {
    return NextResponse.json({ error: "Too many checkout attempts. Please try again later." }, { status: 429, headers: ipLimitHeaders });
  }
  const settingsResult = await getWidgetSettings();
  const settings = settingsResult.settings;
  if (!settingsResult.databaseReady) return NextResponse.json({ error: "Widget subscriptions are not configured yet." }, { status: 503, headers: ipLimitHeaders });
  if (!settings.widget_product_enabled || !settings.public_signup_enabled) return NextResponse.json({ error: "New widget subscriptions are currently unavailable." }, { status: 403, headers: ipLimitHeaders });
  if (!settings.checkout_enabled) return NextResponse.json({ error: "Online checkout is currently unavailable. Please contact MG AutoTech." }, { status: 403, headers: ipLimitHeaders });
  const domainValidation = validatePublicWidgetDomain(parsed.data.websiteDomain);
  if (!domainValidation.valid) return NextResponse.json({ error: domainValidation.reason }, { status: 400, headers: ipLimitHeaders });
  const domain = domainValidation.domain;
  const canonicalDomain = canonicalWidgetDomain(domain);

  const language = normalizeWidgetLanguage(parsed.data.preferredLanguage, settings.default_language);
  const email = parsed.data.email.toLowerCase();
  const auth = await requireApiUser(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status, headers: ipLimitHeaders });
  }
  const actor: WidgetCheckoutActor = {
    userId: auth.user.id,
    email: auth.user.email ?? "",
  };
  if (!widgetCheckoutActorMatchesEmail(actor, email)) {
    return NextResponse.json(
      { error: "Use the verified e-mail address linked to your signed-in account." },
      { status: 403, headers: ipLimitHeaders },
    );
  }

  // Only a verified account may spend the account/domain subject budget. This
  // prevents anonymous callers from exhausting a victim's checkout attempts.
  const subjectRateLimit = await checkAdaptiveRateLimit({
    request,
    scope: "widget-checkout-subject",
    limit: 8,
    windowMs: widgetCheckoutWindowMs,
    suffix: widgetAbuseSubject(actor.userId, email, canonicalDomain),
    includeClientIp: false,
  });
  const limitHeaders = {
    ...privateNoStoreHeaders,
    ...rateLimitResponseHeaders({
      result: subjectRateLimit,
      limit: 8,
      windowMs: widgetCheckoutWindowMs,
      blocked: !subjectRateLimit.allowed,
    }),
  };
  if (!subjectRateLimit.allowed) {
    return NextResponse.json({ error: "Too many checkout attempts. Please try again later." }, { status: 429, headers: limitHeaders });
  }

  const admin = getSupabaseAdmin();
  const stripe = getStripe();
  const nowIso = new Date().toISOString();
  const legacyPendingCutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [expiredPending, legacyPending, legacyCancelled] = await Promise.all([
    admin
      .from("widget_clients")
      .select("id,user_id,status,stripe_checkout_session_id,checkout_pending_until,checkout_claim_token,checkout_claimed_at")
      .eq("canonical_domain", canonicalDomain)
      .eq("status", "pending")
      .is("stripe_customer_id", null)
      .is("stripe_subscription_id", null)
      .lt("checkout_pending_until", nowIso),
    admin
      .from("widget_clients")
      .select("id,user_id,status,stripe_checkout_session_id,checkout_pending_until,checkout_claim_token,checkout_claimed_at")
      .eq("canonical_domain", canonicalDomain)
      .eq("status", "pending")
      .is("stripe_customer_id", null)
      .is("stripe_subscription_id", null)
      .is("checkout_pending_until", null)
      .lt("created_at", legacyPendingCutoff),
    admin
      .from("widget_clients")
      .select("id,user_id,status,stripe_checkout_session_id,checkout_pending_until,checkout_claim_token,checkout_claimed_at")
      .eq("canonical_domain", canonicalDomain)
      .eq("status", "cancelled")
      .is("stripe_customer_id", null)
      .is("stripe_subscription_id", null)
      .not("stripe_checkout_session_id", "is", null),
  ]);
  if (expiredPending.error || legacyPending.error || legacyCancelled.error) {
    return NextResponse.json({ error: "Pending checkout state could not be recovered." }, { status: 503, headers: limitHeaders });
  }

  const pendingRows = new Map<string, PendingWidgetCheckout>();
  for (const row of [
    ...(expiredPending.data ?? []),
    ...(legacyPending.data ?? []),
    ...(legacyCancelled.data ?? []),
  ]) {
    pendingRows.set(row.id, row as PendingWidgetCheckout);
  }

  const safelyExpireCheckout = async (row: PendingWidgetCheckout) => {
    const sessionId = row.stripe_checkout_session_id;
    // An unbound claim may still have created a Stripe session whose response
    // was lost. Without the provider id we cannot prove that external object is
    // terminal, so retain the claim instead of opening a second checkout.
    if (!sessionId) return false;
    if (!stripeCheckoutSessionIdPattern.test(sessionId)) return false;

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (!checkoutSessionBelongsToClient(session, row)) return false;
      if (session.status === "expired") return true;
      if (session.status !== "open") return false;
      const expired = await stripe.checkout.sessions.expire(sessionId);
      return expired.status === "expired" && checkoutSessionBelongsToClient(expired, row);
    } catch {
      // Stripe can auto-expire the session between retrieve and expire. Verify
      // that exact terminal state before permitting the database lease release.
      try {
        const recovered = await stripe.checkout.sessions.retrieve(sessionId);
        return recovered.status === "expired" && checkoutSessionBelongsToClient(recovered, row);
      } catch {
        return false;
      }
    }
  };

  for (const row of pendingRows.values()) {
    if (row.stripe_checkout_session_id && !(await safelyExpireCheckout(row))) {
      return NextResponse.json(
        { error: "The previous checkout could not be safely closed. Please try again shortly." },
        { status: 503, headers: limitHeaders },
      );
    }
    if (!row.user_id || !row.checkout_claim_token) {
      return NextResponse.json({ error: "Pending checkout state requires manual review." }, { status: 503, headers: limitHeaders });
    }
    const released = await admin.rpc("release_widget_checkout_attempt", {
      p_client_id: row.id,
      p_user_id: row.user_id,
      p_claim_token: row.checkout_claim_token,
      p_expired_stripe_checkout_session_id: row.stripe_checkout_session_id ?? null,
    });
    if (released.error || released.data !== true) {
      return NextResponse.json({ error: "Pending checkout state changed during recovery." }, { status: 503, headers: limitHeaders });
    }
  }

  const existing = await admin
    .from("widget_clients")
    .select("id, user_id, email, status, stripe_customer_id, stripe_subscription_id, stripe_checkout_session_id, checkout_pending_until, checkout_claim_token, checkout_claimed_at")
    .eq("email", email)
    .eq("canonical_domain", canonicalDomain)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing.error) return NextResponse.json({ error: "Existing subscription state could not be verified." }, { status: 503, headers: limitHeaders });
  if (existing.data) {
    const checkoutState = existing.data as ExistingWidgetCheckoutClient;
    const resumable = canResumeWidgetCheckoutAttempt(
      checkoutState,
      actor,
      email,
    );
    const reuse = resumable
      ? { allowed: true as const }
      : evaluateWidgetCheckoutReuse(checkoutState, actor, email);
    if (!reuse.allowed) {
      return NextResponse.json(
        { error: "A widget setup already exists for this e-mail and domain. Sign in to manage it or contact support." },
        { status: 409, headers: limitHeaders },
      );
    }
  }
  let domainOwnerQuery = admin.from("widget_clients").select("id").eq("canonical_domain", canonicalDomain).neq("status", "cancelled");
  if (existing.data?.id) domainOwnerQuery = domainOwnerQuery.neq("id", existing.data.id);
  const domainOwner = await domainOwnerQuery.limit(1).maybeSingle();
  if (domainOwner.error) return NextResponse.json({ error: "Domain availability could not be verified." }, { status: 503, headers: limitHeaders });
  if (domainOwner.data) return NextResponse.json({ error: "This website domain is already linked to a widget subscription." }, { status: 409, headers: limitHeaders });
  const checkoutExpiresAt = Math.floor(Date.now() / 1000) + widgetCheckoutLifetimeSeconds;
  const pendingExpiry = new Date(checkoutExpiresAt * 1000);
  const proposedClaimToken = randomUUID();
  const claimResult = await admin.rpc("claim_widget_checkout_attempt", {
    p_existing_client_id: existing.data?.id ?? null,
    p_user_id: actor.userId,
    p_email: email,
    p_canonical_domain: canonicalDomain,
    p_company_name: parsed.data.companyName,
    p_website_domain: domain,
    p_plan: "starter",
    p_monthly_price: settings.monthly_price,
    p_currency: settings.currency,
    p_default_language: language,
    p_allowed_languages: settings.enabled_languages,
    p_monthly_usage_limit: settings.default_monthly_usage_limit,
    p_claim_token: proposedClaimToken,
    p_checkout_pending_until: pendingExpiry.toISOString(),
  }).maybeSingle();
  if (claimResult.error) {
    return NextResponse.json(
      { error: "Widget checkout state could not be claimed." },
      { status: 503, headers: limitHeaders },
    );
  }
  if (!claimResult.data) {
    return NextResponse.json(
      { error: "Widget checkout is already being prepared or the domain allocation changed." },
      { status: 409, headers: limitHeaders },
    );
  }

  const claim = claimResult.data as ClaimedWidgetCheckout;
  const claimExpiresAt = Math.floor(Date.parse(claim.claim_expires_at) / 1000);
  const monthlyPrice = Number(claim.checkout_monthly_price);
  if (
    !uuidPattern.test(claim.client_id) ||
    !uuidPattern.test(claim.claim_token) ||
    claim.checkout_canonical_domain !== canonicalDomain ||
    !widgetCheckoutActorMatchesEmail(actor, claim.checkout_email) ||
    claim.checkout_plan !== "starter" ||
    !Number.isFinite(claimExpiresAt) ||
    claimExpiresAt <= Math.floor(Date.now() / 1000) ||
    !Number.isFinite(monthlyPrice) ||
    monthlyPrice < 0 ||
    !/^[a-z]{3}$/.test(claim.checkout_currency)
  ) {
    return NextResponse.json({ error: "Widget checkout claim could not be verified." }, { status: 503, headers: limitHeaders });
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://file.mgautotech.de").replace(/\/$/, "");
  const widgetMetadata = {
    product: "vehicle_widget",
    widget_client_id: claim.client_id,
    company_name: claim.checkout_company_name,
    email: claim.checkout_email,
    website_domain: claim.checkout_website_domain,
    allowed_domain: claim.checkout_canonical_domain,
    plan: claim.checkout_plan,
    authenticated_user_id: actor.userId,
  };
  let createdSessionId: string | null = null;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      expires_at: claimExpiresAt,
      payment_method_types: ["card"],
      customer_email: claim.checkout_email,
      line_items: [{
        price_data: {
          currency: claim.checkout_currency,
          recurring: { interval: "month" },
          product_data: {
            name: "MG AutoTech Vehicle Selector Widget",
            description: "Hosted vehicle lookup widget for one website domain, including 12 languages and automatic database updates.",
          },
          unit_amount: Math.round(monthlyPrice * 100),
        },
        quantity: 1,
      }],
      success_url: `${siteUrl}/dashboard/widget?checkout=success`,
      cancel_url: `${siteUrl}/widget?checkout=cancelled`,
      allow_promotion_codes: true,
      subscription_data: { metadata: widgetMetadata },
      metadata: widgetMetadata,
    }, {
      idempotencyKey: `widget-checkout:${claim.claim_token}`,
    });
    createdSessionId = session.id;
    if (
      !stripeCheckoutSessionIdPattern.test(session.id) ||
      session.expires_at !== claimExpiresAt ||
      session.status !== "open" ||
      !session.url ||
      !checkoutSessionBelongsToClient(session, { id: claim.client_id, user_id: actor.userId })
    ) {
      throw new Error("Widget checkout provider state could not be verified.");
    }
    const bound = await admin.rpc("bind_widget_checkout_session", {
      p_client_id: claim.client_id,
      p_user_id: actor.userId,
      p_claim_token: claim.claim_token,
      p_stripe_checkout_session_id: session.id,
      p_session_expires_at: new Date(session.expires_at * 1000).toISOString(),
    });
    if (bound.error || !["bound", "already_bound"].includes(bound.data)) {
      throw new Error("Widget checkout binding could not be saved.");
    }
    if (bound.data === "bound") {
      await admin.from("widget_audit_logs").insert({
        actor_user_id: actor.userId,
        client_id: claim.client_id,
        action: "checkout.created",
        details: { stripe_session_id: session.id, domain: claim.checkout_canonical_domain },
      });
    }
    return NextResponse.json({ url: session.url }, { headers: limitHeaders });
  } catch {
    if (createdSessionId) {
      const checkoutWasRetired = await safelyExpireCheckout({
        id: claim.client_id,
        user_id: actor.userId,
        status: "pending",
        stripe_checkout_session_id: createdSessionId,
        checkout_pending_until: claim.claim_expires_at,
        checkout_claim_token: claim.claim_token,
        checkout_claimed_at: null,
      });
      if (checkoutWasRetired) {
        await admin.rpc("release_widget_checkout_attempt", {
          p_client_id: claim.client_id,
          p_user_id: actor.userId,
          p_claim_token: claim.claim_token,
          p_expired_stripe_checkout_session_id: createdSessionId,
        });
      }
    }
    return NextResponse.json({ error: "Widget checkout could not be started. Please try again." }, { status: 503, headers: limitHeaders });
  }
}
