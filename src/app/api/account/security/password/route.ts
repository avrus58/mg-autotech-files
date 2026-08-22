import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import {
  CustomerDeviceSecurityUnavailableError,
  hasRecentCustomerPasswordChangeVerification,
  revokeAllCustomerDeviceTrust,
} from "@/lib/customerDeviceSecurity";
import { validateCustomerReplacementPassword } from "@/lib/customerPasswordSecurity";
import { isStaffMember } from "@/lib/staffPermissions";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const requestSchema = z.object({ password: z.string() }).strict();
const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization, Cookie",
};

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error, code: auth.code },
      { status: auth.status, headers: responseHeaders }
    );
  }
  if (isStaffMember(auth.access)) {
    return NextResponse.json(
      { error: "Staff credentials must use the protected staff workflow." },
      { status: 403, headers: responseHeaders }
    );
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid new password." },
      { status: 400, headers: responseHeaders }
    );
  }
  const validation = validateCustomerReplacementPassword(parsed.data.password);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.errors[0] || "Password does not meet the security requirements." },
      { status: 400, headers: responseHeaders }
    );
  }

  const admin = getSupabaseAdmin();
  try {
    const recentlyVerified = await hasRecentCustomerPasswordChangeVerification({
      userId: auth.user.id,
      sessionId: auth.sessionId,
      admin,
    });
    if (!recentlyVerified) {
      return NextResponse.json(
        {
          error: "A recent e-mail security code is required. Request a new password-reset link.",
          code: "customer_password_email_verification_required",
        },
        { status: 403, headers: responseHeaders }
      );
    }
  } catch (error) {
    const message = error instanceof CustomerDeviceSecurityUnavailableError
      ? error.message
      : "Password security verification is temporarily unavailable.";
    return NextResponse.json(
      { error: message },
      { status: 503, headers: responseHeaders }
    );
  }

  try {
    // Revoke first so a failed follow-up can never leave old trusted sessions
    // active after a credential-change attempt.
    await revokeAllCustomerDeviceTrust(auth.user.id, admin);
  } catch {
    return NextResponse.json(
      { error: "Account security sessions could not be revoked. The password was not changed." },
      { status: 503, headers: responseHeaders }
    );
  }

  const update = await admin.auth.admin.updateUserById(auth.user.id, {
    password: parsed.data.password,
  });
  if (update.error) {
    return NextResponse.json(
      {
        error: "Password could not be updated. Your previous app sessions were secured; request a new reset link and retry.",
        sessionRevoked: true,
      },
      { status: 502, headers: responseHeaders }
    );
  }

  return NextResponse.json(
    { updated: true, trustedDevicesRevoked: true },
    { headers: responseHeaders }
  );
}
