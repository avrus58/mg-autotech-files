import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBaseApiUser } from "@/lib/apiAuth";
import {
  CUSTOMER_DEVICE_COOKIE_NAME,
  CustomerDeviceSecurityUnavailableError,
  getCustomerDeviceCookieOptions,
  verifyCustomerDeviceCode,
} from "@/lib/customerDeviceSecurity";
import { checkCustomerDeviceRequestRate } from "@/lib/customerDeviceRequestSecurity";

export const dynamic = "force-dynamic";

const verificationSchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/),
  rememberDevice: z.boolean(),
}).strict();
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
    operation: "verify",
  });
  if (!rate.allowed) {
    return NextResponse.json(
      {
        status: "required",
        maskedEmail: "your registered e-mail",
        error: "Too many verification attempts. Please wait and try again.",
        retryAfterSeconds: rate.retryAfterSeconds,
        rateLimited: true,
      },
      { status: 429, headers: { ...responseHeaders, ...rate.headers } }
    );
  }
  const parsed = verificationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter the 6-digit code from your e-mail." },
      { status: 400, headers: responseHeaders }
    );
  }

  try {
    const result = await verifyCustomerDeviceCode({
      user: auth.user,
      sessionId: auth.sessionId,
      challengeId: parsed.data.challengeId,
      code: parsed.data.code,
      rememberDevice: parsed.data.rememberDevice,
      userAgent: request.headers.get("user-agent"),
    });
    const status = result.status === "verified"
      ? 200
      : result.attemptsRemaining === 0
        ? 423
        : result.error?.includes("expired")
          ? 410
          : 400;
    const { trustedDeviceToken, ...publicResult } = result;
    const response = NextResponse.json(publicResult, {
      status,
      headers: responseHeaders,
    });
    if (trustedDeviceToken) {
      response.cookies.set(
        CUSTOMER_DEVICE_COOKIE_NAME,
        trustedDeviceToken,
        getCustomerDeviceCookieOptions()
      );
    }
    return response;
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
