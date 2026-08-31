export type CustomerWorkflowClientGroup =
  | "auth"
  | "overview"
  | "request"
  | "credits"
  | "file-expert"
  | "orders"
  | "notifications"
  | "portal"
  | "security"
  | "widget";

export function customerWorkflowClientGroupForPath(
  pathname: string,
): CustomerWorkflowClientGroup | null {
  if (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/auth/callback" ||
    pathname === "/auth/complete-profile" ||
    pathname === "/desktop-auth/turnstile" ||
    pathname === "/measurement/complete"
  ) {
    return "auth";
  }
  if (pathname === "/new-request") return "request";
  if (pathname === "/dashboard") return "overview";
  if (
    pathname === "/dashboard/credits" ||
    pathname === "/dashboard/credits/history" ||
    pathname === "/payment/cancel" ||
    pathname === "/payment/success"
  ) {
    return "credits";
  }
  if (
    pathname === "/dashboard/file-expert" ||
    pathname.startsWith("/dashboard/file-expert/")
  ) {
    return "file-expert";
  }
  if (
    pathname === "/dashboard/orders" ||
    pathname.startsWith("/dashboard/orders/")
  ) {
    return "orders";
  }
  if (pathname === "/dashboard/notifications") return "notifications";
  if (pathname === "/dashboard/settings") return "security";
  if (pathname === "/dashboard/log-analysis") return "portal";
  if (
    pathname === "/dashboard/widget" ||
    pathname.startsWith("/dashboard/widget/")
  ) {
    return "widget";
  }
  return null;
}
