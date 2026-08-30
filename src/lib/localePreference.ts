import type { LocaleCode } from "@/lib/i18nConfig";

export const siteLocaleStorageKey = "mg_locale";
export const siteLocaleCookieKey = "mg_locale";
export const googleTranslateCookieKey = "googtrans";

export function readStoredLocale() {
  try {
    return typeof window === "undefined"
      ? null
      : window.localStorage.getItem(siteLocaleStorageKey);
  } catch {
    return null;
  }
}

export function writeStoredLocale(locale: LocaleCode) {
  try {
    window.localStorage.setItem(siteLocaleStorageKey, locale);
  } catch {
    // Storage can be unavailable on opaque origins or in strict privacy modes.
  }
}

export function readLocaleCookie() {
  try {
    if (typeof document === "undefined") return null;
    return (
      document.cookie
        .split("; ")
        .find((row) => row.startsWith(`${siteLocaleCookieKey}=`))
        ?.slice(siteLocaleCookieKey.length + 1) ?? null
    );
  } catch {
    return null;
  }
}

export function writeLocaleCookies(locale: LocaleCode) {
  try {
    document.cookie = `${siteLocaleCookieKey}=${locale}; path=/; max-age=31536000; samesite=lax`;
    document.cookie = `${googleTranslateCookieKey}=; path=/; max-age=0; samesite=lax`;
  } catch {
    // Cookie access can be blocked independently of local storage.
  }
}

export function writeDocumentLocale(locale: LocaleCode) {
  try {
    document.documentElement.lang = locale;
  } catch {
    // Keep locale selection functional even if the document is not writable.
  }
}

export function dispatchLocaleChange(locale: LocaleCode) {
  try {
    window.dispatchEvent(new CustomEvent("mg-locale-change", { detail: { locale } }));
  } catch {
    // Consumers also read from path, cookie and document state on the next render.
  }
}
