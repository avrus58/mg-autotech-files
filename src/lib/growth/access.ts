import type { StaffPermission } from "@/lib/staffPermissions";

// These reports combine customer identity, request history, finance and
// communication evidence into one response. Keep the required verticals
// explicit so a single broad-looking permission cannot unlock adjacent data.
export const growthReportPermissions = [
  "orders.view",
  "customers.view",
  "credits.manage",
  "messages.manage",
] as const satisfies readonly StaffPermission[];

export const customerIntelligencePermissions = growthReportPermissions;

export const adsPerformancePermissions = growthReportPermissions;

export const growthReminderPermissions = [
  "orders.manage",
  "messages.manage",
] as const satisfies readonly StaffPermission[];

export const growthClassificationReadPermissions = [
  "customers.manage",
  "orders.view",
  "credits.manage",
] as const satisfies readonly StaffPermission[];
