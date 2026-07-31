import { brandGuides, platformGuides } from "@/lib/industry-content";
import { publicServiceSlugs, getServiceSeo } from "@/lib/seo";
import { serviceIntentGuides } from "@/lib/serviceIntentGuides";
import type { ContentInventoryItem } from "@/lib/seoGrowth/types";
import { workshopGuideArticles } from "@/lib/workshopGuides";

const coreRoutes: ContentInventoryItem[] = [
  { path: "/", group: "core", label: "Homepage" },
  { path: "/file-service", group: "core", label: "File Service Hub" },
  { path: "/services", group: "core", label: "Services" },
  { path: "/how-it-works", group: "core", label: "How It Works" },
  { path: "/brands", group: "core", label: "Vehicle Brands" },
  { path: "/ecu-platforms", group: "core", label: "ECU Platforms" },
  { path: "/workshop-guides", group: "core", label: "Workshop Guides" },
  { path: "/tools", group: "core", label: "Workshop Tools" },
];

const toolRoutes: ContentInventoryItem[] = [
  { path: "/tools/file-readiness-check", group: "tool", label: "File Readiness Check" },
  { path: "/tools/request-brief-builder", group: "tool", label: "Request Brief Builder" },
  { path: "/tools/ecu-read-method-advisor", group: "tool", label: "ECU Read Method Advisor" },
  { path: "/tools/torque-power-calculator", group: "tool", label: "Torque Power Calculator" },
];

export function getPublicSeoContentInventory(): ContentInventoryItem[] {
  const items: ContentInventoryItem[] = [
    ...coreRoutes,
    ...toolRoutes,
    ...publicServiceSlugs.map((slug) => ({
      path: `/services/${slug}`,
      group: "service" as const,
      label: getServiceSeo(slug, "en").name,
    })),
    ...serviceIntentGuides.map((guide) => ({
      path: `/services/${guide.slug}`,
      group: "service_intent" as const,
      label: guide.name,
    })),
    ...brandGuides.map((guide) => ({
      path: `/brands/${guide.slug}`,
      group: "brand" as const,
      label: guide.name,
    })),
    ...platformGuides.map((guide) => ({
      path: `/ecu-platforms/${guide.slug}`,
      group: "platform" as const,
      label: guide.name,
    })),
    ...workshopGuideArticles.map((guide) => ({
      path: `/workshop-guides/${guide.slug}`,
      group: "workshop_guide" as const,
      label: guide.title,
    })),
  ];
  return [...new Map(items.map((item) => [item.path, item])).values()];
}
