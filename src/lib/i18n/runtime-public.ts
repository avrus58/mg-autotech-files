import type { Metadata } from "next";
import {
  intlLocaleByCode,
  openGraphLocaleByCode,
  type LocaleCode,
} from "@/lib/i18nConfig";
import { publicCoreTranslations } from "@/lib/i18n/public-core-translations";
import { publicServicesTranslations } from "@/lib/i18n/public-services-translations";
import {
  publicSurfaceLocaleOrder,
} from "@/lib/i18n/public-surface-types";
import { publicToolsTranslations } from "@/lib/i18n/public-tools-translations";
import { publicVehicleTranslations } from "@/lib/i18n/public-vehicle-translations";
import {
  serviceIntentExactTranslations,
  serviceIntentLocaleOrder,
} from "@/lib/i18n/service-intent-translations";
import {
  widgetSiteExactTranslations,
  widgetSiteLocaleOrder,
} from "@/lib/i18n/widget-site-translations";
import {
  workshopGuideExactTranslations,
  workshopGuideLocaleOrder,
} from "@/lib/i18n/workshop-guides-translations";
import { absoluteUrl } from "@/lib/seo";

export const runtimePublicScopes = [
  "core",
  "vehicle",
  "services",
  "service-intent",
  "tools",
  "widget",
  "workshop-guides",
] as const;

export type RuntimePublicScope = (typeof runtimePublicScopes)[number];

type TupleCatalog = Readonly<Record<string, readonly string[]>>;

const scopeCatalogs: Record<
  RuntimePublicScope,
  { catalog: TupleCatalog; localeOrder: readonly Exclude<LocaleCode, "en">[] }
> = {
  core: {
    catalog: publicCoreTranslations,
    localeOrder: publicSurfaceLocaleOrder,
  },
  vehicle: {
    catalog: publicVehicleTranslations,
    localeOrder: publicSurfaceLocaleOrder,
  },
  services: {
    catalog: publicServicesTranslations,
    localeOrder: publicSurfaceLocaleOrder,
  },
  "service-intent": {
    catalog: serviceIntentExactTranslations,
    localeOrder: serviceIntentLocaleOrder,
  },
  tools: {
    catalog: publicToolsTranslations,
    localeOrder: publicSurfaceLocaleOrder,
  },
  widget: {
    catalog: widgetSiteExactTranslations,
    localeOrder: widgetSiteLocaleOrder,
  },
  "workshop-guides": {
    catalog: workshopGuideExactTranslations,
    localeOrder: workshopGuideLocaleOrder,
  },
};

function translateFromTupleCatalog(
  locale: LocaleCode,
  source: string,
  catalog: TupleCatalog,
  localeOrder: readonly Exclude<LocaleCode, "en">[]
) {
  if (locale === "en") return source;
  const localeIndex = localeOrder.indexOf(locale);
  if (localeIndex < 0) return source;
  return catalog[source]?.[localeIndex] ?? source;
}

/**
 * Exact-only translation for server-rendered public surfaces.
 *
 * The same reviewed tuple catalogs power the client language switcher. Exact
 * matching deliberately leaves URLs, technical identifiers and customer data
 * unchanged. Route-specific catalogs win over the shared core catalog.
 */
export function runtimePublicT(
  locale: LocaleCode,
  source: string,
  scopes: readonly RuntimePublicScope[]
) {
  if (locale === "en") return source;

  for (let index = scopes.length - 1; index >= 0; index -= 1) {
    const definition = scopeCatalogs[scopes[index]];
    const translated = translateFromTupleCatalog(
      locale,
      source,
      definition.catalog,
      definition.localeOrder
    );
    if (translated !== source) return translated;
  }

  return source;
}

export function runtimePublicText(
  locale: LocaleCode,
  value: string,
  scopes: readonly RuntimePublicScope[]
) {
  const leading = value.match(/^\s*/u)?.[0] ?? "";
  const trailing = value.match(/\s*$/u)?.[0] ?? "";
  const normalized = value.trim().replace(/\s+/gu, " ");

  if (!normalized) return value;
  const translated = runtimePublicT(locale, normalized, scopes);
  return translated === normalized ? value : `${leading}${translated}${trailing}`;
}

export function localizeRuntimePublicJsonLd<T>(
  value: T,
  locale: LocaleCode,
  scopes: readonly RuntimePublicScope[]
): T {
  if (locale === "en") return value;
  if (typeof value === "string") {
    return runtimePublicText(locale, value, scopes) as T;
  }
  if (Array.isArray(value)) {
    return value.map((entry) =>
      localizeRuntimePublicJsonLd(entry, locale, scopes)
    ) as T;
  }
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      localizeRuntimePublicJsonLd(entry, locale, scopes),
    ])
  ) as T;
}

export function runtimePublicMetadataCopy(
  locale: LocaleCode,
  title: string,
  description: string,
  scopes: readonly RuntimePublicScope[]
) {
  return {
    title: runtimePublicT(locale, title, scopes),
    description: runtimePublicT(locale, description, scopes),
  };
}

/** Runtime-localized pages retain one stable, unprefixed canonical URL. */
export function runtimePublicAlternates(pathname: string): Metadata["alternates"] {
  return { canonical: absoluteUrl(pathname) };
}

export function runtimePublicOpenGraphLocale(locale: LocaleCode) {
  return openGraphLocaleByCode[locale];
}

export function runtimePublicInLanguage(locale: LocaleCode) {
  return intlLocaleByCode[locale];
}
