import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getTransactionalEmailProviderStatus, sendTransactionalEmail } from "@/lib/email/service";
import { listTransactionalEmailTemplates } from "@/lib/email/templates";
import { getSiteUrl } from "@/lib/email/render";
import { listLifecycleStatusCoverage } from "@/lib/email/lifecycle";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const testSchema = z.object({
  eventType: z.literal("admin_email_test").optional().default("admin_email_test"),
  testId: z.string().uuid().optional(),
}).strict();

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "orders.view");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let recentEvents: Array<Record<string, unknown>> = [];
  let migrationReady = true;
  try {
    const admin = getSupabaseAdmin();
    const result = await admin
      .from("email_events")
      .select("id,event_type,recipient_email,status,provider,provider_message_id,error_message,created_at,sent_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (result.error) {
      migrationReady = !["42P01", "42703"].includes(result.error.code || "");
    } else {
      recentEvents = result.data ?? [];
    }
  } catch {
    migrationReady = false;
  }

  return NextResponse.json({
    provider: getTransactionalEmailProviderStatus(),
    templates: listTransactionalEmailTemplates(),
    recentEvents,
    eventSummary: {
      sent: recentEvents.filter((event) => event.status === "sent").length,
      skipped: recentEvents.filter((event) => event.status === "skipped").length,
      failed: recentEvents.filter((event) => event.status === "failed").length,
      pending: recentEvents.filter((event) => event.status === "pending").length,
    },
    authFlows: [
      {
        key: "confirm_signup",
        label: "Signup verification",
        managedBy: "Supabase Auth",
        redirectPath: "/auth/callback?next=/dashboard",
      },
      {
        key: "password_recovery",
        label: "Password recovery",
        managedBy: "Supabase Auth",
        redirectPath: "/auth/callback?next=/reset-password",
      },
      {
        key: "password_changed",
        label: "Password changed security notice",
        managedBy: "Supabase Auth",
        redirectPath: null,
      },
    ],
    lifecycleCoverage: listLifecycleStatusCoverage(),
    migrationReady,
  });
}

export async function POST(request: Request) {
  const auth = await requireStaffPermission(request, "orders.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = testSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid email test payload." }, { status: 400 });
  const recipient = auth.user.email;
  if (!recipient) return NextResponse.json({ error: "Admin user has no email address." }, { status: 400 });

  const result = await sendTransactionalEmail({
    eventType: parsed.data.eventType,
    to: recipient,
    context: {
      customerEmail: recipient,
      adminUrl: `${getSiteUrl()}/admin/email`,
    },
    idempotencyKey: `admin_email_test:${auth.user.id}:${parsed.data.testId || new Date().toISOString().slice(0, 10)}`,
    recipientUserId: auth.user.id,
    metadata: { source: "admin_email_test" },
  });

  return NextResponse.json({ result });
}
