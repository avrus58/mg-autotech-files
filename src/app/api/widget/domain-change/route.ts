import { NextResponse } from "next/server";
import { z } from "zod";
import { checkAdaptiveRateLimit, rateLimitResponseHeaders } from "@/lib/abuseProtection";
import { requireApiUser } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { canonicalWidgetDomain } from "@/lib/widget/domain";
import { validatePublicWidgetDomain, widgetAbuseSubject } from "@/lib/widget/security";

const schema = z.object({ domain: z.string().trim().min(3).max(253) });

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid domain." }, { status: 400 });
  const validation = validatePublicWidgetDomain(parsed.data.domain);
  if (!validation.valid) return NextResponse.json({ error: validation.reason }, { status: 400 });
  const domain = validation.domain;
  const canonicalDomain = canonicalWidgetDomain(domain);
  const rateLimit = await checkAdaptiveRateLimit({
    request,
    scope: "widget-domain-change",
    limit: 6,
    windowMs: 60 * 60 * 1000,
    suffix: widgetAbuseSubject(auth.user.id, domain),
  });
  const limitHeaders = rateLimitResponseHeaders({ result: rateLimit, limit: 6, windowMs: 60 * 60 * 1000, blocked: !rateLimit.allowed });
  if (!rateLimit.allowed) return NextResponse.json({ error: "Too many domain change attempts. Please try again later." }, { status: 429, headers: limitHeaders });
  const admin = getSupabaseAdmin();
  const client = await admin.from("widget_clients").select("id, allowed_domain, canonical_domain").eq("user_id", auth.user.id).limit(1).maybeSingle();
  if (client.error) return NextResponse.json({ error: "Widget subscription state could not be verified." }, { status: 503, headers: limitHeaders });
  if (!client.data) return NextResponse.json({ error: "Widget subscription not found." }, { status: 404 });
  if (canonicalDomain === client.data.canonical_domain) return NextResponse.json({ error: "This is already the active widget domain." }, { status: 409, headers: limitHeaders });
  const conflict = await admin.from("widget_clients").select("id").eq("canonical_domain", canonicalDomain).neq("id", client.data.id).neq("status", "cancelled").limit(1).maybeSingle();
  if (conflict.error) return NextResponse.json({ error: "Domain availability could not be verified." }, { status: 503, headers: limitHeaders });
  if (conflict.data) return NextResponse.json({ error: "This domain is already linked to another widget subscription." }, { status: 409, headers: limitHeaders });
  const existing = await admin.from("widget_domain_change_requests").select("id").eq("client_id", client.data.id).eq("status", "pending").maybeSingle();
  if (existing.error) return NextResponse.json({ error: "Pending domain requests could not be verified." }, { status: 503, headers: limitHeaders });
  if (existing.data) return NextResponse.json({ error: "A domain change request is already pending." }, { status: 409 });
  const created = await admin.from("widget_domain_change_requests").insert({ client_id: client.data.id, old_domain: client.data.allowed_domain, requested_domain: domain }).select("id, requested_domain, status, created_at, resolved_at").single();
  if (created.error) return NextResponse.json({ error: "Domain change request could not be created." }, { status: 500, headers: limitHeaders });
  await admin.from("widget_audit_logs").insert({ actor_user_id: auth.user.id, client_id: client.data.id, action: "customer.domain_change_requested", details: { old_domain: client.data.allowed_domain, requested_domain: domain } });
  return NextResponse.json({ request: created.data }, { headers: limitHeaders });
}
