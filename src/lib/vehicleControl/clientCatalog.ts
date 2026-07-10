"use client";

export type VehicleSelectOption = {
  id: string;
  name: string;
  fuelType?: string | null;
};

const clientCacheTtlMs = 15 * 60_000;
const memoryCache = new Map<string, { expiresAt: number; options: VehicleSelectOption[] }>();
const pendingRequests = new Map<string, Promise<VehicleSelectOption[]>>();

function storageKey(url: string) {
  return `mg_vehicle_catalog:${url}`;
}

function isOptionList(value: unknown): value is VehicleSelectOption[] {
  return Array.isArray(value) && value.every((item) => (
    item &&
    typeof item === "object" &&
    typeof (item as VehicleSelectOption).id === "string" &&
    typeof (item as VehicleSelectOption).name === "string"
  ));
}

function readSessionOptions(url: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(url));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { expiresAt?: unknown; options?: unknown };
    if (typeof parsed.expiresAt !== "number" || parsed.expiresAt < Date.now()) return null;
    return isOptionList(parsed.options) ? parsed.options : null;
  } catch {
    return null;
  }
}

function writeSessionOptions(url: string, options: VehicleSelectOption[]) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(url), JSON.stringify({
      expiresAt: Date.now() + clientCacheTtlMs,
      options,
    }));
  } catch {
    // Session storage can be unavailable in private browsing. Network cache still works.
  }
}

export async function fetchVehicleOptions(url: string, signal?: AbortSignal): Promise<VehicleSelectOption[]> {
  const cached = memoryCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.options;

  const sessionOptions = readSessionOptions(url);
  if (sessionOptions) {
    memoryCache.set(url, { expiresAt: Date.now() + clientCacheTtlMs, options: sessionOptions });
    return sessionOptions;
  }

  const pending = pendingRequests.get(url);
  if (pending) return pending;

  const request = fetch(url, { signal })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Vehicle catalog request failed with ${response.status}`);
      const options = await response.json();
      if (!isOptionList(options)) throw new Error("Vehicle catalog response was not a valid option list.");
      memoryCache.set(url, { expiresAt: Date.now() + clientCacheTtlMs, options });
      writeSessionOptions(url, options);
      return options;
    })
    .finally(() => pendingRequests.delete(url));

  pendingRequests.set(url, request);
  return request;
}

export function preloadVehicleBrands() {
  void fetchVehicleOptions("/api/vehicles?type=brands").catch(() => undefined);
}
