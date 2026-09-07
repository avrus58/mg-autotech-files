import { isGoogleRegistrationProfileFinalizationWindowOpen } from "@/lib/registrationCompletion";

// Enrollment is user metadata; terminal status is server-owned app metadata.
// Neither value is used for authentication or authorization decisions.
export const CUSTOMER_GUIDE_KEY = "customer_guide_v1";
export type CustomerGuideDismissal = "completed" | "skipped";
export type CustomerGuideStatus = "pending" | CustomerGuideDismissal;

export function getCustomerGuideStatus(
  metadata: Record<string, unknown> | undefined,
): CustomerGuideStatus | null {
  const status = metadata?.[CUSTOMER_GUIDE_KEY];
  return status === "pending" || status === "completed" || status === "skipped"
    ? status
    : null;
}

export function enrollCustomerGuide(metadata?: Record<string, unknown>) {
  // Unknown future versions/values must not be overwritten either.
  return Object.prototype.hasOwnProperty.call(metadata ?? {}, CUSTOMER_GUIDE_KEY)
    ? { ...metadata }
    : { ...metadata, [CUSTOMER_GUIDE_KEY]: "pending" };
}

export function enrollFreshGoogleCustomerGuide(
  user: {
    created_at: string;
    app_metadata?: Record<string, unknown>;
    user_metadata?: Record<string, unknown>;
  },
  now = Date.now(),
) {
  return isGoogleRegistrationProfileFinalizationWindowOpen(user, now)
    ? enrollCustomerGuide(user.user_metadata)
    : { ...user.user_metadata };
}

export type CustomerGuideUser = {
  id: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
};

export function getEffectiveCustomerGuideStatus(user: CustomerGuideUser) {
  if (Object.prototype.hasOwnProperty.call(user.app_metadata ?? {}, CUSTOMER_GUIDE_KEY)) {
    const saved = getCustomerGuideStatus(user.app_metadata);
    // Only server-recorded terminal values are understood in app metadata.
    return saved === "completed" || saved === "skipped" ? saved : null;
  }
  return getCustomerGuideStatus(user.user_metadata);
}

export type CustomerGuideSnapshot = {
  visible: boolean;
  saving: boolean;
  saveFailed: boolean;
  step: number;
};

export const HIDDEN_CUSTOMER_GUIDE: CustomerGuideSnapshot = Object.freeze({
  visible: false,
  saving: false,
  saveFailed: false,
  step: -1,
});

type GuideStorage = Pick<Storage, "getItem" | "setItem">;
type ControllerOptions = {
  readUser: () => Promise<CustomerGuideUser | null>;
  persist: (
    expectedUserId: string,
    status: CustomerGuideDismissal,
  ) => Promise<CustomerGuideDismissal | null>;
  sessionStorage?: GuideStorage;
  operationTimeoutMs?: number;
};

function sessionKey(userId: string) {
  return `mg-customer-guide-v1:hidden:${encodeURIComponent(userId)}`;
}

function stepKey(userId: string) {
  return `mg-customer-guide-v1:step:${encodeURIComponent(userId)}`;
}

function isGuideStep(step: number) {
  return Number.isInteger(step) && step >= -1 && step <= 3;
}

/** Kept independent of React so account races and failure recovery are executable tests. */
export function createCustomerOnboardingController(options: ControllerOptions) {
  let snapshot = HIDDEN_CUSTOMER_GUIDE;
  let accountId: string | null = null;
  let epoch = 0;
  let readSequence = 0;
  let disposed = false;
  let lastDismissal: CustomerGuideDismissal | null = null;
  const locallyHidden = new Set<string>();
  const listeners = new Set<() => void>();
  const cancelOperations = new Set<() => void>();
  const bounded = <T>(operation: Promise<T>): Promise<T> => new Promise((resolve, reject) => {
    const cleanUp = () => {
      clearTimeout(timer);
      cancelOperations.delete(cancel);
    };
    const cancel = () => { cleanUp(); reject(new Error("guide_cancelled")); };
    const timer = setTimeout(() => {
      cleanUp();
      reject(new Error("guide_timeout"));
    }, options.operationTimeoutMs ?? 12_000);
    cancelOperations.add(cancel);
    operation.then(
      (value) => { cleanUp(); resolve(value); },
      (error) => { cleanUp(); reject(error); },
    );
  });

  const publish = (next: CustomerGuideSnapshot) => {
    if (disposed) return;
    snapshot = next;
    listeners.forEach((listener) => listener());
  };
  const current = (id: string, version: number) =>
    !disposed && accountId === id && epoch === version;
  const isHidden = (id: string) => {
    if (locallyHidden.has(id)) return true;
    try {
      return options.sessionStorage?.getItem(sessionKey(id)) === "1";
    } catch {
      return false;
    }
  };
  const rememberHidden = (id: string) => {
    locallyHidden.add(id);
    try {
      options.sessionStorage?.setItem(sessionKey(id), "1");
    } catch {
      // Unavailable browser storage never blocks the customer's workspace.
    }
  };
  const readStep = (id: string) => {
    try {
      const stored = options.sessionStorage?.getItem(stepKey(id));
      if (stored == null || !/^-?[0-3]$/.test(stored)) return -1;
      const step = Number(stored);
      return isGuideStep(step) ? step : -1;
    } catch { return -1; }
  };

  const refresh = async () => {
    const id = accountId;
    if (!id || disposed || snapshot.saving) return;
    const version = epoch;
    const sequence = ++readSequence;
    try {
      const user = await bounded(options.readUser());
      if (!current(id, version) || sequence !== readSequence) return;
      if (!user || user.id !== id) {
        publish(HIDDEN_CUSTOMER_GUIDE);
        return;
      }
      const pending = getEffectiveCustomerGuideStatus(user) === "pending";
      publish({
        visible: pending && !isHidden(id),
        saving: false,
        saveFailed: pending && snapshot.saveFailed,
        step: snapshot.step,
      });
    } catch {
      // Guide availability is not a login or workspace availability dependency.
      if (current(id, version) && sequence === readSequence) {
        publish(HIDDEN_CUSTOMER_GUIDE);
      }
    }
  };

  const dismiss = async (status: CustomerGuideDismissal): Promise<boolean> => {
    const id = accountId;
    if (!id || disposed || !snapshot.visible || snapshot.saving) return false;
    const version = epoch;
    ++readSequence;
    lastDismissal = status;
    publish({ ...snapshot, visible: true, saving: true, saveFailed: false });
    try {
      const user = await bounded(options.readUser());
      if (!current(id, version)) return false;
      if (!user || user.id !== id) {
        publish(HIDDEN_CUSTOMER_GUIDE);
        return false;
      }
      const existing = getEffectiveCustomerGuideStatus(user);
      if (existing === "completed" || existing === "skipped") {
        rememberHidden(id);
        publish(HIDDEN_CUSTOMER_GUIDE);
        return true;
      }
      if (existing !== "pending") {
        publish(HIDDEN_CUSTOMER_GUIDE);
        return false;
      }
      const saved = await bounded(options.persist(id, status));
      if (!current(id, version)) return false;
      if (saved !== "completed" && saved !== "skipped") throw new Error("guide_save_failed");
      rememberHidden(id);
      publish(HIDDEN_CUSTOMER_GUIDE);
      return true;
    } catch {
      if (current(id, version)) {
        publish({ ...snapshot, visible: true, saving: false, saveFailed: true });
      }
      return false;
    }
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    setAccount(id: string | null) {
      if (id === accountId || disposed) return;
      accountId = id;
      ++epoch;
      ++readSequence;
      cancelOperations.forEach((cancel) => cancel());
      lastDismissal = null;
      publish({ ...HIDDEN_CUSTOMER_GUIDE, step: id ? readStep(id) : -1 });
    },
    refresh,
    dismiss,
    moveToStep(step: number) {
      if (!accountId || disposed || !snapshot.visible || snapshot.saving || !isGuideStep(step)) return;
      try { options.sessionStorage?.setItem(stepKey(accountId), String(step)); } catch { /* Current view still progresses. */ }
      publish({ ...snapshot, step });
    },
    retryDismiss: () => lastDismissal ? dismiss(lastDismissal) : Promise.resolve(false),
    hideForSession() {
      if (!accountId || disposed || snapshot.saving) return;
      rememberHidden(accountId);
      ++readSequence;
      publish(HIDDEN_CUSTOMER_GUIDE);
    },
    dispose() {
      disposed = true;
      ++epoch;
      cancelOperations.forEach((cancel) => cancel());
      listeners.clear();
    },
  };
}

export function parseCustomerGuideDismissal(value: unknown): {
  expectedUserId: string;
  status: CustomerGuideDismissal;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).length !== 2 ||
      typeof input.expectedUserId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.expectedUserId) ||
      (input.status !== "completed" && input.status !== "skipped")) return null;
  return { expectedUserId: input.expectedUserId, status: input.status };
}

export async function saveCustomerGuideDismissal(input: {
  user: CustomerGuideUser;
  expectedUserId: string;
  status: CustomerGuideDismissal;
  write: (id: string, metadata: Record<string, unknown>) => Promise<CustomerGuideUser | null>;
}): Promise<{ status: CustomerGuideDismissal } | { errorCode: string; statusCode: number }> {
  if (input.user.id !== input.expectedUserId) {
    return { errorCode: "account_changed", statusCode: 409 };
  }
  const existing = getEffectiveCustomerGuideStatus(input.user);
  if (existing === "completed" || existing === "skipped") return { status: existing };
  if (existing !== "pending") return { errorCode: "guide_not_available", statusCode: 409 };
  // Supabase merges app_metadata. Only the preference key is sent, preserving
  // provider/security claims and resisting stale user_metadata profile replays.
  const saved = await input.write(input.user.id, { [CUSTOMER_GUIDE_KEY]: input.status });
  const status = getCustomerGuideStatus(saved?.app_metadata);
  if (saved?.id !== input.user.id || (status !== "completed" && status !== "skipped")) {
    return { errorCode: "guide_save_failed", statusCode: 503 };
  }
  return { status };
}
