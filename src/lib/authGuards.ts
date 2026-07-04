import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

const transientAuthErrors = new Set([
  "AuthRefreshDiscardedError",
  "AuthRetryableFetchError",
  "NavigatorLockAcquireTimeoutError",
]);

let lastStableSession: Session | null = null;
let authMemoryListenerReady = false;

function hasUsableCachedSession() {
  if (!lastStableSession) return false;
  if (!lastStableSession.expires_at) return true;
  return lastStableSession.expires_at > Math.floor(Date.now() / 1000) + 15;
}

function initializeAuthMemoryListener() {
  if (authMemoryListenerReady || typeof window === "undefined") return;
  authMemoryListenerReady = true;

  supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
      lastStableSession = session;
    } else if (event === "SIGNED_OUT") {
      lastStableSession = null;
    }
  });
}

export function isTransientAuthError(error: unknown) {
  return Boolean(
    error && typeof error === "object" && "name" in error &&
    transientAuthErrors.has(String(error.name))
  );
}

export async function getStableSession(): Promise<{ session: Session | null; error: unknown }> {
  initializeAuthMemoryListener();
  let lastError: unknown = null;

  // Cross-tab refresh can briefly expose an empty session while the refreshed
  // token is being persisted. Treat that short window as indeterminate rather
  // than logging the user out or rejecting an authenticated action.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data, error } = await supabase.auth.getSession();
    if (data.session) {
      lastStableSession = data.session;
      return { session: data.session, error: null };
    }
    lastError = error;

    if (hasUsableCachedSession()) {
      return { session: lastStableSession, error: null };
    }

    if (attempt < 5) {
      const delay = Math.min(250 * (attempt + 1), 750);
      await new Promise((resolve) => window.setTimeout(resolve, delay));
    }
  }

  return {
    session: hasUsableCachedSession() ? lastStableSession : null,
    error: lastError,
  };
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
