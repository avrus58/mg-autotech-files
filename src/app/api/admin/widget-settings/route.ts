import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getWidgetSettings } from "@/lib/widget/settings";
import { sanitizeWidgetLanguages } from "@/lib/widget/types";

const schema = z.object({
  widget_product_enabled: z.boolean().optional(), public_signup_enabled: z.boolean().optional(),
  checkout_enabled: z.boolean().optional(), demo_enabled: z.boolean().optional(),
  monthly_price: z.number().min(0).max(10000).optional(), currency: z.string().regex(/^[a-zA-Z]{3}$/).optional(),
  default_language: z.string().max(5).optional(), enabled_languages: z.array(z.string().max(5)).min(1).max(12).optional(),
  require_domain_whitelist: z.boolean().optional(), show_mg_branding: z.boolean().optional(),
  usage_logging_enabled: z.boolean().optional(), default_monthly_usage_limit: z.number().int().min(0).max(10000000).optional(),
  allow_script_embed: z.boolean().optional(), allow_iframe_embed: z.boolean().optional(),
});

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "widget.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const result = await getWidgetSettings();
  if (!result.databaseReady) return NextResponse.json({ error: "Run scripts/add-vehicle-widget-saas.sql first.", setupRequired: true, settings: result.settings }, { status: 503 });
  return NextResponse.json({ settings: result.settings });
}

export async function PATCH(request: Request) {
  const auth = await requireStaffPermission(request, "widget.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid widget settings." }, { status: 400 });
  const current = await getWidgetSettings({ allowFallback: false });
  const update: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.currency) update.currency = parsed.data.currency.toLowerCase();
  if (parsed.data.enabled_languages) update.enabled_languages = sanitizeWidgetLanguages(parsed.data.enabled_languages);
  const admin = getSupabaseAdmin();
  const saved = await admin.from("widget_settings").update(update).eq("id", current.settings.id).select("*").single();
  if (saved.error) return NextResponse.json({ error: saved.error.message }, { status: 500 });
  await admin.from("widget_audit_logs").insert({ actor_user_id: auth.user.id, action: "admin.global_settings_updated", details: { fields: Object.keys(update) } });
  return NextResponse.json({ settings: saved.data });
}

