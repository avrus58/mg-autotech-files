import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePrimaryOwner } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sanitizeStaffPermissions } from "@/lib/staffPermissions";

const updateSchema = z.object({
  userId: z.string().uuid(),
  staffRole: z.enum(["customer", "manager", "calibrator", "support"]),
  permissions: z.array(z.string()).max(20).default([]),
});

const teamSelect =
  "id, email, customer_id, full_name, company_name, role, staff_role, staff_permissions, staff_updated_at, account_status, created_at";

export async function GET(request: Request) {
  const auth = await requirePrimaryOwner(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("profiles")
    .select(teamSelect)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error?.code === "42703") {
    return NextResponse.json(
      {
        error: "Staff access migration has not been installed yet.",
        setupRequired: true,
      },
      { status: 409 }
    );
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profiles: data ?? [], ownerId: auth.user.id });
}

export async function POST(request: Request) {
  const auth = await requirePrimaryOwner(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid staff access request." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: target, error: targetError } = await admin
    .from("profiles")
    .select("id, role, staff_role, staff_permissions")
    .eq("id", parsed.data.userId)
    .maybeSingle();

  if (targetError || !target) {
    return NextResponse.json({ error: "User profile was not found." }, { status: 404 });
  }

  if (target.staff_role === "owner" || target.id === auth.user.id) {
    return NextResponse.json(
      { error: "The Primary Owner account is permanent and cannot be changed." },
      { status: 409 }
    );
  }

  const permissions = sanitizeStaffPermissions(parsed.data.permissions).filter(
    (permission) => permission !== "staff.manage"
  );
  const nextAccess = parsed.data.staffRole === "customer"
    ? { role: "customer", staff_role: null, staff_permissions: [] as string[] }
    : {
        role: "staff",
        staff_role: parsed.data.staffRole,
        staff_permissions: permissions,
      };

  const { data: updated, error: updateError } = await admin
    .from("profiles")
    .update({ ...nextAccess, staff_updated_at: new Date().toISOString() })
    .eq("id", target.id)
    .select(teamSelect)
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await admin.from("staff_audit_log").insert({
    actor_id: auth.user.id,
    target_user_id: target.id,
    action: parsed.data.staffRole === "customer" ? "staff_access_revoked" : "staff_access_updated",
    previous_access: {
      role: target.role,
      staff_role: target.staff_role,
      staff_permissions: target.staff_permissions,
    },
    new_access: nextAccess,
  });

  return NextResponse.json({ profile: updated });
}
