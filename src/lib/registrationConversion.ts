const EMAIL_CONFIRMATION_SESSION_SKEW_MS = 5 * 60 * 1000;
export const REGISTRATION_HANDOFF_TTL_MS = 30 * 60 * 1000;

export type RegistrationNotificationSource = "email" | "google";

type RegistrationConversionUser = {
  created_at: string;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  last_sign_in_at?: string | null;
  app_metadata?: Record<string, unknown>;
};

type RegistrationSessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type RegistrationHandoffKeys = {
  conversion: string;
  notification: string;
};

type PendingRegistrationHandoffs = {
  conversion: boolean;
  notificationSource: RegistrationNotificationSource | null;
};

const REGISTRATION_ACCOUNT_BINDING_PATTERN = /^[a-f0-9]{64}$/;

export function readRegistrationSessionValue(
  storage: RegistrationSessionStorage,
  key: string
) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function writeRegistrationSessionValue(
  storage: RegistrationSessionStorage,
  key: string,
  value: string
) {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
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
  }
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
    if (
      !validTime ||
      !isValidAccountBinding(parsed.accountBinding) ||
      parsed.accountBinding !== accountBinding
    ) {
      removeRegistrationSessionValues(storage, [key]);
      return null;
    }
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
}) {
  const pending = readPendingRegistrationHandoffs(
    input.storage,
    input.keys,
    input.accountBinding,
    input.now
  );
  let conversionCompleted = !pending.conversion;
  let notificationCompleted = pending.notificationSource === null;

  if (pending.conversion) {
    try {
      conversionCompleted = await input.onConversion();
    } catch {
      conversionCompleted = false;
    }
    if (conversionCompleted) {
      removeRegistrationSessionValues(input.storage, [input.keys.conversion]);
    }
  }

  if (pending.notificationSource) {
    try {
      notificationCompleted = await input.onNotification(
        pending.notificationSource
      );
    } catch {
      notificationCompleted = false;
    }
    if (notificationCompleted) {
      removeRegistrationSessionValues(input.storage, [input.keys.notification]);
    }
  }

  return { conversionCompleted, notificationCompleted };
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
