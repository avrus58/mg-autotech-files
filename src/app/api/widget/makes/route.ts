import { NextRequest, NextResponse } from "next/server";
import { widgetCorsHeaders, widgetOptions, widgetUnavailable } from "@/lib/widget/http";
import { validateWidgetClient } from "@/lib/widget/validation";
import { widgetMakes } from "@/lib/widget/vehicles";

export function OPTIONS(request: Request) { return widgetOptions(request); }
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") ?? "";
  const session = request.nextUrl.searchParams.get("session");
  const result = await validateWidgetClient(key, request.headers, request.nextUrl.searchParams.get("lang"), { path: "/api/widget/makes", sessionToken: session });
  const origin = result.requestOrigin ?? request.headers.get("origin") ?? "";
  if (!result.valid) return widgetUnavailable(result.language ?? "en", origin);
  return NextResponse.json({ items: await widgetMakes() }, { headers: widgetCorsHeaders(origin) });
}
