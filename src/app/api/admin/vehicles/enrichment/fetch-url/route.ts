import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getAllVehicleAdminRecords } from "@/lib/vehicleControl/admin";
import { buildVehicleEnrichmentPlan } from "@/lib/vehicleEnrichment";
import { fetchAndExtractVehicleUrl } from "@/lib/vehicleEnrichment/urlImport";

const fetchUrlSchema = z.object({
  sourceName: z.string().trim().max(180).nullable().optional(),
  sourceUrl: z.string().trim().min(8).max(2000),
  sourceType: z.enum(["auto", "html", "json", "csv", "text"]).default("auto"),
  modernYearCutoff: z.number().int().min(1980).max(2035).optional(),
  modernOnly: z.boolean().optional().default(true),
}).strict();

export async function POST(request: Request) {
  const auth = await requireStaffPermission(request, "vehicles.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = fetchUrlSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid URL enrichment payload." }, { status: 400 });
  }

  try {
    const extraction = await fetchAndExtractVehicleUrl({
      sourceName: parsed.data.sourceName,
      sourceUrl: parsed.data.sourceUrl,
      sourceType: parsed.data.sourceType,
    });
    const records = await getAllVehicleAdminRecords();
    const plan = buildVehicleEnrichmentPlan({
      sourceType: "url",
      sourceName: parsed.data.sourceName ?? extraction.title ?? "URL source",
      sourceUrl: parsed.data.sourceUrl,
      entries: extraction.candidates,
      modernOnly: parsed.data.modernOnly !== false,
      yearCutoff: parsed.data.modernYearCutoff ?? 2020,
    }, records);

    return NextResponse.json({
      fetch: {
        title: extraction.title,
        sourceUrl: parsed.data.sourceUrl,
        finalUrl: extraction.finalUrl,
        contentType: extraction.contentType,
        fetchedBytes: extraction.fetchedBytes,
        detectedRows: extraction.detectedRows,
        detectedItems: extraction.detectedItems,
        extractedCandidateCount: extraction.candidates.length,
        confidence: extraction.confidence,
        warnings: extraction.warnings,
        errors: extraction.errors,
      },
      entries: extraction.candidates,
      normalizedCandidates: {
        generationGroups: plan.generationGroups,
        engineCandidates: plan.engineCandidates,
      },
      comparison: {
        gaps: plan.gaps,
        coverage: plan.coverage,
        stats: plan.coverage.stats,
        sourceMappings: plan.coverage.sourceMappings,
        reviewQueue: plan.coverage.reviewQueue,
      },
      plan,
      coverage: plan.coverage,
      dryRun: true,
      mutation: false,
      reviewStatus: "needs_review",
      legalNotice: "Only import data you are allowed to use. URL import performs a one-page extraction for admin review and does not auto-publish.",
      policy: "Exact URL fetch only. No broad crawling, no anti-bot bypass, no auto-publish and no overwrite of verified records.",
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "URL enrichment fetch failed.",
      dryRun: true,
      mutation: false,
    }, { status: 400 });
  }
}
