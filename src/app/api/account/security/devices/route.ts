import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/apiAuth";
import {
  CustomerDeviceSecurityUnavailableError,
  listCustomerTrustedDevices,
  readCustomerDeviceCookie,
} from "@/lib/customerDeviceSecurity";

export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization, Cookie",
};

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers: responseHeaders }
    );
  }
  try {
    const devices = await listCustomerTrustedDevices({
      userId: auth.user.id,
      cookieToken: readCustomerDeviceCookie(request.headers.get("cookie")),
    });
    return NextResponse.json({ devices }, { headers: responseHeaders });
  } catch (error) {
    const message = error instanceof CustomerDeviceSecurityUnavailableError
      ? error.message
      : "Trusted devices could not be loaded.";
    return NextResponse.json(
      { error: message },
      { status: 503, headers: responseHeaders }
    );
  }
}
