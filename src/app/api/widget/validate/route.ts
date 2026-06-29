import { NextRequest, NextResponse } from "next/server";
import { widgetCorsHeaders, widgetOptions, widgetUnavailable } from "@/lib/widget/http";
import { validateWidgetClient } from "@/lib/widget/validation";

export function OPTIONS(request: Request) { return widgetOptions(request); }
export async function GET(request: NextRequest) {
  const result = await validateWidgetClient(
    request.nextUrl.searchParams.get("key") ?? "",
    request.headers,
    request.nextUrl.searchParams.get("lang"),
    { path: "/api/widget/validate" }
  );
  const origin = result.requestOrigin ?? request.headers.get("origin") ?? "";
  if (!result.valid) return widgetUnavailable(result.language ?? "en", origin);
  return NextResponse.json({ valid: true, language: result.language }, { headers: widgetCorsHeaders(origin) });
}

