import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { clearGrowthVisitorId } from "@/lib/growth/publicClient";
import { CUSTOMER_SESSION_REVOKED_MESSAGE } from "@/lib/customerDeviceContracts";
import { withBrowserAuthMutation } from "@/lib/browserAuthMutations";

export const AUTH_SESSION_REQUIRED_EVENT = "mg-autotech:auth-session-required";
export const AUTH_DEVICE_VERIFICATION_REQUIRED_EVENT =
  "mg-autotech:device-verification-required";
export const AUTH_SESSION_REQUIRED_MESSAGE = "Your secure session has ended. Please log in again.";
export const AUTH_SESSION_RECOVERY_MESSAGE =
  "The secure session could not be synchronized. Please retry in a moment.";

const transientAuthErrors = new Set([
  "AuthRefreshDiscardedError",
  "AuthRetryableFetchError",
  "NavigatorLockAcquireTimeoutError",
]);

const sessionReadDelays = [0, 120, 280, 520] as const;
const requestRetryDelays = [0, 250, 650] as const;
const authSdkOperationTimeoutMs = 8_000;
const authenticatedHomeTimeoutMs = 10_000;

type StableSessionResult = {
  session: Session | null;
  error: unknown;
};

type AuthMemoryWindow = Window & typeof globalThis & {
  __mgAutotechStableSession?: Session | null;
  __mgAutotechAuthMemoryListenerReady?: boolean;
  __mgAutotechSessionRevision?: number;
};

const authWindow = typeof window === "undefined" ? null : window as AuthMemoryWindow;
let sessionResolutionInFlight: Promise<StableSessionResult> | null = null;
let sessionRefreshInFlight: Promise<StableSessionResult> | null = null;
let sessionRequiredCheckInFlight: Promise<void> | null = null;

class AuthSessionRecoveryPendingError extends Error {
  constructor() {
    super(AUTH_SESSION_RECOVERY_MESSAGE);
    this.name = "AuthSessionRecoveryPendingError";
  }
}

class AuthSdkOperationTimeoutError extends Error {
  constructor() {
    super(AUTH_SESSION_RECOVERY_MESSAGE);
    this.name = "AuthRetryableFetchError";
  }
}

async function withAuthSdkOperationTimeout<T>(operation: PromiseLike<T>): Promise<T> {
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;

  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => {
        timeoutId = globalThis.setTimeout(
          () => reject(new AuthSdkOperationTimeoutError()),
          authSdkOperationTimeoutMs
        );
      }),
    ]);
  } finally {
    if (timeoutId !== null) globalThis.clearTimeout(timeoutId);
  }
}

function getCachedSession() {
  // Never retain a user session in module-level server memory. A warm Next.js
  // process can serve different users, while this cache is intended only to
  // bridge transient browser storage/refresh-token coordination.
  return authWindow?.__mgAutotechStableSession ?? null;
}

function setCachedSession(session: Session | null) {
  if (!authWindow) return;
  if (!session || sessionIdentity(getCachedSession()) !== sessionIdentity(session)) {
    authWindow.__mgAutotechSessionRevision = sessionRevision() + 1;
  }
  authWindow.__mgAutotechStableSession = session;
}

function sessionIdentity(session: Session | null) {
  if (!session) return null;
  // Correlation only, never authorization. Refreshing a token must not turn
  // the same revoked server session into an apparently new browser session.
  try {
    const payload = session.access_token.split(".")[1];
    const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as {
      session_id?: unknown;
    };
    if (typeof claims.session_id === "string" && claims.session_id) {
      return `${session.user.id}:${claims.session_id}`;
    }
  } catch {
    // Opaque/malformed tokens are still compared exactly; APIs validate them.
  }
  return `${session.user.id}:${session.access_token}`;
}

function sessionRevision() {
  return authWindow?.__mgAutotechSessionRevision ?? 0;
}

export function isCurrentBrowserSession(session: Session) {
  return sessionIdentity(getCachedSession()) === sessionIdentity(session);
}

function currentSessionResult(): StableSessionResult {
  return {
    session: getStableSessionSnapshot(),
    error: getCachedSession() && !hasUsableCachedSession()
      ? new AuthSessionRecoveryPendingError()
      : null,
  };
}

function adoptCachedSession(session: Session) {
  resetGrowthAttributionForAuthIdentityTransition(
    getCachedSession()?.user.id ?? null,
    session.user.id
  );
  setCachedSession(session);
}

export function primeStableSession(session: Session | null) {
  initializeAuthMemoryListener();
  if (session) adoptCachedSession(session);
  else setCachedSession(null);
}

export function resetGrowthAttributionForAuthIdentityTransition(
  previousUserId: string | null,
  nextUserId: string | null
) {
  if (!previousUserId || !nextUserId || previousUserId === nextUserId) {
    return false;
  }
  clearGrowthVisitorId();
  return true;
}

function hasUsableCachedSession(expiryBufferSeconds = 15) {
  const session = getCachedSession();
  if (!session) return false;
  if (!session.expires_at) return true;
  return session.expires_at > Math.floor(Date.now() / 1000) + expiryBufferSeconds;
}

export function getStableSessionSnapshot() {
  return hasUsableCachedSession() ? getCachedSession() : null;
}

function initializeAuthMemoryListener() {
  if (!authWindow || authWindow.__mgAutotechAuthMemoryListenerReady) return;
  authWindow.__mgAutotechAuthMemoryListenerReady = true;

  supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
      adoptCachedSession(session);
    } else if (event === "SIGNED_OUT") {
      clearGrowthVisitorId();
      setCachedSession(null);
    }
  });
}

export function isTransientAuthError(error: unknown) {
  if (error instanceof TypeError) return true;
  if (!error || typeof error !== "object") return false;

  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message).toLowerCase() : "";

  return transientAuthErrors.has(name) ||
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("timeout") ||
    message.includes("lock");
}

function sleep(delay: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, delay));
}

async function refreshStableSession(): Promise<StableSessionResult> {
  if (sessionRefreshInFlight) return sessionRefreshInFlight;

  const operation = (async () => {
    const revision = sessionRevision();
    try {
      // Read the newest persisted refresh token. Passing a captured token here
      // can replay an already-rotated token when another tab refreshes first.
      const { data, error } = await withAuthSdkOperationTimeout(
        supabase.auth.refreshSession()
      );
      if (authWindow && revision !== sessionRevision()) return currentSessionResult();
      if (data.session) {
        adoptCachedSession(data.session);
        return { session: data.session, error: null };
      }
      return { session: null, error };
    } catch (error) {
      if (authWindow && revision !== sessionRevision()) return currentSessionResult();
      return { session: null, error };
    }
  })();

  sessionRefreshInFlight = operation;
  try {
    return await operation;
  } finally {
    if (sessionRefreshInFlight === operation) sessionRefreshInFlight = null;
  }
}

async function resolveStableSession(): Promise<StableSessionResult> {
  initializeAuthMemoryListener();

  // Route transitions do not need to wait for another storage lock or network
  // round-trip when this browser already holds a usable verified session. API
  // authorization remains server-side and a confirmed SIGNED_OUT event clears
  // this snapshot immediately.
  const cachedSnapshot = getStableSessionSnapshot();
  if (cachedSnapshot) {
    return { session: cachedSnapshot, error: null };
  }

  let lastError: unknown = null;

  for (let attempt = 0; attempt < sessionReadDelays.length; attempt += 1) {
    if (sessionReadDelays[attempt] > 0) await sleep(sessionReadDelays[attempt]);

    const revision = sessionRevision();
    try {
      const { data, error } = await withAuthSdkOperationTimeout(
        supabase.auth.getSession()
      );
      if (authWindow && revision !== sessionRevision()) return currentSessionResult();
      if (data.session) {
        adoptCachedSession(data.session);
        return { session: data.session, error: null };
      }
      lastError = error;

      if (hasUsableCachedSession()) {
        return { session: getCachedSession(), error: null };
      }

      // A storage read can briefly return null while another tab commits a
      // refreshed session. Complete the bounded read sequence before treating
      // this as a signed-out state.
    } catch (error) {
      if (authWindow && revision !== sessionRevision()) return currentSessionResult();
      lastError = error;
      if (hasUsableCachedSession()) {
        return { session: getCachedSession(), error: null };
      }
      if (error instanceof AuthSdkOperationTimeoutError) break;
    }
  }

  const cachedSession = getCachedSession();
  if (cachedSession?.refresh_token) {
    const refreshed = await refreshStableSession();
    if (refreshed.session) return refreshed;
    lastError = refreshed.error ?? lastError;
  }

  // A known browser session disappearing without a SIGNED_OUT event is an
  // uncertain synchronization state, not proof that the user logged out.
  // Keep protected routes in recovery mode while Supabase finishes rotating
  // or persisting the token instead of replacing the workspace with login UI.
  if (getCachedSession() && !lastError) {
    lastError = new AuthSessionRecoveryPendingError();
  }

  return {
    session: hasUsableCachedSession() ? getCachedSession() : null,
    error: lastError,
  };
}

export async function getStableSession(): Promise<StableSessionResult> {
  const cachedSnapshot = getStableSessionSnapshot();
  if (cachedSnapshot) {
    return { session: cachedSnapshot, error: null };
  }

  if (sessionResolutionInFlight) return sessionResolutionInFlight;

  const operation = resolveStableSession();
  sessionResolutionInFlight = operation;
  try {
    return await operation;
  } finally {
    if (sessionResolutionInFlight === operation) sessionResolutionInFlight = null;
  }
}

export async function getStableAccessToken() {
  const { session } = await getStableSession();
  return session?.access_token ?? null;
}

export function notifySessionRequired() {
  if (typeof window === "undefined" || sessionRequiredCheckInFlight) return;

  const operation = (async () => {
    const revision = sessionRevision();
    const { session, error } = await getStableSession();
    if (revision !== sessionRevision()) return;
    if (!session?.user && !error) {
      window.dispatchEvent(new Event(AUTH_SESSION_REQUIRED_EVENT));
    }
  })().catch(() => undefined);

  sessionRequiredCheckInFlight = operation;
  void operation.finally(() => {
    if (sessionRequiredCheckInFlight === operation) sessionRequiredCheckInFlight = null;
  });
}

export function notifyDeviceVerificationRequired() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_DEVICE_VERIFICATION_REQUIRED_EVENT));
  }
}

async function authenticatedFetchInternal(
  expectedUserId: string | null,
  input: RequestInfo | URL,
  init?: RequestInit
) {
  let requestSession: Session | null = null;
  const send = (accessToken: string) => {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    return fetch(input, { ...init, headers });
  };

  for (let attempt = 0; attempt < requestRetryDelays.length; attempt += 1) {
    if (requestRetryDelays[attempt] > 0) await sleep(requestRetryDelays[attempt]);
    if (authWindow && requestSession && !isCurrentBrowserSession(requestSession)) {
      throw new AuthSessionRecoveryPendingError();
    }

    const resolved = attempt === 0
      ? await getStableSession()
      : await refreshStableSession();
    const session = resolved.session ?? (await getStableSession()).session;

    if (!session?.access_token) continue;
    if (expectedUserId && session.user.id !== expectedUserId) {
      throw new AuthSessionRecoveryPendingError();
    }
    requestSession ??= session;
    if (authWindow && !isCurrentBrowserSession(requestSession)) {
      throw new AuthSessionRecoveryPendingError();
    }

    const response = await send(session.access_token);
    if (authWindow && !isCurrentBrowserSession(session)) {
      // Do not replay an old request under a new login, or let its late result
      // change that login's UI/session. This includes successful old-user data.
      throw new AuthSessionRecoveryPendingError();
    }
    if (response.status === 428) {
      notifyDeviceVerificationRequired();
      return response;
    }
    if (response.status === 401) {
      const payload = await response.clone().json().catch(() => null) as
        | { error?: unknown }
        | null;
      if (payload?.error === CUSTOMER_SESSION_REVOKED_MESSAGE) {
        const signedOut = await signOutLocalIfSessionMatches(session);
        if (signedOut && typeof window !== "undefined" && !getCachedSession()) {
          window.dispatchEvent(new Event(AUTH_SESSION_REQUIRED_EVENT));
        }
        if (!signedOut) throw new AuthSessionRecoveryPendingError();
        return response;
      }
    }
    if (response.status !== 401) return response;
  }

  const finalState = await getStableSession();
  if (finalState.session?.user || finalState.error) {
    throw new Error(AUTH_SESSION_RECOVERY_MESSAGE);
  }

  notifySessionRequired();
  throw new Error(AUTH_SESSION_REQUIRED_MESSAGE);
}

export function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit) {
  return authenticatedFetchInternal(null, input, init);
}

export function authenticatedFetchForUser(
  expectedUserId: string,
  input: RequestInfo | URL,
  init?: RequestInit
) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(expectedUserId)) {
    return Promise.reject(new AuthSessionRecoveryPendingError());
  }
  return authenticatedFetchInternal(expectedUserId, input, init);
}

export async function signOutStable() {
  // The ordinary logout button belongs to this browser, not every computer.
  await signOutLocalStable();
}

export async function signOutAllSessionsStable() {
  // Security operations such as a successful password reset still revoke
  // every provider session; ordinary navigation/logout must not do so.
  await withBrowserAuthMutation(async () => {
    clearGrowthVisitorId();
    setCachedSession(null);
    await supabase.auth.signOut({ scope: "global" });
  });
}

export async function signOutLocalIfSessionMatches(session: Session) {
  return withBrowserAuthMutation(async () => {
    if (!isCurrentBrowserSession(session)) return false;
    // Another tab may have persisted its login before its auth broadcast
    // reaches this tab. Check the SDK inside the same cross-tab mutation lock.
    // getSession can implicitly refresh; keep the mutation lock until the
    // SDK settles rather than releasing it while that refresh still runs.
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session || !isCurrentBrowserSession(session)) return false;
    if (sessionIdentity(data.session) !== sessionIdentity(session)) {
      adoptCachedSession(data.session);
      return false;
    }
    await performLocalSignOut();
    return true;
  });
}

async function performLocalSignOut() {
  clearGrowthVisitorId();
  setCachedSession(null);
  await supabase.auth.signOut({ scope: "local" });
}

export async function signOutLocalStable() {
  await withBrowserAuthMutation(performLocalSignOut);
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
  if (!userId) return "/dashboard";

  try {
    const response = await authenticatedFetch("/api/account/context", {
      cache: "no-store",
      signal: AbortSignal.timeout(authenticatedHomeTimeoutMs),
    });
    if (!response.ok) return "/dashboard";

    const payload = (await response.json()) as { home?: unknown };
    return payload.home === "/admin" ? "/admin" : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

export function getAuthRedirect(path: string) {
  if (typeof window === "undefined") return path;

  return `${window.location.origin}${path}`;
}
