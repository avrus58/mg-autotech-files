import { getSafeLocalRedirectPath } from "@/lib/safeLocalRedirect";
import { parseRequestIntent } from "@/lib/requestIntent";

export const measurementCompletionPath = "/measurement/complete";
export const measurementCompletionDestinationStorageKey =
  "mg_measurement_completion_destination_v1";

const forbiddenDestinationPrefixes = [
  "/admin",
  "/api",
  "/auth",
  "/embed",
  "/login",
  "/measurement",
  "/payment",
  "/register",
  "/reset-password",
] as const;

function safeAuthCallbackMeasurementDestination(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length > 2_048 ||
    !value.startsWith("/auth/callback?")
  ) {
    return null;
  }

  try {
    const parsed = new URL(value, "https://file.mgautotech.de");
    const keys = [...parsed.searchParams.keys()];
    const nextValues = parsed.searchParams.getAll("next");
    if (
      parsed.origin !== "https://file.mgautotech.de" ||
      parsed.pathname !== "/auth/callback" ||
      parsed.hash ||
      keys.length !== 1 ||
      keys[0] !== "next" ||
      nextValues.length !== 1
    ) {
      return null;
    }

    const next = getSafeLocalRedirectPath(nextValues[0]);
    return next
      ? `/auth/callback?next=${encodeURIComponent(next)}`
      : null;
  } catch {
    return null;
  }
}

export function isGoogleMeasurementPath(pathname: string) {
  return pathname.replace(/\/+$/, "") === measurementCompletionPath;
}

export function safeMeasurementCompletionDestination(value: unknown) {
  const authCallback = safeAuthCallbackMeasurementDestination(value);
  if (authCallback) return authCallback;

  const safe = getSafeLocalRedirectPath(value);
  if (!safe) return "/dashboard";

  const parsed = new URL(safe, "https://file.mgautotech.de");
  if (
    parsed.hash ||
    forbiddenDestinationPrefixes.some(
      (prefix) => parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`)
    )
  ) {
    return "/dashboard";
  }

  if (parsed.search) {
    if (parsed.pathname !== "/new-request") return "/dashboard";
    const keys = [...parsed.searchParams.keys()];
    const intent = parsed.searchParams.get("intent") ?? "";
    if (
      keys.length !== 1 ||
      keys[0] !== "intent" ||
      parseRequestIntent(intent) === null
    ) {
      return "/dashboard";
    }
  }

  return `${parsed.pathname}${parsed.search}`;
}

export function stageMeasurementCompletionDestination(destination: unknown) {
  if (typeof window === "undefined") return false;
  try {
    window.sessionStorage.setItem(
      measurementCompletionDestinationStorageKey,
      safeMeasurementCompletionDestination(destination)
    );
    return true;
  } catch {
    return false;
  }
}

export function readMeasurementCompletionDestination() {
  if (typeof window === "undefined") return "/dashboard";
  try {
    return safeMeasurementCompletionDestination(
      window.sessionStorage.getItem(measurementCompletionDestinationStorageKey)
    );
  } catch {
    return "/dashboard";
  }
}

export function clearMeasurementCompletionDestination() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(measurementCompletionDestinationStorageKey);
  } catch {
    // A blocked session store already leaves no durable destination behind.
  }
}

export function replaceWithMeasurementCompletion(destination: unknown) {
  if (typeof window === "undefined") return false;
  if (!stageMeasurementCompletionDestination(destination)) return false;
  window.location.replace(measurementCompletionPath);
  return true;
}
