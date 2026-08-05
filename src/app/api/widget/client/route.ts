import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getWidgetSettings } from "@/lib/widget/settings";
import { WIDGET_CUSTOMER_CLIENT_FIELDS } from "@/lib/widget/customerTypes";
import { sanitizeWidgetLanguages, widgetLanguageCodes, type WidgetClient } from "@/lib/widget/types";

function customerSafeClient(row: Record<string, unknown>) {
  const safeFields = WIDGET_CUSTOMER_CLIENT_FIELDS.split(", ");
  const safe = Object.fromEntries(safeFields.map((field) => [field, row[field]]));
  return {
    ...safe,
    billing_profile_linked: Boolean(row.stripe_customer_id || row.stripe_subscription_id),
    subscription_linked: Boolean(row.stripe_subscription_id),
  };
}

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const updateSchema = z.object({
  widget_title: z.string().trim().min(2).max(80).optional(),
  button_text: z.string().trim().min(2).max(80).optional(),
  main_color: hex.optional(),
  button_text_color: hex.optional(),
  difference_color: hex.optional(),
  theme_mode: z.enum(["light", "dark", "auto"]).optional(),
  default_language: z.enum(widgetLanguageCodes).optional(),
  allowed_languages: z.array(z.enum(widgetLanguageCodes)).min(1).max(12).optional(),
  enquiry_email: z.union([z.string().email(), z.literal("")]).optional(),
  whatsapp_number: z.string().trim().max(30).optional(),
  email_enquiries_enabled: z.boolean().optional(),
  whatsapp_enquiries_enabled: z.boolean().optional(),
  show_branding: z.boolean().optional(),
});

async function ownedClient(userId: string, email?: string | null): Promise<{
  data: WidgetClient | null;
  error: { message: string } | null;
}> {
  const admin = getSupabaseAdmin();
  const privateFields = `${WIDGET_CUSTOMER_CLIENT_FIELDS}, stripe_customer_id, stripe_subscription_id, user_id, admin_suspended`;
  let query = await admin.from("widget_clients").select(privateFields).eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  let result = { data: query.data as unknown as WidgetClient | null, error: query.error };
  if (result.error) return result;
  if (result.data || !email) return result;

  const claim = await admin
    .from("widget_clients")
    .select("id")
    .is("user_id", null)
    .eq("email", email.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (claim.error) return { data: null, error: claim.error };
  if (claim.data) {
    const claimed = await admin.from("widget_clients").update({ user_id: userId }).eq("id", claim.data.id).is("user_id", null).select("id").maybeSingle();
    if (claimed.error) return { data: null, error: claimed.error };
    if (!claimed.data) {
      return { data: null, error: { message: "Widget ownership changed while the account was being linked." } };
    }
    query = await admin.from("widget_clients").select(privateFields).eq("id", claim.data.id).maybeSingle();
    result = { data: query.data as unknown as WidgetClient | null, error: query.error };
  }
  return result;
}

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const settingsResult = await getWidgetSettings();
  if (!settingsResult.databaseReady) return NextResponse.json({ error: "Widget database setup is required.", setupRequired: true }, { status: 503 });
  const result = await ownedClient(auth.user.id, auth.user.email);
  if (result.error) return NextResponse.json({ error: "Widget workspace could not be loaded." }, { status: 500 });
  if (!result.data) return NextResponse.json({ client: null, settings: settingsResult.settings });
  const admin = getSupabaseAdmin();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [keyResult, domainResult, loadCount, lastLoad, enquiryCount, failedEnquiryCount] = await Promise.all([
    admin.from("widget_api_keys").select("public_key, is_active, created_at").eq("client_id", result.data.id).eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("widget_domain_change_requests").select("id, requested_domain, status, created_at, resolved_at").eq("client_id", result.data.id).order("created_at", { ascending: false }).limit(10),
    admin.from("widget_access_logs").select("id", { count: "exact", head: true }).eq("client_id", result.data.id).eq("status", "allowed").in("path", ["/api/widget/config", "/embed/vehicle-selector"]).gte("created_at", monthStart.toISOString()),
    admin.from("widget_access_logs").select("created_at").eq("client_id", result.data.id).eq("status", "allowed").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("widget_enquiries").select("id", { count: "exact", head: true }).eq("client_id", result.data.id).gte("created_at", monthStart.toISOString()),
    admin.from("widget_enquiries").select("id", { count: "exact", head: true }).eq("client_id", result.data.id).eq("status", "delivery_failed").gte("created_at", monthStart.toISOString()),
  ]);
  if ([keyResult, domainResult, loadCount, lastLoad, enquiryCount, failedEnquiryCount].some((query) => query.error)) {
    return NextResponse.json({ error: "Widget workspace activity could not be loaded." }, { status: 503 });
  }
  const client = {
    ...result.data,
    email_enquiries_enabled: result.data.email_enquiries_enabled ?? Boolean(result.data.enquiry_email),
    whatsapp_enquiries_enabled: result.data.whatsapp_enquiries_enabled ?? Boolean(result.data.whatsapp_number),
  };
  return NextResponse.json({
    client: customerSafeClient(client),
    publicKey: keyResult.data?.public_key ?? null,
    domainRequests: domainResult.data ?? [],
    workspace: {
      loads_this_month: loadCount.count ?? 0,
      enquiries_this_month: enquiryCount.count ?? 0,
      failed_enquiries_this_month: failedEnquiryCount.count ?? 0,
      last_live_load_at: lastLoad.data?.created_at ?? null,
    },
    settings: settingsResult.settings,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid widget settings." }, { status: 400 });
  const result = await ownedClient(auth.user.id, auth.user.email);
  if (result.error) return NextResponse.json({ error: "Widget workspace could not be loaded." }, { status: 500 });
  if (!result.data) return NextResponse.json({ error: "Widget subscription not found." }, { status: 404 });
  const client = result.data;
  const update: Record<string, unknown> = {};
  if (client.can_edit_colours) for (const key of ["main_color", "button_text_color", "difference_color", "theme_mode", "widget_title", "button_text"] as const) if (parsed.data[key] !== undefined) update[key] = parsed.data[key];
  if (client.can_edit_language) {
    const nextLanguages = parsed.data.allowed_languages
      ? sanitizeWidgetLanguages(parsed.data.allowed_languages)
      : client.allowed_languages;
    const nextDefaultLanguage = parsed.data.default_language ?? client.default_language;
    if (!nextLanguages.includes(nextDefaultLanguage)) {
      return NextResponse.json({ error: "The default language must remain enabled." }, { status: 400 });
    }
    if (parsed.data.default_language) update.default_language = parsed.data.default_language;
    if (parsed.data.allowed_languages) update.allowed_languages = nextLanguages;
  }
  if (client.can_edit_contact) {
    const nextEnquiryEmail = parsed.data.enquiry_email !== undefined
      ? parsed.data.enquiry_email || null
      : client.enquiry_email;
    const nextWhatsAppNumber = parsed.data.whatsapp_number !== undefined
      ? parsed.data.whatsapp_number || null
      : client.whatsapp_number;
    const nextEmailEnabled = parsed.data.email_enquiries_enabled ?? client.email_enquiries_enabled;
    const nextWhatsAppEnabled = parsed.data.whatsapp_enquiries_enabled ?? client.whatsapp_enquiries_enabled;
    if (nextEmailEnabled && !nextEnquiryEmail) {
      return NextResponse.json({ error: "Add an enquiry email before enabling email leads." }, { status: 400 });
    }
    if (nextWhatsAppEnabled && !nextWhatsAppNumber) {
      return NextResponse.json({ error: "Add a WhatsApp number before enabling WhatsApp leads." }, { status: 400 });
    }
    if (parsed.data.enquiry_email !== undefined) update.enquiry_email = parsed.data.enquiry_email || null;
    if (parsed.data.whatsapp_number !== undefined) update.whatsapp_number = parsed.data.whatsapp_number || null;
    if (parsed.data.email_enquiries_enabled !== undefined) update.email_enquiries_enabled = parsed.data.email_enquiries_enabled;
    if (parsed.data.whatsapp_enquiries_enabled !== undefined) update.whatsapp_enquiries_enabled = parsed.data.whatsapp_enquiries_enabled;
  }
  if (client.can_hide_branding && parsed.data.show_branding !== undefined) update.show_branding = parsed.data.show_branding;
  if (!Object.keys(update).length) return NextResponse.json({ error: "No permitted widget settings were provided." }, { status: 400 });
  const admin = getSupabaseAdmin();
  const saved = await admin.from("widget_clients").update(update).eq("id", client.id).eq("user_id", auth.user.id).select(`${WIDGET_CUSTOMER_CLIENT_FIELDS}, stripe_customer_id, stripe_subscription_id`).single();
  if (saved.error) return NextResponse.json({ error: "Widget settings could not be saved." }, { status: 500 });
  await admin.from("widget_audit_logs").insert({ actor_user_id: auth.user.id, client_id: client.id, action: "customer.settings_updated", details: { fields: Object.keys(update) } });
  return NextResponse.json({ client: customerSafeClient(saved.data as unknown as Record<string, unknown>) });
}
