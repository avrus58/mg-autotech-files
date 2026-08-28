"use client";

import { hasAnalyticsConsent } from "@/lib/publicAnalytics";
import {
  buildGrowthAttributionTouch,
  growthAttributionTouchKey,
  growthConsentVersion,
  growthVisitorStorageKey,
  isGrowthVisitorId,
  normalizeGrowthAttributionTouch,
} from "@/lib/growth/attribution";
import type { GrowthAttributionTouch } from "@/lib/growth/types";
import {
  captureGrowthConsentEpoch,
  invalidateGrowthConsentOperations,
  isGrowthConsentEpochCurrent,
  registerGrowthConsentAbortController,
} from "@/lib/growth/consentLifecycle";

function analyticsAllowed() {
  return hasAnalyticsConsent();
}

const growthAttributionRequestTimeoutMs = 4_000;
export const growthAttributionOutboxStorageKey = "mg_growth_attribution_outbox_v1";
export const growthAttributionRevocationStorageKey =
  "mg_growth_attribution_revocation_v1";
const growthAttributionOutboxTtlMs = 30 * 60 * 1000;
const growthAttributionOutboxLimit = 6;
type GrowthAttributionOutboxEntry = {
  version: 2;
  deliveryId: string;
  touch: GrowthAttributionTouch;
  createdAt: number;
};
let growthAttributionFlushInFlight: Promise<string[]> | null = null;
const growthAttributionDeliveriesInFlight = new Map<string, Promise<boolean>>();
const growthAttributionDeliveryIds = new Map<string, string>();
type GrowthAttributionRevocationTombstone = {
  owner: Window;
  epoch: number;
  marker: string;
  localMarkerPersisted: boolean;
  sessionMarkerPersisted: boolean;
  visitorStorageSanitized: boolean;
  outboxStorageSanitized: boolean;
  visitorId: string | null;
  outbox: GrowthAttributionOutboxEntry[];
};
let growthAttributionRevocationEpoch = 0;
let growthAttributionRevocationTombstone: GrowthAttributionRevocationTombstone | null = null;

function readGrowthAttributionRevocationMarker(
  storage: Pick<Storage, "getItem"> | null
) {
  if (!storage) return { readable: false, value: null };
  try {
    const value = storage.getItem(growthAttributionRevocationStorageKey);
    return { readable: true, value: value?.trim() || null };
  } catch {
    return { readable: false, value: null };
  }
}

function growthAttributionStorage(kind: "localStorage" | "sessionStorage") {
  try {
    return window[kind] as Storage;
  } catch {
    return null;
  }
}

function currentGrowthAttributionRevocationTombstone() {
  if (typeof window === "undefined") return null;
  if (
    growthAttributionRevocationTombstone?.owner === window &&
    growthAttributionRevocationTombstone.epoch === growthAttributionRevocationEpoch
  ) return growthAttributionRevocationTombstone;

  const localMarker = readGrowthAttributionRevocationMarker(
    growthAttributionStorage("localStorage")
  );
  const sessionMarker = readGrowthAttributionRevocationMarker(
    growthAttributionStorage("sessionStorage")
  );
  const marker = localMarker.value ?? sessionMarker.value;
  if (!marker && (localMarker.readable || sessionMarker.readable)) return null;

  growthAttributionRevocationEpoch += 1;
  growthAttributionRevocationTombstone = {
    owner: window,
    epoch: growthAttributionRevocationEpoch,
    marker: marker ?? `blocked:${growthAttributionRevocationEpoch}`,
    localMarkerPersisted: Boolean(localMarker.value),
    sessionMarkerPersisted: Boolean(sessionMarker.value),
    visitorStorageSanitized: false,
    outboxStorageSanitized: false,
    visitorId: null,
    outbox: [],
  };
  return growthAttributionRevocationTombstone;
}

function writeGrowthAttributionRevocationMarker(
  storage: Pick<Storage, "setItem"> | null,
  marker: string
) {
  if (!storage) return false;
  try {
    storage.setItem(growthAttributionRevocationStorageKey, marker);
    return true;
  } catch {
    return false;
  }
}

function removeGrowthAttributionRevocationMarker(
  storage: Pick<Storage, "removeItem"> | null
) {
  if (!storage) return false;
  try {
    storage.removeItem(growthAttributionRevocationStorageKey);
    return true;
  } catch {
    return false;
  }
}

function removeOrInvalidateGrowthAttributionStorage(
  key: string,
  invalidValue: string
) {
  const storage = growthAttributionStorage("localStorage");
  if (!storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    try {
      storage.setItem(key, invalidValue);
      return true;
    } catch {
      return false;
    }
  }
}

function markGrowthAttributionStorageRevoked() {
  growthAttributionRevocationEpoch += 1;
  let marker: string;
  try {
    marker = `v1:${Date.now()}:${window.crypto.randomUUID()}`;
  } catch {
    marker = `v1:${Date.now()}:${growthAttributionRevocationEpoch}`;
  }
  const localMarkerPersisted = writeGrowthAttributionRevocationMarker(
    growthAttributionStorage("localStorage"),
    marker
  );
  const sessionMarkerPersisted = writeGrowthAttributionRevocationMarker(
    growthAttributionStorage("sessionStorage"),
    marker
  );
  const visitorStorageSanitized = removeOrInvalidateGrowthAttributionStorage(
    growthVisitorStorageKey,
    ""
  );
  const outboxStorageSanitized = removeOrInvalidateGrowthAttributionStorage(
    growthAttributionOutboxStorageKey,
    "[]"
  );
  growthAttributionRevocationTombstone = {
    owner: window,
    epoch: growthAttributionRevocationEpoch,
    marker,
    localMarkerPersisted,
    sessionMarkerPersisted,
    visitorStorageSanitized,
    outboxStorageSanitized,
    visitorId: null,
    outbox: [],
  };
  return growthAttributionRevocationTombstone;
}

function retireGrowthAttributionRevocationMarker(
  tombstone: GrowthAttributionRevocationTombstone
) {
  if (!tombstone.visitorStorageSanitized || !tombstone.outboxStorageSanitized) {
    return;
  }
  if (removeGrowthAttributionRevocationMarker(
    growthAttributionStorage("localStorage")
  )) {
    tombstone.localMarkerPersisted = false;
  }
  if (removeGrowthAttributionRevocationMarker(
    growthAttributionStorage("sessionStorage")
  )) {
    tombstone.sessionMarkerPersisted = false;
  }
}

function boundedGrowthAttributionTimeout(timeoutMs?: number) {
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return growthAttributionRequestTimeoutMs;
  }
  return Math.min(timeoutMs, growthAttributionRequestTimeoutMs);
}

export function getOrCreateGrowthVisitorId() {
  if (typeof window === "undefined" || !analyticsAllowed()) return null;
  const tombstone = currentGrowthAttributionRevocationTombstone();
  if (tombstone?.visitorId) return tombstone.visitorId;
  try {
    if (!tombstone) {
      const existing = window.localStorage.getItem(growthVisitorStorageKey) ?? "";
      if (isGrowthVisitorId(existing)) return existing;
    }
    const created = window.crypto.randomUUID();
    if (!isGrowthVisitorId(created)) return null;
    if (tombstone) {
      try {
        window.localStorage.setItem(growthVisitorStorageKey, created);
        tombstone.visitorStorageSanitized = true;
      } catch {
        // A durable marker can still protect a fresh in-memory identity.
      }
      if (!tombstone.outboxStorageSanitized) {
        writeGrowthAttributionOutbox(tombstone.outbox);
      }
      const protectedFromRevokedStorage =
        tombstone.localMarkerPersisted ||
        tombstone.sessionMarkerPersisted ||
        (tombstone.visitorStorageSanitized && tombstone.outboxStorageSanitized);
      if (!protectedFromRevokedStorage) return null;
      tombstone.visitorId = created;
      retireGrowthAttributionRevocationMarker(tombstone);
      return created;
    }
    window.localStorage.setItem(growthVisitorStorageKey, created);
    return created;
  } catch {
    return null;
  }
}

/**
 * Returns only a consented visitor identity that was already established by a
 * public attribution touch. Authentication alone must not manufacture a new
 * analytics identity on a private route.
 */
export function readExistingGrowthVisitorId() {
  if (typeof window === "undefined" || !analyticsAllowed()) return null;
  const tombstone = currentGrowthAttributionRevocationTombstone();
  if (tombstone) return tombstone.visitorId;
  try {
    const existing = window.localStorage.getItem(growthVisitorStorageKey) ?? "";
    return isGrowthVisitorId(existing) ? existing : null;
  } catch {
    return null;
  }
}

export function clearGrowthVisitorId() {
  if (typeof window === "undefined") return;
  markGrowthAttributionStorageRevoked();
  invalidateGrowthConsentOperations();
  growthAttributionDeliveriesInFlight.clear();
  growthAttributionDeliveryIds.clear();
  growthAttributionFlushInFlight = null;
}

function readGrowthAttributionOutbox(now = Date.now()) {
  if (typeof window === "undefined") return [] as GrowthAttributionOutboxEntry[];
  const tombstone = currentGrowthAttributionRevocationTombstone();
  let parsed: unknown = tombstone?.outbox ?? [];
  if (!tombstone) {
    try {
      parsed = JSON.parse(
        window.localStorage.getItem(growthAttributionOutboxStorageKey) ?? "[]"
      );
    } catch {
      parsed = [];
    }
  }
  const entries = Array.isArray(parsed)
    ? parsed.flatMap((candidate) => {
        if (!candidate || typeof candidate !== "object") return [];
        const entry = candidate as {
          version?: 1 | 2;
          deliveryId?: unknown;
          touch?: unknown;
          createdAt?: unknown;
        };
        const touch = normalizeGrowthAttributionTouch(entry.touch);
        const deliveryId = entry.version === 2 &&
          typeof entry.deliveryId === "string" &&
          isGrowthVisitorId(entry.deliveryId)
            ? entry.deliveryId
            : entry.version === 1
              ? createGrowthAttributionDeliveryId()
              : null;
        if (
          !deliveryId ||
          !touch ||
          typeof entry.createdAt !== "number" ||
          !Number.isFinite(entry.createdAt) ||
          entry.createdAt <= 0 ||
          entry.createdAt > now + 60_000 ||
          now - entry.createdAt > growthAttributionOutboxTtlMs
        ) return [];
        return [{
          version: 2 as const,
          deliveryId,
          touch,
          createdAt: entry.createdAt,
        }];
      })
    : [];
  const unique = new Map<string, GrowthAttributionOutboxEntry>();
  for (const entry of entries.slice(-growthAttributionOutboxLimit)) {
    unique.set(growthAttributionTouchKey(entry.touch), entry);
  }
  const normalized = [...unique.values()];
  for (const entry of normalized) {
    growthAttributionDeliveryIds.set(
      growthAttributionTouchKey(entry.touch),
      entry.deliveryId
    );
  }
  writeGrowthAttributionOutbox(normalized);
  return normalized;
}

function createGrowthAttributionDeliveryId() {
  if (typeof window === "undefined") return null;
  try {
    const deliveryId = window.crypto.randomUUID();
    return isGrowthVisitorId(deliveryId) ? deliveryId : null;
  } catch {
    return null;
  }
}

function writeGrowthAttributionOutbox(entries: GrowthAttributionOutboxEntry[]) {
  if (typeof window === "undefined") return;
  const bounded = entries.slice(-growthAttributionOutboxLimit);
  const tombstone = currentGrowthAttributionRevocationTombstone();
  if (tombstone) tombstone.outbox = bounded;
  let persisted = false;
  try {
    if (!bounded.length) {
      window.localStorage.removeItem(growthAttributionOutboxStorageKey);
      persisted = true;
    } else {
      window.localStorage.setItem(
        growthAttributionOutboxStorageKey,
        JSON.stringify(bounded)
      );
      persisted = true;
    }
  } catch {
    if (!bounded.length) {
      try {
        window.localStorage.setItem(growthAttributionOutboxStorageKey, "[]");
        persisted = true;
      } catch {
        // Blocked optional storage leaves attribution fail-soft.
      }
    }
  }
  if (tombstone && persisted) {
    tombstone.outboxStorageSanitized = true;
  }
}

function queueGrowthAttributionTouch(touch: GrowthAttributionTouch) {
  if (typeof window === "undefined" || !analyticsAllowed()) return null;
  const entries = readGrowthAttributionOutbox();
  const key = growthAttributionTouchKey(touch);
  const existing = entries.find(
    (entry) => growthAttributionTouchKey(entry.touch) === key
  );
  const deliveryId = existing?.deliveryId ??
    growthAttributionDeliveryIds.get(key) ??
    createGrowthAttributionDeliveryId();
  if (!deliveryId) return null;
  const entry: GrowthAttributionOutboxEntry = {
    version: 2,
    deliveryId,
    touch,
    createdAt: existing?.createdAt ?? Date.now(),
  };
  growthAttributionDeliveryIds.set(key, deliveryId);
  writeGrowthAttributionOutbox([
    ...entries.filter((entry) => growthAttributionTouchKey(entry.touch) !== key),
    entry,
  ]);
  return entry;
}

function removeGrowthAttributionTouch(touch: GrowthAttributionTouch) {
  const key = growthAttributionTouchKey(touch);
  growthAttributionDeliveryIds.delete(key);
  writeGrowthAttributionOutbox(
    readGrowthAttributionOutbox().filter(
      (entry) => growthAttributionTouchKey(entry.touch) !== key
    )
  );
}

export function captureGrowthAttributionTouch() {
  if (typeof window === "undefined") return null;
  return buildGrowthAttributionTouch({
    url: window.location.href,
    referrer: typeof document === "undefined" ? "" : document.referrer,
    locale: window.navigator?.language ?? null,
  });
}

async function performGrowthAttributionTouchDelivery(
  capturedTouch: GrowthAttributionTouch,
  visitorId: string,
  deliveryId: string,
  options?: { timeoutMs?: number }
) {
  try {
    let controller: AbortController | null = null;
    let unregisterAbortController: (() => boolean) | null = null;
    try {
      controller = new AbortController();
      unregisterAbortController = registerGrowthConsentAbortController(controller);
    } catch {
      // Promise.race below still bounds browsers without AbortController.
    }

    let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;
    const timeout = new Promise<boolean>((resolve) => {
      timeoutId = globalThis.setTimeout(() => {
        try {
          controller?.abort();
        } catch {
          // A non-standard AbortController must not strand attribution recovery.
        }
        resolve(false);
      }, boundedGrowthAttributionTimeout(options?.timeoutMs));
    });

    const request = Promise.resolve()
      .then(async () => {
        const response = await fetch("/api/growth/journey", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "attribution_touch",
            visitorId,
            deliveryId,
            consent: "granted",
            consentVersion: growthConsentVersion,
            ...capturedTouch,
          }),
          keepalive: true,
          cache: "no-store",
          ...(controller ? { signal: controller.signal } : {}),
        });
        if (!response.ok) return false;
        const acknowledgement = await response.json().catch(() => null) as unknown;
        return Boolean(
          acknowledgement &&
          typeof acknowledgement === "object" &&
          (acknowledgement as { accepted?: unknown }).accepted === true
        );
      })
      .catch(() => false);

    try {
      return await Promise.race([request, timeout]);
    } finally {
      if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId);
      unregisterAbortController?.();
    }
  } catch {
    return false;
  }
}

function deliverGrowthAttributionTouch(
  capturedTouch: GrowthAttributionTouch,
  deliveryId: string,
  options?: { timeoutMs?: number }
) {
  if (typeof window === "undefined" || !analyticsAllowed()) {
    return Promise.resolve(false);
  }
  const visitorId = getOrCreateGrowthVisitorId();
  if (!visitorId) return Promise.resolve(false);
  const deliveryKey = `${visitorId}:${growthAttributionTouchKey(capturedTouch)}`;
  const inFlight = growthAttributionDeliveriesInFlight.get(deliveryKey);
  if (inFlight) return inFlight;
  const delivery = performGrowthAttributionTouchDelivery(
    capturedTouch,
    visitorId,
    deliveryId,
    options
  ).finally(() => {
    if (growthAttributionDeliveriesInFlight.get(deliveryKey) === delivery) {
      growthAttributionDeliveriesInFlight.delete(deliveryKey);
    }
  });
  growthAttributionDeliveriesInFlight.set(deliveryKey, delivery);
  return delivery;
}

export async function recordGrowthAttributionTouch(
  capturedTouch = captureGrowthAttributionTouch(),
  options?: { timeoutMs?: number }
) {
  const touch = normalizeGrowthAttributionTouch(capturedTouch);
  if (typeof window === "undefined" || !analyticsAllowed() || !touch) return false;
  const pending = queueGrowthAttributionTouch(touch);
  if (!pending) return false;
  const consentEpoch = captureGrowthConsentEpoch();
  const acknowledged = await deliverGrowthAttributionTouch(
    touch,
    pending.deliveryId,
    options
  );
  if (!isGrowthConsentEpochCurrent(consentEpoch) || !analyticsAllowed()) {
    return false;
  }
  if (acknowledged) removeGrowthAttributionTouch(touch);
  return acknowledged;
}

export function flushGrowthAttributionOutbox(
  options?: { timeoutMs?: number }
): Promise<string[]> {
  if (growthAttributionFlushInFlight) return growthAttributionFlushInFlight;
  const consentEpoch = captureGrowthConsentEpoch();
  const flush = (async () => {
    if (typeof window === "undefined" || !analyticsAllowed()) return [];
    const acknowledgedKeys: string[] = [];
    for (const entry of readGrowthAttributionOutbox()) {
      if (
        !isGrowthConsentEpochCurrent(consentEpoch) ||
        !analyticsAllowed()
      ) break;
      const acknowledged = await deliverGrowthAttributionTouch(
        entry.touch,
        entry.deliveryId,
        options
      );
      if (
        !isGrowthConsentEpochCurrent(consentEpoch) ||
        !analyticsAllowed()
      ) break;
      if (acknowledged) {
        removeGrowthAttributionTouch(entry.touch);
        acknowledgedKeys.push(growthAttributionTouchKey(entry.touch));
      }
    }
    return acknowledgedKeys;
  })().finally(() => {
    if (growthAttributionFlushInFlight === flush) {
      growthAttributionFlushInFlight = null;
    }
  });
  growthAttributionFlushInFlight = flush;
  return flush;
}
