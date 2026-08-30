import { headers } from "next/headers";
import { defaultLocale, normalizeLocale } from "@/lib/i18nConfig";

export async function getServerLocale() {
  try {
    return normalizeLocale((await headers()).get("x-mg-locale"));
  } catch {
    // Metadata helpers are also evaluated by requestless build/test tooling.
    // Locale is presentation-only, so that context must fall back safely to
    // the canonical English copy rather than making metadata unavailable.
    return defaultLocale;
  }
}
