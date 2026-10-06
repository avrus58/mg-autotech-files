// Public server surfaces only: keep rich service copy and its catalogs out of customer client imports.
import { defaultLocale, type LocaleCode } from "@/lib/i18nConfig";
import {
  hreflangByLocale,
  localizedUrl,
  publicServiceSlugs,
  serviceNames,
  siteUrl,
  type PublicServiceSlug,
} from "@/lib/seo";
import {
  businessAudienceTypeByLocale,
  organizationAreaServedJsonLd,
} from "@/lib/structuredDataI18n";
import { getPublicCoreService } from "@/lib/publicCoreServices";
import { publicCoreTranslations } from "@/lib/i18n/public-core-translations";
import { publicServicesTranslations } from "@/lib/i18n/public-services-translations";
import { publicSurfaceExactT } from "@/lib/i18n/public-surface-types";

export const serviceMeta = Object.fromEntries(
  publicServiceSlugs.map((slug) => {
    const service = getPublicCoreService(slug)!;
    return [slug, {
      credits: service.credits.split(" ")[0],
      turnaround: service.turnaround,
      supported: [...service.supported],
      required: [...service.requiredInfo],
    }];
  }),
) as Record<PublicServiceSlug, {
  credits: string;
  turnaround: string;
  supported: string[];
  required: string[];
}>;

export function getServiceSeo(slug: PublicServiceSlug, locale: LocaleCode) {
  const service = getPublicCoreService(slug)!;
  const name = serviceNames[slug][locale] ?? serviceNames[slug][defaultLocale];
  const t = (source: string) => {
    const translated = publicSurfaceExactT(locale, source, publicServicesTranslations);
    return translated !== source ? translated : publicSurfaceExactT(locale, source, publicCoreTranslations);
  };
  const required = service.requiredInfo.map(t);

  return {
    slug,
    name,
    title: t(service.title),
    eyebrow: t(service.eyebrow),
    description: t(service.description),
    credits: serviceMeta[slug].credits,
    turnaround: t(service.turnaround),
    hero: t(service.hero),
    intro: service.intro.map(t),
    benefits: service.benefits.map(t),
    process: service.process.map((step) => ({ title: t(step.title), text: t(step.text) })),
    supported: service.supported.map(t),
    required,
    requiredInfo: required,
    faq: service.faq.map((item) => ({ q: t(item.q), a: t(item.a) })),
    notice: service.notice ? { ...service.notice, title: t(service.notice.title), text: t(service.notice.text) } : undefined,
  };
}

export function serviceJsonLd(slug: PublicServiceSlug, locale: LocaleCode) {
  const service = getServiceSeo(slug, locale);

  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.name,
    description: service.description,
    serviceType: service.name,
    inLanguage: hreflangByLocale[locale],
    category: service.name,
    audience: {
      "@type": "BusinessAudience",
      audienceType: businessAudienceTypeByLocale[locale],
    },
    provider: {
      "@id": `${siteUrl}/#organization`,
    },
    areaServed: organizationAreaServedJsonLd,
    url: localizedUrl(locale, `/services/${slug}`),
    mainEntityOfPage: localizedUrl(locale, `/services/${slug}`),
  };
}
