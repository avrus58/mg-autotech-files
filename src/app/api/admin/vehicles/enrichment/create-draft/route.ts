import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { createVehicleAdminRecord, getVehicleAdminOverview } from "@/lib/vehicleControl/admin";
import { buildVehicleEnrichmentPlan } from "@/lib/vehicleEnrichment";
import type { VehicleEnrichmentInput } from "@/lib/vehicleEnrichment/types";

type DraftPayload = Partial<VehicleEnrichmentInput> & {
  confirm?: string;
  engineCandidateId?: string;
};

export async function POST(request: Request) {
  const auth = await requireStaffPermission(request, "vehicles.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null) as DraftPayload | null;
  if (!body || body.confirm !== "CREATE_DRAFT" || !Array.isArray(body.entries) || !body.engineCandidateId) {
    return NextResponse.json({
      error: "Draft creation requires entries, engineCandidateId and confirm=CREATE_DRAFT.",
      mutation: false,
    }, { status: 400 });
  }

  const overview = await getVehicleAdminOverview();
  const plan = buildVehicleEnrichmentPlan({
    sourceType: body.sourceType ?? "manual",
    sourceName: body.sourceName ?? null,
    sourceUrl: body.sourceUrl ?? null,
    brand: body.brand ?? null,
    model: body.model ?? null,
    entries: body.entries,
    modernOnly: body.modernOnly !== false,
    yearCutoff: body.yearCutoff ?? 2020,
  }, overview.records);
  const candidate = plan.engineCandidates.find((item) => item.id === body.engineCandidateId);
  const gap = plan.gaps.find((item) => item.engineCandidateId === body.engineCandidateId);
  if (!candidate) return NextResponse.json({ error: "Engine candidate not found.", mutation: false }, { status: 404 });
  if (gap?.matchedExistingEngine) {
    return NextResponse.json({ error: "Existing engine match found. Create a diff review instead of duplicating.", gap, mutation: false }, { status: 409 });
  }
  if (gap?.protectedManualVerified) {
    return NextResponse.json({ error: "Protected manual verified record conflict. Draft creation blocked.", gap, mutation: false }, { status: 409 });
  }

  const sourceReference = [
    "vehicle_enrichment",
    body.sourceName || body.sourceType || "manual",
    body.sourceUrl || "no-url",
  ].join(":").slice(0, 500);
  const result = await createVehicleAdminRecord({
    brand: candidate.brand,
    model: candidate.model,
    generation: candidate.generation,
    engine: candidate.engineDisplayName,
    yearFrom: candidate.yearFrom,
    yearTo: candidate.yearTo,
    fuelType: candidate.fuelType,
    displacementCc: candidate.displacementCc,
    stockHp: candidate.stockHp,
    stockNm: candidate.stockNm,
    tunedHp: candidate.stage1Estimate.stage1HpEstimate,
    tunedNm: candidate.stage1Estimate.stage1NmEstimate,
    ecuType: null,
    services: candidate.services,
    customerSafeNotes: null,
    adminTechnicalNotes: [
      "Created from Vehicle Intelligence Enrichment Center as unpublished needs_review draft.",
      "Stage 1 values are auto-estimated at +15% and require MG AutoTech verification.",
      `Source URL/reference: ${body.sourceUrl || candidate.sourceUrl || "not provided"}`,
      `Candidate confidence: ${candidate.confidenceScore}`,
    ].join("\n"),
    sourceType: "external_enrichment",
    sourceReference,
    confidenceScore: Math.min(candidate.confidenceScore, 70),
    verificationStatus: "needs_review",
    published: false,
    active: true,
  }, auth.user.id);

  if (!result.ok) return NextResponse.json({ error: "Draft vehicle has validation errors.", issues: result.issues }, { status: 400 });
  return NextResponse.json({ detail: result.detail, gap, mutation: true }, { status: 201 });
}
