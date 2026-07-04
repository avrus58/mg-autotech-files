import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

const transientAuthErrors = new Set([
  "AuthRefreshDiscardedError",
  "AuthRetryableFetchError",
  "NavigatorLockAcquireTimeoutError",
]);

type AuthMemoryWindow = Window & typeof globalThis & {
  __mgAutotechStableSession?: Session | null;
  __mgAutotechAuthMemoryListenerReady?: boolean;
};

const authWindow = typeof window === "undefined" ? null : window as AuthMemoryWindow;
let serverStableSession: Session | null = null;

function getCachedSession() {
  return authWindow?.__mgAutotechStableSession ?? serverStableSession;
}

function setCachedSession(session: Session | null) {
  serverStableSession = session;
  if (authWindow) authWindow.__mgAutotechStableSession = session;
}

function hasUsableCachedSession() {
  const session = getCachedSession();
  if (!session) return false;
  if (!session.expires_at) return true;
  return session.expires_at > Math.floor(Date.now() / 1000) + 15;
}

function initializeAuthMemoryListener() {
  if (!authWindow || authWindow.__mgAutotechAuthMemoryListenerReady) return;
  authWindow.__mgAutotechAuthMemoryListenerReady = true;

  supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
      setCachedSession(session);
    } else if (event === "SIGNED_OUT") {
      setCachedSession(null);
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
      setCachedSession(data.session);
      return { session: data.session, error: null };
    }
    lastError = error;

    if (hasUsableCachedSession()) {
      return { session: getCachedSession(), error: null };
    }

    if (attempt < 5) {
      const delay = Math.min(250 * (attempt + 1), 750);
      await new Promise((resolve) => window.setTimeout(resolve, delay));
    }
  }

  return {
    session: hasUsableCachedSession() ? getCachedSession() : null,
    error: lastError,
  };
}

export async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit) {
  const { session } = await getStableSession();
  if (!session?.access_token) throw new Error("Unauthorized");

  const send = (accessToken: string) => {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    return fetch(input, { ...init, headers });
  };

  const response = await send(session.access_token);
  if (response.status !== 401) return response;

  const { data, error } = await supabase.auth.refreshSession(
    session.refresh_token ? { refresh_token: session.refresh_token } : undefined
  );
  if (error || !data.session?.access_token) return response;

  setCachedSession(data.session);
  return send(data.session.access_token);
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
