import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { sendRegistrationConfirmedNotifications } from "@/lib/email/events";
import {
  checkAdaptiveRateLimit,
  rateLimitResponseHeaders,
} from "@/lib/abuseProtection";

const registrationNotificationSchema = z.object({
  source: z.enum(["email", "google"]).optional().default("email"),
}).strict();

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    );
  }

  const limit = await checkAdaptiveRateLimit({
    request,
    scope: "verified-registration-email",
    suffix: auth.user.id,
    limit: 6,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { success: false, error: "Registration notification already processed." },
      {
        status: 429,
        headers: rateLimitResponseHeaders({
          result: limit,
          limit: 6,
          windowMs: 60 * 60 * 1000,
          blocked: true,
        }),
      }
    );
  }

  const parsed = registrationNotificationSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid registration notification." },
      { status: 400 }
    );
  }

  const customerEmail = auth.user.email?.trim().toLowerCase();
  if (!customerEmail) {
    return NextResponse.json(
      { success: false, error: "Authenticated account has no e-mail address." },
      { status: 400 }
    );
  }

  await sendRegistrationConfirmedNotifications({
    userId: auth.user.id,
    customerEmail,
    source: parsed.data.source,
  });

  return NextResponse.json({ success: true });
}
