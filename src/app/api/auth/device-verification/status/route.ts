import { NextResponse } from "next/server";
import { requireBaseApiUser } from "@/lib/apiAuth";
import {
  CustomerDeviceSecurityUnavailableError,
  getCustomerDeviceAssuranceState,
} from "@/lib/customerDeviceSecurity";

export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization, Cookie",
};

export async function GET(request: Request) {
  const auth = await requireBaseApiUser(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers: responseHeaders }
    );
  }

  try {
    const state = await getCustomerDeviceAssuranceState({
      user: auth.user,
      sessionId: auth.sessionId,
    });
    return NextResponse.json(state, { headers: responseHeaders });
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
