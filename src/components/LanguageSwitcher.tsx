"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  defaultLocale,
  exactTranslations,
  normalizeLocale,
  supportedLocales,
  termTranslations,
  type LocaleCode,
} from "@/lib/i18n";
import { isSeoLocale, localizedPath } from "@/lib/seo";

const storageKey = "mg_locale";
const cookieKey = "mg_locale";
const googleCookieKey = "googtrans";
const originalText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Record<string, string>>();

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

function getLocalizedTarget(pathname: string, locale: LocaleCode) {
  const parts = pathname.split("/").filter(Boolean);
  const currentPathLocale = parts[0] && isSeoLocale(parts[0]) ? parts[0] : null;
  const normalizedParts = currentPathLocale ? parts.slice(1) : parts;

  if (normalizedParts.length === 0) return localizedPath(locale);

  if (normalizedParts[0] === "services" && normalizedParts[1]) {
    return localizedPath(locale, `/services/${normalizedParts[1]}`);
  }

  return null;
}

function persistLocale(locale: LocaleCode) {
  window.localStorage.setItem(storageKey, locale);
  document.cookie = `${cookieKey}=${locale}; path=/; max-age=31536000; samesite=lax`;
  document.cookie = `${googleCookieKey}=; path=/; max-age=0; samesite=lax`;
  document.documentElement.lang = locale;
  window.dispatchEvent(new CustomEvent("mg-locale-change", { detail: { locale } }));
}

function translateText(value: string, locale: LocaleCode) {
  if (locale === defaultLocale) return value;

  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const trimmed = value.trim();
  const normalized = trimmed.replace(/\s+/g, " ");

  if (!normalized) return value;

  const exact = exactTranslations[locale]?.[normalized];
  if (exact) return `${leading}${exact}${trailing}`;

  const terms = termTranslations[locale] ?? {};
  const term =
    terms[normalized] ??
    Object.entries(terms).find(
      ([source]) => source.toLowerCase() === normalized.toLowerCase()
    )?.[1];

  if (term) return `${leading}${term}${trailing}`;

  if (normalized.length > 48) return value;

  const replaced = Object.entries(terms)
    .sort((a, b) => b[0].length - a[0].length)
    .reduce((text, [source, target]) => {
      const escaped = escapeRegExp(source);
      return text.replace(new RegExp(`\\b${escaped}\\b`, "gi"), target);
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

function translateNode(root: ParentNode, locale: LocaleCode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!shouldSkip(node)) textNodes.push(node);
  }

  textNodes.forEach((node) => {
    if (!originalText.has(node)) originalText.set(node, node.nodeValue ?? "");
    node.nodeValue = translateText(originalText.get(node) ?? "", locale);
  });

  root.querySelectorAll?.("[placeholder], [aria-label], [title]").forEach((element) => {
    if (element.closest("[data-no-translate], [data-language-switcher]")) return;

    const originals = originalAttributes.get(element) ?? {};

    ["placeholder", "aria-label", "title"].forEach((attr) => {
      const value = element.getAttribute(attr);
      if (!value) return;

      if (!originals[attr]) originals[attr] = value;
      element.setAttribute(attr, translateText(originals[attr], locale));
    });

    originalAttributes.set(element, originals);
  });
}

export function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const [locale, setLocale] = useState<LocaleCode>(defaultLocale);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const initial = getPathLocale(pathname) ?? getInitialLocale();
    setLocale(initial);
    persistLocale(initial);
  }, [pathname]);

  useEffect(() => {
    persistLocale(locale);
    translateNode(document.body, locale);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE && !shouldSkip(node)) {
            const text = node as Text;
            if (!originalText.has(text)) originalText.set(text, text.nodeValue ?? "");
            text.nodeValue = translateText(originalText.get(text) ?? "", locale);
          }

          if (node.nodeType === Node.ELEMENT_NODE) {
            translateNode(node as Element, locale);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [locale]);

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
    () => supportedLocales.find((item) => item.code === locale) ?? supportedLocales[1],
    [locale]
  );

  return (
    <div
      data-language-switcher
      className="fixed bottom-4 right-4 z-[80] flex flex-col items-end gap-2"
      aria-label="Language selector"
    >
      {isOpen && (
        <div className="grid max-h-[46vh] w-24 overflow-y-auto rounded-2xl border border-white/10 bg-[#111720]/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl">
          {supportedLocales.map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => {
                const target = getLocalizedTarget(pathname, item.code);

                setLocale(item.code);
                persistLocale(item.code);
                setIsOpen(false);

                if (target && target !== pathname) {
                  router.push(target);
                }
              }}
              className={`flex h-9 items-center justify-center rounded-xl text-xs font-black transition ${
                item.code === locale
                  ? "bg-red-600 text-white"
                  : "text-zinc-200 hover:bg-white/10"
              }`}
              title={item.name}
              aria-label={`Switch language to ${item.name}`}
            >
              <span>{item.label}</span>
            </button>
          ))}
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
