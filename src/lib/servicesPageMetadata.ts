import type { Metadata } from "next";
import type { LocaleCode } from "@/lib/i18nConfig";
import {
  runtimePublicAlternates,
  runtimePublicMetadataCopy,
  runtimePublicOpenGraphLocale,
  runtimePublicT,
} from "@/lib/i18n/runtime-public";
import { absoluteUrl, siteName } from "@/lib/seo";

export const servicesPageTitle = "ECU & TCU File Service Catalog for Workshops";
export const servicesPageDescription =
  "Find the right ECU or TCU file service for Stage 1-3, gearbox tuning, DPF, EGR, AdBlue, DTC, file checks and workshop read-method guidance.";

export function buildServicesMetadata(locale: LocaleCode): Metadata {
  const scopes = ["core", "services", "service-intent"] as const;
  const copy = runtimePublicMetadataCopy(
    locale,
    servicesPageTitle,
    servicesPageDescription,
    scopes
  );

  return {
    title: copy.title,
    description: copy.description,
    alternates: runtimePublicAlternates("/services"),
    openGraph: {
      title: `${copy.title} | MG AutoTech`,
      description: copy.description,
      url: absoluteUrl("/services"),
      siteName,
      type: "website",
      locale: runtimePublicOpenGraphLocale(locale),
      images: [
        {
          url: absoluteUrl("/opengraph-image"),
          width: 1200,
          height: 630,
          alt: runtimePublicT(
            locale,
            "MG AutoTech ECU and TCU solution catalog",
            scopes
          ),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${copy.title} | MG AutoTech`,
      description: copy.description,
      images: [absoluteUrl("/opengraph-image")],
    },
  };
}
