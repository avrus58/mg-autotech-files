"use client";

import {
  authenticatedFetchForUser,
  getStableSession,
} from "@/lib/authGuards";
import { recordGrowthAccountCreated } from "@/lib/growth/client";
import {
  measurementConsentChangedEvent,
  readMeasurementConsentSnapshot,
  trackRegistrationCompleted,
} from "@/lib/publicAnalytics";
import {
  claimRegistrationHandoffRecovery,
  completePendingRegistrationHandoffs,
  createRegistrationAccountBinding,
  getRegistrationHandoffNavigationBudget,
  ownsRegistrationHandoffRecovery,
  readPendingRegistrationHandoffs,
  readRegistrationSessionValue,
  REGISTRATION_HANDOFF_TTL_MS,
  REGISTRATION_NOTIFICATION_TIMEOUT_MS,
  releaseRegistrationHandoffRecovery,
  retryPendingRegistrationHandoffs,
  runRegistrationHandoffWithTimeout,
  type RegistrationHandoffKeys,
  type RegistrationNotificationSource,
  type RegistrationSessionStorage,
} from "@/lib/registrationConversion";

type RegistrationHandoffInput = {
  storage: RegistrationSessionStorage;
  keys: RegistrationHandoffKeys;
  accountBinding: string | null;
};

type RegistrationHandoffRecoveryOptions = {
  retryDelaysMs?: readonly number[];
  periodicRetryDelaysMs?: readonly number[];
  signalAttemptLimit?: number;
  onConversionHandoffCompleted?: () => void;
};

type RegistrationHandoffNavigationOptions = {
  budgetMs?: number;
  onConversionHandoffCompleted?: () => void;
};

export type RegistrationHandoffRecoveryStartResult =
  | "started"
  | "no-markers"
  | "session-pending"
  | "account-mismatch";

const REGISTRATION_HANDOFF_SIGNAL_ATTEMPT_LIMIT = 24;
const REGISTRATION_HANDOFF_PERIODIC_RETRY_DELAYS_MS = [
  15_000,
  30_000,
  60_000,
  120_000,
  300_000,
] as const;
const REGISTRATION_HANDOFF_PERIODIC_RETRY_LIMIT = 6;
export const REGISTRATION_HANDOFF_NAVIGATION_BUDGET_MS = 1_250;
export const REGISTRATION_HANDOFF_MEMORY_ONLY_BUDGET_MS = 4_100;

type RegistrationNavigationSettlement<T> =
  | { settledInForeground: true; rejected: false; result: T }
  | { settledInForeground: true; rejected: true; result: null }
  | { settledInForeground: false; rejected: false; result: null };

export async function settleRegistrationHandoffWithinNavigationBudget<T>(input: {
  completion: Promise<T>;
  budgetMs?: number;
  onBackgroundSettled: (result: T) => void;
  onBackgroundRejected: () => void;
}): Promise<RegistrationNavigationSettlement<T>> {
  const boundedBudget = Number.isFinite(input.budgetMs)
    ? Math.max(
        0,
        Math.min(
          input.budgetMs ?? REGISTRATION_HANDOFF_NAVIGATION_BUDGET_MS,
          REGISTRATION_HANDOFF_MEMORY_ONLY_BUDGET_MS
        )
      )
    : REGISTRATION_HANDOFF_NAVIGATION_BUDGET_MS;
  const settlement = input.completion.then(
    (result) => ({ rejected: false as const, result }),
    () => ({ rejected: true as const, result: null })
  );
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
  const foreground = await Promise.race([
    settlement.then((outcome) => ({ timedOut: false as const, outcome })),
    new Promise<{ timedOut: true; outcome: null }>((resolve) => {
      timeoutId = globalThis.setTimeout(
        () => resolve({ timedOut: true, outcome: null }),
        boundedBudget
      );
    }),
  ]);
  if (timeoutId !== null) globalThis.clearTimeout(timeoutId);

  if (!foreground.timedOut) {
    return foreground.outcome.rejected
      ? { settledInForeground: true, rejected: true, result: null }
      : {
          settledInForeground: true,
          rejected: false,
          result: foreground.outcome.result,
        };
  }

  void settlement.then((outcome) => {
    try {
      if (outcome.rejected) input.onBackgroundRejected();
      else input.onBackgroundSettled(outcome.result);
    } catch {
      // A recovery callback is fail-soft and must not surface after navigation.
    }
  });
  return { settledInForeground: false, rejected: false, result: null };
}

type CurrentRegistrationAccount = {
  userId: string;
  accountBinding: string;
};

async function currentRegistrationAccount(
  accountBinding: string | null
): Promise<CurrentRegistrationAccount | null> {
  if (!accountBinding) return null;
  const { session, error } = await getStableSession();
  if (error || !session?.user.id) return null;
  const currentAccountBinding = await createRegistrationAccountBinding(
    session.user.id
  );
  return currentAccountBinding === accountBinding
    ? { userId: session.user.id, accountBinding: currentAccountBinding }
    : null;
}

async function registrationAccountStillMatches(
  expected: CurrentRegistrationAccount
) {
  const current = await currentRegistrationAccount(expected.accountBinding);
  return current?.userId === expected.userId;
}

async function deliverRegistrationConversion(accountBinding: string | null) {
  const expectedAccount = await currentRegistrationAccount(accountBinding);
  if (!expectedAccount) return false;
  const consent = readMeasurementConsentSnapshot();
  if (consent.needsDecision) return false;

  if (!consent.preferences.analytics && !consent.preferences.advertising) {
    // An explicit Necessary-only choice completes the optional measurement
    // handoff without creating a visitor id or sending a measurement request.
    return true;
  }

  const conversionSeed = await recordGrowthAccountCreated(expectedAccount.userId);
  if (!conversionSeed) return false;
  if (!(await registrationAccountStillMatches(expectedAccount))) return false;

  const tracked = await trackRegistrationCompleted(conversionSeed).catch(
    () => false
  );
  return tracked && registrationAccountStillMatches(expectedAccount);
}

function deliverRegistrationNotification(
  source: RegistrationNotificationSource,
  accountBinding: string | null
) {
  return runRegistrationHandoffWithTimeout(async (signal) => {
    const expectedAccount = await currentRegistrationAccount(accountBinding);
    if (!expectedAccount) return false;
    const response = await authenticatedFetchForUser(
      expectedAccount.userId,
      "/api/email/new-customer",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
        cache: "no-store",
        keepalive: true,
        ...(signal ? { signal } : {}),
      }
    );
    return response.ok && registrationAccountStillMatches(expectedAccount);
  }, REGISTRATION_NOTIFICATION_TIMEOUT_MS);
}

function registrationHandoffCallbacks(accountBinding: string | null) {
  return {
    onConversion: () => deliverRegistrationConversion(accountBinding),
    onNotification: (source: RegistrationNotificationSource) =>
      deliverRegistrationNotification(source, accountBinding),
  };
}

export async function completeRegistrationHandoffs(
  input: RegistrationHandoffInput
) {
  // A new page/account continuation owns this storage before any asynchronous
  // work, so a delayed retry from a previous continuation cannot consume or
  // delete its markers.
  const token = claimRegistrationHandoffRecovery(input.storage);
  const result = await completePendingRegistrationHandoffs({
    ...input,
    ...registrationHandoffCallbacks(input.accountBinding),
    shouldContinue: () =>
      ownsRegistrationHandoffRecovery(input.storage, token),
  });
  return {
    ...result,
    superseded: !ownsRegistrationHandoffRecovery(input.storage, token),
  };
}

/**
 * Gives the verified handoff a short foreground opportunity, then releases the
 * customer journey while the same owned attempt finishes. Recovery starts only
 * after that attempt settles, preventing duplicate notification/conversion
 * delivery from overlapping retries.
 */
export async function completeRegistrationHandoffsBeforeNavigation(
  input: RegistrationHandoffInput,
  options: RegistrationHandoffNavigationOptions = {}
) {
  const budgetMs =
    options.budgetMs ?? REGISTRATION_HANDOFF_NAVIGATION_BUDGET_MS;
  const effectiveBudget = getRegistrationHandoffNavigationBudget(
    input.storage,
    input.keys,
    budgetMs,
    REGISTRATION_HANDOFF_MEMORY_ONLY_BUDGET_MS
  );
  const conversionWasPending = readPendingRegistrationHandoffs(
    input.storage,
    input.keys,
    input.accountBinding
  ).conversion;
  let conversionCompletionNotified = false;
  const notifyConversionCompleted = () => {
    if (conversionCompletionNotified || !conversionWasPending) return;
    conversionCompletionNotified = true;
    try {
      options.onConversionHandoffCompleted?.();
    } catch {
      // Navigation remains fail-soft; the anonymous durable conversion can be
      // completed by the next eligible document.
    }
  };
  const recoveryOptions: RegistrationHandoffRecoveryOptions = {
    onConversionHandoffCompleted: notifyConversionCompleted,
  };
  const completion = completeRegistrationHandoffs(input);
  const recoverIfNeeded = (result: Awaited<ReturnType<typeof completeRegistrationHandoffs>>) => {
    if (!result.superseded && result.conversionCompleted) {
      notifyConversionCompleted();
    }
    if (
      !result.superseded &&
      (!result.conversionCompleted || !result.notificationCompleted)
    ) {
      startRegistrationHandoffRecovery(input, recoveryOptions);
    }
  };
  const foreground = await settleRegistrationHandoffWithinNavigationBudget({
    completion,
    budgetMs: effectiveBudget,
    onBackgroundSettled: recoverIfNeeded,
    onBackgroundRejected: () =>
      startRegistrationHandoffRecovery(input, recoveryOptions),
  });
  if (foreground.settledInForeground && !foreground.rejected) {
    recoverIfNeeded(foreground.result);
    return { ...foreground.result, continuingInBackground: false };
  }
  if (foreground.settledInForeground && foreground.rejected) {
    startRegistrationHandoffRecovery(input, recoveryOptions);
  }
  return {
    conversionCompleted: false,
    notificationCompleted: false,
    superseded: false,
    continuingInBackground: true,
  };
}

export function startRegistrationHandoffRecovery(
  input: RegistrationHandoffInput,
  options: RegistrationHandoffRecoveryOptions = {}
) {
  if (!input.accountBinding) return false;

  const token = claimRegistrationHandoffRecovery(input.storage);
  const callbacks = registrationHandoffCallbacks(input.accountBinding);
  const periodicRetryDelaysMs = (
    options.periodicRetryDelaysMs ??
    REGISTRATION_HANDOFF_PERIODIC_RETRY_DELAYS_MS
  )
    .filter((delay) => Number.isFinite(delay) && delay >= 0)
    .slice(0, REGISTRATION_HANDOFF_PERIODIC_RETRY_LIMIT);
  const signalAttemptLimit = Number.isInteger(options.signalAttemptLimit)
    ? Math.max(1, Math.min(options.signalAttemptLimit ?? 1, 24))
    : REGISTRATION_HANDOFF_SIGNAL_ATTEMPT_LIMIT;
  let active = true;
  let inFlight = false;
  let resumeQueued = false;
  let signalAttempts = 0;
  let periodicRetryIndex = 0;
  let expiryTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  let periodicRetryTimer: ReturnType<typeof globalThis.setTimeout> | null =
    null;

  const ownsRecovery = () =>
    ownsRegistrationHandoffRecovery(input.storage, token);
  const cleanup = () => {
    if (!active) return;
    active = false;
    if (typeof window !== "undefined") {
      window.removeEventListener("online", requestResume);
      window.removeEventListener(measurementConsentChangedEvent, requestResume);
    }
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", resumeWhenVisible);
    }
    if (expiryTimer !== null) globalThis.clearTimeout(expiryTimer);
    if (periodicRetryTimer !== null) {
      globalThis.clearTimeout(periodicRetryTimer);
    }
    releaseRegistrationHandoffRecovery(input.storage, token);
  };

  const scheduleNextPeriodicRetry = () => {
    if (
      !active ||
      periodicRetryTimer !== null ||
      periodicRetryIndex >= periodicRetryDelaysMs.length ||
      signalAttempts >= signalAttemptLimit
    ) {
      return;
    }
    if (!ownsRecovery()) {
      cleanup();
      return;
    }

    const delay = periodicRetryDelaysMs[periodicRetryIndex] ?? 0;
    periodicRetryIndex += 1;
    periodicRetryTimer = globalThis.setTimeout(() => {
      periodicRetryTimer = null;
      void runAttempt(false);
    }, delay);
    const nodeTimer = periodicRetryTimer as ReturnType<
      typeof globalThis.setTimeout
    > & { unref?: () => void };
    nodeTimer.unref?.();
  };

  const runAttempt = async (initial: boolean) => {
    if (!active) return;
    if (inFlight) {
      resumeQueued = true;
      return;
    }
    if (!ownsRecovery()) {
      cleanup();
      return;
    }
    if (!initial && signalAttempts >= signalAttemptLimit) {
      cleanup();
      return;
    }

    if (!initial) signalAttempts += 1;
    const conversionWasPending = readPendingRegistrationHandoffs(
      input.storage,
      input.keys,
      input.accountBinding
    ).conversion;
    inFlight = true;
    let result:
      | { conversionCompleted: boolean; notificationCompleted: boolean }
      | null = null;
    try {
      result = initial
        ? await retryPendingRegistrationHandoffs({
            ...input,
            ...callbacks,
            ...(options.retryDelaysMs
              ? { retryDelaysMs: options.retryDelaysMs }
              : {}),
            shouldContinue: ownsRecovery,
          })
        : await completePendingRegistrationHandoffs({
            ...input,
            ...callbacks,
            shouldContinue: ownsRecovery,
          });
    } catch {
      result = null;
    } finally {
      inFlight = false;
    }

    if (!active) return;
    if (!ownsRecovery()) {
      cleanup();
      return;
    }
    if (conversionWasPending && result?.conversionCompleted) {
      try {
        options.onConversionHandoffCompleted?.();
      } catch {
        // A bridge/navigation callback is fail-soft; the anonymous durable
        // conversion remains available for a later eligible document.
      }
    }
    if (result?.conversionCompleted && result.notificationCompleted) {
      cleanup();
      return;
    }
    if (signalAttempts >= signalAttemptLimit) {
      cleanup();
      return;
    }
    if (resumeQueued) {
      resumeQueued = false;
      void runAttempt(false);
      return;
    }
    scheduleNextPeriodicRetry();
  };

  function requestResume() {
    if (!active) return;
    void runAttempt(false);
  }

  function resumeWhenVisible() {
    if (document.visibilityState === "visible") requestResume();
  }

  if (typeof window !== "undefined") {
    window.addEventListener("online", requestResume);
    window.addEventListener(measurementConsentChangedEvent, requestResume);
  }
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", resumeWhenVisible);
  }
  expiryTimer = globalThis.setTimeout(cleanup, REGISTRATION_HANDOFF_TTL_MS);
  const nodeTimer = expiryTimer as ReturnType<typeof globalThis.setTimeout> & {
    unref?: () => void;
  };
  nodeTimer.unref?.();

  void runAttempt(true);
  return true;
}

/**
 * Reconnects a handoff after a full-document navigation has stopped the page
 * that created it. Raw markers are checked before auth work and are never
 * interpreted or removed until a stable account binding is available.
 */
export async function startRegistrationHandoffRecoveryForCurrentSession(input: {
  storage: RegistrationSessionStorage;
  keys: RegistrationHandoffKeys;
  onConversionHandoffCompleted?: () => void;
}): Promise<RegistrationHandoffRecoveryStartResult> {
  const hasRawMarker =
    readRegistrationSessionValue(input.storage, input.keys.conversion) !== null ||
    readRegistrationSessionValue(input.storage, input.keys.notification) !== null;
  if (!hasRawMarker) return "no-markers";

  const { session } = await getStableSession();
  if (!session?.user.id) return "session-pending";

  const accountBinding = await createRegistrationAccountBinding(session.user.id);
  if (!accountBinding) return "session-pending";
  const pending = readPendingRegistrationHandoffs(
    input.storage,
    input.keys,
    accountBinding
  );
  if (!pending.conversion && !pending.notificationSource) {
    const stillHasRawMarker =
      readRegistrationSessionValue(input.storage, input.keys.conversion) !== null ||
      readRegistrationSessionValue(input.storage, input.keys.notification) !== null;
    return stillHasRawMarker ? "account-mismatch" : "no-markers";
  }

  return startRegistrationHandoffRecovery({
    storage: input.storage,
    keys: input.keys,
    accountBinding,
  }, {
    onConversionHandoffCompleted: input.onConversionHandoffCompleted,
  })
    ? "started"
    : "session-pending";
}
