import { defaultLocale, supportedLocales, type LocaleCode } from "@/lib/i18nConfig";

export const requestBriefDocumentPath = "/tools/request-brief-builder";
export const requestBriefDocumentHeader = "x-mg-request-brief-document";

function isInternalDocumentLocale(locale: unknown): locale is LocaleCode {
  return typeof locale === "string" && locale !== defaultLocale &&
    supportedLocales.some(({ code }) => code === locale);
}

export function requestBriefDocumentTarget(pathname: string, locale: unknown) {
  return pathname === requestBriefDocumentPath && isInternalDocumentLocale(locale)
    ? `/${locale}${requestBriefDocumentPath}`
    : null;
}

export function requestBriefDocumentMarker(locale: LocaleCode) {
  return `${locale}:${requestBriefDocumentPath}`;
}

export function isRequestBriefDocumentAlias(pathname: string) {
  const path = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (!path.endsWith(requestBriefDocumentPath)) return false;
  const prefix = path.slice(0, -requestBriefDocumentPath.length);
  // English keeps the existing permanent redirect to the public canonical URL.
  return /^\/[^/]+$/u.test(prefix) && prefix !== `/${defaultLocale}` && prefix !== "/api";
}

// Proxy removes caller-supplied provenance on every matched request. Only its
// exact canonical rewrite can seed this upstream marker; a direct alias cannot.
export function isRequestBriefDocumentRequest(
  locale: unknown,
  upstream: Pick<Headers, "get">,
) {
  return isInternalDocumentLocale(locale) &&
    upstream.get("x-mg-locale") === locale &&
    upstream.get(requestBriefDocumentHeader) === requestBriefDocumentMarker(locale);
}
