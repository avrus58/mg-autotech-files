export const supportedLocales = [
  { code: "nl", label: "NL", name: "Nederlands", flag: "🇳🇱" },
  { code: "en", label: "EN", name: "English", flag: "🇬🇧" },
  { code: "de", label: "DE", name: "Deutsch", flag: "🇩🇪" },
  { code: "fr", label: "FR", name: "Français", flag: "🇫🇷" },
  { code: "it", label: "IT", name: "Italiano", flag: "🇮🇹" },
  { code: "ru", label: "RU", name: "Русский", flag: "🇷🇺" },
  { code: "es", label: "ES", name: "Español", flag: "🇪🇸" },
  { code: "tr", label: "TR", name: "Türkçe", flag: "🇹🇷" },
  { code: "pt", label: "PT", name: "Português", flag: "🇵🇹" },
  { code: "zh", label: "中文", name: "中文", flag: "🇨🇳" },
  { code: "pl", label: "PL", name: "Polski", flag: "🇵🇱" },
  { code: "sq", label: "SQ", name: "Shqip", flag: "🇦🇱" },
] as const;

export type LocaleCode = (typeof supportedLocales)[number]["code"];

export const intlLocaleByCode: Record<LocaleCode, string> = {
  nl: "nl-NL",
  en: "en-GB",
  de: "de-DE",
  fr: "fr-FR",
  it: "it-IT",
  ru: "ru-RU",
  es: "es-ES",
  tr: "tr-TR",
  pt: "pt-PT",
  zh: "zh-CN",
  pl: "pl-PL",
  sq: "sq-AL",
};

// Open Graph uses language_TERRITORY while HTML lang/hreflang and JSON-LD use
// BCP-47. Keep the formats separate so metadata is valid in every locale.
export const openGraphLocaleByCode = Object.fromEntries(
  Object.entries(intlLocaleByCode).map(([locale, value]) => [
    locale,
    value.replace("-", "_"),
  ])
) as Record<LocaleCode, string>;

export const defaultLocale: LocaleCode = "en";

export function parseSupportedLocale(input?: string | null): LocaleCode | null {
  const language = input?.trim().toLowerCase().split("-")[0];

  if (language === "cn" || language === "zh") return "zh";
  if (language === "al" || language === "sq") return "sq";

  return supportedLocales.some((locale) => locale.code === language)
    ? (language as LocaleCode)
    : null;
}

export function normalizeLocale(input?: string | null): LocaleCode {
  return parseSupportedLocale(input?.split(",")[0]) ?? defaultLocale;
}

export function resolveSupportedLocaleCandidates(
  ...candidates: Array<string | null | undefined>
): LocaleCode {
  for (const candidate of candidates) {
    const locale = parseSupportedLocale(candidate);
    if (locale) return locale;
  }

  return defaultLocale;
}

export function resolveAcceptLanguage(input?: string | null): LocaleCode {
  if (!input) return defaultLocale;

  const ranked = input
    .split(",")
    .map((entry, index) => {
      const [tag = "", ...parameters] = entry.trim().split(";");
      const qualityParameter = parameters.find((parameter) =>
        parameter.trim().toLowerCase().startsWith("q=")
      );
      const parsedQuality = qualityParameter
        ? Number.parseFloat(qualityParameter.split("=")[1] ?? "")
        : 1;
      const quality = Number.isFinite(parsedQuality)
        ? Math.min(1, Math.max(0, parsedQuality))
        : 0;

      return { index, locale: parseSupportedLocale(tag), quality };
    })
    .filter(
      (entry): entry is { index: number; locale: LocaleCode; quality: number } =>
        entry.locale !== null && entry.quality > 0
    )
    .sort((left, right) => right.quality - left.quality || left.index - right.index);

  return ranked[0]?.locale ?? defaultLocale;
}
