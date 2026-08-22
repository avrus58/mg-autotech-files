export const AUTH_LOGIN_FAILURE_THRESHOLD = 5;
export const AUTH_LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1_000;

export const AUTH_LOGIN_FAILURE_STORAGE_KEY = "mg:auth:password-failures:v1";

type AuthLoginFailureStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

type StoredAuthLoginFailureState = {
  version: 1;
  failures: number;
  windowStartedAt: number;
  updatedAt: number;
};

export type AuthLoginFailureState = {
  failures: number;
  windowStartedAt: number | null;
};

export const EMPTY_AUTH_LOGIN_FAILURE_STATE: AuthLoginFailureState = {
  failures: 0,
  windowStartedAt: null,
};

function parseStoredState(
  rawValue: string | null,
  now: number
): StoredAuthLoginFailureState | null {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredAuthLoginFailureState>;
    if (
      parsed.version !== 1 ||
      !Number.isInteger(parsed.failures) ||
      typeof parsed.failures !== "number" ||
      parsed.failures < 1 ||
      parsed.failures > AUTH_LOGIN_FAILURE_THRESHOLD ||
      typeof parsed.windowStartedAt !== "number" ||
      !Number.isFinite(parsed.windowStartedAt) ||
      parsed.windowStartedAt > now ||
      typeof parsed.updatedAt !== "number" ||
      !Number.isFinite(parsed.updatedAt) ||
      parsed.updatedAt < parsed.windowStartedAt ||
      parsed.updatedAt > now ||
      now - parsed.windowStartedAt > AUTH_LOGIN_FAILURE_WINDOW_MS
    ) {
      return null;
    }

    return parsed as StoredAuthLoginFailureState;
  } catch {
    return null;
  }
}

export function getBrowserAuthLoginFailureStorage(): AuthLoginFailureStorage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readAuthLoginFailureState(
  storage: AuthLoginFailureStorage | null,
  now = Date.now()
): AuthLoginFailureState {
  if (!storage) return EMPTY_AUTH_LOGIN_FAILURE_STATE;

  try {
    const state = parseStoredState(
      storage.getItem(AUTH_LOGIN_FAILURE_STORAGE_KEY),
      now
    );
    return state
      ? { failures: state.failures, windowStartedAt: state.windowStartedAt }
      : EMPTY_AUTH_LOGIN_FAILURE_STATE;
  } catch {
    return EMPTY_AUTH_LOGIN_FAILURE_STATE;
  }
}

export function recordAuthLoginFailure(
  storage: AuthLoginFailureStorage | null,
  inMemoryState: AuthLoginFailureState,
  now = Date.now()
): AuthLoginFailureState {
  const storedState = readAuthLoginFailureState(storage, now);
  const inMemoryStillValid =
    Number.isInteger(inMemoryState.failures) &&
    inMemoryState.failures > 0 &&
    inMemoryState.windowStartedAt !== null &&
    Number.isFinite(inMemoryState.windowStartedAt) &&
    inMemoryState.windowStartedAt <= now &&
    now - inMemoryState.windowStartedAt <= AUTH_LOGIN_FAILURE_WINDOW_MS;
  const currentState = storedState.failures > 0
    ? storedState
    : inMemoryStillValid
      ? inMemoryState
      : EMPTY_AUTH_LOGIN_FAILURE_STATE;
  const failures = Math.min(
    AUTH_LOGIN_FAILURE_THRESHOLD,
    currentState.failures + 1
  );
  const windowStartedAt = currentState.windowStartedAt ?? now;

  if (storage) {
    try {
      storage.setItem(
        AUTH_LOGIN_FAILURE_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          failures,
          windowStartedAt,
          updatedAt: now,
        })
      );
    } catch {
      // The in-memory counter still escalates this page when storage is unavailable.
    }
  }

  return { failures, windowStartedAt };
}

export function getAuthLoginFailureWindowRemaining(
  state: AuthLoginFailureState,
  now = Date.now()
) {
  if (state.windowStartedAt === null || state.failures === 0) return null;
  return Math.max(
    0,
    state.windowStartedAt + AUTH_LOGIN_FAILURE_WINDOW_MS - now
  );
}

export function clearAuthLoginFailures(
  storage: AuthLoginFailureStorage | null
) {
  if (!storage) return;

  try {
    storage.removeItem(AUTH_LOGIN_FAILURE_STORAGE_KEY);
  } catch {
    // A successful login still clears the in-memory state in the caller.
  }
}

export function authLoginNeedsVisibleChallenge(failures: number) {
  return failures >= AUTH_LOGIN_FAILURE_THRESHOLD;
}

export function isInvalidPasswordCredentialError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === "string"
    ? candidate.code.trim().toLowerCase()
    : "";
  const message = typeof candidate.message === "string"
    ? candidate.message.trim().toLowerCase()
    : "";

  return (
    code === "invalid_credentials" ||
    message === "invalid login credentials"
  );
}
