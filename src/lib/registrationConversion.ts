const EMAIL_CONFIRMATION_SESSION_SKEW_MS = 5 * 60 * 1000;
export const REGISTRATION_HANDOFF_TTL_MS = 30 * 60 * 1000;
export const REGISTRATION_HANDOFF_RETRY_DELAYS_MS = [1_500, 5_000] as const;
export const REGISTRATION_NOTIFICATION_TIMEOUT_MS = 4_000;

export type RegistrationNotificationSource = "email" | "google";

type RegistrationConversionUser = {
  created_at: string;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  last_sign_in_at?: string | null;
  app_metadata?: Record<string, unknown>;
};

export type RegistrationSessionStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

export type RegistrationHandoffKeys = {
  conversion: string;
  notification: string;
};

type PendingRegistrationHandoffs = {
  conversion: boolean;
  notificationSource: RegistrationNotificationSource | null;
};

const REGISTRATION_ACCOUNT_BINDING_PATTERN = /^[a-f0-9]{64}$/;
const activeRegistrationHandoffRecoveryTokens = new WeakMap<object, symbol>();
const registrationHandoffMemoryFallback = new WeakMap<
  object,
  Map<string, string>
>();

function registrationMemoryValues(
  storage: RegistrationSessionStorage,
  create = false
) {
  let values = registrationHandoffMemoryFallback.get(storage);
  if (!values && create) {
    values = new Map<string, string>();
    registrationHandoffMemoryFallback.set(storage, values);
  }
  return values;
}

export function claimRegistrationHandoffRecovery(
  storage: RegistrationSessionStorage
) {
  const token = Symbol("registration-handoff-recovery");
  activeRegistrationHandoffRecoveryTokens.set(storage, token);
  return token;
}

export function ownsRegistrationHandoffRecovery(
  storage: RegistrationSessionStorage,
  token: symbol
) {
  return activeRegistrationHandoffRecoveryTokens.get(storage) === token;
}

export function releaseRegistrationHandoffRecovery(
  storage: RegistrationSessionStorage,
  token: symbol
) {
  if (ownsRegistrationHandoffRecovery(storage, token)) {
    activeRegistrationHandoffRecoveryTokens.delete(storage);
  }
}

export function readRegistrationSessionValue(
  storage: RegistrationSessionStorage,
  key: string
) {
  try {
    const stored = storage.getItem(key);
    if (stored !== null) return stored;
  } catch {
    // The current document can still complete its account-bound handoff.
  }
  return registrationMemoryValues(storage)?.get(key) ?? null;
}

export function writeRegistrationSessionValue(
  storage: RegistrationSessionStorage,
  key: string,
  value: string
) {
  try {
    storage.setItem(key, value);
    if (storage.getItem(key) === value) {
      registrationMemoryValues(storage)?.delete(key);
      return true;
    }
  } catch {
    // Fall through to the current-document recovery store.
  }
  registrationMemoryValues(storage, true)?.set(key, value);
  return true;
}

export function removeRegistrationSessionValues(
  storage: RegistrationSessionStorage,
  keys: readonly string[]
) {
  for (const key of keys) {
    try {
      storage.removeItem(key);
    } catch {
      // Registration verification must remain usable with blocked storage.
    }
    registrationMemoryValues(storage)?.delete(key);
  }
}

export function registrationHandoffMarkersAreDurable(
  storage: RegistrationSessionStorage,
  keys: RegistrationHandoffKeys
) {
  const memoryValues = registrationMemoryValues(storage);
  let hasPendingMarker = false;

  for (const key of [keys.conversion, keys.notification]) {
    let persistedValue: string | null;
    try {
      persistedValue = storage.getItem(key);
    } catch {
      return false;
    }

    const memoryValue = memoryValues?.get(key) ?? null;
    if (persistedValue === null && memoryValue === null) continue;
    hasPendingMarker = true;

    // A full-document navigation can recover only values that are actually in
    // sessionStorage. If even one pending marker fell back to this document's
    // WeakMap, the foreground attempt must receive the memory-only budget.
    if (persistedValue === null) return false;
  }

  return hasPendingMarker;
}

export function getRegistrationHandoffNavigationBudget(
  storage: RegistrationSessionStorage,
  keys: RegistrationHandoffKeys,
  durableBudgetMs: number,
  memoryOnlyBudgetMs: number
) {
  return registrationHandoffMarkersAreDurable(storage, keys)
    ? durableBudgetMs
    : memoryOnlyBudgetMs;
}

function isValidAccountBinding(value: unknown): value is string {
  return (
    typeof value === "string" &&
    REGISTRATION_ACCOUNT_BINDING_PATTERN.test(value)
  );
}

export async function createRegistrationAccountBinding(userId: string) {
  try {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || normalizedUserId.length > 128) return null;
    const bytes = new TextEncoder().encode(
      `mg-registration-handoff-v1:${normalizedUserId}`
    );
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");
  } catch {
    return null;
  }
}

function pendingMarker(
  storage: RegistrationSessionStorage,
  key: string,
  accountBinding: string,
  now: number
) {
  const raw = readRegistrationSessionValue(storage, key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      createdAt?: unknown;
      accountBinding?: unknown;
      source?: unknown;
    };
    const createdAt =
      typeof parsed.createdAt === "number" ? parsed.createdAt : Number.NaN;
    const validTime =
      Number.isFinite(createdAt) &&
      createdAt > 0 &&
      createdAt <= now + 60_000 &&
      now - createdAt <= REGISTRATION_HANDOFF_TTL_MS;
    if (!validTime || !isValidAccountBinding(parsed.accountBinding)) {
      removeRegistrationSessionValues(storage, [key]);
      return null;
    }
    // A valid marker for another authenticated account must not be consumed by
    // the current account. It can still resume if the originating account is
    // restored in this tab before the short handoff TTL expires.
    if (parsed.accountBinding !== accountBinding) return null;
    return parsed;
  } catch {
    removeRegistrationSessionValues(storage, [key]);
    return null;
  }
}

export function markRegistrationHandoffsPending(
  storage: RegistrationSessionStorage,
  keys: RegistrationHandoffKeys,
  source: RegistrationNotificationSource,
  accountBinding: string,
  now = Date.now()
) {
  if (!isValidAccountBinding(accountBinding)) return false;
  // A newly established account handoff supersedes any delayed retry that
  // still owns this tab's storage from an earlier account continuation.
  claimRegistrationHandoffRecovery(storage);
  const conversion = writeRegistrationSessionValue(
    storage,
    keys.conversion,
    JSON.stringify({ createdAt: now, accountBinding })
  );
  const notification = writeRegistrationSessionValue(
    storage,
    keys.notification,
    JSON.stringify({ createdAt: now, source, accountBinding })
  );
  return conversion || notification;
}

export function readPendingRegistrationHandoffs(
  storage: RegistrationSessionStorage,
  keys: RegistrationHandoffKeys,
  accountBinding: string | null,
  now = Date.now()
): PendingRegistrationHandoffs {
  if (!accountBinding || !isValidAccountBinding(accountBinding)) {
    removeRegistrationSessionValues(storage, [
      keys.conversion,
      keys.notification,
    ]);
    return { conversion: false, notificationSource: null };
  }

  const conversion =
    pendingMarker(storage, keys.conversion, accountBinding, now) !== null;
  const notificationMarker = pendingMarker(
    storage,
    keys.notification,
    accountBinding,
    now
  );
  const notificationSource =
    notificationMarker?.source === "email" ||
    notificationMarker?.source === "google"
      ? notificationMarker.source
      : null;
  if (notificationMarker && !notificationSource) {
    removeRegistrationSessionValues(storage, [keys.notification]);
  }
  return { conversion, notificationSource };
}

export async function completePendingRegistrationHandoffs(input: {
  storage: RegistrationSessionStorage;
  keys: RegistrationHandoffKeys;
  accountBinding: string | null;
  onConversion: () => Promise<boolean>;
  onNotification: (
    source: RegistrationNotificationSource
  ) => Promise<boolean>;
  now?: number;
  shouldContinue?: () => boolean;
}) {
  const pending = readPendingRegistrationHandoffs(
    input.storage,
    input.keys,
    input.accountBinding,
    input.now
  );
  const conversionMarker = pending.conversion
    ? readRegistrationSessionValue(input.storage, input.keys.conversion)
    : null;
  const notificationMarker = pending.notificationSource
    ? readRegistrationSessionValue(input.storage, input.keys.notification)
    : null;
  const completeConversion = async () => {
    if (!pending.conversion) return true;
    if (input.shouldContinue && !input.shouldContinue()) {
      return false;
    }
    let completed = false;
    try {
      completed = await input.onConversion();
    } catch {
      completed = false;
    }
    if (!completed) return false;
    const currentMarker = readRegistrationSessionValue(
      input.storage,
      input.keys.conversion
    );
    if (input.shouldContinue && !input.shouldContinue()) return false;
    if (currentMarker === conversionMarker) {
      removeRegistrationSessionValues(input.storage, [input.keys.conversion]);
      return true;
    }
    return currentMarker === null;
  };

  const completeNotification = async () => {
    if (!pending.notificationSource) return true;
    if (input.shouldContinue && !input.shouldContinue()) {
      return false;
    }
    let completed = false;
    try {
      completed = await input.onNotification(pending.notificationSource);
    } catch {
      completed = false;
    }
    if (!completed) return false;
    const currentMarker = readRegistrationSessionValue(
      input.storage,
      input.keys.notification
    );
    if (input.shouldContinue && !input.shouldContinue()) return false;
    if (currentMarker === notificationMarker) {
      removeRegistrationSessionValues(input.storage, [input.keys.notification]);
      return true;
    }
    return currentMarker === null;
  };

  // Measurement and the transactional notification are independent. Running
  // them together prevents their fail-soft network budgets from stacking.
  const [conversionCompleted, notificationCompleted] = await Promise.all([
    completeConversion(),
    completeNotification(),
  ]);

  return { conversionCompleted, notificationCompleted };
}

export async function runRegistrationHandoffWithTimeout(
  operation: (signal?: AbortSignal) => Promise<boolean>,
  timeoutMs = REGISTRATION_NOTIFICATION_TIMEOUT_MS
) {
  const boundedTimeout =
    Number.isFinite(timeoutMs) && timeoutMs > 0
      ? Math.min(timeoutMs, 10_000)
      : REGISTRATION_NOTIFICATION_TIMEOUT_MS;
  let controller: AbortController | null = null;
  try {
    controller = new AbortController();
  } catch {
    // Promise.race still bounds the caller in older browsers.
  }

  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timeoutId = globalThis.setTimeout(() => {
      controller?.abort();
      resolve(false);
    }, boundedTimeout);
  });
  const attempt = Promise.resolve()
    .then(() => operation(controller?.signal))
    .then((completed) => completed === true)
    .catch(() => false);

  try {
    return await Promise.race([attempt, timeout]);
  } finally {
    if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId);
  }
}

export async function retryPendingRegistrationHandoffs(input: {
  storage: RegistrationSessionStorage;
  keys: RegistrationHandoffKeys;
  accountBinding: string | null;
  onConversion: () => Promise<boolean>;
  onNotification: (
    source: RegistrationNotificationSource
  ) => Promise<boolean>;
  retryDelaysMs?: readonly number[];
  wait?: (delayMs: number) => Promise<void>;
  shouldContinue?: () => boolean;
}) {
  const retryDelays = (
    input.retryDelaysMs ?? REGISTRATION_HANDOFF_RETRY_DELAYS_MS
  ).slice(0, 3);
  const wait =
    input.wait ??
    ((delayMs: number) =>
      new Promise<void>((resolve) => {
        globalThis.setTimeout(resolve, Math.max(0, Math.min(delayMs, 10_000)));
      }));
  let attempts = 0;
  let conversionCompleted = false;
  let notificationCompleted = false;

  for (const delayMs of retryDelays) {
    if (input.shouldContinue && !input.shouldContinue()) {
      return {
        conversionCompleted,
        notificationCompleted,
        attempts,
        stopped: true,
      };
    }
    try {
      await wait(Math.max(0, Math.min(delayMs, 10_000)));
    } catch {
      return {
        conversionCompleted,
        notificationCompleted,
        attempts,
        stopped: true,
      };
    }
    if (input.shouldContinue && !input.shouldContinue()) {
      return {
        conversionCompleted,
        notificationCompleted,
        attempts,
        stopped: true,
      };
    }

    const result = await completePendingRegistrationHandoffs(input);
    attempts += 1;
    conversionCompleted = result.conversionCompleted;
    notificationCompleted = result.notificationCompleted;
    if (conversionCompleted && notificationCompleted) {
      return {
        conversionCompleted,
        notificationCompleted,
        attempts,
        stopped: false,
      };
    }
  }

  return {
    conversionCompleted,
    notificationCompleted,
    attempts,
    stopped: false,
  };
}

function isGoogleUser(user: RegistrationConversionUser) {
  if (user.app_metadata?.provider === "google") return true;
  return (
    Array.isArray(user.app_metadata?.providers) &&
    user.app_metadata.providers.includes("google")
  );
}

function timestamp(value: string | null | undefined) {
  const parsed = new Date(value ?? "").getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Recognizes the first verified e-mail callback without relying on how long
 * ago the account was created. Supabase establishes the first session at the
 * same time as confirmation, while a later login has a newer last_sign_in_at.
 */
export function isVerifiedEmailRegistrationCallback(input: {
  user: RegistrationConversionUser;
  hasAuthCode: boolean;
  nextPath: string;
}) {
  if (
    !input.hasAuthCode ||
    input.nextPath === "/reset-password" ||
    isGoogleUser(input.user)
  ) {
    return false;
  }

  const confirmedAt = timestamp(
    input.user.email_confirmed_at ?? input.user.confirmed_at
  );
  const lastSignInAt = timestamp(input.user.last_sign_in_at);
  if (confirmedAt === null || lastSignInAt === null) return false;

  return Math.abs(lastSignInAt - confirmedAt) <= EMAIL_CONFIRMATION_SESSION_SKEW_MS;
}
