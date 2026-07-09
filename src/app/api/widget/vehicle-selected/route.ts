import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { widgetCorsHeaders, widgetOptions, widgetUnavailable } from "@/lib/widget/http";
import { validateWidgetClient } from "@/lib/widget/validation";
import { widgetVehicle } from "@/lib/widget/vehicles";

const selectedSchema = z.object({
  key: z.string().min(10).max(120),
  session: z.string().min(20).max(2000),
  lang: z.string().max(10).optional(),
  make: z.string().min(1).max(120),
  model: z.string().min(1).max(120),
  year: z.string().min(1).max(120),
  engine: z.string().min(1).max(120),
});

export function OPTIONS(request: Request) { return widgetOptions(request); }
export async function POST(request: NextRequest) {
  const parsed = selectedSchema.safeParse(await request.json().catch(() => null));
  const originHeader = request.headers.get("origin") ?? "";
  if (!parsed.success) return widgetUnavailable("en", originHeader, 400);
  const result = await validateWidgetClient(parsed.data.key, request.headers, parsed.data.lang, {
    path: "/api/widget/vehicle-selected", sessionToken: parsed.data.session,
  });
  const origin = result.requestOrigin ?? originHeader;
  if (!result.valid) return widgetUnavailable(result.language ?? "en", origin);
  const vehicle = await widgetVehicle(parsed.data.make, parsed.data.model, parsed.data.year, parsed.data.engine);
  if (!vehicle) return NextResponse.json({ vehicle: null }, { status: 404, headers: widgetCorsHeaders(origin) });
  return NextResponse.json({ vehicle, targetOrigin: origin }, { headers: widgetCorsHeaders(origin) });
}
