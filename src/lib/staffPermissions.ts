export const staffPermissionOptions = [
  { key: "orders.view", label: "View orders", group: "Orders" },
  { key: "orders.manage", label: "Update order status and delivery", group: "Orders" },
  { key: "files.download", label: "Download customer files", group: "Files" },
  { key: "files.upload", label: "Upload completed files", group: "Files" },
  { key: "messages.manage", label: "Reply to customer messages", group: "Communication" },
  { key: "customers.view", label: "View customer profiles", group: "Customers" },
  { key: "customers.manage", label: "Update customer profiles", group: "Customers" },
  { key: "credits.manage", label: "Adjust customer credits", group: "Finance" },
  { key: "file_expert.manage", label: "Review File Expert jobs", group: "File Expert" },
  { key: "ai_training.manage", label: "Review ECU learning data", group: "ECU Intelligence" },
  { key: "vehicles.manage", label: "Manage vehicle database", group: "Vehicle Database" },
  { key: "widget.manage", label: "Manage widget clients and settings", group: "Widget SaaS" },
  { key: "staff.manage", label: "Manage staff access", group: "Security" },
] as const;

export type StaffPermission = (typeof staffPermissionOptions)[number]["key"];
export type StaffRole = "owner" | "manager" | "calibrator" | "support";

export type StaffAccess = {
  role: string | null;
  staffRole: StaffRole | null;
  permissions: string[];
};

export const staffRoleDefaults: Record<Exclude<StaffRole, "owner">, StaffPermission[]> = {
  manager: [
    "orders.view",
    "orders.manage",
    "files.download",
    "files.upload",
    "messages.manage",
    "customers.view",
    "customers.manage",
    "credits.manage",
    "file_expert.manage",
    "ai_training.manage",
    "vehicles.manage",
    "widget.manage",
  ],
  calibrator: [
    "orders.view",
    "orders.manage",
    "files.download",
    "files.upload",
    "messages.manage",
    "file_expert.manage",
  ],
  support: [
    "orders.view",
    "messages.manage",
    "customers.view",
  ],
};

export function isPrimaryOwner(access: StaffAccess | null | undefined) {
  if (!access) return false;
  return access.role === "admin" && (access.staffRole === "owner" || !access.staffRole);
}

export function isStaffMember(access: StaffAccess | null | undefined) {
  if (!access) return false;
  return access.role === "admin" || access.role === "staff";
}

export function hasStaffPermission(
  access: StaffAccess | null | undefined,
  permission: StaffPermission
) {
  if (isPrimaryOwner(access)) return true;
  return Boolean(access?.permissions?.includes(permission));
}

export function sanitizeStaffPermissions(values: unknown): StaffPermission[] {
  if (!Array.isArray(values)) return [];
  const allowed = new Set(staffPermissionOptions.map((item) => item.key));
  return [...new Set(values.filter((value): value is StaffPermission =>
    typeof value === "string" && allowed.has(value as StaffPermission)
  ))];
}
