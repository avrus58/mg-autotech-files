import { authenticatedFetch } from "@/lib/authGuards";
import {
  classifyAdminAccessApiResponse,
  type AdminAccessResolution,
} from "@/lib/adminAccess";

const ADMIN_ACCESS_RETRY_DELAYS_MS = [0, 180, 480] as const;

function wait(delayMs: number) {
  if (delayMs === 0) return Promise.resolve();
  return new Promise<void>((resolve) => globalThis.setTimeout(resolve, delayMs));
}

async function requestAdminAccess(): Promise<AdminAccessResolution> {
  try {
    const response = await authenticatedFetch("/api/admin/access", {
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    return classifyAdminAccessApiResponse(response.status, payload);
  } catch {
    return { state: "unavailable" };
  }
}

export async function resolveAdminAccess(): Promise<AdminAccessResolution> {
  let pendingDenial = false;

  for (const delayMs of ADMIN_ACCESS_RETRY_DELAYS_MS) {
    await wait(delayMs);
    const resolution = await requestAdminAccess();
    if (resolution.state === "authorized") return resolution;

    if (resolution.state === "denied") {
      // A single transient profile/read replica response must not replace an
      // already verified workspace with Access Denied. The API remains the
      // authority; we simply require the denial to be independently repeated.
      if (pendingDenial) return resolution;
      pendingDenial = true;
      continue;
    }

    pendingDenial = false;
  }

  return { state: "unavailable" };
}
