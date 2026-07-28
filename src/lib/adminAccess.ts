import {
  hasStaffPermission,
  isStaffMember,
  type StaffAccess,
  type StaffRole,
} from "@/lib/staffPermissions";

export type AdminProfileRow = {
  role: string | null;
  staff_role: StaffRole | null;
  staff_permissions: string[] | null;
};

export type AdminAccessQueryError = {
  code?: string;
  message?: string;
} | null;

export type AdminAccessResolution =
  | { state: "authorized"; access: StaffAccess }
  | { state: "denied"; reason: "profile_missing" | "not_staff" | "missing_orders_permission" }
  | { state: "unavailable" };

export function classifyAdminAccessProfile(
  profile: AdminProfileRow | null,
  error: AdminAccessQueryError
): AdminAccessResolution {
  // A failed query cannot prove that a previously verified permission was
  // revoked. Only a successful profile read may produce a denial decision.
  if (error) return { state: "unavailable" };
  if (!profile) return { state: "denied", reason: "profile_missing" };

  const access: StaffAccess = {
    role: profile.role,
    staffRole: profile.staff_role,
    permissions: Array.isArray(profile.staff_permissions)
      ? profile.staff_permissions
      : [],
  };

  if (!isStaffMember(access)) return { state: "denied", reason: "not_staff" };
  if (!hasStaffPermission(access, "orders.view")) {
    return { state: "denied", reason: "missing_orders_permission" };
  }

  return { state: "authorized", access };
}
