import { authenticatedFetch } from "@/lib/authGuards";
import { adminMobileDestinations } from "@/lib/adminMobileNavigation";

export type AdminNavigationResolution =
  | { state: "authorized"; destinations: typeof adminMobileDestinations }
  | { state: "denied" }
  | { state: "unavailable" };

export async function resolveAdminNavigation(): Promise<AdminNavigationResolution> {
  try {
    const response = await authenticatedFetch("/api/admin/navigation", { cache: "no-store" });
    if (response.status === 403) return { state: "denied" };
    if (!response.ok) return { state: "unavailable" };
    const payload = await response.json();
    const hrefs: unknown = payload?.destinations;
    if (!Array.isArray(hrefs) || new Set(hrefs).size !== hrefs.length ||
      hrefs.some((href) => typeof href !== "string" || !adminMobileDestinations.some((item) => item.href === href))) {
      return { state: "unavailable" };
    }
    return { state: "authorized", destinations: adminMobileDestinations.filter((item) => hrefs.includes(item.href)) };
  } catch {
    return { state: "unavailable" };
  }
}
