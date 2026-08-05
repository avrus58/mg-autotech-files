import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getWidgetSettings } from "@/lib/widget/settings";
import { sanitizeWidgetLanguages, widgetLanguageCodes } from "@/lib/widget/types";
import { widgetRuntimeSecurityState } from "@/lib/widget/security";

const schema = z.object({
  widget_product_enabled: z.boolean().optional(), public_signup_enabled: z.boolean().optional(),
  checkout_enabled: z.boolean().optional(), demo_enabled: z.boolean().optional(),
  monthly_price: z.number().min(0).max(10000).optional(), currency: z.string().regex(/^[a-zA-Z]{3}$/).optional(),
  default_language: z.enum(widgetLanguageCodes).optional(), enabled_languages: z.array(z.enum(widgetLanguageCodes)).min(1).max(12).optional(),
  require_domain_whitelist: z.boolean().optional(), show_mg_branding: z.boolean().optional(),
  usage_logging_enabled: z.boolean().optional(), default_monthly_usage_limit: z.number().int().min(0).max(10000000).optional(),
  allow_script_embed: z.boolean().optional(), allow_iframe_embed: z.boolean().optional(),
  emergency_confirmation: z.string().max(80).optional(),
});

const DISABLE_CONFIRMATION = "DISABLE ALL WIDGETS";

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "widget.manage");
  if (!auth.ok) return privateJson({ error: auth.error }, auth.status);
  const result = await getWidgetSettings();
  const security = widgetRuntimeSecurityState();
  if (!result.databaseReady) return privateJson({ error: "Widget database setup is required.", setupRequired: true, settings: result.settings, security }, 503);
  return privateJson({ settings: result.settings, security });
}

export async function PATCH(request: Request) {
  const auth = await requireStaffPermission(request, "widget.manage");
  if (!auth.ok) return privateJson({ error: auth.error }, auth.status);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateJson({ error: "Invalid widget settings." }, 400);
  const current = await getWidgetSettings({ allowFallback: false });
  const nextProductEnabled = parsed.data.widget_product_enabled ?? current.settings.widget_product_enabled;
  const nextDomainWhitelist = parsed.data.require_domain_whitelist ?? current.settings.require_domain_whitelist;
  const nextUsageLogging = parsed.data.usage_logging_enabled ?? current.settings.usage_logging_enabled;
  const nextScriptEmbed = parsed.data.allow_script_embed ?? current.settings.allow_script_embed;
  const nextIframeEmbed = parsed.data.allow_iframe_embed ?? current.settings.allow_iframe_embed;
  const nextLanguages = parsed.data.enabled_languages
    ? sanitizeWidgetLanguages(parsed.data.enabled_languages)
    : current.settings.enabled_languages;
  const nextDefaultLanguage = parsed.data.default_language ?? current.settings.default_language;
  if (!nextLanguages.includes(nextDefaultLanguage)) {
    return privateJson({ error: "The default language must remain enabled." }, 400);
  }
  if (nextProductEnabled && !nextDomainWhitelist) {
    return privateJson({ error: "Domain allowlisting is required while public widget delivery is enabled." }, 409);
  }
  if (nextProductEnabled && !nextUsageLogging) {
    return privateJson({ error: "Usage logging is required while commercial widget delivery is enabled." }, 409);
  }
  if (nextProductEnabled && !nextScriptEmbed && !nextIframeEmbed) {
    return privateJson({ error: "At least one installation mode must remain enabled." }, 409);
  }
  if (
    current.settings.widget_product_enabled &&
    parsed.data.widget_product_enabled === false &&
    parsed.data.emergency_confirmation !== DISABLE_CONFIRMATION
  ) {
    return privateJson({ error: `Type ${DISABLE_CONFIRMATION} to disable every public widget.` }, 409);
  }
  const { emergency_confirmation: _confirmation, ...requestedUpdate } = parsed.data;
  void _confirmation;
  const update: Record<string, unknown> = { ...requestedUpdate };
  if (parsed.data.currency) update.currency = parsed.data.currency.toLowerCase();
  if (parsed.data.enabled_languages) update.enabled_languages = sanitizeWidgetLanguages(parsed.data.enabled_languages);
  const admin = getSupabaseAdmin();
  const saved = await admin.from("widget_settings").update(update).eq("id", current.settings.id).select("*").single();
  if (saved.error) return privateJson({ error: "Global widget settings could not be saved." }, 500);
  await admin.from("widget_audit_logs").insert({ actor_user_id: auth.user.id, action: "admin.global_settings_updated", details: { fields: Object.keys(update) } });
  return privateJson({ settings: saved.data, security: widgetRuntimeSecurityState() });
}
