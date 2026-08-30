"use client";

import {
  createContext,
  createElement,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  defaultLocale,
  resolveSupportedLocaleCandidates,
  supportedLocales,
  type LocaleCode,
} from "@/lib/i18nConfig";
import { readLocaleCookie, readStoredLocale } from "@/lib/localePreference";

const localeCodes = new Set<string>(supportedLocales.map(({ code }) => code));
const InitialLocaleContext = createContext<LocaleCode | null>(null);

export function resolveClientLocale({
  pathLocale,
  storedLocale,
  cookieLocale,
  documentLocale,
  browserLocale,
}: {
  pathLocale?: string | null;
  storedLocale?: string | null;
  cookieLocale?: string | null;
  documentLocale?: string | null;
  browserLocale?: string | null;
}): LocaleCode {
  const supportedPathLocale =
    pathLocale && localeCodes.has(pathLocale)
      ? (pathLocale as LocaleCode)
      : null;

  return resolveSupportedLocaleCandidates(
    supportedPathLocale,
    storedLocale,
    cookieLocale,
    documentLocale,
    browserLocale,
  );
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("mg-locale-change", onStoreChange);
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("popstate", onStoreChange);

  return () => {
    window.removeEventListener("mg-locale-change", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("popstate", onStoreChange);
  };
}

function readLocale(): LocaleCode {
  const pathLocale = window.location.pathname.split("/").filter(Boolean)[0];
  const storedLocale = readStoredLocale();
  let documentLocale = "";
  try {
    documentLocale = document.documentElement.lang;
  } catch {
    // Fall through to browser/default locale when document access is restricted.
  }

  return resolveClientLocale({
    pathLocale,
    storedLocale,
    cookieLocale: readLocaleCookie(),
    documentLocale,
    browserLocale: navigator.language,
  });
}

export function ActiveLocaleProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale: LocaleCode;
}) {
  return createElement(
    InitialLocaleContext.Provider,
    { value: initialLocale },
    children
  );
}

export function useActiveLocale() {
  const initialLocale = useContext(InitialLocaleContext);
  return useSyncExternalStore(
    subscribe,
    readLocale,
    () => initialLocale ?? defaultLocale,
  );
}

export function useInitialLocale() {
  return useContext(InitialLocaleContext);
}
