import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  defaultWidgetSettings,
  isWidgetLanguage,
  sanitizeWidgetLanguages,
  type WidgetSettings,
} from "@/lib/widget/types";

export type WidgetSettingsResult = {
  settings: WidgetSettings;
  databaseReady: boolean;
  error?: string;
};

function mapSettings(row: Record<string, unknown>): WidgetSettings {
  return {
    ...defaultWidgetSettings,
    ...row,
    monthly_price: Number(row.monthly_price ?? defaultWidgetSettings.monthly_price),
    default_monthly_usage_limit: Number(row.default_monthly_usage_limit ?? 5000),
    default_language: isWidgetLanguage(row.default_language) ? row.default_language : "de",
    enabled_languages: sanitizeWidgetLanguages(row.enabled_languages, [...defaultWidgetSettings.enabled_languages]),
  } as WidgetSettings;
}

export async function getWidgetSettings(options: { allowFallback?: boolean } = {}): Promise<WidgetSettingsResult> {
  const allowFallback = options.allowFallback ?? true;

  try {
    const admin = getSupabaseAdmin();
    const current = await admin.from("widget_settings").select("*").limit(1).maybeSingle();
    if (current.error) throw current.error;
    if (current.data) return { settings: mapSettings(current.data), databaseReady: true };

    const created = await admin
      .from("widget_settings")
      .insert({})
      .select("*")
      .single();
    if (created.error) throw created.error;
    return { settings: mapSettings(created.data), databaseReady: true };
  } catch (error) {
    if (!allowFallback) throw error;
    return {
      settings: defaultWidgetSettings,
      databaseReady: false,
      error: error instanceof Error ? error.message : "Widget database is not installed.",
    };
  }
}

