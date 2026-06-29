import { NextResponse } from "next/server";
import { widgetT } from "@/lib/i18n/widget-translations";
import type { WidgetLanguage } from "@/lib/widget/types";

export function widgetCorsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin || "null",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
    "Cache-Control": "private, no-store, max-age=0",
  };
}

export function widgetUnavailable(language: WidgetLanguage = "en", origin = "", status = 403) {
  return NextResponse.json(
    { error: widgetT(language, "unavailable") },
    { status, headers: widgetCorsHeaders(origin) }
  );
}

export function widgetOptions(request: Request) {
  return new NextResponse(null, { status: 204, headers: widgetCorsHeaders(request.headers.get("origin") ?? "") });
}

