import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimit";
import {
  normalizeReliabilityRoute,
  platformReliabilityCategories,
  platformReliabilityEventKinds,
  platformWebVitalNames,
} from "@/lib/platformReliability";

const payloadSchema = z.object({
  kind: z.enum(platformReliabilityEventKinds),
  route: z.string().min(1).max(300),
  category: z.enum(platformReliabilityCategories).optional(),
  metricName: z.enum(platformWebVitalNames).optional(),
  metricValue: z.number().finite().min(0).max(120_000).optional(),
  rating: z.enum(["good", "needs-improvement", "poor"]).optional(),
  navigationType: z.string().max(40).regex(/^[a-z0-9_-]+$/i).optional(),
}).strict().superRefine((value, context) => {
  if (value.kind === "web_vital" && (!value.metricName || value.metricValue === undefined || !value.rating)) {
    context.addIssue({ code: "custom", message: "Metric fields are required for web vitals." });
  }
  if (value.kind !== "web_vital" && !value.category) {
    context.addIssue({ code: "custom", message: "Failure category is required." });
  }
});

function deviceClass(userAgent: string) {
  if (/tablet|ipad/i.test(userAgent)) return "tablet";
  if (/mobile|android|iphone/i.test(userAgent)) return "mobile";
  return "desktop";
}

export async function POST(request: Request) {
  const limit = checkRateLimit({
    key: rateLimitKey(request, "client-observability"),
    limit: 60,
    windowMs: 60_000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { accepted: false },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds), "Cache-Control": "no-store" } }
    );
  }

  const rawBody = await request.text();
  if (rawBody.length > 2_000) {
    return NextResponse.json({ accepted: false }, { status: 413, headers: { "Cache-Control": "no-store" } });
  }

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ accepted: false }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const parsed = payloadSchema.safeParse(rawPayload);
  const route = parsed.success ? normalizeReliabilityRoute(parsed.data.route) : null;
  if (!parsed.success || !route) {
    return NextResponse.json({ accepted: false }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const countryHeader = request.headers.get("x-vercel-ip-country") ?? "";
  const country = /^[A-Z]{2}$/.test(countryHeader) ? countryHeader : "unknown";
  const event = {
    source: "web_client",
    kind: parsed.data.kind,
    route,
    category: parsed.data.category ?? null,
    metric_name: parsed.data.metricName ?? null,
    metric_value: parsed.data.metricValue ?? null,
    rating: parsed.data.rating ?? null,
    navigation_type: parsed.data.navigationType ?? null,
    country,
    device: deviceClass(request.headers.get("user-agent") ?? ""),
    occurred_at: new Date().toISOString(),
  };

  if (event.kind === "web_vital") console.info("[platform-reliability]", JSON.stringify(event));
  else console.error("[platform-reliability]", JSON.stringify(event));

  return NextResponse.json({ accepted: true }, { status: 202, headers: { "Cache-Control": "no-store" } });
}
