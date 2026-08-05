import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { sendWidgetLifecycleEmail } from "@/lib/email";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  customerSafeAdminClient,
  loadAdminWidgetClients,
  WIDGET_ADMIN_CLIENT_FIELDS,
} from "@/lib/widget/adminData";
import { createWidgetPublicKey } from "@/lib/widget/keys";
import { validatePublicWidgetDomain } from "@/lib/widget/security";
import { sanitizeWidgetLanguages, widgetLanguageCodes, type WidgetClient } from "@/lib/widget/types";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const updateSchema = z.object({
  company_name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().max(250).optional(),
  allow_www_alias: z.boolean().optional(),
  allow_subdomains: z.boolean().optional(),
  widget_enabled: z.boolean().optional(),
  plan: z.enum(["starter", "pro", "white_label"]).optional(),
  monthly_price: z.number().min(0).max(10000).optional(),
  currency: z.string().regex(/^[a-zA-Z]{3}$/).optional(),
  widget_title: z.string().trim().min(2).max(80).optional(),
  button_text: z.string().trim().min(2).max(80).optional(),
  enquiry_email: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
  whatsapp_number: z.union([z.string().trim().max(30), z.literal(""), z.null()]).optional(),
  email_enquiries_enabled: z.boolean().optional(),
  whatsapp_enquiries_enabled: z.boolean().optional(),
  main_color: hex.optional(),
  button_text_color: hex.optional(),
  difference_color: hex.optional(),
  theme_mode: z.enum(["light", "dark", "auto"]).optional(),
  default_language: z.enum(widgetLanguageCodes).optional(),
  allowed_languages: z.array(z.enum(widgetLanguageCodes)).min(1).max(12).optional(),
  show_branding: z.boolean().optional(),
  allow_script_embed: z.boolean().optional(),
  allow_iframe_embed: z.boolean().optional(),
  can_edit_colours: z.boolean().optional(),
  can_edit_language: z.boolean().optional(),
  can_edit_contact: z.boolean().optional(),
  can_hide_branding: z.boolean().optional(),
  monthly_usage_limit: z.number().int().min(0).max(10_000_000).optional(),
});

const actionsRequiringReason = new Set(["suspend", "cancel", "regenerate_key", "revoke_key", "replace_domain", "reject_domain"]);
const actionSchema = z.object({
  action: z.enum(["activate", "suspend", "cancel", "regenerate_key", "revoke_key", "approve_domain", "reject_domain", "replace_domain"]),
  requestId: z.string().uuid().optional(),
  adminNote: z.string().trim().max(500).optional(),
  domain: z.string().trim().max(253).optional(),
}).superRefine((value, context) => {
  if (actionsRequiringReason.has(value.action) && (value.adminNote?.length ?? 0) < 3) {
    context.addIssue({ code: "custom", path: ["adminNote"], message: "An audit reason is required." });
  }
  if (value.action === "replace_domain" && !value.domain) {
    context.addIssue({ code: "custom", path: ["domain"], message: "A replacement domain is required." });
  }
});

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

async function loadClient(id: string): Promise<{
  data: WidgetClient | null;
  error: { message: string } | null;
}> {
  const result = await getSupabaseAdmin()
    .from("widget_clients")
    .select(WIDGET_ADMIN_CLIENT_FIELDS)
    .eq("id", id)
    .maybeSingle();
  return {
    data: result.data as unknown as WidgetClient | null,
    error: result.error,
  };
}

function sanitizeAuditDetails(details: unknown) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return {};
  const blocked = /(stripe|secret|token|public_key|ip_hash|user_agent|session)/i;
  return Object.fromEntries(
    Object.entries(details as Record<string, unknown>)
      .filter(([key]) => !blocked.test(key))
      .slice(0, 20),
  );
}

async function findDomainConflict(domain: string, clientId: string) {
  const result = await getSupabaseAdmin()
    .from("widget_clients")
    .select("id, company_name")
    .eq("allowed_domain", domain)
    .neq("id", clientId)
    .neq("status", "cancelled")
    .limit(1)
    .maybeSingle();
  return { data: result.data, error: result.error };
}

async function writeAudit(input: {
  actorId: string;
  clientId: string;
  action: string;
  details?: Record<string, unknown>;
}) {
  const result = await getSupabaseAdmin().from("widget_audit_logs").insert({
    actor_user_id: input.actorId,
    client_id: input.clientId,
    action: input.action,
    details: input.details ?? {},
  });
  if (result.error) throw result.error;
}

async function writeAuditSafely(input: Parameters<typeof writeAudit>[0]) {
  try {
    await writeAudit(input);
    return null;
  } catch {
    return "The operation succeeded and the database lifecycle audit was recorded, but the actor annotation could not be added.";
  }
}

async function sendLifecycleEmailSafely(input: Parameters<typeof sendWidgetLifecycleEmail>[0]) {
  try {
    await sendWidgetLifecycleEmail(input);
    return null;
  } catch {
    return "The operation succeeded, but the lifecycle email could not be queued.";
  }
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffPermission(request, "widget.manage");
  if (!auth.ok) return privateJson({ error: auth.error }, auth.status);
  const { id } = await context.params;
  const admin = getSupabaseAdmin();
  const client = await loadClient(id);
  if (client.error) return privateJson({ error: "Widget client could not be loaded." }, 500);
  if (!client.data) return privateJson({ error: "Widget client not found." }, 404);

  const [keys, logs, requests, audit, enquiries, listPayload] = await Promise.all([
    admin.from("widget_api_keys").select("id, public_key, is_active, created_at, revoked_at").eq("client_id", id).order("created_at", { ascending: false }).limit(20),
    admin.from("widget_access_logs").select("id, request_domain, path, language, status, block_reason, created_at").eq("client_id", id).order("created_at", { ascending: false }).limit(200),
    admin.from("widget_domain_change_requests").select("id, old_domain, requested_domain, status, admin_note, created_at, resolved_at").eq("client_id", id).order("created_at", { ascending: false }).limit(50),
    admin.from("widget_audit_logs").select("id, action, details, created_at").eq("client_id", id).order("created_at", { ascending: false }).limit(100),
    admin.from("widget_enquiries").select("id, vehicle_name, stage, selected_services, visitor_name, visitor_email, visitor_phone, visitor_location, vehicle_registration, message, status, created_at").eq("client_id", id).order("created_at", { ascending: false }).limit(50),
    loadAdminWidgetClients(),
  ]);
  if ([keys, logs, requests, audit, enquiries].some((result) => result.error)) {
    return privateJson({ error: "Widget client operations data could not be loaded." }, 500);
  }

  const commercialClient = listPayload.clients.find((item) => item.id === id);
  return privateJson({
    client: customerSafeAdminClient(client.data as unknown as Record<string, unknown>),
    commercial: commercialClient?.commercial ?? null,
    metrics: commercialClient?.metrics ?? null,
    keys: keys.data ?? [],
    logs: logs.data ?? [],
    domainRequests: requests.data ?? [],
    enquiries: enquiries.data ?? [],
    auditLogs: (audit.data ?? []).map((entry) => ({
      ...entry,
      details: sanitizeAuditDetails(entry.details),
    })),
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffPermission(request, "widget.manage");
  if (!auth.ok) return privateJson({ error: auth.error }, auth.status);
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateJson({ error: "Invalid client settings." }, 400);
  const { id } = await context.params;
  const current = await loadClient(id);
  if (current.error) return privateJson({ error: "Widget client could not be loaded." }, 500);
  if (!current.data) return privateJson({ error: "Widget client not found." }, 404);

  const update: Record<string, unknown> = { ...parsed.data };
  const commercialFields = ["plan", "monthly_price", "currency"];
  if (current.data.stripe_subscription_id && commercialFields.some((field) => field in update)) {
    return privateJson({ error: "Stripe-backed plan and price values are read-only. Manage the subscription in Stripe." }, 409);
  }
  const nextLanguages = parsed.data.allowed_languages
    ? sanitizeWidgetLanguages(parsed.data.allowed_languages)
    : current.data.allowed_languages;
  const nextDefaultLanguage = parsed.data.default_language ?? current.data.default_language;
  if (!nextLanguages.includes(nextDefaultLanguage)) {
    return privateJson({ error: "The default language must remain inside the client language allowlist." }, 400);
  }
  if (parsed.data.allowed_languages) update.allowed_languages = nextLanguages;
  if (parsed.data.currency) update.currency = parsed.data.currency.toLowerCase();
  if (parsed.data.email !== undefined) update.email = parsed.data.email.toLowerCase();
  if (parsed.data.enquiry_email === "") update.enquiry_email = null;
  if (parsed.data.whatsapp_number === "") update.whatsapp_number = null;
  const nextEnquiryEmail = parsed.data.enquiry_email !== undefined
    ? parsed.data.enquiry_email || null
    : current.data.enquiry_email;
  const nextWhatsAppNumber = parsed.data.whatsapp_number !== undefined
    ? parsed.data.whatsapp_number || null
    : current.data.whatsapp_number;
  const nextEmailEnabled = parsed.data.email_enquiries_enabled ?? current.data.email_enquiries_enabled;
  const nextWhatsAppEnabled = parsed.data.whatsapp_enquiries_enabled ?? current.data.whatsapp_enquiries_enabled;
  if (nextEmailEnabled && !nextEnquiryEmail) {
    return privateJson({ error: "An enquiry email is required before email leads can be enabled." }, 400);
  }
  if (nextWhatsAppEnabled && !nextWhatsAppNumber) {
    return privateJson({ error: "A WhatsApp number is required before WhatsApp leads can be enabled." }, 400);
  }
  if (!Object.keys(update).length) return privateJson({ error: "No client settings were provided." }, 400);

  const admin = getSupabaseAdmin();
  const saved = await admin.from("widget_clients").update(update).eq("id", id).select(WIDGET_ADMIN_CLIENT_FIELDS).single();
  if (saved.error) return privateJson({ error: "Widget client settings could not be saved." }, 500);
  const auditWarning = await writeAuditSafely({ actorId: auth.user.id, clientId: id, action: "admin.client_updated", details: { fields: Object.keys(update) } });
  return privateJson({ client: customerSafeAdminClient(saved.data as unknown as Record<string, unknown>), warning: auditWarning });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffPermission(request, "widget.manage");
  if (!auth.ok) return privateJson({ error: auth.error }, auth.status);
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateJson({ error: parsed.error.issues[0]?.message ?? "Invalid admin action." }, 400);
  const { id } = await context.params;
  const admin = getSupabaseAdmin();
  const current = await loadClient(id);
  if (current.error) return privateJson({ error: "Widget client could not be loaded." }, 500);
  if (!current.data) return privateJson({ error: "Widget client not found." }, 404);
  const client = current.data;
  let result: Record<string, unknown> = {};
  let emailWarning: string | null = null;

  if (parsed.data.action === "activate") {
    if (client.stripe_subscription_id && !["active", "trialing"].includes((client.stripe_subscription_status ?? "").toLowerCase())) {
      return privateJson({ error: "Stripe subscription must be active before local access can be activated." }, 409);
    }
    const activeKey = await admin.from("widget_api_keys").select("id").eq("client_id", id).eq("is_active", true).limit(1).maybeSingle();
    if (activeKey.error) return privateJson({ error: "Installation key state could not be verified." }, 500);
    if (!activeKey.data) {
      const createdKey = await admin.from("widget_api_keys").insert({ client_id: id, public_key: createWidgetPublicKey() }).select("id").single();
      if (createdKey.error) return privateJson({ error: "An installation key could not be issued." }, 500);
    }
    const saved = await admin.from("widget_clients").update({ status: "active", admin_suspended: false, widget_enabled: true }).eq("id", id).select("id").single();
    if (saved.error) return privateJson({ error: "Widget access could not be activated." }, 500);
  }

  if (parsed.data.action === "suspend") {
    const saved = await admin.from("widget_clients").update({ status: "suspended", admin_suspended: true, widget_enabled: false }).eq("id", id).select("id").single();
    if (saved.error) return privateJson({ error: "Widget access could not be suspended." }, 500);
  }

  if (parsed.data.action === "cancel") {
    if (client.stripe_subscription_id) {
      return privateJson({ error: "A Stripe-backed subscription cannot be cancelled locally. Use Stripe billing controls so access and billing stay consistent." }, 409);
    }
    const saved = await admin.from("widget_clients").update({ status: "cancelled", widget_enabled: false }).eq("id", id).select("id").single();
    if (saved.error) return privateJson({ error: "Manual widget access could not be closed." }, 500);
    emailWarning = await sendLifecycleEmailSafely({ customerEmail: client.email, companyName: client.company_name, event: "cancelled" });
  }

  if (parsed.data.action === "revoke_key") {
    const revoked = await admin.from("widget_api_keys").update({ is_active: false, revoked_at: new Date().toISOString() }).eq("client_id", id).eq("is_active", true).select("id");
    if (revoked.error) return privateJson({ error: "The active installation key could not be revoked." }, 500);
    if (!revoked.data?.length) return privateJson({ error: "No active installation key was found." }, 409);
    result = { revokedKeyCount: revoked.data.length };
  }

  if (parsed.data.action === "regenerate_key") {
    const publicKey = createWidgetPublicKey();
    const rotated = await admin.rpc("widget_rotate_installation_key", { p_client_id: id, p_public_key: publicKey });
    if (rotated.error || !rotated.data?.length) return privateJson({ error: "The installation key could not be rotated atomically." }, 500);
    result = { publicKey };
    emailWarning = await sendLifecycleEmailSafely({ customerEmail: client.email, companyName: client.company_name, event: "key_changed" });
  }

  if (["approve_domain", "reject_domain"].includes(parsed.data.action)) {
    if (!parsed.data.requestId) return privateJson({ error: "Domain request ID is required." }, 400);
    const domainRequest = await admin.from("widget_domain_change_requests").select("id, client_id, old_domain, requested_domain, status, created_at").eq("id", parsed.data.requestId).eq("client_id", id).eq("status", "pending").maybeSingle();
    if (domainRequest.error) return privateJson({ error: "Domain request could not be loaded." }, 500);
    if (!domainRequest.data) return privateJson({ error: "Pending domain request not found." }, 404);
    const approved = parsed.data.action === "approve_domain";
    const validated = validatePublicWidgetDomain(domainRequest.data.requested_domain);
    if (approved && !validated.valid) return privateJson({ error: validated.reason }, 400);
    if (approved) {
      const conflict = await findDomainConflict(validated.domain, id);
      if (conflict.error) return privateJson({ error: "Domain availability could not be verified." }, 503);
      if (conflict.data) return privateJson({ error: `This domain is already assigned to ${conflict.data.company_name}.` }, 409);
    }
    const resolved = await admin.rpc("widget_resolve_domain_request", {
      p_client_id: id,
      p_request_id: parsed.data.requestId,
      p_approved: approved,
      p_admin_note: parsed.data.adminNote ?? null,
      p_resolved_domain: approved ? validated.domain : null,
    });
    if (resolved.error || !resolved.data?.length) return privateJson({ error: "The domain request could not be resolved atomically." }, 500);
    emailWarning = approved
      ? await sendLifecycleEmailSafely({ customerEmail: client.email, companyName: client.company_name, event: "domain_approved", detail: validated.domain })
      : await sendLifecycleEmailSafely({ customerEmail: client.email, companyName: client.company_name, event: "domain_rejected", detail: parsed.data.adminNote });
    result = { approved };
  }

  if (parsed.data.action === "replace_domain") {
    const validated = validatePublicWidgetDomain(parsed.data.domain ?? "");
    if (!validated.valid) return privateJson({ error: validated.reason }, 400);
    const conflict = await findDomainConflict(validated.domain, id);
    if (conflict.error) return privateJson({ error: "Domain availability could not be verified." }, 503);
    if (conflict.data) return privateJson({ error: `This domain is already assigned to ${conflict.data.company_name}.` }, 409);
    const saved = await admin.from("widget_clients").update({ allowed_domain: validated.domain, website_domain: validated.domain, domain_verified: false }).eq("id", id).select("id").single();
    if (saved.error) return privateJson({ error: "The domain could not be replaced." }, 500);
    result = { domain: validated.domain };
  }

  const auditWarning = await writeAuditSafely({
    actorId: auth.user.id,
    clientId: id,
    action: `admin.${parsed.data.action}`,
    details: {
      request_id: parsed.data.requestId,
      reason: parsed.data.adminNote,
      domain: parsed.data.action === "replace_domain" ? result.domain : undefined,
    },
  });
  const warning = [emailWarning, auditWarning].filter(Boolean).join(" ") || null;
  return privateJson({ ok: true, result, warning });
}
