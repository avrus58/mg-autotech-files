import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  PublicCoreServiceExperience,
  getPublicCoreServiceMetadata,
} from "@/components/PublicCoreServiceExperience";
import { ServiceIntentPage } from "@/components/ServiceIntentPage";
import { absoluteUrl, isPublicServiceSlug, publicServiceSlugs, siteName } from "@/lib/seo";
import {
  runtimePublicAlternates,
  runtimePublicMetadataCopy,
  runtimePublicOpenGraphLocale,
} from "@/lib/i18n/runtime-public";
import { getServiceIntentGuide, serviceIntentGuideSlugs } from "@/lib/serviceIntentGuides";
import { getServerLocale } from "@/lib/serverLocale";
import { defaultLocale } from "@/lib/i18nConfig";

export function generateStaticParams() {
  return [
    ...publicServiceSlugs.map((slug) => ({ slug })),
    ...serviceIntentGuideSlugs.map((slug) => ({ slug })),
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const scopes = ["core", "services", "service-intent"] as const;
  const intentGuide = getServiceIntentGuide(slug);
  const locale = intentGuide ? await getServerLocale() : defaultLocale;

  if (intentGuide) {
    const canonical = absoluteUrl(`/services/${intentGuide.slug}`);
    const copy = runtimePublicMetadataCopy(
      locale,
      intentGuide.metaTitle,
      intentGuide.description,
      scopes
    );
    const socialTitle = `${copy.title} | MG AutoTech`;

    return {
      title: copy.title,
      description: copy.description,
      alternates: runtimePublicAlternates(`/services/${intentGuide.slug}`),
      openGraph: {
        title: socialTitle,
        description: copy.description,
        url: canonical,
        siteName,
        locale: runtimePublicOpenGraphLocale(locale),
        type: "website",
        images: [
          {
            url: absoluteUrl("/opengraph-image"),
            width: 1200,
            height: 630,
            alt: copy.title,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: socialTitle,
        description: copy.description,
        images: [absoluteUrl("/opengraph-image")],
      },
    };
  }

  if (!isPublicServiceSlug(slug)) return {};
  return getPublicCoreServiceMetadata(slug, defaultLocale);
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const intentGuide = getServiceIntentGuide(slug);
  const locale = intentGuide ? await getServerLocale() : defaultLocale;

  if (intentGuide) return <ServiceIntentPage guide={intentGuide} locale={locale} />;
  if (!isPublicServiceSlug(slug)) notFound();

  return <PublicCoreServiceExperience slug={slug} locale={defaultLocale} />;
}
