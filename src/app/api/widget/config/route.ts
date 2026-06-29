import { NextRequest, NextResponse } from "next/server";
import { createWidgetSession } from "@/lib/widget/session";
import { validateWidgetClient } from "@/lib/widget/validation";
import { widgetCorsHeaders, widgetOptions, widgetUnavailable } from "@/lib/widget/http";
import { widgetTranslations, widgetVehicleTypeLabels } from "@/lib/i18n/widget-translations";

export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return widgetOptions(request);
}

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") ?? "";
  const lang = request.nextUrl.searchParams.get("lang");
  const mode = request.nextUrl.searchParams.get("mode") === "iframe" ? "iframe" : "script";
  const result = await validateWidgetClient(key, request.headers, lang, { path: "/api/widget/config" });
  const responseOrigin = result.requestOrigin ?? request.headers.get("origin") ?? "";
  if (!result.valid || !result.client || !result.settings || !result.language || !result.requestDomain) {
    return widgetUnavailable(result.language ?? "en", responseOrigin);
  }

  if (
    (mode === "script" && (!result.settings.allow_script_embed || !result.client.allow_script_embed)) ||
    (mode === "iframe" && (!result.settings.allow_iframe_embed || !result.client.allow_iframe_embed))
  ) {
    return widgetUnavailable(result.language, responseOrigin);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://file.mgautotech.de";
  const allowedOrigin = result.requestOrigin || `https://${result.requestDomain}`;
  const sessionToken = createWidgetSession({
    clientId: result.client.id,
    publicKey: key,
    domain: result.requestDomain,
    origin: allowedOrigin,
    language: result.language,
  });

  return NextResponse.json({
    widget_title: result.client.widget_title,
    button_text: result.client.button_text,
    main_color: result.client.main_color,
    button_text_color: result.client.button_text_color,
    difference_color: result.client.difference_color,
    theme_mode: result.client.theme_mode,
    show_branding: result.settings.show_mg_branding && result.client.show_branding,
    language: result.language,
    direction: result.language === "ar" ? "rtl" : "ltr",
    sessionToken,
    apiBaseUrl: siteUrl.replace(/\/$/, ""),
    allowedOrigin,
    labels: widgetTranslations[result.language],
    vehicleTypeLabel: widgetVehicleTypeLabels[result.language],
  }, { headers: widgetCorsHeaders(allowedOrigin) });
}
