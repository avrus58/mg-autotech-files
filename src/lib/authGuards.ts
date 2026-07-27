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
  if (error instanceof TypeError) return true;
  if (!error || typeof error !== "object" || !("name" in error)) return false;

  const name = String(error.name);
  return name === "AbortError" || transientAuthErrors.has(name);
}

export async function getStableSession(
  options: { maxAttempts?: number } = {}
): Promise<{ session: Session | null; error: unknown }> {
  initializeAuthMemoryListener();
  let lastError: unknown = null;
  const maxAttempts = Math.max(1, Math.min(3, options.maxAttempts ?? 3));

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let session: Session | null = null;
    let error: unknown = null;

    try {
      const result = await supabase.auth.getSession();
      session = result.data.session;
      error = result.error;
    } catch (caughtError) {
      error = caughtError;
    }

    if (session) {
      setCachedSession(session);
      return { session, error: null };
    }
    lastError = error;

    if (isTransientAuthError(error) && hasUsableCachedSession()) {
      return { session: getCachedSession(), error: null };
    }

    if (!isTransientAuthError(error)) {
      setCachedSession(null);
      return { session: null, error };
    }

    if (attempt < maxAttempts - 1) {
      const delay = 150 * (attempt + 1);
      await new Promise((resolve) => window.setTimeout(resolve, delay));
    }
  }

  return {
    session: hasUsableCachedSession() ? getCachedSession() : null,
    error: lastError,
  };
}

export async function getStableUser(): Promise<{
  user: User | null;
  error: unknown;
}> {
  try {
    const { data, error } = await supabase.auth.getUser();
    return { user: data.user, error };
  } catch (error) {
    return { user: null, error };
  }
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

  const { user, error: validationError } = await getStableUser();
  if (validationError || !user) return response;

  const { session: refreshedSession } = await getStableSession({ maxAttempts: 1 });
  if (
    !refreshedSession?.access_token ||
    refreshedSession.access_token === session.access_token
  ) {
    return response;
  }

  setCachedSession(refreshedSession);
  return send(refreshedSession.access_token);
}

export async function signOutStable(options?: { scope?: "global" | "local" }) {
  const result = options?.scope
    ? await supabase.auth.signOut({ scope: options.scope })
    : await supabase.auth.signOut();

  if (result.error) {
    throw result.error;
  }

  setCachedSession(null);
}

export function isEmailVerified(user: User) {
  return Boolean(user.email_confirmed_at || user.confirmed_at);
}

export async function signOutIfEmailUnverified(user: User) {
  if (isEmailVerified(user)) return false;

  await signOutStable();
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
