import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { validateCustomerReplacementPassword } from "@/lib/customerPasswordSecurity";
import { sendCustomerPasswordRecoveryEmail } from "@/lib/email/recovery";
import { resolveTransactionalEmailLanguageFromMetadata } from "@/lib/email/language";
import { getSiteUrl } from "@/lib/email/render";
import { isPrimaryOwner } from "@/lib/staffPermissions";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { revokeAllCustomerDeviceTrust } from "@/lib/customerDeviceSecurity";

const passwordActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("send_reset_email") }).strict(),
  z.object({
    action: z.literal("set_replacement_password"),
    password: z.string(),
  }).strict(),
]);

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffPermission(request, "customers.manage");
  if (!auth.ok) return response({ error: auth.error }, auth.status);

  const parsed = passwordActionSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return response({ error: "Invalid customer security action." }, 400);
  }
  if (
    parsed.data.action === "set_replacement_password" &&
    !isPrimaryOwner(auth.access)
  ) {
    return response(
      { error: "Only the Primary Owner can replace a customer password." },
      403
    );
  }

  const { id } = await context.params;
  const idResult = z.string().uuid().safeParse(id);
  if (!idResult.success) return response({ error: "Invalid customer ID." }, 400);

  if (parsed.data.action === "set_replacement_password") {
    const validation = validateCustomerReplacementPassword(parsed.data.password);
    if (!validation.valid) {
      return response(
        { error: validation.errors[0] || "Password does not meet the security requirements." },
        400
      );
    }
  }

  const admin = getSupabaseAdmin();
  const profileResult = await admin
    .from("profiles")
    .select("id,email,customer_id,role")
    .eq("id", idResult.data)
    .maybeSingle();
  if (profileResult.error || !profileResult.data) {
    return response({ error: "Customer account was not found." }, 404);
  }
  if (["admin", "staff"].includes(String(profileResult.data.role ?? ""))) {
    return response(
      { error: "Staff credentials must be managed through the protected staff workflow." },
      409
    );
  }

  const authUserResult = await admin.auth.admin.getUserById(idResult.data);
  if (authUserResult.error || !authUserResult.data.user) {
    return response({ error: "Customer authentication account was not found." }, 404);
  }
  const customerEmail =
    authUserResult.data.user.email || profileResult.data.email || "";
  if (
    parsed.data.action === "send_reset_email" &&
    !customerEmail
  ) {
    return response({ error: "Customer account has no recovery email address." }, 409);
  }

  const requestedAction = parsed.data.action === "send_reset_email"
    ? "customer_password_reset_email_requested"
    : "customer_password_replacement_requested";
  const auditResult = await admin
    .from("staff_audit_log")
    .insert({
      actor_id: auth.user.id,
      target_user_id: idResult.data,
      action: requestedAction,
      previous_access: {
        target_role: profileResult.data.role || "customer",
        credential_retrieved: false,
      },
      new_access: {
        status: "requested",
        method: parsed.data.action === "send_reset_email"
          ? "supabase_recovery_link_via_transactional_email"
          : "owner_password_replacement",
        password_logged: false,
        password_returned: false,
      },
    })
    .select("id")
    .single();
  if (auditResult.error || !auditResult.data) {
    return response(
      { error: "Security audit is unavailable. No credential action was performed." },
      503
    );
  }

  const finishAudit = async (status: "completed" | "failed") => {
    await admin
      .from("staff_audit_log")
      .update({
        new_access: {
          status,
          method: parsed.data.action === "send_reset_email"
            ? "supabase_recovery_link_via_transactional_email"
            : "owner_password_replacement",
          password_logged: false,
          password_returned: false,
        },
      })
      .eq("id", auditResult.data.id);
  };

  if (parsed.data.action === "send_reset_email") {
    const resetResult = await admin.auth.admin.generateLink({
      type: "recovery",
      email: customerEmail,
      options: {
        redirectTo: `${getSiteUrl()}/auth/callback?next=/reset-password`,
      },
    });
    if (resetResult.error) {
      await finishAudit("failed");
      const status = resetResult.error.status === 429 ? 429 : 502;
      return response(
        { error: status === 429 ? "Password reset email rate limit reached. Try again later." : "Password reset email could not be sent." },
        status
      );
    }
    const delivery = await sendCustomerPasswordRecoveryEmail({
      auditId: String(auditResult.data.id),
      customerEmail,
      customerId: idResult.data,
      customerReference: profileResult.data.customer_id,
      recoveryUrl: resetResult.data.properties.action_link,
      language: resolveTransactionalEmailLanguageFromMetadata(
        authUserResult.data.user.user_metadata
      ),
    });
    if (!delivery.ok) {
      await finishAudit("failed");
      return response(
        { error: "Password reset email could not be sent." },
        502
      );
    }
    await finishAudit("completed");
    return response({
      ok: true,
      action: "send_reset_email",
      message: "Secure password reset email sent to the customer's registered address.",
    });
  }

  try {
    await revokeAllCustomerDeviceTrust(idResult.data, admin);
  } catch {
    await finishAudit("failed");
    return response(
      { error: "Customer security sessions could not be revoked. The password was not changed." },
      503
    );
  }

  const updateResult = await admin.auth.admin.updateUserById(idResult.data, {
    password: parsed.data.password,
  });
  if (updateResult.error) {
    await finishAudit("failed");
    return response({ error: "Customer password could not be replaced." }, 502);
  }

  await finishAudit("completed");
  return response({
    ok: true,
    action: "set_replacement_password",
    message: "Customer password replaced securely. The password was not stored or returned by the server.",
  });
}
