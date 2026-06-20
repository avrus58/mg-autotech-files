"use client";

import { useEffect, useMemo, useState } from "react";
import { normalizeLocale, supportedLocales, type LocaleCode } from "@/lib/i18n";

const storageKey = "mg_locale";
const appCookieKey = "mg_locale";
const googleCookieKey = "googtrans";

const googleLanguageMap: Record<LocaleCode, string> = {
  nl: "nl",
  en: "en",
  de: "de",
  fr: "fr",
  it: "it",
  ru: "ru",
  es: "es",
  tr: "tr",
  pt: "pt",
  zh: "zh-CN",
  pl: "pl",
  sq: "sq",
};

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: {
      translate?: {
        TranslateElement?: new (
          options: Record<string, unknown>,
          element: string
        ) => void;
      };
    };
  }
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
  if (typeof window === "undefined") return "en" as LocaleCode;

  const stored = window.localStorage.getItem(storageKey);
  if (stored) return normalizeLocale(stored);

  const cookieLocale = readCookie(appCookieKey);
  if (cookieLocale) return normalizeLocale(cookieLocale);

  return normalizeLocale(window.navigator.language);
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}

function persistLocale(locale: LocaleCode) {
  window.localStorage.setItem(storageKey, locale);
  setCookie(appCookieKey, locale);
  document.documentElement.lang = locale;

  const googleCode = googleLanguageMap[locale];
  const googleValue = locale === "en" ? "/auto/en" : `/auto/${googleCode}`;
  setCookie(googleCookieKey, googleValue);

  const hostname = window.location.hostname;
  if (hostname.includes(".")) {
    document.cookie = `${googleCookieKey}=${googleValue}; domain=.${hostname}; path=/; max-age=31536000; samesite=lax`;
  }
}

function ensureGoogleTranslateScript() {
  if (document.querySelector('script[data-google-translate="true"]')) return;

  window.googleTranslateElementInit = () => {
    if (!window.google?.translate?.TranslateElement) return;

    new window.google.translate.TranslateElement(
      {
        pageLanguage: "en",
        includedLanguages: Object.values(googleLanguageMap).join(","),
        autoDisplay: false,
      },
      "google_translate_element"
    );
  };

  const script = document.createElement("script");
  script.src =
    "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
  script.async = true;
  script.dataset.googleTranslate = "true";
  document.body.appendChild(script);
}

function triggerGoogleTranslate(locale: LocaleCode) {
  const googleCode = googleLanguageMap[locale];
  const select = document.querySelector<HTMLSelectElement>(".goog-te-combo");

  if (!select) return false;

  select.value = googleCode;
  select.dispatchEvent(new Event("change"));
  return true;
}

export function LanguageSwitcher() {
  const [locale, setLocale] = useState<LocaleCode>("en");

  useEffect(() => {
    const initial = getInitialLocale();
    setLocale(initial);
    persistLocale(initial);
    ensureGoogleTranslateScript();
  }, []);

  useEffect(() => {
    persistLocale(locale);

    let attempts = 0;
    const interval = window.setInterval(() => {
      attempts += 1;
      const translated = triggerGoogleTranslate(locale);

      if (translated || attempts > 30) {
        window.clearInterval(interval);
      }
    }, 400);

    return () => window.clearInterval(interval);
  }, [locale]);

  const activeLocale = useMemo(
    () => supportedLocales.find((item) => item.code === locale) ?? supportedLocales[1],
    [locale]
  );

  return (
    <>
      <div id="google_translate_element" className="hidden" />
      <style jsx global>{`
        .goog-te-banner-frame,
        .goog-te-balloon-frame,
        #goog-gt-tt,
        .goog-te-menu-frame,
        .skiptranslate iframe {
          display: none !important;
        }

        body {
          top: 0 !important;
        }

        .goog-logo-link,
        .goog-te-gadget span {
          display: none !important;
        }
      `}</style>

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
              <span className="min-w-5 text-[10px] opacity-70">{item.label}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
