import type { MetadataRoute } from "next";
import { publicServiceSlugs, seoLocales, siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/services",
          ...publicServiceSlugs.map((slug) => `/services/${slug}`),
          "/how-it-works",
          ...seoLocales.map((locale) => `/${locale}`),
          ...seoLocales.map((locale) => `/${locale}/how-it-works`),
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
          "/tools/torque-power-calculator",
          "/tools/autotuner-log-analyzer",
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
