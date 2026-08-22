import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBaseApiUser } from "@/lib/apiAuth";
import {
  CustomerDeviceSecurityUnavailableError,
  startCustomerDeviceVerification,
} from "@/lib/customerDeviceSecurity";
import { checkCustomerDeviceRequestRate } from "@/lib/customerDeviceRequestSecurity";

export const dynamic = "force-dynamic";

const resendSchema = z.object({ challengeId: z.string().uuid() }).strict();
const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization, Cookie",
};

export async function POST(request: Request) {
  const auth = await requireBaseApiUser(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers: responseHeaders }
    );
  }
  const rate = await checkCustomerDeviceRequestRate({
    request,
    userId: auth.user.id,
    operation: "resend",
  });
  if (!rate.allowed) {
    return NextResponse.json(
      {
        status: "required",
        maskedEmail: "your registered e-mail",
        error: "Too many resend requests. Please wait and try again.",
        retryAfterSeconds: rate.retryAfterSeconds,
        rateLimited: true,
        canVerify: false,
        sentNewCode: false,
        outcome: "rate_limited",
      },
      { status: 429, headers: { ...responseHeaders, ...rate.headers } }
    );
  }
  const parsed = resendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid verification request." },
      { status: 400, headers: responseHeaders }
    );
  }

  try {
    const state = await startCustomerDeviceVerification({
      user: auth.user,
      sessionId: auth.sessionId,
      cookieToken: null,
      userAgent: request.headers.get("user-agent"),
      resend: true,
      previousChallengeId: parsed.data.challengeId,
    });
    const status = state.rateLimited
      ? 429
      : state.outcome === "stale_challenge"
        ? 409
        : state.status === "required"
          ? 202
          : 200;
    const headers = state.rateLimited && state.retryAfterSeconds
      ? { ...responseHeaders, "Retry-After": String(state.retryAfterSeconds) }
      : responseHeaders;
    return NextResponse.json(state, { status, headers });
  } catch (error) {
    const message = error instanceof CustomerDeviceSecurityUnavailableError
      ? error.message
      : "Account security verification is temporarily unavailable.";
    return NextResponse.json(
      { error: message },
      { status: 503, headers: responseHeaders }
    );
  }
}
