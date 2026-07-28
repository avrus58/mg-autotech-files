import {
  hasStaffPermission,
  isStaffMember,
  type StaffAccess,
  type StaffRole,
} from "@/lib/staffPermissions";

export type AdminAccessResolution =
  | { state: "authorized"; access: StaffAccess }
  | { state: "denied"; reason: "server_forbidden" }
  | { state: "unavailable" };

const staffRoles = new Set<StaffRole>(["owner", "manager", "calibrator", "support"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function classifyAdminAccessApiResponse(
  status: number,
  payload: unknown
): AdminAccessResolution {
  // Only the server can issue a definitive permission denial. Network,
  // session synchronization and malformed-response states remain retryable.
  if (status === 403) return { state: "denied", reason: "server_forbidden" };
  if (status !== 200 || !isRecord(payload) || !isRecord(payload.access)) {
    return { state: "unavailable" };
  }

  const role = payload.access.role;
  const staffRole = payload.access.staffRole;
  const permissions = payload.access.permissions;

  if (
    (role !== null && typeof role !== "string") ||
    (staffRole !== null && (
      typeof staffRole !== "string" || !staffRoles.has(staffRole as StaffRole)
    )) ||
    !Array.isArray(permissions) ||
    permissions.some((value) => typeof value !== "string")
  ) {
    return { state: "unavailable" };
  }

  const access: StaffAccess = {
    role,
    staffRole: staffRole as StaffRole | null,
    permissions: permissions as string[],
  };

  // A 200 response that does not satisfy the endpoint contract is not proof
  // of revoked access. Fail closed for data loading without replacing an
  // already verified workspace with a false Access Denied screen.
  if (!isStaffMember(access) || !hasStaffPermission(access, "orders.view")) {
    return { state: "unavailable" };
  }

  return { state: "authorized", access };
}
