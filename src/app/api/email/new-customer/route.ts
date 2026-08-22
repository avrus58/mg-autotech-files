import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBaseApiUser } from "@/lib/apiAuth";
import { sendRegistrationConfirmedNotifications } from "@/lib/email/events";
import {
  normalizeTransactionalEmailLanguage,
  resolveTransactionalEmailLanguageFromCookie,
  resolveTransactionalEmailLanguageFromMetadata,
} from "@/lib/email/language";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  checkAdaptiveRateLimit,
  rateLimitResponseHeaders,
} from "@/lib/abuseProtection";

const registrationNotificationSchema = z.object({
  source: z.enum(["email", "google"]).optional().default("email"),
}).strict();
const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization, Cookie",
};

export async function POST(request: Request) {
  const auth = await requireBaseApiUser(request);
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status, headers: responseHeaders }
    );
  }

  const now = Date.now();
  const createdAt = new Date(auth.user.created_at).getTime();
  const confirmedAt = new Date(
    auth.user.email_confirmed_at || auth.user.confirmed_at || 0
  ).getTime();
  const isRecent = (value: number) =>
    Number.isFinite(value) && now - value >= 0 && now - value <= 30 * 60 * 1000;
  if (!isRecent(createdAt) && !isRecent(confirmedAt)) {
    return NextResponse.json(
      { success: false, error: "Registration notification window has expired." },
      { status: 403, headers: responseHeaders }
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
        headers: {
          ...responseHeaders,
          ...rateLimitResponseHeaders({
            result: limit,
            limit: 6,
            windowMs: 60 * 60 * 1000,
            blocked: true,
          }),
        },
      }
    );
  }

  const parsed = registrationNotificationSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid registration notification." },
      { status: 400, headers: responseHeaders }
    );
  }
  if (parsed.data.source === "google") {
    const providers = Array.isArray(auth.user.app_metadata?.providers)
      ? auth.user.app_metadata.providers.map(String)
      : [String(auth.user.app_metadata?.provider ?? "")];
    if (!providers.includes("google")) {
      return NextResponse.json(
        { success: false, error: "Google registration notification is not available." },
        { status: 403, headers: responseHeaders }
      );
    }
  }

  const customerEmail = auth.user.email?.trim().toLowerCase();
  if (!customerEmail) {
    return NextResponse.json(
      { success: false, error: "Authenticated account has no e-mail address." },
      { status: 400, headers: responseHeaders }
    );
  }

  const cookieHeader = request.headers.get("cookie");
  const language = normalizeTransactionalEmailLanguage(
    cookieHeader?.includes("mg_locale=")
      ? resolveTransactionalEmailLanguageFromCookie(cookieHeader)
      : null,
    resolveTransactionalEmailLanguageFromMetadata(auth.user.user_metadata),
    request.headers.get("accept-language")
  );

  try {
    await getSupabaseAdmin().auth.admin.updateUserById(auth.user.id, {
      user_metadata: {
        ...auth.user.user_metadata,
        email_language: language,
      },
    });
  } catch {
    // Email delivery can still use the resolved language for this request.
  }

  await sendRegistrationConfirmedNotifications({
    userId: auth.user.id,
    customerEmail,
    source: parsed.data.source,
    language,
  });

  return NextResponse.json({ success: true }, { headers: responseHeaders });
}
