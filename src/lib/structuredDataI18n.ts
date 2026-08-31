import type { LocaleCode } from "@/lib/i18nConfig";

export const customerSupportContactTypeByLocale: Record<LocaleCode, string> = {
  en: "Customer support",
  nl: "Klantenservice",
  de: "Kundensupport",
  fr: "Service client",
  it: "Assistenza clienti",
  ru: "Поддержка клиентов",
  es: "Atención al cliente",
  tr: "Müşteri desteği",
  pt: "Apoio ao cliente",
  zh: "客户支持",
  pl: "Obsługa klienta",
  sq: "Mbështetje për klientët",
};

export const businessAudienceTypeByLocale: Record<LocaleCode, string> = {
  en: "Automotive workshops and tuning professionals",
  nl: "Autowerkplaatsen en professionele tuners",
  de: "Kfz-Werkstätten und professionelle Tuner",
  fr: "Ateliers automobiles et préparateurs professionnels",
  it: "Officine automobilistiche e preparatori professionisti",
  ru: "Автомобильные мастерские и профессиональные тюнеры",
  es: "Talleres de automoción y preparadores profesionales",
  tr: "Otomotiv servisleri ve profesyonel tuning uzmanları",
  pt: "Oficinas automóveis e preparadores profissionais",
  zh: "汽车维修厂和专业调校技师",
  pl: "Warsztaty samochodowe i profesjonalni tunerzy",
  sq: "Servise automobilistike dhe specialistë të tunimit",
};

export const europeRegionJsonLd = {
  "@type": "Place",
  identifier: {
    "@type": "PropertyValue",
    propertyID: "UN M49",
    value: "150",
  },
} as const;

export const organizationAreaServedJsonLd = [
  {
    "@type": "Country",
    identifier: "DE",
  },
  {
    "@type": "AdministrativeArea",
    identifier: "EU",
  },
  europeRegionJsonLd,
] as const;

/**
 * Technical runtime requirements are deliberately language-neutral. Schema.org
 * accepts free text here, but prose would otherwise need to be translated on
 * every canonical route and could silently fall back to English.
 */
export const javascriptBrowserRequirementJsonLd = "JavaScript";
export const embeddedWidgetBrowserRequirementJsonLd = "JavaScript; iframe";

/** Shared social/PWA branding without an English-language product description. */
export const publicBrandImageAlt = "MG AutoTech · ECU · TCU";
export const publicTechnicalCategory = "ECU/TCU";

/** Search terms that remain identical across every supported language. */
export const publicTechnicalKeywords = [
  "MG AutoTech",
  "ECU",
  "TCU",
  "Stage 1",
  "Stage 2",
  "DPF",
  "EGR",
  "AdBlue",
  "DTC",
  "BMW",
  "Mercedes-Benz",
  "VAG",
] as const;

export function buildPublicMetadataKeywords(
  localizedHomepageTitle: string,
  localizedServiceNames: readonly string[]
) {
  return [
    ...publicTechnicalKeywords,
    localizedHomepageTitle,
    ...localizedServiceNames,
  ];
}

const relatedWorkshopResourcesNameByLocale: Record<
  LocaleCode,
  (localizedShortTitle: string) => string
> = {
  en: (title) => `Related workshop resources: ${title}`,
  nl: (title) => `Gerelateerde werkplaatsbronnen: ${title}`,
  de: (title) => `Zugehörige Werkstattressourcen: ${title}`,
  fr: (title) => `Ressources d’atelier associées : ${title}`,
  it: (title) => `Risorse correlate per officine: ${title}`,
  ru: (title) => `Связанные материалы для мастерских: ${title}`,
  es: (title) => `Recursos de taller relacionados: ${title}`,
  tr: (title) => `İlgili atölye kaynakları: ${title}`,
  pt: (title) => `Recursos de oficina relacionados: ${title}`,
  zh: (title) => `相关维修厂资源：${title}`,
  pl: (title) => `Powązane materiały warsztatowe: ${title}`,
  sq: (title) => `Burime të lidhura për servise: ${title}`,
};

export function relatedWorkshopResourcesName(
  locale: LocaleCode,
  localizedShortTitle: string
) {
  return relatedWorkshopResourcesNameByLocale[locale](localizedShortTitle);
}
