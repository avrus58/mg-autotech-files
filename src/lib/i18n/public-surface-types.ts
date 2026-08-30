import type { LocaleCode } from "@/lib/i18nConfig";

export const publicSurfaceLocaleOrder = [
  "de",
  "tr",
  "nl",
  "fr",
  "it",
  "es",
  "pt",
  "pl",
  "ru",
  "zh",
  "sq",
] as const satisfies readonly Exclude<LocaleCode, "en">[];

export type PublicSurfaceTranslationTuple = readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

export function publicSurfaceExactT(
  locale: LocaleCode,
  source: string,
  catalog: Readonly<Record<string, PublicSurfaceTranslationTuple>>
) {
  if (locale === "en") return source;
  const localeIndex = publicSurfaceLocaleOrder.indexOf(locale);
  if (localeIndex < 0) return source;
  return catalog[source]?.[localeIndex] ?? source;
}
