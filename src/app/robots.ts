import type { MetadataRoute } from "next";
import { publicServiceSlugs, seoLocales, siteUrl } from "@/lib/seo";

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
          "/how-it-works",
          ...seoLocales.map((locale) => `/${locale}`),
          ...seoLocales.map((locale) => `/${locale}/how-it-works`),
          ...seoLocales.map((locale) => `/${locale}/file-service`),
          ...seoLocales.flatMap((locale) =>
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
