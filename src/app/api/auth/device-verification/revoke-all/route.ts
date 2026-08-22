import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/apiAuth";
import {
  CUSTOMER_DEVICE_COOKIE_NAME,
  CustomerDeviceSecurityUnavailableError,
  getCustomerDeviceCookieDeletionOptions,
  revokeAllCustomerDeviceTrust,
} from "@/lib/customerDeviceSecurity";

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization, Cookie",
};

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers: responseHeaders }
    );
  }
  try {
    await revokeAllCustomerDeviceTrust(auth.user.id);
    const response = NextResponse.json({ revoked: true }, { headers: responseHeaders });
    response.cookies.set(
      CUSTOMER_DEVICE_COOKIE_NAME,
      "",
      getCustomerDeviceCookieDeletionOptions()
    );
    return response;
  } catch (error) {
    const message = error instanceof CustomerDeviceSecurityUnavailableError
      ? error.message
      : "Account security state could not be revoked.";
    return NextResponse.json(
      { error: message },
      { status: 503, headers: responseHeaders }
    );
  }
}
