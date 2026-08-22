import { NextResponse } from "next/server";
import { requireBaseApiUser } from "@/lib/apiAuth";
import {
  CUSTOMER_DEVICE_COOKIE_NAME,
  CustomerDeviceSecurityUnavailableError,
  assureCustomerSessionFromTrustedDevice,
  getCustomerDeviceCookieDeletionOptions,
  readCustomerDeviceCookie,
  startCustomerDeviceVerification,
} from "@/lib/customerDeviceSecurity";
import { checkCustomerDeviceRequestRate } from "@/lib/customerDeviceRequestSecurity";

export const dynamic = "force-dynamic";

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

  try {
    const cookieToken = readCustomerDeviceCookie(request.headers.get("cookie"));
    const trustedState = await assureCustomerSessionFromTrustedDevice({
      user: auth.user,
      sessionId: auth.sessionId,
      cookieToken,
    });
    if (trustedState.status !== "required") {
      return NextResponse.json(trustedState, { headers: responseHeaders });
    }

    const rate = await checkCustomerDeviceRequestRate({
      request,
      userId: auth.user.id,
      operation: "start",
    });
    if (!rate.allowed) {
      const response = NextResponse.json(
        {
          status: "required",
          maskedEmail: trustedState.maskedEmail,
          error: "Too many device verification requests. Please wait and try again.",
          retryAfterSeconds: rate.retryAfterSeconds,
          rateLimited: true,
          canVerify: false,
          sentNewCode: false,
          outcome: "rate_limited",
        },
        { status: 429, headers: { ...responseHeaders, ...rate.headers } }
      );
      if (cookieToken) {
        response.cookies.set(
          CUSTOMER_DEVICE_COOKIE_NAME,
          "",
          getCustomerDeviceCookieDeletionOptions()
        );
      }
      return response;
    }

    const state = await startCustomerDeviceVerification({
      user: auth.user,
      sessionId: auth.sessionId,
      cookieToken: null,
      userAgent: request.headers.get("user-agent"),
    });
    const headers = state.rateLimited && state.retryAfterSeconds
      ? { ...responseHeaders, "Retry-After": String(state.retryAfterSeconds) }
      : responseHeaders;
    const response = NextResponse.json(state, {
      status: state.rateLimited ? 429 : state.status === "required" ? 202 : 200,
      headers,
    });
    if (cookieToken && state.status === "required") {
      response.cookies.set(
        CUSTOMER_DEVICE_COOKIE_NAME,
        "",
        getCustomerDeviceCookieDeletionOptions()
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
