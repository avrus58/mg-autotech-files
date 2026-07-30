"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type LocaleCode =
  | "nl"
  | "en"
  | "de"
  | "fr"
  | "it"
  | "ru"
  | "es"
  | "tr"
  | "pt"
  | "zh"
  | "pl"
  | "sq";

const localeCodes = new Set<LocaleCode>([
  "nl",
  "en",
  "de",
  "fr",
  "it",
  "ru",
  "es",
  "tr",
  "pt",
  "zh",
  "pl",
  "sq",
]);

const statusCopy: Record<
  LocaleCode,
  {
    timePrefix: string;
    offlinePrefix: string;
    onlinePrefix: string;
    sundayPrefix: string;
    offlineWord: string;
    onlineWord: string;
    loadingTitle: string;
    loadingLabel: string;
  }
> = {
  nl: {
    timePrefix: "Het is",
    offlinePrefix: "We zijn",
    onlinePrefix: "We zijn",
    sundayPrefix: "Zondag support is",
    offlineWord: "offline",
    onlineWord: "online!",
    loadingTitle: "Live status",
    loadingLabel: "Beschikbaarheid controleren",
  },
  en: {
    timePrefix: "It's",
    offlinePrefix: "We are",
    onlinePrefix: "Now we are",
    sundayPrefix: "Sunday support is",
    offlineWord: "offline",
    onlineWord: "online!",
    loadingTitle: "Live status",
    loadingLabel: "Checking availability",
  },
  de: {
    timePrefix: "Es ist",
    offlinePrefix: "Wir sind",
    onlinePrefix: "Wir sind",
    sundayPrefix: "Sonntags-Support ist",
    offlineWord: "offline",
    onlineWord: "online!",
    loadingTitle: "Live-Status",
    loadingLabel: "Verfügbarkeit prüfen",
  },
  fr: {
    timePrefix: "Il est",
    offlinePrefix: "Nous sommes",
    onlinePrefix: "Nous sommes",
    sundayPrefix: "Support du dimanche",
    offlineWord: "hors ligne",
    onlineWord: "en ligne!",
    loadingTitle: "Statut en direct",
    loadingLabel: "Disponibilité en cours",
  },
  it: {
    timePrefix: "Sono le",
    offlinePrefix: "Siamo",
    onlinePrefix: "Siamo",
    sundayPrefix: "Supporto domenicale",
    offlineWord: "offline",
    onlineWord: "online!",
    loadingTitle: "Stato live",
    loadingLabel: "Verifica disponibilità",
  },
  ru: {
    timePrefix: "Сейчас",
    offlinePrefix: "Мы",
    onlinePrefix: "Мы",
    sundayPrefix: "Поддержка в воскресенье",
    offlineWord: "офлайн",
    onlineWord: "онлайн!",
    loadingTitle: "Онлайн-статус",
    loadingLabel: "Проверяем доступность",
  },
  es: {
    timePrefix: "Son las",
    offlinePrefix: "Estamos",
    onlinePrefix: "Estamos",
    sundayPrefix: "Soporte de domingo",
    offlineWord: "fuera de línea",
    onlineWord: "en línea!",
    loadingTitle: "Estado en vivo",
    loadingLabel: "Comprobando disponibilidad",
  },
  tr: {
    timePrefix: "Saat",
    offlinePrefix: "Şu an",
    onlinePrefix: "Şu an",
    sundayPrefix: "Pazar desteği",
    offlineWord: "çevrim dışıyız",
    onlineWord: "çevrim içiyiz!",
    loadingTitle: "Canlı durum",
    loadingLabel: "Uygunluk kontrol ediliyor",
  },
  pt: {
    timePrefix: "São",
    offlinePrefix: "Estamos",
    onlinePrefix: "Estamos",
    sundayPrefix: "Suporte de domingo",
    offlineWord: "offline",
    onlineWord: "online!",
    loadingTitle: "Estado ao vivo",
    loadingLabel: "Verificando disponibilidade",
  },
  zh: {
    timePrefix: "现在是",
    offlinePrefix: "我们",
    onlinePrefix: "我们",
    sundayPrefix: "周日支持",
    offlineWord: "离线",
    onlineWord: "在线!",
    loadingTitle: "实时状态",
    loadingLabel: "正在检查可用性",
  },
  pl: {
    timePrefix: "Jest",
    offlinePrefix: "Jesteśmy",
    onlinePrefix: "Jesteśmy",
    sundayPrefix: "Wsparcie niedzielne jest",
    offlineWord: "offline",
    onlineWord: "online!",
    loadingTitle: "Status na żywo",
    loadingLabel: "Sprawdzamy dostępność",
  },
  sq: {
    timePrefix: "Ora",
    offlinePrefix: "Jemi",
    onlinePrefix: "Jemi",
    sundayPrefix: "Mbështetja e së dielës është",
    offlineWord: "offline",
    onlineWord: "online!",
    loadingTitle: "Status live",
    loadingLabel: "Po kontrollohet disponueshmëria",
  },
};

function normalizeLocale(input?: string | null): LocaleCode {
  const language = input?.toLowerCase().split(",")[0]?.split("-")[0];

  if (language === "cn" || language === "zh") return "zh";
  if (language === "al" || language === "sq") return "sq";

  return language && localeCodes.has(language as LocaleCode)
    ? (language as LocaleCode)
    : "en";
}

function getRouteLocale(pathname: string | null): LocaleCode | null {
  const segment = pathname?.split("/").filter(Boolean)[0];

  if (!segment) return null;

  const normalized = normalizeLocale(segment);

  return localeCodes.has(normalized) && segment.toLowerCase() !== normalized
    ? null
    : normalized;
}

function getClientLocale(pathname: string | null): LocaleCode {
  const routeLocale = getRouteLocale(pathname);

  if (routeLocale) return routeLocale;

  if (typeof window === "undefined") return "en";

  return normalizeLocale(
    window.localStorage.getItem("mg_locale") ??
      document.documentElement.lang ??
      "en"
  );
}

function getGermanyTime() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" })
  );
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function isOnline(date: Date) {
  const hour = date.getHours();
  const minute = date.getMinutes();
  const minutes = hour * 60 + minute;

  // Daily operation window: 06:00 - 02:00, with a short night pause.
  const open = 6 * 60;
  const nightPause = 2 * 60;

  return minutes >= open || minutes < nightPause;
}

function getStatusLabel(date: Date, online: boolean, locale: LocaleCode) {
  const copy = statusCopy[locale] ?? statusCopy.en;

  if (!online) {
    return (
      <>
        {copy.offlinePrefix}{" "}
        <span className="font-black text-red-400">{copy.offlineWord}</span>
      </>
    );
  }

  if (date.getDay() === 0) {
    return (
      <>
        {copy.sundayPrefix}{" "}
        <span className="font-black text-amber-300">{copy.onlineWord}</span>
      </>
    );
  }

  return (
    <>
      {copy.onlinePrefix}{" "}
      <span className="font-black text-emerald-400">{copy.onlineWord}</span>
    </>
  );
}

export function OnlineStatus() {
  const pathname = usePathname();
  const [now, setNow] = useState<Date | null>(null);
  const [locale, setLocale] = useState<LocaleCode>(
    () => getRouteLocale(pathname) ?? "en"
  );

  useEffect(() => {
    const initialUpdate = window.setTimeout(() => setNow(getGermanyTime()), 0);

    const interval = window.setInterval(() => {
      setNow(getGermanyTime());
    }, 30_000);

    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const initialUpdate = window.setTimeout(() => setLocale(getClientLocale(pathname)), 0);

    function handleLocaleChange(event: Event) {
      const detail = (event as CustomEvent<{ locale?: string }>).detail;
      setLocale(normalizeLocale(detail?.locale));
    }

    window.addEventListener("mg-locale-change", handleLocaleChange);

    return () => {
      window.clearTimeout(initialUpdate);
      window.removeEventListener("mg-locale-change", handleLocaleChange);
    };
  }, [pathname]);

  const status = useMemo(() => {
    const copy = statusCopy[locale] ?? statusCopy.en;

    if (!now) {
      return {
        title: copy.loadingTitle,
        online: false,
        label: <>{copy.loadingLabel}</>,
        time: "",
        timePrefix: copy.timePrefix,
      };
    }

    const online = isOnline(now);

    return {
      title: "",
      time: formatTime(now),
      online,
      label: getStatusLabel(now, online, locale),
      timePrefix: copy.timePrefix,
    };
  }, [locale, now]);

  return (
    <div className="pointer-events-none fixed bottom-3 left-3 z-[60] max-w-[calc(100vw-5.5rem)] sm:bottom-4 sm:left-4">
      <div className="rounded-xl border border-white/10 bg-black/90 px-3 py-2 text-white shadow-2xl shadow-black/40 backdrop-blur-xl sm:px-4 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <span
            className={`h-3 w-3 shrink-0 rounded-full sm:h-4 sm:w-4 ${
              status.online
                ? "bg-emerald-500 shadow-lg shadow-emerald-500/30"
                : "bg-red-500 shadow-lg shadow-red-500/30"
            }`}
          />
          <div className="min-w-0 text-xs leading-tight sm:text-sm">
            <div className="hidden font-black sm:block">
              {status.time ? `${status.timePrefix} ${status.time}.` : status.title}
            </div>
            <div className="max-w-24 truncate text-xs font-black text-zinc-200 sm:max-w-none sm:font-normal sm:text-zinc-300">
              {status.label}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
