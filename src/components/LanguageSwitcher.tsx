"use client";

import { useEffect, useMemo, useState } from "react";
import {
  defaultLocale,
  exactTranslations,
  normalizeLocale,
  supportedLocales,
  termTranslations,
  type LocaleCode,
} from "@/lib/i18n";

const storageKey = "mg_locale";
const cookieKey = "mg_locale";
const originalText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Record<string, string>>();

function getCookieLocale() {
  if (typeof document === "undefined") return defaultLocale;

  const match = document.cookie.match(new RegExp(`(?:^|; )${cookieKey}=([^;]*)`));
  return normalizeLocale(match?.[1]);
}

function getInitialLocale() {
  if (typeof window === "undefined") return defaultLocale;

  const stored = window.localStorage.getItem(storageKey);
  if (stored) return normalizeLocale(stored);

  return getCookieLocale() || normalizeLocale(window.navigator.language);
}

function persistLocale(locale: LocaleCode) {
  window.localStorage.setItem(storageKey, locale);
  document.cookie = `${cookieKey}=${locale}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.lang = locale;
}

function translateText(value: string, locale: LocaleCode) {
  if (locale === defaultLocale) return value;

  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const trimmed = value.trim();

  if (!trimmed) return value;

  const exact = exactTranslations[locale]?.[trimmed];
  if (exact) return `${leading}${exact}${trailing}`;

  const terms = termTranslations[locale] ?? {};
  let translated = trimmed;

  Object.entries(terms)
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([source, target]) => {
      translated = translated.replaceAll(source, target);
    });

  return `${leading}${translated}${trailing}`;
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
  const [locale, setLocale] = useState<LocaleCode>(defaultLocale);

  useEffect(() => {
    const initial = getInitialLocale();
    setLocale(initial);
    persistLocale(initial);
  }, []);

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

  const activeLocale = useMemo(
    () => supportedLocales.find((item) => item.code === locale) ?? supportedLocales[1],
    [locale]
  );

  return (
    <div
      data-language-switcher
      className="fixed right-3 top-1/2 z-[80] -translate-y-1/2 overflow-hidden rounded-2xl border border-white/10 bg-[#111720]/95 shadow-2xl shadow-black/50 backdrop-blur-xl"
      aria-label="Language selector"
    >
      <div className="border-b border-white/10 px-2 py-2 text-center text-[10px] font-black text-zinc-400">
        {activeLocale.label}
      </div>
      <div className="max-h-[74vh] overflow-y-auto">
        {supportedLocales.map((item) => (
          <button
            key={item.code}
            type="button"
            onClick={() => setLocale(item.code)}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-black transition ${
              item.code === locale
                ? "bg-red-600 text-white"
                : "text-zinc-200 hover:bg-white/10"
            }`}
            title={item.name}
            aria-label={`Switch language to ${item.name}`}
          >
            <span className="text-base leading-none">{item.flag}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
