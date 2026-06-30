import type { MetadataRoute } from "next";
import {
  absoluteUrl,
  languageAlternates,
  localizedUrl,
  publicServiceSlugs,
  seoLocales,
  siteUrl,
} from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const toolPaths = [
    "/tools",
    "/tools/torque-power-calculator",
    "/tools/autotuner-log-analyzer",
  ];
  const publicPages: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
      alternates: {
        languages: languageAlternates("/"),
      },
    },
    ...publicServiceSlugs.map((slug) => {
      const path = `/services/${slug}`;

      return {
        url: absoluteUrl(path),
        lastModified,
        changeFrequency: "monthly" as const,
        priority: 0.85,
        alternates: {
          languages: languageAlternates(path),
        },
      };
    }),
  ];

  const localizedPages: MetadataRoute.Sitemap = seoLocales.flatMap((locale) => [
    {
      url: localizedUrl(locale, "/"),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.95,
      alternates: {
        languages: languageAlternates("/"),
      },
    },
    ...publicServiceSlugs.map((slug) => {
      const path = `/services/${slug}`;

      return {
        url: localizedUrl(locale, path),
        lastModified,
        changeFrequency: "monthly" as const,
        priority: 0.82,
        alternates: {
          languages: languageAlternates(path),
        },
      };
    }),
  ]);

  return [
    ...publicPages,
    ...localizedPages,
    ...toolPaths.map((path) => ({
      url: absoluteUrl(path),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: path === "/tools" ? 0.85 : 0.8,
    })),
    {
      url: `${siteUrl}/widget`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${siteUrl}/av-vertrag`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${siteUrl}/agb`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/datenschutz`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/impressum`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/widerruf`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
