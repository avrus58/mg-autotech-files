import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import {
  CustomerDeviceSecurityUnavailableError,
  listCustomerTrustedDevices,
  readCustomerDeviceCookie,
  revokeOtherCustomerTrustedDevices,
} from "@/lib/customerDeviceSecurity";

const requestSchema = z.object({ confirm: z.literal(true) }).strict();
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
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Confirmation is required." },
      { status: 400, headers: responseHeaders }
    );
  }

  try {
    const devices = await listCustomerTrustedDevices({
      userId: auth.user.id,
      cookieToken: readCustomerDeviceCookie(request.headers.get("cookie")),
    });
    const currentDeviceId = devices.find((device) => device.current)?.id ?? null;
    const result = await revokeOtherCustomerTrustedDevices({
      userId: auth.user.id,
      currentDeviceId,
    });
    return NextResponse.json(result, { headers: responseHeaders });
  } catch (error) {
    const message = error instanceof CustomerDeviceSecurityUnavailableError
      ? error.message
      : "Other trusted devices could not be revoked.";
    return NextResponse.json(
      { error: message },
      { status: 503, headers: responseHeaders }
    );
  }
}
