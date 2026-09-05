import { logStudioT } from "@/lib/i18n/log-analysis-studio-translations";
import type { LocaleCode } from "@/lib/i18nConfig";

export function deadMetadataBuilder(locale: string) {
  return (logStudioT("en", "studioTitle"), { title: locale });
}

export function nestedDeadMetadataBuilder(locale: LocaleCode) {
  function neverCalled() {
    return { title: logStudioT(locale, "studioTitle") };
  }

  return { title: locale, description: neverCalled.name };
}

export function irrelevantFieldMetadataBuilder(locale: LocaleCode) {
  return {
    title: locale,
    description: logStudioT(locale, "studioTitle"),
  };
}

function metadataFromFields(title: string, description: string) {
  return { title, description };
}

export function wrongHelperFieldMetadataBuilder(locale: LocaleCode) {
  return metadataFromFields(locale, logStudioT(locale, "studioTitle"));
}

export function spreadOverrideMetadataBuilder(locale: LocaleCode) {
  return {
    title: logStudioT(locale, "studioTitle"),
    ...metadataOverride(locale),
  };
}

function metadataOverride(locale: LocaleCode): Record<string, string> {
  return { title: locale };
}

export function duplicateOverrideMetadataBuilder(locale: LocaleCode) {
  return {
    title: logStudioT(locale, "studioTitle"),
    // @ts-expect-error This negative fixture intentionally duplicates title.
    title: locale,
  };
}
