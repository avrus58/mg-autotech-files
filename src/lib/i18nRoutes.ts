import {
  defaultLocale,
  parseSupportedLocale,
  type LocaleCode,
} from "@/lib/i18nConfig";
import {
  isPublicServiceSlug,
  isSeoLocale,
  localizedPath,
} from "@/lib/seo";

// These routes are localized at runtime on one canonical URL instead of
// duplicating the route tree with a locale prefix.
const runtimeLocalizedSinglePathSegments = new Set([
  "about",
  "contact",
  "download",
  "brands",
  "ecu-platforms",
  "tools",
  "widget",
  "workshop-guides",
]);
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

export function resolvePreferredLocale({
  pathname,
  storedLocale,
  cookieLocale,
  browserLocale,
}: {
  pathname: string;
  storedLocale?: string | null;
  cookieLocale?: string | null;
  browserLocale?: string | null;
}) {
  return (
    splitLocalizedPath(pathname).locale ??
    parseSupportedLocale(storedLocale) ??
    parseSupportedLocale(cookieLocale) ??
    parseSupportedLocale(browserLocale) ??
    defaultLocale
  );
}

export function getLocalizedPublicPath(pathname: string, locale: LocaleCode) {
  const { locale: pathLocale, parts } = splitLocalizedPath(pathname);
  const unprefixedPath = parts.length > 0 ? `/${parts.join("/")}` : "/";

  if (parts.length === 0) return localizedPath(locale);

  if (parts[0] === "services" && parts[1] && isPublicServiceSlug(parts[1])) {
    return localizedPath(locale, `/services/${parts[1]}`);
  }

  if (parts[0] === "services") {
    return pathLocale ? unprefixedPath : pathname;
  }

  if (parts[0] === "how-it-works") {
    return localizedPath(locale, "/how-it-works");
  }

  if (parts[0] === "file-service") {
    return localizedPath(locale, "/file-service");
  }

  if (parts[0] && privateOrSystemSegments.has(parts[0])) {
    return pathLocale ? unprefixedPath : pathname;
  }

  if (parts[0] && runtimeLocalizedSinglePathSegments.has(parts[0])) {
    return pathLocale ? unprefixedPath : pathname;
  }

  return pathLocale ? localizedPath(locale, unprefixedPath) : pathname;
}

export function getLocalizedPublicHref(href: string, locale: LocaleCode) {
  if (!href.startsWith("/") || href.startsWith("//")) return href;

  const match = href.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/u);
  if (!match) return href;

  const pathname = match[1] || "/";
  const suffix = `${match[2] ?? ""}${match[3] ?? ""}`;
  return `${getLocalizedPublicPath(pathname, locale)}${suffix}`;
}

export function isServerLocalizedPublicPath(pathname: string) {
  const { parts } = splitLocalizedPath(pathname);

  if (parts.length === 0) return true;
  if (parts[0] === "how-it-works" || parts[0] === "file-service") return true;

  if (parts[0] && runtimeLocalizedSinglePathSegments.has(parts[0])) {
    return true;
  }

  if (parts[0] === "services") return true;

  return false;
}

export function requiresServerLocaleRefresh(
  pathname: string,
  currentLocale: LocaleCode,
  targetLocale: LocaleCode
) {
  return (
    currentLocale !== targetLocale &&
    isServerLocalizedPublicPath(pathname) &&
    getLocalizedPublicPath(pathname, targetLocale) === pathname
  );
}

export function getInitialLocaleRedirect(
  pathname: string,
  preferredLocale: LocaleCode
) {
  if (
    splitLocalizedPath(pathname).locale ||
    preferredLocale === defaultLocale ||
    !isServerLocalizedPublicPath(pathname)
  ) {
    return null;
  }

  const target = getLocalizedPublicPath(pathname, preferredLocale);
  return target === pathname ? null : target;
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
