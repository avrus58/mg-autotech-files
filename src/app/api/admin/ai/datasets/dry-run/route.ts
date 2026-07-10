import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { createDatasetDryRun } from "@/lib/aiFileIntelligence/datasetPairing";
import { importSourceTypes } from "@/lib/aiFileIntelligence/datasetImport";

const descriptorSchema = z.object({
  filename: z.string().trim().min(1).max(260),
  folder: z.string().trim().max(500).nullable().optional(),
  fileSize: z.number().int().min(0).nullable().optional(),
  fingerprint: z.string().trim().max(160).nullable().optional(),
  providerMetadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

const requestSchema = z.object({
  sourceType: z.enum(importSourceTypes).default("manual_upload"),
  sourceName: z.string().trim().max(160).nullable().optional(),
  providerName: z.string().trim().max(160).nullable().optional(),
  files: z.array(descriptorSchema).min(1).max(500),
});

export async function POST(request: Request) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid dry-run payload." }, { status: 400 });
  }

  return NextResponse.json({
    ...createDatasetDryRun(parsed.data),
    persisted: false,
    mutation: "none",
    message: "Dry-run complete. No files, storage objects or training samples were created.",
  });
}
