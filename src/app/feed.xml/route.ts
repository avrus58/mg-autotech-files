import { NextResponse } from "next/server";
import { absoluteUrl, siteName } from "@/lib/seo";
import { serviceIntentGuides } from "@/lib/serviceIntentGuides";
import { workshopGuideArticles } from "@/lib/workshopGuides";

const xmlEscape = (value: string) =>
  value.replace(/[<>&"']/g, (character) => {
    const entities: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      '"': "&quot;",
      "'": "&apos;",
    };
    return entities[character];
  });

export async function GET() {
  const items = [
    ...serviceIntentGuides.map((guide) => ({
      title: guide.metaTitle,
      description: guide.description,
      href: `/services/${guide.slug}`,
      publishedAt: guide.publishedAt,
    })),
    ...workshopGuideArticles.map((guide) => ({
      title: guide.title,
      description: guide.description,
      href: `/workshop-guides/${guide.slug}`,
      publishedAt: guide.updatedAt,
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(siteName)}</title>
    <link>${absoluteUrl("/")}</link>
    <description>Public ECU and TCU file-service guidance for workshops.</description>
    <language>en</language>
    <atom:link href="${absoluteUrl("/feed.xml")}" rel="self" type="application/rss+xml" />
${items
  .map((item) => {
    const url = absoluteUrl(item.href);
    return `    <item>
      <title>${xmlEscape(item.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${xmlEscape(item.description)}</description>
      <pubDate>${new Date(item.publishedAt).toUTCString()}</pubDate>
    </item>`;
  })
  .join("\n")}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
