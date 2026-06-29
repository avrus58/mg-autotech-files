import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getWidgetSettings } from "@/lib/widget/settings";
import { sanitizeWidgetLanguages } from "@/lib/widget/types";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const updateSchema = z.object({
  widget_title: z.string().trim().min(2).max(80).optional(),
  button_text: z.string().trim().min(2).max(80).optional(),
  main_color: hex.optional(),
  button_text_color: hex.optional(),
  difference_color: hex.optional(),
  theme_mode: z.enum(["light", "dark", "auto"]).optional(),
  default_language: z.string().max(5).optional(),
  allowed_languages: z.array(z.string().max(5)).min(1).max(12).optional(),
  enquiry_email: z.union([z.string().email(), z.literal("")]).optional(),
  whatsapp_number: z.string().trim().max(30).optional(),
  email_enquiries_enabled: z.boolean().optional(),
  whatsapp_enquiries_enabled: z.boolean().optional(),
  show_branding: z.boolean().optional(),
});

async function ownedClient(userId: string, email?: string | null) {
  const admin = getSupabaseAdmin();
  let result = await admin.from("widget_clients").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (result.data || !email) return result;

  const claim = await admin
    .from("widget_clients")
    .select("id")
    .is("user_id", null)
    .eq("email", email.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (claim.data) {
    await admin.from("widget_clients").update({ user_id: userId }).eq("id", claim.data.id).is("user_id", null);
    result = await admin.from("widget_clients").select("*").eq("id", claim.data.id).maybeSingle();
  }
  return result;
}

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const settingsResult = await getWidgetSettings();
  if (!settingsResult.databaseReady) return NextResponse.json({ error: "Widget database setup is required.", setupRequired: true }, { status: 503 });
  const result = await ownedClient(auth.user.id, auth.user.email);
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  if (!result.data) return NextResponse.json({ client: null, settings: settingsResult.settings });
  const admin = getSupabaseAdmin();
  const [keyResult, domainResult] = await Promise.all([
    admin.from("widget_api_keys").select("public_key, is_active, created_at").eq("client_id", result.data.id).eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("widget_domain_change_requests").select("*").eq("client_id", result.data.id).order("created_at", { ascending: false }).limit(10),
  ]);
  const client = {
    ...result.data,
    email_enquiries_enabled: result.data.email_enquiries_enabled ?? Boolean(result.data.enquiry_email),
    whatsapp_enquiries_enabled: result.data.whatsapp_enquiries_enabled ?? Boolean(result.data.whatsapp_number),
  };
  return NextResponse.json({ client, publicKey: keyResult.data?.public_key ?? null, domainRequests: domainResult.data ?? [], settings: settingsResult.settings });
}

export async function PATCH(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid widget settings." }, { status: 400 });
  const result = await ownedClient(auth.user.id, auth.user.email);
  if (result.error || !result.data) return NextResponse.json({ error: "Widget subscription not found." }, { status: 404 });
  const client = result.data;
  const update: Record<string, unknown> = {};
  if (client.can_edit_colours) for (const key of ["main_color", "button_text_color", "difference_color", "theme_mode", "widget_title", "button_text"] as const) if (parsed.data[key] !== undefined) update[key] = parsed.data[key];
  if (client.can_edit_language) {
    if (parsed.data.default_language) update.default_language = parsed.data.default_language;
    if (parsed.data.allowed_languages) update.allowed_languages = sanitizeWidgetLanguages(parsed.data.allowed_languages);
  }
  if (client.can_edit_contact) {
    if (parsed.data.enquiry_email !== undefined) update.enquiry_email = parsed.data.enquiry_email || null;
    if (parsed.data.whatsapp_number !== undefined) update.whatsapp_number = parsed.data.whatsapp_number || null;
    if (parsed.data.email_enquiries_enabled !== undefined) update.email_enquiries_enabled = parsed.data.email_enquiries_enabled;
    if (parsed.data.whatsapp_enquiries_enabled !== undefined) update.whatsapp_enquiries_enabled = parsed.data.whatsapp_enquiries_enabled;
  }
  if (client.can_hide_branding && parsed.data.show_branding !== undefined) update.show_branding = parsed.data.show_branding;
  const admin = getSupabaseAdmin();
  const saved = await admin.from("widget_clients").update(update).eq("id", client.id).eq("user_id", auth.user.id).select("*").single();
  if (saved.error) return NextResponse.json({ error: saved.error.message }, { status: 500 });
  await admin.from("widget_audit_logs").insert({ actor_user_id: auth.user.id, client_id: client.id, action: "customer.settings_updated", details: { fields: Object.keys(update) } });
  return NextResponse.json({ client: saved.data });
}
