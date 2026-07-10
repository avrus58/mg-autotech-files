import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { mapCategories } from "@/lib/aiFileIntelligence/types";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function tableMissing(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "42P01" ||
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    error?.code === "PGRST205" ||
    error?.message?.includes("schema cache");
}

const definitionSchema = z.object({
  mapName: z.string().trim().min(1).max(160),
  category: z.enum(mapCategories),
  offsetStart: z.number().int().min(0),
  offsetEnd: z.number().int().min(0),
  rows: z.number().int().min(1).max(10000).nullable().optional(),
  cols: z.number().int().min(1).max(10000).nullable().optional(),
  dataType: z.string().trim().max(40).nullable().optional(),
  endian: z.string().trim().max(20).nullable().optional(),
  factor: z.number().nullable().optional(),
  unit: z.string().trim().max(40).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  confidenceScore: z.number().int().min(0).max(100).default(50),
  humanVerified: z.boolean().default(false),
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(160),
  ecuFamily: z.string().trim().max(120).nullable().optional(),
  ecuType: z.string().trim().max(180).nullable().optional(),
  swNumber: z.string().trim().max(120).nullable().optional(),
  hwNumber: z.string().trim().max(120).nullable().optional(),
  vehicleBrand: z.string().trim().max(120).nullable().optional(),
  vehicleModel: z.string().trim().max(160).nullable().optional(),
  engine: z.string().trim().max(160).nullable().optional(),
  sourceType: z.string().trim().min(1).max(80).default("manual"),
  sourceReference: z.string().trim().max(500).nullable().optional(),
  confidenceScore: z.number().int().min(0).max(100).default(50),
  humanVerified: z.boolean().default(false),
  definitions: z.array(definitionSchema).max(250).default([]),
});

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const admin = getSupabaseAdmin();
  const [sets, definitions] = await Promise.all([
    admin
      .from("ai_map_definition_sets")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 250)),
    admin
      .from("ai_map_definitions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  const error = sets.error || definitions.error;
  if (error) {
    return NextResponse.json(
      { error: error.message, setupRequired: tableMissing(error) },
      { status: tableMissing(error) ? 503 : 500 }
    );
  }

  const definitionRows = definitions.data ?? [];
  return NextResponse.json({
    sets: (sets.data ?? []).map((set) => ({
      ...set,
      definition_count: definitionRows.filter((definition) => definition.definition_set_id === set.id).length,
    })),
    definitions: definitionRows,
  });
}

export async function POST(request: Request) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid map definition set." },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdmin();
  const input = parsed.data;
  const insertedSet = await admin
    .from("ai_map_definition_sets")
    .insert({
      name: input.name,
      ecu_family: input.ecuFamily || null,
      ecu_type: input.ecuType || null,
      sw_number: input.swNumber || null,
      hw_number: input.hwNumber || null,
      vehicle_brand: input.vehicleBrand || null,
      vehicle_model: input.vehicleModel || null,
      engine: input.engine || null,
      source_type: input.sourceType,
      source_reference: input.sourceReference || null,
      confidence_score: input.confidenceScore,
      human_verified: input.humanVerified,
      verification_status: input.humanVerified ? "confirmed" : "pending",
      created_by: auth.user.id,
      updated_by: auth.user.id,
    })
    .select("*")
    .single();

  if (insertedSet.error || !insertedSet.data) {
    return NextResponse.json(
      { error: insertedSet.error?.message || "Map definition set could not be created.", setupRequired: tableMissing(insertedSet.error) },
      { status: tableMissing(insertedSet.error) ? 503 : 500 }
    );
  }

  if (input.definitions.length) {
    const insertedDefinitions = await admin.from("ai_map_definitions").insert(
      input.definitions.map((definition) => ({
        definition_set_id: insertedSet.data.id,
        map_name: definition.mapName,
        category: definition.category,
        offset_start: definition.offsetStart,
        offset_end: definition.offsetEnd,
        rows: definition.rows ?? null,
        cols: definition.cols ?? null,
        data_type: definition.dataType ?? null,
        endian: definition.endian ?? null,
        factor: definition.factor ?? null,
        unit: definition.unit ?? null,
        description: definition.description ?? null,
        confidence_score: definition.confidenceScore,
        human_verified: definition.humanVerified,
        created_by: auth.user.id,
        updated_by: auth.user.id,
      }))
    );
    if (insertedDefinitions.error) {
      return NextResponse.json({ error: insertedDefinitions.error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ set: insertedSet.data });
}
