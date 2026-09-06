import { adsPerformancePermissions, growthReportPermissions } from "@/lib/growth/access";
import { hasAllStaffPermissions, isPrimaryOwner, type StaffAccess, type StaffPermission } from "@/lib/staffPermissions";

type AdminDestination = {
  href: string;
  label: string;
  group: "Workspace" | "Business" | "Tools";
  permissions: readonly StaffPermission[];
  ownerOnly?: boolean;
};

// Mirrors the existing desktop navigation. This is presentation only; each
// destination and API continues to enforce its own staff authorization.
export const adminMobileDestinations: readonly AdminDestination[] = [
  { href: "/admin#orders", label: "Orders", group: "Workspace", permissions: ["orders.view"] },
  { href: "/admin#customers", label: "Customers", group: "Workspace", permissions: ["orders.view", "customers.view"] },
  { href: "/admin/requests", label: "Request Control", group: "Workspace", permissions: ["orders.view"] },
  { href: "/admin/operations", label: "Operations Intelligence", group: "Workspace", permissions: ["orders.view"] },
  { href: "/admin/payments", label: "Revenue Control", group: "Business", permissions: ["credits.manage"] },
  { href: "/admin/commercial", label: "Pricing Rules", group: "Business", permissions: ["credits.manage"] },
  { href: "/admin/seo-performance", label: "SEO & Conversion", group: "Business", permissions: ["orders.view"] },
  { href: "/admin/ads-performance", label: "Ads Readiness", group: "Business", permissions: adsPerformancePermissions },
  { href: "/admin/growth", label: "Growth & Success", group: "Business", permissions: growthReportPermissions },
  { href: "/admin/vehicles", label: "Vehicle Database", group: "Tools", permissions: ["vehicles.manage"] },
  { href: "/admin/file-expert", label: "File Expert", group: "Tools", permissions: ["file_expert.manage"] },
  { href: "/admin/ai-training", label: "ECU Learning", group: "Tools", permissions: ["ai_training.manage"] },
  { href: "/admin/widget-clients", label: "Widget SaaS", group: "Tools", permissions: ["widget.manage"] },
  { href: "/admin/team", label: "Team & Permissions", group: "Tools", permissions: ["staff.manage"], ownerOnly: true },
];

export function availableAdminDestinations(access: StaffAccess | null) {
  return adminMobileDestinations.filter((item) =>
    item.ownerOnly ? isPrimaryOwner(access) : hasAllStaffPermissions(access, item.permissions),
  );
}

export function activeAdminDestination(pathname: string, hash: string) {
  if (pathname === "/admin") return hash === "#customers" ? "/admin#customers" : "/admin#orders";
  return adminMobileDestinations.find((item) =>
    !item.href.includes("#") && (pathname === item.href || pathname.startsWith(`${item.href}/`)),
  )?.href ?? null;
}
