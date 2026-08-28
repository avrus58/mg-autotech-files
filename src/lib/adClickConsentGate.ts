import {
  googleAdsLinkerStorageKey,
  isGoogleAdsLinkerStateRevoked,
  isGoogleMeasurementPublicPath,
  isSafeGoogleAdsClickSignalValue,
} from "@/lib/publicAnalytics";
import { parseRequestIntent } from "@/lib/requestIntent";
import { getSafeLocalRedirectPath } from "@/lib/safeLocalRedirect";

export const adClickConsentGateMaxWaitMs = 2_500;
export const adClickSignalMaxLength = 200;

const productionOrigin = "https://file.mgautotech.de";
const adClickSignalKeys = ["gclid", "dclid", "wbraid", "gbraid"] as const;
const protectedAdsQueryKeys = new Set(["_gl", ...adClickSignalKeys]);
const gatedDestinationPaths = new Set(["/register", "/login", "/new-request"]);

export type AdClickConsentChoice = "necessary" | "analytics" | "advertising";

export type AdClickConsentPreferences = {
  analytics: boolean;
  advertising: boolean;
};

export type AdClickConsentSnapshot = {
  needsDecision: boolean;
  preferences: AdClickConsentPreferences;
};

export type AdClickConsentNavigation = {
  destination: string;
  isConversionEntry: boolean;
  opensPrivacyInNewTab: boolean;
};

function hasOneBoundedValue(params: URLSearchParams, key: string) {
  return params
    .getAll(key)
    .some(isSafeGoogleAdsClickSignalValue);
}

export function hasRecognizedAdClickSignal(search: string) {
  const params = new URLSearchParams(search);
  return adClickSignalKeys.some((key) => hasOneBoundedValue(params, key));
}

export function hasProtectedAdsQueryKey(search: string) {
  const params = new URLSearchParams(search);
  return [...params.keys()].some((key) =>
    protectedAdsQueryKeys.has(key.toLowerCase())
  );
}

export function isAdClickConsentLanding(href: string) {
  try {
    const url = new URL(href);
    return (
      url.origin === productionOrigin &&
      isGoogleMeasurementPublicPath(url.pathname) &&
      hasRecognizedAdClickSignal(url.search)
    );
  } catch {
    return false;
  }
}

function isSafeLoginOrRegisterQuery(url: URL) {
  if (!url.search) return true;
  if ([...url.searchParams.keys()].some((key) => key !== "redirect")) return false;
  const redirects = url.searchParams.getAll("redirect");
  if (redirects.length !== 1) return false;
  const redirect = getSafeLocalRedirectPath(redirects[0]);
  if (!redirect) return false;
  try {
    const parsed = new URL(redirect, productionOrigin);
    return !hasProtectedAdsQueryKey(parsed.search);
  } catch {
    return false;
  }
}

function isSafeNewRequestQuery(url: URL) {
  if (!url.search) return true;
  if ([...url.searchParams.keys()].some((key) => key !== "intent")) return false;
  const intents = url.searchParams.getAll("intent");
  return intents.length === 1 && parseRequestIntent(intents[0]) !== null;
}

export function getAdClickConsentNavigation(
  href: string,
  currentHref: string
): AdClickConsentNavigation | null {
  try {
    const current = new URL(currentHref);
    const destination = new URL(href, current);
    if (
      !isAdClickConsentLanding(current.href) ||
      destination.origin !== current.origin ||
      destination.username ||
      destination.password ||
      destination.href === current.href ||
      hasProtectedAdsQueryKey(destination.search)
    ) {
      return null;
    }

    const sameDocumentFragment = Boolean(
      destination.hash &&
        destination.pathname === current.pathname &&
        destination.search === current.search
    );
    if (sameDocumentFragment) return null;

    const isConversionEntry = gatedDestinationPaths.has(destination.pathname);
    if (isConversionEntry) {
      if (destination.hash) return null;
      const safeQuery =
        destination.pathname === "/new-request"
          ? isSafeNewRequestQuery(destination)
          : isSafeLoginOrRegisterQuery(destination);
      if (!safeQuery) return null;
    }

    const localDestination = `${destination.pathname}${destination.search}${destination.hash}`;
    if (localDestination.length === 0 || localDestination.length > 2_048) return null;

    return {
      destination: localDestination,
      isConversionEntry,
      opensPrivacyInNewTab: destination.pathname === "/datenschutz",
    };
  } catch {
    return null;
  }
}

export function getAdClickConsentDestination(href: string, currentHref: string) {
  const navigation = getAdClickConsentNavigation(href, currentHref);
  return navigation?.isConversionEntry ? navigation.destination : null;
}

export function consumePreHydrationAdClickNavigation(input: {
  pendingDestination: string;
  currentHref: string;
  begin: (destination: string) => boolean;
  navigate: (destination: string) => void;
}) {
  const navigation = getAdClickConsentNavigation(
    input.pendingDestination,
    input.currentHref
  );
  if (!navigation || navigation.opensPrivacyInNewTab) return false;
  if (!input.begin(navigation.destination)) {
    input.navigate(navigation.destination);
  }
  return true;
}

export function isUnmodifiedSelfNavigation(input: {
  button: number;
  defaultPrevented: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  target: string | null;
  download: boolean;
}) {
  const target = input.target?.trim().toLowerCase() ?? "";
  return (
    input.button === 0 &&
    !input.defaultPrevented &&
    !input.metaKey &&
    !input.ctrlKey &&
    !input.shiftKey &&
    !input.altKey &&
    !input.download &&
    (target === "" || target === "_self")
  );
}

export function hasGoogleAdsLinkerState(input?: {
  cookieHeader?: string;
  storage?: Pick<Storage, "getItem" | "length" | "key"> | null;
}) {
  if (isGoogleAdsLinkerStateRevoked()) return false;

  try {
    const cookieHeader = input?.cookieHeader ?? document.cookie;
    if (/(?:^|;\s*)_gcl_[^=;\s]+=/i.test(cookieHeader)) return true;
  } catch {
    // Cookie access can be blocked without trapping navigation.
  }

  try {
    const storage = input?.storage === undefined ? window.localStorage : input.storage;
    if (!storage) return false;
    for (let index = 0; index < storage.length; index += 1) {
      if (
        storage.key(index) === googleAdsLinkerStorageKey &&
        Boolean(storage.getItem(googleAdsLinkerStorageKey))
      ) {
        return true;
      }
    }
  } catch {
    // Storage access can be blocked without trapping navigation.
  }
  return false;
}

export function waitForGoogleAdsLinkerReady(input: {
  isReady: () => boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
  pollIntervalMs?: number;
}) {
  const timeoutMs = Math.max(
    0,
    Math.min(input.timeoutMs ?? adClickConsentGateMaxWaitMs, adClickConsentGateMaxWaitMs)
  );
  const pollIntervalMs = Math.max(5, Math.min(input.pollIntervalMs ?? 40, 250));

  return new Promise<"ready" | "timeout" | "cancelled">((resolve) => {
    let finished = false;
    let pollTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
    let timeoutTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

    const finish = (result: "ready" | "timeout" | "cancelled") => {
      if (finished) return;
      finished = true;
      if (pollTimer !== null) globalThis.clearTimeout(pollTimer);
      if (timeoutTimer !== null) globalThis.clearTimeout(timeoutTimer);
      input.signal?.removeEventListener("abort", cancel);
      resolve(result);
    };
    const cancel = () => finish("cancelled");
    const poll = () => {
      if (input.signal?.aborted) {
        cancel();
        return;
      }
      let ready = false;
      try {
        ready = input.isReady();
      } catch {
        ready = false;
      }
      if (ready) {
        finish("ready");
        return;
      }
      pollTimer = globalThis.setTimeout(poll, pollIntervalMs);
    };

    input.signal?.addEventListener("abort", cancel, { once: true });
    if (input.signal?.aborted) {
      cancel();
      return;
    }
    timeoutTimer = globalThis.setTimeout(() => finish("timeout"), timeoutMs);
    poll();
  });
}

export function preferencesForAdClickConsentChoice(
  choice: AdClickConsentChoice
): AdClickConsentPreferences {
  if (choice === "necessary") return { analytics: false, advertising: false };
  if (choice === "analytics") return { analytics: true, advertising: false };
  return { analytics: true, advertising: true };
}

export function createAdClickConsentGateController(input: {
  readConsent: () => AdClickConsentSnapshot;
  persistConsent: (preferences: AdClickConsentPreferences) => void;
  configureMeasurement: (preferences: AdClickConsentPreferences) => void;
  prepareConsentedNavigation?: (
    destination: string,
    preferences: AdClickConsentPreferences,
    signal: AbortSignal
  ) => Promise<unknown>;
  waitForAdsReady: (signal: AbortSignal) => Promise<unknown>;
  navigate: (destination: string) => void;
  onPendingChange: (destination: string | null) => void;
}) {
  let pendingDestination: string | null = null;
  let active = true;
  let completing = false;
  let navigated = false;
  let generation = 0;
  let abortController: AbortController | null = null;

  const publishPending = (destination: string | null) => {
    pendingDestination = destination;
    input.onPendingChange(destination);
  };
  const navigateOnce = (destination: string, expectedGeneration: number) => {
    if (!active || navigated || generation !== expectedGeneration) return;
    navigated = true;
    completing = false;
    publishPending(null);
    input.navigate(destination);
  };
  const beginConsentedCompletion = (
    destination: string,
    preferences: AdClickConsentPreferences,
    expectedGeneration: number
  ) => {
    completing = true;
    try {
      abortController = new AbortController();
    } catch {
      navigateOnce(destination, expectedGeneration);
      return;
    }
    try {
      input.configureMeasurement(preferences);
    } catch {
      // The bounded readiness wait remains the fail-open navigation deadline.
    }
    const signal = abortController.signal;
    const tasks: Array<Promise<unknown>> = [];
    if (preferences.analytics && input.prepareConsentedNavigation) {
      tasks.push(
        Promise.resolve()
          .then(() => input.prepareConsentedNavigation?.(
            destination,
            preferences,
            signal
          ))
          .catch(() => undefined)
      );
    }
    if (preferences.advertising) {
      tasks.push(
        Promise.resolve()
          .then(() => input.waitForAdsReady(signal))
          .catch(() => undefined)
      );
    }

    let timeoutTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
    const timeout = new Promise<void>((resolve) => {
      timeoutTimer = globalThis.setTimeout(resolve, adClickConsentGateMaxWaitMs);
    });
    const aborted = new Promise<void>((resolve) => {
      if (signal.aborted) resolve();
      else signal.addEventListener("abort", () => resolve(), { once: true });
    });
    void Promise.race([Promise.allSettled(tasks), timeout, aborted])
      .finally(() => {
        if (timeoutTimer !== null) globalThis.clearTimeout(timeoutTimer);
        navigateOnce(destination, expectedGeneration);
      });
  };

  return {
    begin(destination: string) {
      if (!active || navigated) return false;
      if (pendingDestination || completing) return true;
      generation += 1;
      const expectedGeneration = generation;
      let consent: AdClickConsentSnapshot;
      try {
        consent = input.readConsent();
      } catch {
        return false;
      }
      if (consent.needsDecision) {
        publishPending(destination);
        return true;
      }
      if (consent.preferences.analytics || consent.preferences.advertising) {
        publishPending(destination);
        beginConsentedCompletion(destination, consent.preferences, expectedGeneration);
        return true;
      }
      return false;
    },
    choose(choice: AdClickConsentChoice) {
      if (!active || navigated || completing || !pendingDestination) return false;
      const destination = pendingDestination;
      const expectedGeneration = generation;
      const preferences = preferencesForAdClickConsentChoice(choice);
      input.persistConsent(preferences);
      if (preferences.analytics || preferences.advertising) {
        beginConsentedCompletion(destination, preferences, expectedGeneration);
      } else {
        navigateOnce(destination, expectedGeneration);
      }
      return true;
    },
    cancel() {
      if (!active || navigated || !pendingDestination) return false;
      generation += 1;
      abortController?.abort();
      abortController = null;
      completing = false;
      publishPending(null);
      return true;
    },
    dispose() {
      if (!active) return;
      active = false;
      generation += 1;
      abortController?.abort();
      abortController = null;
      completing = false;
      if (pendingDestination !== null) publishPending(null);
    },
    hasPendingNavigation() {
      return pendingDestination !== null;
    },
  };
}
