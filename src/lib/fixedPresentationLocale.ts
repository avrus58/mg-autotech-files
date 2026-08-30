import type { LocaleCode } from "@/lib/i18nConfig";

/**
 * Routes whose content is intentionally authored in one fixed language.
 * Visiting one of these routes must not overwrite the visitor's saved site
 * preference, but route-level UI must use the authored language.
 */
export const fixedPresentationLocaleBySegment = {
  agb: "de",
  "av-vertrag": "de",
  datenschutz: "de",
  impressum: "de",
  widerruf: "de",
  admin: "en",
  embed: "en",
  privacy: "en",
} as const satisfies Partial<Record<string, LocaleCode>>;

export function getFixedPresentationLocale(pathname: string): LocaleCode | null {
  const firstSegment = pathname.split("/").filter(Boolean)[0];

  return firstSegment
    ? fixedPresentationLocaleBySegment[
        firstSegment as keyof typeof fixedPresentationLocaleBySegment
      ] ?? null
    : null;
}
