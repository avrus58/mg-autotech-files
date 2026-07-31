import type { MetadataRoute } from "next";
import {
  absoluteUrl,
  languageAlternates,
  localizedUrl,
  publicServiceSlugs,
  seoLocales,
  siteUrl,
} from "@/lib/seo";
import { brandGuides, platformGuides } from "@/lib/industry-content";
import { workshopGuideArticles } from "@/lib/workshopGuides";
import { serviceIntentGuides } from "@/lib/serviceIntentGuides";

export default function sitemap(): MetadataRoute.Sitemap {
  const contentUpdated = new Date("2026-07-31T00:00:00.000Z");
  const legalUpdated = new Date("2026-06-30T00:00:00.000Z");
  const toolPaths = [
    "/tools",
    "/tools/file-readiness-check",
    "/tools/request-brief-builder",
    "/tools/ecu-read-method-advisor",
    "/tools/torque-power-calculator",
    "/tools/autotuner-log-analyzer",
  ];
  const publicPages: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      lastModified: contentUpdated,
      changeFrequency: "weekly",
      priority: 1,
      alternates: {
        languages: languageAlternates("/"),
      },
    },
    {
      url: absoluteUrl("/how-it-works"),
      lastModified: contentUpdated,
      changeFrequency: "monthly",
      priority: 0.88,
      alternates: {
        languages: languageAlternates("/how-it-works"),
      },
    },
    {
      url: absoluteUrl("/file-service"),
      lastModified: contentUpdated,
      changeFrequency: "monthly",
      priority: 0.92,
      alternates: {
        languages: languageAlternates("/file-service"),
      },
    },
    {
      url: absoluteUrl("/services"),
      lastModified: contentUpdated,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/workshop-guides"),
      lastModified: contentUpdated,
      changeFrequency: "monthly",
      priority: 0.86,
    },
    ...workshopGuideArticles.map((article) => ({
      url: absoluteUrl(`/workshop-guides/${article.slug}`),
      lastModified: new Date(article.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...publicServiceSlugs.map((slug) => {
      const path = `/services/${slug}`;

      return {
        url: absoluteUrl(path),
        lastModified: contentUpdated,
        changeFrequency: "monthly" as const,
        priority: 0.85,
        alternates: {
          languages: languageAlternates(path),
        },
      };
    }),
    ...serviceIntentGuides.map((guide) => ({
      url: absoluteUrl(`/services/${guide.slug}`),
      lastModified: new Date(guide.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.84,
    })),
  ];

  const localizedPages: MetadataRoute.Sitemap = seoLocales.flatMap((locale) => [
    {
      url: localizedUrl(locale, "/"),
      lastModified: contentUpdated,
      changeFrequency: "weekly" as const,
      priority: 0.95,
      alternates: {
        languages: languageAlternates("/"),
      },
    },
    {
      url: localizedUrl(locale, "/how-it-works"),
      lastModified: contentUpdated,
      changeFrequency: "monthly" as const,
      priority: 0.86,
      alternates: {
        languages: languageAlternates("/how-it-works"),
      },
    },
    {
      url: localizedUrl(locale, "/file-service"),
      lastModified: contentUpdated,
      changeFrequency: "monthly" as const,
      priority: 0.88,
      alternates: {
        languages: languageAlternates("/file-service"),
      },
    },
    ...publicServiceSlugs.map((slug) => {
      const path = `/services/${slug}`;

      return {
        url: localizedUrl(locale, path),
        lastModified: contentUpdated,
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
      lastModified: contentUpdated,
      changeFrequency: "monthly" as const,
      priority: path === "/tools" ? 0.85 : 0.8,
    })),
    {
      url: `${siteUrl}/widget`,
      lastModified: contentUpdated,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${siteUrl}/agb`,
      lastModified: legalUpdated,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/datenschutz`,
      lastModified: legalUpdated,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/impressum`,
      lastModified: legalUpdated,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/widerruf`,
      lastModified: legalUpdated,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: absoluteUrl("/about"),
      lastModified: contentUpdated,
      changeFrequency: "yearly",
      priority: 0.7,
    },
    {
      url: absoluteUrl("/contact"),
      lastModified: contentUpdated,
      changeFrequency: "yearly",
      priority: 0.7,
    },
    {
      url: absoluteUrl("/brands"),
      lastModified: contentUpdated,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    ...brandGuides.map((guide) => ({
      url: absoluteUrl(`/brands/${guide.slug}`),
      lastModified: contentUpdated,
      changeFrequency: "monthly" as const,
      priority: 0.78,
    })),
    {
      url: absoluteUrl("/ecu-platforms"),
      lastModified: contentUpdated,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    ...platformGuides.map((guide) => ({
      url: absoluteUrl(`/ecu-platforms/${guide.slug}`),
      lastModified: contentUpdated,
      changeFrequency: "monthly" as const,
      priority: 0.78,
    })),
  ];
}
