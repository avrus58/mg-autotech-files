import { NextRequest, NextResponse } from "next/server";
import { widgetCorsHeaders, widgetOptions, widgetUnavailable } from "@/lib/widget/http";
import { validateWidgetClient } from "@/lib/widget/validation";
import { widgetYears } from "@/lib/widget/vehicles";

export function OPTIONS(request: Request) { return widgetOptions(request); }
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const result = await validateWidgetClient(params.get("key") ?? "", request.headers, params.get("lang"), { path: "/api/widget/years", sessionToken: params.get("session") });
  const origin = result.requestOrigin ?? request.headers.get("origin") ?? "";
  if (!result.valid) return widgetUnavailable(result.language ?? "en", origin);
  const make = params.get("make") ?? "";
  const model = params.get("model") ?? "";
  return NextResponse.json({ items: make && model ? widgetYears(make, model) : [] }, { headers: widgetCorsHeaders(origin) });
}

