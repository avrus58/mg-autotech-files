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
          ...seoLocales.map((locale) => `/${locale}`),
          ...seoLocales.flatMap((locale) =>
            publicServiceSlugs.map((slug) => `/${locale}/services/${slug}`)
          ),
          "/agb",
          "/datenschutz",
          "/impressum",
          "/widerruf",
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
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
