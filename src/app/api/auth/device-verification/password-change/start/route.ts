import { NextResponse } from "next/server";
import { requireBaseApiUser } from "@/lib/apiAuth";
import {
  CustomerDeviceSecurityUnavailableError,
  hasRecentCustomerPasswordChangeVerification,
  prepareCustomerPasswordChangeVerification,
  startCustomerDeviceVerification,
} from "@/lib/customerDeviceSecurity";
import { checkCustomerDeviceRequestRate } from "@/lib/customerDeviceRequestSecurity";
import { isStaffMember } from "@/lib/staffPermissions";

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
  if (isStaffMember(auth.access)) {
    return NextResponse.json(
      { status: "not_required", maskedEmail: "your registered e-mail" },
      { headers: responseHeaders }
    );
  }

  try {
    const alreadyVerified = await hasRecentCustomerPasswordChangeVerification({
      userId: auth.user.id,
      sessionId: auth.sessionId,
    });
    if (alreadyVerified) {
      return NextResponse.json(
        { status: "verified", maskedEmail: "your registered e-mail" },
        { headers: responseHeaders }
      );
    }

    const preparation = await prepareCustomerPasswordChangeVerification({
      userId: auth.user.id,
      sessionId: auth.sessionId,
    });
    if (preparation === "verified" || preparation === "revoked") {
      return NextResponse.json(
        { status: preparation, maskedEmail: "your registered e-mail" },
        { headers: responseHeaders }
      );
    }

    const rate = await checkCustomerDeviceRequestRate({
      request,
      userId: auth.user.id,
      operation: "start",
    });
    if (!rate.allowed) {
      return NextResponse.json(
        {
          status: "required",
          maskedEmail: "your registered e-mail",
          error: "Too many security-code requests. Please wait and try again.",
          retryAfterSeconds: rate.retryAfterSeconds,
          rateLimited: true,
          canVerify: false,
          sentNewCode: false,
          outcome: "rate_limited",
        },
        { status: 429, headers: { ...responseHeaders, ...rate.headers } }
      );
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
    return NextResponse.json(state, {
      status: state.rateLimited ? 429 : state.status === "required" ? 202 : 200,
      headers,
    });
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
