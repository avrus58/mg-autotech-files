import { NextRequest, NextResponse } from "next/server";
import { widgetCorsHeaders, widgetOptions, widgetUnavailable } from "@/lib/widget/http";
import { validateWidgetClient } from "@/lib/widget/validation";
import { widgetModels } from "@/lib/widget/vehicles";

export function OPTIONS(request: Request) { return widgetOptions(request); }
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const result = await validateWidgetClient(params.get("key") ?? "", request.headers, params.get("lang"), { path: "/api/widget/models", sessionToken: params.get("session") });
  const origin = result.requestOrigin ?? request.headers.get("origin") ?? "";
  if (!result.valid) return widgetUnavailable(result.language ?? "en", origin);
  const make = params.get("make") ?? "";
  if (!make) return NextResponse.json({ items: [] }, { headers: widgetCorsHeaders(origin) });
  return NextResponse.json({ items: widgetModels(make) }, { headers: widgetCorsHeaders(origin) });
}

