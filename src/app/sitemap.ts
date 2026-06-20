import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://file.mgautotech.de";

  const lastModified = new Date();
  const serviceRoutes = [
    "stage-1",
    "dpf-off",
    "egr-off",
    "adblue-off",
    "dtc-off",
  ];

  return [
    {
      url: `${baseUrl}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...serviceRoutes.map((slug) => ({
      url: `${baseUrl}/services/${slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.85,
    })),
    {
      url: `${baseUrl}/agb`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/datenschutz`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/impressum`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/widerruf`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
