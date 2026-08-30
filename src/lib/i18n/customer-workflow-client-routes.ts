export type CustomerWorkflowClientGroup =
  | "auth"
  | "overview"
  | "request"
  | "credits"
  | "file-expert"
  | "orders"
  | "notifications";

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
  if (pathname === "/dashboard/credits") return "credits";
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
  return null;
}
