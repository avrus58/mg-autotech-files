export const supportedLocales = [
  { code: "nl", label: "NL", name: "Nederlands" },
  { code: "en", label: "EN", name: "English" },
  { code: "de", label: "DE", name: "Deutsch" },
  { code: "fr", label: "FR", name: "Francais" },
  { code: "it", label: "IT", name: "Italiano" },
  { code: "ru", label: "RU", name: "Russian" },
  { code: "es", label: "ES", name: "Espanol" },
  { code: "tr", label: "TR", name: "Turkce" },
  { code: "pt", label: "PT", name: "Portugues" },
  { code: "zh", label: "CN", name: "Chinese" },
  { code: "pl", label: "PL", name: "Polski" },
  { code: "sq", label: "AL", name: "Shqip" },
] as const;

export type LocaleCode = (typeof supportedLocales)[number]["code"];

export const defaultLocale: LocaleCode = "en";

export function normalizeLocale(input?: string | null): LocaleCode {
  const language = input?.toLowerCase().split(",")[0]?.split("-")[0];

  if (language === "cn" || language === "zh") return "zh";
  if (language === "al" || language === "sq") return "sq";

  return supportedLocales.some((locale) => locale.code === language)
    ? (language as LocaleCode)
    : defaultLocale;
}
