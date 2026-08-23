import type { User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  hasAllStaffPermissions,
  hasStaffPermission,
  isPrimaryOwner,
  isStaffMember,
  type StaffAccess,
  type StaffPermission,
  type StaffRole,
} from "@/lib/staffPermissions";

type AuthResult =
  | { ok: true; user: User; access: StaffAccess }
  | { ok: false; status: number; error: string };

function bearerToken(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
}

export async function requireApiUser(request: Request): Promise<AuthResult> {
  const token = bearerToken(request);
  if (!token) return { ok: false, status: 401, error: "Unauthorized" };

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  const user = data.user;

  if (error || !user) return { ok: false, status: 401, error: "Unauthorized" };
  if (!user.email_confirmed_at && !user.confirmed_at) {
    return { ok: false, status: 403, error: "Please verify your e-mail address first." };
  }

  let profile: {
    role: string | null;
    staff_role?: StaffRole | null;
    staff_permissions?: string[] | null;
  } | null = null;

  const current = await admin
    .from("profiles")
    .select("role, staff_role, staff_permissions")
    .eq("id", user.id)
    .maybeSingle();

  if (current.error?.code === "42703") {
    const legacy = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (legacy.error) {
      return {
        ok: false,
        status: 503,
        error: "Authorization service is temporarily unavailable.",
      };
    }

    profile = legacy.data;
  } else if (current.error) {
    return {
      ok: false,
      status: 503,
      error: "Authorization service is temporarily unavailable.",
    };
  } else {
    profile = current.data;
  }

  return {
    ok: true,
    user,
    access: {
      role: profile?.role ?? null,
      staffRole: profile?.staff_role ?? null,
      permissions: Array.isArray(profile?.staff_permissions)
        ? profile.staff_permissions
        : [],
    },
  };
}

export async function requireStaffPermission(
  request: Request,
  permission: StaffPermission
): Promise<AuthResult> {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth;
  if (!isStaffMember(auth.access) || !hasStaffPermission(auth.access, permission)) {
    return { ok: false, status: 403, error: "You do not have permission for this action." };
  }
  return auth;
}

export async function requireStaffPermissions(
  request: Request,
  permissions: readonly StaffPermission[]
): Promise<AuthResult> {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth;
  if (!isStaffMember(auth.access) || !hasAllStaffPermissions(auth.access, permissions)) {
    return { ok: false, status: 403, error: "You do not have permission for this action." };
  }
  return auth;
}

export async function requirePrimaryOwner(request: Request): Promise<AuthResult> {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth;
  if (!isPrimaryOwner(auth.access)) {
    return { ok: false, status: 403, error: "Only the Primary Owner can manage staff access." };
  }
  return auth;
}
