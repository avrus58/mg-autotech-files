let growthConsentEpoch = 0;
const growthConsentAbortControllers = new Set<AbortController>();
const growthConsentInvalidationListeners = new Set<() => void>();

export function captureGrowthConsentEpoch() {
  return growthConsentEpoch;
}

export function isGrowthConsentEpochCurrent(epoch: number) {
  return epoch === growthConsentEpoch;
}

export function registerGrowthConsentAbortController(
  controller: AbortController
) {
  growthConsentAbortControllers.add(controller);
  return () => growthConsentAbortControllers.delete(controller);
}

export function subscribeGrowthConsentInvalidation(listener: () => void) {
  growthConsentInvalidationListeners.add(listener);
  return () => {
    growthConsentInvalidationListeners.delete(listener);
  };
}

export function invalidateGrowthConsentOperations() {
  growthConsentEpoch += 1;
  for (const controller of growthConsentAbortControllers) {
    try {
      controller.abort();
    } catch {
      // The epoch still invalidates pending acknowledgements and retries.
    }
  }
  growthConsentAbortControllers.clear();
  for (const listener of growthConsentInvalidationListeners) {
    try {
      listener();
    } catch {
      // A UI listener must never prevent revocation or account-bound cleanup.
    }
  }
}
