const accountRuntimePathRoots = [
  "/auth",
  "/dashboard",
  "/desktop-auth",
  "/forgot-password",
  "/login",
  "/new-request",
  "/payment",
  "/register",
  "/reset-password",
] as const;

/**
 * Account runtimes may initialize Supabase Auth, so they are loaded only in
 * documents that are deliberately excluded from Google measurement.
 */
export function isAccountRuntimePath(pathname: string) {
  const normalized = pathname.split(/[?#]/, 1)[0]?.replace(/\/+$/, "") || "/";
  return accountRuntimePathRoots.some(
    (root) => normalized === root || normalized.startsWith(`${root}/`)
  );
}
