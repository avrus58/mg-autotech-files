import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  PublicCoreServiceExperience,
  getPublicCoreServiceMetadata,
} from "@/components/PublicCoreServiceExperience";
import { ServiceIntentPage, getServiceIntentGuideMetadata } from "@/components/ServiceIntentPage";
import { isPublicServiceSlug, publicServiceSlugs } from "@/lib/seo";
import { getServiceIntentGuide, serviceIntentGuideSlugs } from "@/lib/serviceIntentGuides";
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
  const intentGuide = getServiceIntentGuide(slug);
  if (intentGuide) return getServiceIntentGuideMetadata(intentGuide, defaultLocale);

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
  const locale = defaultLocale;

  if (intentGuide) return <ServiceIntentPage guide={intentGuide} locale={locale} />;
  if (!isPublicServiceSlug(slug)) notFound();

  return <PublicCoreServiceExperience slug={slug} locale={defaultLocale} />;
}
