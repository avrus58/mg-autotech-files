import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

const transientAuthErrors = new Set([
  "AuthRefreshDiscardedError",
  "AuthRetryableFetchError",
  "NavigatorLockAcquireTimeoutError",
]);

export function isTransientAuthError(error: unknown) {
  return Boolean(
    error && typeof error === "object" && "name" in error &&
    transientAuthErrors.has(String(error.name))
  );
}

export async function getStableSession(): Promise<{ session: Session | null; error: unknown }> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase.auth.getSession();
    if (data.session) return { session: data.session, error: null };
    if (!isTransientAuthError(error)) return { session: null, error };
    await new Promise((resolve) => window.setTimeout(resolve, 150 * (attempt + 1)));
  }

  const { data, error } = await supabase.auth.getSession();
  return { session: data.session, error };
}

export function isEmailVerified(user: User) {
  return Boolean(user.email_confirmed_at || user.confirmed_at);
}

export async function signOutIfEmailUnverified(user: User) {
  if (isEmailVerified(user)) return false;

  await supabase.auth.signOut();
  return true;
}

export async function getAuthenticatedHome(userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  return data?.role === "admin" || data?.role === "staff"
    ? "/admin"
    : "/dashboard";
}

export function getAuthRedirect(path: string) {
  if (typeof window === "undefined") return path;

  return `${window.location.origin}${path}`;
}
