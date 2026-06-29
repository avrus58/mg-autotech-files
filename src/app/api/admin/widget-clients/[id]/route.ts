import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { sendWidgetLifecycleEmail } from "@/lib/email";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createWidgetPublicKey } from "@/lib/widget/keys";
import { normalizeDomainInput } from "@/lib/widget/domain";
import { sanitizeWidgetLanguages } from "@/lib/widget/types";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const updateSchema = z.object({
  company_name: z.string().trim().min(2).max(120).optional(), email: z.string().email().max(250).optional(),
  website_domain: z.string().max(253).optional(), allowed_domain: z.string().max(253).optional(),
  allow_www_alias: z.boolean().optional(), allow_subdomains: z.boolean().optional(), domain_verified: z.boolean().optional(),
  status: z.enum(["pending", "active", "past_due", "suspended", "cancelled"]).optional(), widget_enabled: z.boolean().optional(),
  plan: z.enum(["starter", "pro", "white_label"]).optional(), monthly_price: z.number().min(0).max(10000).optional(), currency: z.string().regex(/^[a-zA-Z]{3}$/).optional(),
  widget_title: z.string().min(2).max(80).optional(), button_text: z.string().min(2).max(80).optional(),
  enquiry_email: z.union([z.string().email(), z.literal(""), z.null()]).optional(), whatsapp_number: z.union([z.string().max(30), z.null()]).optional(),
  main_color: hex.optional(), button_text_color: hex.optional(), difference_color: hex.optional(), theme_mode: z.enum(["light", "dark", "auto"]).optional(),
  default_language: z.string().max(5).optional(), allowed_languages: z.array(z.string().max(5)).min(1).max(12).optional(), show_branding: z.boolean().optional(),
  allow_script_embed: z.boolean().optional(), allow_iframe_embed: z.boolean().optional(), can_edit_colours: z.boolean().optional(), can_edit_language: z.boolean().optional(), can_edit_contact: z.boolean().optional(), can_hide_branding: z.boolean().optional(), monthly_usage_limit: z.number().int().min(0).max(10000000).optional(),
});
const actionSchema = z.object({ action: z.enum(["activate", "suspend", "cancel", "regenerate_key", "revoke_key", "approve_domain", "reject_domain"]), requestId: z.string().uuid().optional(), adminNote: z.string().max(500).optional() });

async function loadClient(id: string) {
  return getSupabaseAdmin().from("widget_clients").select("*").eq("id", id).maybeSingle();
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffPermission(request, "widget.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  const admin = getSupabaseAdmin();
  const client = await loadClient(id);
  if (!client.data) return NextResponse.json({ error: "Widget client not found." }, { status: 404 });
  const [keys, logs, requests, audit] = await Promise.all([
    admin.from("widget_api_keys").select("*").eq("client_id", id).order("created_at", { ascending: false }),
    admin.from("widget_access_logs").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(200),
    admin.from("widget_domain_change_requests").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(50),
    admin.from("widget_audit_logs").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(100),
  ]);
  return NextResponse.json({ client: client.data, keys: keys.data ?? [], logs: logs.data ?? [], domainRequests: requests.data ?? [], auditLogs: audit.data ?? [] });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffPermission(request, "widget.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid client settings." }, { status: 400 });
  const { id } = await context.params;
  const update: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.allowed_domain) update.allowed_domain = normalizeDomainInput(parsed.data.allowed_domain);
  if (parsed.data.website_domain) update.website_domain = normalizeDomainInput(parsed.data.website_domain);
  if (parsed.data.allowed_languages) update.allowed_languages = sanitizeWidgetLanguages(parsed.data.allowed_languages);
  if (parsed.data.currency) update.currency = parsed.data.currency.toLowerCase();
  if (parsed.data.enquiry_email === "") update.enquiry_email = null;
  const admin = getSupabaseAdmin();
  const saved = await admin.from("widget_clients").update(update).eq("id", id).select("*").single();
  if (saved.error) return NextResponse.json({ error: saved.error.message }, { status: 500 });
  await admin.from("widget_audit_logs").insert({ actor_user_id: auth.user.id, client_id: id, action: "admin.client_updated", details: { fields: Object.keys(update) } });
  return NextResponse.json({ client: saved.data });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffPermission(request, "widget.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid admin action." }, { status: 400 });
  const { id } = await context.params;
  const admin = getSupabaseAdmin();
  const current = await loadClient(id);
  if (!current.data) return NextResponse.json({ error: "Widget client not found." }, { status: 404 });
  let result: unknown = null;

  if (parsed.data.action === "activate") {
    if (current.data.stripe_subscription_id && !["active", "trialing"].includes(current.data.stripe_subscription_status ?? "")) return NextResponse.json({ error: "Stripe subscription must be active before local access can be activated." }, { status: 409 });
    result = (await admin.from("widget_clients").update({ status: "active", admin_suspended: false, widget_enabled: true }).eq("id", id).select("*").single()).data;
  }
  if (parsed.data.action === "suspend") result = (await admin.from("widget_clients").update({ status: "suspended", admin_suspended: true, widget_enabled: false }).eq("id", id).select("*").single()).data;
  if (parsed.data.action === "cancel") result = (await admin.from("widget_clients").update({ status: "cancelled", widget_enabled: false }).eq("id", id).select("*").single()).data;
  if (parsed.data.action === "revoke_key" || parsed.data.action === "regenerate_key") {
    await admin.from("widget_api_keys").update({ is_active: false, revoked_at: new Date().toISOString() }).eq("client_id", id).eq("is_active", true);
    if (parsed.data.action === "regenerate_key") {
      const key = createWidgetPublicKey();
      await admin.from("widget_api_keys").insert({ client_id: id, public_key: key });
      result = { publicKey: key };
      await sendWidgetLifecycleEmail({ customerEmail: current.data.email, companyName: current.data.company_name, event: "key_changed" });
    }
  }
  if (parsed.data.action === "approve_domain" || parsed.data.action === "reject_domain") {
    if (!parsed.data.requestId) return NextResponse.json({ error: "Domain request ID is required." }, { status: 400 });
    const domainRequest = await admin.from("widget_domain_change_requests").select("*").eq("id", parsed.data.requestId).eq("client_id", id).eq("status", "pending").maybeSingle();
    if (!domainRequest.data) return NextResponse.json({ error: "Pending domain request not found." }, { status: 404 });
    const approved = parsed.data.action === "approve_domain";
    await admin.from("widget_domain_change_requests").update({ status: approved ? "approved" : "rejected", admin_note: parsed.data.adminNote ?? null, resolved_at: new Date().toISOString() }).eq("id", parsed.data.requestId);
    if (approved) {
      await admin.from("widget_clients").update({ allowed_domain: domainRequest.data.requested_domain, website_domain: domainRequest.data.requested_domain, domain_verified: true }).eq("id", id);
      await sendWidgetLifecycleEmail({ customerEmail: current.data.email, companyName: current.data.company_name, event: "domain_approved", detail: domainRequest.data.requested_domain });
    }
    else await sendWidgetLifecycleEmail({ customerEmail: current.data.email, companyName: current.data.company_name, event: "domain_rejected", detail: parsed.data.adminNote });
    result = { approved };
  }
  await admin.from("widget_audit_logs").insert({ actor_user_id: auth.user.id, client_id: id, action: `admin.${parsed.data.action}`, details: { request_id: parsed.data.requestId, note: parsed.data.adminNote } });
  return NextResponse.json({ ok: true, result });
}
