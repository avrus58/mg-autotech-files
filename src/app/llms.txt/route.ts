import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/seo";
import { serviceIntentGuides } from "@/lib/serviceIntentGuides";
import { workshopGuideArticles } from "@/lib/workshopGuides";

export async function GET() {
  const serviceLinks = serviceIntentGuides
    .map((guide) => `- [${guide.name}](${absoluteUrl(`/services/${guide.slug}`)}): ${guide.description}`)
    .join("\n");
  const guideLinks = workshopGuideArticles
    .map((guide) => `- [${guide.shortTitle}](${absoluteUrl(`/workshop-guides/${guide.slug}`)}): ${guide.description}`)
    .join("\n");

  const body = `# MG AutoTech File Service

> Public information for workshops preparing ECU and TCU file-service requests. Private uploads, order data, customer communication and delivery remain inside the authenticated portal.

## Primary public routes
- [File Service Hub](${absoluteUrl("/file-service")})
- [Service Catalog](${absoluteUrl("/services")})
- [How It Works](${absoluteUrl("/how-it-works")})
- [Workshop Guides](${absoluteUrl("/workshop-guides")})
- [Vehicle Brands](${absoluteUrl("/brands")})
- [ECU Platforms](${absoluteUrl("/ecu-platforms")})
- [Workshop Tools](${absoluteUrl("/tools")})

## High-intent service guides
${serviceLinks}

## Workshop knowledge
${guideLinks}

## Safety and privacy boundary
- Public pages provide service-selection and request-preparation guidance plus one browser-local text-datalog snapshot.
- The datalog snapshot reads only an explicitly selected compatible text log locally; public tools do not upload, store, modify, patch or generate ECU or TCU calibration files.
- Customer files and order details are not exposed through this discovery document.
- Service compatibility remains subject to exact vehicle, controller, software, read-method and source-file review.
`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
