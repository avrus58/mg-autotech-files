import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  PublicCoreServiceExperience,
  getPublicCoreServiceMetadata,
} from "@/components/PublicCoreServiceExperience";
import { ServiceIntentPage, getServiceIntentGuideMetadata } from "@/components/ServiceIntentPage";
import { getServiceIntentGuide } from "@/lib/serviceIntentGuides";
import { serviceIntentGuideSlugs } from "@/lib/serviceIntentGuideRoutes";
import {
  isPublicServiceSlug,
  isSeoLocale,
  localizedSeoLocales,
  publicServiceSlugs,
} from "@/lib/seo";

export function generateStaticParams() {
  return localizedSeoLocales.flatMap((locale) => [
    ...publicServiceSlugs.map((slug) => ({ locale, slug })),
    ...serviceIntentGuideSlugs.map((slug) => ({ locale, slug })),
  ]);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, slug: rawSlug } = await params;

  if (!isSeoLocale(rawLocale)) return {};
  const intentGuide = getServiceIntentGuide(rawSlug);
  if (intentGuide) return getServiceIntentGuideMetadata(intentGuide, rawLocale);
  if (!isPublicServiceSlug(rawSlug)) return {};
  return getPublicCoreServiceMetadata(rawSlug, rawLocale);
}

export default async function LocalizedServicePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug: rawSlug } = await params;

  if (!isSeoLocale(rawLocale)) notFound();
  const intentGuide = getServiceIntentGuide(rawSlug);
  if (intentGuide) return <ServiceIntentPage guide={intentGuide} locale={rawLocale} />;
  if (!isPublicServiceSlug(rawSlug)) notFound();
  return <PublicCoreServiceExperience slug={rawSlug} locale={rawLocale} />;
}
