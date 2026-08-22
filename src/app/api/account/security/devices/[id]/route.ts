import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import {
  CUSTOMER_DEVICE_COOKIE_NAME,
  CustomerDeviceSecurityUnavailableError,
  getCustomerDeviceCookieDeletionOptions,
  listCustomerTrustedDevices,
  readCustomerDeviceCookie,
  revokeCustomerTrustedDevice,
} from "@/lib/customerDeviceSecurity";

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization, Cookie",
};

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers: responseHeaders }
    );
  }
  const parsed = z.string().uuid().safeParse((await context.params).id);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid trusted device." },
      { status: 400, headers: responseHeaders }
    );
  }

  try {
    const cookieToken = readCustomerDeviceCookie(request.headers.get("cookie"));
    const devices = await listCustomerTrustedDevices({
      userId: auth.user.id,
      cookieToken,
    });
    const target = devices.find((device) => device.id === parsed.data);
    if (!target) {
      return NextResponse.json(
        { error: "Trusted device was not found." },
        { status: 404, headers: responseHeaders }
      );
    }
    const result = await revokeCustomerTrustedDevice({
      userId: auth.user.id,
      deviceId: parsed.data,
    });
    const response = NextResponse.json(
      { ...result, current: target.current },
      { headers: responseHeaders }
    );
    if (target.current) {
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
      : "Trusted device could not be revoked.";
    return NextResponse.json(
      { error: message },
      { status: 503, headers: responseHeaders }
    );
  }
}
