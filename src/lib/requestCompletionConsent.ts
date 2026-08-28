import type { MeasurementConsentSnapshot } from "@/lib/publicAnalytics";

type RequestCompletionConsentHandoffOptions = {
  readConsent: () => MeasurementConsentSnapshot;
  flushConsentedFirstParty?: () => Promise<unknown>;
  flushVerifiedConversions: () => Promise<unknown>;
  navigate: () => void;
  timeoutMs?: number;
};

const defaultRequestCompletionHandoffTimeoutMs = 2_500;

async function runBoundedHandoff(
  operation: () => Promise<unknown>,
  timeoutMs: number,
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    await Promise.race([
      Promise.resolve().then(operation).catch(() => undefined),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } catch {
    // Optional measurement must never block access to the completed request.
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

/**
 * Creates a single-use handoff for a request that has already been accepted.
 * The caller may check once before a choice exists, then retry from the explicit
 * consent-change event. No request, account or attribution identifier is kept.
 */
export function createRequestCompletionConsentHandoff({
  readConsent,
  flushConsentedFirstParty,
  flushVerifiedConversions,
  navigate,
  timeoutMs = defaultRequestCompletionHandoffTimeoutMs,
}: RequestCompletionConsentHandoffOptions) {
  let completed = false;
  const boundedTimeoutMs = Number.isFinite(timeoutMs)
    ? Math.max(0, Math.min(timeoutMs, defaultRequestCompletionHandoffTimeoutMs))
    : defaultRequestCompletionHandoffTimeoutMs;

  return async function continueAfterConsent(explicitChoice = false) {
    if (completed) return false;

    let consent: MeasurementConsentSnapshot | null = null;
    try {
      consent = readConsent();
    } catch {
      // A blocked storage API is treated as Necessary-only after an explicit
      // choice so the customer can still reach the dashboard.
    }
    if ((!consent || consent.needsDecision) && !explicitChoice) return false;

    completed = true;
    if (consent && !consent.needsDecision) {
      const analyticsGranted = consent.preferences.analytics;
      const optionalMeasurementGranted =
        analyticsGranted || consent.preferences.advertising;
      if (optionalMeasurementGranted) {
        await runBoundedHandoff(async () => {
          await Promise.all([
            analyticsGranted && flushConsentedFirstParty
              ? flushConsentedFirstParty()
              : Promise.resolve(),
            flushVerifiedConversions(),
          ]);
        }, boundedTimeoutMs);
      }
    }

    navigate();
    return true;
  };
}
