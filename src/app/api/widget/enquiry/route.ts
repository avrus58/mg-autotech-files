import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkAdaptiveRateLimit, rateLimitResponseHeaders } from "@/lib/abuseProtection";
import { sendWidgetEnquiryEmail } from "@/lib/email";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { widgetCorsHeaders, widgetOptions, widgetUnavailable } from "@/lib/widget/http";
import { hashRequestIp } from "@/lib/widget/usage";
import { validateWidgetClient } from "@/lib/widget/validation";
import { widgetVehicle } from "@/lib/widget/vehicles";
import { widgetAbuseSubject } from "@/lib/widget/security";

const enquirySchema = z.object({
  key: z.string().min(10).max(120),
  session: z.string().min(20).max(2000),
  lang: z.string().max(10).optional(),
  make: z.string().min(1).max(120),
  model: z.string().min(1).max(120),
  year: z.string().min(1).max(120),
  engine: z.string().min(1).max(120),
  stage: z.enum(["Stage 1", "Stage 2", "Stage 3"]),
  selectedServices: z.array(z.string().trim().min(1).max(100)).max(24).default([]),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(250),
  phone: z.string().trim().max(40).default(""),
  location: z.string().trim().max(160).default(""),
  registration: z.string().trim().max(80).default(""),
  message: z.string().trim().max(2000).default(""),
  website: z.string().max(0).default(""),
});

export function OPTIONS(request: Request) {
  return widgetOptions(request);
}

export async function POST(request: NextRequest) {
  const originHeader = request.headers.get("origin") ?? "";
  const parsed = enquirySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return widgetUnavailable("en", originHeader, 400);
  const requestLimit = await checkAdaptiveRateLimit({
    request,
    scope: "widget-enquiry",
    limit: 12,
    windowMs: 10 * 60 * 1000,
    suffix: widgetAbuseSubject(parsed.data.key, parsed.data.email),
  });
  const requestLimitHeaders = rateLimitResponseHeaders({ result: requestLimit, limit: 12, windowMs: 10 * 60 * 1000, blocked: !requestLimit.allowed });
  if (!requestLimit.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: { ...widgetCorsHeaders(originHeader), ...requestLimitHeaders } });
  }

  const validation = await validateWidgetClient(parsed.data.key, request.headers, parsed.data.lang, {
    path: "/api/widget/enquiry",
    sessionToken: parsed.data.session,
  });
  const responseOrigin = validation.requestOrigin ?? originHeader;
  if (!validation.valid || !validation.client || !validation.language) {
    return widgetUnavailable(validation.language ?? "en", responseOrigin);
  }

  const client = validation.client;
  if (!client.email_enquiries_enabled || !client.enquiry_email) {
    return widgetUnavailable(validation.language, responseOrigin, 404);
  }

  const vehicle = await widgetVehicle(parsed.data.make, parsed.data.model, parsed.data.year, parsed.data.engine);
  if (!vehicle) return widgetUnavailable(validation.language, responseOrigin, 404);
  const performance = {
    "Stage 1": vehicle.stage1,
    "Stage 2": vehicle.stage2,
    "Stage 3": vehicle.stage3,
  }[parsed.data.stage];
  if (!performance || (performance.tunedHp === null && performance.tunedNm === null)) {
    return widgetUnavailable(validation.language, responseOrigin, 400);
  }

  const allowedServices = new Set(vehicle.services.filter((service) => !/^stage\s*[123]$/i.test(service.trim())));
  const selectedServices = [...new Set(parsed.data.selectedServices.filter((service) => allowedServices.has(service)))];
  const admin = getSupabaseAdmin();
  const ipHash = hashRequestIp(request.headers);
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const recent = await admin
    .from("widget_enquiries")
    .select("id", { count: "exact", head: true })
    .eq("client_id", client.id)
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  if (recent.error) {
    return NextResponse.json({ error: "Enquiry service is unavailable." }, { status: 503, headers: widgetCorsHeaders(responseOrigin) });
  }
  if ((recent.count ?? 0) >= 5) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: widgetCorsHeaders(responseOrigin) });
  }

  const enquiry = await admin.from("widget_enquiries").insert({
    client_id: client.id,
    vehicle_id: vehicle.vehicleId,
    vehicle_name: vehicle.vehicleName,
    stage: parsed.data.stage,
    selected_services: selectedServices,
    performance_data: performance,
    visitor_name: parsed.data.name,
    visitor_email: parsed.data.email,
    visitor_phone: parsed.data.phone || null,
    visitor_location: parsed.data.location || null,
    vehicle_registration: parsed.data.registration || null,
    message: parsed.data.message || null,
    request_domain: validation.requestDomain ?? null,
    ip_hash: ipHash,
  }).select("id").single();
  if (enquiry.error || !enquiry.data) {
    return NextResponse.json({ error: "Enquiry service is unavailable." }, { status: 503, headers: widgetCorsHeaders(responseOrigin) });
  }
  const enquiryId = enquiry.data.id;

  try {
    await sendWidgetEnquiryEmail({
      targetEmail: client.enquiry_email,
      companyName: client.company_name,
      visitorName: parsed.data.name,
      visitorEmail: parsed.data.email,
      visitorPhone: parsed.data.phone,
      visitorLocation: parsed.data.location,
      vehicleRegistration: parsed.data.registration,
      message: parsed.data.message,
      vehicleName: vehicle.vehicleName,
      stage: parsed.data.stage,
      services: selectedServices,
      performance,
      requestDomain: validation.requestDomain ?? "",
    });
    await admin.from("widget_enquiries").update({ status: "delivered" }).eq("id", enquiryId);
  } catch {
    await admin.from("widget_enquiries").update({ status: "delivery_failed" }).eq("id", enquiryId);
    return NextResponse.json({ error: "Enquiry could not be delivered." }, { status: 502, headers: widgetCorsHeaders(responseOrigin) });
  }

  return NextResponse.json({ ok: true, enquiryId }, { headers: { ...widgetCorsHeaders(responseOrigin), ...requestLimitHeaders } });
}
