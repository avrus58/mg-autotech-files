import type { MetadataRoute } from "next";
import {
  localizedSeoLocales,
  publicServiceSlugs,
  siteUrl,
} from "@/lib/seo";
import { serviceIntentGuideSlugs } from "@/lib/serviceIntentGuides";
import { indexNowKeyPath } from "@/lib/searchEngineIndexing";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/file-service",
          "/services",
          ...publicServiceSlugs.map((slug) => `/services/${slug}`),
          ...serviceIntentGuideSlugs.map((slug) => `/services/${slug}`),
          "/feed.xml",
          "/llms.txt",
          "/robots.txt",
          "/sitemap.xml",
          indexNowKeyPath,
          "/how-it-works",
          ...localizedSeoLocales.map((locale) => `/${locale}`),
          ...localizedSeoLocales.map((locale) => `/${locale}/how-it-works`),
          ...localizedSeoLocales.map((locale) => `/${locale}/file-service`),
          ...localizedSeoLocales.flatMap((locale) =>
            publicServiceSlugs.map((slug) => `/${locale}/services/${slug}`)
          ),
          "/agb",
          "/datenschutz",
          "/impressum",
          "/widerruf",
          "/widget",
          "/about",
          "/contact",
          "/brands",
          "/brands/",
          "/ecu-platforms",
          "/ecu-platforms/",
          "/tools",
          "/tools/file-readiness-check",
          "/tools/request-brief-builder",
          "/tools/ecu-read-method-advisor",
          "/tools/torque-power-calculator",
          "/tools/autotuner-log-analyzer",
          "/workshop-guides",
          "/workshop-guides/",
        ],
        disallow: [
          "/admin",
          "/api",
          "/auth",
          "/dashboard",
          "/forgot-password",
          "/login",
          "/new-request",
          "/payment",
          "/register",
          "/reset-password",
          "/embed",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
