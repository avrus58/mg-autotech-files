"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import {
  defaultLocale,
  normalizeLocale,
  supportedLocales,
  type LocaleCode,
} from "@/lib/i18nConfig";
import {
  appendSafeQuery,
  getLocalizedPublicPath,
  isServerLocalizedPublicPath,
} from "@/lib/i18nRoutes";
import { isSeoLocale } from "@/lib/seo";

const storageKey = "mg_locale";
const cookieKey = "mg_locale";
const googleCookieKey = "googtrans";
const originalText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Record<string, string>>();

function subscribeToLocationSearch(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  return () => window.removeEventListener("popstate", onStoreChange);
}

function readLocationSearch() {
  return window.location.search;
}

function readServerLocationSearch() {
  return "";
}

type TranslationCatalog = {
  exact: Record<LocaleCode, Record<string, string>>;
  terms: Record<LocaleCode, Record<string, string>>;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readCookie(name: string) {
  if (typeof document === "undefined") return "";

  return (
    document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${name}=`))
      ?.split("=")[1] ?? ""
  );
}

function getInitialLocale() {
  if (typeof window === "undefined") return defaultLocale;

  const stored = window.localStorage.getItem(storageKey);
  if (stored) return normalizeLocale(stored);

  const cookieLocale = readCookie(cookieKey);
  if (cookieLocale) return normalizeLocale(cookieLocale);

  return normalizeLocale(window.navigator.language);
}

function getPathLocale(pathname: string) {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  return firstSegment && isSeoLocale(firstSegment) ? firstSegment : null;
}

function persistLocale(locale: LocaleCode) {
  window.localStorage.setItem(storageKey, locale);
  document.cookie = `${cookieKey}=${locale}; path=/; max-age=31536000; samesite=lax`;
  document.cookie = `${googleCookieKey}=; path=/; max-age=0; samesite=lax`;
  document.documentElement.lang = locale;
  window.dispatchEvent(new CustomEvent("mg-locale-change", { detail: { locale } }));
}

function translateText(
  value: string,
  locale: LocaleCode,
  catalog: TranslationCatalog
) {
  if (locale === defaultLocale) return value;

  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const trimmed = value.trim();
  const normalized = trimmed.replace(/\s+/g, " ");

  if (!normalized) return value;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)) return value;

  const exact = catalog.exact[locale]?.[normalized];
  if (exact) return `${leading}${exact}${trailing}`;

  const terms = catalog.terms[locale] ?? {};
  const term =
    terms[normalized] ??
    Object.entries(terms).find(
      ([source]) => source.toLowerCase() === normalized.toLowerCase()
    )?.[1];

  if (term) return `${leading}${term}${trailing}`;

  const wordCount = normalized.match(/\p{L}+/gu)?.length ?? 0;
  if (wordCount > 6) return value;

  const replaced = Object.entries(terms)
    .sort((a, b) => b[0].length - a[0].length)
    .reduce((text, [source, target]) => {
      const escaped = escapeRegExp(source);
      const prefix = /^\w/.test(source) ? "\\b" : "";
      const suffix = /\w$/.test(source) ? "\\b" : "";
      return text.replace(new RegExp(`${prefix}${escaped}${suffix}`, "gi"), target);
    }, normalized);

  if (replaced !== normalized) return `${leading}${replaced}${trailing}`;

  return value;
}

function shouldSkip(node: Node) {
  const parent = node.parentElement;
  if (!parent) return true;

  return Boolean(
    parent.closest(
      "script, style, code, pre, textarea, [data-no-translate], [data-language-switcher]"
    )
  );
}

function translateNode(
  root: ParentNode,
  locale: LocaleCode,
  catalog: TranslationCatalog
) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!shouldSkip(node)) textNodes.push(node);
  }

  textNodes.forEach((node) => {
    if (!originalText.has(node)) originalText.set(node, node.nodeValue ?? "");
    node.nodeValue = translateText(
      originalText.get(node) ?? "",
      locale,
      catalog
    );
  });

  root.querySelectorAll?.("[placeholder], [aria-label], [title]").forEach((element) => {
    if (element.closest("[data-no-translate], [data-language-switcher]")) return;

    const originals = originalAttributes.get(element) ?? {};

    ["placeholder", "aria-label", "title"].forEach((attr) => {
      const value = element.getAttribute(attr);
      if (!value) return;

      if (!originals[attr]) originals[attr] = value;
      element.setAttribute(
        attr,
        translateText(originals[attr], locale, catalog)
      );
    });

    originalAttributes.set(element, originals);
  });
}

export function LanguageSwitcher() {
  const pathname = usePathname();
  const [locale, setLocale] = useState<LocaleCode>(defaultLocale);
  const currentSearch = useSyncExternalStore(
    subscribeToLocationSearch,
    readLocationSearch,
    readServerLocationSearch
  );
  const [isOpen, setIsOpen] = useState(false);
  const translatedLocaleRef = useRef<LocaleCode>(defaultLocale);

  useEffect(() => {
    const initial =
      getPathLocale(pathname) ??
      (isServerLocalizedPublicPath(pathname) ? defaultLocale : getInitialLocale());
    persistLocale(initial);
    void Promise.resolve().then(() => setLocale(initial));
  }, [pathname]);

  useEffect(() => {
    persistLocale(locale);

    // Locale-prefixed SEO routes render translated content on the server. The
    // unified homepage also contains deferred interactive tools, so keep the
    // observer available there to translate content mounted after hydration.
    const hasDeferredLocalizedHomepage = Boolean(
      document.querySelector("[data-unified-localized-homepage]")
    );

    if (getPathLocale(pathname) && !hasDeferredLocalizedHomepage) {
      translatedLocaleRef.current = locale;
      return;
    }

    if (
      locale === defaultLocale &&
      translatedLocaleRef.current === defaultLocale
    ) {
      return;
    }

    let observer: MutationObserver | null = null;
    let cancelled = false;

    const timer = window.setTimeout(() => {
      void import("@/lib/i18n").then(
        ({ exactTranslations, termTranslations }) => {
          if (cancelled) return;

          const catalog: TranslationCatalog = {
            exact: exactTranslations,
            terms: termTranslations,
          };

          translateNode(document.body, locale, catalog);
          translatedLocaleRef.current = locale;

          if (locale === defaultLocale) return;

          observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.TEXT_NODE && !shouldSkip(node)) {
                  const text = node as Text;
                  if (!originalText.has(text)) {
                    originalText.set(text, text.nodeValue ?? "");
                  }
                  text.nodeValue = translateText(
                    originalText.get(text) ?? "",
                    locale,
                    catalog
                  );
                }

                if (node.nodeType === Node.ELEMENT_NODE) {
                  translateNode(node as Element, locale, catalog);
                }
              });
            });
          });

          observer.observe(document.body, {
            childList: true,
            subtree: true,
          });
        }
      );
    }, 80);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, [locale, pathname]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest("[data-language-switcher]")) return;
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const activeLocale = useMemo(
    () =>
      supportedLocales.find((item) => item.code === locale) ??
      supportedLocales.find((item) => item.code === defaultLocale) ??
      supportedLocales[0],
    [locale]
  );

  if (
    pathname.startsWith("/embed/") ||
    pathname === "/measurement/complete"
  ) return null;

  return (
    <div
      data-language-switcher
      className="fixed bottom-4 right-4 z-[80] flex flex-col items-end gap-2"
      aria-label="Language selector"
    >
      {isOpen && (
        <div className="grid max-h-[46vh] w-24 overflow-y-auto rounded-2xl border border-white/10 bg-[#111720]/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl">
          {supportedLocales.map((item) => {
            const localizedTarget = getLocalizedPublicPath(pathname, item.code);
            const canNavigate = localizedTarget !== pathname;
            const target = canNavigate
              ? appendSafeQuery(localizedTarget, currentSearch)
              : localizedTarget;
            const chooseLocale = () => {
              setLocale(item.code);
              persistLocale(item.code);
              setIsOpen(false);
            };
            const optionClassName = `flex h-9 items-center justify-center rounded-xl text-xs font-black transition ${
              item.code === locale
                ? "bg-red-600 text-white"
                : "text-zinc-200 hover:bg-white/10"
            }`;
            return canNavigate ? (
              <a
                key={item.code}
                href={target}
                onClick={chooseLocale}
                className={optionClassName}
                title={item.name}
                aria-label={`Switch language to ${item.name}`}
              >
                <span>{item.label}</span>
              </a>
            ) : (
              <button
                key={item.code}
                type="button"
                onClick={chooseLocale}
                className={optionClassName}
                title={item.name}
                aria-label={`Switch language to ${item.name}`}
              >
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="flex h-11 min-w-11 items-center justify-center rounded-full border border-white/10 bg-[#111720]/95 px-3 text-xs font-black text-white shadow-2xl shadow-black/40 backdrop-blur-xl transition hover:border-red-700/60 hover:bg-[#171f2b]"
        aria-expanded={isOpen}
        aria-label="Change language"
        title="Change language"
      >
        {activeLocale.label}
      </button>
    </div>
  );
}
