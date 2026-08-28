"use client";

import {
  authenticatedFetch,
  authenticatedFetchForUser,
} from "@/lib/authGuards";
import {
  getOrCreateGrowthVisitorId,
  readExistingGrowthVisitorId,
} from "@/lib/growth/publicClient";
import {
  readMeasurementConsentSnapshot,
  type MeasurementConsentSnapshot,
} from "@/lib/publicAnalytics";
import {
  captureGrowthConsentEpoch,
  isGrowthConsentEpochCurrent,
  registerGrowthConsentAbortController,
} from "@/lib/growth/consentLifecycle";

export { clearGrowthVisitorId, recordGrowthAttributionTouch } from "@/lib/growth/publicClient";

const growthJourneyRetryTimeoutMs = 2_000;
const growthJourneyRetryAttempts = 2;

export type GrowthJourneyClientAction =
  | "account_created"
  | "identity_linked"
  | "request_started"
  | "request_created";

type GrowthJourneyClientPurpose =
  | "analytics"
  | "advertising"
  | "reminder";

type GrowthJourneyClientDecision = {
  allowed: boolean;
  includeVisitorId: boolean;
  purpose: GrowthJourneyClientPurpose | null;
  consentVersion: "consent-mode-v2" | "abandoned-request-v1" | null;
};

export function growthJourneyClientDecision(
  action: GrowthJourneyClientAction,
  consent: MeasurementConsentSnapshot,
  options: { reminderOptIn?: boolean } = {},
): GrowthJourneyClientDecision {
  const analyticsAllowed =
    !consent.needsDecision && consent.preferences.analytics;
  const advertisingAllowed =
    !consent.needsDecision && consent.preferences.advertising;
  const reminderAllowed = options.reminderOptIn === true;

  if (analyticsAllowed) {
    return {
      allowed: true,
      includeVisitorId: true,
      purpose: "analytics",
      consentVersion: "consent-mode-v2",
    };
  }
  if (action === "account_created" && advertisingAllowed) {
    return {
      allowed: true,
      includeVisitorId: false,
      purpose: "advertising",
      consentVersion: "consent-mode-v2",
    };
  }
  if (action === "request_started" && reminderAllowed) {
    return {
      allowed: true,
      includeVisitorId: false,
      purpose: "reminder",
      consentVersion: "abandoned-request-v1",
    };
  }
  return {
    allowed: false,
    includeVisitorId: false,
    purpose: null,
    consentVersion: null,
  };
}

function acceptedGrowthEvent(value: unknown) {
  return Boolean(
    value &&
    typeof value === "object" &&
    (value as { accepted?: unknown }).accepted === true
  );
}

export async function runBoundedGrowthEventRetry(
  operation: (signal?: AbortSignal) => Promise<boolean>,
  options: {
    timeoutMs?: number;
    attempts?: number;
    controller?: AbortController | null;
    shouldContinue?: () => boolean;
  } = {}
) {
  try {
    const timeoutMs =
      typeof options.timeoutMs === "number" &&
      Number.isFinite(options.timeoutMs) &&
      options.timeoutMs > 0
        ? Math.min(options.timeoutMs, growthJourneyRetryTimeoutMs)
        : growthJourneyRetryTimeoutMs;
    const attempts =
      typeof options.attempts === "number" && Number.isInteger(options.attempts)
        ? Math.max(1, Math.min(options.attempts, growthJourneyRetryAttempts))
        : growthJourneyRetryAttempts;
    let controller: AbortController | null = options.controller ?? null;
    if (!controller) {
      try {
        controller = new AbortController();
      } catch {
        // Promise.race still bounds callers without AbortController.
      }
    }

    let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;
    const timeout = new Promise<boolean>((resolve) => {
      timeoutId = globalThis.setTimeout(() => {
        try {
          controller?.abort();
        } catch {
          // A non-standard AbortController must not strand customer navigation.
        }
        resolve(false);
      }, timeoutMs);
    });
    const retry = Promise.resolve()
      .then(async () => {
        for (let attempt = 0; attempt < attempts; attempt += 1) {
          if (
            controller?.signal.aborted ||
            (options.shouldContinue && !options.shouldContinue())
          ) return false;
          const accepted = await operation(controller?.signal).catch(() => false);
          if (
            controller?.signal.aborted ||
            (options.shouldContinue && !options.shouldContinue())
          ) return false;
          if (accepted) return true;
        }
        return false;
      })
      .catch(() => false);

    try {
      return await Promise.race([retry, timeout]);
    } finally {
      if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId);
    }
  } catch {
    return false;
  }
}

function createGrowthJourneyConsentGuard(
  action: GrowthJourneyClientAction,
  decision: GrowthJourneyClientDecision,
  options: { reminderOptIn?: boolean } = {}
) {
  if (decision.consentVersion !== "consent-mode-v2") {
    return {
      controller: null,
      isCurrent: () => true,
      release: () => undefined,
    };
  }

  const epoch = captureGrowthConsentEpoch();
  let controller: AbortController | null = null;
  let unregister: (() => boolean) | null = null;
  try {
    controller = new AbortController();
    unregister = registerGrowthConsentAbortController(controller);
  } catch {
    // Epoch and fresh-consent checks still reject late acknowledgements.
  }
  const isCurrent = () => {
    if (!isGrowthConsentEpochCurrent(epoch) || controller?.signal.aborted) {
      return false;
    }
    try {
      const current = growthJourneyClientDecision(
        action,
        readMeasurementConsentSnapshot(),
        options
      );
      return current.allowed &&
        current.purpose === decision.purpose &&
        current.consentVersion === decision.consentVersion &&
        current.includeVisitorId === decision.includeVisitorId;
    } catch {
      return false;
    }
  };
  return {
    controller,
    isCurrent,
    release: () => { unregister?.(); },
  };
}

async function postAuthenticatedGrowthEvent(
  body: Record<string, unknown>,
  signal?: AbortSignal,
  expectedUserId?: string
) {
  try {
    let requestSignal = signal;
    if (!requestSignal) {
      try {
        requestSignal = AbortSignal.timeout(4_000);
      } catch {
        // Callers remain fail-soft when AbortSignal.timeout is unavailable.
      }
    }
    const requestInit: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      ...(requestSignal ? { signal: requestSignal } : {}),
    };
    const response = expectedUserId
      ? await authenticatedFetchForUser(
          expectedUserId,
          "/api/growth/journey",
          requestInit
        )
      : await authenticatedFetch("/api/growth/journey", requestInit);
    if (!response.ok) return null;
    return await response.json().catch(() => null) as unknown;
  } catch {
    return null;
  }
}

export async function recordGrowthAccountCreated(expectedUserId?: string) {
  try {
    const decision = growthJourneyClientDecision(
      "account_created",
      readMeasurementConsentSnapshot(),
    );
    if (!decision.allowed || !decision.purpose || !decision.consentVersion) return null;
    const visitorId =
      decision.includeVisitorId && typeof window !== "undefined"
        ? getOrCreateGrowthVisitorId()
        : null;
    const guard = createGrowthJourneyConsentGuard("account_created", decision);
    const controller = guard.controller;

    let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => {
      timeoutId = globalThis.setTimeout(() => {
        try {
          controller?.abort();
        } catch {
          // Promise.race remains the callback deadline if abort is unavailable.
        }
        resolve(null);
      }, 3_500);
    });
    const attempts = async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (!guard.isCurrent()) return null;
        const result = await postAuthenticatedGrowthEvent({
          action: "account_created",
          purpose: decision.purpose,
          consentVersion: decision.consentVersion,
          ...(visitorId ? { visitorId } : {}),
        }, controller?.signal, expectedUserId);
        if (!guard.isCurrent()) return null;
        if (result && typeof result === "object") {
          const seed = (result as { conversionSeed?: unknown }).conversionSeed;
          if (
            typeof seed === "string" &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(seed)
          ) {
            return seed;
          }
        }
      }
      return null;
    };

    try {
      return await Promise.race([attempts(), timeout]);
    } finally {
      if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId);
      guard.release();
    }
  } catch {
    return null;
  }
}

/**
 * Links an already-consented public attribution identity to the authenticated
 * account. This is first-party reporting only: it emits no Google event and
 * never creates a visitor identity from a private page.
 */
export function recordGrowthIdentityLinked(expectedUserId?: string) {
  if (!expectedUserId) return Promise.resolve(false);
  const decision = growthJourneyClientDecision(
    "identity_linked",
    readMeasurementConsentSnapshot(),
  );
  if (
    !decision.allowed ||
    decision.purpose !== "analytics" ||
    decision.consentVersion !== "consent-mode-v2"
  ) {
    return Promise.resolve(false);
  }
  const visitorId = readExistingGrowthVisitorId();
  if (!visitorId) return Promise.resolve(false);
  const guard = createGrowthJourneyConsentGuard("identity_linked", decision);
  return runBoundedGrowthEventRetry(
    async (signal) =>
      acceptedGrowthEvent(await postAuthenticatedGrowthEvent({
        action: "identity_linked",
        purpose: decision.purpose,
        consentVersion: decision.consentVersion,
        visitorId,
      }, signal, expectedUserId)),
    { controller: guard.controller, shouldContinue: guard.isCurrent }
  ).finally(guard.release);
}

type GrowthRequestStartDeliveryResult = {
  accepted: boolean;
  purpose: "analytics" | "reminder" | null;
};

type GrowthRequestStartPurpose = Exclude<
  GrowthRequestStartDeliveryResult["purpose"],
  null
>;

type GrowthRequestStartDeliveryOptions = {
  reminderOptIn?: boolean;
  expectedUserId?: string;
  requestedPurpose?: GrowthRequestStartPurpose;
};

async function deliverGrowthRequestStarted(
  attemptId: string,
  options: GrowthRequestStartDeliveryOptions = {},
): Promise<GrowthRequestStartDeliveryResult> {
  if (!options.expectedUserId) {
    return { accepted: false, purpose: null };
  }
  const requestedPurpose = options.requestedPurpose ??
    (options.reminderOptIn ? "reminder" : "analytics");
  const decision = requestedPurpose === "reminder"
    ? options.reminderOptIn
      ? {
          allowed: true,
          includeVisitorId: false,
          purpose: "reminder" as const,
          consentVersion: "abandoned-request-v1" as const,
        }
      : {
          allowed: false,
          includeVisitorId: false,
          purpose: null,
          consentVersion: null,
        }
    : growthJourneyClientDecision(
        "request_started",
        readMeasurementConsentSnapshot(),
      );
  if (!decision.allowed || !decision.purpose || !decision.consentVersion) {
    return { accepted: false, purpose: null };
  }
  const visitorId =
    decision.includeVisitorId && typeof window !== "undefined"
      ? getOrCreateGrowthVisitorId()
      : null;
  const body = {
    action: "request_started",
    attemptId,
    purpose: decision.purpose,
    consentVersion: decision.consentVersion,
    ...(visitorId ? { visitorId } : {}),
  };
  const guard = createGrowthJourneyConsentGuard(
    "request_started",
    decision,
    options
  );
  const accepted = await runBoundedGrowthEventRetry(
    async (signal) =>
      acceptedGrowthEvent(await postAuthenticatedGrowthEvent(
        body,
        signal,
        options.expectedUserId
      )),
    { controller: guard.controller, shouldContinue: guard.isCurrent }
  ).finally(guard.release);
  return {
    accepted,
    purpose: decision.purpose === "analytics" ? "analytics" : "reminder",
  };
}

export async function recordGrowthRequestStarted(
  attemptId: string,
  options: { reminderOptIn?: boolean; expectedUserId?: string } = {},
) {
  const deliveries = [deliverGrowthRequestStarted(attemptId, {
    ...options,
    requestedPurpose: "analytics",
  })];
  if (options.reminderOptIn) {
    deliveries.push(deliverGrowthRequestStarted(attemptId, {
      ...options,
      requestedPurpose: "reminder",
    }));
  }
  return (await Promise.all(deliveries)).some((result) => result.accepted);
}

type GrowthRequestStartDelivery = (
  attemptId: string,
  options: GrowthRequestStartDeliveryOptions,
) => Promise<GrowthRequestStartDeliveryResult>;

export function createGrowthRequestStartDeliveryController(
  deliver: GrowthRequestStartDelivery = deliverGrowthRequestStarted,
) {
  let attemptId = "";
  let analyticsRecorded = false;
  let reminderRecorded = false;
  let expectedUserId = "";
  const inFlight = new Map<
    GrowthRequestStartPurpose,
    Promise<GrowthRequestStartDeliveryResult>
  >();

  const queuePurpose = async (
    purpose: GrowthRequestStartPurpose
  ): Promise<boolean> => {
    if (!attemptId) return false;
    if (purpose === "analytics" && analyticsRecorded) return true;
    if (purpose === "reminder" && reminderRecorded) return true;
    const active = inFlight.get(purpose);
    if (active) {
      const result = await active.catch(() => ({
        accepted: false,
        purpose: null,
      } as const));
      return result.accepted && result.purpose === purpose;
    }

    const delivery = Promise.resolve(
      deliver(attemptId, {
        reminderOptIn: purpose === "reminder",
        expectedUserId,
        requestedPurpose: purpose,
      })
    ).catch(() => ({ accepted: false, purpose: null } as const));
    inFlight.set(purpose, delivery);
    const result = await delivery;
    if (inFlight.get(purpose) === delivery) {
      inFlight.delete(purpose);
    }
    if (result.accepted && result.purpose === "analytics") {
      analyticsRecorded = true;
    } else if (result.accepted && result.purpose === "reminder") {
      reminderRecorded = true;
    }
    return result.accepted && result.purpose === purpose;
  };

  const queue = (mode: "consent" | "reminder") =>
    queuePurpose(mode === "reminder" ? "reminder" : "analytics");

  return {
    begin(
      nextAttemptId: string,
      reminderOptIn = false,
      nextExpectedUserId = ""
    ) {
      if (!attemptId) attemptId = nextAttemptId;
      if (!expectedUserId) expectedUserId = nextExpectedUserId;
      if (
        !attemptId ||
        attemptId !== nextAttemptId ||
        !expectedUserId ||
        expectedUserId !== nextExpectedUserId
      ) return Promise.resolve(false);
      const deliveries = [queue("consent")];
      if (reminderOptIn) deliveries.push(queue("reminder"));
      return Promise.all(deliveries).then((results) => results.some(Boolean));
    },
    retryAfterConsent() {
      return queue("consent");
    },
    requestReminder() {
      return queue("reminder");
    },
    hasRecorded() {
      return analyticsRecorded || reminderRecorded;
    },
    hasAnalyticsRecorded() {
      return analyticsRecorded;
    },
  };
}

export function recordGrowthRequestCreated(
  orderId: string,
  attemptId: string,
  expectedUserId?: string
) {
  if (!expectedUserId) return Promise.resolve(false);
  const decision = growthJourneyClientDecision(
    "request_created",
    readMeasurementConsentSnapshot(),
  );
  if (!decision.allowed || !decision.purpose || !decision.consentVersion) {
    return Promise.resolve(false);
  }
  const visitorId =
    decision.includeVisitorId && typeof window !== "undefined"
      ? getOrCreateGrowthVisitorId()
      : null;
  const body = {
    action: "request_created",
    orderId,
    attemptId,
    purpose: decision.purpose,
    consentVersion: decision.consentVersion,
    ...(visitorId ? { visitorId } : {}),
  };
  const guard = createGrowthJourneyConsentGuard("request_created", decision);
  return runBoundedGrowthEventRetry(
    async (signal) =>
      acceptedGrowthEvent(await postAuthenticatedGrowthEvent(
        body,
        signal,
        expectedUserId
      )),
    { controller: guard.controller, shouldContinue: guard.isCurrent }
  ).finally(guard.release);
}

export function updateGrowthReminderPreference(
  enabled: boolean,
  expectedUserId?: string
) {
  if (!expectedUserId) return Promise.resolve(null);
  return postAuthenticatedGrowthEvent({
    action: "reminder_preference",
    enabled,
    consentVersion: "abandoned-request-v1",
  }, undefined, expectedUserId);
}
