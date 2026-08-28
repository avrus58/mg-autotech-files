import type { LocaleCode } from "@/lib/i18nConfig";
import {
  isPublicServiceSlug,
  isSeoLocale,
  localizedPath,
} from "@/lib/seo";

const englishOnlySeoSegments = new Set(["about", "contact", "brands", "ecu-platforms", "tools"]);
const privateOrSystemSegments = new Set([
  "admin",
  "api",
  "auth",
  "dashboard",
  "embed",
  "forgot-password",
  "login",
  "new-request",
  "payment",
  "register",
  "reset-password",
]);

export function splitLocalizedPath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const maybeLocale = parts[0];
  const locale = maybeLocale && isSeoLocale(maybeLocale) ? maybeLocale : null;

  return {
    locale,
    parts: locale ? parts.slice(1) : parts,
  };
}

export function getLocalizedPublicPath(pathname: string, locale: LocaleCode) {
  const { parts } = splitLocalizedPath(pathname);

  if (parts.length === 0) return localizedPath(locale);

  if (parts[0] === "services" && parts[1] && isPublicServiceSlug(parts[1])) {
    return localizedPath(locale, `/services/${parts[1]}`);
  }

  if (parts[0] === "services") return pathname;

  if (parts[0] === "how-it-works") {
    return localizedPath(locale, "/how-it-works");
  }

  if (parts[0] === "file-service") {
    return localizedPath(locale, "/file-service");
  }

  if (parts[0] && privateOrSystemSegments.has(parts[0])) {
    return pathname;
  }

  if (parts[0] && englishOnlySeoSegments.has(parts[0])) {
    return pathname;
  }

  return pathname;
}

export function isServerLocalizedPublicPath(pathname: string) {
  const { parts } = splitLocalizedPath(pathname);

  if (parts.length === 0) return true;
  if (parts[0] === "how-it-works" || parts[0] === "file-service") return true;

  return Boolean(
    parts[0] === "services" &&
      parts[1] &&
      isPublicServiceSlug(parts[1])
  );
}

export function appendSafeQuery(pathname: string, search = "") {
  if (!search || search === "?") return pathname;
  const protectedAdvertisingKeys = new Set([
    "_gl",
    "dclid",
    "gbraid",
    "gclid",
    "wbraid",
  ]);
  const query = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  for (const key of [...query.keys()]) {
    if (protectedAdvertisingKeys.has(key.toLowerCase())) query.delete(key);
  }
  const sanitized = query.toString();
  return sanitized ? `${pathname}?${sanitized}` : pathname;
}
